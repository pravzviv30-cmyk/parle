/**
 * The one rule about putting a safety decision away.
 *
 * A redirect is a line the learner reads and then carries on past, so it
 * belongs to them: they decide when they have read it, which is why it has no
 * timer. A stop is not that. The session is over, the surface IS the screen,
 * and there is nothing underneath it to carry on with, so a tap that cleared it
 * would hand the learner back a live-looking session that has already ended.
 *
 * One line of logic, in a module of its own, because `useLiveSession.ts` cannot
 * be imported by a test at all: it reaches expo-modules-core through
 * `globals.ts`, which node's type stripping refuses to load (docs/TESTING.md).
 * A rule left inline in the hook is a rule nothing can ask a question about,
 * and this is the rule where being wrong means a crisis surface disappearing
 * under a thumb. Same move as `thinking.ts` next door.
 */

import type { SafetyDecision } from '../tutor/safetyView.ts';

/**
 * What the session's safety decision becomes when the learner dismisses it.
 *
 * A stop comes back unchanged, and by identity, so the hook can skip the render
 * entirely. Everything else clears.
 */
export function afterDismiss(safety: SafetyDecision | null): SafetyDecision | null {
  return safety?.action === 'stop' ? safety : null;
}
