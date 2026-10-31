import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConversation, integrateTurn, missionTasksFor, type ConversationState } from './conversation.ts';
import { missionFrame } from '../missions/frames.ts';
import { sampleTurn } from '../contract/samples.ts';

const frame = missionFrame('mission:premier-cafe')!;
const learner = { cefr: 'A1', confidence: 'low', watchFor: [], lastRung: null, sessions: 0, name: null } as const;
function fresh(): ConversationState {
  return createConversation(frame, { ...learner, watchFor: [] }, { strictness: 'balanced', maxTurns: 24, mission: true, missionId: 'mission:premier-cafe' });
}
function success(state = fresh()) {
  return sampleTurn({ scene: { beat: state.currentBeat, beatDone: true, goalMet: true } });
}
const spoke = { type: 'spoke', text: 'Bonjour, un café, s’il vous plaît.' } as const;

test('authored task observations start unticked and credit the pre-turn goal rather than the next position', () => {
  const state = fresh();
  assert.deepEqual(missionTasksFor(state)!.items.map(item => item.achieved), [false, false, false]);
  const next = integrateTurn(state, spoke, success());
  assert.notEqual(next.state.currentBeat, state.currentBeat);
  assert.deepEqual(next.view.missionTasks!.items.map(item => item.achieved), [true, false, false]);
  assert.deepEqual(state.evidencedBeatIds, []);
  assert.deepEqual(fresh().evidencedBeatIds, [], 'a replay inherits no session ticks');
});

test('uncertain false English rescued empty and steered turns cannot credit a task', () => {
  for (const goalMet of [false, null, undefined]) {
    const turn = success();
    if (goalMet === undefined) delete (turn.scene as { goalMet?: boolean | null }).goalMet;
    else turn.scene.goalMet = goalMet;
    assert.deepEqual(integrateTurn(fresh(), spoke, turn).state.evidencedBeatIds, []);
  }
  const state = fresh();
  for (const turn of [
    { ...success(), topicShift: { en: 'Weekend', fr: 'Le week-end' } },
    { ...success(), assessment: { ...success().assessment, language: 'english' as const } },
    { ...success(), assessment: { ...success().assessment, understood: false } },
    { ...success(), assessment: { ...success().assessment, taskAchieved: false } },
  ]) assert.deepEqual(integrateTurn(state, spoke, turn).state.evidencedBeatIds, []);
  assert.deepEqual(integrateTurn(state, { type: 'help' }, success()).state.evidencedBeatIds, []);
  assert.deepEqual(integrateTurn(state, { type: 'silence', durationMs: 5000 }, success()).state.evidencedBeatIds, []);
  assert.deepEqual(integrateTurn(state, { type: 'spoke', text: ' ' }, success()).state.evidencedBeatIds, []);
  assert.deepEqual(integrateTurn({ ...state, directive: { ...state.directive, rescued: true }, frenchGiven: true }, spoke, success()).state.evidencedBeatIds, []);
});

test('forced movement can finish the scene spine without inventing achieved tasks', () => {
  let state = fresh();
  for (let i = 0; i < frame.beats.length; i++) {
    state = { ...state, forceAdvance: true };
    state = integrateTurn(state, spoke, success(state)).state;
  }
  assert.equal(state.missionDone, true, 'existing scene movement is preserved');
  assert.deepEqual(missionTasksFor(state)!.items.map(item => item.achieved), [false, false, false]);
});

test('successful authored goals produce a full list and generated scenes have none', () => {
  let state = fresh();
  for (const text of ['Bonjour, un café, s’il vous plaît.', 'Sur place, merci.', 'Par carte, s’il vous plaît.']) {
    state = integrateTurn(state, { type: 'spoke', text }, success(state)).state;
  }
  assert.equal(state.missionDone, true);
  assert.ok(missionTasksFor(state)!.items.every(item => item.achieved));
  const generated = createConversation(frame, { ...learner, watchFor: [] }, { strictness: 'balanced', maxTurns: 24 });
  assert.equal(missionTasksFor(generated), null);
  assert.equal(Object.hasOwn(integrateTurn(generated, spoke, success(generated)).view, 'missionTasks'), false);
});

