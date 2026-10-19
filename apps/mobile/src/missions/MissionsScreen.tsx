/**
 * The chooser: six situations, one of them already picked, and the lesson.
 *
 * A stack screen, reached from three doors, because the same surface is needed
 * by a first run, by Home's hero and by the Tutor tab's everyday row. A first
 * run opens straight onto it, which is why the way out has to work even when
 * there is nothing behind this screen to go back to.
 *
 * One recommended mission leads, followed by a visible guided-pronunciation
 * alternative and five situation rows. Outcomes lead in English, with French
 * titles as supporting context. Speaking is the default; a quiet "Type instead"
 * sits under the one Start (2026-09-27, notebook Phase 3: the Speak/Type
 * segmented pill left), and a learner who arrived typing stays typing.
 *
 * Every rule on this page lives in `chooserView.ts`: which mission is first,
 * which one carries the solid pill, what each card says underneath, whether the
 * promise line is on screen at all, and what the lesson door says. What is left
 * here is layout, which is the only thing a file with no renderer behind it
 * should be holding.
 */

import { useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../nav/types.ts';
import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { missionStates, type MissionProgress } from '@luvani/core';
import { frenchText, space, type } from '../theme.ts';
import { Card } from '../components.tsx';
import { minutesLine, missionMinutes } from '../home/estimate.ts';
import { TYPE_INSTEAD } from '../tutor/speakView.ts';

import { Illustration } from '../art/flat/Illustration.tsx';
import { sceneIllustration } from '../art/flat/scenes.ts';
import { MainScreen, MainButton, MainRow } from '../main/MainUI.tsx';
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { useLive } from '../app/LiveContext.tsx';
import { lessonStart, TUTOR_OFFLINE } from '../tutor/gate.ts';
import { loadMissionCompletions } from './store.ts';
import { loadDeck } from '../review/store.ts';
import { loadActivity } from '../progress/activity.ts';
import { LESSON_DOOR, chooserView, hasSpokenBefore, missionCompletionsFrom, type ChooserCard } from './chooserView.ts';
import { trackProductEvent } from '../analytics/track.ts';
import { asSentences } from '../copy/spoken.ts';
import { ListeningPreview } from './ListeningPreview.tsx';
import { scopeGeneration } from '../storage/scope.ts';

export function MissionsScreen() {
  const nav = useNavigation<{
    setParams: (params: object) => void;
    goBack: () => void;
    canGoBack: () => boolean;
    navigate: (screen: string, params?: object) => void;
  }>();
  const { recheck } = useLive();
  const { colors } = useMainAppearance();

  const [progress, setProgress] = useState<readonly MissionProgress[] | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  const route = useRoute<RouteProp<RootStackParamList, 'Missions'>>();
  // The mode the learner arrived in. Speaking unless a door said typing.
  const typed = route.params?.textMode === true;
  const [spokenBefore, setSpokenBefore] = useState(true);
  const [showExamples, setShowExamples] = useState(false);
  useEffect(() => setShowExamples(false), [route.params?.focus]);
  /** A probe is in flight, so a tap on the lesson is never a dead press. */
  const [checking, setChecking] = useState(false);

  // Re-read on every return: a mission finished in the last ten minutes should
  // be reading as finished by the time the learner comes back to choose again.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const scope = scopeGeneration();
      setProgress(null);
      setReadFailed(false);
      void Promise.all([loadMissionCompletions(), loadDeck(), loadActivity({ strict: true })])
        .then(([completions, deck, activity]) => {
          if (cancelled || scopeGeneration() !== scope) return;
          setProgress(missionStates(missionCompletionsFrom(completions), deck, Date.now()));
          setSpokenBefore(hasSpokenBefore(activity));
        })
        .catch(() => { if (!cancelled && scopeGeneration() === scope) setReadFailed(true); });
      return () => {
        cancelled = true;
      };
    }, [readAttempt]),
  );

  // A first run opens ON this screen, so there is nothing behind it to go back
  // to. Falling through to the tabs is the difference between a way out and a
  // dead end on the very first screen after signing up.
  const leave = () => {
    if (route.params?.focus) { nav.setParams({ focus: undefined }); return; }
    if (nav.canGoBack()) nav.goBack();
    else nav.navigate('Tabs');
  };

  const open = (card: ChooserCard, textMode = typed) => {
    void trackProductEvent({ name: 'mission_started', properties: { missionId: card.mission.id, entry: 'chooser' } });
    nav.navigate(card.route.screen, { ...card.route.params, textMode });
  };

  /** The live lesson route owns the gate and offers genuine local practice offline. */
  const openLesson = (textMode: boolean) => {
    if (checking) return;
    setChecking(true);
    const go = () => {
      setChecking(false);
      const start = lessonStart(textMode);
      nav.navigate(start.screen, start.params);
    };
    void recheck().then(go, go);
  };

  // Nothing has come back from the disk yet. The catalogue is fixed, so this is
  // one frame at most and drawing a spinner for it would flash.
  // `focus` is the mission a door on the previous screen already named. It
  // outranks the screen's own suggestion, so what was offered is what opens.
  const focus = route.params?.focus ?? null;
  const view = chooserView({ progress: progress ?? missionStates([], [], Date.now()), spokenBefore, focus });
  const [first, ...rest] = view.cards;

  if (progress === null) return <MainScreen title="Scenes" onBack={leave}>
    <Text style={[type.body, { color: colors.muted }]}>{readFailed ? 'Your scene history could not be read just now.' : 'Finding your scenes.'}</Text>
    {readFailed && <MainButton tone="quiet" label="Try loading scenes again" onPress={() => setReadAttempt((n) => n + 1)} />}
  </MainScreen>;
  if (focus && first) {
    return (
      <MainScreen title={first.mission.titleEn} onBack={leave}
        footer={<View style={{ gap: space(2) }}>
          <Text style={[type.small, { color: colors.muted }]}>Start speaking asks for microphone access. Speaking and typing use live minutes while the room is open.</Text>
          <MainButton tone="gold" label={typed ? 'Start typing' : 'Start speaking'} onPress={() => open(first)} />
          {!typed && <MainButton tone="quiet" label={TYPE_INSTEAD} onPress={() => open(first, true)} />}
        </View>}>
        <View style={{ gap: space(3), paddingBottom: space(4) }}>
          <Text {...frenchText} style={[type.french, { color: colors.text }]}>{first.mission.title}</Text>
          <Text style={[type.body, { color: colors.text }]}>{first.mission.canDoEn}</Text>
          {first.status !== 'New' && <Text style={[type.small, { color: colors.muted }]}>{first.status}</Text>}
          <Card style={{ gap: space(3), backgroundColor: colors.surface }}>
            <Text accessibilityRole="header" style={[type.heading, { color: colors.text }]}>One line to try</Text>
            {first.mission.referencePhrases.slice(0, 1).map((line) => <Text key={line} {...frenchText} style={[type.french, { color: colors.text }]}>{line}</Text>)}
            {first.mission.referencePhrases.length > 1 && <MainButton tone="quiet" label={showExamples ? 'Fewer examples' : 'More examples'} onPress={() => setShowExamples((open) => !open)} />}
            {showExamples && first.mission.referencePhrases.slice(1).map((line) => <Text key={line} {...frenchText} style={[type.french, { color: colors.text }]}>{line}</Text>)}
            <ListeningPreview selection={{ kind: 'mission', mission: first.mission }} presentation={{ ink: colors.text, muted: colors.muted }} />
          </Card>
          <Illustration name={sceneIllustration(first.mission.id)} fit="small" style={{ alignSelf: 'center' }} />
          <Text style={[type.small, { color: colors.muted }]}>{first.mission.cefr} scene</Text>
        </View>
      </MainScreen>
    );
  }
  return (
    <MainScreen title="Scenes" onBack={leave}>
      <Text style={[type.body, { color: colors.muted }]}>{view.sub}</Text>
      {view.promise !== null && <Text style={[type.small, { color: colors.text }]}>{view.promise}</Text>}
      <Text style={[type.small, { color: colors.muted }]}>{view.access}</Text>
      {(['A0', 'A1'] as const).map((level) => <View key={level} style={st.rows}>
        <Text accessibilityRole="header" style={[type.heading, { color: colors.text }]}>{level}</Text>
        {view.cards.filter((card) => card.mission.cefr === level).map((card) => <MainRow
          key={card.id} title={card.mission.titleEn}
          detail={asSentences([card.mission.title, card.status, minutesLine(missionMinutes(card.mission))])}
          onPress={() => nav.setParams({ focus: card.mission.id, textMode: typed })}
        />)}
      </View>)}
      <View style={st.footer}>
        <Text style={[type.small, { color: colors.muted }]}>{LESSON_DOOR.minutes}</Text>
        <MainButton tone="quiet" label={LESSON_DOOR.title} accessibilityLabel={`${LESSON_DOOR.title}. ${LESSON_DOOR.minutes}`} disabled={checking} onPress={() => openLesson(typed)} />
        <MainButton tone="quiet" label={LESSON_DOOR.quiet} accessibilityLabel={`${LESSON_DOOR.quiet}. ${LESSON_DOOR.minutes}`} disabled={checking} onPress={() => openLesson(true)} />
        <MainButton tone="quiet" label={view.talkFreely} disabled={checking} onPress={() => nav.navigate('Convo', { textMode: typed })} />
        {checking && <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.muted }]}>{TUTOR_OFFLINE.checking}</Text>}
      </View>
    </MainScreen>
  );
}

const st = StyleSheet.create({
  rows: { gap: space(2) },
  footer: { gap: space(2) },
});
