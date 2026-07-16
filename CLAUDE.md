# Mdwnh Digital Workspace — AI Dev Guide

> **This project is entirely vibe-coded.** Every line of JS/HTML/CSS was written by an AI model. Only the art assets and audio files are human-made. When Claude is working on this, it IS the developer — read this file carefully before touching anything.

> **Spell-check all UI text.** Any Arabic or English text that will appear in the UI must be spell-checked before being written into the codebase. Never add user-visible text without verifying spelling and grammar first.

> **The owner is a beginner developer.** Explain things in plain language — what broke, why, and what the fix does — as if to someone who doesn't know much about code. Skip jargon, and when you must use a technical term, define it briefly. Don't over-explain either: keep it short and clear, not a tutorial. Claude is the one writing the code; the owner is steering, so help them understand decisions without drowning them in detail.

> **The owner is on macOS and tests mainly in Safari.** Every new feature must work cross-browser — don't assume Chrome behaviour. Common Safari gotchas: aggressive favicon caching + rejection of oversized favicons (use a small ~128px PNG, not a 1MB+ one — see `favicon-128.png`/`apple-touch-icon.png`); no `documentPictureInPicture` and no `canvas.captureStream()` (PiP falls back to a popup window — see Picture-in-Picture tiers); `button[disabled]` leaks touch events on iOS (use a CSS `.unlocked` class, never the `disabled` attribute, for visual-only locks); always pair `backdrop-filter` with `-webkit-backdrop-filter`; stricter autoplay / AudioContext-resume rules. When something "works for me but not for the owner," suspect a Safari difference first.

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

**Build number**: A `#build-number` div sits below the `#siraj-test-link` button on the login screen showing `Build N · Updated H:MM AM/PM`. The `.git/hooks/pre-commit` hook auto-increments the number and timestamps it on every commit — no manual edits needed. If the hook ever fails to find the pattern, it logs a warning and exits cleanly.

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
| **Reading (القراءة)** | Timed reading sessions from the books library. A shelf of the user's own books (each a procedurally-drawn 3D cover), a random sofa seat, a cinematic camera, the `Art/Book.png` prop sliding out from under the reader, and a lobby leaderboard. See **Reading Session**. |
| **Minigames** | Racing / Coffee / laptop-boss. **Entry is TEMPORARILY OFF** — the old break-room zones were removed with the old art; they'll be re-wired to the new **games table** later (all the minigame code still works, it's just unreachable for now). |
| **Two floors** | Ground rooms + a raised **second floor** (mezzanine) reached by stairs; players grow to 1.25× up there and the floor fades out when someone walks under it |
| **Mobile mode** | Full touch support — virtual joystick, pull-up sounds drawer, focus-mode UI |
| **Character customization** | Ring colour (full in-page colour wheel) + hats, placed/scaled/rotated by the user and seen by everyone. See **Character Customization**. |
| **Menu** | Discord-OAuth-only entry + boot/loading screen. See "The Menu" below. |

**Language**: All UI text is Arabic. Keep it that way.

---

## File Map

