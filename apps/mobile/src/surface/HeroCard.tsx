import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Art } from '../art/Art.tsx';
import type { ArtKey } from '../art/registry.ts';
import { Card, Label, TintPanel } from '../components.tsx';
import { ClockGlyph } from '../glyphs.tsx';
import { paper, radius, space, type, HIT, type TintName } from '../theme.ts';

/**
 * The card that leads a tab: one thing to do tonight, drawn large.
 *
 * A bold Atelier invitation with a compact scene beside its practical brief.
 * The illustration explains the situation without pushing Home's momentum
 * below an oversized picture. The reason, duration and primary action remain
 * distinct from the supporting Journal detail.
 *
 * The action arrives as a node rather than as a label and a handler, and that
 * is deliberate. `surfaceContract.test.ts` counts primary pills per screen by
 * reading the files a tab draws, so a `<PillButton` folded into this file would
 * move every tab's count to a shared component and the one-pill rule would stop
 * being checkable. The caller keeps the literal; this card keeps the layout.
 *
 * `corner` is the same bargain for the bookmark: a 44pt slot at the top right,
 * in flow beside the label rather than absolutely placed, so at the largest
 * reading size it pushes the title down instead of sitting on top of it.
 *
 * Nothing here writes a width. The picture's size comes from `art/registry.ts`,
 * which is the one place a scene's dimensions live, so two screens drawing the
 * same picture cannot drift apart.
 */
export function HeroCard({
  label,
  title,
  body,
  art,
  artTint,
  reason,
  timeLine,
  action,
  corner,
}: {
  label: string;
  title: string;
  body: string;
  art: ArtKey;
  /** The place's quiet paper wash behind its watercolour. */
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
    <Card tone="feature" style={s.card}>
      <View style={s.head}>
        <Label>{label}</Label>
        {corner != null ? <View style={s.corner}>{corner}</View> : null}
      </View>
      <Text style={[type.cardTitle, { color: paper.ink }]}>{title}</Text>
      <TintPanel tint={artTint} style={s.artWell}>
        <View style={s.sceneCopy}>
          <Text style={[type.label, { color: paper.ink }]}>En situation</Text>
          <Text style={[type.small, { color: paper.inkSoft }]}>{body}</Text>
        </View>
        <View style={s.sceneArt}><Art name={art} compact style={s.art} /></View>
      </TintPanel>
      <View style={s.meta}>
        <Text style={[type.small, s.reason, { color: paper.inkSoft }]}>{reason}</Text>
        <View style={s.time}>
          <ClockGlyph size={18} color={paper.inkSoft} />
          <Text style={[type.small, { color: paper.inkSoft }]}>{timeLine}</Text>
        </View>
      </View>
      {action}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { gap: space(2.5), overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space(3) },
  corner: { minWidth: HIT, minHeight: HIT, alignItems: 'flex-end', justifyContent: 'center' },
  // A shared scene brief keeps the art tied to the action it introduces.
  artWell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    overflow: 'hidden',
    backgroundColor: paper.card,
    borderColor: paper.ink,
    borderRadius: radius.row,
    padding: space(3),
  },
  sceneCopy: { flex: 1, minWidth: 0, gap: space(2) },
  sceneArt: { width: '35%', maxWidth: 144, alignItems: 'center' },
  art: { alignSelf: 'center' },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space(3),
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: space(2.5),
    borderTopWidth: 1,
    borderTopColor: paper.ink,
  },
  reason: { flex: 1, minWidth: 0 },
  time: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: space(1.5) },
});
