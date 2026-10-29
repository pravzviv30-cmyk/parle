import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TUTOR_VOICE } from '@luvani/core';
import { createProfile } from './profile.ts';
import { mergeStoredProfiles, type MergedStoredProfile } from './merge.ts';
import { PREFERENCE_FIELDS, preferenceClocks, preferenceValue, newPreferenceClock, maxPreferenceCounter, sanitisePreferenceClocks, MAX_PREFERENCE_COUNTER, type PreferenceField } from './preferenceClock.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function profile(sessions = 0): MergedStoredProfile {
  const brain = createProfile();
  brain.stats.sessions = sessions;
  brain.stats.totalTurns = sessions * 3;
  return { version: 8, name: 'Original', username: null, dob: null, ageConfirmed: true, ageStopAt: null, motivation: null, dailyGoalMin: 10, tutorVoice: DEFAULT_TUTOR_VOICE, preferTyping: true, practicePreferences: { level: 'zero', confidence: 'hesitant', focus: null }, forgottenFacts: [], learnerGoals: [], onboardedAt: 100, brain };
}
function edit(p: MergedStoredProfile, field: PreferenceField, value: unknown, counter: number, mutation = id(counter)): MergedStoredProfile {
  const next = structuredClone(p);
  if (field === 'strictness') next.brain.preferences.strictness = value as 'strict';
  else if (field === 'pace') next.brain.preferences.pace = value as 'slow';
  else if (field === 'statedLevel') next.practicePreferences = { ...(next.practicePreferences as object), level: value };
  else next[field] = value;
  next.preferenceClocks = { ...preferenceClocks(next), [field]: newPreferenceClock(next, field, mutation, counter - 1) };
  return next;
}
function merge(a: unknown, b: unknown): MergedStoredProfile {
  const result = mergeStoredProfiles({ stored: a, savedAt: 0 }, { stored: b, savedAt: 0 }, { now: 100, upgrade: (p) => p && typeof p === 'object' && !Array.isArray(p) ? { ...p } : null });
  assert.ok(result);
  return result;
}

test('all nine newer settings beat a busier device, including explicit null/false/default choices', () => {
  const values = { name: 'New name', username: 'new.1234', dailyGoalMin: null, tutorVoice: 'marie', preferTyping: false, strictness: 'flow', pace: 'normal', statedLevel: 'getby', onboardingGoal: 'food' };
  let newer = profile();
  let older = profile(100);
  older.brain.preferences.pace = 'slow';
  older.brain.cefr.estimate = 'B2';
  for (const [index, field] of PREFERENCE_FIELDS.entries()) {
    older = edit(older, field, preferenceValue(older, field), 1, id(1));
    newer = edit(newer, field, values[field], index + 2);
  }
  const result = merge(older, newer);
  for (const field of PREFERENCE_FIELDS) assert.equal(preferenceValue(result, field), values[field], field);
  assert.equal(result.brain.stats.sessions, 100);
  assert.deepEqual(result.brain.cefr, older.brain.cefr);
  assert.deepEqual(result, merge(newer, older));
  assert.deepEqual(result, merge(result, older));
  assert.deepEqual(result, merge(result, newer));
});

test('value mismatch, impossible counters, oversized IDs and unauthorized fields cannot supply ordering', () => {
  const p = edit(profile(), 'name', 'Edited', 4);
  const clocks = p.preferenceClocks as Record<string, unknown>;
  clocks.dob = { counter: 999, mutationId: id(1), value: '2001-01-01' };
  clocks.ageConfirmed = { counter: 999, mutationId: id(1), value: true };
  clocks.unknown = { counter: 999, mutationId: id(1), value: 'injected' };
  assert.deepEqual(Object.keys(preferenceClocks(p)), ['name']);
  for (const counter of [-1, 0, 1.5, Infinity, NaN, MAX_PREFERENCE_COUNTER + 1]) {
    assert.deepEqual(preferenceClocks({ ...p, preferenceClocks: { name: { counter, mutationId: id(1), value: 'Edited' } } }), {});
  }
  assert.deepEqual(preferenceClocks({ ...p, name: 'Unacknowledged rewrite' }), {});
  assert.deepEqual(preferenceClocks({ ...p, preferenceClocks: { name: { counter: 4, mutationId: 'x'.repeat(81), value: 'Edited' } } }), {});
  assert.deepEqual(preferenceClocks({ ...p, name: 'x'.repeat(513), preferenceClocks: { name: { counter: 4, mutationId: id(1), value: 'x'.repeat(513) } } }), {});
  assert.throws(() => newPreferenceClock(p, 'name', id(1), MAX_PREFERENCE_COUNTER), /cannot be ordered/);
  assert.equal(maxPreferenceCounter(p), 4);
  assert.equal('preferenceClocks' in sanitisePreferenceClocks({ ...p, name: 'Unacknowledged rewrite' }), false);
});

