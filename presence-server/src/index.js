// Mdwnh presence relay — Cloudflare Worker + Durable Object
// -----------------------------------------------------------------------------
// This is a DUMB relay for live player positions.
// It stores nothing of them. A player sends "I'm at x,y", we forward it to everyone
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
// included.
//
// AND HE OVERHEARS (مقر ١.٥): a `{"t":"chat"` message is forwarded like everything
// else, and a copy of the line goes into a short log, so that when someone asks him
// something he knows what the room was talking about.
//
// The only things this object stores are today's spend (so the daily budget survives
// the room going to sleep) and that log: his last LEMO_HISTORY messages and the
// room's last LEMO_ROOM lines, nothing older than LEMO_LOG_TTL_MS. It is stored, not
// just held in memory, because a quiet room hibernates within seconds and wakes with
// its memory empty — he used to forget the conversation between two questions.
//
// THE REVIEW LOG (for the owner only): every question he answered is also kept —
// who asked, what he was told, what he said — for LEMO_AUDIT_DAYS, so his answers can
// be checked for made-up facts or rudeness. It is never sent to the room. The one way
// to read it is `GET /lemo-log/<lobby>` with the LEMO_AUDIT_KEY secret in the
// Authorization header (tools/lemo_log.mjs does that); with no secret set, that door
// does not exist.
// -----------------------------------------------------------------------------

import { askLemo, cleanQuestion, cleanChat, LemoError } from './lemo.js';

const LEMO_PREFIX = '{"t":"lemoq"';
const CHAT_PREFIX = '{"t":"chat"';
const LEMO_BUSY_MS = 25000;        // a question stuck longer than this no longer blocks the next
const LEMO_USER_GAP_MS = 3500;     // one member, one question, then a breath (the page says 4 s)
const LEMO_HISTORY = 10;           // messages of his own conversation he remembers (questions + answers)
const LEMO_ROOM = 10;              // …and lines of the room's chat he has overheard
const LEMO_LOG_TTL_MS = 2 * 3600 * 1000;   // past this, neither is worth carrying
const BUDGET_KEY = 'lemo:budget';
const LOG_KEY = 'lemo:log';
// How chatty a member has been with him: `{ uid: { s, n } }` — n questions since s.
// A window, not a tally of the day: LEMO_TALK_MS after its first question it is
// forgotten and the count starts again (the owner's rule: he nudges a chatty member
// back to work for ten minutes, then forgets they talked a lot).
const TALK_KEY = 'lemo:talk';
const LEMO_TALK_MS = 10 * 60 * 1000;
// The review log: one stored row per question, keyed by time (13 digits, so the keys
// sort chronologically and a reader can ask for "everything since").
const AUDIT_PREFIX = 'lemo:audit:';
const AUDIT_PATH = '/__lemo-audit';       // the room's own door; only the Worker below sends here
const AUDIT_DAYS = 30;                    // default for LEMO_AUDIT_DAYS ("0" = keep no log)
const AUDIT_PAGE = 400;                   // rows per read
const AUDIT_MIN_KEY = 16;                 // a shorter secret is treated as no secret at all
const auditKeyOf = (ms) => AUDIT_PREFIX + String(Math.max(0, Math.floor(ms) || 0)).padStart(13, '0');

// Is this request allowed to read the review log? Only with the secret, sent as
// `Authorization: Bearer <LEMO_AUDIT_KEY>` — never in the URL, which ends up in logs.
function auditAllowed(request, env) {
  const key = String((env && env.LEMO_AUDIT_KEY) || '');
  if (key.length < AUDIT_MIN_KEY) return false;
  const got = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = new TextEncoder().encode(got), b = new TextEncoder().encode(key);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];   // every byte compared, match or not
  return diff === 0;
}

// The day rolls over at midnight in Riyadh (UTC+3) — where most of the team is.
const dayKey = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);