```
Hats/                        — hat PNGs + hats.json (the production manifest; the
                               pre-commit hook regenerates it). See Character Customization.
Icon Elements/               — 7 decorative brush icons (masked + brand-tinted in the menu)
Maqr logo.png                — the brand logo: menu + boot screen
game.js        ~19000 lines — all game logic, classes, Firebase, rendering
index.html      ~1400 lines — single page; all panels/overlays live here
style.css       ~6300 lines — all styling; mobile rules under body.is-mobile
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
  login screen never waits on them. Once every layer decodes, `buildWorldCollision()`
  builds the alpha collision masks AND `buildWorldCache()` pre-composites the ~9
  ground layers + 3 second-floor layers into **two cached canvases** — so the per-frame
  cost is ~2 `drawImage`s, not ~14 (matters on the owner's phone). Both are idempotent
  and self-retry until the images decode.
- **Race track** (`Art/RaceTrack Var1.png`, 6 MB + CPU-heavy pixel classification):
  `loadRaceTrackAsset()` is idempotent and lazy — kicked on idle after spawn and
  ensured by every race entry path. Never call it in `init()`.
- **Service worker (`sw.js`)**: covers `Sound/ Art/ Fonts/` + image/audio/font
  extensions; skips Range requests (Safari audio streaming) and everything else passes
  through (code is never served stale). Two modes:
  - **Production: stale-while-revalidate.** The cached copy is served instantly AND
    re-fetched in the background, so a replaced media file appears on the *next*
    reload by itself. `?v=` bumps / `CACHE_VERSION` are now only for forcing it to
    land on the *same* load.
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
`buildWorldCollision()` rasterises the collidable layers into half-res `Uint8` bitmaps
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
`worldCache` collapses ~14 per-frame `drawImage`s into ~2, and **after the caches +
collision masks are built the source layer `<img>`s are freed** (`src=''`) — keeping ~12
decoded 2210×3160 images alive (~340 MB) is what crashed Safari. The overlay-blend layer
and clouds are gated off on بطاطس; the world cache is rendered at a smaller resolution on
reduced tiers.

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

### Login & auto-resume
Discord OAuth session in localStorage. On load, `initDiscordOAuth()` validates the token and resolves the lobby. **Auto-resume**: `startGame` writes `localStorage[ACTIVE_SESSION_KEY] = userId` while in-game (cleared on explicit logout / menu logout); on load, if that flag matches the resolved user, re-enter the game directly — `startGame` then restores the pomodoro/free-mode session from Firebase. This is what makes an unintended reload (Android discarding a backgrounded tab) seamless. Siraj ghosts never set the flag (ephemeral).

---

## The Menu (`#menu-screen`) + Boot Screen (`#loading-screen`)

The site name is **مقر المدونة**. Entry is **Discord-OAuth only** — the male/female
chooser is **gone** from the menu. The lobby comes from the account
(`resolveUserLobby` → Firebase `users/{uid}/lobby` / `categoryName`). The only
buttons are: Discord login, **وضع التجربة**, and the PWA install button.

- **`#discord-first-lobby-modal` is a rare FALLBACK only** — it shows when
  `resolveUserLobby` returns null (a Discord account the bot has never seen). Do
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

Flow: pill → boot slides in → `startGame` → world art decodes → `buildWorldCache()`
sets `_worldReady` and calls `finishBootScreen()` → bar eases to 100% → boot slides
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

**Focus mode** (`setMobileFocusMode(active)`): Hides joystick + user card during work phase. Joystick gets `.focus-hidden` class → opacity 0. User card slides off-screen with `transform: translateY(-140%)` + `pointer-events: none`.

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
Opened from the **prayer overlay** via `#prayer-azkar-btn` → `openAzkarOverlay('morning', { afterPrayer: true })`. Uses the custom `AZKAR_AFTER_PRAYER` list, the morning (sky-blue) look (`overlay.dataset.mode = 'morning'`), and sits **on top** of the prayer overlay (`body.azkar-after-prayer .azkar-overlay { z-index: 10002 }` vs prayer's 10000). Crucially it does **not** freeze/resume the timer or fade YT/sounds itself (`afterPrayer` skips all of that in `openAzkarOverlay`) — the prayer overlay already owns that. On انتهيت, `closeAzkarOverlay` detects `afterPrayer`, fades the azkar overlay out, then calls `dismissPrayerOverlay()` which un-freezes the timer and fades focus sounds + YouTube back in → normal work session. `minLockMs = 0` for after-prayer (no forced wait).

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
- Desktop: panel shown in compact 2-column grid, sliders hidden, bg/border at 10% opacity, `z-index: 10001` (above overlay at 10000), `pointer-events: all`
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
cost rules). `_readingSlug()` strips `. # $ [ ] /`. Session end increments `totalMs` with
`runTransaction`. **Siraj ghosts never touch المتصدرين** — they skip the leaderboard
write entirely, and `fetchReadingLeaderboard` also filters `uid.startsWith('siraj_')` on
read so any pre-existing ghost row stays hidden.

