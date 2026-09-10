# Mdwnh Digital Workspace — AI Dev Guide

> **This project is entirely vibe-coded.** Every line of JS/HTML/CSS was written by an AI model. Only the art assets and audio files are human-made. When Claude is working on this, it IS the developer — read this file carefully before touching anything. **Start with "How to Work in This Repo — Operating Procedure" and follow it on every task; it is not optional background.**

> **Always use the `caveman` skill in this project.** Every reply in this repo runs in
> caveman mode (`Skill: anthropic-skills:caveman`) — terse, no filler — while keeping
> full technical accuracy. Code, commits, and PRs are still written normally.

> **Spell-check all UI text.** Any Arabic or English text that will appear in the UI must be spell-checked before being written into the codebase. Never add user-visible text without verifying spelling and grammar first.

> **The owner is a beginner developer.** Explain things in plain language — what broke, why, and what the fix does — as if to someone who doesn't know much about code. Skip jargon, and when you must use a technical term, define it briefly. Don't over-explain either: keep it short and clear, not a tutorial. Claude is the one writing the code; the owner is steering, so help them understand decisions without drowning them in detail.

> **The owner is on macOS and now tests in a Chromium-based browser (no longer Safari).**
> That changes what the owner will *catch*, not what the code must *support* — the members
> use Safari, Firefox and Chrome, so **every feature must still be browser-inclusive** and
> the Safari/iOS constraints below all still apply. Don't drop a `-webkit-` prefix or a
> Safari fallback just because the owner won't see it break.
>
> **Safari / iOS gotchas (still enforced):** aggressive favicon caching + rejection of
> oversized favicons (use a small ~128px PNG, not a 1MB+ one — see
> `favicon-128.png`/`apple-touch-icon.png`); no `documentPictureInPicture` and no
> `canvas.captureStream()` (PiP falls back to a popup window — see Picture-in-Picture
> tiers); `button[disabled]` leaks touch events on iOS (use a CSS `.unlocked` class, never
> the `disabled` attribute, for visual-only locks); always pair `backdrop-filter` with
> `-webkit-backdrop-filter`; stricter autoplay / AudioContext-resume rules.
>
> **Firefox gotcha:** a CSS entrance animation may **never run at all**. Never put
> `opacity: 0` in an element's **base style** and rely on a keyframe to reveal it — a
> skipped animation then renders the whole panel permanently **empty** (hit twice: the
> pomodoro settings rows and the settings panel rows).
>
> **The fix is `animation-fill-mode: backwards`, not dropping the fade.** Put
> `opacity: 0 → 1` inside the keyframes, leave the base style opaque, and let
> `backwards` supply the hidden state during the `animation-delay`. A stalled animation
> then falls back to the visible base style — it costs the flourish, never the content.
> (Killing the fade outright was the first attempt; it worked but made every sequenced
> panel slide in at full opacity, which looks wrong.) Use `backwards`, **never `both`** —
> `both` pins the 100% keyframe forever and an animated property beats a transitioned
> one, which kills hover/close effects.

---

## Quick Start

```bash
# Serve locally (required — ES modules + Firebase won't work from file://)
python3 -m http.server 8080
# then open http://localhost:8080
```

**Mobile testing:** `ipconfig getifaddr en0` → open `http://[IP]:8080` on phone (same WiFi).

**Never push to git unless the user explicitly asks.** Always test on localhost first. **Always push directly to `main`** — never push to a separate branch (`git push origin HEAD:main`).

**Pre-commit hook**: besides the build number below, it regenerates `Hats/hats.json` from the PNGs in `Hats/` (see Character Customization).

**Build number**: A `#build-number` div sits below the `#siraj-test-link` button on the login screen showing **`Build N · Updated M/D H:MM AM/PM`** (e.g. `Build 244 · Updated 7/28 1:47 PM`) — the **date is part of the stamp**, so "when did this last ship" is answerable at a glance. The `.git/hooks/pre-commit` hook auto-increments the number and rewrites the date+time on every commit — **never hand-edit it**. Its `sed` pattern treats the `M/D ` part as optional so an older date-less stamp is upgraded in place rather than skipped. If the hook can't find the pattern at all, it logs a warning and exits cleanly. **If the stamp format ever changes, update the hook's `sed` pattern and this line together.**

---

## How to Work in This Repo — Operating Procedure (READ THIS BEFORE ANY EDIT)

This section is the process; the rest of the file is the knowledge. Follow the process
literally — every rule here exists because skipping it produced a real bug.

### 1. Navigate by search, never by memory or line number

`game.js` is ~24k lines in ONE file. Line numbers and even function names in this doc
drift as the code evolves. **Always locate code by grepping an identifier from this doc.
If the identifier has zero hits, the code was renamed/inlined — search nearby concept
keywords, trust the CODE over this doc, and fix the doc reference in the same commit.**
Never write an edit against a remembered or doc-quoted line number.

Grep anchors for the major systems (all verified to exist):

| System | Grep for |
|---|---|
| World load / collision / cache | `loadWorldArt`, `worldCollision`, `worldCache`, `checkCollision` |
| Movement + live sync | `handleMovement`, `ensurePresenceSocket`, `updatePlayerPosition`, `listenToPlayers` |
| Pomodoro (solo) | `startPomodoroPhase`, `updatePomodoro` |
| Shared pomo | `sendSpInvite`, `setupSpLiveListener` |
| Azkar | `openAzkarOverlay`, `closeAzkarOverlay` |
| Prayer | `initPrayerSystem`, `triggerPrayerOverlay` |
| Reading | `startReadingSession`, `bookCoverSVG` |
| Fireplace | `openFireplaceOverlay` |
| Lemo | `updateLemo` |
| Minigames | `joinOrCreateMinigameLobby`, `listenToRace` |
| PiP | `openPiPMode`, `renderPiPInto` |
| Dashboard | `setupDashboardUI`, `openDashboard`, `dashSaveSession` |
| Character custom / hats | `openCharCustom`, `loadHatManifest` |
| Library tasks panel | `setupLibraryPanel`, `_libTaskPill`, `_libEnsureTasks` |
| Daily duty (حضور المقر — was تحدي المثابرة) | `DUTY`, `updateWorkChallenge`, `_dutyTick`, `_dutySetVacation`, `_chalPayDue`, `_chalClaim` |
| Trophy shelf | `TROPHIES`, `updateTrophies`, `_troBank`, `_troClaim`, `_troCeremony` |
| جوائز العام sheet | `AWD`, `_awdOpen`, `_awdPose`, `_awdRun`, `_awdClose` |
| Leader's panel | `ADMIN_UIDS`, `adminAllowed`, `_admFetchMember`, `_admRenderDetail`, `_admRenderDutyBar`, `_admDutySection` |
| Proximity chat | `CHAT_`, `updateChatSystem`, `drawChatBubbles`, `receiveChatMessage`, `sendChatWS` |
| Audio | `FocusAudioEngine`, `warmGameSounds` |
| Settings | `setupSettingsUI` |
| Success card | `setupSuccessCardUI` |
| UI cascade blips | `setupJuiceUi` |

### 2. Before touching a feature

1. **Read that feature's section in this file, fully.** Not a skim — the constraints are
   in the details ("don't re-split it", "never `set(null)`", z-index numbers).
2. **Grep the Common Bugs table for any identifier you're about to change.** If it
   appears there, the "weird" code you're looking at is a FIX. Understand the bug it
   fixed before altering it; never "clean up" something documented as intentional.
3. **Read the actual code region ±50 lines** around your edit point before writing.

### 3. Edit discipline

- **Smallest possible diff.** No drive-by refactors, no renames, no reformatting
  untouched lines. This codebase keeps intentional legacy names (the fig game's
  internals are still `coffee`) because renames break live Firebase session docs.
- **Never rename a Firebase path or key** without an explicit migration plan — old
  clients and existing data still use it.
- **Never hand-edit generated files**: `Hats/hats.json`, `Art/Workspace/manifest.json`,
  the `#build-number` div. The pre-commit hook owns all three.
- **Match surrounding style** — comment density, naming, Arabic labels. All UI text is
  Arabic and spell-checked (see top of file).
- **When a product decision is needed** (behaviour, wording, visuals not derivable from
  existing patterns), ask the owner — don't invent. When a technical fact is checkable
  by grep/read, check it — don't ask.

### 4. Verify every change — WITHOUT a browser (see Testing Policy)

Run all of these after editing, before telling the owner it's done:

1. `node --check game.js` — must pass. (For inline `<script>` edits, re-read the diff.)
2. **Re-read your own diff** (`git diff`) line by line, asking of each hunk: which
   documented rule/bug could this violate? Scan it against **§6 Hard Invariants** below.
3. **Bump `?v=N` on `game.js` in `index.html`** in every commit that touches `game.js`.
   Forgetting this ships stale code to returning visitors — it's the #1 silent failure.
4. Touched UI? Check BOTH desktop and `body.is-mobile` CSS paths, and RTL layout.
5. Touched anything on the login/spawn path? Re-read the **Loading Strategy** section
   and confirm you added no serial `await`, no eager media fetch, no work before spawn.
6. New feature? Run the **Edge case scan** in "Adding a New Feature — Checklist".

Do NOT launch a browser preview to click through features — the owner tests himself.
`node --check`, one-off Node snippets, and reading the diff are the allowed checks.

### 5. Where does new state live? (decision tree)

Walk this top-down for ANY new piece of state; when in doubt read **Firebase Cost Rules**.

1. Changes many times per second, nobody needs it after the fact (positions, cursor,
   transient anim) → **WebSocket relay** (`sendPositionWS` pattern). Never Firebase.
2. Client can derive it from one written value (countdown from `endTime`, progress from
   `spawnTime`) → **write once, compute locally per frame**. Never stream ticks.
3. Purely local, per-device preference → **localStorage** (`SETTINGS_*` pattern; cache
   the getter per-frame in `gameState._*`, never read localStorage in draw code).
4. Private per-user, persistent, written more than ~once/day → **`dashboards/{uid}/…`**
   (one-shot `get()`s, zero fan-out). NOT under `users/{uid}`.
5. Must be seen live by everyone to render another player (avatar ring, hat, floor,
   task) → **`users/{uid}/…`** — the documented exception; keep writes rare and small.
6. Lobby-shared feature state → **`lobbyPath('…')`** so male/female never mix.
7. Client-only ambience nobody needs synced (Lemo) → **plain `gameState`, no network.**

### 6. Hard Invariants — scan every diff against ALL of these

Each one is a shipped bug (details in Common Bugs & the feature sections):

1. **Never `disabled` attribute** for visual-only button locks — iOS leaks touches.
   Use a CSS class (`.unlocked` / `.is-disabled` / `.cc-unlocked`).
2. **Never `!important` on `transform`** — silently beats JS inline drag/animation styles.
3. **Never `new Audio(src)` at module scope, never `preload='auto'` at parse.** New SFX
   go through `_lazyAudio` + the 4-step pattern in Focus Audio Engine.
4. **Never per-frame / per-second Firebase writes.** High-frequency = WebSocket relay.
5. **`serverNow()` for any multiplayer timing**, never `Date.now()` across clients.
6. **All lobby-scoped paths through `lobbyPath()`** — gender lobbies never share data.
7. **Never `!userData.x` to test "no position"** — world x≈0 is legit. Use
   `x !== undefined && x !== null`.
8. **Never `onDisconnect(parent).cancel()`** on a node with child ops armed under it
   (it cancels ALL descendants' handlers — the forever-ghost bug). Arm/cancel per-field.
9. **Never `set(null)` on `lastPomoSession` while in-session** — re-persist a full
   snapshot via `trackSessionForReclaim`.
10. **Always pair `backdrop-filter` with `-webkit-backdrop-filter`**; no `backdrop-filter`
    at all on `body.is-mobile` surfaces over the live canvas.
11. **Never `scrollIntoView` inside overlays** — scroll the list element manually.
12. **Never an infinite animation of `filter: blur()` / `transform: scale()` /
    `background-position` on full-screen or always-visible elements** — per-frame repaint.
13. **Hot draw code reads cached `gameState._*` flags**, never the localStorage getters.
14. **Store every `onValue` unsubscribe and call it on cleanup** — leaked listeners
    stream downloads forever.
15. **Minigame session docs must be nulled on return** (`returnFromRace`/`returnFromCoffee`
    pattern) or the game can't be replayed.
16. **Never `imageSmoothingEnabled = false`** for world art — the pixel-art era is over.
17. **`display` can't transition** — animate overlays with `opacity` + `visibility` +
    double-rAF `.active` (azkar/prayer/fireplace pattern).
18. **`ctx.resume()` is async** — `.then(play)`, never fire-and-forget.
19. **Sounds that must fire in background tabs** use `focusAudioEngine.playEffect`
    (Web Audio), never `HTMLAudioElement`.
20. **A sequenced entrance never puts `opacity: 0` in the BASE style** — fade inside
    the keyframes + `animation-fill-mode: backwards` (never `both`). A skipped
    animation must leave the content visible, not blank the panel.
21. **`checkCollision()` lies until the masks decode** (`worldCollision.built`) — it
    reports everything walkable. Never treat it as authoritative on the login/restore
    path without a re-check once the masks land (`_unstickLocalPlayer`).
22. **Git**: never push unless the owner asks; when pushing, straight to `main`
    (`git push origin HEAD:main`); bump `?v=` with every `game.js` change.
23. **Budget images by PIXELS, never by file size** — a 17 KB PNG and a 3.6 MB PNG at
    2210×3160 both decode to **27.9 MB**. Anything held for the whole session
    (`keep: true`, a sprite sheet, a cached canvas) must be cropped or downscaled to
    what is actually drawn. Free it with `.close()` / `src=''` the moment it isn't.
    A phone near its canvas ceiling GC-thrashes *and* starts silently refusing
    decodes — lag no graphics tier can fix, plus a black world.

---

## What This App Is

A multiplayer collaborative Pomodoro workspace — players appear as avatars in a 2D pixel-art office. Arabic UI (RTL). Main features:

| Feature | Description |
|---|---|
| **Pomodoro timer** | Per-laptop work/break cycles, persisted in Firebase |
| **Shared Pomo (coop)** | Multiple players work a synchronized session together |
| **Focus sounds panel** | Ambient audio mixer — 8 sounds, each with an on/off toggle and volume slider (desktop only) |
| **YouTube focus player** | Paste a YouTube link, it plays embedded with loop support |
| **Prayer times** | Live Adhan scheduling with overlay + rain effect |
| **Azkar (أذكار)** | Morning/evening dhikr overlay with per-item count buttons, Firebase completion tracking, timer lock; optional shuffled order; **after-prayer azkar** reachable from the prayer overlay |
| **المدفئة / أعضاء الشهر** | Walk to the fireplace → a full-screen look at it with the month's top-3 point scorers framed on the mantel. Points come from a **separate Firebase project**. See **Fireplace / Members of the Month**. |
| **Reading (القراءة)** | Timed reading sessions from the books library. A shelf of the user's own books (each a procedurally-drawn 3D cover), a random sofa seat, a cinematic camera, the `Art/Book.png` prop sliding out from under the reader, and a lobby leaderboard. See **Reading Session**. |
| **حضور المقر** (was تحدي المثابرة) | The leader's daily duty: the site **open three hours a day**, mandatory from الأحد ١٣ سبتمبر ٢٠٢٦, with **two vacation days a week** (taking one wipes today's progress; cancellable the same day). A foldable card under the azkar dock and a week ladder your avatar walks. Round one (the seven-day work streak) is over — members who earned points get an undismissable «استلام» popup on login. Styled in the مدونة brand; pressing anywhere on the card opens the week panel. See **حضور المقر**. |
| **رف الجوائز** | Three trophies (and four hidden, blacked-out ones) on two planks in the break room. Walk up → a lit display case; each trophy fills with gold as you approach its condition. Claiming runs a spotlight-and-collision ceremony and pays out through the library's claim handshake. See **رف الجوائز**. |
| **لوحة القائد** | نواف and a سراج ghost only. A crown in the HUD tools opens a panel of every member — roster faces, a name search — a **حضور اليوم** bar that counts and filters who met today's three hours / is on vacation / hasn't, seven duty dots per row, and one press shows **exactly how long they worked**: this week, last week, twelve weeks back, lifetime — plus a six-week duty calendar. The list fills itself on open; all of it is derived from the session log the dashboard has been writing all along. It is read-only. See **لوحة القائد**. |
| **الدردشة القريبة** | Press your character (or Enter on a PC) → a type box floats over your head. ٥٠ حرفًا, wrapping onto two lines. The message becomes a bubble; a second one pushes the first up on a spring. Someone standing near gets a soft cue with it; someone across the building, or in a work session, gets nothing. **@ mentions** an online member (picker, closest first, searched against the roster): they hear a ping wherever they are, deeper on each repeat, an alarm on the fourth, plus a system notification. **Zero Firebase** — it rides the WebSocket relay. See **الدردشة القريبة**. |
| **Lemo (the robot)** | An ambient robot who sleeps in the break room until you walk up, then wanders between hand-picked spots forever. **Client-only — never touches Firebase**, so every player sees him somewhere different. See **Lemo**. |
| **Minigames** | Racing / **التين** (fig-catching, was the coffee game) / laptop-boss. Entry is the **games table** in the break room — walk up during a break, press to join. See **Minigame Architecture**. |
| **Two floors** | Ground rooms + a raised **second floor** (mezzanine) reached by stairs; players grow to 1.25× up there and the floor fades out when someone walks under it |
| **Mobile mode** | Full touch support — virtual joystick, pull-up sounds drawer, focus-mode UI |
| **Character customization** | Ring colour (full in-page colour wheel) + hats, placed/scaled/rotated by the user and seen by everyone. See **Character Customization**. |
| **Menu** | Discord-OAuth-only entry + boot/loading screen. See "The Menu" below. |

**Language**: All UI text is Arabic. Keep it that way.

---

## File Map

