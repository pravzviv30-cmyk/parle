import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, applyExtractionToProfile, repairProfile, currentPolicyOpener, PERSONAL_MEMORY_POLICY_VERSION, withoutForgottenMemory } from './profile.ts';
import { mergeLearnerProfiles } from './merge.ts';

const line = { fr: 'Et Lyon ?', en: 'How was Lyon?' };
const current = () => applyExtractionToProfile(createProfile(), { facts: [], openerFr: line.fr, openerEn: line.en }, '2026-10-02');

test('repair preserves opener policy provenance without promoting legacy or malformed markers', () => {
  for (const marker of [undefined, null, true, '1', 0, 2, [1], { version: 1 }]) {
    const input = createProfile();
    input.memory.opener = { ...line, policyVersion: marker } as never;
    const repaired = repairProfile(JSON.parse(JSON.stringify(input)));
    assert.deepEqual(repaired.memory.opener, line, String(marker));
    assert.equal(currentPolicyOpener(repaired), null);
  }
  const repaired = repairProfile(JSON.parse(JSON.stringify(current())));
  assert.deepEqual(repaired.memory.opener, { ...line, policyVersion: PERSONAL_MEMORY_POLICY_VERSION });
  assert.deepEqual(currentPolicyOpener(repaired), line, 'internal metadata must not ride in the published bilingual line');
});

test('an old worker overwriting the whole opener loses its marker; pause and forget suppress current greetings', () => {
  const stored = current();
  stored.memory.opener = { ...line };
  assert.equal(currentPolicyOpener(repairProfile(stored)), null);
  const paused = current();
  paused.memory.control = { paused: true, changedAt: 1000 };
  assert.equal(currentPolicyOpener(paused), null);
  assert.equal(currentPolicyOpener(withoutForgottenMemory(current(), ['Any remembered detail'])), null);
});

test('sync in either direction keeps the chosen opener marker rather than upgrading older text', () => {
  const marked = current();
  const legacy = createProfile();
  legacy.memory.opener = { fr: 'Ancien détail personnel', en: 'Older personal detail' };
  legacy.stats.sessions = 2;
  for (const [a, b] of [[marked, legacy], [legacy, marked]]) {
    const merged = mergeLearnerProfiles(a, b, 10, 10);
    assert.deepEqual(merged.memory.opener, legacy.memory.opener);
    assert.equal(currentPolicyOpener(merged), null);
  }
  marked.stats.sessions = 3;
  for (const [a, b] of [[marked, legacy], [legacy, marked]]) {
    const merged = mergeLearnerProfiles(a, b, 10, 10);
    assert.deepEqual(merged.memory.opener, marked.memory.opener);
    assert.deepEqual(currentPolicyOpener(merged), line);
  }
});