### Seat + camera
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

## Shared Pomodoro (Coop) System

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

`updatePomodoro()` runs every frame — drives the countdown, phase transitions, and the focus mask/fog effects.

**Focus mask**: `drawFocusMask()` renders a dark vignette around the active laptop. Alpha driven by `gameState.focusAlpha` (lerped 0→1 on work start).

### Disconnect / session reclaim (the ghost-laptop system)
A laptop must **never** linger as a claimed-but-empty "ghost" (a timer floating over a laptop nobody is at, showing `هذا الجهاز تابع لـ …`). Two distinct causes, both fixed:

1. **Presence lost on a network blip** (the perennial bug — "there IS a user, working, but a ghost for everyone else"). Firebase fires the registered `onDisconnect` ops server-side the moment the socket drops (e.g. flaky mobile data), setting `activeInGame=false`. The socket silently reconnects, but presence was only set **once** at login, so `activeInGame` stayed false forever → observers never add the avatar to `gameState.players`, yet the laptop doc still shows the timer. **Fix:** a `.info/connected` listener (in `startGame`) re-asserts `activeInGame=true` **and re-arms** `onDisconnect(activeRef).set(false)` on **every** (re)connect, then calls `reassertActiveSessionAfterReconnect()`.

2. **User actually left** (closed tab / lost data for good). The laptop should free **immediately** for others (no ghost), the session should be stashed for **4 hours**, and the user reclaims it on return. Implemented with a unified per-session disconnect model (solo pomodoro **and** solo free mode; shared pomo is excluded — it has host-promotion):

| Helper | Role |
|---|---|
| `persistReclaimSnapshot()` | Writes a **live** snapshot to `dashboards/{uid}/profile/lastPomoSession` (see `dashProfilePath()` — private data, zero fan-out) with `abandonedAt: null`. Kept fresh so a disconnect only has to stamp the timestamp (no read-race on reload). |
| `armSessionDisconnect()` | `onDisconnect(laptop).remove()` (free it) + `onDisconnect(profile lastPomoSession/abandonedAt).set(serverTimestamp)`. Cancels the **previous** laptop's remove if we relocated. |
| `trackSessionForReclaim()` | persist + arm together. Called at pomo start, **every** `startPomodoroPhase`, free start, periodic `saveFreeModStateToFirebase` (15s; the lobby-visible laptop **doc** inside it is throttled to 45s — nobody reads the live timer from it), and at end of login restore. |
| `cancelSessionDisconnect(clearStash)` | Clean exit — cancels both handlers, optionally wipes the stash. Called from `exitPomoNow`, `endFreeMode`, natural completion (both work-end and break-end), and explicit `doLogout`. |
| `reassertActiveSessionAfterReconnect()` | After a silent reconnect: re-claim our laptop (or **relocate** to a free one via `_relocateActiveSession` if it was taken during the dropout), persist a fresh snapshot, re-arm. |

**Reclaim on login** (in `startGame`'s restore): only when `lastPomoSession.abandonedAt` is **set** (a live snapshot has it `null` → ignored) and within `RECLAIM_WINDOW_MS` (4h). **Prefers the original laptop** (`ls.laptopId` if free) else any free laptop; restores `mode==='free'` or pomo accordingly; seats the player at `laptop.sitX/sitY` and syncs position so all clients see them correctly on the new laptop. Stale (>4h) / no free device → discarded.

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

> **ENTRY IS CURRENTLY DISABLED.** The old break-room teleport zones (race / coffee /
> laptop-boss) lived at coordinates that don't exist in the new world, and their art +
> hints are no longer drawn — so the zones are **unreachable**. All the minigame logic
> below still works; when we're ready, wire the new **games table** (`Workspace_0006`,
> break room, bottom-left) as the entry point. Nothing here was deleted, just
> disconnected.

**Gender separation**: All minigame paths go through `lobbyPath()` — male/female never share sessions.

