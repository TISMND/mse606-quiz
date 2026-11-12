// Merge work/checked/chNN.json (falling back to work/questions/) into questions.json.
// Usage: node tools/build-questions.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { CHAPTERS, validateQuestion } from './validate.mjs';

const root = new URL('../', import.meta.url);
const all = [];
const ids = new Set();
const counts = {};

for (const ch of Object.keys(CHAPTERS)) {
  const nn = String(ch).padStart(2, '0');
  let file = new URL(`work/checked/ch${nn}.json`, root);
  if (!existsSync(file)) {
    file = new URL(`work/questions/ch${nn}.json`, root);
    if (!existsSync(file)) { console.warn(`ch${nn}: no questions`); continue; }
    console.warn(`ch${nn}: WARNING using unchecked questions`);
  }
  const qs = JSON.parse(readFileSync(file, 'utf8'));
  for (const q of qs) {
    const errs = validateQuestion(q);
    if (ids.has(q.id)) errs.push('duplicate id');
    if (errs.length) { console.warn(`drop ${q.id}: ${errs.join(', ')}`); continue; }
    ids.add(q.id);
    all.push(q);
    counts[ch] = (counts[ch] || 0) + 1;
  }
}

const chapters = Object.fromEntries(Object.entries(CHAPTERS).filter(([ch]) => counts[ch]));
writeFileSync(new URL('questions.json', root),
  JSON.stringify({ version: new Date().toISOString(), chapters, questions: all }));
for (const [ch, n] of Object.entries(counts)) console.log(`ch${String(ch).padStart(2, '0')}: ${n}`);
console.log(`total: ${all.length}`);