test('concurrent same-counter edits use a stable mutation ID, not wall clocks or learning counts', () => {
  const a = edit(profile(90), 'name', 'Z older tie ID', 3, id(1));
  const b = edit(profile(1), 'name', 'A newer tie ID', 3, id(2));
  assert.equal(merge(a, b).name, 'A newer tie ID');
  assert.deepEqual(merge(a, b), merge(b, a));
  // Equal-ID corrupted content still has one total, deterministic winner.
  assert.deepEqual(merge(a, edit(profile(1), 'name', 'Different', 3, id(1))), merge(edit(profile(1), 'name', 'Different', 3, id(1)), a));
});

test('clock-aware and legacy inputs remain commutative, idempotent, absorbing and converge under gossip', () => {
  let seed = 4821;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
  const values: Record<PreferenceField, unknown[]> = { name: [null, 'A', 'Z'], username: [null, 'a.0001', 'z.0002'], dailyGoalMin: [null, 5, 15], tutorVoice: [null, DEFAULT_TUTOR_VOICE, 'marie'], preferTyping: [false, true], strictness: ['flow', 'balanced', 'strict'], pace: [undefined, 'normal', 'slow'], statedLevel: ['zero', 'few', 'getby', 'confident'], onboardingGoal: [null, 'moving', 'food'] };
  const make = () => {
    let p = profile(Math.floor(random() * 3));
    for (const field of PREFERENCE_FIELDS) {
      const list = values[field], value = list[Math.floor(random() * list.length)];
      if (field === 'strictness') p.brain.preferences.strictness = value as 'strict';
      else if (field === 'pace') { if (value !== undefined) p.brain.preferences.pace = value as 'slow'; }
      else if (field === 'statedLevel') p.practicePreferences = { ...(p.practicePreferences as object), level: value };
      else p[field] = value;
      if (random() > 0.45) p = edit(p, field, value, Math.floor(random() * 4) + 1, id(Math.floor(random() * 4) + 1));
    }
    return p;
  };
  for (let round = 0; round < 600; round++) {
    const a = make(), b = make(), result = merge(a, b);
    assert.deepEqual(result, merge(b, a), `commutative ${round}`);
    assert.deepEqual(result, merge(result, result), `idempotent ${round}`);
    assert.deepEqual(result, merge(result, a), `absorbs a ${round}`);
    assert.deepEqual(result, merge(result, b), `absorbs b ${round}`);
    const devices = [a, b, make()];
    let server = devices[0]!;
    for (let step = 0; step < 30; step++) {
      const i = Math.floor(random() * 3);
      server = devices[i] = merge(server, devices[i]);
    }
    for (let pass = 0; pass < 3; pass++) for (let i = 0; i < 3; i++) server = devices[i] = merge(server, devices[i]);
    for (const device of devices) assert.deepEqual(device, server, `gossip ${round}`);
  }
});

test('a newer stated level beats an older remote level in both directions, keeping confidence and focus', () => {
  const busy = edit(profile(100), 'statedLevel', 'few', 1, id(1));
  const fresh = edit(profile(), 'statedLevel', 'confident', 2);
  for (const result of [merge(busy, fresh), merge(fresh, busy)]) {
    assert.deepEqual(result.practicePreferences, { level: 'confident', confidence: 'hesitant', focus: null });
    assert.equal(result.brain.stats.sessions, 100);
  }
  assert.deepEqual(merge(busy, fresh), merge(fresh, busy));
});

