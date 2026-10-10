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
 * The centred cream onboarding frame carries the chosen tutor's name, the
 * scene's title and one usable line, with more examples available on demand.
 * A refusal shows the microphone illustration and leads with typing. Platform
 * back uses the existing navigation callback; there is no visible back control.
 * This primer follows completed onboarding, so its shared progress is complete.
 */

import { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, StyleSheet, Text, View } from 'react-native';
import { AudioModule } from 'expo-audio';
import { getMission, type MissionId } from '@luvani/core';

import { HAIRLINE, frenchText, paper, space, type } from '../theme.ts';
import { IconAction, Card, Label, MicGlyph, PillButton, canDoSentence } from '../components.tsx';
import { KeyboardGlyph } from '../glyphs.tsx';
import { Illustration } from '../art/flat/Illustration.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { tutorPersonaOf } from '../tutor/tutorName.ts';
import { PHONE_SETTINGS_AVAILABLE, openPhoneSettings } from '../settings/phoneSettings.ts';
import { OnboardingLayout } from './OnboardingLayout.tsx';
import { onboardingProgress } from './onboardingProgress.ts';

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
  const mounted = useRef(true);
  const operation = useRef(false);
  const moved = useRef(false);
  const generation = useRef(0);
  const back = useRef(onBack);
  back.current = onBack;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current += 1; };
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const navigation = BackHandler.addEventListener('hardwareBackPress', () => {
      if (moved.current) return true;
      moved.current = true;
      generation.current += 1;
      back.current();
      return true;
    });
    return () => navigation.remove();
  }, []);
  const persona = tutorPersonaOf(useProfile().profile);
  const mission = getMission(missionId);
  const view = primerView(phase, PHONE_SETTINGS_AVAILABLE);
  const refused = phase === 'refused';

  const ask = async () => {
    if (operation.current || moved.current) return;
    operation.current = true;
    const mine = generation.current;
    setPhase('asking');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!mounted.current || mine !== generation.current) return;
      if (AppState.currentState !== 'active' && Platform.OS !== 'web') { setPhase('ask'); return; }
      if (afterPermission(permission.granted) === 'start') {
        moved.current = true;
        setPhase('ask');
        onStart(false);
        return;
      }
      setPhase('refused');
    } catch {
      // A platform that cannot answer is treated as a refusal, which still
      // leaves typing one tap away rather than a button that does nothing.
      if (mounted.current && mine === generation.current) setPhase('refused');
    } finally {
      operation.current = false;
    }
  };

  const act = (what: PrimerAct) => {
    if (operation.current || moved.current) return;
    if (what === 'type') {
      moved.current = true;
      onStart(true);
      return;
    }
    if (what === 'settings') {
      operation.current = true;
      const mine = generation.current;
      void openPhoneSettings().then((outcome) => {
        if (!mounted.current || mine !== generation.current) return;
        // Back from the phone's settings, the one button asks again.
        if (outcome === 'done') {
          setSettingsNote(null);
          setPhase('ask');
        } else setSettingsNote(PRIMER_SETTINGS_FAILED);
      }).catch(() => {
        if (mounted.current && mine === generation.current) setSettingsNote(PRIMER_SETTINGS_FAILED);
      }).finally(() => { operation.current = false; });
      return;
    }
    void ask();
  };

  if (mission === undefined) return null;

  const lines = mission.referencePhrases.slice(0, 3);
  const typing = view.primary.act === 'type';

  return (
    <OnboardingLayout page="account-welcome" progress={onboardingProgress({ page: 'account-welcome', signedIn: true, complete: true })}
      footer={
        <View style={st.actions}>
          {!refused && <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>Start asks for microphone access. Live speaking and typing use live minutes.</Text>}
          <PillButton
            tone="ink"
            label={view.primary.label}
            icon={typing ? <KeyboardGlyph size={22} color={paper.onInk} /> : <MicGlyph size={22} color={paper.onInk} />}
            disabled={view.busy}
            onPress={() => act(view.primary.act)}
          />
          {view.secondary !== null && (
            <IconAction layout="inline" icon="keyboard"
              label={view.secondary.label}
              ground="paper"
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
          <Text accessibilityRole="header" style={[type.title, { color: paper.ink, textAlign: 'center' }]}>{mission.titleEn}</Text>
          <Text {...frenchText} style={[type.heading, { color: paper.ink, textAlign: 'center' }]}>{mission.title}</Text>
          <Text style={st.canDo}>{canDoSentence(mission.canDoEn)}</Text>
          {lines.length > 0 && (
            <Card style={st.lines}>
              <Label>One line to try</Label>
              {lines.slice(0, 1).map((line, at) => (
                <Text key={line} {...frenchText} style={[st.line, at > 0 && st.lineRuled]}>{line}</Text>
              ))}
              {lines.length > 1 && <IconAction layout="inline" icon="chevron-down" label={showMore ? 'Fewer examples' : 'More examples'} onPress={() => setShowMore((open) => !open)} />}
              {showMore && lines.slice(1).map((line) => <Text key={line} {...frenchText} style={st.line}>{line}</Text>)}
            </Card>
          )}
        </View>
      )}
    </OnboardingLayout>
  );
}

const st = StyleSheet.create({
  brief: { gap: space(2), paddingBottom: space(6) },
  meta: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
  canDo: { ...type.body, color: paper.ink, marginTop: space(1), textAlign: 'center' },
  lines: { gap: space(3), marginTop: space(3), marginBottom: space(2) },
  line: { ...type.french, color: paper.ink, textAlign: 'center' },
  lineRuled: { borderTopWidth: HAIRLINE, borderTopColor: paper.line, paddingTop: space(3) },
  refused: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space(3), paddingBottom: space(6) },
  refusedTitle: { ...type.title, color: paper.ink, textAlign: 'center', marginTop: space(2) },
  refusedNote: { ...type.body, color: paper.inkSoft, textAlign: 'center' },
  refusedSmall: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
  actions: { gap: space(2) },
});