**Ready-sync protocol** (both games):
1. Host creates session with `startTime: 0`
2. Each client writes `participants/{uid}/ready: serverNow()` when entering
3. Host waits for all `ready`, then sets `startTime = serverNow() + 3500`
4. **Do NOT use a small offset** — clients need the full 3.5s window for 3-2-1 countdown

### Race minigame
Track is built from image pixel classification (`classifyRacePixel`); the 6 MB track PNG is **lazy-loaded** (`loadRaceTrackAsset()` — idempotent; idle after spawn + ensured on race entry). Physics: friction zones on/off-track. Camera rotates on mobile to always show car heading "up".

**Car sync rides the WebSocket relay, NOT Firebase.** `syncRaceCar` sends `{t:'car', cuid, k:sessionKey, x,y,a,s,d,l,f,u}` over the presence socket ~11×/sec (`sendRaceCarWS`); `onRaceCarWS` merges it into `session.cars` (the same struct `updateRaceCarVisuals` lerps from). Firebase gets a **1s authoritative fallback** write (4/sec if the socket is down) so relay-less clients still see a working, choppier race. The field is `cuid` (not `uid`) on purpose so older clients drop the message instead of mistaking it for an avatar position. `listenToRace` keeps WS-fresh car positions when a fallback snapshot arrives (same anti-snap idea as avatars, `race._carWsAt`). **Never restore the old 90ms Firebase car writes** — every client in the lobby live-listens to the sessions node, so that was the app's most expensive Firebase pattern.

### Coffee minigame
Sugar falls from top. `progress = (serverNow() - spawnTime) / fallDuration` — computed by all clients independently. First writer wins the catch. Bad sugars (14% chance) give −3 pts.

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
fade with it). `drawConnections` / `drawCoopGroupLabels` still run in the world pass.

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

Opens **under the gear button, top-right** on desktop (`top:130px; right:18px`) and mobile (`right:10px; top:110px`). Each row is a binary toggle button reflected via a `_reflect*()` helper and persisted in localStorage. Rows are grouped into **categories** (`.settings-category` + `.settings-category-title` header): العرض والأداء / التحكم والعمل / الأذكار والصلاة. Keys & defaults:

| Key | Default | Effect |
|---|---|---|
| `SETTINGS_GRAPHICS_KEY` | device-auto | عالية → منخفضة → بطاطس (see Graphics Tiers) |
| `SETTINGS_NAMES_KEY` | show | hide player names above avatars |
| `SETTINGS_JOYSTICK_KEY` | auto | show/hide the on-screen joystick |
| `SETTINGS_NOIDLE_KEY` | off (`getDisableIdleAnim()`) | when **on**, freeze the local avatar's animation while working |
| `SETTINGS_AZKAR_RANDOM_KEY` | off (`getRandomizeAzkar()`) | when **on**, shuffle morning/evening azkar order each open |
| `SETTINGS_PARTICLES_KEY` | absent = follow tier | الجسيمات — tri-state **تلقائي → مفعّلة → مغلقة**. **Overrides the graphics tier** (see Graphics Tiers → Effect overrides) |
| `SETTINGS_OVERLAYS_KEY` | absent = follow tier | الطبقات الجوية — tri-state, same override semantics |
| `SETTINGS_PRAYER_DELAY_KEY` | off (`getPrayerJamaahDelay()`) | "صلاة الجماعة" — when **on**, adds **+5 min** to every prayer time (`prayerJamaahExtraMin()`, applied in `computeNextPrayer`/`updatePrayerPanelDOM`). **Per-USER, not per-device**: source of truth is Firebase `users/{uid}/prayerJamaahDelay`, read on login and **mirrored into localStorage** so the getter stays a cheap sync read; the toggle writes both. |

### Open / close animation
Open removes `.hidden` (the `settingsPanelIn` keyframe pops it in). Close is **animated, not a snap**: `closeSettingsPanel()` adds `.settings-panel-closing` (runs `settingsPanelOut`), then `.hidden` after ~230 ms. All three close paths (close button, gear re-press, outside-click) go through it. **Closing makes no sound** (see below).

