// Exports ليمو's review log — every question he answered, who asked it, what he was
// told, and what he said — so the owner can check him for made-up facts or rudeness.
//
// The relay keeps the log (presence-server/src/index.js → _lemoAudit) and opens it only
// to whoever holds the LEMO_AUDIT_KEY secret. This reads it and writes two files on THIS
// computer, both gitignored:
//   tools/out/lemo-log.html   open it in a browser: one card per question, with a search box
//   tools/out/lemo-log.json   the same rows, raw
//
//   node tools/lemo_log.mjs                 the last 7 days, both lobbies
//   node tools/lemo_log.mjs --days 30       further back (the relay keeps LEMO_AUDIT_DAYS)
//   node tools/lemo_log.mjs --all           everything the relay still has
//   node tools/lemo_log.mjs --lobby female  one lobby only
//
// The key is read from presence-server/.audit-key (gitignored) or the LEMO_AUDIT_KEY
// environment variable. It is sent in a header, over https only — never in the URL.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? (args[i + 1] || '') : ''; };

const RELAY = (opt('--url') || process.env.LEMO_RELAY_URL || 'https://mdwnh-presence.yosefbore3y.workers.dev').replace(/\/+$/, '');
const keyFile = join(root, 'presence-server', '.audit-key');
const key = (process.env.LEMO_AUDIT_KEY || (existsSync(keyFile) ? readFileSync(keyFile, 'utf8') : '')).trim();
if (!key) {
    console.error('No key. Put it in presence-server/.audit-key (see CLAUDE.md → سجل مراجعة ليمو).');
    process.exit(1);
}
if (!/^https:\/\//.test(RELAY) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(RELAY)) {
    console.error('Refusing to send the key over a connection that is not https: ' + RELAY);
    process.exit(1);
}

const days = args.includes('--all') ? 0 : Math.max(1, Number(opt('--days')) || 7);
const since = days ? Date.now() - days * 86400000 : 0;
const lobbies = opt('--lobby') ? [opt('--lobby')] : ['male', 'female'];
const LOBBY_AR = { male: 'الإخوة', female: 'الأخوات' };

async function readLobby(lobby) {
    const rows = [];
    let from = since;
    for (let page = 0; page < 500; page++) {
        const res = await fetch(`${RELAY}/lemo-log/${encodeURIComponent(lobby)}?since=${from}`, {
            headers: { authorization: 'Bearer ' + key },
        });
        const type = res.headers.get('content-type') || '';
        if (!res.ok || !type.includes('json')) {
            throw new Error('the relay did not open the log. Either the key here is not the one set on the relay ' +
                '(npx wrangler secret put LEMO_AUDIT_KEY), or the relay has not been deployed since the log was added.');
        }
        const data = await res.json();
        const got = Array.isArray(data.rows) ? data.rows : [];
        for (const r of got) if (r && typeof r === 'object') rows.push({ ...r, lobby });
        if (!data.more || !got.length) break;
        from = got[got.length - 1].at + 1;
    }
    return rows;
}

let rows = [];
try {
    for (const lobby of lobbies) rows = rows.concat(await readLobby(lobby));
} catch (err) {
    console.error('Could not read the log: ' + err.message);
    process.exit(1);
}
rows.sort((a, b) => b.at - a.at);      // newest first

// ── The page ─────────────────────────────────────────────────────────────────
// Everything a member (or the model) wrote goes through esc(): this file is opened in
// a browser, and a message is data, never markup.
const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const when = (ms) => new Date(ms).toLocaleString('ar-EG', {
    weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
});
const partsText = (p) => (Array.isArray(p) ? p : [])
    .map(x => (x && x.m ? String(x.m) : x && x.s ? `[ملصق: ${x.s}]` : '')).filter(Boolean);
const ERR_AR = {
    budget: 'رصيد حساب OpenAI انتهى', nokey: 'المفتاح أو النموذج غير صالح', err: 'خطأ من النموذج أو الشبكة',
};

