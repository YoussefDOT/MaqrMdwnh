// tools/shots.mjs — the screenshots in نشرة الأخبار's release entry (مقر ١.٥).
// -----------------------------------------------------------------------------
// Drives a HEADLESS Chrome over its DevTools protocol (no dependencies: Node's own
// fetch + WebSocket), enters the site as two سراج test ghosts, stages each feature
// through the dev-only `window.__mq.x` handle, and saves PNGs. tools/shots.py then
// turns them into the WebPs the news modal loads (Art/News/1.5/*.webp).
//
//   python3 -m http.server 8080          # in the repo root, in another terminal
//   node tools/shots.mjs                 # → <tmp>/maqr-shots/*.png
//   python3 tools/shots.py               # → Art/News/1.5/*.webp
//
// It talks to the LIVE lobby (ghosts are real, briefly-visible players, and the ليمو
// shot really calls him), so run it when that is fine. Ghost data cleans itself up.
// -----------------------------------------------------------------------------
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SITE = process.env.SITE || 'http://localhost:8080/';
const PORT = 9333;
const OUT = process.env.OUT || path.join(os.tmpdir(), 'maqr-shots');
const PROFILE = path.join(os.tmpdir(), 'maqr-shots-profile');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--autoplay-policy=no-user-gesture-required', '--window-size=1280,800',
    // Three tabs, one window: none of them may be throttled for being "in the background".
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion',
    'about:blank',
], { stdio: 'ignore' });
const quit = () => { try { chrome.kill(); } catch (_) {} };
process.on('exit', quit);

async function waitForChrome() {
    for (let i = 0; i < 50; i++) {
        try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return; } catch (_) {}
        await sleep(200);
    }
    throw new Error('Chrome did not start');
}

// One tab, with a tiny CDP client.
async function openPage(w, h, dpr, mobile) {
    const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    };
    const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: !!mobile });
    if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error('page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
        return r.result.value;
    };
    const shot = async (name, clip) => {
        const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
        fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
        console.log('  saved', name);
    };
    const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });
    const front = () => send('Page.bringToFront');
    return { send, ev, shot, mouse, front, w, h, wsUrl: t.webSocketDebuggerUrl };
}

// Into the room as a test ghost; resolves with its uid once the boot screen is gone.
async function enter(p) {
    await p.send('Page.navigate', { url: SITE + '?shots=' + Date.now() });
    await sleep(3500);
    // The one-time «how to jump» toast would sit in the middle of a phone screenshot.
    await p.ev(`localStorage.setItem('mdwnh_jump_hint_15', '1')`);
    await p.ev(`(() => { document.getElementById('siraj-test-link').click(); document.getElementById('siraj-pw-input').value = 'siraj'; document.getElementById('siraj-pw-confirm').click(); })()`);
    for (let i = 0; i < 80; i++) {
        await sleep(500);
        const ok = await p.ev(`!!(window.__mq && __mq.gameState.userId && __mq.gameState.players[__mq.gameState.userId] && __mq.worldCollision.built)`).catch(() => false);
        if (ok) break;
    }
    // The entrance drop, then "calm" — the DM inbox and the route grid start on it.
    for (let i = 0; i < 60; i++) {
        await sleep(500);
        const ok = await p.ev(`!!(__mq.x._dm.me && __mq.x._lemoNavBuild())`).catch(() => false);
        if (ok) break;
    }
    await sleep(1500);
    return p.ev(`__mq.gameState.userId`);
}

// Stand my ghost at a world point (local only — enough for my own screen).
const place = (p, x, y) => p.ev(`(() => { const g = __mq.gameState, me = g.players[g.userId]; me.x = ${x}; me.y = ${y}; me.renderX = ${x}; me.renderY = ${y}; me._netBuf = null; me.floor = 1; g.camera.x = ${-x}; g.camera.y = ${-y}; g.zoom = 1.25; })()`);
const say = async (p, text) => {
    await p.ev(`(() => { const X = __mq.x; X.openChatBox(); const i = X._chatUi.input; i.textContent = ${JSON.stringify(text)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); })()`);
    await sleep(1100);
};

