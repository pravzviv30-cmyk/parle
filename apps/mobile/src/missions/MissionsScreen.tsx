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
 * titles as supporting context. Speak/Type follows the learner into the room.
 *
 * Every rule on this page lives in `chooserView.ts`: which mission is first,
 * which one carries the solid pill, what each card says underneath, whether the
 * promise line is on screen at all, and what the lesson door says. What is left
 * here is layout, which is the only thing a file with no renderer behind it
 * should be holding.
 */

import { useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../nav/types.ts';
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { missionStates, type MissionProgress } from '@luvani/core';
import { accent, paper, space, type } from '../theme.ts';
import { Card, GhostButton, Label, MicGlyph, OutlineButton, PillButton, TabBar, TintRow } from '../components.tsx';
import { estimateMinutes } from '../home/estimate.ts';
import { PlaceGlyph, WaveformGlyph } from '../glyphs.tsx';
import { Art } from '../art/Art.tsx';
import { heroArt } from '../art/maps.ts';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useLive } from '../app/LiveContext.tsx';
import { lessonStart, TUTOR_OFFLINE } from '../tutor/gate.ts';
import { missionTint } from './missionTint.ts';
import { loadMissionCompletions } from './store.ts';
import { loadDeck } from '../review/store.ts';
import { loadActivity } from '../progress/activity.ts';
import {
  CHOOSER_OTHER,
  CHOOSER_START_HERE,
  LESSON_DOOR,
  chooserView,
  hasSpokenBefore,
  missionCompletionsFrom,
  type ChooserCard,
} from './chooserView.ts';
import { trackProductEvent } from '../analytics/track.ts';
import { asSentences } from '../copy/spoken.ts';
import { ListeningPreview } from './ListeningPreview.tsx';