// F928. A typed scene's silence clock (TEXT_SILENCE_MS) reveals the support the
// turn already carried and asks no model, so on a fresh exchange it shows only
// the English intent hint. No French was modelled.
test('a typed turn that meets an objective ticks it', async () => {
  const { applyNonSpokenInput } = await import('./conversation.ts');
  const control = integrateTurn(fresh(), spoke, success());
  assert.deepEqual(control.state.evidencedBeatIds, ['greet-and-order'], 'control: no rescue before the answer');
  const { state: hinted, view } = applyNonSpokenInput(fresh(), { type: 'silence', durationMs: 12_000 });
  assert.equal(view.supportView.kind, 'hint', 'the reveal-only rescue showed the English hint, not French');
  const after = integrateTurn(hinted, spoke, success(hinted));
  assert.deepEqual(after.state.evidencedBeatIds, [hinted.currentBeat]);
  assert.deepEqual(after.view.missionTasks!.items.map(item => item.achieved), [true, false, false]);
});

test('a typed answer copying the just-revealed line does not tick it', async () => {
  const { applyNonSpokenInput } = await import('./conversation.ts');
  const { state: hinted } = applyNonSpokenInput(fresh(), { type: 'help' });
  const { state: shown, view } = applyNonSpokenInput(hinted, { type: 'silence', durationMs: 12_000 });
  assert.equal(view.supportView.kind, 'full-line');
  if (view.supportView.kind !== 'full-line') return;
  const copied = integrateTurn(shown, { type: 'spoke', text: view.supportView.written ?? view.supportView.line }, success(shown));
  assert.deepEqual(copied.state.evidencedBeatIds, [], 'the French was on screen');
  // A tutor turn answering the rescue models the line too, even after a hint only.
  const modelled = integrateTurn(hinted, { type: 'help' }, success(hinted)).state;
  assert.deepEqual(integrateTurn(modelled, spoke, success(modelled)).state.evidencedBeatIds, []);
  // A checkpoint from before the flag existed keeps the stricter rule.
  const legacy = { ...hinted } as ConversationState;
  delete (legacy as { frenchGiven?: boolean }).frenchGiven;
  assert.deepEqual(integrateTurn(legacy, spoke, success(legacy)).state.evidencedBeatIds, []);
});

// F949. Live, the model names in scene.beat where the scene goes AFTER this
// turn. goalMet observes the beat that was current before it, so the tick is
// about that source beat whatever scene.beat and beatDone say.
test('a goal ticks when the learner meets it even as the model moves the scene on', () => {
  const nextBeat = frame.beats[1]!.id;
  for (const beatDone of [true, false]) {
    const state = fresh();
    const turn = sampleTurn({ scene: { beat: nextBeat, beatDone, goalMet: true } });
    const next = integrateTurn(state, spoke, turn).state;
    assert.deepEqual(next.evidencedBeatIds, [state.currentBeat], `beatDone ${beatDone}`);
  }
  const moved = (_state: ConversationState) => sampleTurn({ scene: { beat: nextBeat, beatDone: false, goalMet: true } });
  // Guards that stay: goalMet not true, rescue, forceAdvance, topic shift, English, non-mission.
  for (const goalMet of [false, null]) {
    assert.deepEqual(integrateTurn(fresh(), spoke, sampleTurn({ scene: { beat: nextBeat, beatDone: true, goalMet } })).state.evidencedBeatIds, []);
  }
  const state = fresh();
  assert.deepEqual(integrateTurn({ ...state, directive: { ...state.directive, rescued: true }, frenchGiven: true }, spoke, moved(state)).state.evidencedBeatIds, []);
  assert.deepEqual(integrateTurn({ ...state, forceAdvance: true }, spoke, moved(state)).state.evidencedBeatIds, []);
  assert.deepEqual(integrateTurn(state, spoke, { ...moved(state), topicShift: { en: 'Weekend', fr: 'Le week-end' } }).state.evidencedBeatIds, []);
  assert.deepEqual(integrateTurn(state, spoke, { ...moved(state), assessment: { ...moved(state).assessment, language: 'english' as const } }).state.evidencedBeatIds, []);
  const generated = createConversation(frame, { ...learner, watchFor: [] }, { strictness: 'balanced', maxTurns: 24 });
  assert.deepEqual(integrateTurn(generated, spoke, moved(generated)).state.evidencedBeatIds, []);
  // A beat already evidenced is not added twice.
  const once = integrateTurn(state, spoke, moved(state)).state;
  const twice = integrateTurn(once, spoke, moved(once)).state;
  assert.equal(twice.evidencedBeatIds.filter(id => id === state.currentBeat).length, 1);
});
