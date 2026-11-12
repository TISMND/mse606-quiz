import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { validateQuestion } from '../tools/validate.mjs';

const o = (text, correct) => ({ text, correct });
const good = {
  id: 'ch07-001', chapter: 7, section: '7.1', type: 'cata', stem: 'Which apply?',
  options: [o('a', true), o('b', false), o('c', true), o('d', false)], source: 'ch07.md',
};

test('a valid question has no errors', () => {
  assert.deepEqual(validateQuestion(good), []);
});

test('flags duplicate option text', () => {
  assert.ok(validateQuestion({ ...good, options: [o('a', true), o('a', false), o('c', true), o('d', false)] }).length > 0);
});

test('flags a tf with two correct', () => {
  assert.ok(validateQuestion({ ...good, type: 'tf', options: [o('True', true), o('False', true)] }).length > 0);
});

test('flags a tf not in True, False order', () => {
  assert.ok(validateQuestion({ ...good, type: 'tf', options: [o('False', true), o('True', false)] }).length > 0);
});

test('flags a cata where every option is correct', () => {
  assert.ok(validateQuestion({ ...good, options: [o('a', true), o('b', true), o('c', true), o('d', true)] }).length > 0);
});

test('flags bad id, chapter, type and empty text', () => {
  assert.ok(validateQuestion({ ...good, id: 'x7-1' }).length > 0);
  assert.ok(validateQuestion({ ...good, chapter: 4 }).length > 0);
  assert.ok(validateQuestion({ ...good, type: 'essay' }).length > 0);
  assert.ok(validateQuestion({ ...good, stem: ' ' }).length > 0);
});

test('flags term/single without exactly one correct', () => {
  assert.ok(validateQuestion({ ...good, type: 'term' }).length > 0);
  assert.deepEqual(validateQuestion({ ...good, type: 'single', options: [o('a', true), o('b', false), o('c', false), o('d', false)] }), []);
});

test('questions.json, when built, is valid with unique ids', { skip: !existsSync(new URL('../questions.json', import.meta.url)) }, () => {
  const bank = JSON.parse(readFileSync(new URL('../questions.json', import.meta.url), 'utf8'));
  const ids = new Set();
  for (const q of bank.questions) {
    assert.deepEqual(validateQuestion(q), [], q.id);
    assert.ok(!ids.has(q.id), `duplicate ${q.id}`);
    ids.add(q.id);
  }
  assert.ok(Object.keys(bank.chapters).length > 0);
});
