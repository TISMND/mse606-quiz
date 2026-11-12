import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { validateTerm } from '../tools/validate.mjs';

const good = { id: 'job-enrichment', term: 'Job enrichment', chapter: 7, section: '7.2', short: 'More responsibility.' };
const load = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
const has = (f) => existsSync(new URL(`../${f}`, import.meta.url));

test('a valid term has no errors', () => {
  assert.deepEqual(validateTerm(good), []);
  assert.deepEqual(validateTerm({ ...good, confusedWith: [{ id: 'job-enlargement', note: 'x' }] }), []);
});

test('validateTerm flags bad slug, chapter, empty or long short, bad confusedWith', () => {
  assert.ok(validateTerm({ ...good, id: 'Job_Enrichment' }).length);
  assert.ok(validateTerm({ ...good, chapter: 4 }).length);
  assert.ok(validateTerm({ ...good, short: ' ' }).length);
  assert.ok(validateTerm({ ...good, short: 'x'.repeat(300) }).length);
  assert.ok(validateTerm({ ...good, confusedWith: 'job-enlargement' }).length);
});

test('glossary.json, when built, is valid with unique ids', { skip: !has('glossary.json') }, () => {
  const g = load('glossary.json');
  const ids = new Set();
  for (const t of g.terms) {
    assert.deepEqual(validateTerm(t), [], t.id);
    assert.ok(!ids.has(t.id), `duplicate ${t.id}`);
    ids.add(t.id);
  }
  assert.ok(g.terms.length > 100);
});

test('every question term tag exists in the glossary', { skip: !(has('glossary.json') && has('questions.json')) }, () => {
  const ids = new Set(load('glossary.json').terms.map((t) => t.id));
  for (const q of load('questions.json').questions) for (const id of q.terms || []) assert.ok(ids.has(id), `${q.id} → ${id}`);
});
