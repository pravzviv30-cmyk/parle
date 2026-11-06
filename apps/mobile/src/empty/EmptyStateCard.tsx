/**
 * The empty-state card of the B-Empty-States artboard (DECISIONS.md UI-008,
 * 2026-10-21), in light and dark: a centred card at radius 26 and padding
 * 20/18 with a gap of 8, the canvas art, a 19 bold title, a 15/1.45 body and
 * one 46 ink button hugging its words.
 *
 * Pure presentation. The words, the drawing and the one action arrive as
 * props; every colour is a `useB()` token. The art is decoration, so the title
 * and body carry the meaning. Anything the owner needs under the button (the
 * bundled offline line on Speak) arrives as children.
 *
 * `figure` draws a mascot in place of the art. `stage` is the 4A board's centre
 * stage: no card, the figure and words centred on the screen's own ground,
 * under the larger title.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BArt, type BArtName } from '../art/BArt.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { BButton } from '../today/TodayParts.tsx';
import { bType, space } from '../theme.ts';

/** Which pastel the card sits on: the artboard draws white, butter and lavender. */
export type EmptyGround = 'card' | 'butter' | 'lavender';

export function EmptyStateCard({ art, figure, title, body, action, ground = 'card', live = false, stage = false, children }: ({
  /** The drawing; its height defaults to the drawing's own aspect at `width`. */
  art: { name: BArtName; width: number; height?: number };
  figure?: never;
} | {
  art?: never;
  /** A mascot, drawn in place of the art. */
  figure: ReactNode;
}) & {
  title: string;
  /** The line under the title, or null when the title says it all. */
  body: string | null;
  /** The one way forward, or null when the owner draws its own below. */
  action: { label: string; accessibilityLabel?: string; disabled?: boolean; onPress: () => void } | null;
  ground?: EmptyGround;
  /** Speak the title when the card appears in place of something else. */
  live?: boolean;
  /** Centre stage: no card, on the screen's own ground, under the larger title. */
  stage?: boolean;
  children?: ReactNode;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={stage ? s.stage : [s.card, { backgroundColor: t[ground] }]}>
      {art ? <BArt name={art.name} width={art.width} height={art.height} /> : figure}
      <Text accessibilityRole="header" accessibilityLiveRegion={live ? 'polite' : undefined} style={[stage ? bType.title26 : bType.bold19, s.centred, { color: t.text }]}>{title}</Text>
      {body !== null ? <Text style={[bType.para15, s.centred, { color: t.secondary }]}>{body}</Text> : null}
      {action !== null ? (
        <View style={s.action}>
          <BButton hug label={action.label} accessibilityLabel={action.accessibilityLabel} disabled={action.disabled} height={46} ground={t.primary} ink={t.onPrimary} text={bType.bold15} onPress={action.onPress} />
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** The artboard's group label above a card: 13/700 muted, 0.3 tracking, padding 0 4. */
export function EmptyGroupLabel({ label }: { label: string }) {
  const t = useB();
  return <Text accessibilityRole="header" style={[bType.eyebrow, { color: t.muted, paddingHorizontal: space(1) }]}>{label}</Text>;
}

function makeStyles(_t: B) {
  return StyleSheet.create({
    card: { borderRadius: 26, paddingVertical: 20, paddingHorizontal: 18, gap: 8, alignItems: 'center', alignSelf: 'stretch' },
    stage: { gap: 8, alignItems: 'center', alignSelf: 'stretch' },
    centred: { textAlign: 'center', alignSelf: 'stretch' },
    action: { alignSelf: 'center' },
  });
}
