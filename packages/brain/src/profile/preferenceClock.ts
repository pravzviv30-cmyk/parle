/** Causal clocks for user settings only; never evidence, age gates or authorization. */
import { isTutorVoiceKey } from '@luvani/core';

export const PREFERENCE_FIELDS = ['dailyGoalMin', 'tutorVoice', 'preferTyping', 'name', 'username', 'strictness', 'pace', 'statedLevel'] as const;
export type PreferenceField = typeof PREFERENCE_FIELDS[number];
export type PreferenceValue = string | number | boolean | null;
export interface PreferenceClock { counter: number; mutationId: string; value: PreferenceValue }
export type PreferenceClocks = Partial<Record<PreferenceField, PreferenceClock>>;
// Finite, exact arithmetic. Exhaustion refuses a new edit rather than wrapping.
export const MAX_PREFERENCE_COUNTER = 1_000_000_000_000;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function preferenceValue(profile: unknown, field: PreferenceField): unknown {
  const outer = record(profile);
  // statedLevel is the onboarding/Settings `practicePreferences.level`, the one
  // nested answer a learner edits after onboarding. Confidence and focus are not clocked.
  if (field === 'statedLevel') return record(outer.practicePreferences).level ?? null;
  return (field === 'strictness' || field === 'pace'
    ? record(record(outer.brain).preferences)[field] : outer[field]) ?? null;
}

function validValue(field: PreferenceField, value: unknown): value is PreferenceValue {
  switch (field) {
    // 20 (Intense) since the app's profile v9, beside the three goals offered before it.
    case 'dailyGoalMin': return value === null || value === 5 || value === 10 || value === 15 || value === 20;
    case 'tutorVoice': return value === null || isTutorVoiceKey(value);
    case 'preferTyping': return typeof value === 'boolean';
    case 'name': case 'username': return value === null || (typeof value === 'string' && value.length <= 512);
    case 'strictness': return value === 'flow' || value === 'balanced' || value === 'strict';
    case 'pace': return value === null || value === 'normal' || value === 'slow';
    case 'statedLevel': return value === 'zero' || value === 'few' || value === 'getby' || value === 'confident';
  }
}

/** Only a clock bound to this exact, validated value can decide its ordering. */
export function preferenceClocks(profile: unknown): PreferenceClocks {
  const raw = record(record(profile).preferenceClocks);
  const clocks: PreferenceClocks = {};
  for (const field of PREFERENCE_FIELDS) {
    const clock = record(raw[field]);
    if (typeof clock.counter !== 'number' || !Number.isSafeInteger(clock.counter) || clock.counter < 1 || clock.counter > MAX_PREFERENCE_COUNTER) continue;
    if (typeof clock.mutationId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(clock.mutationId)) continue;
    if (!validValue(field, clock.value) || clock.value !== preferenceValue(profile, field)) continue;
    clocks[field] = { counter: clock.counter, mutationId: clock.mutationId, value: clock.value };
  }
  return clocks;
}

export function sanitisePreferenceClocks<T extends object>(profile: T): T {
  const next = { ...profile } as T & { preferenceClocks?: PreferenceClocks };
  const clocks = preferenceClocks(profile);
  if (Object.keys(clocks).length) next.preferenceClocks = clocks;
  else delete next.preferenceClocks;
  return next;
}

export function maxPreferenceCounter(...profiles: unknown[]): number {
  let max = 0;
  for (const profile of profiles) for (const clock of Object.values(preferenceClocks(profile))) max = Math.max(max, clock.counter);
  return max;
}

export function newPreferenceClock(profile: unknown, field: PreferenceField, mutationId: string, observed: number): PreferenceClock {
  const value = preferenceValue(profile, field);
  if (!validValue(field, value) || !/^[a-zA-Z0-9-]{16,80}$/.test(mutationId) || !Number.isSafeInteger(observed) || observed < 0 || observed >= MAX_PREFERENCE_COUNTER) throw new Error('preference edit cannot be ordered');
  return { counter: observed + 1, mutationId, value };
}

/** A total order, including corrupted equal IDs with different values. */
export function comparePreferenceClocks(a: PreferenceClock, b: PreferenceClock): number {
  if (a.counter !== b.counter) return a.counter - b.counter;
  if (a.mutationId !== b.mutationId) return a.mutationId < b.mutationId ? -1 : 1;
  const av = JSON.stringify(a.value), bv = JSON.stringify(b.value);
  return av < bv ? -1 : av > bv ? 1 : 0;
}

/** Overlay independently winning clocks onto an already selected legacy/evidence base. */
export function resolvePreferenceClocks<T extends object>(base: T, a: unknown, b: unknown): T {
  const ac = preferenceClocks(a), bc = preferenceClocks(b);
  const next = { ...base } as Record<string, unknown>;
  const clocks: PreferenceClocks = {};
  for (const field of PREFERENCE_FIELDS) {
    const x = ac[field], y = bc[field];
    const clock = !x ? y : !y ? x : comparePreferenceClocks(x, y) >= 0 ? x : y;
    if (!clock) continue;
    clocks[field] = clock;
    if (field === 'strictness' || field === 'pace') {
      const brain = record(next.brain), preferences = { ...record(brain.preferences) };
      if (field === 'pace' && clock.value === null) delete preferences.pace;
      else preferences[field] = clock.value;
      next.brain = { ...brain, preferences };
    } else if (field === 'statedLevel') {
      // Only the level moves; the answer-field merge already chose confidence and focus.
      next.practicePreferences = { confidence: null, focus: null, ...record(next.practicePreferences), level: clock.value };
    } else next[field] = clock.value;
  }
  delete next.preferenceClocks;
  if (Object.keys(clocks).length) next.preferenceClocks = clocks;
  return next as T;
}