// ── القاعة: the meeting hall's screen share ──────────────────────────────────
// The shared screen is WebRTC. Sent straight from the sharer to every viewer it
// costs the sharer one upload per viewer; through Cloudflare's Realtime SFU the
// sharer uploads ONE copy and Cloudflare hands it to everyone. The SFU's API needs
// a secret the page must never see, so the page asks HERE and this Worker asks
// Cloudflare:
//   GET  /rtc/ok            → { ok }            is the SFU set up at all?
//   POST /rtc/pub { sdp, mid, name }   → { session, sdp }   publish one track
//   POST /rtc/sub { session, name }    → { session, sdp }   pull it (an offer comes back)
//   POST /rtc/ans { session, sdp }     → { ok }             the viewer's answer
// Bodies are JSON sent as text/plain (a "simple" request — no CORS preflight).
// Two secrets turn it on (Cloudflare dashboard → Realtime → create an SFU app):
//   npx wrangler secret put RTC_APP_ID
//   npx wrangler secret put RTC_APP_SECRET
// Without them /rtc/ok says { ok:false } and the page shares directly instead.
const RTC_API = 'https://rtc.live.cloudflare.com/v1/apps/';
const RTC_MAX_BODY = 60000;
const RTC_ID_RE = /^[\w-]{4,80}$/;

function rtcJson(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': origin || '*',
      'vary': 'origin',
    },
  });
}

// Only the site itself (and a local dev copy) may spend the SFU's minutes. An
// Origin header can be forged outside a browser — this keeps other WEBSITES out,
// which is the realistic misuse.
function rtcOriginOk(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  let site = '';
  try { site = new URL(String(env.SITE_BASE || '')).origin; } catch (_) {}
  if (origin === site) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin);
}