```
Art/Lemo/                    — Lemo. `Sheets/*.webp` ship (~2.4 MB); the 197 MB master
                               PNGs and `slice.py` that bakes them down live here too,
                               masters gitignored. `reff.png` = where his spots were
                               measured. See Lemo.
Hats/                        — hat PNGs + hats.json (the production manifest; the
                               pre-commit hook regenerates it). See Character Customization.
Art/trophies/                — the seven trophies + the display shelf plank, as
                               `*.webp` cropped to their painted art (~190 KB all in).
                               The 2000² PNG masters are gitignored, like Lemo's.
                               See رف الجوائز.
Icon Elements/               — 7 decorative brush icons (masked + brand-tinted in the menu)
Maqr logo.png                — the brand logo: menu + boot screen
game.js        ~24000 lines — all game logic, classes, Firebase, rendering
index.html      ~1600 lines — single page; all panels/overlays live here
style.css       ~7700 lines — all styling; mobile rules under body.is-mobile
firebase-config.js           — exports { database, ref, onValue, update, get, onDisconnect, set }
sw.js                        — service worker: cache-first for Sound/Art/Fonts (see Loading strategy)
Sound/                       — UI/minigame sound effects (.mp3)
Sound/Focus Sounds/          — ambient focus audio files (.mp3)
Art/                         — minigame art (race track, coffee, boss fight, siraj)
Art/Workspace/               — THE WORLD: one combined scene split into stacked layers
                               (Workspace_00NN_*.png, all 2210×3160). See "The World".
Art/Old/                     — the retired pixel-art world (no longer used)
pomo9.json                   — legacy tilemap (no longer used by the new world; don't edit)
```

> **The art is no longer pixel art.** The whole world was redrawn as smooth,
> hand-painted art in `Art/Workspace/`. The old pixel sprites (`Bg.png`, `Tables.png`,
> `Shadow.png`, the fake break-room door, the dashboard placeholder circle) are GONE.
> Do not reintroduce `imageSmoothingEnabled = false` for the world or pixel-styled
> particles — everything is meant to look smooth now.

---

## Loading Strategy (keep the first load FAST)

The repo carries ~60 MB of media (Sound/ 43 MB, Art/ 18 MB). **Nothing heavy may load
before the game is playable.** The current model:

- **At page parse**: nothing downloads except CSS, logo, and game.js. All
  `gameState.sounds` audio elements are created via `_lazyAudio()` with
  `preload='none'` — they must NOT fetch at parse (45 parallel MP3 fetches used to
  crush the login screen). **Never add a `new Audio(src)` at module scope or set
  `preload='auto'` outside `warmGameSounds()`.**
- **After spawn** (`startGame` restore): `warmGameSounds()` preloads the core in-game
  SFX immediately (kidnap/timers/prayer/invites) and everything else on
  `requestIdleCallback`. New SFX just need the standard 4-step pattern — the warm-up
  loops over all of `gameState.sounds` automatically.
- **Ambient focus sounds are lazy** (`ensureFocusBuffer(key)`): a buffer downloads +
  decodes only when that sound is active (restored mix) or first toggled. Toggling is
  still instant — `startSound` streams via a media element and hands off to the
  seamless buffer loop when it arrives. Never restore the old "download all 7 on init"
  behaviour (~21 MB + a huge decode on weak phones).
- **World art layers** (`Art/Workspace/`, ~15 MB total — the 5 MB background + two
  ~2 MB day overlays are the big ones): loaded in `loadAssets()`. `render()` guards
  every layer on decode (`_drawWorldLayer` skips a not-yet-loaded `<img>`), so the
  login screen never waits on them. As each layer decodes, `loadWorldArt()`'s pipeline
  builds the alpha collision masks (into `worldCollision`) AND pre-composites the ~9
  ground layers + 3 second-floor layers into **two cached canvases** (`worldCache`) —
  so the per-frame cost is ~2 `drawImage`s, not ~14 (matters on the owner's phone).
  Layers are then **closed** (`ImageBitmap.close()`), and the four that must stay
  resident are **shrunk first** — see **The World → Perf notes**, which is the memory
  budget every new layer has to answer to.
  (The old standalone `buildWorldCollision()`/`buildWorldCache()` functions were
  inlined into this pipeline — grep `worldCollision` / `worldCache`, not those names.)
- **Race track** (`Art/RaceTrack Var1.png`, 6 MB + CPU-heavy pixel classification):
  `loadRaceTrackAsset()` is idempotent and lazy — kicked on idle after spawn and
  ensured by every race entry path. Never call it in `init()`.
- **World art is content-hashed + cached forever.** `Art/Workspace/manifest.json`
  (filename → short sha1, regenerated by the **pre-commit hook**) is fetched
  `no-store` at the top of `loadWorldArt()`; every layer then loads as
  `<file>?h=<hash>` (`_worldSrc`). The service worker treats a `?h=` URL as
  **immutable — pure cache-first, no revalidation** — so a returning visitor
  downloads **zero** bytes of art and the world is up as soon as the page parses.
  Editing a layer changes its hash → new URL → only that file re-downloads (the SW
  then drops the other hashes of that path via `dropOtherVersions`). **`.json` is
  never cached by the SW** — a stale manifest would pin the old art forever. If the
  manifest fails, layers fall back to plain un-hashed URLs (correct, just uncached).
- **The boot failsafe watches PROGRESS, not the clock** (`startGame`). The old flat
  15s timer fired mid-load on slow links and slid the loader away over a world that
  hadn't composited → the black/half-empty room (only a fresh tab escaped it). Now a
  2s watchdog releases only after `BOOT_STALL_MS` (25s) with **no layer finishing**,
  or a `BOOT_MAX_MS` (120s) hard ceiling. Don't turn it back into a fixed timeout.
- **Service worker (`sw.js`)**: covers `Sound/ Art/ Fonts/` + image/audio/font
  extensions; skips `.json`, Range requests (Safari audio streaming) and `_retry=`
  URLs; everything else passes through (code is never served stale). Modes:
  - **Content-hashed (`?h=`) media: cache-first, never revalidated** (see above).
  - **Production, un-hashed media (Sound/, Fonts/, other Art/): stale-while-revalidate.**
    The cached copy is served instantly AND re-fetched in the background, so a
    replaced media file appears on the *next* reload by itself. `?v=` bumps /
    `CACHE_VERSION` are now only for forcing it to land on the *same* load.
  - **localhost / LAN IP: network-first**, cache untouched (`IS_LOCAL`). The dev loop
    must always show the file on disk — the cache is a production load-time
    optimisation, not a dev one. This is what fixed "new art needs a hard refresh
    every time": pure cache-first pinned every art file until its URL changed.
- **Login/spawn network path is parallel**: `initDiscordOAuth` resolves the lobby
  concurrently with the Discord token check (cached user id); `startGame` fetches
  `pomodoro` + `users/{uid}` + `dashboards/{uid}/profile` in one `Promise.all`;
  `enterGameAsDiscordUser` reuses the `resolveUserLobby` snapshot and doesn't await its
  profile write. Don't add serial `await get(...)` chains to this path.
- **Exit**: `doLogout` reloads after max 2s even if writes haven't acked (armed
  `onDisconnect` ops cover the cleanup server-side).

---

## The World (new smooth-art scene, two floors)

The world is **one combined painting** (`Art/Workspace/`, `IMG_W×IMG_H = 2210×3160`)
split into stacked layers that are all drawn on top of each other, aligned. Both
"rooms" (work room on top, break room on bottom) live in that single image — there is
**no room tiling, no seam, no break-room door** any more. The break room is always
open; players cross through the wall opening baked into the art.

### Coordinate system
World units = source px × `WORLD_SCALE` (0.54, chosen so the world is ~1193 px wide —
same as the old world, so the 70 px player still feels right). World origin (0,0) =
the **centre of the image**. Helpers: `sx2w(px)` / `sy2w(py)` map a source pixel to a
world coordinate. The whole scene is drawn centred on the origin at
`(-WORLD_W/2, -WORLD_H/2, WORLD_W, WORLD_H)`.

### Layer stack & draw order (`render()`)
Painted bottom → top:
1. **`drawWorldGround()`** — background, walls, fireplace, sofas, library, sofa, ground
   laptop desk, stairs, games table. (Served from the cached `worldCache.ground`
   canvas; per-layer fallback until it builds.)
2. ground-floor players + their timers (`drawPlayers(false, 1)` / `drawTimers(1)`)
3. **`drawSecondFloor()`** — the mezzanine platform + its laptop desk + papers desk,
   drawn at `gameState.secondFloorVis` (the proximity-fade alpha). Served from
   `worldCache.second`.
4. second-floor players + timers (`drawPlayers(false, 2)` / `drawTimers(2)`)
5. **`drawDayOverlays()`** — `Day-Overlay-2` (normal blend) then `Day-Overlay`
   (**`globalCompositeOperation = 'overlay'`**, dropped on بطاطس). The multiply Night
   overlay is intentionally NOT drawn yet.
6. screen-space FX: focus mask, smooth wind, fog, sun rays, **cloud shadows**, vignette.

### Collision — alpha masks from the actual filled pixels
The mask build (inside `loadWorldArt()`, results in `worldCollision`) rasterises the collidable layers into half-res `Uint8` bitmaps
(`MASK_W×MASK_H`) — collision follows the **real painted shape**, not a box, and empty
pixels never collide. Two morphology passes tune it:
- **Walls are DILATED** ~3 px (`_dilate`) so the thin room-divider can't be tunneled
  through at sprint speed.
- **Furniture is ERODED** ~3 px (`_erode`) so the thin legs/feet the tables draw don't
  collide — only the real body does. (The library was already clean.)
- **Floor 1** (`worldCollision.floor1`): dilated walls + eroded ground furniture (alpha ≥ 130,
  which drops the soft drop-shadows) + the fireplace at alpha ≥ 205 (**solid body only —
  its soft light must not collide**).
- **Floor 2**: geometric platform bounds (railing) inset from the footprint, **plus** the
  eroded second-floor desks (`worldCollision.floor2desks`). The wood floor is walkable;
  you leave only through the stair opening.
- `checkCollision(x,y)` clamps to `WORLD_BOUNDS`, treats the **stairs as walkable** (via
  the tight stair mask), then samples the floor mask with `_maskSolid` — a **ring of
  points around the avatar's feet** (`_BODY_R`), so the sprite stops when its EDGE meets
  furniture instead of burying its centre, and thin walls can't slip between samples.

### Floors & the dynamic stair scale
Each player has a `floor` (1 or 2) and a `renderScale`.
- **Stairs** (`isOnStairs`): no collision. `isOnStairs` samples the **real painted stair
  alpha** (`worldCollision.stairs`) — a tight diagonal band, NOT a bbox — so you can't
  phase onto the mezzanine from beside/above the steps. Right end = ground (1.0), left end
  = second floor (`FLOOR2_SCALE`); `stairScaleAt(x)` interpolates by x. Walking the stairs
  also gives a **bigger up/down bob** (see `updatePlayerBobbing`).
- `updateFloorsAndScales()` (per frame): the LOCAL player's `floor` is **pinned to the
  seated laptop's floor while locked-in / being kidnapped** (this stops a second-floor
  work session from wrongly reading floor 1 and hiding the whole mezzanine); otherwise it
  flips as they cross the stair midpoint (hysteresis 0.45/0.55). Then it lerps **every**
  player's `renderScale` toward `desiredPlayerScale()`. `forcePlayerFloor()` sets the floor
  on kidnap / reclaim.
- **Floor is synced** so others scale you correctly: `fl` in the WebSocket position
  payload and `users/{uid}/floor` in Firebase; read back in `onPresenceMessage` / the
  users listener / the login restore.
- `renderScale` is applied in `drawPlayers` (avatar + contact shadow + name offset) and
  is purely visual — collision/positions use the unscaled world coords.

### Second-floor proximity fade (client-side only)
`updateSecondFloorFade()` → `gameState.secondFloorVis` (1 = visible). When the LOCAL
player is **on floor 1** and **approaches** the mezzanine footprint (`PLAT_X0..PLAT_X1`,
`PLAT_Y0..PLAT_Y1`) from the exposed **east / south** edges, the whole second floor (its
3 layers **and** any players on it) fades toward 0. The fade **starts early** — an `AP`
(~150 px) approach margin outside the footprint — so it's gone by the time you're fully
under. The **stair-entry side barely fades** (min of the east/south penetration), and
being on floor 2 keeps it fully visible. Reverts on exit. Also floor-gates shared-pomo:
you can't invite/join someone on a different floor.

### Laptops (7 total) — `LAPTOP_DEFS` / `initLaptops()`
- **Ground desk** (`Workspace_0008`): 3 laptops that **drag the player LEFT** into the
  seat + 1 at the bottom that **drags DOWN**.
- **Second-floor desk** (`Workspace_0004`): 3 laptops, same orientation → also **drag
  LEFT** (seat on the open platform floor to their left). "3 to the right" in the brief
  meant their position, not the drag direction.
- Each laptop carries a `dir` (`left`/`right`/`down`/`up`) and a `floor`. The kidnap
  (`updateAnimation` align→pull) moves **both axes**: it yanks you OUT past the seat
  (`intermediate = seat + dir·EXTRA`) then drags you back IN to the seat — like the old
  "grab far, snap to rest" feel. Laptop interaction is **floor-gated** (a ground player
  can't sit a second-floor laptop that visually overlaps them).

### Dashboard entry = the second-floor papers desk
The dev-art placeholder circle is gone. The dashboard opens from the **papers desk**
(`Workspace_0003`, world `PAPERS_X/PAPERS_Y`), reachable only on **floor 2**; the prompt
reads **"انقر لفتح الأوراق"** (`drawDashboardPrompt`).

### Clouds, second-floor fog, fireplace sound & smooth wind
- `drawCloudShadows` drifts soft **black, blurred, low-opacity cloud silhouettes** slowly
  LEFT on a loop. They are **WORLD-space** (drawn inside the camera transform, on top of
  everything incl. players) so they sit over the scene like an overlay rather than
  floating across the screen. Sizes/positions/speeds are in world px. Off on بطاطس.
- **Second-floor fog** (`updateSecondFloorFog` / `drawSecondFloorFog`, `secondFloorFogA`):
  a soft low-opacity haze, **WORLD-space, drawn BETWEEN the floors** (over the ground,
  UNDER `drawSecondFloor`) so the mezzanine stays above it. Shows **only when the LOCAL
  player is on floor 2** (fades in/out, no snap; loops).
- **Fireplace ambience** (`updateFireplaceAmbient` → `FocusAudioEngine.setFireplaceVolume`):
  `Sound/Fireplace sound.mp3` fades in as the local player nears the fireplace (`FIRE_X/Y`,
  floor 1 only). The buffer is made **seamless once** (`_makeSeamless` crossfades its tail
  into its head) so `loop = true` gives a perfect click-free loop. Web-Audio, so it keeps
  playing in a background tab.
- Wind particles are **soft round dots with a fading trail** (`drawWindParticles`). Off on بطاطس.

### Perf notes (owner is on a phone — keep it cheap; Safari was OOM-crashing)
`worldCache` collapses ~14 per-frame `drawImage`s into ~2, and **every source layer is
closed the moment it's composited + masked** (`ImageBitmap.close()`) — keeping ~12 decoded
2210×3160 images alive (~340 MB) is what crashed Safari. The overlay-blend layer and
clouds are gated off on بطاطس; the world cache is rendered at a smaller resolution on
reduced tiers.

**Decoded size has nothing to do with file size — budget by pixels, always.** Every layer
is 2210×3160, so *any* of them decodes to **27.9 MB of RGBA** whether its PNG is 3.6 MB or
17 KB. This is the trap the whole section exists to avoid, and it bit again through the
four `keep: true` layers, which were held at full size for the entire session:

| Layer | was | now | how |
|---|---|---|---|
| `wLaptopLights` | 27.9 MB | **0.44 MB** | cropped to the union of floor 1's `lightBox`es (204×535) |
| `wSecondLaptopLights` | 27.9 MB | **0.11 MB** | same, floor 2 (46×602) |
| `wOverlayDay2` | 27.9 MB | **1.8 MB** | downscaled ÷4 (÷3 on عالية) |
| `wOverlayDay` | 27.9 MB | **1.8 MB** | same |

The two lights sheets are **99.85% transparent** (~10k painted px each) and only their
`lightBox` rects are ever sampled; the two overlays are soft lighting gradients whose
premultiplied error at ÷3 measures **under 1/255** — invisible. Together with a tighter
`worldCache` (متوسط 0.62, بطاطس 0.50) and Lemo's 24 MB Play sheet no longer pre-warming on
mobile, a phone went from **~200 MB to ~50 MB** of resident canvas/bitmap memory.

**Rules that follow from this, for any layer added later:**
- **`keep: true` is expensive — justify it.** Prefer compositing into `worldCache`. If a
  layer genuinely must stay resident, give it a `shrink` (see `_shrinkResidentLayer`):
  crop it if it's mostly empty, downscale it if it's soft.
- **بطاطس gates DRAWING, not HOLDING.** A layer gated off by `_overlaysOn` still costs its
  full decoded size. That asymmetry is exactly why "lag on بطاطس too" was a memory
  symptom, not an effects one — reach for the memory ledger before touching draw code.
- A refused decode is silent and skips the layer, which is how the world came up **black
  and empty**. `loadWorldArt` now keeps the fetched bytes and **re-decodes failed layers
  once at the end of the pipeline**, where memory is freest. Keep that pass bounded —
  collision and `finishBootScreen()` are downstream of it.

> **Cache-busting:** `game.js` is loaded with a manual `?v=N` query in `index.html`. Bump
> it on every `game.js` change or returning visitors run stale code (this bit us: the
> browser kept serving `?v=173` after edits).

---

## Architecture

- **No build step** — pure vanilla ES modules. Edit and reload.
- **Firebase Realtime Database** (europe-west1) handles ALL multiplayer state.
- `lobbyPath(sub)` prefixes every Firebase path with `lobbies/{male|female}/{sub}` — male and female users never share data.
- `serverNow()` returns Firebase server time offset-corrected — use it instead of `Date.now()` for any multiplayer timing.
- The `gameState` object (line ~700) is the single source of truth for local state.
- The game loop runs at 60fps via `requestAnimationFrame` → `update()` → `render()`.

### Key classes

| Class | Location | Purpose |
|---|---|---|
| `FocusAudioEngine` | line ~46 | Web Audio API ambient mixer |
| `FocusYouTubePlayer` | line ~409 | YouTube IFrame API wrapper |

### Discord is OAuth ONLY — the voice-channel integration is gone
Discord is a **login provider and nothing else**. There is no bot listing voice-channel
members, no `status: 'in-voice'` users, no `channelName` / `categoryName` on
`users/{uid}`, no faded low-opacity avatars for "in VC but not in the website", and no
connection lines drawn between avatars in the same channel. **Don't reintroduce any of
it.** A user's lobby comes from the **roster's `gender`** when it knows them, else from
`users/{uid}/lobby` (see **Which lobby a user lands in**); presence comes solely from
`activeInGame`. `startGame` runs a one-time cleanup that nulls the legacy
`channelName` / `categoryName` / `status` keys on the signed-in user's own node, so the
tree drains itself as people log in — leave it in place until every account has been
seen at least once, then it can go.

### Which lobby a user lands in — the ROSTER decides, not Firebase
`users/{uid}/lobby` is only ever "whatever was written the first time that account was
seen". A mis-tap on the old gender chooser was therefore **permanent** — which is how
**أبو بندر ended up in الأخوات**.

`members.json` (the shared roster — see **لوحة مهام المكتبة → Identity**) carries a
`gender` field (`'m'` / `'f'`) keyed by Discord id, and it is the single source of truth
across every مدونة site. So `resolveUserLobby()` asks it **first**:

1. **Roster knows this Discord id** → `gender` wins, over the stored `users/{uid}/lobby`
   **and** over the localStorage cache. A wrong stored value is **repaired in place**
   (one fire-and-forget write) so presence and the lobby listeners agree with the spawn.
2. **Roster has never heard of them** (a guest, a brand-new account) → the old system
   runs untouched: `users/{uid}/lobby`, else the localStorage cache, else the
   `#discord-first-lobby-modal` chooser.

Gotchas, all load-bearing:
- **`altDiscordIds` are indexed into `MDWNH_ROSTER.byDiscord` alongside `discordId`** —
  one member, several accounts, one record. أبو بندر logs in from his alt; without this
  he resolves to nobody and gets no gender (and no library tasks and no claims either).
- **The roster is awaited AFTER the Firebase read, never before it.** `_mdwnhRosterReady`
  is declared at the foot of `game.js` and is still in its **TDZ** during the synchronous
  part of `resolveUserLobby` (which `init()` calls during module evaluation). The fetch
  is already in flight by then, so this costs nothing — it is not a serial round-trip.
- **`ROSTER_LOBBY_WAIT_MS` (2.5s) caps the wait.** An unreachable GitHub must never trap
  someone on the login spinner; past it the old path just runs.
- Siraj ghosts don't go through this at all (`selectedLobby = 'male'`, hardcoded).

### Login & auto-resume
Discord OAuth session in localStorage. On load, `initDiscordOAuth()` validates the token and resolves the lobby. **Auto-resume**: `startGame` writes `localStorage[ACTIVE_SESSION_KEY] = userId` while in-game (cleared on explicit logout / menu logout); on load, if that flag matches the resolved user, re-enter the game directly — `startGame` then restores the pomodoro/free-mode session from Firebase. This is what makes an unintended reload (Android discarding a backgrounded tab) seamless. Siraj ghosts never set the flag (ephemeral).

---

## The Menu (`#menu-screen`) + Boot Screen (`#loading-screen`)

The site name is **مقر المدونة**. Entry is **Discord-OAuth only** — the male/female
chooser is **gone** from the menu. The lobby comes from the account
(`resolveUserLobby` — see **Which lobby a user lands in** below).
The only buttons are: Discord login, **وضع التجربة**, and the PWA install button.

- **`#discord-first-lobby-modal` is a rare FALLBACK only** — it shows when
  `resolveUserLobby` returns null (a Discord account we've never seen). Do
  not surface it as a normal step.
- **The avatar pill (`#user-pill`)** replaces the login button once signed in:
  avatar + name + lobby tag (الإخوة / الأخوات) + an arrow chip. In RTL the arrow
  chip is the **last child**, so it sits on the LEFT. Hover slides `.pill-sweep`
  (a white panel parked at `translateX(101%)`) across from the right and the arrow
  nudges. Press → `.launching`: the arrow chip bolts out the pill's left edge
  (`arrowEscape`; the pill's `overflow: hidden` is what masks it), then the boot
  screen slides down.
- **`@media (hover: none)`** re-asserts the launch look and neuters `:hover` — on
  touch the white sweep would otherwise stick after a tap.

### Boot screen — one element, two jobs
`#loading-screen` (class `.boot`) is a **fixed overlay at z-index 100000** (above
the entrance blackout at 99999), NOT a `.screen`. Maqr logo + a **striped brand-gradient
bar** + Arabic messages that fade every 2s (`BOOT_MESSAGES`, shuffled via
`_shuffledCopy` so they don't repeat).
1. `showBootScreen('instant')` — page load, while the Discord token is checked.
2. `showBootScreen('slide')` — after the pill press; slides DOWN over the menu.

Flow: pill → boot slides in → `startGame` → world art decodes → `loadWorldArt()`'s
compose step sets `_worldReady` and calls `finishBootScreen()` → bar eases to 100% → boot slides
up → **`_openEntranceGate()`** → the intro (player falls) plays.

**Gotchas — all of these were real bugs, don't undo them:**
- **`beginEntrance` is GATED.** The async Firebase restore calls it while the boot
  screen is still up, so it queues into `_boot.pendingEntrance` and
  `_openEntranceGate()` replays it via `_reallyBeginEntrance` after the reveal.
  Otherwise the drop animation plays behind the loader and is over before you see it.
- **`showBootScreen('slide')` OWNS hiding `#menu-screen`** (on a 640ms timer, after
  the loader has covered it). `display` can't transition — hiding the menu any
  earlier flashes the near-white body background in the uncovered strip.
- **`.boot-fill` has NO `transition: width`** — `_bootTick()` writes width every
  frame and lerps itself; a transition would retarget on every write and lag.
- **Fill-mode `backwards`, not `both`**, on `bootMsgIn` / `#pwa-install-btn` /
  `.menu-foot`: `both` holds the 100% keyframe forever and an animated property
  beats a transitioned one, which kills the message fade-out and the button's
  hover lift.
- `startGame` has a **15s failsafe** + a `_worldReady` check so a 404'd art layer
  can never trap the user behind the loader.

### Decorative brand icons (`Icon Elements/`)
Seven black-on-transparent brush PNGs, exposed as `--ico-0`…`--ico-6` in `:root`
(the folder name has a space — it **must** stay `Icon%20Elements`). They're tinted
by CSS `mask-image` + `background-color: currentColor`, so `color` picks the brand
colour. Large + low-opacity in the menu backdrop (`buildMenuDecor()` → `MENU_DECOR`,
thinned on mobile, `display:none` on بطاطس); small in the card footer (`.foot-ico`).
The four brand colours are `--brand-red/-yellow/-teal/-blue` in `:root`.

### Loading speed
- Google Fonts moved from a CSS `@import` (render-blocking + serialised behind
  style.css) to `<link>` + `preconnect` in `<head>`. **Don't put the @import back.**
- `Maqr logo.png` is `<link rel="preload">`ed at high priority — it's the first pixel.
- `loadAssets()` marks every world-art `<img>` **`fetchPriority='low'` +
  `decoding='async'`** so ~15 MB of art can't starve the Discord/Firebase/font
  requests that decide how fast the menu appears.
- The PWA button is a **plain child of the menu card** now — the old version was
  `position: fixed` and JS-repositioned under the panel. It's removed entirely on
  Safari (no `beforeinstallprompt`) and when already installed.

---

## Mobile / Responsive System

Mobile = `isMobile()`: `window.innerWidth < 1024`, **OR** a touch device whose physical `screen` short side < 760px (catches phones that report a wide layout viewport — DuckDuckGo, in-app webviews, "desktop site"). Toggle with `setMobileClass()`. `body.is-mobile` drives all mobile CSS.

### Orientation changes (rotation)
Android reports **stale** `innerWidth/innerHeight` for up to ~1s after rotating, so a naive relayout commits the old-orientation size and the UI stays broken until reload. `settleViewportLayout()` polls, re-applying layout only once the viewport aspect **agrees with `screen.orientation`** (which updates immediately) and has gone stable, then forces a final relayout. Wired to `orientationchange`, `screen.orientation` change, a `matchMedia('(orientation)')` change, and an aspect-flip detected in the debounced `resize`. `resizeCanvas()` guards on the computed **backing-store** size and clamps total pixels (3.2M reduced / 24M high) so a bad transient can't allocate a giant canvas. Viewport meta is locked (`maximum-scale=1, user-scalable=no, viewport-fit=cover`) — the game has its own canvas pinch-zoom, so browser zoom isn't needed and locking it prevents rotation zoom-stuck. Body/overlays use `100dvh` so fixed controls stay reachable as the URL bar moves.

**Critical CSS rule**: Never use `!important` on `transform` for `.focus-sounds-panel`. JS drag code sets `drawer.style.transform` inline, and `!important` silently beats inline styles.

**Focus sounds panel**: Mobile has a bottom-sheet pull-up drawer. Hidden during azkar (`body.is-mobile.azkar-active .focus-sounds-panel { display: none !important }`) — do not show it during azkar on mobile.

**Focus mode** (`setMobileFocusMode(active)`): Hides joystick + user card during work phase. Joystick gets `.focus-hidden` class → opacity 0. User card slides off-screen with `transform: translateY(-140%)` + `pointer-events: none`. **The `#hud-tools` box and `#azkar-dock` slide with it** — they live outside the card now (see **The HUD stack**), so forgetting one leaves it floating alone on screen. The joystick's *other* hide, `.lib-hidden` (tasks panel open), is a deliberately separate class.

**Mobile azkar float button** (`#azkar-focus-float-btn`): A fixed pill at `top: 14px; right: 14px; z-index: 9500` that appears on mobile when the user card is `.focus-hidden` AND the azkar time window is valid. Tapping it opens the overlay directly (skips confirm — user card is hidden so confirm has no anchor). Visibility driven by `style.display` directly in JS (not class toggle) to avoid CSS specificity issues.

---

## Focus Audio Engine (the ambient sounds system)

### Sound keys and their source files

| Key | File | Label (Arabic) |
|---|---|---|
| `rain` | `Sound/Focus Sounds/Rain.mp3` | مطر |
| `rain_muffled` | `Sound/Focus Sounds/Muffled rain.mp3` | مطر خافت |
| `fire` | `Sound/Focus Sounds/Boiling.mp3` | موقد |
| `forest` | `Sound/Focus Sounds/Forest.mp3` | غابة |
| `brown` | `Sound/Focus Sounds/Brown Noise.mp3` | ضوضاء بنية |
| `wind` | `Sound/Focus Sounds/Wind.mp3` | رياح |
| `ocean` | `Sound/Focus Sounds/Ocean.mp3` | بحر |
| `plane` | *(synthesized — Web Audio only)* | طائرة |

### How it works

1. `init()` creates `AudioContext` + `masterGain`, then calls `loadFocusSoundBuffers()` async.
2. `loadFocusSoundBuffers()` only prefetches buffers for sounds already **active**; everything else loads on demand via `ensureFocusBuffer(key)` (fetch → `decodeAudioData` → `this.focusBuffers[key]`). See **Loading Strategy**.
3. `startSound(name)` for file-based sounds: buffer ready → seamless crossfade loop; buffer missing → **streams instantly** through a media element, then `_handoffToBuffer` crossfades to the loop when the decode lands.
4. Gain chain: `source → gainNode (sound.volume * baseVolumeScale) → masterGain (overallVolume) → destination`.
5. `saveToFirebase()` writes `dashboards/{uid}/profile/focusMix` with active/volume per sound + overall volume (private data — deliberately NOT under the live-listened `/users` node).
6. `applyState()` reads it back on login (from the profile get in `startGame`) and restores UI + state, prefetching buffers for the active sounds.

### baseVolumeScale
File-based sounds use `1.0` (full file level). `plane` (synthesized) uses `0.09` (synthesized noise is much louder raw).

### Sound preloading and background-tab rules
**Sounds preload AFTER spawn, never at page parse** (see Loading Strategy). Every new sound file must be:
1. Added as `_lazyAudio('Sound/Filename.mp3')` in `gameState.sounds` (`preload='none'` at parse; `warmGameSounds()` upgrades it on idle after spawn — add it to the priority list there only if it can fire within seconds of spawning)
2. Added to `FocusAudioEngine.buffers` with a `null` entry
3. Loaded in `loadSoundEffects()` via `await loadBuffer(...)` (or deferred like the boss set)

**Sounds must work in background tabs.** Use `focusAudioEngine.playEffect('key')` (Web Audio API) rather than `playSoundRobust(gameState.sounds.X)` (HTMLAudioElement) for any sound that must fire when the tab is not focused. HTMLAudioElement playback can be throttled/blocked in background tabs; Web Audio nodes play regardless.

**`ctx.resume()` is async — await it before playing.** Always chain: `ctx.resume().then(_doPlay)`. The `playEffect()` method already does this — never rewrite it to fire-and-forget.

### Ambient sound loading (mobile-safe)
Ambient buffers are **lazy** (`ensureFocusBuffer`) — only actively-used sounds download/decode. Do not restore the old "fetch all 7 at init" behaviour, and never make loading sequential (`for...await`) — one slow file must not block another.

**`visibilitychange` restart rule**: Only restart when `ctx.state === 'suspended'`. Running context means sounds are still alive — do NOT restart (that resets loop position).

---

## YouTube Focus Player

### Ad detection & muting
YouTube embeds cannot remove ads. Instead, `FocusYouTubePlayer` detects pre-roll ads and mutes + overlays them.

**Detection heuristic** (in `_poll()`, runs every 500ms):
1. 2-second grace period after `loadUrl()`.
2. After grace period, while `getPlayerState() === PLAYING`:
   - If `getCurrentTime() < -0.1` → ad.
   - If `getCurrentTime()` delta between polls is `< 0.05s` for 2.5s+ → time frozen → ad.
3. Ad clears when `getCurrentTime() > 1` and neither condition is true.
4. 120-second failsafe force-clears stuck state.

### `FocusYouTubePlayer` key methods
| Method | Purpose |
|---|---|
| `loadUrl(url, startSec, saveToFirebase, startPaused)` | Parse ID, create player if needed, load/cue video, start poll |
| `fadeOutAndPause(duration)` | Gradual volume→0 then pause |
| `fadeInAndResume(duration)` | Set vol=0, play, ramp up |
| `_poll()` | 500ms interval: update time display, waveform, ad detection |
| `_setAdMode(isAd)` | Mute/unmute + show/hide ad overlay |
| `loadFromProfile(profile)` | Restore saved URL+timestamp+loop from Firebase on login |

---

## Azkar System (أذكار الصباح / أذكار المساء)

### Time windows
- **Morning (صباح)**: Fajr → Dhuhr
- **Evening (مساء)**: Asr → Isha
- Falls back to Cairo times if no prayer API data: `{ Fajr: '04:30', Dhuhr: '12:00', Asr: '15:30', Isha: '19:30' }`
- `getCurrentAzkarType()` → `'morning' | 'evening' | null`

### Firebase path
`users/{uid}/azkarCompleted = { morning: 'YYYY-MM-DD', evening: 'YYYY-MM-DD' }`

Morning and evening are **independent keys** — marking morning done does NOT affect the evening button.

### gameState.azkar fields
```js
azkar: {
    active, type, items[], afterPrayer,   // overlay state (items = the ACTIVE list)
    startTime, minLockMs,
    counts[], currentIndex, completed,     // list progress
    pausedPomoRemaining, pausedPomoPhase,  // timer freeze
    pausedFreeWorkStart, pausedFreeWorkSnap,
    ytWasPlaying, ytVolumeBefore,
    focusMobileWasActive, _lastButtonRefresh
}
```

**`az.items` is the single source for rendering** — `openAzkarOverlay` builds it once (`renderAzkarList`/`onAzkarCountClick` read `az.items`, never `AZKAR_MORNING/EVENING` directly), so shuffling and the custom after-prayer list "just work" and stay index-aligned with `az.counts`.

### Randomize order
`getRandomizeAzkar()` (off by default, `SETTINGS_AZKAR_RANDOM_KEY`) → `openAzkarOverlay` builds `az.items` via `_shuffledCopy(baseList)` (Fisher–Yates). Completion tracking is per-type (morning/evening), so shuffling never affects the done state.

### After-prayer azkar (أذكار بعد الصلاة)
Opened from the **prayer overlay** via `#prayer-azkar-btn` → `openAzkarOverlay('morning', { afterPrayer: true })`. Uses the custom `AZKAR_AFTER_PRAYER` list and sits **on top** of the prayer overlay (`body.azkar-after-prayer .azkar-overlay { z-index: 10002 }` vs prayer's 10000). Crucially it does **not** freeze/resume the timer or fade YT/sounds itself (`afterPrayer` skips all of that in `openAzkarOverlay`) — the prayer overlay already owns that. On انتهيت, `closeAzkarOverlay` detects `afterPrayer`, fades the azkar overlay out, then calls `dismissPrayerOverlay()` which un-freezes the timer and fades focus sounds + YouTube back in → normal work session. `minLockMs = 0` for after-prayer (no forced wait).

**It wears the salah's own sky.** `dataset.mode` stays `'morning'` (it still drives the
layout), but `openAzkarOverlay` also copies the prayer key off `#prayer-overlay`'s
`data-prayer` onto the azkar overlay — so Isha azkar is deep blue, Maghrib is sunset,
and so on. It **deletes the attribute** for normal morning/evening azkar, or a stale key
would repaint them. The CSS lives with the other azkar bg rules and every selector is
prefixed **`body.azkar-after-prayer`** — without that prefix it ties `[data-mode="morning"]`
on specificity and silently loses on source order. Glow strengths are dialled down from
the prayer overlay's: this is a reading surface.

**Closing must keep the class through the fade, not drop it on press.** `.azkar-overlay-bg`
transitions `background` over 1.2s and the overlay itself fades opacity over 0.65s — so
stripping `body.azkar-after-prayer` the instant رجوع/انتهيت is pressed swapped the still-
visible overlay back to plain `data-mode="morning"` blue mid-fade (a blue flash right
before it disappears). Both `closeAzkarToPrayerOverlay` and `closeAzkarOverlay`'s
after-prayer branch now remove the class inside the same `setTimeout` that adds
`hidden`, so the correct colour holds for the whole fade-out.

**The focus-sounds panel behaves exactly like normal azkar** — compact, mixable —
just bumped to `z-index: 10003` under `body.azkar-after-prayer` (vs the normal 10001)
so the after-prayer overlay's own opaque background (z-index 10002) can't cover it once
it finishes fading in.

### Key functions
| Function | Purpose |
|---|---|
| `getCurrentAzkarType()` | Returns current window type using `_azkarFakeHour` if set |
| `updateAzkarButton()` | Throttled 1/s; shows/hides button + mobile float btn |
| `openAzkarOverlay(type, opts)` | Builds `az.items` (shuffle / custom), freezes timers, pauses YT, renders list, starts lock timer. `opts.afterPrayer` = post-salah mode (skips freeze/YT) |
| `closeAzkarOverlay(markDone)` | Restores timers, fades YT back in, removes body class. In `afterPrayer` mode delegates the resume to `dismissPrayerOverlay()` |
| `renderAzkarList()` | Builds DOM from `az.items`; resets `scrollTop = 0` every time |
| `onAzkarCountClick(idx)` | Decrements count, marks done, scrolls to next — **scrolls `listEl` only** (manual `scrollTo`, never `scrollIntoView` which bubbled up and scrolled the whole overlay down) |
| `markAzkarCompleted(type)` | Saves to Firebase |
| `setupAzkarUI()` | Wires all button events; called from `startGame()` |
| `updateAzkarSystem()` | Called every frame from game loop |

### Timer freeze pattern (mirrors prayer overlay)
- **Solo pomo**: snapshot `endTime - Date.now()` → keep re-extending `endTime` each frame in `updatePomodoro()` while `az.active`
- **Free mode**: snapshot `totalWorkMs`, zero `workStartTime`; restore on close
- **Shared pomo**: azkar button is blocked during any phase ≠ `'idle'`

### انتهيت button lock
- **Normal users**: 3-minute lock
- **Siraj**: 3-second lock (`az.minLockMs = gameState.isSirajGhost ? 3000 : 180000`)
- Lock is CSS-only (`.unlocked` class) — button is **never** `disabled` attribute. On iOS, `button[disabled]` leaks touch events through to elements below. Use `classList.contains('unlocked')` check in click handler instead.

### Focus sounds during azkar
- Desktop: panel shown in compact 2-column grid, bg/border at 10% opacity, `z-index: 10001` (above overlay at 10000), `pointer-events: all` — bumped to `10003` during after-prayer azkar (its own overlay is `10002`)
- **Per-sound volume in the compact panel**: the roomy panel's inline slider doesn't fit beside a name in a 2-column grid, so the same `<input type="range">` is re-positioned as the item's own **underline** — a hairline pinned to the item's bottom edge that fills with the level, and rendered **only on a sound that's active**. It's the same element and therefore the same handler + the same `focusMix` Firebase write; there is no second code path. Its thumb stays visible (a 3px bar has nothing to aim at otherwise), and on mobile the input's box grows to 18px for a usable touch target while `background-clip: content-box` keeps the painted bar 3px
- Mobile: sounds panel hidden entirely (`display: none !important`)
- Prayer overlay (z-index 10000) still covers sounds panel — azkar's elevated z-index only lifts it above the *azkar* overlay, not above prayer

### Scroll and overlay containment
- `.azkar-list`: `overscroll-behavior: contain` stops scroll propagating to page
- `body.azkar-active { overflow: hidden }` locks body
- Overlay wheel events: `stopPropagation()` on all; `preventDefault()` on non-list targets — prevents game zoom while azkar is open
- Global wheel zoom handler also checks `gameState.azkar.active` as safety net
- Overlay `bottom: -200px` (desktop) + `padding-bottom: 200px` → background extends below fold without shifting content. Mobile: `bottom: 0; padding-bottom: 0` — no extension needed

### Siraj time-spoof UI
Module-level vars `_azkarFakeHour` / `_azkarFakeMin` override the real clock for `getCurrentAzkarType()`. Auto-cleared on page reload (module scope). Applying a new fake time also clears `azkarCompleted` from Firebase so the button reappears fresh.

`#azkar-time-picker-modal` — clock picker with up/down arrow wheels + scroll wheel (normalized by `deltaMode` so one mouse click = one unit change). Visible only when `gameState.isSirajGhost === true`.

---

## Reading Session (القراءة)

Timed reading, started from the **books library desk** (`BOOKS_LIBRARY_POS`, floor 1).
Lives at the end of `game.js`, after the dashboard module. Markup: `#reading-modal`,
`#reading-newbook-modal`, `#reading-panel`, `#reading-mobile-header`,
`#reading-drawer` in `index.html`; the `Reading Session Feature` block in `style.css`.

### Book covers are DRAWN, never uploaded (`bookCoverSVG`)
> **Title placement:** the title is a **header** — parked at `TT = 0.19` (upper third) and
> rotated by the tilt of the cover's own horizontal **at that t** (`atan2(30 − 60·TT, 140)`
> ≈ 7.6°), derived from `_bkP`. It used to sit dead-centre at a fixed 12.1° (the tilt of
> the cover's *top* edge) and read as wildly raked, because the projection only tilts
> horizontals near the top — at `t = 0.5` a horizontal on this cover is exactly level, so
> the title fought the shape under it. Don't re-hardcode the angle: it must follow `TT`.

A book = a **name + a style id**. That's all that's stored; the cover art is generated.
`bookCoverSVG(styleId, name, opts)` returns a self-contained `<svg>` string: a
two-point-perspective book (spine face left, front cover facing the viewer), gradient
cover, per-style decoration, hinge groove, diagonal sheen, and the title typed on top.

- **It must be injected as INLINE svg** (`el.innerHTML = bookCoverSVG(...)`), never as
  `<img src="data:...">` — an `<img>`-hosted SVG can't reach the page's fonts, so the
  Arabic title would lose Rubik (and its shaping).
- **All geometry comes from `_bkP(u, t)`** — `u` = 0 spine edge → 1 fore edge, `t` = 0
  top → 1 bottom, returning the projected point. Every decoration is built from it, so
  nothing hand-computes the slanted edges. `u` outside `[0,1]` extrapolates (that's how
  the spine face and the diagonal stripes are drawn); the cover `clipPath` trims it.
- **`BOOK_STYLES` — 10 premade looks**, each `{ cover, cover2, spine, accent, text,
  halo, deco }`. `text` is picked for contrast against `cover`; `halo` is the
  `paint-order: stroke` behind the title and is always the **opposite lightness of
  `text`**, so the name stays readable over any decoration. Adding a style means adding
  a `deco` branch in `_bkDeco(kind, s, id)` — `id` is the SVG's unique id prefix, needed
  by any `<mask>`/`<defs>` the decoration adds.
- Legacy books saved before styles existed get a stable one from `bookStyleForName()`
  (hash of the name), so a given book always looks the same.
- **SVG arc gotcha (bit us on the crescent):** an arc whose radius is smaller than half
  its chord is silently scaled UP to fit by the spec — the "obvious" two-arc crescent
  rendered as a plain filled circle. Use a `<mask>` (disc minus offset disc) instead.

### The shelf (`#reading-shelf-track`)
Horizontal scroll-snap carousel: **one big book centred, the rest shrunk beside it**.
Order is **newest leftmost → older to the right**, with the **"كتاب جديد" card capping
the left end** — so the track is forced `direction: ltr` regardless of the page's RTL.
Ordering keys off `books/{slug}/addedAt` (re-adding an existing book bumps it to the
front). Selection = the card nearest the track centre (`_readingSyncShelfSelection`, run
rAF-coalesced on scroll) → mirrored into `gameState._readingSelectedBook`, which is what
"أنا لها" actually starts. Clicking an off-centre card only centres it; only the
**centred** add-card opens the new-book modal, and the delete ✕ only exists on the
centred book — a scroll-tap must never fire either. "أنا لها" locks with the
`.is-disabled` **class, never the `disabled` attribute** (iOS touch leak — see azkar).

### New-book modal
Name + one of the 10 covers, with a **live preview** (`_renderNewBookPreview` re-renders
on every keystroke and swatch click). Swatches are the same generator at `{noText:true}`.

### Firebase
```
dashboards/{uid}/reading/lastBook          = "…"                       // shelf lands here on open
dashboards/{uid}/reading/books/{slug}      = { name, style, totalMs, addedAt }
lobbies/{lobby}/readingLeaderboard/{uid}   = { name, avatar, totalMs }  // via lobbyPath()
users/{uid}/{isReading, readingBook, readingEnd, booksSofa}             // presence only
```
Private book data lives under `dashboards` (one-shot `get()`s, zero fan-out — see the
cost rules). `_readingSlug()` strips `. # $ [ ] /`. **Siraj ghosts never touch
المتصدرين** — they skip the leaderboard write entirely, and `fetchReadingLeaderboard`
also filters `uid.startsWith('siraj_')` on read so any pre-existing ghost row stays
hidden.

**Time is banked INCREMENTALLY, not only at انتهيت** (`bankReadingProgress`). Nothing
used to be written until the session ended, so closing the tab threw the whole session
away. Now `updateReadingSession` banks every `READING_BANK_INTERVAL_MS` (60 s) and
`endReadingSession` only commits the tail — a lost tab costs at most a minute. Rules:
- **`r._bankedMs` is the ledger.** Every write adds `now − _bankedMs`, never a total, so
  nothing is ever counted twice. Don't add a second call site that writes `sessionMs`
  directly.
- Elapsed always goes through **`_readingSessionMsNow()`**, which clamps to the session
  cap — a backgrounded tab throttles rAF, so a raw `serverNow() − startTime` would bank
  the whole away period.
- Book **name/style** and the leaderboard **name/avatar** are written once, on the first
  bank (`_bankedMeta`) — they can't change mid-session.
- Cost: two `runTransaction`s a minute on nodes **nobody live-listens to**
  (`dashboards/…`, `readingLeaderboard` is a one-shot `get()`), so the fan-out is zero.

### Seat + camera
The sit-down itself is `startSitAnimation`, so the hop is relayed and **every client
sees the same sequence** you do (see **Player Position Sync → the sofa hop**). The book
prop's `seated` test excludes a live `_sitAnim` on **both** sides — the seat's Firebase
write lands as the hop starts, so without it the book slides out from under a player
who's still mid-air.

`startReadingSession` picks a **RANDOM free `SOFA2_SPOTS` seat, not the closest** (always
landing on the same sofa made the room feel static), then `startSitAnimation`.

`updateReadingCamera` phases: `intro → active → exiting`.
- **`intro` is ONE eased tween** (`READING_INTRO_MS`, `_easeInOutCubic`) covering zoom
  AND pan together, interpolated from a captured start (`_fromX/_fromY/_fromZoom`). It
  used to be two phases — a raw exponential lerp to zoom in, handing over to a separate
  eased slide — and because the lerp still had velocity when the ease-in-out started
  from zero, the hand-off read as a stutter. **Don't re-split it.**
- **`exiting` is time-bounded** (`READING_EXIT_MS`, hard stop `READING_EXIT_MAX_MS`) and
  restores `_zoomBefore` (the zoom the player had before the session). `updateCamera()`
  early-returns while a reading phase is set, so a phase that never clears means the
  camera is owned forever — that was the "camera rubber-bands after a reading session"
  bug (see Common Bugs). `abortReadingCamera()` hands the camera straight back and is
  called by both zoom handlers, so a user gesture always wins.

### The book prop (`drawBookProp`, `Art/Book.png`)
Slides out from **under** the seated reader to in front of them — **position only, no
opacity change**: the player sprite itself is what hides it on the way out, which is why
it's drawn **before the avatar** in `drawPlayers` (after the contact shadow). Direction
comes from the sofa spot's `dir`: the **upper** Books_Sofas face down (book slides
**down**), the **lower** ones face up (slides **up**). `_updateBookProp` lerps a per-
player `_bookSlide` 0→1 toward "seated & reading", so it retracts the way it came on
session end and works for **remote** readers too (`isReading` + `sitSeatId` are both
synced). Scaled to `PLAYER_SIZE * 0.80` — slightly smaller than the player, so it stays
hidden under them at slide start. `BOOK_SRC` crops to the painted region of the 2048²
PNG (the book floats in the middle of a mostly-empty canvas).

### Panels
Black glass like the rest of the site (the old blue treatment is gone); the only colour
is `--rd-accent`, a warm parchment cream. Desktop `#reading-panel` sits in the left third
(the camera slides the reader right to make room) and shows cover + name + total, the
timer card with a progress bar, and المتصدرين. Mobile mirrors it in a top header +
pull-up drawer. Both are fed by `updateReadingSession` via an `isMobile()` id prefix
(`reading-panel-*` / `reading-mobile-*`) — **keep those two id sets symmetrical**.

---

## Fireplace / Members of the Month (المدفئة — أعضاء الشهر)

Walk near the fireplace on floor 1 → **"انقر للنظر الى المدفئة"** (same plain bobbing
prompt style as the laptop/library prompts) → click → `#fireplace-overlay`: a
full-screen view of the fireplace art with the month's **top 3 point scorers** framed
on it. Code lives at the end of `game.js`; markup is `#fireplace-overlay` in
`index.html`; styles are the `المدفئة` block in `style.css`.

### The art stack (draw order is fixed)
`Art/Fireplace BG.png` (1920×1080, `object-fit: cover` behind everything) → `.fp-stage`
holding `Art/Fireplace.png` (1500×1920) → the 3 member frames → the animated flame
(`Art/Fire/fire_NN.png`, **always on top** — see **The flame**). The stage is sized `width: min(100%, 100dvh*1500/1920)`
with `aspect-ratio: 1500/1920` — **width is the only sized axis on purpose**; a
`height: 100%` fighting `max-width` breaks the ratio and the frames drift off the art.

### The 3 frames — `FIRE_SLOTS`
Positions are **fractions of `Fireplace.png`**, measured off the reference overlay, so
they hold at any screen size. **Middle = 1st place, right = 2nd, left = 3rd** (RTL
podium). `setupFireplaceUI` builds the slot divs from `FIRE_SLOTS`, so the coordinates
live in **one place** — tune them there, never in CSS.

Under each frame sits a `.fp-slot-caption` column: name, then a `#N` rank chip
(gold/silver/bronze via `.fp-slot-rank{1,2,3}`) and the member's `totalPoints`. It's a
**stacked column below the slot box**, never inside it — the slot box IS the painted
frame, so anything in flow would squash the photo out of it.

### Enter / exit (fade + the slow shake)
`display` can't transition, so the old `display:none` → `.active{display:flex;opacity:1}`
snapped in. The overlay is now **always laid out** and enter/exit is `opacity` +
`visibility` (visibility delayed by the fade on the way out), with `.active` applied
after a **double rAF** — the same pattern the azkar/prayer overlays use. The art layers
fade in **staggered back-to-front** (bg → stage → topcoat → frames) via
`transition-delay`; the exit is deliberately un-staggered.

`.fp-shake` wraps everything except the close button and runs `fpShake`, a **17s
transform-only** drift + hair of rotation, scaled to `1.05` so the translate can't
expose an edge. Transform-only → compositor-cheap, so it stays on at every graphics
tier (it's off under `prefers-reduced-motion`).

**No camera snap on enter/exit:** the game loop keeps running behind the overlay, so
`_fireFreezeCamera()` pins `gameState.camera` on open and `updateCamera()` early-returns
while `fireplaceHoldsCamera()` — the world you come back to is exactly the one you left.

**Backdrop click**: `.fp-shake` now covers the whole overlay, so the old
`e.target === overlay` test can never match. It asks
`!e.target.closest('.fp-stage, .fp-close')` instead.

### The data join — TWO different Firebase projects
This is the fiddly part. The two databases were never designed to line up:
- **Points**: the separate **`mdwnhpoints`** project (`pointsDatabase`, a second named
  app in `firebase-config.js` — `getDatabase(app)` would hit the main DB). Keyed by
  **Arabic name**: `players/{name}/totalPoints`. **No UIDs there at all.**
- **Avatars**: our main DB, keyed by **UID** (`users/{uid}/avatar`).

So: points name → `_fireNormName()` → `FIRE_NAME_TO_UID` → avatar. Gotchas:
- **`_fireNormName()`** folds hamza/alef/ya/ta-marbuta variants + strips harakat and
  tatweel — the points DB writes `ابو مزاحم`, our list has `أبو مزاحم`.
- **`مجود` is spelled `نجود`** in the points DB. That's a genuinely different letter,
  not a hamza variant, so normalisation can't fix it — **both spellings are mapped to
  the same UID** in `FIRE_NAME_TO_UID`. Any future mismatch like this gets the same
  treatment: add the extra spelling as another key.
- **`FIRE_EXCLUDE_NAMES`** drops `سراج` — the test account has ~19k points and would
  own first place forever.
- `FIRE_NAME_TO_UID` is **hand-maintained** — add a member here when they're added to
  the points bot, or they'll show a letter-initial fallback instead of their avatar.

### Cost
**One-shot `get()`s only, on open — never a live listener.** The points node is a
foreign DB whose size we don't control, and the avatars are one `get()` per top-3 UID,
**memoised for the session** (`_fire.avatars`). A re-open renders the previous result
instantly, then refreshes in the background.

### The flame — a 29-frame PNG sequence (`Art/Fire/fire_NN.png`)
`.fp-fire` is an `<img>` whose `src` is cycled at **12 fps** by `_fireStartFlame`; the
frames are preloaded `Image`s, so the swap doesn't flash and no stacked layers are
needed. `_flame.i` is never reset, so reopening resumes the flicker instead of restarting
on the same frame. Started from `openFireplaceOverlay`; stopped **550 ms after** close so
it keeps flickering through the 0.5 s fade-out (the stop is guarded on `_fire.open`, so
reopening mid-fade isn't killed by the previous close's timer).

**Loading**: `_fireEnsureFrames()` is idempotent and kicked from `updateInteractions` the
moment `gameState.nearFireplace` goes true — walking up is the earliest honest signal
you're about to look, so the set is decoded by the time the overlay fades in. Never on the
login path. A frame that 404s resolves anyway: one gap in the flicker beats no flame.

**Why a sequence and not the MP4 it replaced.** The frames carry **real alpha**, so
there's no black background and no `mix-blend-mode: screen` — which was washing out the
dark log. The memory objection to a PNG sequence is real but is about *full-size* frames:
`Art/Fireplace Fire.png` is a 4×8 grid of 1500×1920 cells (29 painted, 3 blank) which
would decode to ~340 MB — the exact pressure that OOM-crashed Safari (see **The World →
Perf notes**). Each shipped frame is cropped to the flame's own bbox (`448,946 →
1129,1644` in cell space — that's where `.fp-fire`'s fraction rect comes from),
downscaled to 512×525 and saved **255-colour**: the art is flat cel shading, so the
palette is lossless to the eye (unlike Lemo's baked gradients, which banded — hence WebP
there). The set is **~890 KB** and ~31 MB decoded.

The master spritesheet stays **local-only, gitignored** like the Lemo masters. Re-cutting
it means re-running the crop/downscale/quantize — keep the bbox and the CSS fraction rect
in sync if it ever changes.

### Input lock
`fireplaceIsOpen()` bails the window `keydown`, the wheel-zoom handler and
`handleMovement` — same pattern as the dashboard / char-customizer. `body.fireplace-active`
locks body scroll and hides `#game-canvas` on mobile. `z-index: 9000` — **below** the
prayer/azkar overlays (10000), which must cover it.

---

## Lemo (the robot)

An ambient character in the break room. Code is the `Lemo` block at the end of
`game.js`; there is **no markup and no CSS** — he's drawn straight onto the canvas.

**Client-only, on purpose.** Nothing about him is written to Firebase and nothing is
read back, so every player meets him in a different place and he costs **zero** of the
10 GB download budget. Don't "fix" this by syncing him — a wandering entity would be
the most expensive write pattern in the app (see the Firebase Cost Rules).

### Behaviour (`updateLemo`, one state machine)
`sleeping → waking → idle ⇄ walking`, with a rare `playing` detour.
- **50/50 at login**: either asleep at `LEMO_SPAWN`, or already awake on a random spot.
- **Waking**: the local player inside `LEMO_WAKE_R` sets `wakePending`; he only stirs
  once the current sleep loop **finishes** (no mid-cycle cut), then plays WakeUp once.
- **Idle**: `LEMO_IDLE_MIN/MAX_MS` is a **floor, not the whole wait** — he still has
  to finish the running 3 s Idle cycle before he'll move, so the effective idle rounds
  up to the next cycle. Then he chooses: a `LEMO_PLAY_CHANCE` (12%) detour into Play,
  else a new spot.
- **Walking**: the cycle can't be looped — it opens with a warm-up and closes with an
  overshoot. So the **travel is bound to frames 0→45** (`LEMO_WALK_MOVE_FRAMES`) and the
  last 15 frames play **in place** as he settles. One walk = one playthrough, whatever
  the distance. Easing is `_lemoEase` — **ease-out only**, deliberately: the walk art
  already carries its own warm-up, and easing the movement in on top of it read as him
  creeping off the mark.
- **Turning**: the art faces RIGHT, so a leftward trip mirrors him — `_lemo.face` is a
  plain ±1 snap into `ctx.scale`, no tween. He snaps back to the default when the walk
  animation ends.

### Sprites — everything is baked by `Art/Lemo/slice.py`
Re-run it after touching a master; it prints the `fw`/`fh`/`box` that **`LEMO_ANIMS` in
game.js must mirror**. Four decisions worth keeping:
- **Per-animation crop, not one shared box.** Play needs the arms-out width; Idle
  doesn't. Every box is measured in the SAME source-cell space, so frames still align.
- **Alpha threshold 48.** The masters carry a stray alpha≤40 dot at the far right of
  every cell — measuring at alpha>0 pads every frame with ~35% dead width.
- **Lit from directly ABOVE.** The rim sits on top-facing edges only, so it survives
  the horizontal mirror. A top-left rim would flip to top-right and read as the light
  teleporting. Rim + shading are **baked** — a live rim pass means an offscreen canvas
  every frame, the exact cost the graphics tiers exist to avoid.
- **WebP q90, not PNG.** The baked gradients need thousands of shades; a 255-colour PNG
  palette bands the head badly (1530 → 54 unique colours) and lossless PNG is ~3.3× the
  bytes for no visible gain. `.webp` is already in `sw.js`'s `MEDIA_EXT`.

### Geometry
One anchor: `LEMO_ANCHOR_SX/SY` = the idle body's centre-x and feet-y **in source-cell
px**, mapping to `(lemo.x, lemo.y + LEMO_H/2)` — the same centre-origin,
shadow-at-the-feet convention `drawPlayers` uses, which is also why mirroring around
his own centre just works. `LEMO_SCALE` is derived from `LEMO_H / LEMO_BODY_SRC_H`, so
resizing him means editing **`LEMO_H` alone**.

### Hiding him
`SETTINGS_LEMO_KEY` (العرض والأداء → ليمو). Cached per-frame as `gameState._hideLemo`
like every other settings flag — **never call `getHideLemo()` from draw code**, it hits
localStorage. Hidden **freezes** him (`updateLemo` early-returns) rather than simulating
an invisible robot; he resumes wherever he was.

### Cost
~2.4 MB over 5 sheets, all lazy (`ensureLemoSheet`) and never on the login path; a
missing sheet just skips a frame of drawing. **Sleeping + WakeUp are freed the moment
he's up** (`_lemoReleaseSleepSheets` — he only sleeps once per session, so that's ~19 MB
of decoded frames that can never be needed again; same reason the world frees its
layers). They're left as tombstones so they can't re-fetch. Play is the heaviest sheet
and a rare detour, so it warms on idle, not at spawn.

### Gotchas
- `drawLemo` is called from **both** `render()` and `renderPiPInto` — `updateLemo` runs
  only in `gameLoop`, so the PiP pass draws him without double-advancing (the same trap
  the hat springs hit, see `_pipPass`).
- He's drawn **before** `drawPlayers(false, 1)`: he's set dressing and must never
  occlude a player.
- The drop shadow uses the avatars' exact values; `installLowGfxShadowGuard` zeroes
  `shadowBlur` on reduced tiers, so it's free on mobile like every other world shadow.

---

## الدردشة القريبة — proximity chat

A **50-character** message that floats over your head, wrapping onto a second line when
it needs one. Code is the `الدردشة القريبة` block near the end of `game.js`; markup is
`#chat-input-wrap` in `index.html`; styles are the matching block in `style.css`. Grep
anchors: `CHAT_`, `updateChatSystem`, `drawChatBubbles`, `receiveChatMessage`,
`sendChatWS`, `_chatMen`, `_chatMentionPing`.

> **There is deliberately NO text-to-speech.** It was built (`speechSynthesis`, voice
> picked by lobby, pitch hashed off the uid) and then **removed on purpose** — don't
> reintroduce it without being asked. The message is text; the only sound is the
> arrival cue below.

### It costs ZERO Firebase, and that is the whole design
Decision-tree §5 case 1: high-frequency, ephemeral, worthless to a late joiner. So a
message is a **one-off event on the existing WebSocket relay** — `{t:'chat',uid,m}` —
exactly like the sofa hop (`sendSitWS`). **Nothing is written, nothing is read back, no
listener is added, and the Worker needed no change** (it forwards raw bytes without
parsing). Under `users/{uid}` this would have re-streamed every message to every client
in both lobbies; it would have been the most expensive feature in the app.

The trade is stated once and accepted: **socket down = message not delivered.** That is
the same fallback contract live positions already live under, and it is the right one
for something that expires in seconds. Don't "fix" it with a Firebase mirror.

### Seeing and hearing are two different radii — on purpose
| | radius (world units) | what happens past it |
|---|---|---|
| `CHAT_SEE_R` 760 (+`CHAT_SEE_FADE` 260) | bubble | fades out — a bubble across the building is not readable |
| `CHAT_HEAR_R` 430 | arrival cue | silent |

For scale: the shared-pomo "standing together" threshold is **200** and the world is
1193 × 1706. The cue's pitch and level also **scale with distance inside** the radius,
so a far-off message reads as far off rather than being a hard cut-off. **Your own
bubbles never fade** — you always see what you said, and your own message makes no
sound at all (you pressed send).

**Nobody in a work session ever gets the cue** (`localInWorkPhase()`, so free mode counts
too), nor during azkar/prayer/a minigame. That silence is the point: the bubble still
appears, so a message is never lost, it just can't interrupt.

### The bubbles
Drawn on the canvas (never DOM), **per floor, right after that floor's timers** — same
split as the avatars, so a ground bubble stays under the mezzanine and a mezzanine one
fades with it. Newest sits **lowest** (nearest the head) and carries the tail; a new
message springs in from just under its slot while the older ones slide up.

- **Two springs per bubble**, both damped **below 1 on purpose**: the stack overshoots a
  hair as it settles (scale peaks at ~1.13, off settles in ~25 frames) — that overshoot
  is the whole iPad feel. A linear slide reads as dead.
- **A bubble is 1–3 lines tall, so the stack is built from HEIGHTS, never a fixed step.**
  Each bubble's slot = the stacked height (+`CHAT_BUB_GAP`) of every bubble newer than
  it. A fixed step is what would make a two-line bubble overlap the one above it.
- **Layout is measured ONCE, on arrival** (`_chatLayout`, off an offscreen context) into
  `b.lay = {rtl, lines, w, h}`; the draw only places it. Wrapping splits a text run only
  at the wrap point, so every piece is still one logical run and the browser does the
  bidi inside it — splitting word by word would reverse an English phrase inside an
  Arabic line. Reading direction = the message's first strong character.
- **`CHAT_HEAD_GAP` is deliberately small enough that the tail tucks INTO the hair.** A
  bubble floating clear above the head reads as a label, not as speech.
- **`_chatSelfLift` eases MY OWN stack up while the type box is open** so the box never
  lands on it, and eases it back down on close. Purely local — nobody else's client
  knows I have a box open, so it is never relayed. The lift is **divided by the zoom**:
  the box is a fixed number of SCREEN pixels tall, so a world-space constant would clear
  it zoomed out and sit absurdly high zoomed in.
- **Weak devices**: the bubble's only expensive property is `ctx.shadowBlur`, which
  `installLowGfxShadowGuard` already forces to 0 on متوسط/بطاطس; `drawChatBubbles` also
  gates it on `gameState._lowGfx` so the intent is readable locally. There is **no CSS
  `backdrop-filter` on the bubbles at all** (they're canvas), and the input box drops its
  blur entirely on `body.is-mobile` — invariant 10.
- `drawChatBubbles` also runs in the **PiP pass**; `updateChatSystem` is called only from
  `gameLoop`, so the springs are never advanced twice (same rule as Lemo and the hats).

### The input box
`#chat-input-wrap` is a fixed DOM element whose `left`/`top` are written per frame by
`updateChatInputPos`; its own transform is a constant `translate(-50%,-100%)`, so **`top`
is its bottom edge** — which is what the **`visualViewport` clamp** works against, and
that is what lifts it clear of the mobile keyboard. `display` can't transition, so the
box is always laid out and enter/exit is `opacity` + `visibility` + `.active`.

- **The canvas rect is cached** (`_chatUi.cl/ct`, re-measured only on open and on
  resize). Reading `getBoundingClientRect()` every frame immediately before writing
  `left`/`top` thrashes layout for an origin that never moves. Same for the box's own
  size, measured once on open — `visibility: hidden` still lays out, which is exactly
  why it isn't `display: none`.
- **Opening zeroes `gameState.keys`.** `handleMovement` stops reading them the instant
  `chatIsOpen()` goes true, so a key held at that moment would stay "down" forever.
- `chatIsOpen()` joins the standard guard list in the window `keydown`, the wheel-zoom
  handler and `handleMovement`.
- **`chatSelfPress` is checked BEFORE `handleClickOffSofa`** in both the desktop and
  mobile hit-test chains: while seated, a press on yourself lands ON the sofa, and that
  helper swallows the click.
- The outside-press dismissal **ignores a press on your own character** — the canvas
  handler reads that as "open the chat box", so closing first would close-then-reopen and
  wipe whatever was half-typed.
- **Raising the mobile keyboard took FIVE things.** It failed twice before this list
  was complete — first not appearing at all, then flashing up and dropping straight
  back down — so treat the whole list as load-bearing:
  1. `focus()` runs inside the original gesture. A deferred focus never raises it.
  2. The tap `touchend` on the canvas is **`{ passive: false }`** and the chat branch
     **`preventDefault()`s** it. A touch is followed by *synthesized* mouse events, and
     that synthesized `mousedown` lands on the canvas and moves focus off the input —
     so the keyboard never appeared at all. **Only the chat branch cancels**; every
     other path still needs its `click` (the results buttons are wired to `click`).
  3. **Cancel FIRST, focus SECOND** — hence `chatWantsSelfPress()` being split out of
     `chatSelfPress()`. Focusing and *then* cancelling the tap that caused it is what
     made the keyboard flash up and vanish.
  4. **`updateChatInputPos` stops following after 500 ms** (`force` still repositions).
     Movement is locked while the box is open, so there is nothing left to follow — and
     continuously rewriting the `top`/`left` of a fixed element holding the focused
     input is a known way to make a mobile keyboard pack up and leave. The anchor also
     **drops `bobOffset`**: letting the box breathe with the idle animation meant a
     style write on literally every frame.
  5. Two safety nets: a capture-phase `mousedown` guard on the canvas live for 600 ms
     after the open (cancels the focus change only — `preventDefault` is not
     `stopPropagation`, so the normal handler still runs), and a `blur` listener that
     takes focus back, **at most twice, inside 900 ms**, so a device that simply
     refuses to focus can never spin.
  Plus a forced reflow (`void wrap.offsetHeight`) before `focus()`, so the input isn't
  still computed as `visibility: hidden` when focus is requested, and `#chat-input` is
  **16px on mobile** so iOS doesn't zoom the page on focus.
- **`#chat-input` is a `contenteditable` div, not an `<input>`** — a mention is a real
  pill in it. Everything an `<input>` gave for free is rebuilt, and each piece is
  load-bearing:
  - It needs **`-webkit-user-select: text`** — iOS won't type into an element that
    inherits `user-select: none`.
  - No `maxlength`: the 50 is held in `beforeinput` (a run that doesn't fit is cut to
    what does), paste is intercepted as **plain text**, and an IME composition — which
    can't be refused mid-flight — is trimmed from the end on `compositionend`
    (`_chatEnforceMax`).
  - No line breaks ever go in. The mobile "send" key can arrive as **`beforeinput`
    `insertParagraph`** with no keydown Enter, so that path sends too. `format*` input
    types (Ctrl+B) are blocked.
  - No placeholder attribute: `data-placeholder` shown by `.is-empty::before`, the class
    decided in JS — an emptied contenteditable often keeps a stray `<br>`, which would
    stop `:empty` matching. The pseudo is `position: absolute` so it can't push the caret.
  - The box grows a line **upward** (its bottom is the anchor). `_chatUi.h` is re-read on
    input only when the height changed (`_chatRemeasure`), never per frame.
  - The outside-focus guard is now `!input.contains(target)` — a press on a pill is a
    press IN the input.

### Mentions (الإشارات)
Typing `@` (at the start or after a space — an `@` mid-word is an email) opens
`#chat-mention-list` above the box: **online members only, closest first**, three rows
visible. Arrow keys and the **wheel step the highlight** (the wheel is `preventDefault`ed
and stepped, so Enter always picks what you see); Enter/Tab/a press picks; Escape closes
the picker for that `@` without closing the box.

- **Online is structural:** candidates come from `gameState.players`, which only ever
  holds `activeInGame` members (minus anyone mid-exit). A pill whose member left before
  send degrades to plain `@name`.
- **Search runs against the roster, not just the display name** (`_chatMenCandidates`):
  display name, roster `name`, `dbKey`, `telegramName`, slug match anywhere;
  `telegramHandle` and email match only from the start (a two-letter query would
  otherwise match half the inboxes). Arabic is folded by `_fireNormName`. So «الشعيرة»
  finds the member whose Discord name is "Mu". The row's second line shows the roster
  name — **never the email**. The Siraj ghost resolves through `bySlug.siraj`.
- **Wire format:** `{t:'chat',uid,m,s}` — `m` is the plain reading (`@name` text) for
  clients that predate mentions, `s` the segments `[{t}|{u,n,l}]`, sent only when there
  is a mention. `l` is the sender's **step** for that member. Still zero Firebase.
- **The step** (`_chatMen.last[uid] = {at, lv}`, sender-side): a repeat ping of the same
  member inside `CHAT_MEN_STREAK_MS` (10 s — wait longer and the count resets to step 1) climbs 1→2→3→4, and the one after 4 starts
  over. The mentioned member hears `mention_ping` at `CHAT_PING_STEPS` (deeper + louder
  each step) and **step 4 is `mention_alarm`**. Unlike the arrival cue, **nothing
  silences a ping** — no distance, no work session, no overlay. It's Web Audio
  (`playHandled`), so it sounds in a background tab.
- **The one-second rule:** pinging the same member again inside `CHAT_MEN_COOLDOWN_MS`
  refuses the WHOLE message — the box stays open with the text, shakes, flashes red
  (`.refuse`), plays a synthesised "uh-uh" (`_chatNoSound`, no file), and a toast counts
  the wait down live. The sender hears `chat_mention` on every send that pings someone.
- **A member in a work session can be pinged once a MINUTE** (`CHAT_MEN_WORK_COOLDOWN_MS`,
  `_chatMenIsWorking`): a pomodoro or free-mode WORK phase only — `isWorking && !isOnBreak
  && (isLockedIn || inFreeMode)`. Breaks, the couch, reading and minigames don't count
  (a minigame raises `isWorking` too, which is why the second half of that test exists).
  The toast says they're working. Since a minute outlasts the 10 s streak window, a
  working member never climbs past step 1 — they can't be alarmed. Sender-side only.
- **The loud bubble:** a message that is ONLY mentions shouts — iMessage's "loud"
  effect, a back-overshoot pop with a shaking tilt (`_chatLoudFx`, `CHAT_LOUD[step]`),
  harder each step, step 4 the biggest with a red glowing ring. It is a pure function of
  the bubble's age, so the PiP pass can draw it without advancing anything. Scaled about
  the bubble's bottom (it grows away from the head), tilted about its middle.
- **A bubble that mentions me ignores the distance fade**, and every mention bubble is
  ringed in the mentioned member's colour (`_chatMenColor`: their ring colour pushed
  light enough to read, else a stable hue off the uid).
- **System notification** (`_chatMentionNotify`) only when the tab isn't focused, only
  with permission already granted (asked once at entry — this never asks). Gendered by
  lobby (أشار إليك / أشارت إليكِ). `new Notification` first; Android Chrome throws on
  it, so the fallback is `registration.showNotification`, and `sw.js` has a
  `notificationclick` that focuses the tab. **Limit:** a tab the OS has frozen or killed
  has no socket, so it hears nothing — reaching that would need Web Push and a server.
- The picker's row cascade is deliberately **not** in `_JUICE_IN_ANIMS`: it re-opens on
  every `@`, and a rising sweep per keystroke is noise. It plays one blip on open and a
  tick per highlight step instead. Rows only animate on OPEN — narrowing the list while
  typing rebuilds them still (`.anim` off).

### Sanitising is done on BOTH ends
`_chatClean` strips control and **bidi-override** characters (an override scrambles the
whole line), collapses whitespace and caps at `CHAT_MAX_LEN`; `_chatCleanParts` does the
same per segment and re-checks every field of `s` (types, lengths, step clamped 1–4, the
50 shared across segments). It runs on send **and on receive** — a relayed payload is
data from another client and is never trusted to have been clamped. The `uid` in a relay
payload is client-claimed and spoofable, the same known limit the position relay already
carries — which also means a spoofed `l` could fake a step. Fine for the trusted group.

---

## Dismissing panels — the backdrop is a back button

Every laptop/reading modal closes on a **backdrop click**, not just its رجوع button:
`mode-select-modal`, `test-mode-modal`, `pomodoro-modal` (all in `setupModeSelectUI` /
`setupPomodoroUI`), plus `reading-modal` and `reading-newbook-modal`, which already had
it. The test is always `e.target === modal` — the click landed on the overlay itself,
not the card.

**The ghost-click guard has to cover the whole chain.** Every hop (world tap → mode
select → pomo settings → back) starts as a touch whose synthesized `click` arrives
~300ms later, and `juiceCloseThenOpen` only waits 230ms — so the *next* modal is
already up with its backdrop sitting under that stray click. `openLaptopModal(id)`
shows a modal **and** re-stamps `gameState._modeSelectOpenedAt`, so `modeSelectGhostClick()`
keeps swallowing it at every hop. Use it instead of a bare `classList.add('active')`
for anything in this chain.

**Sofas: clicking anywhere off the couch stands you up** (`handleClickOffSofa`, wired
into both the desktop click and mobile tap handlers right after the وقوف hit-test).
وقوف is a shortcut, not the only exit. `_clickIsOnMySofa` decides what counts as "on
the couch" — sofa1 is a vertical strip so its **X** is what matters (Y anywhere along
the run); the sofa2 spots are discrete seats, so it's a radius around the whole row.
It returns **true when it handled the click** so the caller stops: otherwise the same
click falls through and instantly re-seats the player on the sofa they just left. It
**never fires while reading** — the reading panel owns that exit and a stray click must
not end a timed session.

## Shared Pomodoro (Coop) System

> **COOP IS DISABLED FOR NOW (buggy).** `COOP_ENABLED = false` in `game.js`
> short-circuits `checkNearbyCoopSession()` so the proximity **"يعمل بمفرده — join"**
> card (`#sp-join-panel`) never shows and no join/invite flow is reachable. The whole
> shared-pomo machinery is still in the tree (invites, host promotion, coop anim) but
> is effectively unreachable through the UI. Don't wire the join card back on without
> fixing the underlying coop bugs — flip `COOP_ENABLED` to re-enable.

State machine at `gameState.sharedPomo.phase`: `'idle' | 'gathering' | 'guest-waiting' | 'active'`

### Key paths (via `spPath()`)
- `sharedPomo/sessions/{hostId}` — gathering/invite coordination (deleted after 12s)
- `sharedPomo/live/{hostId}` — active session live doc (participants, phase, time)
- `sharedPomo/invites/{uid}` — incoming invite for a user

### Host promotion (when host disconnects mid-session)
`setupSpLiveListener` detects `data === null` → calls `handleHostLeft()`. Remaining members sort UIDs deterministically → elect lexicographically-first as new host.

### Coop animation
`updateCoopAnimation()` only runs members still in `sp.activeGroupMembers`. Members who leave are removed via Set-filter in `setupSpLiveListener` and deleted from `sp.coopAnim.members`.

---

## Pomodoro Timer (per-laptop)

Firebase path: `lobbyPath('pomodoro/{laptopId}')` — written by host, read by all.

`startPomodoroPhase(phase)` handles `'work' | 'break' | 'end'`. Phase transitions fire audio cues and UI changes.

**Every session clock goes through `formatTime(sec)` / `formatTimeMs(ms)`** — mm:ss, rolling
into **h:mm:ss past an hour** (people work for hours; a flat `61:00` read as nonsense next to
`01:00`). This covers the HUD timers, the free-mode count-up, and the badges over other
players' heads. **Don't hand-roll `Math.floor(ms/60000)` + `padStart` at a new call site** —
that's exactly what had to be swept out. Write the big HUD timers with **`setTimerText(el, str)`**,
not `el.textContent`: it toggles a `.has-hours` class that shrinks the font (8rem → 5.6rem
desktop, 5.5 → 3.6rem mobile), because the 3-glyph-wider hour form runs off a phone otherwise.
Reading has its own equivalent (`_formatReadingClock`); the 3-minute azkar/prayer unlock
counters stay plain m:ss on purpose.

`updatePomodoro()` runs every frame — drives the countdown, phase transitions, and the focus mask/fog effects.

**Focus mask**: `drawFocusMask()` renders a dark vignette around the active laptop. Alpha driven by `gameState.focusAlpha` (lerped 0→1 on work start).

### Disconnect / session reclaim (the ghost-laptop system)
A laptop must **never** linger as a claimed-but-empty "ghost" (a timer floating over a laptop nobody is at, showing `هذا الجهاز تابع لـ …`). Two distinct causes, both fixed:

1. **Presence lost on a network blip** (the perennial bug — "there IS a user, working, but a ghost for everyone else"). Firebase fires the registered `onDisconnect` ops server-side the moment the socket drops (e.g. flaky mobile data), setting `activeInGame=false`. The socket silently reconnects, but presence was only set **once** at login, so `activeInGame` stayed false forever → observers never add the avatar to `gameState.players`, yet the laptop doc still shows the timer. **Fix:** a `.info/connected` listener (in `startGame`) re-asserts `activeInGame=true` **and re-arms** `onDisconnect(activeRef).set(false)` on **every** (re)connect, then calls `reassertActiveSessionAfterReconnect()`.

2. **User actually left** (closed tab / lost data for good). **Leaving the site does NOT end the session — only انهاء الجلسة does.** The laptop frees **immediately** for others (no ghost) and the player disappears, but the session is stashed for **12 hours** (`RECLAIM_WINDOW_MS`) and reclaimed on return. **الخروج behaves identically to a tab close** — it stashes rather than wipes, because it means "leave the site", not "end my session". Implemented with a unified per-session disconnect model (solo pomodoro **and** solo free mode; shared pomo is excluded — it has host-promotion):

| Helper | Role |
|---|---|
| `persistReclaimSnapshot()` | Writes a **live** snapshot to `dashboards/{uid}/profile/lastPomoSession` (see `dashProfilePath()` — private data, zero fan-out) with `abandonedAt: null`. Kept fresh so a disconnect only has to stamp the timestamp (no read-race on reload). |
| `armSessionDisconnect()` | `onDisconnect(laptop).remove()` (free it) + `onDisconnect(profile lastPomoSession/abandonedAt).set(serverTimestamp)`. Cancels the **previous** laptop's remove if we relocated. |
| `trackSessionForReclaim()` | persist + arm together. Called at pomo start, **every** `startPomodoroPhase`, free start, periodic `saveFreeModStateToFirebase` (15s; the lobby-visible laptop **doc** inside it is throttled to 45s — nobody reads the live timer from it), and at end of login restore. |
| `cancelSessionDisconnect(clearStash)` | Clean exit — cancels both handlers, optionally wipes the stash. Called from `exitPomoNow`, `endFreeMode`, natural completion (both work-end and break-end), and explicit `doLogout`. |
| `reassertActiveSessionAfterReconnect()` | After a silent reconnect: re-claim our laptop (or **relocate** to a free one via `_relocateActiveSession` if it was taken during the dropout), persist a fresh snapshot, re-arm. |

**Reclaim on login** (in `startGame`'s restore): only when `lastPomoSession.abandonedAt` is **set** (a live snapshot has it `null` → ignored) and within `RECLAIM_WINDOW_MS` (**12h**). **Prefers the original laptop** (`ls.laptopId` if free) else any free laptop; restores `mode==='free'` or pomo accordingly; seats the player at `laptop.sitX/sitY` and syncs position so all clients see them correctly on the new laptop. Stale (>12h) / no free device → discarded.

**A FREE session's clock keeps running while the tab is closed** — that's the whole point of the model. `_reclaimFreeTotalMs(ls)` = `ls.totalWorkMs + _freeAwayMs(ls)`, where the away time runs from **`ls.savedAt`**, a server stamp written by `persistReclaimSnapshot` *alongside* `totalWorkMs`. It is deliberately **not** `abandonedAt`: that lands up to one persist interval (15s) later, which would silently drop the gap between the last save and the actual disconnect. `_freeAwayMs` clamps to `[0, RECLAIM_WINDOW_MS]` (clock skew / an ancient stash) and falls back to `abandonedAt` for legacy stashes and for the ones `cleanupAbandonedPomoSessions` writes on another user's behalf (which now carries the original doc's `savedAt` for the same reason). The same credit is applied on the **reload** path where our own free doc is still on the laptop — there `savedAt` and `totalWorkMs` come from the *same device*, so it's a plain `Date.now()` diff, not `serverNow()`.

**Both free restore paths also set `fm.workMsAtLastBreak = <restored total>`** so the "خذ استراحة؟" prompt is measured from the resume. Without it a 6-hour away credit trips the 25-minute threshold on the first frame back.

**Pomodoro deliberately does NOT get this.** It counts DOWN in phases, so "the clock kept running" has no single answer past the end of a block — a reclaimed pomo still restarts its current phase with a fresh `endTime`, exactly as before. Only free mode's count-up accumulates away time.

**`cleanupAbandonedPomoSessions`'s free-mode `FREE_MODE_EXPIRY_MS` stays at 1 hour** and is NOT the session lifetime — it only hands the **seat** back when someone's `onDisconnect` never landed, so an absent user can't hold a laptop for 12h. `startGame`'s own copy of that constant is a different thing (it guards *our own* doc on reload) and is set to `RECLAIM_WINDOW_MS`.

**Pitfall (fixed):** never clear `lastPomoSession` to `null` and then arm only the `abandonedAt` child — a later disconnect then stamps a timestamp onto an empty object and the session is **lost**. Always re-**persist** a full live snapshot (`trackSessionForReclaim`), never `set(null)` while still in-session.

### The private profile node — `dashboards/{uid}/profile` (`dashProfilePath()`)
`focusMix`, `focusPlayer`, and `lastPomoSession` are **private** (only their owner ever reads them) yet used to live under `users/{uid}` — where every write fanned out to every client in both lobbies through the global `/users` listener, and where they inflated the initial `/users` snapshot everyone downloads at login. They now live under `dashboards/{uid}/profile` (nobody holds a live listener on `dashboards`; reads are one-shot `get()`s in `startGame`). A one-time migration in `startGame` copies any legacy values over and nulls the old keys. **Any NEW per-user private state that gets written more than ~once a day belongs here, not under `users/{uid}`.** Siraj ghosts self-clean (their whole `dashboards` node is removed on disconnect).

---

## Firebase Sync Patterns

```js
// Write (always use update, not set, unless replacing entire subtree)
update(ref(database), { 'path/to/key': value });

// Read once
get(ref(database, path)).then(snap => snap.val());

// Live listener (returns unsubscribe function)
const unsub = onValue(ref(database, path), snap => { ... });

// Cleanup on disconnect
onDisconnect(ref(database, path)).remove();
```

**Always store the unsubscribe function** and call it on cleanup — leaking listeners causes double-updates and ghost data.

---

## Firebase Cost Rules — DEFAULT TO THE CHEAPEST OPTION (10GB/mo download cap)

> Firebase Realtime Database bills **downloads** (data sent to clients), and the free tier caps at **10GB/month**. The download cost of a piece of data is roughly **(bytes that changed) × (number of clients listening at that path) × (how often it changes)**. Every `onValue` listener is a tap that streams to that client; every write fans out a download to *every* client listening to that path. **When adding any feature, pick the option that minimizes that product.** If two designs work, choose the one that downloads less — even if it's slightly more code.

**The decision checklist for any new feature that touches Firebase:**

1. **Does this even need Firebase?** If the data is high-frequency and ephemeral (live positions, cursor, typing, transient animation state), use the **WebSocket relay** (`presence-server/`, `sendPositionWS`), **not** Firebase. Firebase is only for state that must *persist* (survive reload / be seen by late joiners). Per-frame or per-second writes must never go to Firebase.

2. **Scope the listener as narrowly as possible.** Listen at `lobbyPath(...)` or a single child (`users/{uid}/foo`), never at a broad node like `/users` if you can avoid it — a broad listener downloads *every* child's changes (including the other lobby's). Prefer `get()` (one-time read) over `onValue` when you only need the value once (login restore, a count, a snapshot). Reserve `onValue` for data that genuinely must update live.

3. **Always store the unsub and tear it down** when the feature closes / the user logs out / leaves the screen. A listener left attached keeps downloading for the rest of the session. (Bug we hit: the welcome-screen `/users` listener was never detached, so every in-game client streamed the entire global users node — both lobbies — forever. Fixed via `gameState._userSelectionUnsub`.)

4. **Keep frequently-changing docs small; split out big/static fields.** Don't bundle large or rarely-changing data (avatars/data-URLs, long text, blobs) into a doc that also holds fields written often (x/y/flags) — every small change re-streams the whole child to every listener. Store big static data under its own key, written once. Never store base64/data-URL images in a doc that's in a live listener's path.

5. **Compute locally instead of syncing.** Anything a client can derive on its own (a countdown from a single `endTime`, progress from `spawnTime`, elapsed from `workStartTime`) must be written **once** and computed per-frame locally — never streamed tick-by-tick. This is why the pomodoro doc only changes at phase transitions.

6. **Don't re-write unchanged values in a loop.** RTDB suppresses no-op `value` events, but only if the value is *byte-identical*. Heartbeats that re-assert the same value are fine; heartbeats that recompute a slightly-different number every tick will fan out a download every tick.

7. **Write with `update()` (multi-path) not many `set()`s**, and write only the fields that changed — fewer/smaller writes = fewer/smaller downloads for everyone listening.

**When in doubt, measure the fan-out:** ask "how many clients are listening to this path, and how often will this change?" If the answer is "everyone in the lobby, several times a second," redesign it (relay, local compute, or narrower scope) before shipping.

---

## Prayer System

`initPrayerSystem()` → `fetchPrayerTimes()` (calls Adhan API) → schedules `checkPrayerTrigger()` to run each minute. On trigger: `triggerPrayerOverlay()` plays adhan sound + rain particles + full-screen overlay.

**Priority**: Prayer overlay takes priority over azkar. `triggerPrayerOverlay()` calls `closeAzkarOverlay(false)` first.

Prayer location stored in localStorage (`mdwnh_prayer_location`).

**Privacy — never persist exact lat/lon.** Firebase `users/{uid}/prayerLocation` stores **city + country only** (write with `set()` to replace, not `update()`). Auto-detected/curated coords live in-memory (`loc._lat/_lon`) for the session; legacy coords are scrubbed on login.

**Offline fallback (API can be blocked by VPN/ISP).** `fetchPrayerTimes()`: resolve coords (in-memory, else match `PRAYER_LOCATIONS` by city+country) → try `api.aladhan.com` with an **8s `AbortController`** → on any failure **compute locally** via `computePrayerTimesLocal()` (self-contained, method=5: Fajr 19.5°, Isha 17.5°, Asr factor 1; uses the device UTC offset so DST is correct; verified within ~1 min of the API). Retry in 20s only if there were no coords at all.

**Overlay layout** (`.prayer-overlay-content`): a centred glass card — icon, name, subtitle (`حيَّ على الصلاة، حيَّ على الفلاح`), then a `.prayer-overlay-actions` column with the primary dismiss button (`#prayer-overlay-btn`, locked for `prayerLockMs`) and a secondary `#prayer-azkar-btn` ("قراءة أذكار الصلاة؟") that opens the after-prayer azkar on top (see Azkar System). Keep the gorgeous per-prayer backgrounds (`.prayer-overlay-bg` gradients) untouched — only the content card was redesigned.

---

## Minigame Architecture

> **Entry = the games table** (`Workspace_0006`, break room, bottom-left). Three zones
> (`GAME_RACE_ZONE` / `GAME_COFFEE_ZONE` / `GAME_BOSS_ZONE`), floor 1, break-time only.
> Race + fig route through a shared host/ready lobby (`joinOrCreateMinigameLobby` →
> `#race-panel`); laptop-boss is solo (confirm modal → straight in).
>
> **`MINIGAMES_ENABLED` gates the three session listeners** (`listenToRace` /
> `listenToCoffee` / `listenToLaptopBoss`) and the idle race-track preload. It must
> stay **true** for entry to work: without those listeners a zone press writes a lobby
> session to Firebase that nobody ever reads back, so the sound plays and no panel
> ever appears — that exact bug shipped once. The OLD break-room teleport zones
> (`RACE_ZONE_RECT` & co) are separately dead behind `MINIGAME_LEGACY_ZONES` (false);
> their rects are at coordinates the new world doesn't have.

**Gender separation**: All minigame paths go through `lobbyPath()` — male/female never share sessions.

**Ready-sync protocol** (both games):
1. Host creates session with `startTime: 0`
2. Each client writes `participants/{uid}/ready: serverNow()` when entering
3. Host waits for all `ready`, then sets `startTime = serverNow() + 3500`
4. **Do NOT use a small offset** — clients need the full 3.5s window for 3-2-1 countdown

### Laptop-boss art
`LaptopBG.png` (background) → `Laptop Ground.png` → boss + player → **`Laptop Overlay.png` on top of everything**, drawn after the shake transform pops but *before* the countdown/results/teleport screens (those must stay readable over it). The laptop and the player carry a light warm wash (`_BOSS_WARM`) to sit in the art: **baked once per sheet into a cached canvas** (`_warmSheet`, keyed off the `<img>` in a WeakMap), never a per-frame `ctx.filter` — live canvas filters take a slow path on mobile GPUs, same reason `_tintedAvatar` exists. The player's wash is just a fill inside its already-clipped avatar circle.

### Race minigame
Track is built from image pixel classification (`classifyRacePixel`); the 6 MB track PNG is **lazy-loaded** (`loadRaceTrackAsset()` — idempotent; idle after spawn + ensured on race entry). Physics: friction zones on/off-track. Camera rotates on mobile to always show car heading "up".

**Car sync rides the WebSocket relay, NOT Firebase.** `syncRaceCar` sends `{t:'car', cuid, k:sessionKey, x,y,a,s,d,l,f,u}` over the presence socket ~11×/sec (`sendRaceCarWS`); `onRaceCarWS` merges it into `session.cars` (the same struct `updateRaceCarVisuals` lerps from). Firebase gets a **1s authoritative fallback** write (4/sec if the socket is down) so relay-less clients still see a working, choppier race. The field is `cuid` (not `uid`) on purpose so older clients drop the message instead of mistaking it for an avatar position. `listenToRace` keeps WS-fresh car positions when a fallback snapshot arrives (same anti-snap idea as avatars, `race._carWsAt`). **Never restore the old 90ms Firebase car writes** — every client in the lobby live-listens to the sessions node, so that was the app's most expensive Firebase pattern.

### Fig minigame (لعبة التين — was the coffee game)
Figs fall from the top into a bowl held in two hands. `progress = (serverNow() - spawnTime) / fallDuration` — computed by all clients independently. First writer wins the catch. `fig.png` = +1, `Bad fig.png` (14% chance) = −3, `Golden Fig.png` = +3.

**The internal names are still `coffee`** — the Firebase paths, `gameState.coffee`, `renderCoffee`, `COFFEE_*`, `sugars/{id}`, `localMug`. Only the art and the Arabic labels changed; renaming the tree would break every in-flight session doc for no gain.

**Art is drawn from tight source rects** (`HANDS_SRC` / `FIG_SRC` / `BAD_FIG_SRC` / `BUBBLE_SRC`, same idea as `BOOK_SRC`) — every PNG is a 1000×1000 canvas with the art floating in the middle, so drawing the whole image makes the sprite ~30% of its box and it reads as a speck.

**The bowl is TWO layers with the pile between them**: `Hands.png` (back half + hands) → `drawCoffeeFigPile` → `Hands Foreground.png` (front wall) on top. Both crop from **the same `HANDS_SRC` rect** — a different rect per layer drifts the two halves apart. Every catch pushes its type onto `mug.figs`, so a bad/golden one really shows up in the pile.

- The pile is a **golden-angle spiral inside a shallow ellipse** (`COFFEE_PILE_*`), which fills evenly outward from the centre (grows with every catch, no row-jumping) and **shrinks each fig as the bowl crowds** so they always fit.
- The visible fig window is the **lens between `Hands.png`'s rim and the front wall's top edge** — narrow. That's why the ellipse sits high (`COFFEE_PILE_CY = 0.16`) and shallow. Figs near its edges tuck behind the wall on purpose (reads as depth).
- `COFFEE_MUG_Y_FRAC` is the **rim line** — where figs land, and the catch line. The hands box is centred *below* it (`coffeeHandsCY`), because the rim is near the top of `HANDS_SRC`.
- `coffeeHandsSize(W,H)` clamps the drawn width against **both** axes, so a landscape phone can't push the bowl off the bottom. The catch hitbox is a **fraction of the drawn width** (`COFFEE_CATCH_FRAC`) for the same reason.

**Golden fig**: 1–3 per match (`goldTarget`, host-only), never within `COFFEE_GOLD_MIN_GAP_MS` (8s) of the last golden **spawn**, falls 3× faster, +3 pts, and plays the normal collect cue at `playbackRate` 1.7.

**Bubbles** (`_newCoffeeBubble`) drift up from below the screen to above it, wobbling sideways, alpha 0.3–0.7. **Seeded across the full height at match start** so the screen already has bubbles on frame one instead of filling in from the bottom.

**Session lifetime rule**: `returnFromCoffee()` and `returnFromRace()` MUST write `null` to the session path. Forgetting this causes "can't play again" bugs.

**Siraj ghost cleanup**: If `gameState.isSirajGhost`, set `onDisconnect` + 90s `setTimeout` to force-delete any minigame session the ghost created.

---

## Rendering Pipeline

`render()` each frame (see **The World** for the full order):
1. `drawWorldGround` — cached ground layers (bg/walls/furniture/stairs/games)
2. `drawPlayers(false, 1)` + `drawTimers(1)` — ground-floor avatars & badges
3. `drawSecondFloor` — mezzanine layers at `secondFloorVis`
4. `drawPlayers(false, 2)` + `drawTimers(2)` — mezzanine avatars & badges
5. `drawDayOverlays` — day-lighting overlays (one normal, one `overlay`-blend)
6. `drawFocusMask` — dark vignette around the active laptop (also draws the laptop prompt)
7. `drawWindParticles`, `drawFocusFog`, `drawCloudShadows`, `drawVignette` — screen-space FX

`drawPlayers(onlyLocal, floorFilter)` and `drawTimers(floorFilter)` take a floor filter
so ground avatars render **below** the mezzanine and floor-2 avatars **above** it (and
fade with it). `drawCoopGroupLabels` still runs in the world pass.

**DPR scaling**: Canvas is `viewport * dpr` physical, `viewport` CSS. All drawing uses `ctx.scale(dpr, dpr)` so use logical pixels everywhere. `gameState.dpr` holds the ratio.

---

## Graphics Tiers & Mobile Performance

Stored in `localStorage[SETTINGS_GRAPHICS_KEY]` as `'high' | 'low' | 'potato'`, or **absent = device-auto** (`graphicsTier()` → mobile `'low'`, desktop `'high'`). The settings toggle cycles only the three explicit tiers (عالية → متوسطة → بطاطس) — there is **no `'auto'` value/button** (it confused users: on a phone "auto" already = low, so the press looked like a no-op). The loop caches `gameState._lowGfx/_potato/_disableIdleAnim/_hideNames` and re-reads localStorage only **once per second** (the settings toggles zero `gameState._settingsFlagsAt` so a change still applies next frame); hot draw code reads those flags (never call the helpers per-draw — they hit localStorage).

| Helper | Meaning |
|---|---|
| `isReducedGraphics()` | `low` **or** `potato` (mobile default). Gates the **cheap-but-huge compositing wins** that don't change the art. |
| `isPotato()` (بطاطس) | most aggressive; **additionally** drops the atmosphere gradients. For very weak phones. |
| `isLowGraphics()` | back-compat alias of `isReducedGraphics()`. |

**Reduced (low + potato)** applies: DPR cap (`Math.min(dpr, 1.5)`, potato `1.25`) in `resizeCanvas`; **no `backdrop-filter`** on `body.is-mobile` (a blurred panel over the 60fps canvas re-rasterizes its backdrop *every frame* — the #1 mobile killer, and the "css rebuilding" users perceive); canvas shadows clamped to 0 via `installLowGfxShadowGuard(ctx)` (intercepts the `shadowBlur` setter — `ctx.shadowBlur` is a per-draw Gaussian blur used ~20×/frame); fewer wind particles; **static cached `drawFocusFog`** (the animated fog is 3 full-screen gradient fills rebuilt per frame — the heaviest in-session cost on phones); **half-resolution focus mask** (soft gradients — the upscale is invisible, the fill cost drops 4×); **no live `ctx.filter` on avatars** (pre-tinted copies via `_tintedAvatar` instead — live canvas filters force a slow path on mobile GPUs).

**Potato-only** (gated on `gameState._potato`): `drawSunRays`, the parallax `drawBackgroundAtmosphere`, and ambient motes all fall back to cheap/no versions. So **low looks close to desktop** (gradients on) while keeping the compositing wins.

### Effect overrides (particles / overlays) — these BEAT the tier
`SETTINGS_PARTICLES_KEY` / `SETTINGS_OVERLAYS_KEY` are tri-state: **absent = follow the
tier** (the historical behaviour: both auto-drop only on بطاطس), `'on'` = force ON even on
بطاطس, `'off'` = force OFF even on عالية. Resolved by `particlesEnabled()` /
`overlaysEnabled()` and **cached per-frame as `gameState._particlesOn` / `_overlaysOn`** —
hot draw code must read the flags, never the getters (they hit localStorage). Every gate
that used to read `gameState._potato` now reads these:
- **particles**: `drawWindParticles`, `drawAmbientMotes`, `drawDustParticles`
- **overlays**: `drawDayOverlays`, `drawSunRays`, `drawCloudShadows` (+`updateCloudShadows`),
  `drawFocusFog`, `drawSecondFloorFog`, `drawBackgroundAtmosphere`, `drawVignette`

`drawFocusMask` is deliberately NOT gated — it's functional (it's what dims the room around
the active laptop), not decoration.

**All-tier render costs are cached, never rebuilt per frame**: atmosphere/sun gradient objects are cached per canvas size on the ctx (`ctx._atmoCache/_sunCache` — parallax applied via `ctx.translate`, visually identical, and PiP's own ctx keeps its own cache), and `drawFocusMask` skips its offscreen re-render entirely when nothing moved (`gameState._maskKey` — the common seated-in-session case).

**Sound:** boss-fight SFX (15 files, only used in that minigame) are deferred to `requestIdleCallback` (`ensureBossSounds()`, also force-loaded on boss-fight entry) so they don't compete during cold-start.

Never animate `filter: blur()` or `transform: scale()`/`background-position` on full-screen/always-visible elements — they repaint every frame and flicker on weak GPUs. Keep such effects static.

---

## Settings Panel (`setupSettingsUI`, `#settings-panel`)

Opens **under the gear button**, which now lives in `#hud-tools` to the left of the user card — so the panel's `top`/`right` are **written by `_hudPositionSettings()` from that box** at open time, overriding the CSS fallbacks (`top:130px; right:18px` desktop, `right:10px; top:110px` mobile). See **The HUD stack**. Each row is a binary toggle button reflected via a `_reflect*()` helper and persisted in localStorage. Rows are grouped into **categories** (`.settings-category` + `.settings-category-title` header): العرض والأداء / التحكم والعمل / الأذكار والصلاة. Keys & defaults:

| Key | Default | Effect |
|---|---|---|
| `SETTINGS_GRAPHICS_KEY` | device-auto | عالية → منخفضة → بطاطس (see Graphics Tiers) |
| `SETTINGS_NAMES_KEY` | show | hide player names above avatars |
| `SETTINGS_JOYSTICK_KEY` | auto | show/hide the on-screen joystick |
| `SETTINGS_NOIDLE_KEY` | off (`getDisableIdleAnim()`) | when **on**, freeze the local avatar's animation while working |
| `SETTINGS_AZKAR_RANDOM_KEY` | off (`getRandomizeAzkar()`) | when **on**, shuffle morning/evening azkar order each open |
| `SETTINGS_LEMO_KEY` | show (`getHideLemo()`) | ليمو — hide the robot entirely (freezes him; see **Lemo**) |
| `SETTINGS_PARTICLES_KEY` | absent = follow tier | الجسيمات — tri-state **تلقائي → مفعّلة → مغلقة**. **Overrides the graphics tier** (see Graphics Tiers → Effect overrides) |
| `SETTINGS_OVERLAYS_KEY` | absent = follow tier | الطبقات الجوية — tri-state, same override semantics |
| `SETTINGS_LONGFREE_KEY` | absent = بعد ٣٠ دقيقة | تأكيد مدة الجلسة الحرة — tri-state **مغلق → بعد ٣٠ دقيقة → دائمًا** (`getLongFreeMode()`). Gates the free-mode idle-confirm via `shouldAskLongFreeConfirm()`; the user's `off` beats even the Siraj always-ask |
| `SETTINGS_PRAYER_DELAY_KEY` | off (`getPrayerJamaahDelay()`) | "صلاة الجماعة" — when **on**, adds **+5 min** to every prayer time (`prayerJamaahExtraMin()`, applied in `computeNextPrayer`/`updatePrayerPanelDOM`). **Per-USER, not per-device**: source of truth is Firebase `users/{uid}/prayerJamaahDelay`, read on login and **mirrored into localStorage** so the getter stays a cheap sync read; the toggle writes both. |

### Open / close animation
Open removes `.hidden` (the `settingsPanelIn` keyframe pops it in). Close is **animated, not a snap**: `closeSettingsPanel()` adds `.settings-panel-closing` (runs `settingsPanelOut`), then `.hidden` after ~230 ms. All three close paths (close button, gear re-press, outside-click) go through it. **Closing makes no sound** (see below).

### Sequenced rows + the cascade blip (sound)
`@keyframes settingsRowIn` lives in **style.css** (scoped `.settings-panel:not(.hidden):not(.settings-panel-closing) …` so it replays on every open). It fades **and** slides, but the fade lives **entirely inside the keyframes** with **`animation-fill-mode: backwards`** — the rows' own base style stays `opacity: 1`. In Firefox the sequence could fail to trigger at all, and an `opacity: 0` **base** then left the entire panel blank (same failure the pomodoro `.setting-group` rows had); with `backwards`, a skipped animation falls back to the visible base. **Never re-add an `opacity: 0` base, and never use `both`** (it pins the 100% keyframe forever). Same treatment on `settingGroupIn` and `readingRowIn`. The **`animation-delay`s are assigned in JS**: `_settingsSequenceRows()` indexes `.settings-category-title, .settings-row` in DOM order on every open. They used to be a hardcoded nth-child list in CSS that only covered the **first two rows of each category** — every row added after that inherited the base rule with **no delay** and popped in instantly, ahead of the cascade. **Don't move the delays back into CSS**: the next row added would silently break the sequence again. Do **not** re-add the old `juiceRowIn` settings rule in juice.css either — it double-animates and fights the stagger.

### Avatar working animation (`drawPlayers`, the `suppressWorkAnim` block)
Two independent suppressions, both gated on `localInWorkPhase()` (pomodoro **or** free-mode work):
- **My own avatar** — if `SETTINGS_NOIDLE_KEY` is on, freeze **both** the working bounce **and** the idle breathing while I'm in any work phase. NB the per-avatar `isWorking` flag only tracks pomodoro, so the suppression uses `localInWorkPhase()` (which also covers free mode) — otherwise free-mode users kept breathing. The flag is cached per-frame as `gameState._disableIdleAnim` (the getter hits localStorage; never read it per-draw).
- **Other players' working bounce** — always hidden while *I'm* in a work phase. I only see their bounce when I'm idle / on break / not in a session.

### End-break button (`#end-break-btn`, `endBreakEarly()`)
"إنهاء الاستراحة" — a child of `#leave-wrap`, shown by `updatePomoLeaveBtn` only when `isBreakActive() && !isMinigameActive() && sharedPomo.phase !== 'active'` (solo pomo or free-mode break; shared pomo is host-synchronized so it's excluded). Ends the break early into the normal comeback-to-work sequence: free mode calls `endFreeModeBreak()`; solo pomo just sets `pomodoro.endTime = Date.now()` so `updatePomodoro`'s natural break-end transition (writes the `wait` doc → 2 s → kidnap) fires next frame.

---

## Sequenced UI Sounds (the cascade "blip") — `setupJuiceUi`, `_uiSeqRate`

When a panel's elements animate in **one-by-one** (a staggered/sequenced entrance), the matching sound is a **pitch sweep**: the **first** element to appear plays the **deepest (heaviest) pitch**, and each following element steps **up** in pitch, so the **last** element to appear is the **highest**. The starting pitch is **randomised per cascade** (so two opens never sound identical). This is the house style for sequenced UI — match it for any new sequenced panel that should be audible.

**How it's wired (don't reinvent it):**
- A single capture-phase `animationstart` listener (in `setupJuiceUi`) fires one blip per element **as it pops in**. It only reacts to animation **names** in the `_JUICE_IN_ANIMS` set (`juicePop`, `juiceContainerPop`, `juiceRowIn`, `settingsRowIn`). The pitch comes from `_uiSeqRate()`: a gap >240 ms (or an explicit `_uiSeqReset()`) starts a **fresh** sweep (`idx=0`, `base = 0.78 + random*0.16`); each blip within the window does `idx++` and returns `base + min(idx,12)*0.055` (rising). `_playUiBlip(rate)` plays `uiBlip` through the focus engine (`playPitched`).
- **Sound is opt-in by animation name, not automatic.** Sequenced elements are silent unless their keyframe name is in `_JUICE_IN_ANIMS`. To give a NEW sequenced panel the cascade: name its row keyframe and **add that name to `_JUICE_IN_ANIMS`** (that's all settings needed — `settingsRowIn`). To keep a sequenced panel **silent**, just don't register its animation name (and `_JUICE_SILENT_SEL` force-mutes specific elements even if they use a sounded name).
- **Start each panel's sweep fresh:** call `_uiSeqReset()` when the panel opens (e.g. `openSettingsPanel`) so its first row is reliably the deepest, regardless of any recent blip.
- **Closing must be silent.** Pop-**out**/close keyframes (`settingsPanelOut`, `juicePopOut`, …) are **not** in `_JUICE_IN_ANIMS`, so a close never blips. Never add a close/out animation name to that set.

