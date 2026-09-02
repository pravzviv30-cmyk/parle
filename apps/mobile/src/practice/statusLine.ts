/**
 * The quiet lines this app puts underneath things.
 *
 * Two of them live here now. The first is the line under a path node's title.
 * The second is the answer to "Give me a moment" in a live scene, which is the
 * same kind of object: one short sentence, in the calm slot, saying what is
 * true without asking anybody to do anything about it. It is here rather than
 * in the screen that shows it for the reason the first one is.
 *
 * Pulled out of PathNodeRow for the reason docs/TESTING.md gives for every rule
 * that has ever lived inside a component here: apps/mobile has no renderer, so a
 * rule in a component is a rule nothing can check. It matters more than usual
 * for this one, because "locked" now covers two genuinely different situations
 * and telling a learner the wrong one is telling them something untrue.
 */

import type { PathNode } from '@luvani/core';

/**
 * `tutorName` comes from `tutorPersonaOf`, and is an argument for the reason
 * every other line that names him is now: two of the eight voices are women,
 * so who is writing this topic is a fact about the learner's profile rather
 * than about the product.
 */
export function statusLine(node: PathNode, tutorName: string): string {
  switch (node.state) {
    case 'complete':
      return 'Learned';
    case 'needs-review':
      return 'Ready to come back to';
    case 'in-progress':
      return 'Started';
    case 'locked':
      // A locked *topic* is one the learner has already talked about: its
      // phrases are banked and its drills are still being written. Telling them
      // their conversations will write it would be describing something that
      // has already happened.
      return node.kind === 'topic' ? `${tutorName} is still writing this one` : 'Your conversations write this one';
    default:
      return node.sub;
  }
}

/**
 * The quiet line the app shows when the learner asks for a moment.
 *
 * Three rules decided it, and the third one overruled the contract's own
 * suggested wording.
 *
 * It is on screen and never spoken. A spoken acknowledgement of a pause is a
 * remark on the pause, and the learner may be in a room where the tutor talking
 * again is the last thing they want.
 *
 * It is a notice, not a warning: nothing here is an error, a failure or an
 * amount of time running out, so it renders in the same calm slot every other
 * notice uses.
 *
 * And it does not say "take your time". docs/PEDAGOGY.md's invariant names that
 * phrase specifically as something never to say to a learner who has gone
 * quiet, so shipping it as the answer to this button would put the banned
 * sentence on screen at exactly the moment it was banned for. What is reported
 * instead is the tutor's behaviour, not the learner's: the person who asked for
 * time is told the request landed, and nobody comments on why it was made.
 */
export function momentAnswer(tutorName: string): string {
  return `${tutorName} will wait.`;
}

/**
 * How long that line stays up when nothing else clears it.
 *
 * Shorter than the agent's grace window on purpose: the line is a receipt for a
 * tap, not a countdown, and a sentence that disappears exactly as the clock
 * runs out would turn it into one.
 */
export const MOMENT_ANSWER_MS = 6000;
