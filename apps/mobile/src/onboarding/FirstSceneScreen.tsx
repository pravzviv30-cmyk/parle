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
 * Drawn to the B-OB-FirstScene artboard (DECISIONS.md UI-008, 2026-10-21,
 * pinned light): a sun band with the café drawing carries the chosen tutor's
 * name, the scene's title in English and French and its stage; below it the
 * goal, one usable line with more examples on demand, and the microphone note.
 * A refusal shows the microphone illustration and leads with typing. Platform
 * back and the secondary "Look around first" (F915, 2026-10-29) both use the
 * existing navigation callback, which lands on Home and counts as leaving early.
 * This primer follows completed onboarding, so its shared progress is complete.
 */

import { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, StyleSheet, Text, View } from 'react-native';
import { AudioModule } from 'expo-audio';
import { getMission, type MissionId } from '@luvani/core';

import { HAIRLINE, frenchText, paper, space, type } from '../theme.ts';
import { IconAction, Press, Card, Label, MicGlyph, PillButton, canDoSentence } from '../components.tsx';
import { KeyboardGlyph } from '../glyphs.tsx';
import { Illustration } from '../art/flat/Illustration.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { tutorPersonaOf } from '../tutor/tutorName.ts';
import { PHONE_SETTINGS_AVAILABLE, openPhoneSettings } from '../settings/phoneSettings.ts';
import { OnboardingLayout } from './OnboardingLayout.tsx';
import { BArt } from '../art/BArt.tsx';
import { BBand, BBandPill, BCard, BMicThin } from './BOnboardingParts.tsx';
import { useB } from '../main/bTheme.tsx';
import { bType } from '../theme.ts';
import { onboardingProgress } from './onboardingProgress.ts';
import { stageOf } from '../scenes/scenePreview.ts';

import {
  PRIMER_META,
  PRIMER_SETTINGS_FAILED,
  LOOK_AROUND,
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
  /** Home without starting the scene: Android Back and "Look around first". */
  const leave = () => {
    if (moved.current) return;
    moved.current = true;
    generation.current += 1;
    back.current();
  };
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const navigation = BackHandler.addEventListener('hardwareBackPress', () => {
      leave();
      return true;
    });
    return () => navigation.remove();
  }, []);
  const t = useB();
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
      bleedTop={!refused} statusBar="dark"
      hero={refused ? undefined : (
        <BBand tone="sun" style={{ minHeight: 0 }} art={<BArt name="cafe-table" width={160} height={146} style={{ position: 'absolute', right: 21, top: 92 }} />}>
          <Text style={[bType.eyebrow, { color: t.text }]}>{PRIMER_META(persona.name)}</Text>
          <Text accessibilityRole="header" style={[type.title, { color: paper.ink, textAlign: 'center' }, st.bandTitle]}>{mission.titleEn}</Text>
          <Text {...frenchText} style={[type.heading, { color: paper.ink, textAlign: 'center' }, st.bandFrench]}>{mission.title}</Text>
          <View style={st.pills}><BBandPill label={stageOf({ kind: 'mission', cefr: mission.cefr })} /></View>
        </BBand>
      )}
      footer={
        <View style={st.actions}>
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
          <Press accessibilityLabel={LOOK_AROUND} onPress={leave} style={st.lookAround}><Text style={[bType.bold15, { color: t.link, textAlign: 'center' }]}>{LOOK_AROUND}</Text></Press>
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
          {/* 2026-10-21 UI-008, artboard B-OB-FirstScene: the goal card. */}
          <BCard style={{ gap: 4 }}>
            <Text style={[bType.eyebrow, { color: t.muted }]}>What you'll practise</Text>
            <Text style={[bType.bold18, { color: t.text }]}>{canDoSentence(mission.canDoEn)}</Text>
          </BCard>
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
          {/* The artboard's microphone note, with the pinned live-minutes line. */}
          <View style={[st.micNote, { backgroundColor: t.lavender }]}>
            <View style={[st.micDisc, { backgroundColor: t.card }]}><BMicThin size={20} color={t.text} /></View>
            <Text style={[bType.meta, { color: t.text, flex: 1 }]}>Start asks for microphone access. Live speaking and typing use live minutes.</Text>
          </View>
        </View>
      )}
    </OnboardingLayout>
  );
}

const st = StyleSheet.create({
  brief: { gap: 16, paddingTop: 22, paddingBottom: space(6) },
  bandTitle: { ...bType.title30, textAlign: 'left', maxWidth: '58%' },
  bandFrench: { ...bType.para17, fontStyle: 'italic', textAlign: 'left', maxWidth: '58%' },
  pills: { flexDirection: 'row', gap: 6, marginTop: 6 },
  lines: { gap: space(3) },
  line: { ...type.french, color: paper.ink },
  micNote: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16 },
  micDisc: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  lineRuled: { borderTopWidth: HAIRLINE, borderTopColor: paper.line, paddingTop: space(3) },
  refused: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space(3), paddingBottom: space(6) },
  refusedTitle: { ...type.title, color: paper.ink, textAlign: 'center', marginTop: space(2) },
  refusedNote: { ...type.body, color: paper.inkSoft, textAlign: 'center' },
  refusedSmall: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
  actions: { gap: space(2) },
  lookAround: { minHeight: 44, justifyContent: 'center' },
});
