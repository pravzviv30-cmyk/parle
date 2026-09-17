/**
 * The moment a replay drill replays, above the exercise (F556, F582).
 *
 * A drill node carries an id, a title and phrase keys, so a replay used to
 * open on the exercise alone and the learner's own line was gone. The node
 * may carry the moment now, plain strings, and this draws it: what they said,
 * a better way, and why, so the verdict below reads as a comparison rather
 * than a mark. Every word is the pack's; nothing here decides anything.
 *
 * The better line has a speaker beside it. A learner reading two French
 * sentences to spot the difference is doing the wrong exercise: the difference
 * is audible before it is legible, and hearing it costs nothing — the voice is
 * the platform synthesizer, offline and free. It plays, and never records.
 *
 * It sits on the same sand the Practice row that opens it sits on, so the
 * moment looks like the thing the learner tapped rather than a new object.
 * `madeFromTint.ts` says which paper that is and `TintPanel` lays it, so this
 * file names a kind of practice and never a colour (palette.test.ts).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Label, TintPanel } from '../components.tsx';
import { SpeakerGlyph } from '../glyphs.tsx';
import { MADE_FROM } from '../practice/madeFrom.ts';
import { MADE_FROM_TINT } from '../practice/madeFromTint.ts';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { DISC, accent, paper, radius, shadow, space, type } from '../theme.ts';

export interface DrillMoment {
  quote: string;
  better: string;
  why: string;
}

export function MomentCard({ moment }: { moment: DrillMoment }) {
  return (
    <TintPanel tint={MADE_FROM_TINT.replay} style={st.card}>
      <Label>{MADE_FROM.replay.said}</Label>
      <Text style={st.quote}>« {moment.quote} »</Text>
      <Label>{MADE_FROM.replay.better}</Label>
      <View style={st.betterRow}>
        <Text style={st.better}>{moment.better}</Text>
        <Pressable
          onPress={() => tutorVoice.speak(moment.better)}
          accessibilityRole="button"
          accessibilityLabel={`Hear ${moment.better}`}
          style={({ pressed }) => [st.disc, pressed && { opacity: 0.6 }]}
        >
          <SpeakerGlyph size={24} color={accent.primary} />
        </Pressable>
      </View>
      <Text style={st.why}>{moment.why}</Text>
    </TintPanel>
  );
}

const st = StyleSheet.create({
  card: {
    marginBottom: space(4),
    borderRadius: radius.row,
    padding: space(4),
  },
  quote: { ...type.body, color: paper.inkSoft, marginTop: space(1), marginBottom: space(3) },
  betterRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(1) },
  better: { ...type.french, color: paper.ink, flex: 1 },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.card,
    ...shadow.whisper,
  },
  why: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
});
