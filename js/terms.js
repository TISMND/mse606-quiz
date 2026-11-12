// Pure glossary logic: no DOM. Tolerates a missing glossary and questions without `terms`
// (a student may have an old questions.json cached alongside new code).

export function indexGlossary(glossary) {
  const terms = Array.isArray(glossary?.terms) ? glossary.terms : [];
  return { terms, byId: Object.fromEntries(terms.map((t) => [t.id, t])) };
}

export function termsFor(q, byId) {
  if (!byId || !Array.isArray(q?.terms)) return [];
  return q.terms.map((id) => byId[id]).filter(Boolean);
}

const cmpTerm = (a, b) => a.chapter - b.chapter || a.term.toLowerCase().localeCompare(b.term.toLowerCase());

export function sortTerms(terms) {
  return [...terms].sort(cmpTerm);
}

export function struggling(bank, user, byId) {
  if (!byId) return [];
  const skipped = new Set(user.skipped);
  const found = new Map();
  for (const q of bank) {
    if (!(q.id in user.misses) || skipped.has(q.id)) continue;
    for (const term of termsFor(q, byId)) {
      const e = found.get(term.id) || { term, count: 0, qids: [] };
      e.count++;
      e.qids.push(q.id);
      found.set(term.id, e);
    }
  }
  return [...found.values()].sort((a, b) => b.count - a.count || cmpTerm(a.term, b.term));
}

export function searchTerms(terms, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return terms;
  return terms.filter((t) => t.term.toLowerCase().includes(q) || (t.short || '').toLowerCase().includes(q));
}
