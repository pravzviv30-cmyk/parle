import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, EarGlyph, Label } from '../components.tsx';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { radius, space, type, HAIRLINE, HIT } from '../theme.ts';
import { CADENCE, type Cadence, type CadenceWord } from './cadence.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';

/** The mark beside a connector the learner has produced. TodayRow's size and grammar. */
const MARK = 10;

/**
 * The words that keep the rhythm going.
 *
 * Authored, so the section exists on a first morning, and marked as the learner
 * earns them. The mark is the same green and the same shape the passport uses
 * for a situation handled alone, because it is the same claim about a smaller
 * thing: you did this yourself, unprompted.
 *
 * Every row can be heard. A connector is a sound before it is a meaning, and a
 * learner who has only read "du coup" will not recognise it spoken.
 *
 * `cadence.ts` decides all of it. This file lays it out and plays it, and stops
 * the voice when it goes (F304).
 */
export function CadenceCard({ cadence }: { cadence: Cadence }) {
  const t = useB();
  const st = useThemedStyles(makeSt);
  useEffect(() => () => tutorVoice.stop(), []);
  if (cadence.words.length === 0) return null;

  return (
    <View style={st.block}>
      <Label>{CADENCE.label}</Label>
      <Card style={{ marginTop: space(2) }}>
        <Text style={[type.title, { color: t.text }]}>{CADENCE.title}</Text>
        <Text style={[type.body, { color: t.muted, marginTop: space(1) }]}>{CADENCE.blurb}</Text>
        <View style={st.rows}>
          {cadence.words.map((word) => (
            <Row key={word.id} word={word} />
          ))}
        </View>
      </Card>
    </View>
  );
}

function Row({ word }: { word: CadenceWord }) {
  const t = useB();
  const st = useThemedStyles(makeSt);
  return (
    <View style={st.row}>
      <View style={[st.mark, word.yours ? st.mine : st.notYet]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <View style={st.words}>
        <Text style={[type.frenchSm, { color: t.text }]}>{'« '}{word.fr}{' »'}</Text>
        <Text style={[type.small, { color: t.muted }]}>{word.en}</Text>
        <Text style={[type.small, { color: t.muted }]}>{word.note}</Text>
        {word.yours && <Text style={[type.small, { color: t.text }]}>{CADENCE.yours}</Text>}
      </View>
      <Pressable
        onPress={() => tutorVoice.speak(word.fr)}
        accessibilityRole="button"
        accessibilityLabel={`Hear ${word.fr}`}
        style={({ pressed }) => [st.hear, pressed && { opacity: 0.6 }]}
      >
        <EarGlyph size={15} color={t.text} />
      </Pressable>
    </View>
  );
}

function makeSt(t: B) {
  return StyleSheet.create({
  block: { marginTop: space(6) },
  rows: { marginTop: space(4), gap: space(4) },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3), minHeight: HIT },
  words: { flex: 1, gap: space(0.5) },
  // The passport's mark, at the passport's size: filled means the learner
  // produced it, and a hairline is not a colour, because a word they have not
  // said yet is not a state worth signalling.
  mark: { width: MARK, height: MARK, borderRadius: MARK / 2, marginTop: space(2) },
  mine: { backgroundColor: t.text },
  notYet: { borderWidth: HAIRLINE + 0.4, borderColor: t.field },
  hear: {
    minHeight: HIT,
    minWidth: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: t.skeleton,
  },
});
}
