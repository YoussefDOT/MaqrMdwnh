// Mdwnh presence relay — Cloudflare Worker + Durable Object
// -----------------------------------------------------------------------------
// This is a DUMB, STATELESS relay for live player positions ONLY.
// It stores nothing. A player sends "I'm at x,y", we forward it to everyone
// else in the same lobby, then it's gone. Everything that must PERSIST
// (pomodoro, azkar, accounts, prayer, shared-pomo) still lives in Firebase.
//
// One Durable Object instance = one lobby room. We pick the room by name,
// so "male" and "female" (and any future separate lobbies) never mix.
//
// THE ONE EXCEPTION (مقر ١.٥): a message that starts `{"t":"lemoq"` is a member
// asking ليمو something. It is NOT forwarded — the room asks the language model
// (src/lemo.js) and broadcasts `{t:'lemot'}` ("he is thinking, for this member")
// and then `{t:'lemoa'}` (the answer, or an error code) to everyone, the asker
// included. The only thing this object stores is today's spend, so the daily
// budget survives the room going to sleep.
// -----------------------------------------------------------------------------

import { askLemo, cleanQuestion, LemoError } from './lemo.js';

const LEMO_PREFIX = '{"t":"lemoq"';
const LEMO_BUSY_MS = 25000;        // a question stuck longer than this no longer blocks the next
const LEMO_USER_GAP_MS = 3500;     // one member, one question, then a breath (the page says 4 s)
const LEMO_HISTORY = 6;            // messages of the lobby's conversation he remembers
const BUDGET_KEY = 'lemo:budget';

// The day rolls over at midnight in Riyadh (UTC+3) — where most of the team is.
const dayKey = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean); // e.g. ["lobby","male"]

    // Health check / friendly root so you can see it's alive in a browser.
    if (parts[0] !== 'lobby' || !parts[1]) {
      return new Response('Mdwnh presence relay is running.', { status: 200 });
    }

    // Only accept WebSocket upgrade requests on the lobby path.
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket connection.', { status: 426 });
    }

    // Route every client of the same lobby to the SAME Durable Object.
    const lobbyId = parts[1];
    const id = env.LOBBY.idFromName(lobbyId);
    const stub = env.LOBBY.get(id);
    return stub.fetch(request);
  },
};

export class LobbyRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.lemoBusyAt = 0;           // a question is with the model
    this.lemoHist = [];            // the lobby's last few turns with him (memory only)
    this.lemoLast = new Map();     // uid → when he last answered them
    // Keep-alive without an audience: a client's bare "ping" is answered "pong"
    // by the runtime itself — it is NOT forwarded to the lobby and does not even
    // wake this object from hibernation. Clients used to prove they were alive by
    // broadcasting a position every 3 s, which kept every phone's radio awake.
    try {
      this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    } catch (_) { /* older runtime: pings are forwarded, and clients ignore them */ }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const uid = url.searchParams.get('uid') || crypto.randomUUID();

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Hibernatable accept: the room can sleep (no duration billing) while
    // connections stay open. We tag the socket with the player's uid so we
    // can tell others who left when it closes.
    this.state.acceptWebSocket(server, [uid]);

    return new Response(null, { status: 101, webSocket: client });
  }

  // A player sent a position update. Forward the raw bytes to everyone else.
  // We do NOT parse it (cheapest possible path) — the client already includes
  // its own uid inside the payload so receivers know who moved.
  webSocketMessage(ws, message) {
    // A question for ليمو — a cheap prefix test, so every other message still
    // goes through unparsed.
    if (typeof message === 'string' && message.startsWith(LEMO_PREFIX)) {
      return this._lemoAsk(ws, message);
    }
    for (const peer of this.state.getWebSockets()) {
      if (peer === ws) continue;
      try { peer.send(message); } catch (_) { /* peer is gone; ignore */ }
    }
  }

  // A player disconnected — tell everyone so they can drop the avatar at once
  // instead of waiting for a timeout.
  webSocketClose(ws) {
    this._broadcastBye(ws);
  }

  webSocketError(ws) {
    this._broadcastBye(ws);
  }

  // Everyone in the room, the sender included.
  _sendAll(obj) {
    const text = JSON.stringify(obj);
    for (const peer of this.state.getWebSockets()) {
      try { peer.send(text); } catch (_) { /* peer is gone; ignore */ }
    }
  }

  async _lemoAsk(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch (_) { return; }
    const tags = this.state.getTags(ws);
    const uid = tags && tags[0];
    // The asker is whoever this socket connected as — not whatever the payload claims.
    if (!uid || msg.f !== uid) return;
    const k = Number(msg.k) || 0;
    const q = cleanQuestion(msg);
    const fail = (e) => this._sendAll({ t: 'lemoa', to: uid, k, e });
    if (!q) return fail('err');

    const now = Date.now();
    if (this.lemoBusyAt && now - this.lemoBusyAt < LEMO_BUSY_MS) return fail('busy');
    const last = this.lemoLast.get(uid) || 0;
    if (now - last < LEMO_USER_GAP_MS) return fail('wait');

    // The budget — a wall, not a suggestion: per lobby per day, and per member.
    const env = this.env;
    const capUsd = Number(env.LEMO_DAILY_USD) || 0.10;
    const capUser = Number(env.LEMO_USER_DAILY) || 40;
    const day = dayKey();
    let b = await this.state.storage.get(BUDGET_KEY);
    if (!b || b.day !== day) b = { day, usd: 0, calls: 0, users: {} };
    if (b.usd >= capUsd) return fail('tired');
    if ((b.users[uid] || 0) >= capUser) return fail('you');

    this.lemoBusyAt = now;
    this._sendAll({ t: 'lemot', to: uid, k });
    try {
      const res = await askLemo(env, q, this.lemoHist);
      const pin = Number(env.LEMO_PRICE_IN) || 0.10, pout = Number(env.LEMO_PRICE_OUT) || 0.50;
      b.usd += (res.tokensIn * pin + res.tokensOut * pout) / 1e6;
      b.calls += 1;
      b.users[uid] = (b.users[uid] || 0) + 1;
      await this.state.storage.put(BUDGET_KEY, b);
      const said = res.parts.map(p => (p.m ? p.m : `[ملصق: ${p.s}]`)).join(' / ');
      this.lemoHist.push({ role: 'user', content: `${q.name}: ${q.text}` },
                         { role: 'assistant', content: JSON.stringify({ p: res.parts }) });
      while (this.lemoHist.length > LEMO_HISTORY) this.lemoHist.shift();
      this.lemoLast.set(uid, Date.now());
      this._sendAll({ t: 'lemoa', to: uid, k, p: res.parts });
      console.log(`[lemo] ${uid} in=${res.tokensIn} out=${res.tokensOut} day=$${b.usd.toFixed(4)} :: ${said}`);
    } catch (err) {
      const code = (err instanceof LemoError) ? err.code : 'err';
      console.log(`[lemo] error ${code}: ${err && err.message}`);
      fail(code);
    } finally {
      this.lemoBusyAt = 0;
    }
  }

  _broadcastBye(ws) {
    const tags = this.state.getTags(ws);
    const uid = tags && tags[0];
    if (!uid) return;
    const bye = JSON.stringify({ t: 'bye', uid });
    for (const peer of this.state.getWebSockets()) {
      if (peer === ws) continue;
      try { peer.send(bye); } catch (_) { /* ignore */ }
    }
  }
}
