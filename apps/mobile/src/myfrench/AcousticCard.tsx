import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, EarGlyph, Label, TintPanel } from '../components.tsx';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { paper, radius, space, type, HIT } from '../theme.ts';
import { ACOUSTIC, type Acoustic, type AcousticWord } from './acoustic.ts';

/**
 * One sound, said two ways.
 *
 * The founder's Acoustic Precision panel, built from content that was already
 * written: the articulation cue is authored per phoneme, and the two words are
 * a minimal pair with its meaning on both sides. Every judgement is in
 * `myfrench/acoustic.ts`; this file lays it out and plays it.
 *
 * ## The two badges that are not here
 *
 * The mockup marked one word "Mastered" and the other "Contrast". Neither can
 * be earned: nothing in this app keeps a per-word pronunciation history, and a
 * badge in that slot would be a measurement invented to fill it. What the panel
 * says instead is what a minimal pair actually is, which is that these are two
 * different words and the difference is the sound.
 *
 * ## The voice has to be stopped
 *
 * `speak` calls `Speech.stop()` before it starts, so two Listens interrupt each
 * other, which is what a minimal pair wants. But nothing stops the last one
 * when the learner leaves, and a voice that follows somebody onto another tab
 * is F304. The cleanup below is the fix `FocusDrillPlayer` already carries.
 */
export function AcousticCard({ acoustic }: { acoustic: Acoustic }) {
  useEffect(() => () => tutorVoice.stop(), []);

  return (
    <View style={st.block}>
      <View style={st.headRow}>
        <View style={st.headWords}>
          <Label>{ACOUSTIC.label}</Label>
        </View>
        <View style={st.chip}>
          <Text style={[type.small, { color: paper.ink }]}>{ACOUSTIC.focusChip}</Text>
        </View>
      </View>

      <Card>
        <Text style={[type.title, { color: paper.ink }]}>{acoustic.heading}</Text>

        <TintPanel tint="lilac" style={st.cue}>
          <Text style={[type.small, { color: paper.ink }]}>
            <Text style={[type.bodyStrong, { color: paper.ink }]}>{ACOUSTIC.cueLabel}: </Text>
            {acoustic.cue}
          </Text>
          {acoustic.trick !== null && (
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{acoustic.trick}</Text>
          )}
        </TintPanel>

        {acoustic.pair !== null && (
          <View style={st.pair}>
            <Word word={acoustic.pair.a} tint="sage" />
            <Word word={acoustic.pair.b} tint="sand" />
          </View>
        )}

        {acoustic.why !== null && (
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(4) }]}>{acoustic.why}</Text>
        )}
      </Card>
    </View>
  );
}

/** One side of the pair: the word, how it is written in sound, what it means. */
function Word({ word, tint }: { word: AcousticWord; tint: 'sage' | 'sand' }) {
  return (
    <TintPanel tint={tint} style={st.word}>
      <Text style={[type.french, { color: paper.ink }]}>{word.word}</Text>
      <Text style={[type.notation, { color: paper.inkSoft }]}>[{word.ipa}]</Text>
      <Text style={[type.small, { color: paper.inkSoft }]}>{word.gloss}</Text>
      <Pressable
        onPress={() => tutorVoice.speak(word.word)}
        accessibilityRole="button"
        accessibilityLabel={`Hear ${word.word}`}
        style={({ pressed }) => [st.listen, pressed && { opacity: 0.6 }]}
      >
        <EarGlyph size={15} color={paper.ink} />
        <Text style={[type.small, { color: paper.ink }]}>{ACOUSTIC.listen}</Text>
      </Pressable>
    </TintPanel>
  );
}

const st = StyleSheet.create({
  block: { marginTop: space(6), gap: space(2) },
  headRow: { flexDirection: 'row', alignItems: 'baseline', gap: space(2) },
  headWords: { flex: 1, minWidth: 0 },
  chip: {
    paddingVertical: space(1),
    paddingHorizontal: space(2.5),
    borderRadius: radius.pill,
    backgroundColor: paper.groundDeep,
    flexShrink: 1,
    minWidth: 0,
  },
  cue: { marginTop: space(3), padding: space(3) },
  // Two words side by side, because a minimal pair is a comparison and a stack
  // is a list. They wrap rather than shrink at the largest reading size.
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(4) },
  word: { flexGrow: 1, flexBasis: 140, padding: space(3), gap: space(1) },
  listen: {
    marginTop: space(2),
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(1.5),
    borderRadius: radius.pill,
    backgroundColor: paper.card,
  },
});
