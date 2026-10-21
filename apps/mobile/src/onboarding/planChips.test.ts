/**
 * 2026-10-21 UI-008, artboard B-OB-Plan: the plan band's chips are the
 * learner's own answers and nothing else, and the stage words match Journey's.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planChips } from './planChips.ts';
import { freshPreAccountDraft } from './preAccountDraft.ts';
import { readFileSync } from 'node:fs';

test('the plan chips name each answer once, in the artboard order', () => {
  const draft = { ...freshPreAccountDraft(), reason: 'food' as const, interests: ['food', 'travel'] as const, startLevel: 'zero' as const, minutes: 10 as const, practiceFocus: 'speaking' as const };
  assert.deepEqual(planChips(draft as never), ['Food and cafés', 'Travel and places', 'Brand new', '10 min a day', 'Speaking']);
});

test('an unanswered plan shows no invented chips', () => {
  assert.deepEqual(planChips(freshPreAccountDraft()), []);
});

test('no fixed daily goal reads as its own answer, never as minutes', () => {
  assert.deepEqual(planChips({ ...freshPreAccountDraft(), minutes: 'none' } as never), ['Choose each time']);
});

test('the plan stage words are the five Journey stages, Starter to Confident', () => {
  const parts = readFileSync(new URL('./BOnboardingParts.tsx', import.meta.url), 'utf8');
  const journey = readFileSync(new URL('../journey/journeyView.ts', import.meta.url), 'utf8');
  const words = "['Starter', 'Basics', 'Everyday', 'Chatting', 'Confident']";
  assert.ok(parts.includes(`PLAN_STAGES = ${words}`));
  assert.ok(journey.includes(`STAGES = ${words}`));
});
