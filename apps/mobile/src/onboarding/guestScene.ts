/**
 * The guest first scene on the app side: the words and the wire shapes that
 * the screens share, kept pure so the tests can run them without native modules.
 *
 * The scene is one short scripted café exchange (`GUEST_CAFE_SCENE` in core).
 * Its record keeps turn ids only, never what the learner typed or said; the
 * lines shown and saved are the reviewed French from core, via
 * `guestScenePhrases`. Wire contract: docs/changes/guest-first-scene.md.
 */
import { GUEST_SCENE, guestScenePhrases, parseGuestSceneTurnIds, type GuestSceneTurnId } from '@luvani/core';

export { GUEST_SCENE };

/** The lesson id the scene room plays. */
export const GUEST_SCENE_LESSON_ID = 'cafe-guest';

export type GuestSceneMode = 'lesson' | 'lesson-text';

/** Voice unless the learner is typing; the scene room accepts only these two. */
export function guestSceneMode(typing: boolean): GuestSceneMode {
  return typing ? 'lesson-text' : 'lesson';
}

/**
 * The /onboarding/live body for a guest room. A scene grant names its mode;
 * the older guest conversation sends an empty body, as it always has.
 */
export function guestLiveBody(mode: string | undefined): Record<string, never> | { mode: GuestSceneMode } {
  return mode === 'lesson' || mode === 'lesson-text' ? { mode } : {};
}

/** Start refusals that lead to the account handoff, each with its own line. */
export type GuestStartRefusal = 'guest-live-unavailable' | 'guest-scene-used';

export function isAccountHandoffRefusal(code: unknown): code is GuestStartRefusal {
  return code === 'guest-live-unavailable' || code === 'guest-scene-used';
}

export function startRefusalCopy(code: GuestStartRefusal): string {
  return code === 'guest-scene-used'
    ? 'Nice to see you again. Create an account and your tutor will pick up from here.'
    : 'Live practice is resting right now. Create an account to start.';
}

/** /onboarding/claim refusals (409), each with calm copy of its own. */
export type GuestClaimRefusal = 'guest-claimed-elsewhere' | 'guest-expired' | 'guest-active';

export function claimRefusalOf(code: unknown): GuestClaimRefusal | null {
  return code === 'guest-claimed-elsewhere' || code === 'guest-expired' || code === 'guest-active' ? code : null;
}

export function claimRefusalCopy(code: GuestClaimRefusal | null): string {
  switch (code) {
    case 'guest-claimed-elsewhere':
      return 'This practice is already saved to another account. Your account is ready, and you can start fresh.';
    case 'guest-expired':
      return 'That practice is too old to save, but your account is ready. Let’s start fresh.';
    case 'guest-active':
      return 'Your café scene is still finishing. Try again in a moment.';
    default:
      return 'Your practice could not be linked yet. Try again.';
  }
}

/**
 * A refusal that will never change on retry: the practice cannot be kept, so
 * Start fresh must still be able to finish the hand-off.
 */
export function claimRefusalIsFinal(code: GuestClaimRefusal | null): boolean {
  return code === 'guest-claimed-elsewhere' || code === 'guest-expired';
}

export class GuestClaimRefused extends Error {
  readonly code: GuestClaimRefusal | null;
  constructor(code: GuestClaimRefusal | null) {
    super(claimRefusalCopy(code));
    this.code = code;
  }
}

/** The server's ids when they are valid, otherwise the ones this phone holds. */
export function trustedSceneTurns(fromServer: unknown, local: readonly GuestSceneTurnId[] | undefined): GuestSceneTurnId[] {
  return parseGuestSceneTurnIds(fromServer) ?? [...(local ?? [])];
}

/** Exactly what the hand-off writes to the phrasebook for a scene. */
export function scenePhrasebookEntries(ids: readonly GuestSceneTurnId[]) {
  return guestScenePhrases(ids).map((line) => ({
    fr: line.fr,
    frWritten: null,
    en: line.en,
    enLiteral: null,
    register: 'courant' as const,
    note: null,
  }));
}

/** The lines named on the recap and the summary, in scene order. */
export function sceneLines(ids: readonly GuestSceneTurnId[]): string[] {
  return guestScenePhrases(ids).map((line) => `You answered with “${line.fr}”.`);
}

/**
 * A guest room that cannot be granted again. The hook classifies any 409 from
 * the token server as `session-elsewhere`, whose copy is about a signed-in
 * session on another device. A guest grant only ever asks /onboarding/live,
 * and a 409 there means this guest room was already claimed (the app was
 * closed mid-scene), so retrying can never work. The guest screen says so in
 * its own words and offers the way to the result instead.
 */
export const GUEST_ROOM_ENDED = {
  label: 'This scene has ended',
  message: 'Your café scene closed before it finished. You can see what you reached and save it.',
  action: 'See what you reached',
} as const;