const ONLY = process.env.ONLY || '';        // ONLY=typing re-takes just the phone picture; ONLY=hero = the announcement shot

// ── The announcement picture: ONE real frame with as much of ١.٥ in it as fits ──
// Three ghosts, really standing where they appear (teleported + synced, not drawn
// in), a real conversation in the drawer, a real question to ليمو and his REAL
// answer, the history fan over one of them and the reaction ring round the camera's
// own ghost. 1920×1080 at 1.5× → a 2880×1620 PNG (a 3840×2160 capture never came back
// from headless Chrome — the frame is bigger than it will hand over).
async function hero() {
    const A = await openPage(1920, 1080, 1.5, false);
    const B = await openPage(1280, 800, 1, false);
    const C = await openPage(1280, 800, 1, false);
    console.log('entering (3 ghosts)…');
    const [a, b, c] = await Promise.all([enter(A), enter(B), enter(C)]);
    console.log('ghosts:', a, b, c);
    // Open floor for the three of them: A in the middle, B up-left (ليمو will come to
    // stand beside him), C down-left.
    const OFF = { b: [-235, -150], c: [-300, 95] };
    const P = await A.ev(`(() => { const N = __mq.x._lemoNav, C = 16; const free = (x, y) => { const c = Math.round((x - N.x0) / C), r = Math.round((y - N.y0) / C); if (c < 2 || r < 2 || c >= N.cols - 2 || r >= N.rows - 2) return false; for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (!N.g[1][(r + dr) * N.cols + (c + dc)]) return false; return true; }; const need = [[0, 0], ${JSON.stringify(OFF.b)}, ${JSON.stringify(OFF.c)}, [${OFF.b[0]} + 128, ${OFF.b[1]}], [${OFF.b[0]} - 128, ${OFF.b[1]}]]; let best = null; const ys = []; for (let k = 0; k <= 30; k++) { ys.push(-120 - k * 16); ys.push(-120 + k * 16); } for (const y of ys) for (let x = 60; x < 330; x += 16) { let n = 0; for (const [dx, dy] of need) if (free(x + dx, y + dy)) n++; if (!best || n > best.n) best = { x, y, n }; if (n === need.length) return best; } return best; })()`);
    console.log('spot:', P);
    const tp = (p, x, y) => p.ev(`(() => { const X = __mq.x, g = __mq.gameState, me = g.players[g.userId]; X.teleportEntity(me, ${x}, ${y}); me.floor = 1; X.updatePlayerPosition(${x}, ${y}); X.sendPositionWS(${x}, ${y}, true); })()`);
    await tp(A, P.x, P.y); await tp(B, P.x + OFF.b[0], P.y + OFF.b[1]); await tp(C, P.x + OFF.c[0], P.y + OFF.c[1]);
    // Zoomed so the room fills the frame (zoomed out, the world's edge and the void
    // beyond it are in the picture); the spot search above keeps the camera inside it.
    await A.ev(`(() => { __mq.gameState.zoom = 1.5; })()`);
    await sleep(2500);

    console.log('history…');
    await C.front();
    await say(C, 'صباح الخير يا جماعة ☀️');
    await say(C, 'خلّصت مشهد المقدمة أمس');
    await say(C, 'من يراجعه معي اليوم؟');
    await say(C, 'الاجتماع بعد العصر إن شاء الله');

    console.log('messages…');
    const dm = (p, peer, text) => p.ev(`(async () => { const X = __mq.x; if (X._dm.peer !== ${JSON.stringify(peer)}) X.dmOpen(${JSON.stringify(peer)}); X._dm.els.input.value = ${JSON.stringify(text)}; X._dmSubmit(); await new Promise(r => setTimeout(r, 700)); })()`);
    await A.front();
    await dm(A, b, 'السلام عليكم، وصلك ملف المشروع؟');
    await B.front();
    await dm(B, a, 'وعليكم السلام، وصل والحمد لله 👍');
    await B.ev(`(async () => { __mq.x._dmSend('', 'جاري الطبخ'); await new Promise(r => setTimeout(r, 800)); })()`);
    await dm(B, a, 'وهذه لقطة من المسودة الأولى');
    await B.ev(`(async () => { const X = __mq.x; const blob = await (await fetch('Art/News/1.5/react.webp')).blob(); X._dmPickFile(new File([blob], 'draft.webp', { type: 'image/webp' })); await new Promise(r => setTimeout(r, 1800)); X._dmSubmit(); await new Promise(r => setTimeout(r, 1500)); X.dmClose(); })()`);
    await A.front();
    await dm(A, b, 'ممتاز، أكمل عليها 🔥');
    await sleep(2500);
    await A.ev(`(() => { const m = __mq.x._dm.els.msgs; m.scrollTop = m.scrollHeight; document.activeElement && document.activeElement.blur(); })()`);

    console.log('ليمو…');
    const awake = await A.ev(`(() => { const L = __mq.x._lemo; return !!(L.doc && L.doc.s === 'awake' && !(L.sim && (L.sim.kind === 'sleep' || L.sim.kind === 'liedown'))); })()`);
    if (!awake) console.log('  ليمو is asleep — the picture will not have him');
    else {
        await B.front();
        await B.ev(`(() => { const X = __mq.x; X.lemoPress(); const i = X._chatUi.input; i.append('ايه رأيك في تحديث المقر الجديد؟'); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); })()`);
        await A.front();
        let said = false;
        for (let i = 0; i < 90 && !said; i++) { await sleep(500); said = await A.ev(`!!(__mq.x._lemo.say && !__mq.x._lemo.say.wait)`); }
        console.log('  ليمو said:', await A.ev(`(__mq.x._lemo.say ? __mq.x._lemo.say.parts.map(p => p.m || '[' + p.s + ']').join(' / ') : '(nothing)')`));
    }
    // Everything at once, while his words are up.
    C.ev(`__mq.x.reactNow('clap')`).catch(() => {});
    await A.ev(`(() => { const p = __mq.gameState.players[${JSON.stringify(c)}]; if (p) __mq.x.peekOpen(p); })()`);
    const pos = await A.ev(`(() => { const g = __mq.gameState, me = g.players[g.userId], cv = g.canvas, r = cv.getBoundingClientRect(), dpr = g.dpr || 1; return { x: r.left + (me.x + g.camera.x) * g.zoom + cv.width / dpr / 2, y: r.top + (me.y + g.camera.y) * g.zoom + cv.height / dpr / 2 }; })()`);
    console.log('  ring…', pos);
    await A.mouse('mousePressed', pos.x, pos.y);
    await sleep(850);
    await A.mouse('mouseMoved', pos.x - 44, pos.y - 84);
    await sleep(450);
    console.log('  capturing…');
    const dest = process.env.HERO || path.join(os.homedir(), 'Downloads', 'maqr-1.5.png');
    // A frame this big can take headless Chrome a long while to hand over, and what is
    // on screen only lasts seconds — so everything that is up right now is HELD up
    // (nothing is added: the same real bubbles, just not allowed to expire mid-capture).
    await A.ev(`(() => { const X = __mq.x, L = X._lemo; if (L.say) L.say.life = 1e8; for (const p of Object.values(__mq.gameState.players)) for (const b of (p._chat || [])) b.life = 1e8; setInterval(() => { if (X._peek.uid && !X._peek.out) X._peek.t0 = Date.now() - 2500; }, 500); })()`);
    // The screen-edge blur (`#edge-bokeh`, a full-screen backdrop-filter that grows
    // with the zoom) is what headless Chrome chokes on at this size — the capture
    // never comes back with it on. It is switched off for the photograph; nothing
    // else about the frame changes.
    await A.ev(`(() => { const st = document.createElement('style'); st.textContent = '#edge-bokeh{display:none!important}'; document.head.appendChild(st); })()`);
    await sleep(700);
    let r = await Promise.race([A.send('Page.captureScreenshot', { format: 'png' }), sleep(25000).then(() => null)]);
    if (!r) {
        // Still nothing: a fresh session (the stuck one is blocked behind its own
        // capture) at 1× — smaller, but a picture.
        console.log('  …no answer at 1.5×, trying 1× on a fresh session');
        const ws2 = new WebSocket(A.wsUrl);
        await new Promise((res, rej) => { ws2.onopen = res; ws2.onerror = rej; });
        let n = 0; const wait = new Map();
        ws2.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m.result); wait.delete(m.id); } };
        const send2 = (method, params = {}) => new Promise(res => { const i = ++n; wait.set(i, res); ws2.send(JSON.stringify({ id: i, method, params })); });
        await send2('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
        await sleep(2500);
        r = await Promise.race([send2('Page.captureScreenshot', { format: 'png' }), sleep(40000).then(() => null)]);
    }
    if (!r) throw new Error('the capture did not come back');
    fs.writeFileSync(dest, Buffer.from(r.data, 'base64'));
    console.log('saved →', dest);
    await A.mouse('mouseReleased', pos.x - 44, pos.y - 84);
    await sleep(600);
}

