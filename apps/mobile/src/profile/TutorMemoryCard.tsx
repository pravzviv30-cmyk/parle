/**
 * Who your tutor is, and what your tutor remembers (F562, F576).
 *
 * Two rows: the tutor, drawn as the orb and named by the voice the learner
 * chose, and the memory behind it. The first opens the voice sheet on Profile,
 * the second pushes the editing screen. Since P2 (2026-10-19) they are drawn
 * inside Profile's Learning group rather than on a card of their own, so they
 * take the grouped list's padding and inset separator.
 *
 * ## The tutor is a mark, never a face
 *
 * `TutorMark` is the orb at `DISC`, and the founder settled early that there
 * are no faces here. It is decorative, because the row says the name in words
 * beside it, and it is never a `Monogram`: that disc is the learner's initial
 * (F337), and the two of them on one card would say the tutor is the learner.
 *
 * ## It decides nothing
 *
 * Every word is `tutorMemory.ts`'s or `tutorVoice.ts`'s, and the facts are read
 * through `memory.ts`. It reads the live profile from context rather than the
 * disk, so a forget made on the screen is visible here the moment the learner
 * comes back. The two rows are a `Pressable` each, at the touch floor, and each
 * names itself once: a title and a gloss are two Texts, and a screen reader
 * left to itself would read them as two nodes with nothing between them.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { ChevronRight } from '../components.tsx';
import { useSettingsColors } from '../settings/SettingsAppearance.tsx';
import { RowDivider, useInGroup } from '../settings/SettingsGroup.tsx';
import { ChatGlyph } from '../glyphs.tsx';
import { decorative, paper, space, type, DISC, HIT } from '../theme.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { tapSettled } from '../motion/haptics.ts';
import { TutorMark } from '../tutor/TutorMark.tsx';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { MEMORY_ROW_SUB, PARTNER_LINE, memoryLabel } from './tutorMemory.ts';

/**
 * One row of the card: a mark, a title, a gloss, and a way in.
 *
 * Private to this file. `IconRowCard` is the white card that IS one row and
 * draws a caps label over a line; this card holds two rows under one heading,
 * with the title set as a heading and the gloss beneath it, which is the shape
 * the founder drew for the tutor.
 */
function TutorRow({
  mark,
  title,
  gloss,
  onPress,
  first = false,
}: {
  mark: ReactNode;
  title: string;
  gloss: string;
  onPress: () => void;
  first?: boolean;
}) {
  const colors = useSettingsColors();
  // Inside a group another row always comes first (Learning preferences on
  // Profile), so the tutor row takes the separator too.
  const grouped = useInGroup();
  const divided = !first || grouped;
  return (
    <Pressable
      onPress={() => {
        tapSettled();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${gloss}`}
      style={({ pressed }) => [st.row, pressed && st.pressed, pressed && { backgroundColor: colors.background }]}
    >
      {divided ? <RowDivider /> : null}
      {mark}
      <View style={st.words}>
        <Text style={[type.body, { color: colors.text }]}>{title}</Text>
        <Text style={[type.small, { color: colors.muted, marginTop: space(0.5) }]}>{gloss}</Text>
      </View>
      <ChevronRight color={colors.muted} />
    </Pressable>
  );
}

export function TutorMemoryCard({ onVoice }: { onVoice: () => void }) {
  const colors = useSettingsColors();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile } = useProfile();
  const name = tutorNameOf(profile);
  return (
    <>
      <TutorRow first mark={<TutorMark />} title={name} gloss={PARTNER_LINE} onPress={onVoice} />
      <TutorRow
        mark={
          <View style={st.glyph} {...decorative}>
            <ChatGlyph color={colors.text} />
          </View>
        }
        title={memoryLabel(name)}
        gloss={MEMORY_ROW_SUB}
        onPress={() => nav.navigate('TutorMemory')}
      />
    </>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: HIT, paddingHorizontal: space(4), paddingVertical: space(3.25) },
  pressed: { backgroundColor: paper.groundDeep },
  words: { flex: 1, minWidth: 0 },
  // An ink glyph with no disc under it (notebook Phase 4, 2026-09-27), kept at
  // the orb's width so the two titles start on one line.
  glyph: {
    width: DISC,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
