import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { Card, ChevronRight, Label } from '../components.tsx';
import { paper, space, type, DISC } from '../theme.ts';

/**
 * A white card that is one row: a mark, a label, a sentence, and a way in.
 *
 * The tinted row says "a place, or a kind of practice". This is its quiet
 * sibling for the things that belong to no place: Home's "Real progress", My
 * French's phrase shelf and conversations, Profile's two tutor rows. It stays
 * white and sits on the ground with the whisper the way every other card does,
 * because a tint here would claim a place that is not there.
 *
 * The disc is the ground rather than white: on a white card a white disc is
 * invisible, so the two surfaces swap. It is `DISC` wide, which is the touch
 * floor, so the mark never shrinks below the thing it sits inside.
 *
 * One `Pressable` wraps the whole row, not the chevron. A row whose only target
 * is its arrow is the F545 defect, and a button nested inside a button is
 * invalid on the web. The label and the line are two Texts and would reach a
 * screen reader as two unrelated nodes, so the row names itself once and the
 * caller says what it wants said.
 */
export function IconRowCard({
  glyph,
  label,
  line,
  onPress,
  accessibilityLabel,
}: {
  /** One line-art glyph, drawn on the disc. */
  glyph: ReactNode;
  label: string;
  /** The sentence under the label: what the learner will find in there. */
  line: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [pressed && s.pressed]}
    >
      <Card style={s.row}>
        <View style={s.disc}>{glyph}</View>
        <View style={s.words}>
          <Label>{label}</Label>
          <Text style={[type.bodyStrong, { color: paper.ink }]}>{line}</Text>
        </View>
        <ChevronRight color={paper.inkFaint} />
      </Card>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pressed: { opacity: 0.72 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: paper.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { flex: 1, minWidth: 0, gap: space(1) },
});
