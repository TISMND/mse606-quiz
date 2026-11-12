// Confirm work/tagged/chNN.json differs from work/checked/chNN.json ONLY by an added `terms` array.
// Usage: node tools/check-tagged.mjs   (exit 1 on any other difference)
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
let bad = 0, tagged = 0, withTerms = 0, total = 0;
for (const f of readdirSync(new URL('work/tagged/', root)).filter((f) => /^ch\d\d\.json$/.test(f))) {
  const a = JSON.parse(readFileSync(new URL(`work/checked/${f}`, root), 'utf8'));
  const b = JSON.parse(readFileSync(new URL(`work/tagged/${f}`, root), 'utf8'));
  if (a.length !== b.length) { console.error(`${f}: ${a.length} vs ${b.length} questions`); bad++; continue; }
  a.forEach((q, i) => {
    const { terms, ...rest } = b[i];
    total++;
    if (JSON.stringify(rest) !== JSON.stringify(q)) { console.error(`${f} #${i} ${q.id}: content changed`); bad++; }
    if (!Array.isArray(terms)) { console.error(`${f} ${q.id}: no terms array`); bad++; }
    else if (terms.length) withTerms++;
  });
  tagged++;
}
console.log(`files ${tagged}, questions ${total}, with terms ${withTerms} (${total ? Math.round((withTerms / total) * 100) : 0}%), problems ${bad}`);
if (bad) process.exit(1);
void existsSync;
