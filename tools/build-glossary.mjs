// Merge work/glossary-checked/chNN.json (falling back to work/glossary/) into glossary.json.
// Usage: node tools/build-glossary.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { CHAPTERS, validateTerm } from './validate.mjs';

// Terms defined in several chapters with the SAME meaning: keep the entry from this chapter.
const HOME = {
  'lead-time': 12, 'random-variation': 10, 'assignable-variation': 10, technology: 6, 'six-sigma': 9,
  outsourcing: 1, 'process-yield': 10, 'control-chart': 10, 'single-minute-exchange-of-die': 14,
  'taguchi-loss-function': 10, 'quality-of-conformance': 9, kaizen: 14, 'lean-operation': 14,
};
// Same id, DIFFERENT meaning in one chapter: give that chapter's entry its own id (refs in that chapter follow).
const RENAME = {
  5: { efficiency: { id: 'efficiency-capacity', term: 'Efficiency (capacity)' } },
  3: { 'control-chart': { id: 'control-chart-forecasting', term: 'Control chart (forecasting)' } },
};

const root = new URL('../', import.meta.url);
const byId = new Map();
let bad = 0;
for (const ch of Object.keys(CHAPTERS)) {
  const nn = String(ch).padStart(2, '0');
  let file = new URL(`work/glossary-checked/ch${nn}.json`, root);
  if (!existsSync(file)) {
    file = new URL(`work/glossary/ch${nn}.json`, root);
    if (!existsSync(file)) { console.warn(`ch${nn}: no glossary`); continue; }
    console.warn(`ch${nn}: WARNING using unchecked glossary`);
  }
  const ren = RENAME[ch] || {};
  for (let t of JSON.parse(readFileSync(file, 'utf8'))) {
    t = { ...t, chapter: Number(t.chapter) };
    if (ren[t.id]) t = { ...t, ...ren[t.id] };
    if (t.confusedWith) t.confusedWith = t.confusedWith.map((c) => (ren[c.id] ? { ...c, id: ren[c.id].id } : c));
    const errs = validateTerm(t);
    if (errs.length) { console.warn(`drop ${t.id} (ch${nn}): ${errs.join(', ')}`); bad++; continue; }
    const prev = byId.get(t.id);
    if (!prev) { byId.set(t.id, t); continue; }
    const home = HOME[t.id];
    if (home === undefined) console.warn(`COLLISION ${t.id} ch${prev.chapter}/ch${t.chapter} (no HOME; keeping ch${prev.chapter})`);
    else if (t.chapter === home) byId.set(t.id, t);
  }
}
for (const [id, home] of Object.entries(HOME)) if (byId.get(id) && byId.get(id).chapter !== home) console.warn(`HOME ${id}: ch${home} entry missing`);

const terms = [...byId.values()];
let unlinked = 0;
for (const t of terms) for (const c of t.confusedWith || []) if (!byId.has(c.id)) { c.unlinked = true; unlinked++; }
writeFileSync(new URL('glossary.json', root), JSON.stringify({ version: new Date().toISOString(), terms }));
console.log(`terms: ${terms.length} (dropped ${bad}, confusedWith refs shown unlinked: ${unlinked})`);
