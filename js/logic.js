// Pure quiz logic: no DOM, no Firebase. Every function returns new objects.

export const LENGTHS = { short: 15, moderate: 35, long: 70, all: Infinity };
export const EXAM_SIZE = 25;
export const EXAM_SECONDS_PER_QUESTION = 90;

export function emptyUser() {
  return { skipped: [], misses: {}, stats: {}, statsResetAt: null };
}

function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function available(bank, chapters, user) {
  const chs = new Set(chapters.map(Number));
  const skipped = new Set(user.skipped);
  return bank.filter((q) => chs.has(q.chapter) && !skipped.has(q.id));
}

export function lengthCounts(bank, chapters, user) {
  const n = available(bank, chapters, user).length;
  const out = {};
  for (const [k, v] of Object.entries(LENGTHS)) out[k] = Math.min(v, n);
  return out;
}

export function buildSession(bank, { mode, chapters = [], length = 'moderate' }, user, rng = Math.random) {
  if (mode === 'drill') {
    const skipped = new Set(user.skipped);
    return shuffle(bank.filter((q) => q.id in user.misses && !skipped.has(q.id)), rng);
  }
  const pool = shuffle(available(bank, chapters, user), rng);
  const n = mode === 'exam' ? EXAM_SIZE : LENGTHS[length] ?? LENGTHS.moderate;
  return pool.slice(0, n);
}

export function shuffleOptions(q, rng = Math.random) {
  const idx = q.options.map((_, i) => i);
  return { q, order: q.type === 'tf' ? idx : shuffle(idx, rng) };
}

export function isCorrect(q, pickedIdx) {
  const want = q.options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0);
  const got = [...new Set(pickedIdx)];
  return got.length === want.length && want.every((i) => got.includes(i));
}

export function applyAnswer(user, q, correct, mode) {
  const prev = user.stats[q.chapter] || { right: 0, total: 0 };
  const stats = { ...user.stats, [q.chapter]: { right: prev.right + (correct ? 1 : 0), total: prev.total + 1 } };
  const misses = { ...user.misses };
  if (!correct) misses[q.id] = Date.now();
  else if (mode === 'drill') delete misses[q.id];
  return { ...user, stats, misses };
}

export function toggleSkip(user, id, on) {
  const s = new Set(user.skipped);
  if (on) s.add(id); else s.delete(id);
  return { ...user, skipped: [...s] };
}

export function resetStats(user) {
  return { ...user, stats: {}, statsResetAt: Date.now() };
}

function sums(user) {
  let right = 0, total = 0;
  for (const s of Object.values(user.stats)) { right += s.right; total += s.total; }
  return { right, total };
}

export function average(user) {
  const { right, total } = sums(user);
  return total ? right / total : null;
}

export function chapterPct(user, ch) {
  const s = user.stats[ch];
  return s && s.total ? s.right / s.total : null;
}

export function missCount(bank, user) {
  const skipped = new Set(user.skipped);
  return bank.filter((q) => q.id in user.misses && !skipped.has(q.id)).length;
}

export function scoreExam(questions, answers) {
  const results = questions.map((q) => {
    const picked = answers[q.id] || [];
    return { q, picked, correct: picked.length > 0 && isCorrect(q, picked) };
  });
  return { right: results.filter((r) => r.correct).length, total: results.length, results };
}

export function mergeUsers(a, b) {
  const stats = {};
  for (const src of [a.stats || {}, b.stats || {}]) {
    for (const [ch, s] of Object.entries(src)) {
      const p = stats[ch] || { right: 0, total: 0 };
      stats[ch] = { right: p.right + s.right, total: p.total + s.total };
    }
  }
  const misses = { ...(a.misses || {}) };
  for (const [id, t] of Object.entries(b.misses || {})) misses[id] = Math.max(misses[id] || 0, t);
  const resets = [a.statsResetAt, b.statsResetAt].filter((x) => x != null);
  return {
    skipped: [...new Set([...(a.skipped || []), ...(b.skipped || [])])],
    misses,
    stats,
    statsResetAt: resets.length ? Math.max(...resets) : null,
  };
}

// A delta is what changed between two snapshots of one user, in a form that can be applied on top
// of a different (e.g. newer, from another device) copy without losing that copy's progress.
// { reset: number|null, stats: {ch:{right,total}} increments, misses: {id: time|null}, skipAdd, skipRemove }
export function diffUser(prev, next) {
  const reset = (next.statsResetAt ?? null) !== (prev.statsResetAt ?? null) ? next.statsResetAt : null;
  const base = reset != null ? {} : prev.stats || {};
  const stats = {};
  for (const [ch, s] of Object.entries(next.stats || {})) {
    const p = base[ch] || { right: 0, total: 0 };
    const dr = s.right - p.right, dt = s.total - p.total;
    if (dr || dt) stats[ch] = { right: dr, total: dt };
  }
  const misses = {};
  for (const [id, t] of Object.entries(next.misses || {})) if ((prev.misses || {})[id] !== t) misses[id] = t;
  for (const id of Object.keys(prev.misses || {})) if (!(id in (next.misses || {}))) misses[id] = null;
  const ps = new Set(prev.skipped || []), ns = new Set(next.skipped || []);
  return {
    reset, stats, misses,
    skipAdd: [...ns].filter((id) => !ps.has(id)),
    skipRemove: [...ps].filter((id) => !ns.has(id)),
  };
}

export function applyDelta(user, d) {
  const u = { ...emptyUser(), ...user };
  let stats = d.reset != null ? {} : { ...u.stats };
  for (const [ch, s] of Object.entries(d.stats)) {
    const p = stats[ch] || { right: 0, total: 0 };
    stats[ch] = { right: p.right + s.right, total: p.total + s.total };
  }
  const misses = { ...u.misses };
  for (const [id, t] of Object.entries(d.misses)) { if (t == null) delete misses[id]; else misses[id] = t; }
  const skipped = new Set(u.skipped);
  d.skipAdd.forEach((id) => skipped.add(id));
  d.skipRemove.forEach((id) => skipped.delete(id));
  return { ...u, stats, misses, skipped: [...skipped], statsResetAt: d.reset != null ? d.reset : u.statsResetAt };
}

export function isEmptyDelta(d) {
  return d.reset == null && !Object.keys(d.stats).length && !Object.keys(d.misses).length && !d.skipAdd.length && !d.skipRemove.length;
}
