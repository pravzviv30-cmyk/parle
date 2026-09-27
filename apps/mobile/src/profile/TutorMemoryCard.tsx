/**
 * Who your tutor is, and what your tutor remembers (F562, F576).
 *
 * One white card with two rows: the tutor, drawn as the orb and named by the
 * voice the learner chose, and the memory behind it. The first opens the voice
 * sheet on Profile, the second pushes the editing screen.
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

import { Card, ChevronRight } from '../components.tsx';
import { ChatGlyph } from '../glyphs.tsx';
import { accent, decorative, paper, radius, space, type, DISC, HAIRLINE, HIT } from '../theme.ts';
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
  return (
    <Pressable
      onPress={() => {
        tapSettled();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${gloss}`}
      style={({ pressed }) => [st.row, !first && st.divided, pressed && st.pressed]}
    >
      {mark}
      <View style={st.words}>
        <Text style={[type.heading, { color: paper.ink }]}>{title}</Text>
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{gloss}</Text>
      </View>
      <ChevronRight color={paper.inkFaint} />
    </Pressable>
  );
}

export function TutorMemoryCard({ onVoice }: { onVoice: () => void }) {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile } = useProfile();
  const name = tutorNameOf(profile);
  return (
    <Card style={st.card}>
      <TutorRow first mark={<TutorMark />} title={name} gloss={PARTNER_LINE} onPress={onVoice} />
      <TutorRow
        mark={
          <View style={st.glyph} {...decorative}>
            <ChatGlyph color={accent.primary} />
          </View>
        }
        title={memoryLabel(name)}
        gloss={MEMORY_ROW_SUB}
        onPress={() => nav.navigate('TutorMemory')}
      />
    </Card>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(2.5) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: HIT, paddingVertical: space(2.5) },
  divided: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard },
  pressed: { backgroundColor: paper.groundDeep, borderRadius: radius.row },
  words: { flex: 1, minWidth: 0 },
  // An ink glyph with no disc under it (notebook Phase 4, 2026-09-27), kept at
  // the orb's width so the two titles start on one line.
  glyph: {
    width: DISC,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
