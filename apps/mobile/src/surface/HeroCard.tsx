import type { ReactNode } from 'react';

import type { ArtKey } from '../art/registry.ts';
import { SceneBrief } from '../components.tsx';
import { ClockGlyph } from '../glyphs.tsx';
import { paper, type TintName } from '../theme.ts';

/**
 * Deprecated: the card that led a tab, now drawn as a `SceneBrief`.
 *
 * Notebook Phase 1 replaces the hero with the scene brief in components.tsx and
 * this wrapper draws it with the fields the hero has: the caps label, the
 * title, the one plain line, why this scene, how long beside the clock, the
 * caller's Start and the caller's bookmark corner. The tint well and the
 * watercolour are not drawn: tints retire, and the brief is words. `art` and
 * `artTint` are accepted and ignored until Phase 3 moves Home onto
 * `SceneBrief` directly.
 *
 * The action still arrives as a node rather than as a label and a handler, so
 * `surfaceContract.test.ts` can go on counting primary pills per screen by
 * reading the files a tab draws.
 */
export function HeroCard({
  label,
  title,
  body,
  reason,
  timeLine,
  action,
  corner,
}: {
  label: string;
  title: string;
  body: string;
  /** Deprecated: the brief draws no picture. */
  art: ArtKey;
  /** Deprecated: tints are no longer drawn. */
  artTint: TintName;
  /** Why this particular scene was put in front of the learner. */
  reason: string;
  /** How long this is likely to take, already in words. */
  timeLine: string;
  /** The one primary action, built by the caller so its pill stays countable. */
  action: ReactNode;
  /** A 44pt slot at the top right: the bookmark toggle, or nothing. */
  corner?: ReactNode;
}) {
  return (
    <SceneBrief
      label={label}
      title={title}
      summary={body}
      reason={reason}
      minutes={timeLine}
      minutesMark={<ClockGlyph size={18} color={paper.inkSoft} />}
      action={action}
      corner={corner}
    />
  );
}
