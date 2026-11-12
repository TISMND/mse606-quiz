export const CHAPTERS = {
  1: 'Intro to OM & Supply Chain',
  2: 'Competitiveness & Productivity',
  3: 'Forecasting',
  5: 'Capacity Planning',
  6: 'Process & Layout',
  7: 'Work Design',
  8: 'Location Planning',
  9: 'Mgmt of Quality',
  10: 'Quality Control',
  11: 'Aggregate Planning',
  12: 'Inventory',
  14: 'JIT & Lean',
};
const TYPES = ['cata', 'not', 'tf', 'term', 'single'];
const blank = (s) => typeof s !== 'string' || !s.trim();

export function validateQuestion(q) {
  const e = [];
  if (!/^ch\d\d-\d{3}$/.test(q.id || '')) e.push('bad id');
  if (!(q.chapter in CHAPTERS)) e.push('bad chapter');
  if (!TYPES.includes(q.type)) e.push('bad type');
  if (blank(q.stem)) e.push('empty stem');
  const opts = Array.isArray(q.options) ? q.options : [];
  if (opts.some((o) => blank(o.text))) e.push('empty option');
  const texts = opts.map((o) => (o.text || '').trim().toLowerCase());
  if (new Set(texts).size !== texts.length) e.push('duplicate option text');
  const nCorrect = opts.filter((o) => o.correct === true).length;
  if (q.type === 'cata' || q.type === 'not') {
    if (opts.length < 4 || opts.length > 7) e.push('needs 4-7 options');
    if (nCorrect < 1) e.push('no correct option');
    if (q.type === 'cata' && nCorrect === opts.length) e.push('every option correct');
  } else if (q.type === 'tf') {
    if (opts.length !== 2 || opts[0]?.text !== 'True' || opts[1]?.text !== 'False') e.push('tf must be True, False');
    if (nCorrect !== 1) e.push('tf needs exactly one correct');
  } else if (q.type === 'term' || q.type === 'single') {
    if (opts.length < 2) e.push('too few options');
    if (nCorrect !== 1) e.push('needs exactly one correct');
  }
  return e;
}
