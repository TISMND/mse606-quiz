import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LENGTHS, emptyUser, available, lengthCounts, buildSession, shuffleOptions, isCorrect,
  applyAnswer, toggleSkip, resetStats, average, chapterPct, missCount, scoreExam, mergeUsers,
} from '../js/logic.js';

const opt = (text, correct) => ({ text, correct });
const BANK = [
  { id: 'ch01-001', chapter: 1, type: 'cata', stem: 'a', options: [opt('x', true), opt('y', false), opt('z', true), opt('w', false)] },
  { id: 'ch01-002', chapter: 1, type: 'tf', stem: 'b', options: [opt('True', false), opt('False', true)] },
  { id: 'ch01-003', chapter: 1, type: 'not', stem: 'c', options: [opt('x', true), opt('y', false), opt('z', false), opt('w', false)] },
  { id: 'ch07-001', chapter: 7, type: 'cata', stem: 'd', options: [opt('x', true), opt('y', true), opt('z', false), opt('w', false)] },
  { id: 'ch07-002', chapter: 7, type: 'tf', stem: 'e', options: [opt('True', true), opt('False', false)] },
  { id: 'ch07-003', chapter: 7, type: 'single', stem: 'f', options: [opt('x', false), opt('y', true), opt('z', false), opt('w', false)] },
];
const byId = (id) => BANK.find((q) => q.id === id);

test('LENGTHS match the spec', () => {
  assert.deepEqual(LENGTHS, { short: 15, moderate: 35, long: 70, all: Infinity });
});

test('lengthCounts caps every length at the available count', () => {
  assert.deepEqual(lengthCounts(BANK, [1, 7], emptyUser()), { short: 6, moderate: 6, long: 6, all: 6 });
});

test('lengthCounts is all zeros with no chapters chosen', () => {
  assert.deepEqual(lengthCounts(BANK, [], emptyUser()), { short: 0, moderate: 0, long: 0, all: 0 });
});

test('available leaves out skipped questions and other chapters', () => {
  const u = toggleSkip(emptyUser(), 'ch07-001', true);
  assert.deepEqual(available(BANK, [7], u).map((q) => q.id).sort(), ['ch07-002', 'ch07-003']);
});

test('buildSession practice respects length and skips', () => {
  const u = toggleSkip(emptyUser(), 'ch01-001', true);
  const s = buildSession(BANK, { mode: 'practice', chapters: [1, 7], length: 'short' }, u);
  assert.equal(s.length, 5);
  assert.ok(!s.some((q) => q.id === 'ch01-001'));
  const capped = buildSession(Array.from({ length: 20 }, (_, i) => ({ ...BANK[0], id: `ch01-${String(i).padStart(3, '0')}` })),
    { mode: 'practice', chapters: [1], length: 'short' }, emptyUser());
  assert.equal(capped.length, 15);
});

test('buildSession drill returns only bank misses, ignoring unknown ids and skips', () => {
  let u = emptyUser();
  u = { ...u, misses: { 'ch01-002': 1, 'ch99-001': 2, 'ch07-003': 3 } };
  u = toggleSkip(u, 'ch07-003', true);
  const s = buildSession(BANK, { mode: 'drill', chapters: [], length: 'short' }, u);
  assert.deepEqual(s.map((q) => q.id), ['ch01-002']);
});

test('buildSession exam gives at most 25 from chosen chapters', () => {
  const big = Array.from({ length: 40 }, (_, i) => ({ ...BANK[0], id: `ch01-${String(i).padStart(3, '0')}` }));
  assert.equal(buildSession(big, { mode: 'exam', chapters: [1] }, emptyUser()).length, 25);
  assert.equal(buildSession(BANK, { mode: 'exam', chapters: [7] }, emptyUser()).length, 3);
});

test('missCount counts only bank ids that are not skipped', () => {
  const u = toggleSkip({ ...emptyUser(), misses: { 'ch01-001': 1, 'ch99-001': 1, 'ch07-001': 1 } }, 'ch07-001', true);
  assert.equal(missCount(BANK, u), 1);
});

