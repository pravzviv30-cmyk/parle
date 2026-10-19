import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { comparePreferenceClocks, preferenceClocks } from '@luvani/brain/profile/merge';
import { needsAccountName, saveAccountName } from './accountName.ts';

test('only the verified new account with no existing name enters the name question', () => {
  for (const name of [null, undefined, '', '   ']) {
    assert.equal(needsAccountName(true, name), true);
    assert.equal(needsAccountName(false, name), false, 'returning accounts are never reprompted');
    assert.equal(needsAccountName(false, name, true), true, 'a durable new-profile ask must survive loss of the auth provider memory flag');
  }
  for (const name of ['Ada', ' Praveen ', 'Anne-Marie']) {
    assert.equal(needsAccountName(true, name), false, 'a name already supplied in the draft must be reused');
    assert.equal(needsAccountName(false, name), false);
    assert.equal(needsAccountName(false, name, true), false, 'a previously supplied name must win even over a stale pending marker');
  }
  const handoff = readFileSync(new URL('./GuestAccountHandoff.tsx', import.meta.url), 'utf8');
  const gate = handoff.indexOf('if (guest === null && nameMissing)');
  assert.ok(gate > handoff.indexOf('if (guest === undefined)'));
  assert.ok(gate < handoff.indexOf('if (guest === null && !welcoming)'));
  assert.ok(gate < handoff.indexOf('if (welcoming)'));
  assert.match(handoff, /needsAccountName\(newlyCreated, profile\.name, profile\.namePromptPending\)/);
  assert.match(handoff, /onSave=\{name => updateMemory\(current => withName\(current, name\)\)\}/);
});

test('a name is normalized by the existing owner and acknowledged only after durable completion', async () => {
  let resolve!: (saved: boolean) => void;
  let settled = false;
  const writes: string[] = [];
  const pending = saveAccountName('  Amé\u0000lie  ', name => {
    writes.push(name);
    return new Promise<boolean>(done => { resolve = done; });
  }, () => true).then(result => { settled = true; return result; });
  assert.deepEqual(writes, ['Amélie']);
  await Promise.resolve();
  assert.equal(settled, false, 'a pending write cannot advance the journey');
  resolve(true);
  assert.equal(await pending, 'saved');
});

test('invalid, failed, thrown, and stale name writes do not advance', async () => {
  for (const name of ['', ' \u200b ', 'x'.repeat(41)]) {
    assert.equal(await saveAccountName(name, async () => { assert.fail('invalid names must not be written'); }, () => true), 'invalid');
  }
  assert.equal(await saveAccountName('Ada', async () => false, () => true), 'failed');
  assert.equal(await saveAccountName('Ada', async () => { throw new Error('disk unavailable'); }, () => true), 'failed');
  assert.equal(await saveAccountName('Ada', async () => { assert.fail('a stale account must not be written'); }, () => false), 'stale');
  let current = true;
  assert.equal(await saveAccountName('Ada', async () => { current = false; return true; }, () => current), 'stale');
  current = true;
  assert.equal(await saveAccountName('Ada', async () => { current = false; throw new Error('account changed'); }, () => current), 'stale');
  const screen = readFileSync(new URL('./AccountName.tsx', import.meta.url), 'utf8');
  assert.match(screen, /if \(operation\.current\) return;/, 'rapid taps must share one operation');
  assert.match(screen, /owner === scopeGeneration\(\) && uid === activeUserId\(\)/);
  assert.match(screen, /if \(!current\(\)\) return;/);
  assert.match(screen, /error=\{issue \|\| null\}/, 'save failures must be announced by the existing Field');
  assert.doesNotMatch(screen, /setName\(''\)/, 'a failed write must retain the name for retry');
});

const profileSource = readFileSync(new URL('../app/ProfileContext.tsx', import.meta.url), 'utf8');
const begin = profileSource.indexOf('const updateMemory = useCallback(') + 'const updateMemory = useCallback('.length;
const callback = profileSource.slice(begin, profileSource.indexOf('\n  }, []);', begin) + 4);
assert.ok(callback.startsWith('async (edit:'), 'execute the production acknowledgement callback');

function clock(value: string | number, counter: number) { return { value, counter, mutationId: 'account-name-test-0001' }; }
function profile(name: string, count: number) {
  return { name, dailyGoalMin: 10, forgottenFacts: ['current forgotten'], learnerGoals: ['current goal'],
    preferenceClocks: { name: clock(name, count), dailyGoalMin: clock(10, 7) },
    brain: { memory: { facts: ['current memory'] }, cefr: { estimate: 'B1', evidence: ['newer earned evidence'] } },
  };
}
async function acknowledge(current: unknown, saved: unknown, stale = false) {
  let held = current;
  let generation = 1;
  const invoke = new Function('saveMemoryChange', 'activeUserId', 'scopeGeneration', 'setProfile', 'preferenceClocks', 'comparePreferenceClocks',
    stripTypeScriptTypes(`const invoke = ${callback};`) + '\nreturn invoke;')(
    async () => { if (stale) generation++; return saved; }, () => 'verified-learner', () => generation,
    (edit: (value: unknown) => unknown) => { held = edit(held); }, preferenceClocks, comparePreferenceClocks,
  ) as (edit: (value: unknown) => unknown) => Promise<boolean>;
  const result = await invoke(value => value);
  return { result, profile: held };
}

test('the durable name acknowledgement hydrates just the winning name while retaining current learning and other preference clocks', async () => {
  const current = { ...profile('Old name', 1), namePromptPending: true };
  const saved = { ...profile('Praveen', 2), namePromptPending: false, dailyGoalMin: 5, forgottenFacts: ['saved forgotten'], learnerGoals: ['saved goal'],
    preferenceClocks: { name: clock('Praveen', 2), dailyGoalMin: clock(5, 1) },
    brain: { memory: { facts: ['saved memory'] }, cefr: { estimate: 'A1', evidence: [] } },
  };
  const actual = await acknowledge(current, saved);
  assert.equal(actual.result, true);
  assert.deepEqual(actual.profile, { ...current, name: 'Praveen', namePromptPending: false,
    preferenceClocks: { ...current.preferenceClocks, name: saved.preferenceClocks.name },
    forgottenFacts: saved.forgottenFacts, learnerGoals: saved.learnerGoals,
    brain: { ...current.brain, memory: saved.brain.memory },
  });
});

test('a stale or unbound saved name cannot replace a newer current name or cross an account boundary', async () => {
  const current = { ...profile('Later name', 9), namePromptPending: true };
  for (const saved of [profile('Earlier name', 2), { ...profile('Unbound name', 10), preferenceClocks: {} },
    { ...profile('Different value', 10), preferenceClocks: { name: clock('Another name', 10) } }]) {
    const actual = (await acknowledge(current, saved)).profile as typeof current;
    assert.equal(actual.name, current.name);
    assert.deepEqual(actual.preferenceClocks, current.preferenceClocks);
    assert.equal((actual as typeof current).namePromptPending, true, 'only a winning name clock may acknowledge pending completion');
  }
  assert.deepEqual(await acknowledge(current, profile('Saved name', 10), true), { result: false, profile: current });
  assert.deepEqual(await acknowledge(current, null), { result: false, profile: current });
  for (const loading of [null, 'loading']) assert.deepEqual(await acknowledge(loading, profile('Saved name', 10)), { result: true, profile: loading });
});
