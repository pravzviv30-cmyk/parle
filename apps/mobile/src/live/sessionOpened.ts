/**
 * Which server message means "there is now a session on screen".
 *
 * The watchdog in `useLiveSession.ts` reads exactly this. A room that opens and
 * stays empty used to render a bare spinner forever while the meter ran, so the
 * hook gives the tutor a deadline to put something renderable on the screen and
 * leaves the room if it does not. Everything below decides what counts.
 *
 * Mode-specific on purpose. A first cut used one shared set, and a stale agent
 * answering a conversation request with a lesson `prompt` therefore counted as
 * the conversation having opened: the watchdog stood down and ConvoScreen —
 * which renders `convo`, never `prompt` — span forever anyway. An agent that
 * serves the wrong protocol for the mode it was handed is a real fault and
 * should time out and say so, not be quietly accepted.
 *
 * It lives here rather than inside the hook because the hook cannot be imported
 * by a test (it reaches expo-modules-core through `globals.ts`), and this table
 * decides whether a learner sees their session or an error screen.
 */

import type { ServerMessage } from '@parle/core';
import type { LiveMode } from '../tutor/choosingView.ts';

/**
 * The renderable openings, per session shape, because the two shapes render
 * from different messages entirely.
 *
 * `speaking`, `transcript` and `feedback` deliberately do not count: an agent
 * hung inside its TTS emits `speaking` and nothing more, and treating "said
 * anything at all" as proof of life let exactly the more common failure sail
 * straight through.
 */
export const OPENING_TAGS: Record<'lesson' | 'convo', ReadonlySet<string>> = {
  lesson: new Set(['prompt', 'summary']),
  convo: new Set(['convo', 'opening', 'recap']),
};

/** 'convo' and 'convo-text' are the same protocol; only the audio differs. */
function tagsFor(mode: LiveMode | undefined): ReadonlySet<string> {
  return mode === 'convo' || mode === 'convo-text' ? OPENING_TAGS.convo : OPENING_TAGS.lesson;
}

export function opensSession(mode: LiveMode | undefined, message: ServerMessage): boolean {
  // A safety decision opens the session in every mode, and this is the whole
  // reason the rule moved out of the hook. A stop can be the very first frame
  // of a session — a seeded topic caught before the scene is even built — and
  // it is not an opening in either table, so the session-open watchdog went on
  // counting behind it and, twenty-five seconds later, tore the room down and
  // replaced the one screen that must persist with "the tutor never started".
  // A redirect is the same answer for a plainer reason: the tutor is plainly
  // here, and it is talking to us.
  if (message.t === 'safety') return true;
  return tagsFor(mode).has(message.t);
}
