/**
 * How a conversation opens, read once from its route params (F903, F923).
 *
 * Founder decision (F903, 2026-10-28): the onboarding typing answer is only a
 * suggestion. Every button that says "Start speaking" or "Speak instead"
 * passes `textMode: false`, and that is the learner agreeing to be heard: the
 * typing box starts closed and the microphone opens when the room is ready.
 * With no stated intent, today's behaviour holds: the stored preference seeds
 * the box and the microphone opens closed.
 *
 * F923: on the web the params come back from the address as strings after a
 * reload, and "false" is truthy. So each one is coerced here, and anything that
 * is not plainly true or false counts as not said.
 */

import type { StoredProfile } from '../profile/store.ts';
import { prefersTyping } from '../profile/typing.ts';

/** true or 'true' is true, false or 'false' is false, anything else was not said. */
export function boolParam(value: unknown): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

export interface ConvoStart {
  /** The session connects typed (convo-text). */
  openedTyped: boolean;
  /** The typing box is open when the room is. */
  typingOpen: boolean;
  /** Open the microphone once, when the room is ready. */
  openMicOnReady: boolean;
  listenOnly: boolean;
  walkMode: boolean;
}

export function convoStartFromParams(
  params: { textMode?: unknown; listenOnly?: unknown; walkMode?: unknown } | undefined,
  profile: Pick<StoredProfile, 'preferTyping'> | null | undefined,
): ConvoStart {
  const walkMode = boolParam(params?.walkMode) === true;
  if (walkMode) return { openedTyped: false, typingOpen: false, openMicOnReady: false, listenOnly: false, walkMode };
  const textMode = boolParam(params?.textMode);
  const openedTyped = textMode === true;
  // Typed wins over listen, as it always has.
  const listenOnly = !openedTyped && boolParam(params?.listenOnly) === true;
  if (openedTyped) return { openedTyped, typingOpen: true, openMicOnReady: false, listenOnly, walkMode };
  if (textMode === false) return { openedTyped, typingOpen: listenOnly, openMicOnReady: !listenOnly, listenOnly, walkMode };
  return { openedTyped, typingOpen: listenOnly || prefersTyping(profile as StoredProfile | null | undefined), openMicOnReady: false, listenOnly, walkMode };
}

/**
 * Whether to open the microphone now, for a Start speaking room (F903). Once,
 * and only when the room is live and showing. A refusal (permission denied)
 * opens the typing box instead, so nobody is left in front of a closed circle.
 */
export function micOpensOnReady(state: {
  openMicOnReady: boolean; openedTyped: boolean; walkMode: boolean;
  asked: boolean; live: boolean; roomShown: boolean;
  /** The session on screen, and the one a switch to voice left (null when none was left). */
  sessionId: string | null; leftSessionId: string | null;
}): boolean {
  // The commit a switch flips the mode in still shows the old room as live; it is never the one asked.
  const newRoom = state.leftSessionId === null || state.sessionId !== state.leftSessionId;
  return state.openMicOnReady && !state.openedTyped && !state.walkMode && !state.asked && state.live && state.roomShown && newRoom;
}

/**
 * After asking: a refusal on the room it asked for opens the typing box (the
 * quiet twin); a room that changed underneath the ask asks again on the new one.
 */
export function micAfterAsk(state: { opened: boolean; askedFor: string | null; now: string | null }): 'done' | 'open-box' | 'ask-again' {
  if (state.opened) return 'done';
  return state.askedFor === state.now ? 'open-box' : 'ask-again';
}

/**
 * The topic a conversation was started on, as it travels in the web address.
 *
 * The route param is an object, and without a stringify the address held
 * "[object Object]", so a reload (F923) lost the topic or handed the tutor a
 * garbage string. It is written as JSON and read back here, and anything that
 * is not exactly a French and an English string is dropped, never sent.
 */
export function stringifySeedTopic(topic: { fr: string; en: string }): string {
  return JSON.stringify({ fr: topic.fr, en: topic.en });
}

export function parseSeedTopic(value: unknown): { fr: string; en: string } | undefined {
  let candidate: unknown = value;
  if (typeof value === 'string') {
    try { candidate = JSON.parse(value); } catch { return undefined; }
  }
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return undefined;
  const { fr, en } = candidate as { fr?: unknown; en?: unknown };
  if (typeof fr !== 'string' || typeof en !== 'string' || fr.trim() === '' || en.trim() === '') return undefined;
  return { fr, en };
}