async function rtcHandle(request, env, what) {
  const origin = request.headers.get('origin') || '*';
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST',
      'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400',
    } });
  }
  if (!rtcOriginOk(request, env)) return rtcJson({ error: 'origin' }, 403, origin);
  const app = String(env.RTC_APP_ID || ''), secret = String(env.RTC_APP_SECRET || '');
  const ready = app.length > 8 && secret.length > 8;
  if (what === 'ok') return rtcJson({ ok: ready }, 200, origin);
  if (!ready) return rtcJson({ error: 'off' }, 503, origin);
  if (request.method !== 'POST') return rtcJson({ error: 'method' }, 405, origin);

  let body;
  try {
    const raw = await request.text();
    if (raw.length > RTC_MAX_BODY) return rtcJson({ error: 'big' }, 413, origin);
    body = JSON.parse(raw);
  } catch (_) { return rtcJson({ error: 'json' }, 400, origin); }
  if (!body || typeof body !== 'object') return rtcJson({ error: 'json' }, 400, origin);

  const api = async (path, method, payload) => {
    const res = await fetch(RTC_API + app + path, {
      method,
      headers: { authorization: 'Bearer ' + secret, 'content-type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j || j.errorCode) throw new Error((j && (j.errorDescription || j.errorCode)) || ('http ' + res.status));
    const bad = Array.isArray(j.tracks) && j.tracks.find(t => t && t.errorCode);
    if (bad) throw new Error(bad.errorDescription || bad.errorCode);
    return j;
  };

  try {
    if (what === 'pub') {
      if (typeof body.sdp !== 'string' || !RTC_ID_RE.test(String(body.name || '')) || body.mid == null) return rtcJson({ error: 'args' }, 400, origin);
      const s = await api('/sessions/new', 'POST');
      const t = await api('/sessions/' + s.sessionId + '/tracks/new', 'POST', {
        sessionDescription: { type: 'offer', sdp: body.sdp },
        tracks: [{ location: 'local', mid: String(body.mid), trackName: body.name }],
      });
      return rtcJson({ session: s.sessionId, sdp: t.sessionDescription.sdp }, 200, origin);
    }
    if (what === 'sub') {
      if (!RTC_ID_RE.test(String(body.session || '')) || !RTC_ID_RE.test(String(body.name || ''))) return rtcJson({ error: 'args' }, 400, origin);
      const s = await api('/sessions/new', 'POST');
      const t = await api('/sessions/' + s.sessionId + '/tracks/new', 'POST', {
        tracks: [{ location: 'remote', sessionId: body.session, trackName: body.name }],
      });
      if (!t.sessionDescription || !t.sessionDescription.sdp) throw new Error('no offer');
      return rtcJson({ session: s.sessionId, sdp: t.sessionDescription.sdp }, 200, origin);
    }
    if (what === 'ans') {
      if (!RTC_ID_RE.test(String(body.session || '')) || typeof body.sdp !== 'string') return rtcJson({ error: 'args' }, 400, origin);
      await api('/sessions/' + body.session + '/renegotiate', 'PUT', {
        sessionDescription: { type: 'answer', sdp: body.sdp },
      });
      return rtcJson({ ok: true }, 200, origin);
    }
  } catch (e) {
    console.log('[rtc] ' + what + ' failed: ' + (e && e.message));
    return rtcJson({ error: 'sfu' }, 502, origin);
  }
  return rtcJson({ error: 'path' }, 404, origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean); // e.g. ["lobby","male"]

    // The owner's review log of ليمو's answers. Without the secret this path looks
    // exactly like any other unknown one.
    if (parts[0] === 'lemo-log' && /^[a-z0-9_-]{1,32}$/.test(parts[1] || '') && auditAllowed(request, env)) {
      const room = env.LOBBY.get(env.LOBBY.idFromName(parts[1]));
      return room.fetch(new Request('https://room' + AUDIT_PATH + url.search, { headers: request.headers }));
    }

    // القاعة: the screen share's doorway to Cloudflare's SFU (see rtcHandle).
    if (parts[0] === 'rtc' && parts[1]) return rtcHandle(request, env, parts[1]);

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
    this.lemoLog = null;           // what he remembers — read from storage on first use (see _lemoLogGet)
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
    if (url.pathname === AUDIT_PATH) return this._lemoAuditRead(request, url);
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
    // The room's own chat: forwarded above as ever, and overheard by ليمو. The same
    // cheap prefix test — a position never pays for it.
    if (typeof message === 'string' && message.startsWith(CHAT_PREFIX)) {
      return this._lemoHear(ws, message);
    }
  }

  // His memory: `{k:'c',u,p|s,at}` a line of the room's chat, `{k:'q',u,n,m,at}` a
  // question he was asked, `{k:'a',p,at}` his answer (see historyMessages in lemo.js).
  async _lemoLogGet() {
    if (!this.lemoLog) {
      const saved = await this.state.storage.get(LOG_KEY);
      this.lemoLog = Array.isArray(saved) ? saved : [];
    }
    return this.lemoLog;
  }

  // The last few of each kind, and nothing stale. In place: the array is shared.
  _lemoLogTrim(log) {
    const old = Date.now() - LEMO_LOG_TTL_MS;
    let mine = 0, room = 0;
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i];
      const keep = e && e.at >= old && (e.k === 'c' ? ++room <= LEMO_ROOM : ++mine <= LEMO_HISTORY);
      if (!keep) log.splice(i, 1);
    }
  }

  async _lemoHear(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch (_) { return; }
    const tags = this.state.getTags(ws);
    const uid = tags && tags[0];
    // Only what this socket's own member said — never a line in someone else's name.
    if (!uid || msg.uid !== uid) return;
    const line = cleanChat(msg);
    if (!line) return;
    const log = await this._lemoLogGet();
    log.push({ k: 'c', u: uid, ...line, at: Date.now() });
    this._lemoLogTrim(log);
    await this.state.storage.put(LOG_KEY, log);
  }

  // The review log. What the page said about the question itself; the caller adds
  // what he read (`seen`, from lemo.js) and what he answered.
  _lemoAuditOf(uid, q) {
    return { u: uid, n: q.name, g: q.gender, q: q.text, tm: q.time, st: q.state, cnt: q.count, on: q.online, near: q.near, tk: q.tasks };
  }

  // One row per question, and anything past its keep-by date goes. Never allowed to
  // break an answer: a failed write is only logged.
  async _lemoAudit(row) {
    try {
      const set = String(this.env.LEMO_AUDIT_DAYS == null ? '' : this.env.LEMO_AUDIT_DAYS).trim();
      const days = set !== '' && Number.isFinite(Number(set)) ? Number(set) : AUDIT_DAYS;
      if (days <= 0) return;
      // The time is the key, so two rows may never share a millisecond.
      if (row.at <= (this.auditLast || 0)) row.at = this.auditLast + 1;
      this.auditLast = row.at;
      await this.state.storage.put(auditKeyOf(row.at), row);
      const old = await this.state.storage.list({ prefix: AUDIT_PREFIX, end: auditKeyOf(row.at - days * 86400000), limit: 64 });
      if (old.size) await this.state.storage.delete([...old.keys()]);
    } catch (err) {
      console.log(`[lemo] audit not saved: ${err && err.message}`);
    }
  }

  // `?since=<ms>` → the rows from that moment on, oldest first, AUDIT_PAGE at a time
  // (`more` says there are further ones: ask again from the last row's `at` + 1).
  async _lemoAuditRead(request, url) {
    if (!auditAllowed(request, this.env)) return new Response('Mdwnh presence relay is running.', { status: 200 });
    const since = Number(url.searchParams.get('since')) || 0;
    const got = await this.state.storage.list({ prefix: AUDIT_PREFIX, start: auditKeyOf(since), limit: AUDIT_PAGE });
    const rows = [...got.values()];
    return new Response(JSON.stringify({ rows, more: rows.length >= AUDIT_PAGE }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
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
    // LEMO_CAPS_OFF_UNTIL ('YYYY-MM-DD', Riyadh): both caps are lifted up to and
    // including that day and return by themselves the day after. The spend is still
    // counted and logged. (Dates in this form compare as text.)
    const capsOff = String(env.LEMO_CAPS_OFF_UNTIL || '') >= day;
    if (!capsOff && b.usd >= capUsd) return fail('tired');
    if (!capsOff && (b.users[uid] || 0) >= capUser) return fail('you');
    const log = await this._lemoLogGet();
    this._lemoLogTrim(log);
    if (!this.lemoTalk) this.lemoTalk = (await this.state.storage.get(TALK_KEY)) || {};
    const talk = this.lemoTalk;
    for (const id of Object.keys(talk)) if (now - talk[id].s > LEMO_TALK_MS) delete talk[id];
    q.count = ((talk[uid] && talk[uid].n) || 0) + 1;

    this.lemoBusyAt = now;
    this._sendAll({ t: 'lemot', to: uid, k });
    try {
      // A copy: the room may go on talking while he thinks.
      const res = await askLemo(env, q, log.slice());
      const pin = Number(env.LEMO_PRICE_IN) || 0.10, pout = Number(env.LEMO_PRICE_OUT) || 0.50;
      b.usd += (res.tokensIn * pin + res.tokensOut * pout) / 1e6;
      b.calls += 1;
      b.users[uid] = (b.users[uid] || 0) + 1;
      const said = res.parts.map(p => (p.m ? p.m : `[ملصق: ${p.s}]`)).join(' / ') + (res.throw ? ' / [رمية]' : '');
      const at = Date.now();
      log.push({ k: 'q', u: uid, n: q.name, m: q.text, at }, { k: 'a', p: res.parts, at });
      this._lemoLogTrim(log);
      talk[uid] = { s: (talk[uid] && talk[uid].s) || now, n: q.count };
      await this.state.storage.put({ [BUDGET_KEY]: b, [LOG_KEY]: log, [TALK_KEY]: talk });
      this.lemoLast.set(uid, Date.now());
      // `th` = رمية ليمو: this answer ends with him throwing the asker into a session.
      this._sendAll(res.throw ? { t: 'lemoa', to: uid, k, p: res.parts, th: 1 } : { t: 'lemoa', to: uid, k, p: res.parts });
      console.log(`[lemo] ${uid} in=${res.tokensIn} out=${res.tokensOut} day=$${b.usd.toFixed(4)} :: ${said}`);
      await this._lemoAudit({ at, ...this._lemoAuditOf(uid, q), ...res.seen, a: res.parts, ...(res.throw ? { th: 1 } : {}), tin: res.tokensIn, tout: res.tokensOut });
    } catch (err) {
      const code = (err instanceof LemoError) ? err.code : 'err';
      console.log(`[lemo] error ${code}: ${err && err.message}`);
      fail(code);
      await this._lemoAudit({ at: Date.now(), ...this._lemoAuditOf(uid, q), e: code, em: String((err && err.message) || '').slice(0, 200) });
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
