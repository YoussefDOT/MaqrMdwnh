// Prints exactly what ليمو's model reads, so his speech can be tried OUTSIDE the مقر —
// e.g. in the OpenAI Playground — as any member, a sister included. No key needed: this
// only builds the text (presence-server/src/lemo.js → lemoMessages), it never calls
// the model.
//
//   node tools/lemo_prompt.mjs                      a sister asks, two sisters near her
//   node tools/lemo_prompt.mjs --m                  a brother asks, two brothers near him
//   node tools/lemo_prompt.mjs --name "فلانة" --near "أ، ب" --q "سؤالك"
//   node tools/lemo_prompt.mjs --m --count 7 --tasks "مونتاج الحلقة|غدًا, غلاف العدد|بعد 4 يوم"
//
// Writes tools/out/lemo-test.txt (gitignored): block 1 is the system prompt, block 2 the
// message. Re-run it after editing PERSONA / KNOWLEDGE so the test matches the code.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lemoMessages } from '../presence-server/src/lemo.js';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? (args[i + 1] || '') : ''; };
const gender = args.includes('--m') ? 'm' : 'f';

// First pass only to get the roster, so the defaults are real members of that lobby.
const { know } = await lemoMessages({}, { text: '-', name: '-', gender, near: [], men: [] }, []);
const lobby = know.members.filter(m => m.gender === gender && !m.admin);
if (!lobby.length) console.warn('! The roster did not load — names below are placeholders.');

const asker = lobby.find(m => m.display === opt('--name') || m.name === opt('--name')) || lobby[0];
const name = opt('--name') || (asker && asker.display) || (gender === 'f' ? 'عضوة' : 'عضو');
const near = opt('--near')
    ? opt('--near').split(/[,،]/).map(s => s.trim()).filter(Boolean)
    : lobby.filter(m => m !== asker).slice(0, 2).map(m => m.display);
const text = opt('--q') || 'يا ليمو، إيه أخبار المقر النهارده؟';

const now = new Date();
const q = {
    text, name, gender, near, men: [],
    count: Math.max(1, Number(opt('--count')) || 1),
    // --tasks "عنوان|غدًا, عنوان آخر|بعد 4 يوم"
    tasks: opt('--tasks').split(/[,،]/).map(x => x.trim()).filter(Boolean).slice(0, 3)
        .map(x => { const [t, d] = x.split('|'); return { t: (t || '').trim(), d: (d || 'بلا موعد').trim() }; }),
    slug: asker && !opt('--name') ? asker.slug : (asker && (asker.display === name || asker.name === name) ? asker.slug : ''),
    time: now.toLocaleString('ar-EG', { weekday: 'long', hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'long', year: 'numeric' }),
    hijri: now.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }),
    state: 'عمل اليوم 40 دقيقة، المتبقي من حضور اليوم 95 دقيقة',
    online: near.length + 1,
};
const { messages } = await lemoMessages({}, q, []);
const system = messages[0].content;
const user = messages[messages.length - 1].content;

const bar = (t) => `\n${'='.repeat(78)}\n${t}\n${'='.repeat(78)}\n`;
const out = [
    'ليمو — test prompt. Made by tools/lemo_prompt.mjs; re-run it after changing his persona.',
    '',
    'HOW TO USE (OpenAI Playground → Chat):',
    '  1. Model: gpt-6-luna.   Reasoning effort: none/minimal.   Response format: JSON object.',
    '  2. Paste BLOCK 1 into the "System / Developer message" box.',
    '  3. Paste BLOCK 2 as your message and send. He answers as {"p":[{"m":"text"},{"s":"sticker"}]}.',
    '  4. For the next question, paste BLOCK 2 again and change only the lines marked ◀ below.',
    '',
    'The lines to change in BLOCK 2:',
    '  من يكلّمك: <name> (أنثى …)      ◀ who is asking. For a brother the line is:  من يكلّمك: <name> (ذكر — خاطبه بالمذكر)',
    '  حوله في المكان: <names>         ◀ who stands near, separated by «،» — or: لا أحد قريب',
    '  حالته الآن: …                    ◀ optional (how long they worked today)',
    '  the LAST line                    ◀ the question itself',
    bar('BLOCK 1 — SYSTEM MESSAGE (paste once)'),
    system,
    bar('BLOCK 2 — YOUR MESSAGE (paste, edit the marked lines, send)'),
    user,
    '',
].join('\n');

const file = join(dirname(fileURLToPath(import.meta.url)), 'out', 'lemo-test.txt');
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, out, 'utf8');
console.log(`Wrote ${file}\n  asker: ${name} (${gender === 'f' ? 'sister' : 'brother'})   near: ${near.join('، ') || '—'}\n  system prompt: ${system.length} chars`);
