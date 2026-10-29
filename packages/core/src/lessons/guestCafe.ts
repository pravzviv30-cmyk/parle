/**
 * The guest first scene: one short scripted café exchange a learner can do
 * before creating an account.
 *
 * It is not a catalogue lesson. It is a five-turn cut of the café lesson, so it
 * is deliberately absent from `LESSONS` and `getLesson`. The turns are taken by
 * reference from `CAFE_LESSON`, never copied, so the French stays the reviewed
 * original and a fix there reaches the guest scene too.
 *
 * It runs on the scripted lesson tutor with no language model.
 */

import { CAFE_LESSON } from './cafe.ts';
import type { Lesson, LessonTurn } from './types.ts';

/** The wire name of the scene, used by the token server, the tutor agent and the app. */
export const GUEST_SCENE = 'guest-cafe' as const;
export type GuestScene = typeof GUEST_SCENE;

/** The café turns the scene plays, in scene order. */
export const GUEST_SCENE_TURN_IDS = ['t1-greet', 't2-order', 't3-sur-place', 't9-thanks', 't12-goodbye'] as const;
export type GuestSceneTurnId = (typeof GUEST_SCENE_TURN_IDS)[number];

/**
 * The summary's "Next time, try …" step after the scene (F925). It names the
 * café turns the cut leaves out (`t5-croissant`, `t7-how-much`), so the tip
 * follows the scene that was played, never the learner's goal.
 */
export const GUEST_SCENE_NEXT_TRY = 'asking for a croissant and how much it is';

/** A guest scene never runs longer than this. */
export const GUEST_SCENE_MAX_SECONDS = 180;

const SCENE_TURNS: LessonTurn[] = GUEST_SCENE_TURN_IDS.map((id) => {
  const turn = CAFE_LESSON.turns.find((t) => t.id === id);
  if (!turn) throw new Error(`guest scene turn ${id} is missing from ${CAFE_LESSON.id}`);
  return turn;
});

export const GUEST_CAFE_SCENE: Lesson = {
  ...CAFE_LESSON,
  id: 'cafe-guest',
  premise: 'You are going to walk into a café in Lyon and order a coffee, in French, out loud. It takes about two minutes.',
  scenario:
    'The learner walks into a small French café mid-morning. This is a short scene of five lines: ' +
    'they greet you, order a coffee, say they will have it here, thank you, and say goodbye. ' +
    'There is no pastry, no paying and no toilets in this scene. Play the barista. Stay in the scene ' +
    'throughout. Speak slowly and clearly, but never in a babyish register. Treat them as an ' +
    'adult who simply does not have the words yet.',
  // Narrowed to the sounds the five turns actually exercise (no /ɛ̃/ or /ɑ̃/ here).
  targetPhonemes: ['ʁ', 'ɔ̃', 'œ̃', 'y', 'ʒ', 'e'],
  turns: SCENE_TURNS,
};

export function isGuestScene(value: unknown): value is GuestScene {
  return value === GUEST_SCENE;
}

export function isGuestSceneTurnId(value: unknown): value is GuestSceneTurnId {
  return typeof value === 'string' && (GUEST_SCENE_TURN_IDS as readonly string[]).includes(value);
}

/**
 * Validates an untrusted list: an array of distinct allowed ids, at most 5.
 * Returns them in scene order, or null when anything is wrong.
 */
export function parseGuestSceneTurnIds(value: unknown): GuestSceneTurnId[] | null {
  if (!Array.isArray(value) || value.length > GUEST_SCENE_TURN_IDS.length) return null;
  const seen = new Set<string>();
  for (const item of value) {
    if (!isGuestSceneTurnId(item) || seen.has(item)) return null;
    seen.add(item);
  }
  return GUEST_SCENE_TURN_IDS.filter((id) => seen.has(id));
}

/** The natural lines a learner practised, for the phrasebook, in scene order. */
export function guestScenePhrases(
  ids: readonly GuestSceneTurnId[],
): { turnId: GuestSceneTurnId; fr: string; en: string }[] {
  const wanted = new Set<string>(ids);
  return SCENE_TURNS.filter((t) => wanted.has(t.id)).map((t) => ({
    turnId: t.id as GuestSceneTurnId,
    fr: t.target,
    en: t.targetEn,
  }));
}
