/**
 * Is the tutor still deciding what to say?
 *
 * It drives one dot of UI — the orb beside the transcript — and it was spread
 * across five branches of the data-channel switch, which is exactly why a sixth
 * branch got missed. An `error` notice is the tutor saying it cannot answer, and
 * nothing cleared the flag: the learner read "Say that once more for me" while
 * the orb beside it insisted the tutor was still thinking, and the notice took
 * itself away after eight seconds while the orb stayed on forever.
 *
 * One function, one rule, and every message accounted for by the type system.
 */

import type { ServerMessage } from '@parle/core';

export function thinkingAfter(thinking: boolean, message: ServerMessage): boolean {
  switch (message.t) {
    // Said, and not yet answered.
    case 'transcript':
      return message.final ? true : thinking;

    // An answer arrived, in whichever shape this session speaks.
    case 'prompt':
    case 'convo':
    case 'topics':
    case 'recap':
    case 'summary':
      return false;

    // "I cannot answer that one" is an answer. The session is still live and the
    // learner still has the floor, so the orb must stop claiming otherwise.
    case 'error':
      return false;

    // Taking the floor is the end of deciding; giving it up is not the start.
    case 'speaking':
      return message.speaking ? false : thinking;

    // Feedback rides alongside a prompt, and drills arrive after the recap.
    case 'feedback':
    case 'drills':
      return thinking;
  }
}
