import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Art } from '../art/Art.tsx';
import type { ArtKey } from '../art/registry.ts';
import { Card, Label, TintPanel } from '../components.tsx';
import { ClockGlyph } from '../glyphs.tsx';
import { paper, space, type, HIT, type TintName } from '../theme.ts';

/**
 * The card that leads a tab: one thing to do tonight, drawn large.
 *
 * Revamp A gives Home a single hero instead of four competing cards, and this
 * is its shape: a caps label saying which kind of evening it is, the scene's
 * name in the bold serif, a line of plain English under it, the picture of the
 * place on its own quiet contextual wash, why it was chosen, how long it is
 * likely to take, and the one primary action.
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
    <Card style={s.card}>
      <View style={s.head}>
        <Label>{label}</Label>
        {corner != null ? <View style={s.corner}>{corner}</View> : null}
      </View>
      <Text style={[type.cardTitle, { color: paper.ink }]}>{title}</Text>
      <Text style={[type.body, { color: paper.inkSoft }]}>{body}</Text>
      <TintPanel tint={artTint} style={s.artWell}>
        <Art name={art} style={s.art} />
      </TintPanel>
      <Text style={[type.small, { color: paper.inkSoft }]}>{reason}</Text>
      <View style={s.time}>
        <ClockGlyph size={18} color={paper.inkSoft} />
        <Text style={[type.small, { color: paper.inkSoft }]}>{timeLine}</Text>
      </View>
      {action}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { gap: space(3) },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space(3) },
  corner: { minWidth: HIT, minHeight: HIT, alignItems: 'flex-end', justifyContent: 'center' },
  // The contextual tint gives the watercolour a job in the card and reaches
  // the card edges without changing the registry-owned size of the picture.
  artWell: { alignItems: 'center', overflow: 'hidden', marginHorizontal: -space(4) },
  art: { alignSelf: 'center' },
  time: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
});