### Sequenced rows + the cascade blip (sound)
Row/heading entrance lives in **style.css** as `@keyframes settingsRowIn` with **category-aware** `animation-delay`s (scoped `.settings-panel:not(.hidden):not(.settings-panel-closing) …` so it replays on every open). Do **not** re-add the old `juiceRowIn` settings rule in juice.css — it double-animates and fights the category delays.

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
- **Client** (`game.js`, the "Live position relay" block above `updatePlayerPosition`): `ensurePresenceSocket()` opens/heals the socket (called from `startGame`, the 10s presence heartbeat, and `_resyncPresence`). `sendPositionWS(x,y,force)` sends `{uid,x,y,m,s}` throttled to ~11/sec. `onPresenceMessage()` feeds others' positions into a per-player **interpolation buffer** (`pushNetSample`). `disconnectPresenceSocket()` on logout. Auto-reconnects on close (2s backoff).
- **Smooth movement = snapshot interpolation** (`pushNetSample` / `interpolateRemoteFromBuffer`, in the entity-helpers block). At ~11 packets/sec the old "ease toward each point and stop" lerp visibly stepped (worst at sprint). Instead each remote player is rendered `NET_RENDER_DELAY` (140ms) **in the past**, gliding at constant velocity between the two buffered samples bracketing that time; if the buffer starves it extrapolates along the last velocity for ≤`NET_MAX_EXTRAP` (180ms) (only while `isMoving`) then clamps. `updatePlayerRenderPositions` uses this for remotes and falls back to the plain lerp only before the first sample. **The buffer is fed by BOTH the WebSocket and the Firebase users listener**, so seating/teleport/kidnap/fallback all stay smooth and never freeze.
- **Anti-snap (the "friend snapping places" bug), two distinct causes — both fixed:**
  1. **Stale Firebase write polluting the buffer.** Firebase position writes (the 4s session heartbeat, stop writes) carry a slightly-OLD position but a fresh timestamp; appended as the newest buffer sample they yank the avatar backward, then the next WebSocket packet snaps it forward. Worst during a **break** (a walking friend still has `pomodoro.active`, so their heartbeat fires while WS also streams). **Fix:** `onPresenceMessage` stamps `player._lastWsSampleAt`; the Firebase users listener only `pushNetSample`s when WS has been quiet >1s (still sets the authoritative `.x/.y` always). WS owns smoothness; Firebase is the fallback only.
  2. **WebSocket starve → forward jump.** The relay is WS-over-TCP, so a "lost" packet is really a **delayed burst**. While starved the avatar extrapolates then clamps at the last sample; when the burst lands, interpolation places the render-time *between* the old clamp and the new sample and the avatar jumps forward to catch up. Happens **regardless of session/break**. **Fix:** the starve branch sets `entity._netStarved`; the next `pushNetSample` re-anchors at the CURRENT render position (same mechanism as resume-after-idle) so the glide continues smoothly with no jump.
- **`handleMovement`**: per-frame walk → `sendPositionWS()` (WebSocket). On **stop** → a forced `sendPositionWS()` (instant anim stop for others) **plus** `updatePlayerPosition()` (one Firebase write to persist last-known position for late joiners / spawn / reclaim).
- **Fallback**: if the socket is down, the periodic Firebase writes (stop + heartbeats) still drive observers via the users listener's `setEntityTarget` — nobody freezes, just less smooth until it reconnects.
- **Known limit (experiment)**: position `uid` is client-claimed (spoofable). Fine for the trusted friend group; revisit if going fully public.

`updatePlayerPosition(x, y)` writes `users/{uid}/{x,y,isMoving,isWorking,…}` together (atomic). Still called on **stop**, every frame during the kidnap animation, at the end of `startPomodoroPhase`, on session restore, and via a **4s heartbeat** in the game loop while locked-in/in a session — but **no longer per-frame while walking** (that's the WebSocket's job now).

**Pitfall — never use `!userData.x` to detect "no position":** the centre-column laptops sit at world **x ≈ 0**, and `0` is falsy, so that check made observers treat working users as position-less and scatter them to a random spawn (they looked mid-map to everyone but themselves). Always check `x !== undefined && x !== null`. Observers only assign a spawn to non-`activeInGame` users (VC ghosts), never to in-game players.

