import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { setActiveUser } from './scope.ts';
import { adopterFor, resetSyncRegistry } from '../sync/registry.ts';
import { loadHistory, recordSession } from '../progress/store.ts';
import { loadScenarioProgress, recordScenarioProgress } from '../missions/progressStore.ts';
import { loadMoments, saveMoment } from '../tutor/momentsStore.ts';
import { loadGoalSteps, recordGoalStepStarted } from '../goals/store.ts';
import { factKey } from '../profile/memory.ts';
import type { SessionSummary } from '@luvani/core';

const disk = new Map<string, string>();
let refuse = false;
let refuseWrite = false;
let uidNumber = 0;
let uid = '';
const key = (suffix: string): string => `luvani.u.${uid}.${suffix}`;

beforeEach(() => {
  disk.clear();
  refuse = false;
  refuseWrite = false;
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = async (name: string): Promise<string | null> => {
    if (refuse) throw new Error('native read refused');
    return disk.get(name) ?? null;
  };
  shared.setItem = async (name: string, value: string): Promise<void> => {
    if (refuseWrite) throw new Error('native write refused');
    disk.set(name, value);
  };
  shared.removeItem = async (name: string): Promise<void> => { disk.delete(name); };
  resetSyncRegistry();
  uid = `99999999-9999-4999-8999-${String(++uidNumber).padStart(12, '0')}`;
  setActiveUser(uid);
});

const step = { sessionId: '3f1c2a9e-6b1d-4a0e-9c55-1f2e3d4c5b6a', goalKey: factKey('Order a coffee in Paris'), task: 'mission:cafe', at: 5 };

test('absent continuity keys are empty, while malformed or refused existing reads reject', async () => {
  const cases = [
    { suffix: 'history', load: loadHistory, invalid: JSON.stringify({ endedAt: 1 }) },
    { suffix: 'scenarioProgress', load: loadScenarioProgress, invalid: JSON.stringify({ version: 1, records: [{ missionId: 'cafe', at: 'yesterday' }] }) },
    { suffix: 'moments', load: loadMoments, invalid: JSON.stringify({ version: 1, moments: [{ id: 'm1', kind: 'interview', detail: 'one' }] }) },
    { suffix: 'goalSteps', load: loadGoalSteps, invalid: JSON.stringify({ version: 1, steps: [{ kind: 'step-started', id: 'bad' }] }) },
  ];
  for (const { suffix, load, invalid } of cases) {
    assert.deepEqual(await load(), [], `${suffix}: an absent key is not empty`);
    disk.set(key(suffix), invalid);
    await assert.rejects(load(), { name: 'Error' }, `${suffix}: malformed existing rows looked empty`);
    disk.set(key(suffix), '{broken');
    await assert.rejects(load(), { name: suffix === 'goalSteps' ? 'Error' : 'SyntaxError' }, `${suffix}: malformed JSON looked empty`);
    disk.delete(key(suffix));
    refuse = true;
    await assert.rejects(load(), { name: 'Error' }, `${suffix}: refused read looked empty`);
    refuse = false;
  }
});

test('unread continuity bytes are not replaced by local writes or a sync fold', async () => {
  const cases = [
    { suffix: 'history', write: () => recordSession({} as SessionSummary, 5), adoption: 'history' },
    { suffix: 'scenarioProgress', write: () => recordScenarioProgress({ missionId: 'cafe', at: 5, elapsedMs: 10, beatsDone: 1 }), adoption: 'scenarioProgress' },
    { suffix: 'moments', write: () => saveMoment('interview', 'one line', 5), adoption: null },
    { suffix: 'goalSteps', write: () => recordGoalStepStarted(step), adoption: 'goalSteps' },
  ];
  for (const { suffix, write, adoption } of cases) {
    const raw = '{broken';
    disk.set(key(suffix), raw);
    try { await write(); } catch { /* Rejection is a valid refusal. */ }
    assert.equal(disk.get(key(suffix)), raw, `${suffix}: local write replaced unread data`);
    if (adoption !== null) {
      const adopt = adopterFor(adoption);
      assert.ok(adopt, `${adoption}: no adopter registered`);
      assert.equal(await adopt(() => suffix === 'history' ? [] : suffix === 'goalSteps'
        ? { version: 1, steps: [] } : { version: 1, records: [] }), 'declined');
      assert.equal(disk.get(key(suffix)), raw, `${suffix}: sync adoption replaced unread data`);
    }
  }
});

test('a refused native read blocks sync adoption even when the remote fold is valid', async () => {
  for (const namespace of ['history', 'scenarioProgress', 'goalSteps']) {
    const adopt = adopterFor(namespace);
    assert.ok(adopt);
    refuse = true;
    let called = false;
    assert.equal(await adopt(() => { called = true; return []; }), 'declined');
    assert.equal(called, false, `${namespace}: folded without knowing local data`);
    assert.equal(disk.has(key(namespace)), false);
    refuse = false;
  }
});

test('a refused history write does not return a report from an unsaved session', async () => {
  refuseWrite = true;
  await assert.rejects(recordSession({} as SessionSummary, 5), /could not be saved/);
  assert.equal(disk.has(key('history')), false);
});
