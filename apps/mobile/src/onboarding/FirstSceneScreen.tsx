/**
 * The first scene, with a microphone primer in front of it (notebook Phase 5).
 *
 * Where a brand-new account lands: the scene the plan put first, its can-do
 * and its lines, one button that raises the OS microphone prompt, and "Type
 * instead" always there. Only the button asks; nothing asks on arrival. A
 * granted microphone opens the ordinary conversation route with the mission,
 * so nothing about the live session changes here. A refusal leads with typing
 * and offers the phone's settings second where there are any. The decisions
 * live in `micPrimer.ts`, where a test can ask them.
 *
 * Revamp B (F601): the brief is a whole blue page, not a card on paper. The
 * tutor's name, the scene's French title, what the learner will be able to
 * do, how long it takes, and a white card of the three lines they will say.
 * A refusal turns the page to paper, with the microphone drawing, a title, and
 * typing first. One header, one pill: the pill's words, tone and mark follow
 * the phase, so the brief and the refusal are one screen with one way back.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AudioModule } from 'expo-audio';
import { getMission, type MissionId } from '@luvani/core';

import { HAIRLINE, colour, frenchText, onColour, paper, space, textOn, type } from '../theme.ts';
import { Card, GhostButton, Label, MicGlyph, PillButton, canDoSentence } from '../components.tsx';
import { KeyboardGlyph } from '../glyphs.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { Illustration } from '../art/flat/Illustration.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { tutorPersonaOf } from '../tutor/tutorName.ts';
import { PHONE_SETTINGS_AVAILABLE, openPhoneSettings } from '../settings/phoneSettings.ts';

import {
  PRIMER_META,
  PRIMER_SETTINGS_FAILED,
  afterPermission,
  primerView,
  type PrimerAct,
  type PrimerPhase,
} from './micPrimer.ts';

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
  const [showMore, setShowMore] = useState(false);
  const persona = tutorPersonaOf(useProfile().profile);
  const mission = getMission(missionId);
  const view = primerView(phase, PHONE_SETTINGS_AVAILABLE);
  const refused = phase === 'refused';

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
        if (outcome === 'done') {
          setSettingsNote(null);
          setPhase('ask');
        } else setSettingsNote(PRIMER_SETTINGS_FAILED);
      });
      return;
    }
    void ask();
  };

  if (mission === undefined) return null;

  const lines = mission.referencePhrases.slice(0, 3);
  const typing = view.primary.act === 'type';

  return (
    <ScrollScreen
      ground={refused ? paper.ground : colour.blue}
      header={<ScreenHeader title={false} divider={false} back={{ onPress: onBack }} />}
      footer={
        <View style={st.actions}>
          {!refused && <Text style={[type.small, { color: paper.onInk }]}>Start asks for microphone access. Live speaking and typing use live minutes.</Text>}
          <PillButton
            tone={refused ? 'ink' : 'white'}
            label={view.primary.label}
            icon={typing ? <KeyboardGlyph size={22} color={paper.onInk} /> : <MicGlyph size={22} color={paper.ink} />}
            disabled={view.busy}
            onPress={() => act(view.primary.act)}
          />
          {view.secondary !== null && (
            <GhostButton
              label={view.secondary.label}
              color={refused ? paper.ink : paper.onInk}
              onPress={() => act(view.secondary!.act)}
            />
          )}
        </View>
      }
    >
      {refused ? (
        <View style={st.refused}>
          <Illustration name="state-microphone" fit="small" />
          <Text accessibilityRole="header" style={st.refusedTitle}>{view.title}</Text>
          <Text style={st.refusedNote}>{view.note}</Text>
          {view.how !== null && <Text style={st.refusedSmall}>{view.how}</Text>}
          {settingsNote !== null && (
            <Text accessibilityLiveRegion="polite" style={st.refusedSmall}>{settingsNote}</Text>
          )}
        </View>
      ) : (
        <View style={st.brief}>
          <Text style={st.meta}>{PRIMER_META(persona.name)}</Text>
          <Text accessibilityRole="header" style={[type.title, { color: paper.onInk }]}>{mission.titleEn}</Text>
          <Text {...frenchText} style={[type.heading, { color: textOn.blue }]}>{mission.title}</Text>
          <Text style={st.canDo}>{canDoSentence(mission.canDoEn)}</Text>
          {lines.length > 0 && (
            <Card style={st.lines}>
              <Label>One line to try</Label>
              {lines.slice(0, 1).map((line, at) => (
                <Text key={line} {...frenchText} style={[st.line, at > 0 && st.lineRuled]}>{line}</Text>
              ))}
              {lines.length > 1 && <GhostButton label={showMore ? 'Fewer examples' : 'More examples'} onPress={() => setShowMore((open) => !open)} />}
              {showMore && lines.slice(1).map((line) => <Text key={line} {...frenchText} style={st.line}>{line}</Text>)}
            </Card>
          )}
        </View>
      )}
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  brief: { gap: space(2), paddingBottom: space(6) },
  meta: { ...type.small, color: onColour.blue },
  title: { ...type.display, color: textOn.blue },
  english: { ...type.body, color: onColour.blue },
  canDo: { ...type.body, color: textOn.blue, marginTop: space(1) },
  lines: { gap: space(3), marginTop: space(3), marginBottom: space(2) },
  line: { ...type.french, color: paper.ink },
  lineRuled: { borderTopWidth: HAIRLINE, borderTopColor: paper.line, paddingTop: space(3) },
  refused: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space(3), paddingBottom: space(6) },
  refusedTitle: { ...type.title, color: paper.ink, textAlign: 'center', marginTop: space(2) },
  refusedNote: { ...type.body, color: paper.inkSoft, textAlign: 'center' },
  refusedSmall: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
  actions: { gap: space(2) },
});
