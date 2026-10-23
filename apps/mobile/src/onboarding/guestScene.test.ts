/** The guest café scene on the app side: the wire shapes, the copy and the recap. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEFAULT_TUTOR_VOICE, GUEST_SCENE_TURN_IDS, guestScenePhrases } from '@luvani/core';
import { claimRefusalCopy, guestLiveBody, guestSceneMode, sceneLines, startRefusalCopy, trustedSceneTurns } from './guestScene.ts';
import { firstLiveSummary, repairFirstLiveRecord, sceneResultRecord, type FirstLiveRecord } from './firstLiveModel.ts';
import { pushTurn, type TurnLine } from '../live/turns.ts';
import { scriptedPromptIdentity } from '../live/c2TranscriptPolicy.ts';

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
  const lines = [startRefusalCopy('guest-scene-used'), startRefusalCopy('guest-live-unavailable'), startRefusalCopy('guest-start-limited'),
    claimRefusalCopy('guest-claimed-elsewhere'), claimRefusalCopy('guest-expired'), claimRefusalCopy('guest-active'),
    ...sceneLines([...GUEST_SCENE_TURN_IDS]), 'You completed the café scene.', 'The café scene, done.'];
  for (const line of lines) {
    assert.doesNotMatch(line, /[—–]/, line);
    assert.doesNotMatch(line, /\b(must|should|failed|wrong)\b/i, line);
  }
  assert.doesNotMatch(readFileSync(new URL('./guestScene.ts', import.meta.url), 'utf8'), /—/);
});

test('the web run result reaches the summary or the recap, never the error', () => {
  const active: FirstLiveRecord = { ...scene('active', []), completedAt: null, seconds: 0 };
  // Exactly what /onboarding/live-result answered on the web run.
  const answered = { outcome: 'completed', seconds: 58, learnerTurns: 4, pack: null, scene: 'guest-cafe', sceneTurns: [] };
  const empty = repairFirstLiveRecord(sceneResultRecord(active, answered, 1_000));
  assert.ok(empty, 'a completed scene result was read as not available');
  assert.equal(empty.outcome, 'partial', 'no confirmed line: the truthful summary, not a celebration');
  assert.equal(empty.sessionId, id);
  const named = repairFirstLiveRecord(sceneResultRecord(active, { ...answered, sceneTurns: ['t1-greet', 't2-order'] }, 1_000));
  assert.ok(named);
  assert.equal(named.outcome, 'completed', 'a finished scene with lines goes to the recap');
  assert.equal(named.completedAt, 1_000);
  assert.deepEqual(named.sceneTurns, ['t1-greet', 't2-order']);
  // A server time, when one is sent, is kept.
  assert.equal(repairFirstLiveRecord(sceneResultRecord(active, { ...answered, sceneTurns: ['t1-greet'], completedAt: 5 }, 1_000))?.completedAt, 5);
  const practice = readFileSync(new URL('./FirstLivePractice.tsx', import.meta.url), 'utf8');
  assert.match(practice, /repairFirstLiveRecord\(sceneResultRecord\(held\.current\.live, result\)\)/);
  assert.match(practice, /scene && \(over \|\| live\.status\.phase === 'ended'\) \? 'Your café scene is over'/, 'a finished scene still says it is connecting');
  assert.ok(practice.indexOf("'Your café scene is over'") < practice.indexOf('`Connecting to ${name}…`'));
});

test('the scene position line uses the on-brand soft text, not muted ink', () => {
  const practice = readFileSync(new URL('./FirstLivePractice.tsx', import.meta.url), 'utf8');
  assert.match(practice, /color: onColour\.blue, textAlign: 'center' \}\]\}>\{rungLabel\(/);
  assert.doesNotMatch(practice, /color: c\.muted, textAlign: 'center' \}\]\}>\{rungLabel\(/);
});

test('the transcript keeps the order the frames arrive in: each typed reply right after the line it answers', () => {
  // What the hook does for a typed scene turn, frame by frame, with the real helpers:
  // the prompt line, the optimistic typed line, the worker echo, then the next prompt.
  const promptOf = (n: number, turnId: string, tutor: string, rung = 3) => ({ position: n, total: 5, turn: { id: turnId, tutor, tutorEn: '' }, directive: { rung, rescued: false } });
  let turns: TurnLine[] = [];
  let seq = 0;
  const add = (line: Omit<TurnLine, 'id'>, id?: string) => { turns = pushTurn(turns, line, id ?? `t${++seq}`); };
  const tutor = (p: ReturnType<typeof promptOf>) => add({ who: 'tutor', fr: p.turn.tutor, frWritten: null, en: '' }, scriptedPromptIdentity(p as never));
  const typed = (text: string) => { add({ who: 'learner', fr: text, frWritten: null, en: null }); add({ who: 'learner', fr: text, frWritten: null, en: null }, `legacy-${seq + 1}`); };
  tutor(promptOf(1, 't1-greet', 'Bonjour !'));
  typed('Bonjour');
  tutor(promptOf(2, 't2-order', "Qu'est-ce que je vous sers ?"));
  // A rescue republishing the same line at another rung adds nothing.
  tutor(promptOf(2, 't2-order', "Qu'est-ce que je vous sers ?", 2));
  typed("Un café, s'il vous plaît");
  tutor(promptOf(3, 't3-sur-place', 'Très bien. Sur place ou à emporter ?'));
  assert.deepEqual(turns.map((t) => `${t.who}:${t.fr}`), [
    'tutor:Bonjour !', 'learner:Bonjour', "tutor:Qu'est-ce que je vous sers ?", "learner:Un café, s'il vous plaît", 'tutor:Très bien. Sur place ou à emporter ?',
  ]);
});
