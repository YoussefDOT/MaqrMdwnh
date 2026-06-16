// Mdwnh presence relay — Cloudflare Worker + Durable Object
// -----------------------------------------------------------------------------
// This is a DUMB, STATELESS relay for live player positions ONLY.
// It stores nothing. A player sends "I'm at x,y", we forward it to everyone
// else in the same lobby, then it's gone. Everything that must PERSIST
// (pomodoro, azkar, accounts, prayer, shared-pomo) still lives in Firebase.
//
// One Durable Object instance = one lobby room. We pick the room by name,
// so "male" and "female" (and any future separate lobbies) never mix.
// -----------------------------------------------------------------------------

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