// One turn he read before the question: a member's line / the overheard chat, or one
// of his own earlier answers (stored as the JSON he produced).
function turnHtml(t) {
    if (!t || typeof t !== 'object') return '';
    let text = String(t.c || '');
    if (t.r === 'a') {
        try { text = partsText(JSON.parse(text).p).join(' / ') || text; } catch (_) { /* cut short: shown as it is */ }
    }
    return `<div class="turn ${t.r === 'a' ? 'his' : ''}"><b>${t.r === 'a' ? 'ليمو' : 'قبلها'}</b><span>${esc(text)}</span></div>`;
}

function card(r) {
    const who = esc(r.n || 'عضو') + (r.who && r.who !== r.n ? ` <i>(${esc(r.who)})</i>` : '');
    const facts = [
        r.role ? `دوره: ${esc(r.role)}` : '',
        r.st ? `حالته: ${esc(r.st)}` : '',
        `حوله: ${Array.isArray(r.near) && r.near.length ? esc(r.near.join('، ')) : 'لا أحد'}`,
        Number.isFinite(r.on) ? `في المقر: ${r.on}` : '',
        r.cnt > 1 ? `رسالته رقم ${r.cnt} في آخر ١٠ دقائق` : '',
        Array.isArray(r.tk) && r.tk.length ? 'مهامه: ' + esc(r.tk.map(x => `«${x.t}» (${x.d})`).join('؛ ')) : '',
    ].filter(Boolean);
    const men = Array.isArray(r.men) && r.men.length
        ? `<details><summary>أعضاء أشار إليهم (${r.men.length}) — ما قيل لليمو عنهم</summary>${r.men.map(m => `<pre>${esc(m)}</pre>`).join('')}</details>` : '';
    const tools = Array.isArray(r.tools) && r.tools.length
        ? `<details><summary>ما طلبه ليمو بأدواته (${r.tools.length})</summary>${r.tools.map(t => `<pre>${esc(t.n)} ← ${esc(t.d)}</pre>`).join('')}</details>` : '';
    const hist = Array.isArray(r.hist) && r.hist.length
        ? `<details><summary>ما قرأه قبل السؤال (${r.hist.length})</summary>${r.hist.map(turnHtml).join('')}</details>` : '';
    const raw = r.raw ? `<details><summary>نص النموذج قبل التنظيف</summary><pre>${esc(r.raw)}</pre></details>` : '';
    const answer = r.e
        ? `<div class="err">لم يُجب — ${esc(ERR_AR[r.e] || r.e)}${r.em ? `<small>${esc(r.em)}</small>` : ''}</div>`
        : partsText(r.a).map(t => `<div class="a">${esc(t)}</div>`).join('');
    return `<article class="card" data-lobby="${esc(r.lobby)}">
  <header><span class="who">${who}</span><span class="tag ${r.lobby === 'female' ? 'f' : 'm'}">${esc(LOBBY_AR[r.lobby] || r.lobby)}</span><time>${esc(when(r.at))}</time></header>
  <p class="facts">${facts.join(' · ')}</p>
  <div class="q">${esc(r.q)}</div>
  ${answer}
  ${men}${tools}${hist}${raw}
  <footer>${esc(r.u || '')}${r.tin ? ` · tokens ${r.tin} + ${r.tout}` : ''}</footer>
</article>`;
}

const perMember = new Map();
for (const r of rows) {
    const k = (r.who || r.n || 'عضو') + ' — ' + (LOBBY_AR[r.lobby] || r.lobby);
    perMember.set(k, (perMember.get(k) || 0) + 1);
}
const top = [...perMember.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([k, n]) => `<span class="chip">${esc(k)}: ${n}</span>`).join('');
const range = days ? `المدة بالأيام: ${days}` : 'المدة: كل ما يحتفظ به المُرحِّل';

