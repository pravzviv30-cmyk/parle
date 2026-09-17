import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, EarGlyph, Label } from '../components.tsx';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { accent, paper, radius, space, type, HAIRLINE, HIT } from '../theme.ts';
import { ACOUSTIC, type Acoustic, type AcousticWord } from './acoustic.ts';

/**
 * One sound, said two ways.
 *
 * The founder's Acoustic Precision panel, built from content that was already
 * written: the articulation cue is authored per phoneme, and the two words are
 * a minimal pair with its meaning on both sides. Every judgement is in
 * `myfrench/acoustic.ts`; this file lays it out and plays it.
 *
 * ## Where it is drawn, since revamp A
 *
 * At the head of the sound check, above the line to say, rather than partway
 * down My French. It is instructions for a thing the learner is about to do,
 * and instructions two taps away from the doing are a leaflet. Which sound it
 * is about is `soundcheck/headSound.ts`; nothing about the panel itself moved.
 *
 * ## The two badges that are not here
 *
 * The mockup marked one word "Mastered" and the other "Contrast". Neither can
 * be earned: nothing in this app keeps a per-word pronunciation history, and a
 * badge in that slot would be a measurement invented to fill it. What the panel
 * says instead is what a minimal pair actually is, which is that these are two
 * different words and the difference is the sound.
 *
 * ## The pair are controls now, not panels
 *
 * They used to be two tinted blocks with a Listen under each. A tint is a
 * surface for a place or a kind of practice, and these are neither; what they
 * are is two buttons that play a word. So they are drawn as the app's quiet
 * outline control with the speaker on it, which is what they always did.
 *
 * ## The voice has to be stopped
 *
 * `speak` calls `Speech.stop()` before it starts, so two Listens interrupt each
 * other, which is what a minimal pair wants. But nothing stops the last one
 * when the learner leaves, and a voice that follows somebody onto another
 * screen is F304. The cleanup below is the fix `FocusDrillPlayer` carries too.
 */
export function AcousticCard({ acoustic }: { acoustic: Acoustic }) {
  useEffect(() => () => tutorVoice.stop(), []);

  return (
    <Card style={st.card}>
      <Label>{ACOUSTIC.label}</Label>
      <Text style={[type.title, { color: paper.ink }]}>{acoustic.heading}</Text>

      {/* The cue and the trick are two plain sentences, not a tinted aside.
          They are the instruction, which is the whole point of the panel, and
          an instruction set apart on a colour reads as a footnote. */}
      <Text style={[type.body, { color: paper.inkSoft }]}>
        <Text style={[type.bodyStrong, { color: paper.ink }]}>{ACOUSTIC.cueLabel}: </Text>
        {acoustic.cue}
      </Text>
      {acoustic.trick !== null && <Text style={[type.body, { color: paper.inkSoft }]}>{acoustic.trick}</Text>}

      {acoustic.pair !== null && (
        <View style={st.pair}>
          <Word word={acoustic.pair.a} />
          <Word word={acoustic.pair.b} />
        </View>
      )}

      {acoustic.why !== null && <Text style={[type.small, { color: paper.inkSoft }]}>{acoustic.why}</Text>}
    </Card>
  );
}

/** One side of the pair: press it and hear the word, with its sound and meaning under it. */
function Word({ word }: { word: AcousticWord }) {
  return (
    <Pressable
      onPress={() => tutorVoice.speak(word.word)}
      accessibilityRole="button"
      accessibilityLabel={`Hear ${word.word}, ${word.gloss}`}
      style={({ pressed }) => [st.word, pressed && st.wordPressed]}
    >
      <View style={st.wordHead}>
        <EarGlyph size={18} color={accent.primary} />
        <Text style={[type.french, { color: paper.ink }]}>{word.word}</Text>
      </View>
      <Text style={[type.notation, { color: paper.inkSoft }]}>[{word.ipa}]</Text>
      <Text style={[type.small, { color: paper.inkSoft }]}>{word.gloss}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  card: { gap: space(2.5) },
  // Two words side by side, because a minimal pair is a comparison and a stack
  // is a list. They wrap rather than shrink at the largest reading size.
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(1) },
  word: {
    flexGrow: 1,
    flexBasis: 130,
    minHeight: HIT,
    gap: space(1),
    paddingVertical: space(2.5),
    paddingHorizontal: space(3.5),
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.row,
    backgroundColor: paper.card,
  },
  wordPressed: { backgroundColor: paper.groundDeep },
  wordHead: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
});