export function MissionsScreen() {
  const nav = useNavigation<{
    goBack: () => void;
    canGoBack: () => boolean;
    navigate: (screen: string, params?: object) => void;
  }>();
  const { recheck } = useLive();

  const [progress, setProgress] = useState<readonly MissionProgress[] | null>(null);
  const route = useRoute<RouteProp<RootStackParamList, 'Missions'>>();
  const [mode, setMode] = useState<'speak' | 'type'>(route.params?.textMode ? 'type' : 'speak');
  const [spokenBefore, setSpokenBefore] = useState(true);
  /** A probe is in flight, so a tap on the lesson is never a dead press. */
  const [checking, setChecking] = useState(false);

  // Re-read on every return: a mission finished in the last ten minutes should
  // be reading as finished by the time the learner comes back to choose again.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([loadMissionCompletions(), loadDeck(), loadActivity()])
        .then(([completions, deck, activity]) => {
          if (cancelled) return;
          setProgress(missionStates(missionCompletionsFrom(completions), deck, Date.now()));
          setSpokenBefore(hasSpokenBefore(activity));
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // A first run opens ON this screen, so there is nothing behind it to go back
  // to. Falling through to the tabs is the difference between a way out and a
  // dead end on the very first screen after signing up.
  const leave = () => {
    if (nav.canGoBack()) nav.goBack();
    else nav.navigate('Tabs');
  };

  const open = (card: ChooserCard) => {
    void trackProductEvent({ name: 'mission_started', properties: { missionId: card.mission.id, entry: 'chooser' } });
    nav.navigate(card.route.screen, { ...card.route.params, textMode: mode === 'type' });
  };

  /**
   * The scripted lesson, probed and refused by nothing.
   *
   * One probe in flight, one lesson, the same guard every other probing handler
   * in the app carries. What differs is the answer it is allowed to give:
   * `tutorGate` can hold a learner back from a conversation because there is no
   * conversation without a server, while the lesson falls back to the mock
   * session, so `lessonStart` opens either way and the learner lands on the
   * live lesson or the honest demo of it. `go` is passed twice so a probe that
   * ever threw still lets go of the flag instead of retiring the screen.
   */
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

  return (
    <ScrollScreen header={<ScreenHeader back={{ onPress: leave }} />}>
      <View style={st.scroll}>
        <Text style={st.headline}>{view.headline}</Text>
        <Text style={st.sub}>{view.sub}</Text>
        {view.promise !== null && <Text style={st.promise}>{view.promise}</Text>}
        {view.microphoneNotice !== null && <Text style={st.microphoneNotice}>{view.microphoneNotice}</Text>}
        <Text style={st.access}>{view.access}</Text>
        <View style={st.mode}>
          <TabBar tabs={[{ key: 'speak', label: 'Speak' }, { key: 'type', label: 'Type' }]} active={mode} onChange={setMode} accessibilityLabel="Mission conversation mode" />
        </View>

        {first && (
          <Card tone="feature" style={st.hero}>
            <Label>{CHOOSER_START_HERE}</Label>
            <Art name={heroArt(first.mission.place)} style={st.heroArt} />
            <Text style={[type.cardTitle, { color: paper.ink }]}>{first.mission.titleEn}</Text>
            <Text style={[type.frenchSm, { color: paper.inkSoft }]}>{first.mission.title}</Text>
            <Text style={[type.small, { color: paper.inkSoft }]}>{first.mission.goalEn}</Text>
            <Text style={[type.small, { color: paper.ink }]}>{first.status} · About {estimateMinutes({ kind: 'mission', beats: first.mission.beatIds.length })} min</Text>
            <PillButton
              label={mode === 'type' ? 'Start typed mission' : 'Start mission'}
              icon={<MicGlyph size={20} color={paper.onInk} />}
              accessibilityLabel={`${mode === 'type' ? 'Start typed mission' : 'Start mission'}. ${first.mission.titleEn}. ${first.status}`}
              onPress={() => open(first)}
            />
            {/* A quiet way to hear the scene's authored lines first. Never a
                second primary: the pill above is this card's one action. */}
            <ListeningPreview selection={{ kind: 'mission', mission: first.mission }} />
          </Card>
        )}

        <Card tone="journal" style={st.warmup}>
          <Label>Want a little more support?</Label>
          <Text style={[type.body, { color: paper.inkSoft }]}>Listen to a café phrase, then try it yourself. The line stays on screen while you practise.</Text>
          <OutlineButton label={LESSON_DOOR.title} icon={<WaveformGlyph size={20} color={paper.ink} />} disabled={checking} onPress={() => openLesson(mode === 'type')} />
          <Text style={[type.small, { color: paper.inkSoft }]}>{LESSON_DOOR.minutes}</Text>
        </Card>

        <View style={st.rows}>
          <Label>{CHOOSER_OTHER}</Label>
          {rest.map((card) => (
            <TintRow
              key={card.id}
              tint={missionTint(card.mission.place)}
              glyph={<PlaceGlyph place={card.mission.place} color={accent.primary} />}
              title={card.mission.titleEn}
              gloss={`${card.mission.goalEn} · ${card.status}`}
              accessibilityLabel={asSentences([card.mission.title, card.mission.titleEn, card.status])}
              onPress={() => open(card)}
            />
          ))}
        </View>

        {checking && <Text accessibilityLiveRegion="polite" style={st.checking}>{TUTOR_OFFLINE.checking}</Text>}

        {/* The scripted lesson, and its own typed way in. The lesson is the one
            live screen that offers no quiet door until something breaks, so
            without this link a learner who cannot speak reaches the typed
            lesson only by first having the session fail. */}
        <View style={st.footer}>
          <GhostButton label={LESSON_DOOR.quiet} accessibilityLabel={`${LESSON_DOOR.quiet}. ${LESSON_DOOR.minutes}`} disabled={checking} onPress={() => openLesson(true)} />
          <GhostButton label={view.talkFreely} disabled={checking} onPress={() => nav.navigate('Convo', { textMode: mode === 'type' })} />
        </View>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  mode: { marginTop: space(4) },
  warmup: { marginTop: space(4), gap: space(3) },
  scroll: { paddingTop: space(2), paddingBottom: space(6) },
  headline: { ...type.display, color: paper.ink },
  sub: { ...type.body, color: paper.inkSoft, marginTop: space(2) },
  promise: { ...type.bodyStrong, color: paper.ink, marginTop: space(4) },
  microphoneNotice: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  access: { ...type.small, color: paper.ink, marginTop: space(2) },
  hero: { marginTop: space(5), gap: space(3) },
  heroArt: { alignSelf: 'center' },
  rows: { marginTop: space(5), gap: space(2) },
  checking: { ...type.small, color: paper.inkSoft, textAlign: 'center', marginTop: space(3) },
  footer: { marginTop: space(5), gap: space(1) },
});
