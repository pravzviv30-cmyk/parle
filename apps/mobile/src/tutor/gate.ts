/**
 * Whether the start button starts anything.
 *
 * The tab has always probed /health at the moment of tapping, and has always
 * thrown the answer away. A learner with no token server was told "Demo mode"
 * on one line and walked into a live screen on the next, where the fetch fails
 * and the only control left is Back. This is that answer, honoured.
 *
 * It lives here rather than inside TutorTab for the reason docs/TESTING.md
 * gives for every rule that used to hide in a component: apps/mobile has no
 * renderer, so a decision inside a `.tsx` is a decision nothing can check.
 * `practice/statusLine.ts` is the same move.
 *
 * The copy is here too, and it is used twice: once by the tab, which stays put
 * and points at its own Demo mode card, and once by the navigator's Convo
 * guard, which catches the narrow race where the server dies between the probe
 * and the mount. Two screens saying different things about one fault is how a
 * learner stops believing either of them.
 */

export interface TutorOfflineCopy {
  /** The micro-label above the card. Matches the one the tab already draws. */
  label: string;
  /** What the tab's card has always said, kept so nothing moves under them. */
  headline: string;
  /** The line the learner gets for asking, once the answer is in. */
  body: string;
  /** Re-probes. The server may simply not have finished booting. */
  retry: string;
  /** While the probe is in flight, so the button is never a dead press. */
  checking: string;
  /** The way out, always offered. */
  back: string;
}

export const TUTOR_OFFLINE: TutorOfflineCopy = {
  label: 'Demo mode',
  headline: 'The live tutor needs its servers up. Practice still works.',
  body: 'Your tutor is not answering yet. Practice is ready whenever you are.',
  retry: 'Check again',
  checking: 'Checking',
  back: 'Back',
};

/**
 * `heldBack` is the start that did not happen, kept so the card's retry can be
 * the same start. Without it the retry has to guess, and the guess it made was
 * "spoken", which is the one answer a learner who tapped the quiet door cannot
 * be handed: they may be on a train.
 */
export type TutorGate =
  | { go: true; screen: 'Convo'; params: { textMode: boolean } }
  | { go: false; offline: TutorOfflineCopy; heldBack: { textMode: boolean } };

/**
 * `serversAnswered` is exactly what `recheck()` resolves to.
 *
 * `textMode` rides through rather than around: typing needs the same token
 * server the voice does, so offering it as an escape from a dead one would be
 * an exit that fails in precisely the same place. It rides back out too, on
 * both answers, because the route a learner chose survives a server being down.
 */
export function tutorGate(serversAnswered: boolean, textMode = false): TutorGate {
  if (!serversAnswered) return { go: false, offline: TUTOR_OFFLINE, heldBack: { textMode } };
  return { go: true, screen: 'Convo', params: { textMode } };
}