try {
    await waitForChrome();
    if (ONLY === 'hero') { await hero(); throw { done: true }; }
    let SPOT = { x: 124, y: -140 };
    if (ONLY !== 'typing') {
    const A = await openPage(1280, 800, 2, false);
    const B = await openPage(1280, 800, 1, false);
    console.log('entering…');
    const [a, b] = await Promise.all([enter(A), enter(B)]);
    console.log('ghosts:', a, b);
    // An open patch of the work room's floor, wide enough for the two of them side by
    // side — found on the route grid rather than guessed.
    SPOT = await A.ev(`(() => { const N = __mq.x._lemoNav, C = 16; const free = (x, y) => { const c = Math.round((x - N.x0) / C), r = Math.round((y - N.y0) / C); if (c < 1 || r < 1 || c >= N.cols - 1 || r >= N.rows - 1) return false; for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (!N.g[1][(r + dr) * N.cols + (c + dc)]) return false; return true; }; for (let y = -140; y > -560; y -= 16) for (let x = 60; x < 420; x += 16) { let ok = true; for (let k = -170; k <= 20 && ok; k += 16) ok = free(x + k, y) && free(x + k, y - 60); if (ok) return { x, y }; } return { x: 165, y: -200 }; })()`);
    console.log('spot:', SPOT);
    await place(B, SPOT.x - 150, SPOT.y);
    await place(A, SPOT.x, SPOT.y);
    await sleep(1500);
    // A sees B where B says it is.
    await A.ev(`(() => { const p = __mq.gameState.players[${JSON.stringify(b)}]; if (p) { p.x = ${SPOT.x - 150}; p.y = ${SPOT.y}; p.renderX = p.x; p.renderY = p.y; p._netBuf = null; p.floor = 1; } })()`);

    // ── «ماذا فاتني؟» ────────────────────────────────────────────────────────
    console.log('peek…');
    await B.front();
    await say(B, 'السلام عليكم يا شباب');
    await say(B, 'من جرّب التحديث الجديد؟ 🔥');
    await say(B, 'الاجتماع بعد العصر إن شاء الله');
    await A.front();
    await sleep(10500);                       // the live bubbles expire — what is left is history
    await A.ev(`(() => { const p = __mq.gameState.players[${JSON.stringify(b)}]; p.x = ${SPOT.x - 150}; p.y = ${SPOT.y}; p.renderX = p.x; p.renderY = p.y; __mq.x.peekOpen(p); })()`);
    await sleep(1500);
    await A.shot('peek', { x: 150, y: 110, width: 760, height: 470 });
    await A.ev(`(() => { __mq.x._peek.out = Date.now(); })()`);
    await sleep(500);

    // ── التفاعلات: hold on my own character ───────────────────────────────────
    console.log('reactions…');
    const cx = 640, cy = 400;
    await A.mouse('mousePressed', cx, cy);
    await sleep(900);
    await A.mouse('mouseMoved', cx + 40, cy - 86);
    await sleep(500);
    await A.shot('react', { x: 300, y: 130, width: 680, height: 420 });
    await A.mouse('mouseReleased', cx + 40, cy - 86);
    await sleep(900);

    // ── الرسائل الخاصة ───────────────────────────────────────────────────────
    console.log('messages…');
    const dmSend = (p, peer, text) => p.ev(`(async () => { const X = __mq.x; if (X._dm.peer !== ${JSON.stringify(peer)}) X.dmOpen(${JSON.stringify(peer)}); X._dm.els.input.value = ${JSON.stringify(text)}; X._dmSubmit(); await new Promise(r => setTimeout(r, 650)); })()`);
    await dmSend(A, b, 'السلام عليكم، وصلك ملف المشروع؟');
    await B.front();
    await dmSend(B, a, 'وعليكم السلام، وصل والحمد لله 👍');
    await dmSend(B, a, 'هذه لقطة من المسودة الأولى');
    await B.ev(`(async () => { const X = __mq.x; const blob = await (await fetch('Art/Meeting_Table_Real.webp')).blob(); X._dmPickFile(new File([blob], 'draft.webp', { type: 'image/webp' })); await new Promise(r => setTimeout(r, 1800)); X._dmSubmit(); await new Promise(r => setTimeout(r, 1500)); })()`);
    await A.front();
    await dmSend(A, b, 'ممتاز، أكمل عليها 🔥');
    await sleep(3500);
    await A.ev(`(() => { const m = __mq.x._dm.els.msgs; m.scrollTop = m.scrollHeight; document.activeElement && document.activeElement.blur(); })()`);
    await sleep(600);
    await A.shot('dm');
    await A.ev(`__mq.x.dmClose()`);
    await B.ev(`__mq.x.dmClose()`);
    await sleep(600);

    // ── ليمو ─────────────────────────────────────────────────────────────────
    console.log('lemo…');
    const awake = await A.ev(`(() => { const L = __mq.x._lemo; return !!(L.doc && L.doc.s === 'awake' && !(L.sim && (L.sim.kind === 'sleep' || L.sim.kind === 'liedown'))); })()`);
    if (awake) {
        await A.ev(`(() => { const X = __mq.x; X.lemoPress(); const i = X._chatUi.input; i.append('مين أحسن واحد في المقر؟'); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); })()`);
        let arrived = false;
        for (let i = 0; i < 60 && !arrived; i++) { await sleep(500); arrived = await A.ev(`!!(__mq.x._lemo.fol && __mq.x._lemo.fol.arrived)`); }
        // His REAL answer (the relay asks the model); give it time to land.
        let said = false;
        for (let i = 0; i < 40 && !said; i++) { await sleep(500); said = await A.ev(`!!(__mq.x._lemo.say && !__mq.x._lemo.say.wait)`); }
        console.log('  ليمو said:', await A.ev(`(__mq.x._lemo.say ? __mq.x._lemo.say.parts.map(p => p.m || '[' + p.s + ']').join(' / ') : '(nothing)')`));
        await sleep(900);
        await A.shot('lemo', { x: 240, y: 120, width: 800, height: 500 });
    } else console.log('  ليمو is asleep — skipped');
    }

    // ── الكتابة على الجوال ───────────────────────────────────────────────────
    console.log('mobile typing…');
    const C = await openPage(390, 760, 2, true);
    await C.front();
    const c = await enter(C);
    await place(C, SPOT.x + 10, SPOT.y + 60);
    await sleep(800);
    await C.ev(`(() => { const X = __mq.x; X.openChatBox(); const i = X._chatUi.input; i.textContent = 'من يريد جولة سباق في الاستراحة؟'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await sleep(1600);
    await C.shot('typing', { x: 0, y: 225, width: 390, height: 535 });   // the lower part: the avatar, the dots, the bar
    console.log('done →', OUT, c ? '' : '');
} catch (e) {
    if (!(e && e.done)) { console.error('FAILED:', e.message); process.exitCode = 1; }
} finally {
    quit();
    setTimeout(() => process.exit(), 400);
}