const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>سجل مراجعة ليمو</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 16px 80px; background: #111113; color: #e9e9ea; font: 16px/1.7 -apple-system, "SF Arabic", "Segoe UI", Tahoma, sans-serif; }
  main { max-width: 820px; margin: 0 auto; }
  h1 { margin: 0 0 4px; font-size: 1.5rem; }
  .sub { margin: 0 0 16px; color: #9a9aa0; font-size: 0.9rem; }
  .bar { position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 0; background: #111113; }
  .bar input { flex: 1 1 220px; min-width: 0; padding: 10px 14px; border-radius: 12px; border: 1px solid #2c2c31; background: #1a1a1d; color: inherit; font: inherit; }
  .bar button { padding: 8px 14px; border-radius: 50px; border: 1px solid #2c2c31; background: #1a1a1d; color: #c9c9cd; font: inherit; cursor: pointer; }
  .bar button.on { background: #e9e9ea; color: #111113; border-color: #e9e9ea; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 18px; }
  .chip { padding: 2px 10px; border-radius: 50px; background: #1c1c20; color: #b5b5ba; font-size: 0.8rem; }
  .card { margin: 0 0 14px; padding: 16px 18px; border-radius: 18px; background: #18181b; border: 1px solid #26262b; }
  .card[hidden] { display: none; }
  .card header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .who { font-weight: 700; }
  .who i { font-style: normal; font-weight: 400; color: #9a9aa0; }
  .tag { padding: 0 9px; border-radius: 50px; font-size: 0.75rem; }
  .tag.m { background: #16324a; color: #9cc9ee; }
  .tag.f { background: #43213a; color: #eeaad6; }
  time { margin-inline-start: auto; color: #8b8b92; font-size: 0.82rem; }
  .facts { margin: 6px 0 10px; color: #8f8f96; font-size: 0.84rem; }
  .q, .a, .err { padding: 10px 14px; border-radius: 14px; margin: 6px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .q { background: #232327; }
  .a { background: #3a3210; color: #ffe9a3; }
  .err { background: #3b1a1a; color: #f1b0b0; }
  .err small { display: block; color: #c98f8f; direction: ltr; text-align: left; }
  details { margin-top: 8px; color: #a5a5ab; font-size: 0.86rem; }
  summary { cursor: pointer; }
  pre { margin: 6px 0 0; padding: 10px 12px; border-radius: 10px; background: #101012; white-space: pre-wrap; overflow-wrap: anywhere; font: 0.82rem/1.6 ui-monospace, Menlo, monospace; }
  .turn { display: flex; gap: 8px; margin-top: 6px; padding: 8px 10px; border-radius: 10px; background: #101012; white-space: pre-wrap; overflow-wrap: anywhere; }
  .turn b { flex: none; color: #77777e; font-weight: 600; }
  .turn.his b { color: #c9b259; }
  footer { margin-top: 10px; color: #5f5f66; font-size: 0.74rem; direction: ltr; text-align: left; }
  .none { padding: 40px 0; text-align: center; color: #8b8b92; }
</style>
</head>
<body>
<main>
  <h1>سجل مراجعة ليمو</h1>
  <p class="sub">عدد الأسئلة: ${rows.length} · ${esc(range)} · صُدّر ${esc(when(Date.now()))} · هذا الملف على جهازك فقط، لا تشاركه.</p>
  <div class="chips">${top}</div>
  <div class="bar">
    <input id="find" type="search" placeholder="ابحث باسم عضو أو بكلمة من السؤال أو الرد">
    <button data-l="" class="on">الكل</button>
    <button data-l="male">الإخوة</button>
    <button data-l="female">الأخوات</button>
  </div>
  ${rows.length ? rows.map(card).join('\n') : '<p class="none">لا أسئلة في هذه المدة.</p>'}
</main>
<script>
  (function () {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
    var find = document.getElementById('find');
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.bar button'));
    var lobby = '';
    function apply() {
      var q = find.value.trim().toLowerCase();
      cards.forEach(function (c) {
        var ok = (!lobby || c.getAttribute('data-lobby') === lobby) && (!q || c.textContent.toLowerCase().indexOf(q) >= 0);
        c.hidden = !ok;
      });
    }
    find.addEventListener('input', apply);
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        lobby = b.getAttribute('data-l');
        buttons.forEach(function (x) { x.classList.toggle('on', x === b); });
        apply();
      });
    });
  })();
</script>
</body>
</html>
`;

const outDir = join(root, 'tools', 'out');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'lemo-log.html'), html);
writeFileSync(join(outDir, 'lemo-log.json'), JSON.stringify(rows, null, 2));
console.log(`${rows.length} questions (${lobbies.join(' + ')}, ${days ? 'last ' + days + ' days' : 'everything kept'})`);
console.log('→ tools/out/lemo-log.html   (open it in your browser)');
console.log('→ tools/out/lemo-log.json');
