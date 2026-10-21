/** One evidence-bounded sound example. Word and cue lead; symbol and exact
 * mapped mouth guide are disclosed on request. Playback is a bundled line in
 * the chosen voice, when one exists. This card does not assess pronunciation. */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { IconAction, IconButton, Card, GhostButton, Label } from '../components.tsx';
import { space, type } from '../theme.ts';
import { useThemedStyles, type B } from '../main/bTheme.tsx';
import { MouthGuide } from './MouthGuide.tsx';
import { SOUND_LEAD, type SoundLead } from './soundLead.ts';

export function TuneSoundCard({
  lead,
  playing,
  onHear,
  onCheck,
}: {
  lead: SoundLead;
  /** The recording playing now, so the control can offer Stop. */
  playing: number | null;
  /** Play or stop a bundled recording. Never device speech. */
  onHear: (asset: number) => void;
  /** Open the sound check for the situation the sound was measured in. */
  onCheck: (missionId: string) => void;
}) {
  const { measured, native } = lead;
  const [details, setDetails] = useState(false);
  const st = useThemedStyles(makeStyles);
  return (
    <Card style={st.card}>
      <Label>{measured === null ? SOUND_LEAD.starterLabel : SOUND_LEAD.measuredLabel}</Label>
      <Text style={st.word}>{lead.example}</Text>
      <Text style={st.cue}>{lead.cue}</Text>
      {lead.source !== null && <Text style={st.quiet}>{lead.source}</Text>}
      <Text style={st.quiet}>{measured === null ? SOUND_LEAD.unassessed : SOUND_LEAD.measuredScope}</Text>
      {measured !== null && (
        <View style={st.group}>
          <Text style={st.fact}>{measured.line}</Text>
          <IconAction layout="inline" icon="microphone" label={SOUND_LEAD.check}  onPress={() => onCheck(measured.missionId)} />
        </View>
      )}
      {native !== null && (
        <View style={st.group}>
          <Text style={st.line}>{native.fr}</Text>
          <Text style={st.quiet}>{native.label}</Text>
          <IconButton icon="speaker"
            label={playing === native.asset ? SOUND_LEAD.stop : SOUND_LEAD.hear}

            accessibilityLabel={playing === native.asset ? SOUND_LEAD.stop : `Hear ${native.fr}. ${native.label}`}
            onPress={() => onHear(native.asset)}
          />
        </View>
      )}
      {native === null && <Text style={st.quiet}>{SOUND_LEAD.noAudio}</Text>}
      <IconAction layout="inline" icon="chevron-down" label={details ? 'Hide sound guide' : 'See sound guide and symbol'}  onPress={() => setDetails(value => !value)} />
      {details && <View style={st.group}>
        <Text style={st.quiet}>Sound symbol: /{lead.ipa}/</Text>
        <MouthGuide ipa={lead.ipa} />
      </View>}
    </Card>
  );
}

// 2026-10-21 UI-008: theme tokens, so the card reads in dark; b.light equals the old paper values.
const makeStyles = (t: B) => StyleSheet.create({
  card: { gap: space(3) },
  cue: { ...type.body, color: t.text },
  quiet: { ...type.small, color: t.muted },
  word: { ...type.frenchLg, color: t.text },
  fact: { ...type.small, color: t.text },
  line: { ...type.frenchSm, color: t.text },
  group: { gap: space(1) },
});
