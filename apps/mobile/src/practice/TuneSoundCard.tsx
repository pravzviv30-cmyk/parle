/** One evidence-bounded sound example. Word and cue lead; symbol and exact
 * mapped mouth guide are disclosed on request. Playback is a bundled line in
 * the chosen voice, when one exists. This card does not assess pronunciation. */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, GhostButton, Label } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
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
          <GhostButton label={SOUND_LEAD.check} color={paper.ink} onPress={() => onCheck(measured.missionId)} />
        </View>
      )}
      {native !== null && (
        <View style={st.group}>
          <Text style={st.line}>{native.fr}</Text>
          <Text style={st.quiet}>{native.label}</Text>
          <GhostButton
            label={playing === native.asset ? SOUND_LEAD.stop : SOUND_LEAD.hear}
            color={paper.ink}
            accessibilityLabel={playing === native.asset ? SOUND_LEAD.stop : `Hear ${native.fr}. ${native.label}`}
            onPress={() => onHear(native.asset)}
          />
        </View>
      )}
      {native === null && <Text style={st.quiet}>{SOUND_LEAD.noAudio}</Text>}
      <GhostButton label={details ? 'Hide sound guide' : 'See sound guide and symbol'} color={paper.ink} onPress={() => setDetails(value => !value)} />
      {details && <View style={st.group}>
        <Text style={st.quiet}>Sound symbol: /{lead.ipa}/</Text>
        <MouthGuide ipa={lead.ipa} />
      </View>}
    </Card>
  );
}

const st = StyleSheet.create({
  card: { gap: space(3) },
  cue: { ...type.body, color: paper.ink },
  quiet: { ...type.small, color: paper.inkSoft },
  word: { ...type.frenchLg, color: paper.ink },
  fact: { ...type.small, color: paper.ink },
  line: { ...type.frenchSm, color: paper.ink },
  group: { gap: space(1) },
});
