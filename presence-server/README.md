# Mdwnh Presence Relay (Cloudflare Worker)

A tiny, **stateless** WebSocket relay for live player positions only.
It stores nothing. Everything that must persist stays in Firebase.

- One Durable Object = one lobby room (`male` / `female` / future lobbies).
- Players connect to: `wss://mdwnh-presence.<your-subdomain>.workers.dev/lobby/<lobbyId>?uid=<uid>`
- A client sends `{uid, x, y, dir, moving}`; the server forwards it to everyone
  else in that lobby. On disconnect the server sends `{t:"bye", uid}`.

## Deploy (one time)

```bash
cd presence-server
npm install
npx wrangler login        # opens browser, log into your Cloudflare account
npx wrangler deploy       # prints your live https://...workers.dev URL
```

## Free & always-on

- Free tier: 100,000 requests/day. Incoming WebSocket messages bill at **20:1**
  (20 messages = 1 request), so the free budget is ~2,000,000 position
  messages/day — plenty for the current user base.
- WebSocket **Hibernation** keeps connections alive with zero duration billing
  while a room is idle, and wakes instantly. No sleep, no cold-start lag.

## Watch it live

```bash
npm run tail   # streams logs from the deployed Worker
```
