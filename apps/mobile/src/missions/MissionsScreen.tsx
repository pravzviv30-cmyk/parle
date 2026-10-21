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
import { earnedMissionIds, missionStates, type MissionProgress } from '@luvani/core';
import { colour, frenchText, paper, space, type } from '../theme.ts';
import { IconActionRow, IconAction, Card, GhostButton, Ledger, LedgerRow, PillButton, SceneMark } from '../components.tsx';
import { minutesLine, missionMinutes } from '../home/estimate.ts';
import { TYPE_INSTEAD } from '../tutor/speakView.ts';

import { Illustration } from '../art/flat/Illustration.tsx';
import { sceneIllustration } from '../art/flat/scenes.ts';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
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
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';

export function MissionsScreen() {
  const t = useB();
  const st = useThemedStyles(makeSt);
  const nav = useNavigation<{
    setParams: (params: object) => void;
    goBack: () => void;
    canGoBack: () => boolean;
    navigate: (screen: string, params?: object) => void;
  }>();
  const { recheck } = useLive();

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

  const header = <ScreenHeader back={{ onPress: leave }} title={focus ? undefined : "Scenes"} ground={focus && progress !== null && first ? 'blue' : 'paper'} />;
  if (progress === null) return <ScrollScreen header={header}><View style={st.scroll}>
    <Text style={st.sub}>{readFailed ? 'Your scene history could not be read just now.' : 'Finding your scenes.'}</Text>
    {readFailed && <IconAction layout="inline" icon="refresh" label="Try loading scenes again" onPress={() => setReadAttempt((n) => n + 1)} />}
  </View></ScrollScreen>;
  if (focus && first) {
    return (
      <ScrollScreen ground={colour.blue} header={header}
        footer={<View style={{ gap: space(2) }}>
          <Text style={[type.small, { color: paper.onInk }]}>Start speaking asks for microphone access. Speaking and typing use live minutes while the room is open.</Text>
          <PillButton tone="white" label={typed ? 'Start typing' : 'Start speaking'} onPress={() => open(first)} />
          {!typed && <IconAction layout="inline" icon="keyboard" label={TYPE_INSTEAD} ground="blue" onPress={() => open(first, true)} />}
        </View>}>
        <View style={{ gap: space(3), paddingTop: space(3), paddingBottom: space(4) }}>
          <Text {...frenchText} style={[type.french, { color: paper.onInk }]}>{first.mission.title}</Text>
          <Text accessibilityRole="header" style={[type.heading, { color: paper.onInk }]}>{first.mission.titleEn}</Text>
          <Text style={[type.body, { color: paper.onInk }]}>{first.mission.canDoEn}</Text>
          {first.status !== 'New' && <Text style={[type.small, { color: paper.onInk }]}>{first.status}</Text>}
          <Card style={{ gap: space(3) }}>
            <Text accessibilityRole="header" style={[type.heading, { color: t.text }]}>One line to try</Text>
            {first.mission.referencePhrases.slice(0, 1).map((line) => <Text key={line} {...frenchText} style={[type.french, { color: t.text }]}>{line}</Text>)}
            {first.mission.referencePhrases.length > 1 && <IconAction layout="inline" icon="chevron-down" label={showExamples ? 'Fewer examples' : 'More examples'} onPress={() => setShowExamples((open) => !open)} />}
            {showExamples && first.mission.referencePhrases.slice(1).map((line) => <Text key={line} {...frenchText} style={[type.french, { color: t.text }]}>{line}</Text>)}
            <ListeningPreview selection={{ kind: 'mission', mission: first.mission }} />
          </Card>
          <Illustration name={sceneIllustration(first.mission.id)} fit="small" style={{ alignSelf: 'center' }} />
          <Text style={[type.small, { color: paper.onInk }]}>{first.mission.cefr} scene</Text>
        </View>
      </ScrollScreen>
    );
  }
  return (
    <ScrollScreen header={header}>
      <View style={st.scroll}>
        <Text style={st.sub}>{view.sub}</Text>
        {view.promise !== null && <Text style={st.promise}>{view.promise}</Text>}
        <Text style={st.access}>{view.access}</Text>
        {(['A0', 'A1'] as const).map((level) => <View key={level} style={st.rows}>
          <Text accessibilityRole="header" style={[type.heading, { color: t.text }]}>{level}</Text>
          <Ledger accessibilityLabel={`${level} scenes`}>
            {view.cards.filter((card) => card.mission.cefr === level).map((card) => <LedgerRow
              key={card.id} glyph={<SceneMark state={earnedMissionIds(progress ?? []).has(card.mission.id) ? 'earned' : card.primary ? 'here' : 'ahead'} />}
              title={card.mission.titleEn} gloss={`${card.mission.title}. ${card.status}`} meta={minutesLine(missionMinutes(card.mission))}
              accessibilityLabel={asSentences([card.mission.title, card.mission.titleEn, card.status])}
              onPress={() => nav.setParams({ focus: card.mission.id, textMode: typed })}
            />)}
          </Ledger>
        </View>)}
        <View style={st.footer}>
          <IconActionRow>
          <IconAction layout="tile" icon="book" label={LESSON_DOOR.title} disabled={checking} onPress={() => openLesson(typed)} />
          <IconAction layout="tile" icon="keyboard" label={LESSON_DOOR.quiet} accessibilityLabel={`${LESSON_DOOR.quiet}. ${LESSON_DOOR.minutes}`} disabled={checking} onPress={() => openLesson(true)} />
          <IconAction layout="tile" icon="chat" label={view.talkFreely} disabled={checking} onPress={() => nav.navigate('Convo', { textMode: typed })} />
          </IconActionRow>
          <Text style={[type.small, { color: t.muted }]}>{LESSON_DOOR.minutes}</Text>
          {checking && <Text accessibilityLiveRegion="polite" style={st.checking}>{TUTOR_OFFLINE.checking}</Text>}
        </View>
      </View>
    </ScrollScreen>
  );
}

function makeSt(t: B) {
  return StyleSheet.create({
  warmup: { marginTop: space(4), gap: space(3) },
  scroll: { paddingTop: space(2), paddingBottom: space(6) },
  headline: { ...type.display, color: t.text },
  sub: { ...type.body, color: t.muted, marginTop: space(2) },
  promise: { ...type.small, color: t.text, marginTop: space(2) },
  microphoneNotice: { ...type.small, color: t.muted, marginTop: space(2) },
  access: { ...type.small, color: t.text, marginTop: space(2) },
  hero: { marginTop: space(5), gap: space(3) },
  heroArt: { alignSelf: 'center' },
  rows: { marginTop: space(5), gap: space(2) },
  checking: { ...type.small, color: t.muted, textAlign: 'center', marginTop: space(3) },
  footer: { marginTop: space(5), gap: space(1) },
});
}
