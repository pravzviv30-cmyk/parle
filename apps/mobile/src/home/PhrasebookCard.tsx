/**
 * What you can say now, on Home.
 *
 * The reference app this came from puts two big serif numbers under its hero,
 * and that shape is right: a count in the serif reads as an achievement in a
 * way a sentence does not. What it does NOT get is that app's percentage,
 * because Luvani has no fixed word list to be a percentage of.
 *
 * A few of the learner's own phrases come along under the numbers, in the
 * serif, because the count is the claim and the phrases are the evidence.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { paper, space, type, radius } from '../theme.ts';
import { Card, Label, Stat, ArrowRight } from '../components.tsx';
import { hasPhrases, type Phrasebook } from '../phrases/phrasebook.ts';

/** Enough to show this is real, few enough that it stays a card. */
const PREVIEW = 3;

export function PhrasebookCard({ book, onOpen }: { book: Phrasebook; onOpen: () => void }) {
  if (!hasPhrases(book)) return null;

  const preview = book.groups.flatMap((g) => g.phrases).slice(0, PREVIEW);

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`What you can say now, ${book.count} phrases`}
      style={({ pressed }) => pressed && { opacity: 0.75 }}
    >
      <Card>
        <View style={st.head}>
          <Label>What you can say now</Label>
          <ArrowRight />
        </View>

        <View style={st.stats}>
          <Stat value={String(book.count)} label="Phrases" />
          {book.topics > 0 && <Stat value={String(book.topics)} label="Conversations" />}
        </View>

        <View style={st.chips}>
          {preview.map((p) => (
            <View key={p.id} style={st.chip}>
              <Text style={[type.french, st.chipText]} numberOfLines={1}>
                {p.front}
              </Text>
            </View>
          ))}
        </View>

        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2.5) }]}>
          Every one of these came out of your own mouth.
        </Text>
      </Card>
    </Pressable>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stats: { flexDirection: 'row', gap: space(8), marginTop: space(2.5) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(3.5) },
  chip: {
    backgroundColor: paper.groundDeep,
    borderRadius: radius.chip,
    paddingHorizontal: space(2.5),
    paddingVertical: space(1),
    maxWidth: '100%',
  },
  chipText: { color: paper.ink, fontSize: 16, lineHeight: 22 },
});
