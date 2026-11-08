import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAFE_LESSON } from '../packages/core/src/lessons/cafe.ts';
import {
  CREDIT_CAP, DG_OPTIONS, ENGLISH_ANSWERS, SCENE_REPLIES, buildExtraPlan, buildPlan, conditionOptions, conditionsFor, estimateTotal, exactMatch,
  keytermQuery, parseConditions, summarise, summariseByKind,
} from './measureKeyterms.mjs';

test('keyterms plan covers every café target once and stays under the credit cap', () => {
  const plan = buildPlan();
  assert.equal(plan.length, CAFE_LESSON.turns.length);
  assert.deepEqual(plan.map(p => p.text), CAFE_LESSON.turns.map(t => t.target));
  assert.ok(estimateTotal(plan) <= CREDIT_CAP);
  assert.equal(new Set(plan.map(p => p.file)).size, plan.length);
});

test('exact match ignores accents, case and punctuation; keyterms are repeated encoded params', () => {
  assert.equal(exactMatch("Un café, s'il vous plaît", 'un cafe s’il vous plait.'), true);
  assert.equal(exactMatch('Un café', 'un thé'), false);
  assert.equal(keytermQuery(['café', "s'il vous plaît"]), "&keyterm=caf%C3%A9&keyterm=s'il%20vous%20pla%C3%AEt");
});

test('summary compares keyterms with plain per group and level', () => {
  const row = (condition, wordAccuracy, exact) => ({ group: 'g', level: 'normal', condition, wordAccuracy, exact });
  const [s] = summarise([row('plain', 0.5, false), row('plain', 1, true), row('keyterms', 1, true), row('keyterms', 1, true)]);
  assert.equal(s.plain.exactMatches, 1);
  assert.equal(s.keyterms.exactMatches, 2);
  assert.equal(s.medianAccuracyGain, 0.25);
  assert.equal(s.exactGain, 1);
});

test('--conditions defaults to plain,keyterms and accepts fr,multi; rejects unknown or mixed', () => {
  assert.deepEqual(parseConditions([]), ['plain', 'keyterms']);
  assert.deepEqual(parseConditions(['--run', '--conditions', 'fr,multi']), ['fr', 'multi']);
  assert.deepEqual(parseConditions(['--conditions=multi']), ['multi']);
  assert.throws(() => parseConditions(['--conditions', 'fr,klingon']), /klingon/);
  assert.throws(() => parseConditions(['--conditions', 'plain,multi']), /mix/);
  assert.throws(() => parseConditions(['--conditions']), /needs/);
});

test('condition options: multi is code-switching with endpointing 100; keyterms only on lesson lines', () => {
  const kt = ['café'];
  assert.deepEqual(conditionOptions('plain', 'lesson line', kt), DG_OPTIONS);
  assert.deepEqual(conditionOptions('keyterms', 'lesson line', kt), { ...DG_OPTIONS, keyterm: kt });
  assert.deepEqual(conditionOptions('fr', 'lesson line', kt), { ...DG_OPTIONS, keyterm: kt });
  assert.deepEqual(conditionOptions('multi', 'lesson line', kt), { ...DG_OPTIONS, language: 'multi', endpointing: 100, keyterm: kt });
  assert.deepEqual(conditionOptions('multi-plain', 'lesson line', kt), { ...DG_OPTIONS, language: 'multi', endpointing: 100 });
  assert.deepEqual(conditionOptions('fr', 'scene reply', kt), DG_OPTIONS);
  assert.deepEqual(conditionOptions('multi', 'English answer', kt), { ...DG_OPTIONS, language: 'multi', endpointing: 100 });
  assert.deepEqual(conditionsFor('lesson line', ['fr', 'multi']), ['fr', 'multi', 'multi-plain']);
  assert.deepEqual(conditionsFor('scene reply', ['fr', 'multi']), ['fr', 'multi']);
  assert.deepEqual(conditionsFor('lesson line', ['plain', 'keyterms']), ['plain', 'keyterms']);
});

test('extra clip sets: 8 scene replies and 8 English answers, unique files, under the credit cap', () => {
  const plan = buildExtraPlan();
  assert.equal(plan.filter(p => p.kind === 'scene reply').length, SCENE_REPLIES.length);
  assert.equal(plan.filter(p => p.kind === 'English answer').length, ENGLISH_ANSWERS.length);
  assert.equal(SCENE_REPLIES.length, 8);
  assert.equal(ENGLISH_ANSWERS.length, 8);
  assert.equal(new Set(plan.map(p => p.file)).size, plan.length);
  assert.ok(estimateTotal(plan) <= CREDIT_CAP);
});

test('per-kind summary: mean accuracy and exact matches per kind and condition', () => {
  const row = (kind, condition, wordAccuracy, exact) => ({ kind, condition, wordAccuracy, exact });
  const s = summariseByKind([
    row('scene reply', 'fr', 0.5, false), row('scene reply', 'fr', 1, true), row('scene reply', 'multi', 1, true),
    row('English answer', 'multi', 0.25, false),
  ]);
  assert.deepEqual(s, [
    { kind: 'scene reply', condition: 'fr', clips: 2, meanWordAccuracy: 0.75, exactMatches: 1 },
    { kind: 'scene reply', condition: 'multi', clips: 1, meanWordAccuracy: 1, exactMatches: 1 },
    { kind: 'English answer', condition: 'multi', clips: 1, meanWordAccuracy: 0.25, exactMatches: 0 },
  ]);
});

test('flux runs flux-general-multi with fr/en hints, and multi-ep25 keeps the default endpointing', () => {
  const kt = ['café'];
  assert.deepEqual(parseConditions(['--conditions', 'fr,multi,multi-ep25,flux']), ['fr', 'multi', 'multi-ep25', 'flux']);
  assert.deepEqual(conditionOptions('flux', 'lesson line', kt), { model: 'flux-general-multi', languageHint: ['fr', 'en'], sampleRate: 16000, mipOptOut: true, numerals: false, eotTimeoutMs: 3000, keyterms: kt });
  assert.deepEqual(conditionOptions('flux', 'scene reply', kt), { model: 'flux-general-multi', languageHint: ['fr', 'en'], sampleRate: 16000, mipOptOut: true, numerals: false, eotTimeoutMs: 3000 });
  assert.deepEqual(conditionOptions('multi-ep25', 'scene reply', kt), { ...DG_OPTIONS, language: 'multi' });
});
