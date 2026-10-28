/**
 * LEARN-014: the session snapshot is fitted under a byte budget, and the
 * recap's brain replaces the phone's. ProfileContext's `updateBrain` is a React
 * state updater with no seam of its own, so this tests the exact composition it
 * runs, `keepUnsent(current.brain, brainAfterRecap(blob, current))`, and pins
 * that the context runs that composition.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createProfile, MAX_PHRASES, type LearnerProfile } from '@luvani/brain/profile';
import { fitSnapshot, keepUnsent } from '@luvani/brain/profile/snapshotBudget';
import { createStoredProfile } from './store.ts';
import { brainAfterRecap, snapshotFor, withFactForgotten, withMemoryPaused } from './memory.ts';

const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString();

function heavyLearner() {
  const profile = createStoredProfile({ name: 'James', motivation: 'travel' }, 1000);
  for (let i = 0; i < MAX_PHRASES; i++) {
    profile.brain.phrases[`phrase ${i}`] = { fr: `Est-ce que vous pourriez répéter plus lentement ? ${i} ${'é'.repeat(150)}`, frWritten: null, en: 'Could you repeat more slowly?'.padEnd(180, '.'), register: 'courant', introducedAt: day(i), timesUsedWell: 1, timesAssisted: 0, mastered: i % 2 === 0 };
  }
  profile.brain.memory.facts = [
    { kind: 'interest', en: 'Likes jazz', fr: null, notedAt: day(1), happensAround: null },
    { kind: 'life-event', en: 'Has an interview', fr: null, notedAt: day(2), happensAround: null },
  ];
  return profile;
}

test('a fitted session loses no phrase on write-back, keeps what it learned, and keeps memory decisions', () => {
  const learner = withFactForgotten(heavyLearner(), 'Has an interview');
  const sent = fitSnapshot(snapshotFor(learner));
  assert.ok(Object.keys(sent.phrases).length < MAX_PHRASES, 'the fixture is over budget');

  // The agent's recap: what it was sent, one phrase used, one new one, and
  // the forgotten fact written back by an extraction.
  const blob: LearnerProfile = structuredClone(sent);
  const used = Object.keys(blob.phrases).at(-1)!;
  blob.phrases[used]!.timesUsedWell = 7;
  blob.phrases.nouvelle = { fr: 'Nouvelle', frWritten: null, en: 'New', register: 'courant', introducedAt: day(400), timesUsedWell: 0, timesAssisted: 0, mastered: false };
  blob.memory.facts = [...blob.memory.facts, { kind: 'life-event', en: 'Has an interview', fr: null, notedAt: day(3), happensAround: null }];

  const brain = keepUnsent(learner.brain, brainAfterRecap(blob, learner));
  assert.equal(Object.keys(brain.phrases).length, MAX_PHRASES, 'the cap holds');
  assert.ok(brain.phrases.nouvelle, 'the new phrase is kept');
  assert.equal(brain.phrases[used]!.timesUsedWell, 7, 'the recap wins for a phrase it saw');
  const lost = Object.keys(learner.brain.phrases).filter(k => !brain.phrases[k]);
  assert.equal(lost.length, 1, 'only the usual cap eviction, for the one new phrase');
  assert.equal(learner.brain.phrases[lost[0]!]!.mastered, false);
  for (const [k, e] of Object.entries(brain.phrases)) if (learner.brain.phrases[k]) assert.equal(e.fr, learner.brain.phrases[k]!.fr, 'full text comes back');
  assert.ok(!brain.memory.facts.some(f => f.en === 'Has an interview'), 'the tombstone still holds');

  const paused = withMemoryPaused(heavyLearner(), true, 2000);
  const afterPause = keepUnsent(paused.brain, brainAfterRecap({ ...structuredClone(fitSnapshot(snapshotFor(paused))), memory: { ...createProfile().memory } }, paused));
  assert.deepEqual(afterPause.memory, paused.brain.memory, 'a paused memory is not replaced');
  assert.equal(Object.keys(afterPause.phrases).length, MAX_PHRASES);
});

test('updateBrain and the session start run the fit and the write-back', () => {
  const context = readFileSync(fileURLToPath(new URL('../app/ProfileContext.tsx', import.meta.url)), 'utf8');
  assert.match(context, /brain: keepUnsent\(current\.brain, brainAfterRecap\(blob, current\)\)/);
  const live = readFileSync(fileURLToPath(new URL('../live/useLiveSession.ts', import.meta.url)), 'utf8');
  assert.match(live, /\.\.\.\(snapshot !== undefined \? \{ snapshot: fitSnapshot\(snapshot\) \} : \{\}\)/);
});
