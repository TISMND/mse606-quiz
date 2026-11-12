import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexGlossary, termsFor, struggling, sortTerms, searchTerms } from '../js/terms.js';
import { emptyUser, toggleSkip } from '../js/logic.js';

const G = indexGlossary({ terms: [
  { id: 'job-enrichment', term: 'Job enrichment', chapter: 7, short: 'More responsibility; vertical loading.' },
  { id: 'job-enlargement', term: 'Job enlargement', chapter: 7, short: 'Larger share of the task; horizontal loading.' },
  { id: 'capacity-cushion', term: 'Capacity cushion', chapter: 5, short: 'Capacity minus expected demand.' },
  { id: 'aggregate-planning', term: 'aggregate planning', chapter: 11, short: 'Intermediate-range planning.' },
] });
const opt = [{ text: 'a', correct: true }, { text: 'b', correct: false }];
const BANK = [
  { id: 'ch07-001', chapter: 7, options: opt, terms: ['job-enrichment', 'job-enlargement'] },
  { id: 'ch07-002', chapter: 7, options: opt, terms: ['job-enrichment', 'capacity-cushion', 'no-such-term'] },
  { id: 'ch07-003', chapter: 7, options: opt },
  { id: 'ch05-001', chapter: 5, options: opt, terms: ['capacity-cushion'] },
];

test('termsFor resolves ids in order and drops unknown ones', () => {
  assert.deepEqual(termsFor(BANK[1], G.byId).map((t) => t.id), ['job-enrichment', 'capacity-cushion']);
});

test('termsFor of a question without terms (stale cache) is empty', () => {
  assert.deepEqual(termsFor(BANK[2], G.byId), []);
  assert.deepEqual(termsFor(BANK[0], null), []);
});

test('termsFor keeps a cross-chapter term with its own chapter', () => {
  assert.equal(termsFor(BANK[1], G.byId)[1].chapter, 5);
});

test('struggling counts terms per missed question, sorted by count then chapter', () => {
  const u = { ...emptyUser(), misses: { 'ch07-001': 1, 'ch07-002': 2, 'ch05-001': 3, 'ch99-001': 4 } };
  const s = struggling(BANK, u, G.byId);
  assert.deepEqual(s.map((x) => [x.term.id, x.count]), [['capacity-cushion', 2], ['job-enrichment', 2], ['job-enlargement', 1]]);
  assert.deepEqual(s[1].qids.sort(), ['ch07-001', 'ch07-002']);
});

test('struggling excludes skipped questions', () => {
  let u = { ...emptyUser(), misses: { 'ch07-001': 1, 'ch07-002': 2 } };
  u = toggleSkip(u, 'ch07-002', true);
  assert.deepEqual(struggling(BANK, u, G.byId).map((x) => [x.term.id, x.count]), [['job-enlargement', 1], ['job-enrichment', 1]]);
});

test('struggling is empty with no misses or no glossary', () => {
  assert.deepEqual(struggling(BANK, emptyUser(), G.byId), []);
  assert.deepEqual(struggling(BANK, { ...emptyUser(), misses: { 'ch07-001': 1 } }, null), []);
});

test('sortTerms orders by chapter then term, case-insensitive', () => {
  assert.deepEqual(sortTerms(G.terms).map((t) => t.id), ['capacity-cushion', 'job-enlargement', 'job-enrichment', 'aggregate-planning']);
});

test('searchTerms matches term and short, case-insensitively, and tolerates odd input', () => {
  assert.deepEqual(searchTerms(G.terms, 'ENRICH').map((t) => t.id), ['job-enrichment']);
  assert.deepEqual(searchTerms(G.terms, 'horizontal').map((t) => t.id), ['job-enlargement']);
  assert.deepEqual(searchTerms(G.terms, '('), []);
  assert.equal(searchTerms(G.terms, '  ').length, 4);
});