test("a stated level edit on one device keeps the other device's confidence and focus", () => {
  // The older install's Settings edit: a newer level, confidence and focus never asked, on the busier phone.
  const older = structuredClone(profile(100));
  older.practicePreferences = { level: 'zero', confidence: null, focus: null };
  const edited = edit(older, 'statedLevel', 'getby', 2);
  const onboarded = edit(profile(), 'statedLevel', 'few', 1);
  onboarded.practicePreferences = { level: 'few', confidence: 'trying', focus: 'listening' };
  for (const result of [merge(edited, onboarded), merge(onboarded, edited)]) {
    assert.deepEqual(result.practicePreferences, { level: 'getby', confidence: 'trying', focus: 'listening' });
  }
  assert.deepEqual(merge(edited, onboarded), merge(onboarded, edited));
});

test('a stated level still beats a remote copy that never answered, clocked or not', () => {
  const unanswered = profile(100);
  delete (unanswered as Record<string, unknown>).practicePreferences;
  const legacy = profile();
  for (const result of [merge(unanswered, legacy), merge(legacy, unanswered)]) assert.equal(preferenceValue(result, 'statedLevel'), 'zero');
  const clocked = edit(profile(), 'statedLevel', 'getby', 1);
  for (const result of [merge(unanswered, clocked), merge(clocked, unanswered)]) {
    assert.deepEqual(result.practicePreferences, { level: 'getby', confidence: 'hesitant', focus: null });
  }
});

test('stated-level clocks reject values outside the closed four and mismatched values', () => {
  const bad = profile();
  bad.practicePreferences = { level: 'fluent', confidence: null, focus: null };
  assert.throws(() => newPreferenceClock(bad, 'statedLevel', id(1), 0));
  const stale = edit(profile(), 'statedLevel', 'few', 1);
  stale.practicePreferences = { level: 'getby', confidence: null, focus: null };
  assert.equal(preferenceClocks(stale).statedLevel, undefined);
});

test('the onboarding goal clocks only a real goal or null, and a clocked clear beats an older unclocked goal', () => {
  for (const value of [null, 'food', 'trip', 'family', 'moving', 'work', 'because']) {
    const p = edit(profile(), 'onboardingGoal', value, 1);
    assert.deepEqual(Object.keys(preferenceClocks(p)), ['onboardingGoal'], String(value));
  }
  for (const value of ['nonsense', 5, true, '']) {
    const p = { ...profile(), onboardingGoal: value } as MergedStoredProfile;
    assert.throws(() => newPreferenceClock(p, 'onboardingGoal', id(1), 0), /cannot be ordered/, String(value));
    assert.deepEqual(preferenceClocks({ ...p, preferenceClocks: { onboardingGoal: { counter: 1, mutationId: id(1), value } } }), {});
  }
  const legacy = { ...profile(100), onboardingGoal: 'moving' } as MergedStoredProfile;
  const cleared = edit({ ...profile(), onboardingGoal: 'moving' } as MergedStoredProfile, 'onboardingGoal', null, 1);
  for (const result of [merge(legacy, cleared), merge(cleared, legacy)]) {
    assert.equal(preferenceValue(result, 'onboardingGoal'), null);
    assert.equal(result.brain.stats.sessions, 100);
  }
  assert.deepEqual(merge(legacy, cleared), merge(cleared, legacy));
});

test('a newer stated-level edit carries its placement across devices, a clear included', () => {
  const placed = (level: string, placement: string | undefined, counter: number) => {
    const next = edit(profile(counter === 1 ? 100 : 0), 'statedLevel', level, counter);
    const prefs = { ...(next.practicePreferences as Record<string, unknown>) };
    if (placement === undefined) delete prefs.placement; else prefs.placement = placement;
    next.practicePreferences = prefs;
    return next;
  };
  const placement = (r: MergedStoredProfile) => (r.practicePreferences as Record<string, unknown>).placement;
  const getby = placed('getby', 'basics', 1);
  const lowered = placed('few', undefined, 2);
  for (const r of [merge(getby, lowered), merge(lowered, getby)]) assert.equal(placement(r), undefined);
  const raised = placed('confident', 'everyday', 3);
  for (const r of [merge(raised, lowered), merge(lowered, raised)]) assert.equal(placement(r), 'everyday');
  // A legacy profile with no placement never gains one from a merge.
  for (const r of [merge(edit(profile(100), 'statedLevel', 'few', 1), edit(profile(), 'statedLevel', 'confident', 2))]) assert.equal(placement(r), undefined);
});
