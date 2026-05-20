# Mdwnh Digital Workspace — Dev Notes

## Local Development Server

Always run a local server to test (required for ES modules + Firebase):

```bash
# Python (built-in, simplest)
python3 -m http.server 8080

# Node.js alternatives
npx serve .
npx http-server . -p 8080 --cors
```

Then open **http://localhost:8080** in your browser.

### Mobile testing on real device
1. Connect phone to the same WiFi
2. Find your Mac's local IP: `ipconfig getifaddr en0`
3. Open `http://[YOUR_IP]:8080` on the phone

---

## Architecture

- Pure frontend — no build step, vanilla ES modules
- Firebase Realtime Database (europe-west1) handles all multiplayer state
- `firebase-config.js` exports `{ database, ref, onValue, update, get, onDisconnect, set }`

## Mobile / Responsive System

Mobile mode is detected purely by **window width < 1024px** — this fires on resize too, so you can test mobile layout by resizing the browser window.

The `body.is-mobile` class is toggled by `setMobileClass()` in game.js and drives all mobile-specific CSS.

### Mobile-only features
| Feature | Notes |
|---|---|
| Virtual joystick | Bottom-left, tracks touch. Push >55% radius = sprint |
| Pinch-to-zoom | Disabled during race |
| Hold-to-sprint | Joystick displacement >55% of radius |
| Focus drawer | Bottom sheet with `أصوات` label, drag up to reveal sounds + YT |
| User card hide | Slides up (with خروج pill) during work phase, bounces back on break/end |
| Race D-pad | Forward / Back / Left / Right buttons replace joystick during race |
| Race camera | Rotates with car so car always drives "up" (lerps smoothly; desktop stays static) |
| Siraj test mode | Hold الإخوة lobby button 800ms → spawns siraj ghost (same as Shift+click on desktop) |
| Reduced particles | 10 wind particles on mobile (vs 30 on desktop) for performance |

### Desktop-only features
- Top-right floating user card (avatar + name + channel + count) — no logout button inside it
- خروج pill floats separately on the left (same glass style as the user card)
- Focus sounds panel floats at bottom-center as before
- YouTube player floats at bottom-left

---

## Design Language

Follow **Apple HIG** principles throughout the UI:
- **Glass surfaces**: `rgba(18,18,18,0.68)` + `backdrop-filter: blur(20px) saturate(1.6)`
- **Subtle borders**: `rgba(255,255,255,0.09)` — barely visible, not structural
- **Shadows**: soft, low-spread (`0 4px 24px rgba(0,0,0,0.30)`) — depth without heaviness
- **Typography**: `font-weight: 600` for primary labels, `rgba(255,255,255,0.42)` for secondary
- **Letter spacing**: `-0.01em` on headings, `0.01-0.02em` on small labels
- **Transitions**: `cubic-bezier(0.34, 1.56, 0.64, 1)` for spring-y interactive elements
- **Pill shapes**: `border-radius: 50px` for standalone action buttons (خروج)
- **No heavy drop shadows** — keep depth light and layered

---

## Key Constants (game.js)
```
MOVE_SPEED = 5
PLAYER_SIZE = 70
BG_SCALE = 0.5             → world ≈ 1195 × 875 px
ROOM_COUNT = 2             → work room (top) + break room (bottom)
RACE_LAPS = 3
MOBILE_BREAKPOINT = 1024   (window.innerWidth)
WIND_PARTICLE_COUNT = 30   (desktop)
WIND_PARTICLE_COUNT_MOBILE = 10
```

## DPR Canvas Scaling
Canvas is scaled by `window.devicePixelRatio` in `resizeCanvas()`:
- `canvas.width/height = viewport * dpr` (physical)
- `canvas.style.width/height = viewport + 'px'` (CSS logical)
- `gameState.dpr` stores the current ratio
- `render()` and `renderRace()` call `ctx.save(); ctx.scale(dpr, dpr)` so all drawing uses **logical pixels**
- `drawFocusMask`: mCanvas stays physical for sharp gradients; player positions computed with `* dpr`; drawn via `ctx.drawImage(mCanvas, 0, 0, W, H)`
