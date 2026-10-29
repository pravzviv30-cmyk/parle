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
 * Notebook Phase 4 (2026-09-27): one white `Card`, no tint and no shadow. The
 * speaker is a white disc under a paper hairline, which is what tells it from
 * the card now that the whisper has retired.
 *
 * 2026-10-21 UI-008: drawn from the theme, so the card follows dark on the Drill.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Label } from '../components.tsx';
import { SpeakerGlyph } from '../glyphs.tsx';
import { MADE_FROM } from '../practice/madeFrom.ts';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { DISC, HAIRLINE, space, type } from '../theme.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';

export interface DrillMoment {
  quote: string;
  better: string;
  why: string;
}

export function MomentCard({ moment }: { moment: DrillMoment }) {
  const t = useB();
  const st = useThemedStyles(makeStyles);
  return (
    <Card style={st.card}>
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
          <SpeakerGlyph size={24} color={t.text} />
        </Pressable>
      </View>
      <Text style={st.why}>{moment.why}</Text>
    </Card>
  );
}

function makeStyles(t: B) {
  return StyleSheet.create({
  card: { marginBottom: space(4) },
  quote: { ...type.body, color: t.muted, marginTop: space(1), marginBottom: space(3) },
  betterRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(1) },
  better: { ...type.french, color: t.text, flex: 1 },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.card,
    borderWidth: HAIRLINE,
    borderColor: t.field,
  },
  why: { ...type.small, color: t.muted, marginTop: space(2) },
});
}
