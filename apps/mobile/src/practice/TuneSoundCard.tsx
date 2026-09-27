/**
 * "Your sound to tune": the block Practice leads with (notebook Phase 3,
 * 2026-09-27; it replaces the tinted "Tune one sound" row, F554, F558).
 *
 * One sound, named by its symbol and an example word through the shared
 * `SoundTag`, the inventory's mouth cue under it, and only then whatever else
 * is true of it:
 *
 * - a measured line and a way back to the check, only when a check the assessor
 *   actually measured named this sound;
 * - a bundled recording that says the example word, labelled as a recording,
 *   only when one exists in the learner's chosen voice. The card plays nothing
 *   itself: the tab's recorded player does, and it never falls back to the
 *   phone's synthesiser;
 * - the day-one action, handed in by the tab as `control`, so the page's one
 *   pill is built once and drawn once.
 *
 * Nothing here records, listens or scores, and there is no learner recording to
 * play, because the app keeps none. Every word is `soundLead.ts`'s.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, GhostButton, Label, SoundTag } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { SOUND_LEAD, type SoundLead } from './soundLead.ts';

export function TuneSoundCard({
  lead,
  playing,
  onHear,
  onCheck,
  control,
}: {
  lead: SoundLead;
  /** The recording playing now, so the control can offer Stop. */
  playing: number | null;
  /** Play or stop a bundled recording. Never device speech. */
  onHear: (asset: number) => void;
  /** Open the sound check for the situation the sound was measured in. */
  onCheck: (missionId: string) => void;
  /** The page's one primary action, on day one only. */
  control?: ReactNode;
}) {
  const { measured, native } = lead;
  return (
    <Card style={st.card}>
      <Label>{SOUND_LEAD.label}</Label>
      <SoundTag ipa={`/${lead.ipa}/`} example={lead.example} />
      <Text style={st.cue}>{lead.cue}</Text>
      {lead.source !== null && <Text style={st.quiet}>{lead.source}</Text>}
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
      {control != null && <View style={st.control}>{control}</View>}
    </Card>
  );
}

const st = StyleSheet.create({
  card: { gap: space(3) },
  cue: { ...type.body, color: paper.ink },
  quiet: { ...type.small, color: paper.inkSoft },
  fact: { ...type.small, color: paper.ink },
  line: { ...type.frenchSm, color: paper.ink },
  group: { gap: space(1) },
  control: { marginTop: space(1) },
});
