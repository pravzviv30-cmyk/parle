/**
 * Tune the sound (F554, F558).
 *
 * The newest sound check, which measured the learner's own voice against a
 * known line, said as clarity rather than as a defect: the sound, its
 * authored cue and physical trick, the minimal pair that tells it from the
 * English sound it is not, and one outline to check it again. With no check
 * behind them the card says what the next situation will name, and offers the
 * way there. Nothing here scores anything, and nothing here calls an accent
 * wrong.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Card, GhostButton, Label, OutlineButton } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { MADE_FROM, type SoundToTune } from './madeFrom.ts';

export function TuneSoundCard({
  sound,
  onCheck,
  onChoose,
}: {
  sound: SoundToTune | null;
  onCheck: (missionId: string) => void;
  onChoose: () => void;
}) {
  return (
    <Card style={st.card}>
      <Label>{MADE_FROM.sound.label}</Label>
      {sound === null ? (
        <>
          <Text style={st.body}>{MADE_FROM.sound.none}</Text>
          <View style={st.action}>
            <GhostButton label={MADE_FROM.sound.go} color={paper.ink} onPress={onChoose} />
          </View>
        </>
      ) : (
        <>
          <Text style={st.heading}>{sound.acoustic.heading}</Text>
          <Text style={st.body}>{sound.acoustic.cue}</Text>
          {sound.acoustic.trick !== null && <Text style={st.trick}>{sound.acoustic.trick}</Text>}
          {sound.acoustic.pair !== null && (
            <Text style={st.pair}>
              {sound.acoustic.pair.a.word} · {sound.acoustic.pair.b.word}
            </Text>
          )}
          <View style={st.action}>
            <OutlineButton label={MADE_FROM.sound.check} onPress={() => onCheck(sound.missionId)} />
          </View>
        </>
      )}
    </Card>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(3) },
  heading: { ...type.title, color: paper.ink, marginTop: space(2) },
  body: { ...type.body, color: paper.ink, marginTop: space(2) },
  trick: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  pair: { ...type.french, color: paper.ink, marginTop: space(2) },
  action: { marginTop: space(4) },
});
