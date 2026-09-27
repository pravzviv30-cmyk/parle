/**
 * The first scene, with a microphone primer in front of it (notebook Phase 5).
 *
 * Where a brand-new account lands: the scene the plan put first, its can-do
 * and its lines, one button that raises the OS microphone prompt, and "Type
 * instead" always there. Only the button asks; nothing asks on arrival. A
 * granted microphone opens the ordinary conversation route with the mission,
 * so nothing about the live session changes here. A refusal offers the phone's
 * settings where there are any, plus typing. The decisions live in
 * `micPrimer.ts`, where a test can ask them.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AudioModule } from 'expo-audio';
import { getMission, type MissionId } from '@luvani/core';

import { paper, space } from '../theme.ts';
import { GhostButton, PillButton, SceneBrief } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { PHONE_SETTINGS_AVAILABLE, openPhoneSettings } from '../settings/phoneSettings.ts';
import { minutesLine, missionMinutes } from '../home/estimate.ts';
import { PRIMER_LABEL, PRIMER_SETTINGS_FAILED, afterPermission, primerView, type PrimerAct, type PrimerPhase } from './micPrimer.ts';

export function FirstSceneScreen({
  missionId,
  onStart,
  onBack,
}: {
  missionId: MissionId;
  /** Open the scene through the ordinary conversation route. */
  onStart: (textMode: boolean) => void;
  onBack: () => void;
}) {
  const [phase, setPhase] = useState<PrimerPhase>('ask');
  const [settingsNote, setSettingsNote] = useState<string | null>(null);
  const mission = getMission(missionId);
  const view = primerView(phase, PHONE_SETTINGS_AVAILABLE);

  const ask = async () => {
    if (phase === 'asking') return;
    setPhase('asking');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (afterPermission(permission.granted) === 'start') {
        setPhase('ask');
        onStart(false);
        return;
      }
      setPhase('refused');
    } catch {
      // A platform that cannot answer is treated as a refusal, which still
      // leaves typing one tap away rather than a button that does nothing.
      setPhase('refused');
    }
  };

  const act = (what: PrimerAct) => {
    if (what === 'type') {
      onStart(true);
      return;
    }
    if (what === 'settings') {
      void openPhoneSettings().then((outcome) => {
        // Back from the phone's settings, the one button asks again.
        if (outcome === 'done') setPhase('ask');
        else setSettingsNote(PRIMER_SETTINGS_FAILED);
      });
      return;
    }
    void ask();
  };

  if (mission === undefined) return null;

  return (
    <ScrollScreen header={<ScreenHeader divider={false} back={{ onPress: onBack }} />}>
      <SceneBrief
        level={mission.cefr}
        label={PRIMER_LABEL}
        title={mission.titleEn}
        french={mission.title}
        canDo={mission.canDoEn}
        lines={mission.referencePhrases.slice(0, 3)}
        minutes={minutesLine(missionMinutes(mission))}
        reason={settingsNote ?? view.note}
        action={
          <View style={st.action}>
            <PillButton label={view.primary.label} disabled={view.busy} onPress={() => act(view.primary.act)} />
          </View>
        }
        secondary={
          view.secondary === null ? undefined : (
            <GhostButton label={view.secondary.label} color={paper.ink} onPress={() => act(view.secondary!.act)} />
          )
        }
      />
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  action: { marginTop: space(2) },
});
