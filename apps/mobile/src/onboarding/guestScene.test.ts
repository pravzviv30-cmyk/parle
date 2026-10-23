/** The guest café scene on the app side: the wire shapes, the copy and the recap. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEFAULT_TUTOR_VOICE, GUEST_SCENE_TURN_IDS, guestScenePhrases } from '@luvani/core';
import { claimRefusalCopy, guestLiveBody, guestSceneMode, sceneLines, startRefusalCopy, trustedSceneTurns } from './guestScene.ts';
import { firstLiveSummary, type FirstLiveRecord } from './firstLiveModel.ts';

const practice = readFileSync(new URL('./guestPractice.ts', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../live/useLiveSession.ts', import.meta.url), 'utf8');
const result = readFileSync(new URL('./FirstSessionResult.tsx', import.meta.url), 'utf8');

test('the start asks for the scene, and the room grant names its mode', () => {
  const start = practice.slice(practice.indexOf('export async function startGuestPractice'), practice.indexOf('export function offlineGuestPractice'));
  assert.match(start, /live: true,[\s\S]*scene: GUEST_SCENE,/);
  assert.match(start, /data\.scene === GUEST_SCENE \? \{ scene: GUEST_SCENE, sceneTurns: \[\] \} : \{\}/);
  assert.match(hook, /body: JSON\.stringify\(guestToken \? guestLiveBody\(mode\) : \{/);
  assert.deepEqual(guestLiveBody(guestSceneMode(false)), { mode: 'lesson' });
  assert.deepEqual(guestLiveBody(guestSceneMode(true)), { mode: 'lesson-text' }, 'typing opens the typed lesson');
  assert.deepEqual(guestLiveBody('convo'), {}, 'the older guest conversation body is unchanged');
  assert.deepEqual(guestLiveBody(undefined), {});
});

test('the server turn ids win when valid, and the phone copy is the fallback', () => {
  assert.deepEqual(trustedSceneTurns(['t2-order', 't1-greet'], []), ['t1-greet', 't2-order']);
  assert.deepEqual(trustedSceneTurns(['nope'], ['t1-greet']), ['t1-greet']);
  assert.deepEqual(trustedSceneTurns(undefined, ['t9-thanks']), ['t9-thanks']);
});

const id = '11111111-1111-4111-8111-111111111111';
const scene = (outcome: FirstLiveRecord['outcome'], sceneTurns = [...GUEST_SCENE_TURN_IDS]): FirstLiveRecord => ({
  brief: { version: 1, goals: [], level: 'zero', confidence: null, focus: null, minutes: null, tutorVoice: DEFAULT_TUTOR_VOICE },
  sessionId: id, outcome, contributions: [], seconds: 120, completedAt: outcome === 'completed' ? 1 : null, pack: null, scene: 'guest-cafe', sceneTurns,
});

test('the recap and the summary name the lines said, and only a finished scene celebrates', () => {
  const done = firstLiveSummary(scene('completed'));
  assert.equal(done.heading, 'Your first session completed.');
  assert.equal(done.achievements[0], 'You completed the café scene.');
  for (const line of guestScenePhrases(GUEST_SCENE_TURN_IDS)) assert.ok(done.achievements.includes(`You answered with “${line.fr}”.`), line.fr);
  for (const outcome of ['partial', 'interrupted'] as const) {
    const view = firstLiveSummary(scene(outcome, ['t1-greet']));
    assert.doesNotMatch(view.heading + view.achievements.join(' '), /completed/);
    assert.deepEqual(view.achievements, sceneLines(['t1-greet']));
  }
  assert.deepEqual(firstLiveSummary(scene('interrupted', [])).achievements, []);
  assert.match(result, /record\.scene \? 'The café scene, done\.' : 'A conversation completed\.'/);
  assert.match(result, /guestScenePhrases\(record\.sceneTurns \?\? \[\]\)\.map/);
});

test('no new line uses an em dash or scolds', () => {
  const lines = [startRefusalCopy('guest-scene-used'), startRefusalCopy('guest-live-unavailable'),
    claimRefusalCopy('guest-claimed-elsewhere'), claimRefusalCopy('guest-expired'), claimRefusalCopy('guest-active'),
    ...sceneLines([...GUEST_SCENE_TURN_IDS]), 'You completed the café scene.', 'The café scene, done.'];
  for (const line of lines) {
    assert.doesNotMatch(line, /[—–]/, line);
    assert.doesNotMatch(line, /\b(must|should|failed|wrong)\b/i, line);
  }
  assert.doesNotMatch(readFileSync(new URL('./guestScene.ts', import.meta.url), 'utf8'), /—/);
});