test('isCorrect needs an exact set match in any order', () => {
  const q = byId('ch01-001');
  assert.equal(isCorrect(q, [2, 0]), true);
  assert.equal(isCorrect(q, [0]), false);
  assert.equal(isCorrect(q, [0, 1, 2]), false);
  assert.equal(isCorrect(q, []), false);
});

test('shuffleOptions keeps tf order and permutes others', () => {
  assert.deepEqual(shuffleOptions(byId('ch01-002'), () => 0.01).order, [0, 1]);
  const { order } = shuffleOptions(byId('ch01-001'), () => 0.01);
  assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
});

test('applyAnswer wrong in practice adds miss and counts stats', () => {
  const u = applyAnswer(emptyUser(), byId('ch07-001'), false, 'practice');
  assert.ok(u.misses['ch07-001'] > 0);
  assert.deepEqual(u.stats[7], { right: 0, total: 1 });
});

test('applyAnswer correct in drill removes the miss; correct in practice keeps it', () => {
  const start = applyAnswer(emptyUser(), byId('ch07-001'), false, 'practice');
  assert.ok(!('ch07-001' in applyAnswer(start, byId('ch07-001'), true, 'drill').misses));
  assert.ok('ch07-001' in applyAnswer(start, byId('ch07-001'), true, 'practice').misses);
  assert.deepEqual(applyAnswer(start, byId('ch07-001'), true, 'practice').stats[7], { right: 1, total: 2 });
});

test('applyAnswer does not mutate its input', () => {
  const u = emptyUser();
  applyAnswer(u, byId('ch07-001'), false, 'practice');
  assert.deepEqual(u, emptyUser());
});

test('resetStats clears scores but keeps misses and skips', () => {
  let u = applyAnswer(emptyUser(), byId('ch07-001'), false, 'practice');
  u = toggleSkip(u, 'ch01-001', true);
  const r = resetStats(u);
  assert.deepEqual(r.stats, {});
  assert.ok(r.statsResetAt > 0);
  assert.ok('ch07-001' in r.misses);
  assert.deepEqual(r.skipped, ['ch01-001']);
});

test('toggleSkip off removes the id', () => {
  const u = toggleSkip(toggleSkip(emptyUser(), 'ch01-001', true), 'ch01-001', false);
  assert.deepEqual(u.skipped, []);
});

test('average and chapterPct', () => {
  const u = { ...emptyUser(), stats: { 1: { right: 3, total: 4 }, 7: { right: 1, total: 4 } } };
  assert.equal(average(u), 0.5);
  assert.equal(chapterPct(u, 1), 0.75);
  assert.equal(chapterPct(u, 9), null);
  assert.equal(average(emptyUser()), null);
});

test('scoreExam counts unanswered questions as wrong', () => {
  const qs = [byId('ch01-001'), byId('ch01-002'), byId('ch07-002')];
  const r = scoreExam(qs, { 'ch01-001': [0, 2], 'ch01-002': [0] });
  assert.equal(r.right, 1);
  assert.equal(r.total, 3);
  assert.deepEqual(r.results.map((x) => x.correct), [true, false, false]);
  assert.deepEqual(r.results[2].picked, []);
});

test('mergeUsers sums stats, unions skips, keeps later miss times', () => {
  const a = { skipped: ['ch01-001'], misses: { 'ch01-002': 5 }, stats: { 1: { right: 2, total: 3 } }, statsResetAt: 10 };
  const b = { skipped: ['ch01-001', 'ch07-001'], misses: { 'ch01-002': 9, 'ch07-002': 1 }, stats: { 1: { right: 1, total: 1 }, 7: { right: 0, total: 2 } }, statsResetAt: null };
  const m = mergeUsers(a, b);
  assert.deepEqual(m.stats, { 1: { right: 3, total: 4 }, 7: { right: 0, total: 2 } });
  assert.deepEqual([...m.skipped].sort(), ['ch01-001', 'ch07-001']);
  assert.deepEqual(m.misses, { 'ch01-002': 9, 'ch07-002': 1 });
  assert.equal(m.statsResetAt, 10);
});