### Presence self-heal (`activeInGame`)
Observers render a remote player at **low opacity** (the "in Discord VC but not in the website" look) and hide their timer/`أعمل على` whenever `activeInGame !== true`. A dropped socket (network blip, **PC sleep/wake**) fires `onDisconnect.set(false)` server-side, so a returning user stays a faded ghost until presence is restored. Presence is kept true while the page is open through **three** redundant paths — never rely on just one:
1. `updatePlayerPosition()` writes `activeInGame: true` on **every** position write (move/stop/heartbeat/restore).
2. A standalone **10s presence heartbeat** in the game loop (independent of any session — covers idle/walking users the 4s position heartbeat skips).
3. `visibilitychange` / `window.focus` / `window.online` → `_resyncPresence()` re-asserts `activeInGame` + token and re-broadcasts position/task **immediately** on wake (don't make a woken PC wait for the heartbeat).

All three bail if `gameState._dupSessionDetected` (another device took over — don't fight back). Reconnect timer/task recovery also needs the laptop doc re-written: `reassertActiveSessionAfterReconnect()` (fired by `.info/connected`) does that.

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
- **Free mode**: saved in `endFreeMode`. A session over **2h** (`DASH_LONG_FREE_MS`) intercepts the leave with `openFreeLongConfirmModal()` ("هل عملت لمدة x فعلًا؟") — hour/minute steppers + **save-as-shown** or **discard**; `_dashFreeHandled` stops `endFreeMode` from double-saving.
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
**Siraj free-mode testing**: a Siraj ghost **always** gets the >2h idle-confirm modal on ending a free session (`gameState.isSirajGhost || elapsed > DASH_LONG_FREE_MS`), so the modal is testable without working two real hours. The confirm modal is **dark glassmorphism** (`.dash-lf-card`, not paper); when the user adjusts the time and confirms, that adjusted value is shown on the end card via `_dashFreeOverrideMins` (consumed in `endFreeMode`).

---

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

### Hat behaviour — a lagging, overshooting spring
`_updateHatSpring()` gives each player a spring (`_HAT_K` stiffness, `_HAT_D` damping < 1)
that **chases** the avatar's draw anchor instead of being welded to it: it arrives a few
frames late and **overshoots** on stop, which is what sells it as an object with mass. The
hat is drawn in `drawPlayers` **after** the avatar's transform is restored (it must not
inherit the working bounce/rotation), and it leans into its own velocity (`tilt`). Remote
players' hats swing the same way — their render position drives the same spring. Two
guards that matter:
- A >260px jump (teleport / kidnap) **re-anchors** instead of stretching the spring across
  the map; the lag is also hard-capped at `_HAT_MAX`.
- **`gameState._pipPass`** — PiP runs its own rAF over the same draw code, so it would
  integrate the springs a second time each frame (double speed). `renderPiPInto` sets the
  flag; the spring draws but never advances during that pass.

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
| Disconnected/closed-tab user keeps a laptop unusable for ~30min–2h | The pomo/free doc lingered (claimed) until `cleanupAbandonedPomoSessions` freed it; free mode's `onDisconnect` deliberately kept it claimed as an AFK badge | Unified model: `onDisconnect` **removes** the laptop (others see nothing) + stamps `lastPomoSession.abandonedAt`; reclaim within 4h on next login (old laptop if free, else random). See **Disconnect / session reclaim** |
| Reclaimed session lost after a reconnect | `reassertActiveSessionAfterReconnect` cleared `lastPomoSession` to `null` then armed only the `abandonedAt` child → a later disconnect stamped a timestamp onto an empty object | Re-**persist** a full live snapshot via `trackSessionForReclaim` (never `set(null)` while still in-session) |
| Mobile: re-tapping the same laptop fires free/pomo "without asking"; happens only on the same laptop | The opening tap is followed ~300ms later by a synthesized `click` at the same point; if a mode-select button sits under it (depends on the laptop's screen position) it fires immediately | Ghost-click guard: `showLaptopModeSelect()` stamps `_modeSelectOpenedAt`; `mode-select-pomo`/`mode-select-free` ignore presses within 500ms (`modeSelectGhostClick()`) |
| Reconnected user shows no `أعمل على` / no timer for others; or appears low-opacity (VC-ghost look) after PC sleep/wake | `activeInGame` was set once at login and only re-asserted by `.info/connected`; `updatePlayerPosition` never wrote it, and the position heartbeat only runs during a session — so an idle/walking user stayed `false` after a drop, gating their opacity + timer + task label | Write `activeInGame:true` on every `updatePlayerPosition`; add a session-independent **10s presence heartbeat**; re-assert on `visibilitychange`/`focus`/`online`. See **Presence self-heal** |
| Friend's avatar "snaps places" occasionally while walking | Two causes: (1) a laggy Firebase position write (4s heartbeat during a break, stop write) fed the interpolation buffer with a stale-but-fresh-timestamped sample → backward yank; (2) WS-over-TCP delayed bursts starved the buffer, then interpolation jumped the avatar forward to catch up when the burst landed | (1) Only `pushNetSample` from Firebase when WS quiet >1s (`player._lastWsSampleAt`); (2) flag the starve (`entity._netStarved`) so the next sample re-anchors at the current render pos. See **Player Position Sync → Anti-snap** |
| "Disable idle animation while working" setting did nothing in free mode | The per-avatar `isWorking` flag only tracks pomodoro, so in free mode the local avatar fell into the idle-breathing branch and the suppression (gated on `isWorking`) never fired | Gate the local-avatar suppression on `localInWorkPhase()` (covers pomodoro **and** free mode) and freeze both the bounce and the breathing |
| After-prayer azkar: tapping a count button scrolled the whole overlay down | `nextEl.scrollIntoView()` bubbles to the nearest scrollable ancestor; when the list itself couldn't scroll it scrolled the overlay/page | Scroll `listEl` only via a manual `listEl.scrollTo({top})` computed from bounding rects — never `scrollIntoView` |
| Camera rubber-bands to a default framing on every zoom, forever, after a reading session ends | The `exiting` camera phase only cleared once zoom converged on its target — but the scroll wheel was unblocked during it, so any scroll moved zoom away and the phase **never cleared**. `updateCamera()` early-returns while a reading phase is set, so the exit lerp owned the camera for the rest of the session and fought every gesture | Time-bound the exit tween (`READING_EXIT_MS` + hard `READING_EXIT_MAX_MS`), and have both zoom handlers call `abortReadingCamera()` so a user gesture always hands the camera back |
| New art needs a hard refresh to show up, every time | `sw.js` was pure cache-first for `Art/` — a cached file was pinned until its URL or `CACHE_VERSION` changed | Stale-while-revalidate in production (fresh copy lands for the next reload), and **network-first on localhost/LAN** (`IS_LOCAL`) so the dev loop always sees the file on disk |
| Hats run at double speed / jitter while PiP is open | PiP renders the same draw code on its own rAF, so `_updateHatSpring` integrated twice per frame | `gameState._pipPass` set by `renderPiPInto` — the PiP pass draws the spring but never advances it |
| SVG crescent renders as a plain filled circle | An arc whose radius is smaller than half its chord is silently scaled UP to fit by the SVG spec, so the two-arc crescent became two identical semicircles | Build it as a `<mask>`: a disc with an offset disc punched out |

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
8. **Test locally**, then tell the user to git push.

---

## Testing Policy

**The owner does not want the browser preview tool used, period — for small fixes or big new features.** Implement carefully and read the code back over instead of clicking through it in a browser. The owner tests everything himself and would rather do that and report back than wait on a verification round. Exceptions: a quick static/logic sanity check (e.g. `node --check`, a one-off Node snippet, reading the diff) is fine, and it's also fine to actually launch the preview if the ask is specifically to confirm the website runs/loads at all (e.g. after a change that could break startup) — never per-feature click-through testing.
