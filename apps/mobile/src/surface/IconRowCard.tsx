import type { ReactNode } from 'react';

import { LedgerRow } from '../components.tsx';

/**
 * Deprecated: the white row card, now drawn as a `LedgerRow`.
 *
 * Notebook Phase 1 turns every list into ledger rows: a hairline divider, an
 * ink glyph with no disc, a title, a gloss and the chevron that says it opens.
 * This wrapper forwards the fields it has: the label stays the row's one caps
 * line, the sentence becomes its title, and the note stays its own quiet line so
 * two sentences are never glued into one. The row is still one target, and it
 * still names itself once with the label the caller chose. Call sites move onto
 * `LedgerRow` in Phase 4.
 */
export function IconRowCard({
  glyph,
  label,
  line,
  note,
  onPress,
  accessibilityLabel,
}: {
  /** One line-art glyph, drawn in ink with no disc. */
  glyph: ReactNode;
  label: string;
  /** The sentence under the label: what the learner will find in there. */
  line: string;
  /** An optional quieter line under it, for a separate fact such as a dated outcome. */
  note?: string | null;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return <LedgerRow glyph={glyph} label={label} title={line} note={note} onPress={onPress} accessibilityLabel={accessibilityLabel} />;
}
