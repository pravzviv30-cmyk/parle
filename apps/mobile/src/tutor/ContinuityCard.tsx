/**
 * What the tutor remembers, on the Tutor tab (F546, F551, F573).
 *
 * It was a card with a heading, a line and an outline button. Revamp A makes it
 * the peach row at the top of the tab: the tutor's own mark on the white disc,
 * "<Name> remembers", the one line, a chevron. The same thread, one row high,
 * so the three ways in below it read as a list rather than as a second card
 * competing with the circle above.
 *
 * It draws what `tutor/dashboard.ts` decided and decides nothing. Which line
 * the row says, what pressing it promises, and where it goes are four arms of
 * one branch, and a branch inside a `.tsx` is a branch this workspace cannot
 * ask a question of: there is no renderer here (docs/TESTING.md).
 *
 * A learner with no record behind them never sees this row, because
 * `continuity.ts` answers null and the tab draws nothing.
 */

import { TintRow } from '../components.tsx';
import { CONTINUITY_TINT } from './doorTint.ts';
import { continuityRow, type ContinuityRoute } from './dashboard.ts';
import type { Thread } from './threads.ts';
import { TutorMark } from './TutorMark.tsx';

export function ContinuityCard({
  headline,
  line,
  thread,
  continueAllowed,
  disabled,
  onPress,
}: {
  /** "<Name> remembers", from `continuity.ts`. */
  headline: string;
  /** What the tutor remembers, from `continuity.ts`. */
  line: string;
  /** The one thread to pick up, from `threads.ts`, or null. */
  thread: Thread | null;
  /** Whether keeping a conversation going is open on this plan. */
  continueAllowed: boolean;
  disabled: boolean;
  /** The tab navigates and writes the mark; the route itself is decided above. */
  onPress: (route: ContinuityRoute) => void;
}) {
  const row = continuityRow({ headline, line, thread, continueAllowed });
  return (
    <TintRow
      tint={CONTINUITY_TINT}
      glyph={<TutorMark />}
      title={headline}
      gloss={row.gloss}
      accessibilityLabel={row.label}
      disabled={disabled}
      onPress={() => onPress(row.route)}
    />
  );
}