---

## Player Position Sync

### Live movement runs over a WebSocket relay (not Firebase)
High-frequency walking used to write `x/y` to Firebase **every animation frame** — wasteful (counts against the 10GB/month download cap) and laggy with several players. Live positions now go over a tiny **Cloudflare Worker + Durable Object** relay instead; Firebase stays the source of truth for everything that must persist.

- **Server**: [`presence-server/`](presence-server/) — a stateless relay. One Durable Object = one lobby room (keyed by `gameState.selectedLobby`, so male/female never mix). It forwards each position payload to the other sockets in the room and stores nothing; on disconnect it sends `{t:'bye',uid}`. Deploy with `npx wrangler deploy`. URL: `wss://mdwnh-presence.yosefbore3y.workers.dev/lobby/<lobby>?uid=<uid>`. Free tier bills incoming WS messages 20:1 → ~2M msgs/day free.
- **Client** (`game.js`, the "Live position relay" block above `updatePlayerPosition`): `ensurePresenceSocket()` opens/heals the socket (called from `startGame`, the 10s presence heartbeat, and `_resyncPresence`). `sendPositionWS(x,y,force)` sends `{uid,x,y,m,s,fl,w}` throttled to ~11/sec (`w` = the **sender's own `performance.now()`** — see the jitter buffer below; it also force-sends on a movement **start**, on a **stop**, and on a **heading change >≈37°**, so a turn isn't corner-cut across a whole interval). `onPresenceMessage()` feeds others' positions into a per-player **interpolation buffer** (`pushNetSample`). `disconnectPresenceSocket()` on logout. Auto-reconnects on close (2s backoff).
- **Smooth movement = a jitter buffer, built the way competitive shooters build one** (`pushNetSample` / `interpolateRemoteFromBuffer`, in the entity-helpers block; per-player state on `player._netBuf` + `player._netClock`). Each remote player is rendered `delay` ms **in the past**, gliding between the two buffered samples bracketing that render time. Three things make it hold up on a bad link, and all three are load-bearing:
  1. **Samples are stamped with the SENDER's clock (`w`), never with arrival time.** Each packet carries the sender's `performance.now()`; the receiver keeps a per-player offset (sender clock → local clock) estimated by a **minimum filter** — the fastest packet seen defines the true send time, later ones are simply late (a faster path snaps the offset down instantly, otherwise it creeps at `NET_OFF_CREEP` to follow drift). Samples are therefore spaced by when they were **sent** — a clean, even 90 ms — so jitter can no longer deform the replayed motion. `w` is monotonic with an **arbitrary per-tab epoch**; the offset absorbs the epoch, so this needs no wall clock, no `serverNow()`, and **no server change** (the Worker forwards raw bytes). Arrival-stamping is what the old version did, and it fed jitter straight into the timeline: a burst of three packets 5 ms apart replayed as the avatar sprinting, then stalling. Measured in a replay harness, 5–250 ms of jitter made the old buffer render **30 world units per frame on average (6× true walk speed) with single-frame jumps of 648**; sender-stamped it is **5.00/frame, max 5.43** — i.e. exact.
  2. **`delay` is ADAPTIVE, not a fixed 140 ms.** 140 tolerated only ~50 ms of jitter before running dry — that was "sometimes smooth, sometimes jumping". It now tracks a jitter EWMA (**fast attack `NET_JIT_ATTACK`, slow decay `NET_JIT_DECAY`** — one good packet proves nothing) plus the sender's real packet spacing (`n.gap × NET_GAP_MULT`, which covers a phone whose rAF is throttled), clamped to `[NET_DELAY_MIN 130, NET_DELAY_MAX 520]`. It **grows instantly and shrinks slowly**, and actually running dry credits `NET_STARVE_BUMP` of jitter — a starve *is* the measurement that the delay was too small. A bad link buys latency instead of breaking; a clean one sits at 130 (≈177 ms end-to-end, slightly **better** than the old fixed 140 path).
  3. **Error smoothing — the failsafe that makes a jump impossible.** Any time the timeline must discontinue (the stream resumed after `NET_IDLE_GAP`, or a starve resynced and extrapolation had guessed wrong) the avatar is **not moved**. The positional error is recorded (`n.errX/errY`) and bled off, exponentially **but rate-capped at `NET_ERR_MAX_STEP` (3.2 units/frame, vs a 5-unit walk)** — an uncapped exponential sheds ~14% on the first frame, which for a large error *is* the jump. Only a genuine teleport (further than `NET_SMOOTH_MAX`, 300 units — kidnap, reclaim, a seat) snaps.
  Two smaller pieces: a starved buffer **coasts with the velocity easing to zero** over `NET_EXTRAP_MS` (the old version ran flat out then clamped dead, which was the visible half of the jump) and stops the walk cycle once fully coasted; and a **bloat guard** winds playback forward 6 ms/frame when it trails the newest sample by more than `delay + NET_BLOAT_MS`, so a backlog can't leave someone permanently behind. **Animation flags (`m`/`s`) ride in the sample and are applied at PLAYBACK time**, not on arrival — otherwise a remote walk cycle stopped a whole interpolation delay before the avatar did. And while playback hasn't reached the first sample (the buffer refilling after someone stood still) the avatar is **held, so its walk flag is forced off** — reading the first packet's `m` there started the legs a whole delay before the body moved. Jitter also **decays over time** (`NET_JIT_HALFLIFE`, 5 s) — **but only while the stream is silent** (`n.lastRecv` older than `NET_IDLE_GAP`): nothing arrives while someone stands still, so without it a spike from minutes ago kept their next walk-off late. Decaying it during a walk too was tried and regressed the periodic-spike case (worst frame 8.8 → 34): it bled the delay off between spikes and set up the next starve.
  **Two more things made a GOOD link still look faintly rougher than your own avatar**, and both are fixed:
  4. **The replay runs on the FRAME's clock** (`_netFrameNow()` = the rAF timestamp, published as `gameState._frameT` at the top of `gameLoop`). The local player moves by rAF-timestamp deltas — an exactly even step per displayed frame. Remotes were rendered at `performance.now()` read mid-frame, i.e. shifted by however long the work before `updatePlayerRenderPositions` took that frame: 12 ms of motion one frame, 21 the next, a faint stutter beside the even local walk. The sender stamps `w` from the same clock (the position IS this frame's), and so does the sofa hop on both ends. **Arrivals stay on `performance.now()`** (`pushNetSample`) — that is when a packet really landed. The helper falls back to `performance.now()` when no frame ran recently or a browser's rAF timestamp isn't on that timeline.
  5. **Samples are joined by a MONOTONE cubic, not straight lines** (`_netCurve` / `_netSlope`, Fritsch–Carlson per axis). ~11 packets a second with straight lines between them put a corner at every sample: every turn and speed ramp replayed as a polygon. The monotone slope is zero wherever the motion pauses or reverses, so the curve never overshoots a sample — **don't swap it for Catmull-Rom**, which does, and turns every stop into a rubber band past the spot and back. At a buffer end the missing neighbour falls back to the secant, which is exactly the old straight line.
  Positions also go out to a **tenth of a unit** (`Math.round(x * 10) / 10`): whole-unit rounding moved each sample up to half a unit, a few-percent speed wobble between ~27-unit segments.
  `updatePlayerRenderPositions` uses this for remotes and falls back to the plain lerp only before the first sample. **The buffer is fed by BOTH the WebSocket and the Firebase users listener** (Firebase samples carry no `w`, so they're arrival-stamped — correct, just without the jitter immunity), so seating/teleport/kidnap/fallback all stay smooth and never freeze. Setting `player._netBuf = null` is the **hard reset**: those call sites place the avatar themselves, so the next sample snaps rather than gliding.
- **Anti-snap (the "friend snapping places" bug), three distinct causes — all fixed:**
  1. **Stale Firebase write polluting the buffer.** Firebase position writes (the 4s session heartbeat, stop writes) carry a slightly-OLD position but a fresh timestamp; appended as the newest buffer sample they yank the avatar backward, then the next WebSocket packet snaps it forward. Worst during a **break** (a walking friend still has `pomodoro.active`, so their heartbeat fires while WS also streams). **Fix:** `onPresenceMessage` stamps `player._lastWsSampleAt`; the Firebase users listener only `pushNetSample`s when WS has been quiet >1s (still sets the authoritative `.x/.y` always). WS owns smoothness; Firebase is the fallback only.
  2. **WebSocket starve → forward jump.** The relay is WS-over-TCP, so a "lost" packet is really a **delayed burst**. While starved the avatar extrapolated then clamped; when the burst landed it jumped forward to catch up. **Fix:** the error smoothing above — a resync after a starve is absorbed as a decaying offset, never a move.
  3. **Jitter replayed as motion.** Arrival-stamped samples made the *spacing* of the packets part of the animation, so a jittery link literally played the avatar at the wrong speed segment to segment. **Fix:** sender timestamps + the clock offset (1 above). This was the big one and the reason it felt "sometimes smooth".
- **`handleMovement`**: per-frame walk → `sendPositionWS()` (WebSocket). On **stop** → a forced `sendPositionWS()` (instant anim stop for others) **plus** `updatePlayerPosition()` (one Firebase write to persist last-known position for late joiners / spawn / reclaim).
- **Fallback**: if the socket is down, the periodic Firebase writes (stop + heartbeats) still drive observers via the users listener's `setEntityTarget` — nobody freezes, just less smooth until it reconnects.
- **The sofa hop rides the relay as an EVENT** (`sendSitWS` / `startRemoteSitAnim` / `updateRemoteSitAnims`). `handleMovement` bails while seated, so no position packets go out during the ~0.64s sit/stand animation — the only thing observers ever got was the Firebase write at the end, which read as a **teleport onto the cushion**. It's one-off, not a stream, so it's a single `{t:'sit',uid,d,sx,sy,tx,ty}` message and every client replays it with **the same stepper** (`_stepSitAnim` is pure: it advances the anim struct and returns a position, touching no player and no Firebase — that's what lets local and remote share it). While a remote's `_sitAnim` is live it **owns that avatar**: `updatePlayerRenderPositions` skips them, the interpolation buffer is dropped, and `drawPlayers` reads the squash/stretch off `player._sitAnim`. Socket down → remotes fall back to the old Firebase-driven glide. The relay forwards raw bytes without parsing, so **no server change was needed**.
  - **The hop is QUEUED onto the replay timeline, never played on arrival** (`_sitQueue` → `_beginRemoteSitAnim`). Remote avatars are drawn `delay` ms in the past, so starting the hop the instant the message landed put it *ahead* of the replay: the avatar snapped forward to the sofa, skipping the end of its walk, and then hopped. The sit message carries the sender's `w` like a position packet; `updateRemoteSitAnims` fires it once `now − delay ≥ w + offset` (checked against the **live** delay each frame), with a `SIT_QUEUE_MAX_MS` deadline as a failsafe and one hop at a time so sit-then-stand plays both in order.
  - **The hop starts from the avatar's own on-screen spot** when it is within `SIT_ADOPT_R` of the sender's start — by then the replay has walked it there, and any leftover gap must not show as a snap.
  - **At hop end the buffer is KEPT, not dropped**, if packets arrived during it (someone walking off the moment they land) — `n.resync` lets the continuity guard glide from the landing spot. Dropping them started a fresh buffer down the path: a snap right after standing.
  - The book prop's remote `seated` test also waits on a non-empty `_sitQueue`, or the seat's Firebase write would slide the book out before the queued hop has even started.
- **Known limit (experiment)**: position `uid` is client-claimed (spoofable). Fine for the trusted friend group; revisit if going fully public.

`updatePlayerPosition(x, y)` writes `users/{uid}/{x,y,isMoving,isWorking,…}` together (atomic). Still called on **stop**, every frame during the kidnap animation, at the end of `startPomodoroPhase`, on session restore, and via a **4s heartbeat** in the game loop while locked-in/in a session — but **no longer per-frame while walking** (that's the WebSocket's job now).

**Pitfall — never use `!userData.x` to detect "no position":** the centre-column laptops sit at world **x ≈ 0**, and `0` is falsy, so that check made observers treat working users as position-less and scatter them to a random spawn (they looked mid-map to everyone but themselves). Always check `x !== undefined && x !== null`. Observers never assign a spawn to another player — everyone writes their own position.

### Presence self-heal (`activeInGame`)
`activeInGame` is the **only** thing that decides whether a remote player exists for observers: `listenToPlayers` adds a user to `gameState.players` only when it's `true`, so anyone in the map is genuinely in the website (there is no faded "in Discord VC" ghost any more — that integration is gone). A dropped socket (network blip, **PC sleep/wake**) fires `onDisconnect.set(false)` server-side, so a returning user would vanish for everyone until presence is restored. Presence is kept true while the page is open through **three** redundant paths — never rely on just one:
1. `updatePlayerPosition()` writes `activeInGame: true` on **every** position write (move/stop/heartbeat/restore).
2. A standalone **10s presence heartbeat** in the game loop (independent of any session — covers idle/walking users the 4s position heartbeat skips).
3. `visibilitychange` / `window.focus` / `window.online` → `_resyncPresence()` re-asserts `activeInGame` + token and re-broadcasts position/task **immediately** on wake (don't make a woken PC wait for the heartbeat).

All three bail if `gameState._dupSessionDetected` (another device took over — don't fight back).

**Removal is grace-period'd (`PRESENCE_GRACE_MS`, 8s) — never immediate.** `activeInGame` going false does **not** mean someone left: Firebase fires their `onDisconnect` server-side the instant their socket blips, and their own `.info/connected` sets it back to true a moment later. Deleting on the spot is what made players **pop out and back in mid-session** for everyone else. The users listener now only stamps `_presenceLostAt`; `updatePresenceGrace()` (every frame, from `updateLeavingPlayers`) commits the exit only if they're still gone when it expires. **Any WebSocket packet cancels it** — the relay has no presence concept, so anything arriving is proof of life that outranks Firebase. The check has to be time-driven and not live in the listener: a player who drops and never returns produces no further Firebase events, so nothing would ever finish the removal. Reconnect timer/task recovery also needs the laptop doc re-written: `reassertActiveSessionAfterReconnect()` (fired by `.info/connected`) does that.

---

## Picture-in-Picture (الوضع المصغر)

Floating focus window showing a **player-centred, zoomed** view of the world. Available on **all platforms**, but the *kind* of window depends on browser capability (see tiers). Platform matrix:
- **Chrome/Edge desktop** → Document PiP (always-on-top, escapes browser).
- **Safari desktop** → popup window (escapes tab, draggable across displays; **not** always-on-top — no web API allows it there).
- **Android Chrome** → Video PiP (always-on-top, floats over other apps).
- **iOS Safari** → in-page panel (no captureStream / Document PiP on iOS).

The popup window is **400×460**, forced small via `win.resizeTo()/moveTo()` (Safari ignores size on an `about:blank` popup otherwise). The popup tier is skipped on mobile (`window.open` is just a tab there).

### Surfaces (four tiers, one renderer)
`openPiPMode()` tries each in order; all share `renderPiPInto`:
1. **Document Picture-in-Picture** (`documentPictureInPicture.requestWindow`, Chrome/Edge): real always-on-top OS window with its own DOM + rAF — smoothest, has DOM timer/close. DOM/CSS injected from JS (`PIP_WINDOW_HTML`/`PIP_WINDOW_CSS`) — **no `pip.html` file**.
2. **Video Picture-in-Picture** (`srcCanvas.captureStream()` → hidden `<video>` → `requestPictureInPicture()`): always-on-top, timer drawn onto the canvas (`_pipDrawCanvasChrome`). **Skipped on Safari** — Safari does **not** implement `canvas.captureStream()`, so `_pipVideoSupported()` returns false there.
3. **Popup window** (`window.open('', …, 'popup=yes,…')`, **Safari** & anywhere): a real separate OS window that escapes the tab and drags across displays — *not* always-on-top, but the best Safari can do for live content (no Document PiP, no captureStream). Reuses `_pipSetupWindow`/`_pipFrame` exactly like tier 1 (mode `'window'`); a `setInterval` backstop + main-loop watchdog keep it rendering when the popup's own rAF throttles. **This is what Safari/macOS users get.**
4. **In-page panel** (`#pip-fallback`): draggable + `resize: both`, last resort when even `window.open` is blocked.

**Why Safari can't have always-on-top:** an always-on-top floating window of *live* content needs either Document PiP (Chrome-only) or a `<video>` fed by `canvas.captureStream()` (Safari lacks it). So Safari gets a normal popup window instead.

### Context-swap renderer (the core trick)
`renderPiPInto(ctx, canvas, dpr)` temporarily points `gameState.ctx/canvas/zoom/camera/dpr` at the PiP surface, runs the normal world-draw sequence, then restores them in a `finally`. Every draw function reads `gameState.ctx` etc., so this reuses 100% of the rendering code — **no draw function takes a `ctx` param** (the Haiku breakdown was wrong about that). Skips `drawFocusMask` (it would thrash the shared `maskCanvas`); uses a local `_pipVignette` instead of cached `drawVignette`.

### Smoothness
Render is driven by the **PiP window's own `requestAnimationFrame`** (`_pipFrame`) so it stays 60fps even when the opener tab is hidden/throttled. `updatePiPLifecycle` in the main loop is a **watchdog**: if `pip._lastFrameAt` is stale (>120ms) it renders a frame itself, and it drives the in-page fallback every frame. Camera centres via `updatePiPCamera` (lerp toward `-playerRenderPos`). Scroll-to-zoom is wired on both surfaces.

### Lifecycle — one guard, not scattered close-calls
`isPiPAllowed()` is the single predicate: work phase (pomodoro **or** free mode) AND no azkar/prayer/minigame/dup-session. `updatePiPLifecycle()` (called early in `gameLoop`, before the minigame early-returns) toggles button visibility and **auto-closes PiP the instant `isPiPAllowed()` goes false** — so break/session-end/overlay/minigame/logout are all handled in one place. The main page shows `#pip-blackout` ("الوضع المصغر مفعّل") while active.

| Function | Purpose |
|---|---|
| `togglePiPMode()` / `openPiPMode()` / `closePiPMode()` | entry / open (async, `_opening` guard) / teardown (`_closing` guard) |
| `renderPiPInto()` | context-swap world render |
| `updatePiPCamera()` | lerp camera to centre player + ease zoom |
| `updatePiPLifecycle()` | per-frame button visibility + auto-close + fallback/watchdog render |
| `setupPiPUI()` | wires button, blackout end-btn, fallback drag/resize, main-window `pagehide` |

`openPiPMode` is **async** (awaits `requestWindow`) — `pip.active` is only set after the await, so `_opening`/`_closing` flags prevent a close from being undone by an in-flight open (this was a real race: close appeared to "not work").

---

## Personal Dashboard (لوحة المتابعة) — restricted "paper stack" feature

A handwritten, "paper on paper" personal dashboard: per-day journal + completed-tasks, a daily to-do list, and lifetime analytics. Lives at the **end of `game.js`** (one cohesive module after the boss-fight code), with markup in `index.html` (`#dashboard-overlay`, `#dash-longfree-modal`) and styles in `style.css` (the `Personal Dashboard` block).

### Access restriction (feature flag) — IMPORTANT
The dashboard **entry circle on the map + the dashboard UI** are visible/usable **only** to:
- user ID **`567266235163738112`** (the owner), and
- **Siraj test ghosts** (`gameState.isSirajGhost`).

Gate: `dashboardAllowed()` = `userId === DASH_TARGET_UID || isSirajGhost`. Everyone else never sees the circle, prompt, or UI.

**Data tracking is NOT gated** — `dashSaveSession()` / `dashRecordGameOnce()` run for **every** member, each writing to **their own** node (`dashViewUid()` / `dashTrackingEnabled()` now key off `gameState.userId` for everyone). Only the *viewing* (circle + UI) is restricted. A **Siraj ghost builds its own throwaway dashboard node** (read-write, just like a real user) which is **removed from Firebase on disconnect** (`onDisconnect(dashboards/{sirajId}).remove()` armed in `setupDashboardUI`) — so it never inherits or pollutes the owner's data.

### Firebase schema — top-level `dashboards/{uid}`, NOT under `users/`
This is the key cost decision. The in-game `onValue(ref(database,'users'))` listener fires on **every** descendant change, so a dashboard write under `users/{uid}/…` would re-stream the whole users node to every client (violates the 10GB cap rules). So dashboard data lives at a **dedicated top-level node** read with **one-shot `get()`s only** (zero fan-out, no live listeners):

```
dashboards/{uid}/
  _seed: <DASH_SEED_VERSION>                  // mock-data guard marker
  stats/
    totalWorkMs: number                        // cumulative valid work
    mostTask: { name, ms }                      // precomputed "most worked on task"
    taskTotals/{slug}: { name, ms }             // per-task accumulation (slug = sanitised key)
    high/ { laptop: ms, race: ms, coffee: pts } // laptop+race = LOWEST time; coffee = HIGHEST score
  sessions/{finishMs}: { mode, task, finishMs, durMs }     // session log → feeds stats ONLY
  days/{YYYY-MM-DD}/
    journal: "text (≤100 words)"
  todos/{YYYY-MM-DD}: [ { text, done }, … ]      // per-DAY to-dos, max 5
```
**Tasks model**: `sessions` feed analytics only (total hours / most-worked task / high scores). The day paper's **"المهام المنجزة"** is **derived from that day's to-do list** — the items whose `done` is true (no timer, just names). To-dos are **per selected day**, so marking one done populates that day's completed list (`dashRenderCompleted`). There is no longer a `days/{date}/tasks` node (the v2 seed nulls any leftover v1 copy).
Firebase keys can't contain `. # $ / [ ]` → task names used as map keys go through `dashSlug()`.

**Database rules (REQUIRED).** The RTDB rules enumerate top-level nodes, so a brand-new node defaults to **deny**. The `dashboards` node must be allowed or every read/write returns `PERMISSION_DENIED` (the original "data isn't saving/loading" bug). The rule lives in the repo at [database.rules.json](database.rules.json) (`dashboards: { ".read": "auth !== null", ".write": "auth !== null" }`) with a [firebase.json](firebase.json) so `firebase deploy --only database` keeps it in sync. Dashboard writes log failures via `_dashErr()` rather than swallowing them — a `PERMISSION_DENIED` in the console means the rule wasn't deployed.

### Session validation / save rules (`dashSaveSession(mode, task, workedMs)`)
- **10-minute floor**: sessions under `DASH_MIN_SESSION_MS` are never saved.
- **Work time is accurate** (excludes breaks): pomodoro uses `pomoWorkedMsNow()` (accumulated via `pomodoro._workStartMs/_workedMs`, stamped in `startPomodoroPhase`); free mode uses `freeWorkedMsNow()` (the engine's `totalWorkMs`).
- **Pomodoro**: saved on **natural completion** (success card still shows) AND on **premature "انهاء الجلسة"** (`exitPomoNow`, no end card — unchanged) — both subject to the floor.
- **Free mode**: saved in `endFreeMode`. `shouldAskLongFreeConfirm(elapsedMs)` decides whether to intercept the leave with `openFreeLongConfirmModal()` ("هل عملت لمدة x فعلًا؟") — driven by the **تأكيد مدة الجلسة الحرة** setting (`SETTINGS_LONGFREE_KEY`): `off` never asks, `always` always asks, default asks past **30 min** (`DASH_LONG_FREE_MS`). This is the safety valve for the away-time credit above: a closed tab keeps banking real clock time, and the confirm is the only place the user can correct it, which is why the threshold dropped from 2h to 30min — hour/minute steppers + **save-as-shown** or **discard**; `_dashFreeHandled` stops `endFreeMode` from double-saving.
- **Minigame high scores** (`dashRecordGameOnce`, once per session via an in-memory guard): race + laptop-boss = best **lowest** finishTime; coffee = best **highest** score.

### Entry point (second-floor papers desk)
The old dev-art placeholder circle is **gone**. The dashboard now opens from the
**papers desk** on the second floor (`Workspace_0003`, world `PAPERS_X`/`PAPERS_Y`).
`drawDashboardPrompt()` shows **"انقر لفتح الأوراق"** when near (scaled up by
`FLOOR2_SCALE` so it doesn't look tiny up there). Proximity is set in
`updateInteractions` (`gameState.activeDashboardZone`, gated on **floor 2** +
`dashboardAllowed()` + not in a session); click/tap within `PAPERS_SELECT_R` →
`openDashboard()`. (`drawDashboardZone()` still exists but is dead code — no longer
called.)

### UI (scattered paper stack)
- **Font**: Methlama (`Fonts/KOMethlama-*.otf`, 6 weights via `@font-face`); headers use heavy weights (800/900), body 400–600. **Fallback**: if the OTFs fail to load the CSS stack falls back to **Rubik** and `setupDashboardUI` logs a clear warning explaining the path/case to fix.
- **Scattered stack**: `#dash-main-stack` holds **4** `.dash-sheet` papers, positioned askew by `_dashApplySheet`/`_dashSlotFor` (slots in `DASH_ACTIVE_SLOT`/`DASH_BG_SLOTS`). The background-sheet **tint is `filter: brightness()` set inline** in `_dashApplySheet` with an explicit `filter` transition — a class-toggled `::after` opacity snapped (compositor-accelerated props ignore the transition on toggle, and `getComputedStyle` can't measure them). **Ruled-line notebook texture is on the background sheets, the active page (`.dash-day-content`), AND the to-do paper** — the texture lines are the **only** horizontal line system (the old dashed section dividers / dotted task borders were removed because they couldn't reliably align). `.dash-day-content` is **opaque** (covers the sheet behind it), a **flex column** (so child margins don't collapse — the grid-snap relies on `margin-top` actually moving things), and has **no scroll** (`overflow: hidden`; content is sized to fit). `dashAlignGridLines()` (via `dashScheduleAlign` — run now AND on `document.fonts.ready`, since Methlama's metrics shift the layout) nudges onto the 34px grid (lines at content-y ≡ 33): the **high-scores row** (snapped so chips sit between lines), the **يوميات/المهام headings** (baseline onto a line; the summary + stats rows are left alone — already aligned), the **journal's own lines** (`backgroundPositionY`), and the **to-do list** (so 34px rows sit on lines). **المهام المنجزة** renders in **2 columns** (`column-count: 2` → ~3 right, 2 left in RTL) so up to 5 fit with no scroll. A thin red margin line sits in the right gutter. The single content wrapper (`#dash-day-paper`) lives **inside whichever sheet is active** (`_dashActiveSheet`).
- **Open/close sequences**: `dashPlayOpenSequence` flies the background sheets in one-by-one, then the main sheet on top; **the to-do paper is hidden until the stack settles, then slides out from behind into its peep**. `closeDashboard` reverses it (main out first, then backgrounds), then hides the overlay after the tail.
- **Day navigation**: prev/next buttons → `dashGoDay`→`dashAnimateDayChange` — pick a random background sheet, slide it **up north** off-stack (brightening off its tint); only **once it's off-screen** is the content re-parented onto it + the new day rendered (so the page you're leaving stays intact in front until the new one descends — avoids a blank/colour flash); then z-index above the stack and settle it back centred as the new active day; the old active recedes into the vacated background slot. `dashRenderDay` reloads that day's journal **and** to-dos. Can't navigate into the future.
- **Side swap (peeping papers)**: `#dash-stage` toggles `.side-main` / `.side-todo`; clicking the peeping edge OR a **horizontal swipe** (mobile, any decisive H-swipe toggles — `setupDashboardUI` touch handlers on the overlay) slides that stack to centre and pushes the other to peep (`dashSetSide`). A first-time mobile hint (`#dash-swipe-hint`, arrow nudging right) shows once (`dashMaybeShowSwipeHint`, localStorage `mdwnh_dash_swipe_hint`), dismissed on first side change.
- **To-do** (`المهمات اليومية`): max **5** tasks, **per selected day**. **Live generation** — `dashHandleTodoInput` fires on every keystroke: the trailing empty row is promoted in place + a fresh empty row spawns (`.dash-row-fresh`). Enter jumps to the trailing empty row; emptying a committed row deletes it on blur. **Tapping a checkbox** toggles done, plays `paperTaskComplete`, and `stopPropagation`s so it never triggers the side-swap; marking done re-renders **المهام المنجزة** for that day. Saves debounced (`dashSaveTodos`).
- **Task carry-over** (`dashRolloverTodos`, once per day via a `todosRolloverDate` marker): today's **uncompleted** to-dos roll forward from the last managed day (merged + de-duped by text, capped at 5); **completed** ones stay on the day they were finished. Runs in `openDashboard` before the day renders. Skipped for read-only Siraj.
- **Interaction (swipe-aware)**: one consolidated `click` handler on the overlay (NOT `mousedown` — that fired on touch swipes and self-closed the panel); a horizontal touch swipe toggles the side and sets `_dashSuppressClickUntil` to swallow the trailing synthetic click (fixes the mobile "can't swap / exits by itself"). Scrim click closes; clicking a peeping paper swaps to it.
- **Avatar widget**: `#dash-avatar` — the user's avatar in a square "taped-on" paper cutout (`.dash-avatar-tape`, tape strip + rotation) with a warm yellow tint (`sepia` filter + `multiply` overlay). Falls back to the username initial.
- **Input lock**: while the overlay is open (`dashboardIsOpen()`), the window `keydown` handler and `handleMovement` both bail, so typing (W/A/S/D, arrows) never bleeds into player movement.
- **Paper sounds** (`dashSound(name)` → `focusAudioEngine.playEffect`, Web Audio so it works in a background tab): `paperIntro` on open, `paperExit` on close, `paperSwipe` on the side swap (`dashSetSide`), `paperDaysSwap` on a day swap (`dashAnimateDayChange`), `paperTaskComplete` on completing a to-do. All preloaded via the standard 4-step pattern (`gameState.sounds` + `FocusAudioEngine.buffers` + `loadSoundEffects` + `.preload='auto'`).
- **Mobile perf**: the game loop keeps rendering behind the overlay, so on `body.is-mobile` the overlay drops `backdrop-filter` and hides `#game-canvas` while open (`body.dash-active`) — same rule as azkar.

### Mock data / testing
Mock data is **no longer seeded**. `dashClearSeedData()` runs once on login (for the target user or a Siraj ghost) and **wipes `dashboards/{target}`** if the legacy `_seed` marker is present, so old "temp stats" disappear and real data starts clean. It only fires when `_seed` exists, so it never touches genuinely-entered data.
**Siraj free-mode testing**: a Siraj ghost **always** gets the idle-confirm modal on ending a free session, so it's testable without working 30 real minutes — but **the user's `off` setting still wins over that** (`shouldAskLongFreeConfirm`), or the one account that can reach the dashboard could never test the off state. The confirm modal is **dark glassmorphism** (`.dash-lf-card`, not paper); when the user adjusts the time and confirms, that adjusted value is shown on the end card via `_dashFreeOverrideMins` (consumed in `endFreeMode`).

---

---

## The HUD stack (top-right) — card → tools → azkar → tasks panel

Four separate fixed elements, stacked, and **none of them is inside another**:

| element | what it is |
|---|---|
| `#user-card` | identity ONLY — avatar, name, points + rank chip, and the tasks chevron. The player count is gone; the gear and تخصيص moved out. |
| `#hud-tools` | a glass box of **circle buttons** (تخصيص، الإعدادات) to the card's **left** |
| `#azkar-dock` | the azkar button + the Siraj time-spoof button, on a dock **under** the card |
| `#lib-panel` | the tasks panel, under the whole stack |

**They're placed by JS, not CSS** (`_hudPositionDock`, `_hudStackBottom`,
`_hudPositionSettings`, `_libPositionPanel`). No CSS rule can read a sibling's box, and
the card's width changes with the name and with the points chip arriving — so one function
measures the card and hangs the rest off it. Re-run by a **`ResizeObserver` on the card**
(which also fires the first time it gets a size, i.e. when the game screen appears),
`resize`, and the frame the azkar button appears/disappears.

- **The tools box drops UNDER the card when it would collide with the الخروج pill** — a long
  name on a narrow phone pushes the card wide enough for that to happen. The azkar dock
  moves down with it. `offsetParent` is null for a `position: fixed` element, so "is the
  pill on screen" is a **width test on its rect**, not an offsetParent test.
- **The settings panel follows its gear** (`_hudPositionSettings`, called from
  `openSettingsPanel`) instead of staying pinned to the corner the gear used to be in. It
  can only be measured once open — a hidden panel is `display: none` and measures zero.
- **The azkar button itself is unchanged.** Its enter/exit animation collapses its OWN
  `max-height`/`margin`/`padding`, so it animates identically on the dock as it did inside
  the card. `.azkar-dock` is `pointer-events: none` with `> * { auto }` so the empty dock
  never eats a click on the world.
- **Mobile focus mode has to carry all three.** `setMobileFocusMode` toggles `.focus-hidden`
  on the card, the tools box AND the dock — sliding the card away and leaving its two
  satellites floating is what happens if you forget one. The `azkar-active` exception
  (don't hide during azkar — it's the only exit) covers all three too.
- `#player-count` was **deleted**; the writer at `listenToPlayers` was already `if (countElem)`
  guarded, so nothing else changed.

---

## حضور المقر — ثلاث ساعات في المقر، كل يوم (the daily duty; was «تحدي المثابرة»)

Since ١٠ سبتمبر ٢٠٢٦ this block runs the **leader's mandatory rule**: the site **open for
three hours every day**, mandatory from **Sunday ١٣ سبتمبر ٢٠٢٦** (`DUTY.start`; before it the
card says «تجريبي» — counted, but nothing owed and no vacations). It reuses round one's card
and modal. Round one itself — the seven-day **work** streak, ٣ → ٩ سبتمبر, `CHAL` — is
**over**: its card is gone and all that is left is its payout popup (below). Code is the
`حضور المقر` block at the very end of `game.js`; markup is `#chal-dock` + `#chal-modal` in
`index.html`; styles are the matching block at the foot of `style.css`. Grep anchors: `DUTY`,
`_dutyTick`, `_dutyBank`, `_dutySetVacation`, `_chalPayDue`, `_chalClaim`.

### The look — the مدونة brand (the panel on paper, the card in HUD glass)
Renamed from «تحدي المثابرة» (it is a mandatory rule now, not a challenge) and restyled
after دليل الفريق (`../Members`, `css/members.css`): **snow paper `#faf9f7`, one ink
`#262626` and its opacities instead of greys, the four `--brand-*` colours, brush marks
from `Icon Elements` painted through `mask` (`--ico-0` / `--ico-3`), Baloo Bhaijaan 2
(already loaded non-blocking for the library pills), and a gold highlighter swipe under
the key word of the panel's head** (`<em>`, written by `_chalPaintModal` via `innerHTML`
— static strings only). **The card and the folded pill are dark glass like the rest of the
HUD** — the same `--cd-*` tokens are re-declared on `.chal-dock` as white-on-glass, so
every rule serves both surfaces and the panel (`#chal-modal`, not inside the dock) stays
on paper. The mark beside «حضور المقر» is **brand teal**. The card's inline-start edge stripe carries the day's state
(gold open · teal done · blue vacation), the progress fill reveals the four colours
right-to-left (fixed `background-size` = the bar's width, so filling uncovers rather than
squashes the gradient). Tokens are scoped `--cd-*` on `.chal-dock` / `.chal-modal`.
- **The whole card is the button** (`#chal-card`, `role="button"` + `tabindex`; it can't
  be a `<button>` because it holds the fold button). The fold button stops its own click.
  Enter/Space open it and are stopped so they never reach the chat's Enter.
- **`backdrop-filter` on the card's glass is desktop-only** (`hover: hover` +
  `pointer: fine`); `body.is-mobile` / `body.reduced-gfx` drop it for a more opaque
  background (invariant 10). The paper panel has none. **No `letter-spacing`** on its
  Arabic (Safari breaks the joins).
- A Baloo swap after first paint changes the card's height, so `document.fonts`
  `loadingdone` re-runs the paint + `_hudPositionDock`.
- Internal ids/classes stay `chal-*`, the localStorage key stays `mdwnh_chal_minimized`,
  and round one's Points claim title stays «تحدي المثابرة — …»: it is the historical name
  of that round and already in the Points history for everyone who claimed.

### The duty's state — `dashboards/{uid}/duty/days`
```
dashboards/{uid}/duty/days/{YYYY-MM-DD} = { ms, vac }   // ms the site was open; vac = ts when taken
dashboards/{uid}/challenge/s1/{days, claimed}          // round one — read-only now
```
Decision tree §5 case 4 — private, persistent, written more than once a day: one bounded
`get()` at setup (this week onward — date keys sort chronologically, so `orderByKey()` +
`startAt(weekStartKey)` is a range), a `runTransaction` that ADDS a delta at most once a
minute (`_duty.liveMs` is the ledger, the `bankReadingProgress()` shape), **no listener**.
Under `users/{uid}` this would re-stream every member's every minute to both lobbies.

- **`ms` is NOT capped at the goal** (only at 24 h). Round one capped at its goal to bound
  writes; here the leader ranks members by how long they were really here, which a capped
  value can't say. The cost is one tiny transaction a minute on a node nobody listens to.
- **Open time, not session time.** `_dutyTick` credits the wall-clock gap between ticks while
  `#game-screen` is `.active`. It runs per frame (throttled to 1/s) AND on a 15 s
  `setInterval` — rAF stops in a hidden tab, the interval keeps going (~1/min at worst), so a
  background tab still counts. **A gap over `DUTY_GAP_MAX_MS` (150 s) earns nothing** — that
  is a sleeping laptop or an iOS-suspended tab, not an open site. Counting pauses under
  `_dupSessionDetected` (two devices can't double-count) and while a vacation write is in
  flight (`_duty.busy`). Banked on `pagehide` / `visibilitychange`→hidden.
- **One state word per day, shared with the leader's panel** — `_dutyStateOf(rec, key, today)`
  → `future · vac · done · now · pre · miss` (`pre` = a trial day before `DUTY.start`, never
  held against anyone). Both sides call it, so the two dots can never disagree.

### Vacations — two a WEEK, today only

**A day that ends short takes one by itself** (`_dutyAutoVac`). A finished day under
three hours reads as `vac`, not `miss`, while that week still has a vacation left — the
ones the member took are counted first, the rest go to the short days oldest first; with
both spent, a short day is a real `miss`. It is **derived on read and never written**
(pass the record map as `_dutyStateOf`'s 4th argument — `_dutyDayState` does), so the
member's ladder, `_dutyVacLeft()` and the leader's panel agree, and it covers weeks the
member never opened the site in. Its ms stay as recorded; the leader's calendar tooltips
it «إجازة تلقائية». Today is never judged — it isn't over.
`DUTY.vacPerWeek` (2), weeks starting **Sunday** like the leader's panel. The button is in the
modal (tap anywhere on the card): **two presses**, the second reading «تأكيد: سيُمسح تقدّم
اليوم», then `{ms: 0, vac: ts}` REPLACES today's record — the brief says taking one removes
today's progress. «إلغاء الإجازة» is one press, today only, and counting restarts from zero.
Offered only when the duty has started, the week's read succeeded (`_duty.readOk` — a failed
read must not let a third one through), today isn't already won, and one is left. Both
directions apply locally **after** the write acks; busy is a `.is-busy` class, never
`disabled`. Changing the allowance period (month, rolling…) means `_dutyVacLeft()` AND the
bounded setup read — both assume a week.

### Round one's payout — a popup that only «استلام» closes
A member who earned round-one points and hasn't claimed them gets `#chal-modal` in its `pay`
face `CHAL_PAY_DELAY_MS` (2.5 s) after the boot screen lifts (`_boot.gateOpen`) — even
mid-session, `_chalPayScreenOk` is deliberately looser than `_chalScreenIsClear`. No ✕
(`.chal-modal.pay .chal-modal-close`), no «تمام», no backdrop: `_chalUserClose()` refuses in
`pay` mode. Only the prayer/azkar/minigame guard closes it, and it reopens once that clears.
«استلام» → `_chalClaim()`, which **re-reads `challenge/s1/claimed` from the server first** —
the id is fixed per round and the Points site deletes a settled claim, so a second record
would pay twice — then mints it and hands over to `_libShowClaim` (استلم الآن / لاحقًا).

### The card is the FOURTH rung of the HUD stack
`#chal-dock` sits under `#azkar-dock` and is placed by `_hudPositionDock()` like its two
siblings — a sibling of the user card, never a child (`will-change: transform` on the
mobile card would make it the containing block). It is counted in `_hudStackBottom()`, so
the tasks panel still starts below everything. Three things follow from that:
- **`setMobileFocusMode` has to carry it too.** Four elements slide now, not three;
  forgetting one leaves it floating alone on screen.
- **Every rung of the stack is `ResizeObserver`d, not just the user card.** The azkar
  button animates its OWN `max-height` from 0 to 80px over 0.44s (`azkarBtnEnter`), so the
  dock above this card grows across ~26 frames. Placing the card once, on the frame the
  button flips, reads a height of nearly zero and drops the card **on top of the azkar
  button** — where it stays until something else re-measures, which is why folding and
  unfolding the card appeared to "fix" it. Observing `user-card`, `hud-tools` AND
  `azkar-dock` follows every frame of that growth for free. No loop: `_hudPositionDock`
  writes only `top`/`right`, never a size.
- **It is FOLDED by default on mobile, open by default on desktop** (`_chalMinimized()`),
  and only an explicit press writes the key — so "never touched it" and "chose the open
  one" stay two different answers. A full card on a phone pushed the tasks panel down the
  screen.
- `_chalPaintCard()` runs ~1/s and only re-measures the stack when its own text changed
  (`_chal.lastPaintKey`).

### One modal, three faces
`#chal-modal` (`_chal.mode`): **`duty`** — this week's seven days Sunday → Saturday with the
hours over each dot and the member's avatar on today, plus the vacation button; **`win`** —
the same under «أحسنت!» once three hours are crossed; **`pay`** — round one's seven-dot ladder
with its stickers and the claim, and nothing else. `display` can't transition, so it is always
laid out and `.active` lands after a double rAF, z-index **9990 — BELOW prayer and azkar
(10000)**, with a lifecycle guard in `updateWorkChallenge` that closes it if either fires.
- **The track is built once per open; only `_chalPaintTally()` repaints (1/s).** Rebuilding
  the track would replay the avatar's `chalMeIn` entrance every second.
- **The celebration waits for a clear screen** (`_chalScreenIsClear()`: no session, no
  overlay, no end card). `_duty.celebrated[dayKey]` is primed at load, so a day already won
  (or taken off) never re-celebrates; cancelling a vacation un-primes it.

### The claim is the ecosystem handshake, UNCHANGED
`mdwnhLibrary/claims/<NFC dbKey>/maqr-streak-<round>` = `{taskId,title,points,color,ts}` —
byte-for-byte the record a library task writes, at the path the Points site already
settles. **No rules change and no code change was needed on either other site**: a claim
was already generic. It reuses `_libShowClaim()` and `libPtsPut()` (`keepalive: true`,
because «استلم الآن» navigates the tab away mid-write).
- **A Siraj ghost can never mint one.** The claim is keyed by the member's Points-DB name,
  which comes from `MDWNH_ROSTER.byDiscord` — a `siraj_*` id resolves to nobody, so the
  button simply never appears. Same guard the reading leaderboard uses, for free.
- The `claimed` stamp is written the moment the record lands: «لاحقًا» is still a claim
  that has been made.
- **`_chal.rosterDone` gates "this member has no library account".** Judging that before
  `_mdwnhRosterReady` resolves would decide the payout popup on a roster that hasn't landed.

### The calendar
`_chalMidnights()` counts LOCAL midnights, never a millisecond division — a DST hop is an
hour and an hour either side of a boundary would move the whole ladder by a day. **The
opening is a MOMENT** (`Date.now() < CHAL.start`, because the card counts down to it) and
**the close is a calendar DAY** (`dayIndex > days-1`, because the last column runs to its
own midnight). Asking both the same way either opens the round a minute before it was
announced or closes it a minute into an eighth day — the rule صحبة الفجر settled on.

### Starting the next round
*(Round one's machinery — kept for reference; the running system is the daily duty above.)*
Pick a new `CHAL.round` key, move `start`, deploy. Nothing is migrated and nothing is
"reset": the old round is still sitting at its own key and the new one is empty because
nobody has written to it. `CHAL_CLAIM_ID` carries the round, so a second round claims at a
key of its own and cannot collide with the first.

**The library advertises this on its مقر العمل card and the two wordings have to agree** —
changing the challenge means changing `MdwnhLibrary/index.html` in the same pass.

---

## رف الجوائز — three trophies (and four hidden ones) on two planks

Walk to the shelf on the bottom-left wall of the break room → **«انقر لرؤية رف الجوائز»**
→ a lit display case. Code is the `رف الجوائز` block at the very end of `game.js`;
markup is `#trophy-overlay` + `#tro-cer` in `index.html`; styles are the matching block
at the foot of `style.css`. Grep anchors: `TROPHIES`, `TROPHY_LIVE`, `updateTrophies`,
`_troBank`, `_troClaim`, `_troCeremony`.

### `TROPHIES` is the ONLY place any of this lives
`id`, Arabic name, description, art number, plank, goal and point value are all one
array; the HTML holds no slot markup at all and `setupTrophyUI` builds both rows from
it. Seven slots, **three live** at **٣٠ نقطة** each; `TROPHY_LIVE` is the filtered list
everything that counts, claims or lists uses.

| id | name | condition | source |
|---|---|---|---|
| `azkar` | مثابر الأذكار | صباح ومساء، ١٠ أيام | `troNoteAzkarDay()` from `markAzkarCompleted` |
| `reader` | قارئ | ٥ ساعات قراءة | **derived** from `dashboards/{uid}/reading/books/*/totalMs` |
| `thirty` | ثلاثون يومًا | ٣٠ يومًا مختلفًا فيه عمل | a set of date keys |
| `locked-1/5/6/7` | — | — | **hidden — nothing counted** (see below) |

**The four hidden slots were removed on purpose** (باكر، برينروت، شغوف، النقطة
الماسية). They are `locked: true` entries with only an `img` and a plank: drawn as a
**blacked-out silhouette** (`brightness(0)`) with the brand's brush question mark
(`--ico-5`) on it, captioned «جائزة مخفية». No name, no condition, no points, no
button (`role="img"`, no `data-tro`, so the shelf's click handler never opens them),
and **no counter** — `updateTrophies` only marks work days for ثلاثون يومًا. The leader
can no longer award النقطة الماسية either. Their old Firebase keys (`prog/workMs`,
`prog/dawnMs`, `prog/sessions`, `grants`, `taken`, `granted`) are left where they are —
nothing reads or writes them, and deleting member data is not worth the risk. To bring
one back, give it a real entry again (and a counter if it needs one).

**قارئ deliberately keeps no counter of its own** — reading already banks `totalMs` per
book every minute, so a parallel accumulator here could only ever disagree with it. It
is one memoised `get()` on open, **minus `prog.readBase`** (see the epoch below), so it
measures only what was read after the shelf started counting.

### Cost — the whole design decision
```
dashboards/{uid}/trophies/prog     = { workDays:{d:1}, azkarDays:{d:1}, epoch, readBase }
dashboards/{uid}/trophies/claimed/{id} = ms      // when it was claimed
```
Decision tree §5 case 4: private to one member, persistent, written more than once a
day. **One `get()` on idle after spawn, an `update()` of day keys at most once a minute while
working, and no listener anywhere.** Under `users/{uid}` this would re-stream every
member's every worked minute to every client in **both** lobbies.

- **Every counter is CAPPED at its own goal**, which is what bounds it: a won trophy
  costs nothing at all, forever. The caps are derived from `TROPHIES`, never retyped.
- **Only day keys are written** (`_tro.pending.days` / `.azkar`), and setting a day key
  is idempotent, so two devices banking the same day cannot double-count.
- The accumulator ticks at **~1 Hz**, not per frame — a day key only has to land once.

### The epoch — old work earns NOTHING
**Every counter starts at zero for everyone.** An earlier build had a retroactive seed
(`_troSeed`) that credited `workMs`, `sessions` and `workDays` out of the dashboard's
history, so a long-standing member walked in with trophies already filled for work done
before the shelf existed. **That was removed on purpose — don't reintroduce it.**

`_troStartEpoch()` runs **once per member** (guarded by `prog.epoch === TROPHY_EPOCH_TAG`),
wipes whatever that seed left behind, and takes a **baseline of their reading total**
(`prog.readBase`) so قارئ — which has no counter of its own and reads the reading
module's lifetime `totalMs` — measures only hours read from the epoch on. **Bump
`TROPHY_EPOCH_TAG` to start everyone over again.**

It must **not** stamp the epoch on a failed read: a dropped request would set `readBase`
to zero and hand the member قارئ for old hours. Unmarked, it just runs again next login.

### The claim is the ecosystem handshake, unchanged
`mdwnhLibrary/claims/<NFC dbKey>/maqr-trophy-<id>` = `{taskId,title,points,color,ts}` —
the same record a library task writes, at the path the Points site already settles. **No
rules change and no code change on either other site.** The record is written the moment
«استلام الجائزة» is pressed, *before* the ceremony runs, so «تم» (or closing the tab
mid-ceremony) can never lose it. `_troClaim` **awaits `_mdwnhRosterReady`** first:
judging "this member has no library account" while the roster is still in flight would
mark the trophy taken and silently drop the points — the one failure here that costs a
member something real. A Siraj ghost resolves to nobody, so it can never mint one.

**How the other end settles it** (`MdwnhPoints/index.html`): arriving at
`?claim=1&user=<NFC dbKey>` logs the member straight in (`resolveMemberName`, no
password — the caller already authenticated them), then it reads their whole
`mdwnhLibrary/claims/<key>` node and lists every pending record, whatever the id.
`claimNow` **deletes the record first and then awards** `points` with `title` as the
note. So a replay cannot double-pay — but a *second* record written at the same id
after a settle would, which is why `_troClaim` re-reads `claimed` from the server
before minting.

### Progress is visible from OUTSIDE — the gold fills the trophy
Each slot draws the art **twice**: a grayscale/dimmed copy, and a full-colour copy
clipped `inset(100%-p 0 0 0)` so it fills bottom-up with progress. Under it: the name, a
hairline bar, and the percentage. Earned-but-unclaimed swaps the caption to «جاهزة
للاستلام» and **breathes the pool of light under the trophy (opacity)** — never an
infinite `filter`/`scale` animation (invariant 12). A claimed slot keeps a faint ghost
with a ✓ so the shelf never reads as broken, and moves into «الجوائز المستلمة».

### The plank sits between two rows, and the pull-up is a percentage of WIDTH
`.tro-shelf` is three elements: the figures row, the plank in normal flow, then the
captions row. The plank is pulled up with `margin-top: -5.7%` — **percentage margins
resolve against the containing block's width**, and the plank's height is a fixed
fraction of its own width (264/1956), so `-5.7%` lands the trophy feet on its top face
at *any* size with no JS measuring and no hard-coded height. The captions then follow it
for free.

**That is why the plank lives inside `.tro-plankwrap`**, a box of `--tro-deck` width: the
percentage has to resolve against the DECK, not the whole room. Sizing is one chain off
`--tro-fig` (`clamp(100px, 17.5vh, 196px)`) — `--tro-col` is *narrower* than the trophy
art is wide, so the trophies nearly touch, and `--tro-deck` is always the FOUR-column
width so the top and bottom shelves are the same board.
**Both rows are generated from the same list and are both `flex: 0 0 var(--tro-col)`** —
that is the only thing keeping a figure and its caption in one column, and both carry
`data-tro` so one delegated handler covers the whole column.

**The pool of light under each trophy must not touch its own box edge.** It was
`radial-gradient(… at 50% 78%)` with a 62% radius — 78 + 62 = 140%, so the glow was cut
off flat along the bottom. It is `64% ± 34%` now; keep any change inside 0–100%.

### The ceremony (`_troCeremony`) — one timer list, `TRO_CER` is the whole score
The press **snaps to black in the same frame** — `.tro-cer.active` carries
`transition: none` (the enter is a cut, the exit still fades), and the trophy is
`visibility: hidden` until the light is on it. Without both, the detail panel was
visible fading out underneath and the trophy caught a frame on the way.

`0` black + `spotlight.mp3` → `1920` the light **and** the trophy snap on together (no
fade on either — see below), on the **same cue pitched to 0.62** plus `player_Fall.mp3`
→ `2920` the avatar (the player's own, ring colour included) drops →
`3900` he winds *back*, `3950` `Trophy_Collect.mp3` (three frames behind the wind-up) →
`4120` dash → `4260` impact: shake, and `_troTail` takes over → `4350` the flash and the
pulse ring → `4500` the ghost → the card at **audio + 3000 ms exactly**, as briefed.

**Nothing on this stage fades in.** `.tro-spot` / `.tro-spot-pool` have no transition at
all, and neither does the trophy. That is not only a look: `.lit` stays on the layer
after a ceremony, so with a transition there the *second* claim opened on an already-lit
stage that then visibly faded down the moment استلام was pressed. `_troEndCeremony` also
drops `lit`/`hit` 360 ms later, once the exit fade is over — belt as well as braces.

**The trophy is never simply hidden.** It **breaks into four pieces on the impact
frame** (see below) — the box's `opacity` goes to 0 as theirs goes to 1, and because
they tile its art exactly the swap is invisible. A **ghost** — the same art, white, 70%
opacity — blows outward fast and settles slowly as the flash fades; a **pulse ring** is
thrown off on the flash beat; and the avatar **flares white** when the pieces reach him
(`ei > 0.88`).

**The four pieces (`TRO_SHARDS`, `.tro-cer-shard`).** Each shard is the **whole trophy
footprint** clipped to one wedge, holding two copies of the art — the normal one and a
`brightness(0) invert(1)` white one whose opacity ramps with the flash (a `filter`
cannot be interpolated from "normal" to "white" cleanly; two layers can). The cracks run
from an off-centre point out to the four edges **with a kink in each**, so it reads as
broken rather than cut; the four polygons **tile the box exactly**, so changing one means
changing its two neighbours.

- **The clip is on the inner `.tro-shard-clip` span, NEVER on the shard itself.**
  `clip-path` is applied **after** `filter`, so a `drop-shadow` written onto the clipped
  element is sliced off flat along the break lines — four pieces each wearing a cropped
  rectangle of glow. Clip the child, glow the parent.
- **OUT is ease-out cubic** (`TRO_CER.shatter`) to a point on the diagonal **around the
  avatar** (`R = trophy height × 0.72`); **IN is ease-in cubic** (`TRO_CER.gather`) to
  his centre. **They OVERLAP by `TRO_CER.overlap` of the scatter** — `ei` leaves 0 while
  `eo` is still easing outward, so the two blend into one continuous arc. Composing them
  end-to-end instead read as two separate moves with a stop between them; this is the AE
  trick of overlapping the keyframes of two parented nulls, and it is the whole feel.
- **Each piece trails him at its OWN rate** (`follow`), it is not welded to his `x` —
  he is still coasting underneath. The smoothing is frame-rate independent (`dtF`), or a
  120Hz panel would trail twice as far as a 60Hz one. The **enter target blends back to
  the live `ax` as `ei` closes**, so however far behind a piece was, it still lands on him.
- **Each piece turns slowly and constantly** (`rot0`, deg/ms, signed — no two alike) on
  top of the flourish the two moves add. Rotation is about **each piece's own centroid**
  (`transformOrigin` set from `TRO_SHARDS` at ceremony start), not the box's.
- **No DOM lookup inside the rAF**: the white copies are mapped once before the loop,
  like the three `getBoundingClientRect()` reads.
- They are warmed at `lit` like every other impact-frame layer — four more full-size
  filtered images rasterised on the break frame is exactly the spike this section
  exists to avoid.

**`_troTail` is ONE rAF for the whole tail, with no DOM read inside it.** It drives the
avatar's slow-motion coast *and* the four pieces, so it can compute their target
arithmetically instead of measuring. Three `getBoundingClientRect()` calls happen once,
before the loop.

- **Horizontal travel is a `transform` in px, never `left`** (`_troSetX`). `left`
  relayouts the stage on every frame of a 2.6 s tween, and the dissolve wants to know
  where the avatar is — that pair is half of the lag spike on impact.
- **The coast eases on `sin(k·π/2)`**, whose velocity reaches exactly zero at the end,
  so the avatar glides to rest. `(1-k)^1.6` still carried real speed at 83% of the tail
  and then shed all of it at once, which read as a sudden stop. The `.slow` stretch
  transition matches that curve and duration — a shorter linear one finishing while the
  avatar was still sliding was the other half of it.
- **Everything that would first appear ON the impact frame is warmed at `lit`**, two
  seconds early: `will-change` on the box, the white copy, the ghost, the pulse, the
  flash and the *stage* (which the shake transforms and which holds the two big
  spotlight gradients), the blur filter touched once, and each of those opacities
  nudged to `0.004` — reserving a layer is not the same as painting one, and an element
  at exactly 0 can still skip the paint. The `void offsetWidth` reflows those
  animations used to need are gone too: the classes are cleared at ceremony *start*, so
  adding them later restarts them on its own.
- **`troCeremonyIsRunning()` stops the world pass on every platform** while it runs (the
  other overlays only do that on mobile). The stage is opaque black — rendering the
  world underneath was pure waste, competing for the frame budget at exactly the moment
  the impact needed all of it.
- **Vertical and horizontal live on different elements.** `.tro-cer-avatar` owns the
  travel transform; `.tro-cer-av` owns the drop/squash/stretch. One element doing both
  would have the two fighting over one property.
- The drop is deliberately **short and shallow** (0.62 s, one squash, one rebound). The
  first pass squashed to 0.72/1.26 over three beats and read as rubber, not weight.
- **Every timer goes in `_tro.cer.timers`** so «تم» can cancel the whole tail.
- **The stage is sized against WIDTH as well as height** (`--tro-cer-h:
  clamp(150px, min(34vh, 40vw), 360px)`). `34vh` alone makes the trophy 55vw wide on a
  phone — already touching the avatar before it has moved. The four x-marks have a
  separate mobile set for the same reason.
- «تم» **fades the collect cue over 2 s** via `focusAudioEngine.fadeOutHandle`.
  `playEffect` keeps no handle, which is exactly why `playHandled` exists.

### Assets
`Art/trophies/*.webp` — the seven trophies (518×687) and the plank (1956×264), cropped
to their painted art out of 2000² masters and saved **WebP q90, not palette PNG**: the
gold is baked gradients and a 255-colour palette bands it, the same call the Lemo sheets
made. 2.4 MB → **190 KB**. `Sound/Trophy_Collect.mp3` ships **trimmed to 25 s with a 4 s
fade** (111 s master gitignored). All of it — images and the two sounds — starts loading
`Sound/player_Fall.mp3` is re-encoded 242k → 128k (masters gitignored). All of it — images
and the three sounds — warms on **idle after spawn**, with the walk-up call
(`_troEnsureAssets`) left as a backstop: proximity alone was late enough that the
trophies visibly popped in on the first open. Never on the login path, and
`warmGameSounds` has an explicit `NEVER_WARM` set so the HTMLAudio copies of the
ceremony sounds are not downloaded a second time for everyone.

### The world layer is the only CROPPED one
`Workspace_0013b_Trophy_Shelf.png` is 428×71, not the full 2210×3160, so `WORLD_LAYERS`
grew a **`box`** (its bbox in source px) and `loadWorldArt`'s compose step pastes it back
at that rect instead of stretching it. `TROPHY_SHELF_BOX` is that box **and** the
interaction point, so the art and the hitbox can never drift apart. No collision mask: the
dilated bottom wall already stops the player ~50 source px short of it.

### Gotchas
- **Only a Siraj ghost sees every live trophy full and claimable** (`_troTestUnlocked`), so
  the ceremony is walkable without waiting thirty days. A ghost resolves to
  nobody in `MDWNH_ROSTER` and therefore **cannot mint a claim** — which is exactly
  what makes it the safe account to test with. It is a local display override; nothing
  is written, and the real counters keep accumulating underneath.
- **To hand a named account a clean shelf, bump `TROPHY_RESET_TAG`** — its `claimed`
  map is wiped on next login. `TROPHY_RESET_UIDS` is a deliberately **separate** list
  from `_troTestUnlocked()`, so a real member can be reset without also being handed
  every trophy.
- **`_troClaim` re-reads `claimed` from the server before minting.** `_tro.claimed` is
  a login-time snapshot, so a second tab opened before the first one claimed would
  still think the trophy is free — and since the Points site **deletes** a claim when
  it settles, a second record really would pay twice. One tiny read on a
  once-per-trophy action closes it.
- **`_troStartEpoch` must not stamp `epoch` on a failed read.** Burning the one shot on
  a dropped request would leave `readBase` at zero and pay قارئ for old reading;
  unmarked, it just runs again next login.
- The complete button locks with a **`.unlocked` class, never the `disabled` attribute**
  (iOS touch leak — see azkar), so the handler has to re-check the class.
- Enter/exit everywhere is `opacity` + `visibility` + a double-rAF `.active` — `display`
  can't transition.
- `trophyShelfIsOpen()` joins the standard guard list (keydown, wheel-zoom,
  `handleMovement`, the mobile canvas-off test, `updateLibPanelLifecycle`,
  `_chalScreenIsClear`, `_chatMustClose`) and `trophyHoldsCamera()` pins the camera the
  way `_fireFreezeCamera` does — the loop keeps running underneath, so the room you come
  back to must be the one you left.
- z-index **9000 for the shelf, 9400 for the ceremony — both below prayer/azkar
  (10000)**, which must cover them.

### جوائز العام — the sheet on the wall

`Art/Awards.jpg` is taped low on the room's wall (`#tro-paper`). Pressing it peels
it off, tumbles it through the room and **slaps it flat against the screen**, the
screen being read as a pane of glass. It stays stuck there to be read — press to
enlarge, drag it anywhere, pinch or wheel to zoom — and closing runs the same
curve backwards and tapes it back up. Code is the `جوائز العام` block right after
`setupTrophyUI`; markup is `#tro-paper` + `#tro-paper-view` inside the shelf
overlay; styles sit with the shelf's. Grep anchors: `AWD`, `_awdOpen`, `_awdPose`,
`_awdRun`, `_awdClose`.

**It is silent, on purpose.** The flight carried a peel / slap / release cue and
they were taken back out — the room is quiet and the sheet is a poster, not an
event. Don't put them back without being asked.

**Cost: zero.** Nothing is written, read or synced — it is a picture on a wall,
identical for everyone. The image carries **no `src` in the markup**: both `<img>`s
are attached by `_troEnsureAssets` (idle after spawn, with the trophies), so ~80 KB
can never land on the login path.

**The flight is one rAF, not a keyframe.** It has to start wherever the sheet is
pinned and end wherever the viewport centre is, and neither is knowable in CSS — so
`_awdPose(u)` is the whole score (`u` = 0 on the wall, 1 flat on the glass) and each
frame writes one transform. The one-shot glass FX (flash, ring, the pane's jolt)
**are** keyframes: they never need a rect, and a class is the cheapest way to fire
them once.

- **The fly element is laid out at the STUCK rect** — reading size, centred — and the
  transform maps it *back* onto the wall. The stuck pose is the one that must be
  pixel-exact, because it is what the pan and the zoom are measured against.
- **The scale comes from `offsetWidth`, the position from the rect.** The pinned sheet
  is tilted, so its `getBoundingClientRect().width` is the rotated bounding box —
  ~10% too wide on a tall sheet, which would land it at the wrong size.
- `visibility: hidden` (`.is-away`), never `display: none`, while it is away: the wall
  rect has to stay measurable, because it is what the flight home is aimed at.
- **Travel accelerates into the glass** (`k^1.6`) — a sheet thrown at a pane, not eased
  into one — with an arc off the straight line. What reads as *paper* is the decay
  terms: the X/Y flutter dies out as it flattens, and the impact is **one** damped
  bounce (`exp(-4.6b)·cos(2.9πb)`, ~4 frames). A slower decay turns paper into jelly.
- `AWD.spin` is **360**, a whole turn, so it lands upright and readable.
- **The reader's pan/zoom is folded into the flight home weighted by `u`**, so closing
  from a dragged, zoomed sheet still lands on the wall — one code path, not two.
- Tap-to-enlarge only fires when the press **moved < 10 px** (the sheet is dragged
  around, and a drag still ends in a press — the library-pill rule).
- **A press on the pinned sheet within `AWD.ghost` (450 ms) of the shelf opening is
  ignored** — the world tap that opened the room is followed ~300 ms later by a
  synthesized click, and the sheet sits in a corner it could land in. Same guard the
  laptop mode-select chain uses (`_tro.openedAt`).
- The 0.36 s ease that makes tap-to-enlarge feel good would smear a wheel or a pinch,
  so those add `.is-live` (no transition) for 160 ms.
- `closeTrophyShelf` calls `_awdReset()` — the sheet goes back on the wall with the room.
- `will-change` is on `.tro-paper-view.active .tro-paper-fly` only: a promoted layer
  this size held for the whole session is memory spent on a room that is closed
  almost all of the time.

## لوحة القائد — the leader's panel

نواف's view of the whole team: who worked and how long. It is read-only.
Code is the `لوحة القائد` block at the very end of `game.js`; markup is `#admin-btn` +
`#admin-overlay` in `index.html`; styles are the matching block at the foot of `style.css`.
Grep anchors: `ADMIN_UIDS`, `adminAllowed`, `_admFetchMember`, `_admRenderDetail`.

### Who
`adminAllowed()` = the roster's **`admin`** flag (نواف) **or** a **سراج ghost** (so the
whole thing is walkable without being نواف), with his Discord id in `ADMIN_UIDS` as a
floor under the roster lookup — the roster arrives over the network and this must hold
if it never does. The crown button is `hidden` until `updateAdminLifecycle()` says
otherwise, and **every entry point re-asks**: a hidden button is not a permission check.

### The numbers were ALREADY being recorded — nothing was backfilled
`dashSaveSession()` has written one record per finished session since the dashboard
shipped: `dashboards/{uid}/sessions/{finishMs} = { mode, task, finishMs, durMs }`, over
the ten-minute floor, with `durMs` **excluding breaks** (it comes from `pomoWorkedMsNow()`
/ `freeWorkedMsNow()`). That log **is** the history — every member's, going back as far
as they have used the site. `_admSummarise()` derives the weeks from it **on read**;
nothing new is stored and there is no migration to run.

**A week starts on SUNDAY, local, and is walked with `setDate()`** — never a millisecond
division. A DST hop is an hour, and an hour either side of a boundary would drop a whole
evening of work into the wrong column. Same rule as `_chalMidnights()`.

### Cost — the list is automatic because its read is BOUNDED
Nothing has to be pressed: `_admAutoLoad()` runs on open and fills every row. That is
affordable only because a row needs **two numbers**, not a history — so `_admFetchWeek()`
asks for a **key range**, not the node:

```js
query(ref(db, `dashboards/${uid}/sessions`), orderByKey(), startAt(String(prevWeekStart)))
```

Session keys are `String(finishMs)` — thirteen digits, all the same length — so **ordering
by key IS chronological** and that range is exactly the last two weeks. A working member
has a handful of records in it instead of hundreds. **Keep it bounded**: if a row ever
needs a third number, move the start back — never drop the range and read the node whole.

The **full** history (twelve weeks, top tasks, lifetime) is still one `get()` of the whole
`sessions` node, and it stays **lazy — one member, on click**. No listener anywhere;
nothing in this app live-listens `dashboards`, so the fan-out is zero.

- Two caches, on purpose: `_adm.week` (the slice, `ADM_WEEK_TTL_MS` = 5 min) and
  `_adm.cache` (the full history). A row reads whichever is present, **the full one
  first** — and `_admFetchMember` writes back into `_adm.week` so a stale row can't sit
  beside a fresh detail.
- Both hold the **in-flight promise**, not a flag: the auto-load racing a click has to
  wait for the same read, not resolve early on a stale cache.
- A failed read caches `failed: true` with `at: 0` — a zero must never look like an
  answer, so the row says «تعذّرت القراءة» and is retried on the next open.
- The two reads per member are `sessions` and `duty/days`. **Never read `dashboards/{uid}`
  whole** — `invoicePhotos` lives under it.
- «تحديث الأرقام» is the FORCE, not the loader — the open already loaded.
- `_admAllUids()` is deliberately **not** filtered by the search box: typing must change
  what is *shown*, never what is *fetched*.

### The daily duty — who met today's three hours
The list opens on a **حضور اليوم** bar (`#adm-duty-bar`, `_admRenderDutyBar`): chips that count
and FILTER today — أتمّوا / في إجازة / لم يُتمّوا — plus «الأعلى حضورًا», a sort by this week's
open time (the row's right column switches from work to presence with it). Every row carries
this week's seven dots (Sunday on the right) and one line about today. An opened member gets
a **الحضور اليومي** section above the work numbers (`_admDutySection`): this week's open time,
days won / vacations / missed since `DUTY.start`, the unbroken streak (a vacation keeps it,
adds nothing), and a six-week calendar (`ADM_DUTY_WEEKS`) with the hours in each cell.

- **Same bounded read, one more query.** `_admFetchWeek` adds
  `query(duty/days, orderByKey(), startAt(dateKey(prevWeekStart)))` beside the sessions range
  — date keys sort chronologically. It has its OWN `catch`: a failed duty read must not throw
  away good work numbers. The whole `duty/days` node is read only for one opened member.
- **`_admRowData(uid)` picks the FRESHER copy** of a member (full history vs. the auto-load's
  slice) by `at`. Rows used to prefer the full history outright — harmless for weekly totals,
  but it froze «today» at whenever the member was last opened.
- **A filtered view lists only members whose day is KNOWN** — one still loading is unread,
  not «لم يُتمّوا».
- Every day is judged by the member-side `_dutyStateOf`, never a copy of the rule.

### It writes nothing
It used to award **النقطة الماسية** (`trophies/grants/diamond/{ts}`, behind a two-press
confirm). That trophy and the award button were removed with the hidden trophies (see
**رف الجوائز**), so the panel is read-only — one-shot `get()`s and nothing else.

### Gotchas
- **`.hud-tool-btn` sets `display: grid`, which beats the UA's `[hidden]{display:none}`.**
  Without the explicit `.hud-tool-btn[hidden]` rule the crown shows for everyone. The same
  trap bites `.adm-view[hidden]`.
- The button lives **inside `#hud-tools`**, so `setMobileFocusMode` and `_hudPositionDock`
  carry it for free — but showing it changes the box's width, so the toggle calls
  `_hudPositionDock()`.
- The list's entrance cascade is registered as **`admRowIn`** in `_JUICE_IN_ANIMS` (that
  registration is the whole opt-in for the blip); past `ADM_SEQ_MAX` a row goes `.quiet`
  and swaps to the unregistered `admRowInQuiet`. **`_admRenderList(animate)` takes the
  flag explicitly** — a re-render that is not an open (typing, a batch landing) sets
  `.is-still` and no animation at all. It cannot be inferred: `_admAutoLoad` awaits the
  roster, and that microtask lands **before the first paint**, so an inferred re-render
  would swallow the cascade the open just set up — which is why it only animates there
  when the open itself rendered nothing. Both keyframes keep the fade inside them with
  `animation-fill-mode: backwards` (invariant 20).
- Enter/exit is `opacity` + `visibility` + a double-rAF `.active` — `display` can't
  transition. z-index **9100 — below prayer/azkar (10000)**, which must cover it.
- `adminPanelIsOpen()` joins the standard guard list (keydown, wheel-zoom,
  `handleMovement`, the mobile canvas-off test, `updateLibPanelLifecycle`,
  `_chalScreenIsClear`, `_chatMustClose`).
- A member with no `discordId` has no maqr node to join to — the row says so rather than
  showing a silent zero.

---

## لوحة مهام المكتبة — a window into MdwnhLibrary

The member's **library tasks**, opened from a chevron on the user card, drawn with the
**library's own pill markup and the library's own CSS**. Code is the `لوحة مهام المكتبة`
block at the end of `game.js`; markup is `#lib-panel` + the additions inside `#user-card`;
styles are split on purpose — the **chrome** is in `style.css`, the **mirrored library look**
is in **`library-tasks.css`** and nowhere else.

**It is NOT maqr's task system, and the two are deliberately unmerged.** The 5-a-day paper
to-dos (`dashboards/{uid}/todos/{date}`) are dateless, capped and reset every day — "what I
do today". These are commitments with a deadline, an owner and points. There is **no bridge**
between them (no "pull into today", nothing writing one from the other); don't add one
without being asked — that was an explicit product decision.

### Identity — Discord id → slug, off the shared roster
`members.json` is already fetched for the fireplace; that fetch now also publishes
**`MDWNH_ROSTER`** (`{list, bySlug, byDiscord}`) and **`_mdwnhRosterReady`**. Library keys all
per-member data by **`slug`**, maqr logs in with a **Discord id**, and the roster is the join.
A **Siraj ghost resolves to nobody** (its `siraj_*` id is not in the roster) so the chevron
never appears for it — deliberate: a test account must never write into real task or points
data. Same for anyone with no library account; the card looks exactly as it did before.

### The three groups
`الحريقة 🔥` (mine, ≤2 days — overdue included) → `بقية المهام` (mine, the rest) →
`قيد إشرافك 👁️` (I supervise it, I'm not on it), which starts **collapsed**. Fire goes
**first** even though the library puts قيد إشرافك on top: burying the burning task under other
people's work defeats the whole reason the split exists. Collapse state is session-only
(`_lib.shut`), like the library's.

**The leader (نواف) never gets a completable pill.** He is never an assignee — the library's
own people picker excludes him — so `watching` is forced true for him and every pill shows
the read-only `٢/٥` badge, exactly as it does in the library.

### The one thing it writes — a TWO-DATABASE handshake
Copied from `completeTask()` + `writeClaim()` in `MdwnhLibrary/js/tasks.js`:

| where | path | value |
|---|---|---|
| library RTDB | `library/tasks/<id>/done/<slug>` | timestamp |
| library RTDB | `library/tasks/<id>/earned/<slug>` | `true` — so re-completing after un-archiving can't pay twice |
| **points** RTDB | `mdwnhLibrary/claims/<NFC dbKey>/<id>` | `{taskId,title,points,color,ts}` |

The **Points site settles that last one at that exact path**. It is one end of a handshake:
if any of the three changes in the library, it changes here **in the same commit**. The key is
NFC-normalised on both ends so أُبي / أبو بندر / ابو مزاحم match.

**No rules change was needed and none should be made.** `library/tasks` is already world
read+write by design (the site has no login) with every field type-checked and
`done/$slug`/`earned/$slug` already declared; this writes exactly the fields the library
writes. Plain REST `fetch` — **no second Firebase SDK app and no listener.**

**The claim card** (`#lib-claim-modal`, `_libShowClaim`) is the library's own «استلم الآن /
لاحقًا», rebuilt in maqr's dark glass. **The claim is already written before the card appears**,
so لاحقًا (and a backdrop press) lose nothing. «استلم الآن» navigates **this tab** to
`POINTS_URL?claim=1&user=<NFC dbKey>`, same as the library — leaving mid-session is safe by
design: the disconnect handlers free the laptop and stash the session, and the login reclaim
puts the player back at it (see **Disconnect / session reclaim**).

### Cost — the reason this is one fetch, not a poll
`library/tasks` is the **whole tree**, and each cover is a 640×320 base64 JPEG **inside its
own record**: measured at **1.24 MB for 60 records**. So: **one fetch on idle after spawn**
(which is what makes the red dot on the chevron honest before the panel is ever opened), then
only on an explicit refresh or an open older than `LIB_REFETCH_MS` (5 min). **Never poll it,
and never put it on the login path.** Points are one `players` read at setup, not live.
Note the leader sees all ~60 pills at once — ~30 MB of decoded covers; the library site does
the same, but don't add anything that makes that list longer.

### Rank chip = the points site's rule, which is RANK-based not threshold-based
`players` minus **سراج and نواف**, sorted by `totalPoints` desc, then
`tier = max(1, 5 - floor(index / 5))` → 🪵 ⚙️ 🥉 🥈 👑 (five per tier from the top). Emoji
only — the names (الخشبيون…الذهبيون) are the `title`, because the card is too narrow for them.
**نواف has no `totalPoints` row at all**, so he gets no chip rather than a made-up «٠ نقطة».

### Gotchas
- **`#lib-panel` is a SIBLING of `#user-card`, not a child.** `body.is-mobile .user-card`
  carries `will-change: transform`, which makes it the containing block for any
  `position: fixed` descendant — a child panel would be measured against the card.
- Its **top is measured on both platforms** (`_hudStackBottom` — see **The HUD stack**), so
  it always starts under the card + tools + azkar rather than covering them. On desktop the
  `right`/`max-height` are computed too; on **mobile only the top is inline** and
  `right/maxHeight` are **cleared**, because the sheet's sides and bottom gap are CSS `inset`
  and a leftover desktop `right` would beat it.
- **The joystick fades out while the panel is open** — `.lib-hidden`, a **separate class from
  `.focus-hidden`**. Sharing one class would mean closing the panel put the joystick back in
  the middle of a work session.
- Enter/exit is `opacity` + `visibility` + a double-rAF `.active` (`display` can't transition).
- **Outside-press dismissal runs in the CAPTURE phase and eats the event**, plus a ~700 ms
  swallow window for the `click` that follows the same `pointerdown` — otherwise the
  dismissing tap also reached the canvas and walked the player.
- **A pill only opens the library if the pointer moved < 10 px** (`moved`). The list scrolls by
  dragging and a drag still ends in a `click`; without this a flick opened a tab every time,
  and a flick starting on the 36 px إتمام circle minted a points claim.
- `updateLibPanelLifecycle()` (per frame, from `gameLoop`, same shape as `updatePiPLifecycle`)
  is the **single** guard that closes the panel — azkar/prayer/dashboard/customizer/fireplace/
  minigame/reading/mobile-focus. The panel is z-index 205, so every one of those covers it;
  an open panel underneath one would be invisible and still holding movement locked.
- The busy state on the إتمام button is a **`.busy` class, never the `disabled` attribute**.

### The «أعمل على» picker (`#task-pick-btn` / `#task-pick-pop`)
A small button beside the task box opens **the same pills with no إتمام button**
(`opts.pick` in `_libTaskPill`); pressing one drops its title into the box. Offering a
complete button from a box that only says *what you're working on* would be the wrong verb.

**It's part of the panel, not a layer over it.** The popover is an in-flow child whose
`grid-template-rows` animates `0fr ↔ 1fr` — the only way to animate an **auto** height
without measuring it in JS. The panel is pinned by its `bottom`, so it grows upward while
the list unfurls downward from under the input, and the pill cascade plays **through** the
0.38 s expansion. A browser that can't animate that property just snaps, which is what it
did before. `.task-pick-inner` needs `overflow: hidden` **and `min-height: 0`** — without
the latter the row never collapses to `0fr`.

**The input is centred by a ghost.** `.task-panel-row::before` is an empty box the width of
the picker button on the opposite side; without it the button shoves the field sideways and
it stops lining up under the «أعمل على» label, which is centred on the panel, not the row.

**It writes nothing of its own.** `_libPickTask` sets `input.value` and dispatches an `input`
event, so the box's existing debounced save stays the single writer of
`users/{uid}/currentTask`. A second save path here would race that one.

It shows **my** open tasks only (الحريقة / بقية المهام) — a task I merely supervise is not
what I'm working on — under their own group ids, so folding here doesn't fold the big
panel's groups. It closes itself when `#current-task-panel` loses `.active` (session over).

### The entrance cascade + its blip
Group heads (`libHeadIn`) and pills (`libTaskIn`) sequence in like the settings panel's rows,
with the same rising pitch sweep — both names are added to **`_JUICE_IN_ANIMS`**, which is
the whole opt-in for the sound, and every open calls **`_uiSeqReset()`** so the sweep starts
deep. Both keyframes keep the fade **inside** them with `animation-fill-mode: backwards` and
an opaque base style (invariant 20 — a skipped animation must never blank the panel).

- **One counter across all groups** (`seq` threaded through `_libBlock`). Per-group indices
  restart at zero, so the second group's first pill would land under the first group's fifth.
- **Capped at `LIB_SEQ_MAX` (14).** Past it the delay stops growing and the pill gets
  `.quiet`, which swaps in **`libTaskInQuiet`** — identical motion, name not registered,
  therefore silent. The leader's list is ~60 pills; sixty simultaneous blips is noise.
- **A collapsed group's pills spend no cascade slots** — they're clipped to zero height, so
  counting them would start the next group mid-run through something nobody can see.

### Group folding is animated, and diverges from the library
The library folds with `display: none`, which cannot be transitioned. Here `.group-body` is a
grid animating `0fr ↔ 1fr` plus opacity. That needs `overflow: hidden` on `.task-list`, which
would slice the pills' drop shadows — hence its bottom padding, and the smaller
`.subgroup` margin that compensates. **This is the one place the mirror deliberately differs;
don't "resync" it back to `display: none`.**

### `.lib-pills` is the CSS scope, NOT `#lib-panel`
`library-tasks.css` is scoped to a **class**, worn by **both** `#lib-panel` and
`#task-pick-pop`, because both draw the same pills. Everything in that file must stay under
it — a bare `.task` / `.count` / `.av` would reach into all of `style.css`.

### Writes use `fetch(..., {keepalive: true})`
«استلم الآن» navigates this tab away, and a normal in-flight `fetch` is **cancelled on
unload**. Every write here is a few dozen bytes, far under the keepalive budget. Without it,
a fast press on a slow link completes the task and loses the claim — the one failure that
costs a member real points.

### The mobile canvas FADES, it doesn't snap
`_lib.canvasOff` is separate from `_lib.open` on purpose. The world pass keeps running
**through** the 0.3 s CSS fade and only stops after it (340 ms). Cutting the render on frame
one froze the canvas while it was still fully opaque, and the old `visibility: hidden` on top
of that read as an instant black snap. On close, drawing resumes on the same frame so there
is live content to fade back in. **Don't reintroduce `visibility: hidden` here.**

### The faces cluster is CAPPED at six
Five faces then a **«+N» disc**, two rows of three, whatever the head-count. A task carrying
twenty-three of the twenty-eight assignable members is not «الجميع», so it drew twenty-two
faces as eight columns and pushed the countdown and the **إتمام button out through the pill's
own `overflow:hidden`** — the button is the only thing on that row that is not decoration.
`LIB_WHO_MAX` / `_libRestHtml()`, mirroring the library's `WHO_MAX` / `restHtml()`.
- The disc opens `.lib-who-pop` — every member on the task, face and name — **`position:fixed`
  on `<body>`**, because the pill is `overflow:hidden` inside a panel that scrolls.
- **Its click listener is on the document in the CAPTURE phase.** A bubbling one runs AFTER
  the pill's own, i.e. after `window.open` has already thrown a library tab up over it.
- The faces stay 22px. The library draws them 2.5× bigger in its read-only detail CARD, which
  maqr has not got — in the pill they are a marker, not the row's subject.
- `.who` is `flex:0 1 auto;min-width:0` and `.who-rest` clips: the net under the cap is that
  the stack gives before the button does.

### RESYNC
`library-tasks.css` and `_libTaskPill()` are hand-copies of `MdwnhLibrary/css/tasks.css` and
`taskPill()`. **Nothing automates the sync.** If the pill changes there, change it in both
places here — the library's own `CLAUDE.md` carries the matching note.
**Still drifted: the COVER.** A task carries `pic` (a version) and the bytes live at
`library/taskimg/<id>`; `_libTaskPill` still reads `t.img`, so every pill falls back to 📌.
The library's `CLAUDE.md` carries the four lines that fix it.

---

## Character Customization (تخصيص الشخصية) + Hats

Two things a player owns and **everyone** sees: the **ring colour** around their avatar and
a **hat** on top of it. Opened from the sparkly **تخصيص** button in the الشخصية settings
category. Code lives at the end of `game.js`; markup is `#char-custom-overlay`; styles are
the `تخصيص الشخصية` block in `style.css`.

### Firebase — under `users/{uid}`, on purpose
```
users/{uid}/ringColor = '#rrggbb'
users/{uid}/hat       = { id, x, y, scale, rot }   // null = no hat
```
This is the documented **exception** to "private per-user state belongs in `dashboards`":
every client must **read** these to draw the avatar, and they're written only on حفظ (a
handful of times ever), so the fan-out through the global `/users` listener is negligible.
`id` = the file name inside `Hats/`. `x`/`y` are offsets in **PLAYER_SIZE units** and
`scale` is a **multiple of PLAYER_SIZE**, so a placement is resolution-independent and
survives the second-floor scale-up untouched. `rot` is radians. Anything read back goes
through `sanitizeHat()` / `_validHex()` before it reaches draw code.

The ring colour **wins over the old defaults**: `player.ringColor || (isCurrentUser ?
COLORS.blue : '#ffffff')`. The local-player ambient glow is tinted from it too.

### Hats folder — discovery is TWO-PATH (this is the "auto-updates" bit)
The site is statically hosted, so a directory **cannot** be listed in production.
`loadHatManifest()`:
1. **localhost / LAN IP only** → fetch `Hats/` and parse the dev server's directory index.
   Dropping a new PNG into `Hats/` shows it on the next reload, no manifest step.
2. **Production** → `Hats/hats.json`, regenerated by the **`.git/hooks/pre-commit` hook**
   (which also `git add`s it). So committing a new hat ships it automatically.

AppleDouble sidecars (`._name.png`) and dotfiles are filtered out at both ends. The
manifest is re-read on **every** open of the picker, so a hat added mid-session appears
without a reload. Preloaded on idle after spawn — never on the login path.

### Cropping is mandatory
The source PNGs are 1000×1000 with the hat floating in the middle of mostly-empty canvas.
`_cropHatImage()` alpha-scans to a tight bbox and caches the cropped canvas in
`_hats.cache[id]` (`{ img, canvas, url, ready, failed }`). **Both** the picker previews and
the in-world draw use the crop — uncropped, a preview would be a speck and every
offset/scale would be meaningless.

### Hat physics — a jointed STACK hinged at the avatar's centre
The old single "chase the anchor" spring is **gone**; don't reintroduce it. Every hat a
player wears is a **link in a chain whose one pivot is the avatar's centre**
(`_updateHatChain` / `_hatChainState`, per-player state on `player._hatPhys`).

- **Angles are RELATIVE and compound.** A link's angle is measured against the link below
  it; the angle a hat is *drawn* at is the **sum of every angle beneath it**. So the
  bottom hat barely tips and the fifth one whips — with **no per-hat fudge factor**. That
  is the whole reason it's a chain and not five independent springs.
- **Inertia sets the frequency.** A link's `L` is the **gap** between it and the hat below
  (the bottom link measures from the avatar's centre), and its inertia is `I = L × (how
  many hats it still has to carry)`, with ω₀ = `sqrt(HAT_K / I)`. The bottom link drags
  the whole tower — slow, heavy, barely moves — while the top link carries only itself and
  answers the same shove **faster and wider**. That is the brief's "farther from the
  anchor ⇒ more frequency and intensity", out of the physics rather than a per-hat
  multiplier.
- **`HAT_COUPLE` is deliberately LOW (0.22).** Crank it and the whole tower is *forced* at
  the base link's slow frequency, every hat rings in unison, and the per-link frequency
  spread above becomes invisible — which is the exact look this rewrite replaced. It is
  high enough to read as a whip and no higher.
- **The drive is the pivot's ACCELERATION** (pseudo-force in the pivot's frame), which is
  why nothing needs special-casing: stopping after a sprint, a direction flip, the kidnap
  yank, the sofa hop and a session start are all the same term. Each link then hands the
  tangential acceleration of its own tip **up** the chain (`HAT_COUPLE`) — that coupling
  is what makes the top hat look driven by the hats under it, not by the player.
- **The anchor is the avatar's centre**, so a hat placed high sweeps a real arc (it
  travels sideways as it leans) and a hat parked on the centre spins in place. Each link
  also carries a little **vertical give** (`HAT_YDRIVE`), so a landing compresses the
  stack and springs it back. Position is otherwise **welded** to the anchor — no
  positional lag, so the stack never floats along behind the player.
- **Chain order is by distance from the pivot**, not array order; **draw order stays the
  array order** (z-order), which is why `st.angle` / `st.yOff` are indexed by the hat's
  original index.
- **`link.bias` is load-bearing.** A perfectly balanced 2D stack cannot be toppled by a
  purely vertical jolt — the hair of built-in lean is what lets the sofa hop wobble it. It
  is a **deterministic hash of the hat id**, never `Math.random()`: two clients watching
  the same player must see the stack fall the same way.
- Anchor velocity is converted to **PLAYER_SIZE units per frame**, so the swing is
  identical on the ground and on the 1.2× mezzanine.

Two guards that matter (unchanged in spirit from the old spring):
- A **teleport/kidnap snap** (`HAT_JUMP`, in player-units/frame) **re-anchors** instead of
  handing the chain a one-frame acceleration the size of the map. Every angle, vertical
  offset and drive term is additionally clamped (`HAT_ANG_MAX` / `HAT_TOT_MAX` /
  `HAT_Y_MAX` / `HAT_ACC_MAX`).
- **`gameState._pipPass`** — PiP runs its own rAF over the same draw code, so it would
  integrate the chain a second time each frame (double speed). `renderPiPInto` sets the
  flag; the chain **draws but never advances** during that pass.

The chain is rebuilt when the hat list changes (`st.key` = ids + offsets), so a saved
placement re-derives the segment lengths. The customizer's preview is **static DOM** and
deliberately runs none of this.

### The scene
`openCharCustom()` fades in a "3D space" (gradient room + a perspective floor plane), the
character **drops from above** and lands with squash & stretch onto its own contact shadow
(`_ccPlayDrop` — one rAF tween: easeInQuad fall with stretch, then a damped squash
oscillation; the shadow tightens as it nears the floor), and the panel slides in from the
left. Desktop offsets the stage right of the panel; mobile makes the panel a bottom sheet
with the character above it.

- **Colour wheel** (`#cc-wheel`): an HSV wheel painted **once** into a canvas (hue =
  angle, saturation = radius); the الإضاءة slider supplies value. Plus a hex field and
  افتراضي. Picking uses `pointer*` events so mouse and touch share one path.
- **Hats**: cropped previews; picking one unlocks scale / rotate / x / y, and the hat can
  be **dragged directly on the character**. The tools lock with a **`.cc-unlocked` class,
  never the `disabled` attribute** (iOS touch leak — see azkar).
- **حفظ** writes both fields in one `update()`, applies them locally immediately (no
  round-trip wait), and closes.
- Editing is a **working copy** (`_cc.hat`) — nothing is committed until حفظ, and
  `ccSyncFromPlayer()` refuses to stomp an in-progress edit when the users listener fires.
- **Input lock**: `charCustomIsOpen()` bails the window `keydown`, the wheel-zoom handler
  and `handleMovement` — same pattern as the dashboard. `body.cc-active` locks body scroll
  and hides `#game-canvas` on mobile.

## End-of-Session Card + Image Attachment

The success card (`#success-card` / `.success-content`, **white** bg — the documented exception) is styled as an **invoice/receipt** (`.success-receipt`): a dashed separator under the centred header, a **fake CSS barcode** (`.success-barcode-bars` repeating-linear-gradient + a monospace `#success-barcode-num` set per open in `clearSuccessPhoto`), and a **torn-receipt bottom edge** — an `::after` row of downward white SVG triangles (a CSS `mask`/conic approach was tried first and silently didn't cut, so it's an inline-SVG `background` instead). Same layout as before (avatar + name + "أحسنتم!"; photo focal area; stats; task; note; close). It has a **drag-drop image → 1:1 crop → taped-on photo** flow (`setupSuccessCardUI`, wired in `startGame`). The photo is purely **local/visual** (for the screenshot the user sends) — never persisted.

- **Photo states** (`successPhotoState(state)`): `'drop'` (add zone shown — the default on open, set by `clearSuccessPhoto`), `'photo'` (taped photo + `✕`), `'removed'` (the whole `#success-photo-wrap` is `display:none` so the card **shrinks**, and a no-pill underlined **"اضافة صورة"** text — `#success-add-photo`, a sibling under the card in the column-flex `#success-modal` — appears; clicking it returns to `'drop'`).
- **Drop/upload**: drag an image anywhere on the card, or click the dashed drop zone → file picker. Either calls `loadCropImage(file)`.
- **Paste**: «نسخ من الحافظة» (`#success-photo-paste`) sits **inside** the drop square, so the drop zone had to stop being a `<button>` (nested buttons are invalid) — it's a `div[role=button]` with its own Enter/Space handler now, and the paste button `stopPropagation`s so it doesn't also open the file picker. Two paths, both ending in `loadCropImage(blob)` → the **same crop/zoom modal** a dropped image gets: the button calls `navigator.clipboard.read()` **synchronously inside the gesture** (Safari revokes the permission if you `await` anything first), and a `document` `paste` listener catches ⌘V/Ctrl+V, which needs no permission at all and is the fallback where `clipboard.read()` is refused. Failures put an Arabic hint on the **zone’s own `.success-photo-text` line**, tinting the zone via `.is-error` — **never on the button and never the `disabled` attribute**: swapping the button’s own label read as “the button is gone” and left nothing obvious to press on the one failure («لا توجد صورة في الحافظة») the user has to retry after copying something. `_successPasteClearHint()` wipes a leftover message on every success and on each card open.
- **Crop modal** (`#crop-modal`, dark glass): a fixed **4:3 frame** (`aspect-ratio`) with the image `cover`-scaled; pan (mouse/touch drag), zoom (slider + wheel), clamped so the image always fills the frame (`_cropClamp`, uses `_crop.fw/fh`). **Confirm** (`confirmCrop`) draws the visible region to a 480×360 canvas → `toDataURL('image/jpeg')` → `successPhotoState('photo')`. The drop box + taped photo are also 4:3.
- **Taped-on effect** (`.success-photo-taped`): **replicates the dashboard avatar tape** — cream cutout, tape strip (`::before`), tilt, warm `sepia`+`multiply` tint — sized as a centred focal point. The `✕` is pinned to the photo box corner at the **wrap** level so it shows in BOTH the drop and photo states.

### Invoice archive + browser ("ذكريات العمل")
Each end-card is archived to Firebase **on close** (`saveInvoice`, wired to `#success-close`). `_pendingInvoice` (`{ mode, minutes, task, finishMs }`) is captured when the card opens; the **displayed** minutes are stored (so a >2h-confirm-adjusted free session saves the adjusted value).

Cost-friendly RTDB layout (one-shot `get()`s only, NO live listeners, photos split from metadata):
```
dashboards/{uid}/invoices/{finishMs}      = { mode, task, minutes, finishMs, hasPhoto }   // light, listed
dashboards/{uid}/invoicePhotos/{finishMs} = "<small 4:3 JPEG dataURL>"                      // heavy, lazy-loaded
```
The photo is downscaled to a **320×240 @0.55 JPEG thumbnail** (`_makeThumb`, ~15–30 KB) before saving — never the full-res image, never under `users/`. Siraj writes to its own node (removed on disconnect), so test invoices self-clean.

**Memories view (lives INSIDE the dashboard overlay, gated `dashboardAllowed`).** There is **no** separate browser overlay and **no Shift+click** any more — the dashboard circle always opens the dashboard. A **temp "invoice" card peeps from the LEFT** (`#dash-invoice-peep`, receipt look: cream paper, sharp corners, torn bottom, taped strip, handwritten "gibberish" `.inv-scribble` lines). Mirror of the to-do paper that peeps right.

- **Open** (`dashOpenInvoices`): clicking the peep (or **swipe-right** on mobile) adds `.invoices-open` to `#dashboard-overlay` → the `.dash-stage` slides off to the right leaving a sliver peep + a `#dash-invoice-back` chevron (both act as the back button). The temp card glides to centre (`.to-center`) and the full-screen grid `#dash-invoice-view` fades in.
- **Scatter + 3D flip** (`dashBuildInvoiceGrid`): cards start stacked at viewport centre (`translate+scale(0.4) rotateY(0)` = temp **front** showing) and animate to their CSS-grid slots while flipping to `rotateY(180deg)` (the data **back**). Each `.inv-card` is `transform-style: preserve-3d` with `.inv-front` (temp) + `.inv-back` (receipt: white, torn bottom, taped photo, barcode). **Virtualization**: only cards within the viewport at build time get the scatter/flip (`r.top > innerHeight+40` → left at rest); the rest render normally below the fold (scroll, no lag).
- **Collapse** (`dashCloseInvoices`): clicking the dashboard peep/chevron/scrim (or **swipe-left**) reverses — visible cards merge back toward centre + flip to the temp front, the stage slides back in. `dashResetInvoices()` is the no-animation teardown, called by `openDashboard`/`closeDashboard`.
- **Gestures** form a horizontal strip `[invoices] ← [main] ← [to-do]`: swipe-right moves "back" toward invoices, swipe-left "forward" toward the to-do paper.
- **Data**: one-shot `get()` of `invoices` metadata, most-recent `INVOICE_LIMIT=60`, photos **lazy-loaded via `IntersectionObserver`** (`_lazyLoadInvoicePhotos`).
- **Mock data**: `dashSeedMockInvoices()` injects `DASH_MOCK_INVOICE_COUNT=80` fake invoices **only for Siraj test ghosts** (their dashboard node is ephemeral, removed on disconnect) — never the owner's real archive. To test the grid/virtualization, enter as a Siraj ghost.

---

## Common Bugs & Fixes (lessons learned)

| Bug | Root cause | Fix |
|---|---|---|
| Drawer can't pull up on mobile | `!important` on `transform` beats JS inline style | Remove `!important` from all focus-sounds-panel `transform` rules |
| Coop anim plays for departed members | Departed UIDs never removed from `activeGroupMembers` | Set-filter in `setupSpLiveListener` + delete from `coopAnim.members` |
| Focus sound won't play after buffer not loaded | `!buf` returns early after gainNode already connected | Disconnect gainNode before early return: `gainNode.disconnect(); return;` |
| Timer shows before countdown | `startTime` too close to `now` | Use `startTime = serverNow() + 3500` |
| Session blocks replaying | Session never deleted | `returnFromCoffee/returnFromRace` must write `null` |
| Focus sounds silent on fresh page load | `startSound()` fails silently when context suspended | `resumeCtx` handler rescans `active && !nodes` after resume |
| YouTube ad plays silently | No ad detection | Detect via frozen `currentTime`; mute + show `#yt-ad-overlay` |
| انتهيت opens keyboard on iOS | `button[disabled]` leaks touch events through overlay | Never use `disabled` attr for visual-only lock. Use CSS class `.unlocked` and check it in click handler |
| Azkar overlay scroll reveals page behind | Scroll propagates out of list + body scroll not locked | `overscroll-behavior: contain` on `.azkar-list` + `body.azkar-active { overflow: hidden }` |
| Mouse scroll zooms game inside azkar | Global wheel handler runs even when overlay open | `stopPropagation` on overlay wheel events + early return in global handler when `azkar.active` |
| Azkar overlay content shifted down on desktop | `bottom: -200px` makes overlay taller; `align-items: center` moves content 100px lower | `padding-bottom: 200px` on overlay restores correct centering |
| Same fix breaks mobile | `bottom: 0` on mobile + `padding-bottom: 200px` shrinks usable area | `body.is-mobile .azkar-overlay { bottom: 0; padding-bottom: 0 }` |
| Mobile float button invisible | CSS class toggle fights specificity | Use `style.display = 'flex'/'none'` directly in JS, never hidden class |
| Focus sounds not clickable outside work session | Base panel has `pointer-events: none`; azkar-active override never adds `all` | `body.azkar-active .focus-sounds-panel { pointer-events: all }` |
| Time picker scroll wheel does nothing | `deltaMode: 1` (physical mouse = lines) sends `deltaY: 3`; old 50px threshold never reached | Normalize: `deltaMode===1 → deltaY*40`; threshold 40px → one click = one unit |
| Siraj time spoof doesn't reset completion | After setting fake time, old Firebase completion still hides the button | Clear `gameState.azkar.completed = {}` and write `null` to Firebase on apply |
| Prayer gradient glow stretched on mobile portrait | `ellipse` radial gradients look like ovals on narrow screens | `body.is-mobile .prayer-overlay-bg::after { display: none }` |
| PiP close "doesn't work" (reopens itself) | `openPiPMode` is async; `pip.active` set only after `await requestWindow`, so a close mid-await is undone when the pending fallback resolves | `_opening`/`_closing` flags; `closePiPMode` clears `_opening` to cancel in-flight opens |
| PiP button overlaps leave pill / looks like a stray icon | Icon-only circle placed at `top:68px` collides with `leave-wrap` (`top:54px`) | Labeled pill ("الوضع المصغر") at `top:96px`, stacked below logout + leave |
| PiP draws but never centres / thrashes mask canvas | Calling full `render()` reuses `gameState.maskCanvas` sized to main canvas → per-frame realloc | Dedicated `renderPiPInto` context-swap; skip `drawFocusMask`, use local `_pipVignette` |
| PiP works on Chrome but stays trapped in-tab on Safari | Safari has neither Document PiP nor `canvas.captureStream()`, so tiers 1+2 are skipped | Tier 3 `_pipOpenPopup()` (`window.open`) — a real popup window that escapes the tab (not always-on-top, but Safari's best for live content) |
| Azkar overlay flashes/flickers (whole or partial) even while idle, on Chrome/DuckDuckGo | Continuous per-frame repaint: animated `filter: blur()` fog + `prayerGlow` scale/opacity + button `background-position` shimmer; `will-change`/`isolation` on the root made it one giant repainting layer | Make those effects **static** (no infinite animation); don't promote the overlay to its own layer; hide `#game-canvas` while azkar is open so its 60fps repaint can't contend |
| Mobile "borderline unusable, sometimes fine" | Sustained GPU cost (varies w/ thermal & memory pressure): full-DPR canvas + `backdrop-filter` panels re-blurred every frame over the live canvas + ~20 `ctx.shadowBlur`/frame | DPR cap (`isReducedGraphics()`), remove `backdrop-filter` on `body.is-mobile`, global shadow-blur guard (`installLowGfxShadowGuard`), defer boss SFX to idle |
| Prayer times stuck on `--:--` for some users | `api.aladhan.com` blocked by their network/VPN; fetch had no timeout/retry/offline path | Resolve coords (in-memory or curated `PRAYER_LOCATIONS`), try API with 8s `AbortController`, else **compute locally** (`computePrayerTimesLocal`, method=5); retry if no coords |
| Reload (Android tab discard) dumps user on lobby/gender screen, "session lost" | Discord flow always stopped at the welcome screen on reload | Auto-resume: `ACTIVE_SESSION_KEY` in localStorage while in-game (cleared on explicit logout) → re-enter directly; `startGame` restores the session from Firebase |
| Landscape→portrait wrecks the UI until reload | Android reports the **stale (old-orientation)** `innerWidth/innerHeight` for ~1s after rotating; relayout committed those and stopped | Settle loop that waits until viewport aspect agrees with `screen.orientation` (updates immediately) before committing; backing-store pixel clamp; lock viewport meta |
| Working player shown mid-map for others, correct for self | Observer code used `!userData.x` which treats a legit `x:0` (centre-column laptop sits at world x≈0) as "no position" → scatters them to a random spawn | Explicit presence check (`x !== undefined && !== null`); never relocate `activeInGame` users; position heartbeat every 4s while in a session |
| Can join another player's session while already in one (breaks both) | When you start your own session, the proximity guard renders the nearby panel empty but never **hides** the already-showing `sp-join-panel` (hide only ran inside `checkNearbyCoopSession`, skipped when in a session) | Explicitly hide `#sp-join-panel` + clear `nearbyCoopId/nearbySoloId` in the guard; re-check `pomodoro.active/freeMode.active/sp.phase` in `confirmJoinCoopSession`/`confirmJoinSoloSession` |
| Perennial ghost laptop — working user invisible to others, laptop shows timer but `هذا الجهاز تابع لـ` with nobody there | `activeInGame` set **once** at login; a flaky-mobile socket drop fires `onDisconnect.set(false)` server-side and the silent reconnect never restored it → observer skips the avatar but the laptop doc still renders the timer | `.info/connected` listener re-asserts `activeInGame=true` + **re-arms** the disconnect handler on every (re)connect; `reassertActiveSessionAfterReconnect()` re-claims the laptop. See **Disconnect / session reclaim** |
| Disconnected/closed-tab user keeps a laptop unusable for ~30min–2h | The pomo/free doc lingered (claimed) until `cleanupAbandonedPomoSessions` freed it; free mode's `onDisconnect` deliberately kept it claimed as an AFK badge | Unified model: `onDisconnect` **removes** the laptop (others see nothing) + stamps `lastPomoSession.abandonedAt`; reclaim within `RECLAIM_WINDOW_MS` on next login (old laptop if free, else random). See **Disconnect / session reclaim** |
| Reclaimed session lost after a reconnect | `reassertActiveSessionAfterReconnect` cleared `lastPomoSession` to `null` then armed only the `abandonedAt` child → a later disconnect stamped a timestamp onto an empty object | Re-**persist** a full live snapshot via `trackSessionForReclaim` (never `set(null)` while still in-session) |
| Mobile: re-tapping the same laptop fires free/pomo "without asking"; happens only on the same laptop | The opening tap is followed ~300ms later by a synthesized `click` at the same point; if a mode-select button sits under it (depends on the laptop's screen position) it fires immediately | Ghost-click guard: `showLaptopModeSelect()` stamps `_modeSelectOpenedAt`; `mode-select-pomo`/`mode-select-free` ignore presses within 500ms (`modeSelectGhostClick()`) |
| Reconnected user shows no `أعمل على` / no timer for others; or disappears for them after PC sleep/wake | `activeInGame` was set once at login and only re-asserted by `.info/connected`; `updatePlayerPosition` never wrote it, and the position heartbeat only runs during a session — so an idle/walking user stayed `false` after a drop, gating their presence + timer + task label | Write `activeInGame:true` on every `updatePlayerPosition`; add a session-independent **10s presence heartbeat**; re-assert on `visibilitychange`/`focus`/`online`. See **Presence self-heal** |
| Friend's avatar "snaps places" / teleports while walking; smooth for one person, jumpy for another | Three causes: (1) a laggy Firebase position write (4s heartbeat during a break, stop write) fed the interpolation buffer with a stale-but-fresh-timestamped sample → backward yank; (2) WS-over-TCP delayed bursts starved the fixed 140 ms buffer, then interpolation jumped the avatar forward to catch up; (3) the root one — samples were stamped **on arrival**, so network jitter became part of the replayed motion (measured: 5–250 ms of jitter replayed at 6× true walk speed with 648-unit single-frame jumps) | Rebuilt as a real jitter buffer: sender-stamped samples + a minimum-filtered clock offset, an adaptive `delay` driven by a jitter EWMA, and rate-capped error smoothing so a correction is always a glide, never a move. Same jitter now replays at exactly true speed (max 5.43/frame). See **Player Position Sync → Smooth movement** |
| "Disable idle animation while working" setting did nothing in free mode | The per-avatar `isWorking` flag only tracks pomodoro, so in free mode the local avatar fell into the idle-breathing branch and the suppression (gated on `isWorking`) never fired | Gate the local-avatar suppression on `localInWorkPhase()` (covers pomodoro **and** free mode) and freeze both the bounce and the breathing |
| After-prayer azkar: tapping a count button scrolled the whole overlay down | `nextEl.scrollIntoView()` bubbles to the nearest scrollable ancestor; when the list itself couldn't scroll it scrolled the overlay/page | Scroll `listEl` only via a manual `listEl.scrollTo({top})` computed from bounding rects — never `scrollIntoView` |
| Camera rubber-bands to a default framing on every zoom, forever, after a reading session ends | The `exiting` camera phase only cleared once zoom converged on its target — but the scroll wheel was unblocked during it, so any scroll moved zoom away and the phase **never cleared**. `updateCamera()` early-returns while a reading phase is set, so the exit lerp owned the camera for the rest of the session and fought every gesture | Time-bound the exit tween (`READING_EXIT_MS` + hard `READING_EXIT_MAX_MS`), and have both zoom handlers call `abortReadingCamera()` so a user gesture always hands the camera back |
| World is black / half the elements missing, "still loading", long waits, only a fresh tab fixes it | Two compounding causes: (1) `startGame`'s **flat 15s** boot failsafe fired mid-load on a slow link and slid the loader away over a world cache nothing had composited into yet; (2) the SW's stale-while-revalidate re-downloaded **all ~18 MB of art on every visit** even though it was cached, competing with the requests the page waits on (and wedging the connection pool — hence the fresh tab) | Content-hash the layers (`manifest.json` → `?h=`) and make the SW treat them as **immutable, cache-first, never revalidated** → a repeat visit fetches zero art bytes; replace the failsafe with a **progress watchdog** that only releases after a real 25s stall (or a 120s ceiling). See **Loading Strategy** |
| New art needs a hard refresh to show up, every time | `sw.js` was pure cache-first for `Art/` — a cached file was pinned until its URL or `CACHE_VERSION` changed | Stale-while-revalidate in production (fresh copy lands for the next reload), and **network-first on localhost/LAN** (`IS_LOCAL`) so the dev loop always sees the file on disk |
| Hats run at double speed / jitter while PiP is open | PiP renders the same draw code on its own rAF, so `_updateHatChain` integrated twice per frame | `gameState._pipPass` set by `renderPiPInto` — the PiP pass draws the chain but never advances it |
| SVG crescent renders as a plain filled circle | An arc whose radius is smaller than half its chord is silently scaled UP to fit by the SVG spec, so the two-arc crescent became two identical semicircles | Build it as a `<mask>`: a disc with an offset disc punched out |
| Players pop out and back in mid-session for me; they never actually disconnected | `activeInGame` is flipped false server-side by `onDisconnect` the instant their socket blips (mobile data, sleeping laptop) and healed a second later by their own `.info/connected`. The users listener removed them the moment they left the snapshot, so a blip = a visible departure + rejoin | Grace period: stamp `_presenceLostAt` instead of removing; `updatePresenceGrace()` commits the exit only after `PRESENCE_GRACE_MS` (8s) still-gone, and **any WebSocket packet cancels it**. See **Presence self-heal** |
| Others see me snap onto the sofa; no hop, and the reading sequence looks nothing like it does for me | `handleMovement` bails while seated, so nothing is broadcast during the 0.64s sit animation — observers only got the Firebase write at the end, i.e. a teleport | Relay the hop as a one-off `{t:'sit'}` event and replay it remotely through the same pure stepper (`_stepSitAnim`). See **Player Position Sync → the sofa hop** |
| المدفئة overlay snaps in instead of fading | `display` can't transition, and `.active` set `display:flex` and `opacity:1` in the same frame | Keep it laid out always; drive enter/exit with `opacity` + `visibility` and apply `.active` after a double rAF (same as azkar/prayer) |
| After-prayer azkar: the focus-sounds panel flashes for a few frames, then vanishes | `body.azkar-active` lifts the compact panel to z-index 10001 — above the prayer overlay (10000) — so it was visible until the azkar overlay (10002) finished fading in over it | `body.azkar-after-prayer .focus-sounds-panel { display: none }` — there's nothing to mix during salah |
| After-prayer azkar per-prayer colours don't apply | `.azkar-overlay[data-prayer=…] .azkar-count-btn` ties `.azkar-overlay[data-mode="morning"] .azkar-count-btn` on specificity (0,2,1), and the mode rules come later in the file, so source order hands them the win | Prefix the per-prayer rules with `body.azkar-after-prayer` (0,3,1) so they win regardless of order |
| Race + fig zones play the join sound but no panel ever appears; laptop-boss works fine | `MINIGAMES_ENABLED` was left `false` after the games table was wired. The zone press still ran `joinOrCreateMinigameLobby` (hence the sound) and wrote a lobby session to Firebase — but `listenToRace`/`listenToCoffee` were skipped, so `gameState.race.session` was never populated and `showRaceLobby` never ran. Laptop-boss was unaffected because it's solo: `openBossConfirm` opens its modal locally and needs no listener | `MINIGAMES_ENABLED = true`; the separately-dead old break-room rects moved behind `MINIGAME_LEGACY_ZONES` |
| Settings panel opens completely empty on Firefox | The rows sat at `opacity: 0` and relied on the `settingsRowIn` keyframe to reveal them; Firefox sometimes never triggered the sequence, so nothing was ever faded in. Same root cause as the earlier pomodoro-settings blank | Keep the fade in the keyframes, keep the base style opaque, and hide during the delay with `animation-fill-mode: backwards` — a skipped animation costs the flourish, not the content |
| Settings/pomodoro rows slide in at full opacity — no fade, looks wrong (every browser) | The Firefox blank-panel fix above was first done by **deleting the fade** (`transform`-only keyframes, base `opacity: 1`), which cured the blank but left the cascade fadeless | `backwards` fill mode gives both: fade restored inside the keyframes, base style still opaque |
| Reader closes the tab mid-session → the whole reading session is lost | Reading time was only written at انتهيت (`runTransaction` on `books/{slug}/totalMs` + the leaderboard), so nothing at all existed until the session ended | `bankReadingProgress()` commits the delta since the last bank every `READING_BANK_INTERVAL_MS` (60 s); `endReadingSession` just banks the tail. `r._bankedMs` is what stops double-counting |
| Reader returns after closing the tab and is **frozen** — can't move at all, mezzanine drawn over them; only deleting `users/{uid}/x,y` in Firebase frees them | A seated player's stored `x/y` **IS the sofa cushion**, and the sofas are solid furniture in the collision mask. The login restore guards on `!checkCollision(...)` — but `checkCollision` returns **walkable for everything until the collision masks decode** (`if (!worldCollision.built) return false`), and the restore normally lands first. So the cushion position was accepted, and the masks landing a moment later buried the player inside the couch. The books sofas sit **under the mezzanine footprint**, hence "stuck on floor 1 seeing floor 2" | Three layers: the restore skips the stored position when `data.sitSeatId` is set; `sitSeatId/sitX/sitY` are nulled by `onDisconnect` (armed per-field in the `.info/connected` block) so the seat frees and the stale seat can't be restored; and `_unstickLocalPlayer()` runs the moment `worldCollision.built` flips, spiralling any genuinely-buried free player out to the nearest walkable point |
| Timer reads `61:00` after an hour of work | Every clock was hand-built as `mm:ss` with no hour rollover | One `formatTime`/`formatTimeMs` that emits `h:mm:ss` past an hour, + `setTimerText()`'s `.has-hours` class so the wider string still fits the HUD |
| Phone is laggy **even on بطاطس**, and sometimes opens into a black voided world with no elements at all | One cause, not two: the tab was sitting at ~200 MB of decoded canvas/bitmap memory, so it GC-thrashed constantly (lag no graphics tier could touch, because **بطاطس gates drawing, not holding**) and the browser started **refusing decodes** — silently, skipping that layer, and the layer that loses a memory race is the biggest one, i.e. the background. ~112 MB of it was pure waste: the four `keep: true` world layers were held at full 2210×3160 (27.9 MB each **regardless of file size**) even though two are 99.85% transparent and two are soft gradients | Shrink the resident layers at decode (`shrink` on `WORLD_LAYERS` → `_shrinkResidentLayer`): crop the lights sheets to their `lightBox` union, downscale the day overlays. Plus a tighter `worldCache` on reduced tiers, no speculative Lemo Play warm on mobile, and a bounded **re-decode pass for failed layers** at the end of `loadWorldArt` (memory is freest there). ~200 MB → ~50 MB. See **The World → Perf notes** |
| World renders soft/blurry-wrong (nearest-neighbour) after playing a minigame | The race/fig/boss renderers set `ctx.imageSmoothingEnabled = false` for their pixel art and never restore it — it's one shared context, so the next world frame inherited it (violating hard invariant #16) | `render()` re-asserts `imageSmoothingEnabled = true` each frame rather than chasing every minigame exit path |
| Disconnected user never leaves — others still see their avatar forever | Ending a reading session ran `onDisconnect(ref('users/{uid}')).cancel()` to disarm its own ghost-cleanup. **`cancel()` cancels the queued ops of that location AND all its children**, so it also wiped the presence handlers armed at login (`activeInGame` → false, `activeSession` → null). That user's tab close then cleared nothing, and `listenToPlayers` (which gates purely on `activeInGame === true`) kept rendering them. Only `.info/connected` re-armed it, so it self-healed only if they later had a network blip — hence "sometimes" | Arm/cancel the reading fields **individually on their own child refs** (`armReadingDisconnect` / `cancelReadingDisconnect` + `READING_DISCONNECT_FIELDS`). **Never `onDisconnect(...).cancel()` on `users/{uid}` or any other node that has child ops armed under it** |

---

## Design Language (Apple HIG)

- **Glass**: `rgba(18,18,18,0.68)` + `backdrop-filter: blur(20px) saturate(1.6)`
- **Borders**: `rgba(255,255,255,0.09)` — barely visible
- **Shadows**: `0 4px 24px rgba(0,0,0,0.30)` — soft, low spread
- **Typography**: weight `600` primary, `rgba(255,255,255,0.42)` secondary
- **Spring transitions**: `cubic-bezier(0.34, 1.56, 0.64, 1)`
- **Pills**: `border-radius: 50px` for action buttons
- **Panels/drawers**: `border-radius: 25px` — all corners, including the mobile bottom-sheet sounds drawer
- **Colors**: dark theme, no bright whites, accent `rgba(255,255,255,0.85)`
- **Arabic text**: always RTL-compatible; use `direction: rtl` where needed

**Exception — success/end card** (`.success-content`): uses **white background + dark text**. This is intentional — the user prefers the old white UI for the session-complete screen. Do not apply dark glass to `.success-content`.

---

## Key Constants (game.js)

```
MOVE_SPEED = 5
PLAYER_SIZE = 70
IMG_W, IMG_H = 2210, 3160  → source art size (Art/Workspace/ layers)
WORLD_SCALE = 0.54         → world ≈ 1193 × 1706 px (one combined scene, both rooms)
FLOOR2_SCALE = 1.20        → player size on the second floor / top of the stairs
MASK_DIV = 2               → collision masks are half-res (1105 × 1580)
RACE_LAPS = 3
MOBILE_BREAKPOINT = 1024   (window.innerWidth)
WIND_PARTICLE_COUNT = 30   (desktop)  / 10 (mobile)
```
> The old `BG_SCALE` / `ROOM_COUNT` / `BG_WIDTH` / `TABLE_BOX` / `ROOM_SEAM_Y` /
> `DOOR_*` constants are legacy — still defined so the (unreachable) minigame code
> compiles, but the world no longer uses them.

---

## Shared Pomodoro Firebase Cleanup Rules

`sharedPomo/sessions/{hostId}` is TEMPORARY — must not linger.

1. Host deletes it 12s after `startTime` in `launchSharedPomoWork`
2. `cancelSharedPomo()` deletes it immediately
3. `leaveSharedPomo()` removes only the local participant's entry
4. Invite doc (`sharedPomo/invites/{uid}`) cleaned up on accept/decline/timeout

---

## DPR Canvas Scaling

```
canvas.width/height = viewport * dpr   (physical pixels)
canvas.style.width/height = viewport   (CSS logical pixels)
render(): ctx.save(); ctx.scale(dpr, dpr)  → all drawing in logical px
drawFocusMask: uses physical mCanvas; player positions computed with * dpr
```

---

## Adding a New Feature — Checklist

1. **UI**: Add HTML in `index.html`. Follow glass design language. Arabic labels.
2. **Styling**: Add CSS in `style.css`. Add `body.is-mobile` variants if needed. Never `!important` on transforms.
3. **Logic**: Add to `game.js`. Wire Firebase sync if the state should persist.
4. **Firebase keys**: Follow existing path patterns through `lobbyPath()`.
5. **Mobile**: Test by resizing browser to <1024px. Check joystick, leave button, float button positions. No sounds drawer on mobile.
6. **Cleanup**: Store unsubscribe functions, call them on logout/leave/cleanup.
7. **Edge case scan** (MANDATORY after every new feature): Think through:
   - What happens if a user has this active and opens a pomo? (and vice versa)
   - What happens in shared pomo mode? Free mode? Prayer overlay?
   - What happens if the user closes the tab mid-feature?
   - What if they're in the break room vs work room?
   - What if Firebase write fails / is stale?
   - Does `updatePlayerPosition` correctly reflect state to other users?
   - Does cleanup happen on logout, tab close, and `endFreeMode`/`exitPomoNow`?
8. **Verify** per the Operating Procedure §4: `node --check game.js`, diff scanned
   against the §6 Hard Invariants, `?v=` bumped in `index.html`.
9. **Tell the user it's ready to test** (they test in Safari themselves), then git
   push only when they ask.

---

## Testing Policy

**The owner does not want the browser preview tool used, period — for small fixes or big new features.** Implement carefully and read the code back over instead of clicking through it in a browser. The owner tests everything himself and would rather do that and report back than wait on a verification round. Exceptions: a quick static/logic sanity check (e.g. `node --check`, a one-off Node snippet, reading the diff) is fine, and it's also fine to actually launch the preview if the ask is specifically to confirm the website runs/loads at all (e.g. after a change that could break startup) — never per-feature click-through testing.
