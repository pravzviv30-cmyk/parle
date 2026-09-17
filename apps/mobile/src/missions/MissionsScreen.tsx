/**
 * The chooser: six situations, one of them already picked, and the lesson.
 *
 * A stack screen, reached from three doors, because the same surface is needed
 * by a first run, by Home's hero and by the Tutor tab's everyday row. A first
 * run opens straight onto it, which is why the way out has to work even when
 * there is nothing behind this screen to go back to.
 *
 * Revamp A gives it one hero card and five rows instead of six cards, and hands
 * it the scripted lesson (F573). The lesson was a door on the Tutor tab, which
 * had grown into a contents page; it belongs here, last, because it is the
 * narrow door where every line is written out and a beginner should meet the
 * open situations before a fixed script. It is an outline rather than a row for
 * the reason it was never a seventh mission: the script is known in advance,
 * which is the only reason pronunciation can be scored at all.
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
import { Card, GhostButton, Label, MicGlyph, OutlineButton, PillButton, TintRow } from '../components.tsx';
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

export function MissionsScreen() {
  const nav = useNavigation<{
    goBack: () => void;
    canGoBack: () => boolean;
    navigate: (screen: string, params?: object) => void;
  }>();
  const { recheck } = useLive();

  const [progress, setProgress] = useState<readonly MissionProgress[] | null>(null);
  const route = useRoute<RouteProp<RootStackParamList, 'Missions'>>();
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
    nav.navigate(card.route.screen, card.route.params);
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

        {first && (
          <Card style={st.hero}>
            <Label>{CHOOSER_START_HERE}</Label>
            <Art name={heroArt(first.mission.place)} style={st.heroArt} />
            <Text style={[type.cardTitle, { color: paper.ink }]}>{first.mission.title}</Text>
            <Text style={[type.small, { color: paper.inkSoft }]}>{first.mission.goalEn}</Text>
            <PillButton
              label="Start this one"
              icon={<MicGlyph size={20} color={paper.onInk} />}
              accessibilityLabel={`Start this one. ${first.mission.titleEn}. ${first.status}`}
              onPress={() => open(first)}
            />
          </Card>
        )}

        <View style={st.rows}>
          <Label>{CHOOSER_OTHER}</Label>
          {rest.map((card) => (
            <TintRow
              key={card.id}
              tint={missionTint(card.mission.place)}
              glyph={<PlaceGlyph place={card.mission.place} color={accent.primary} />}
              title={card.mission.title}
              gloss={card.mission.titleEn}
              accessibilityLabel={`${card.mission.title}. ${card.mission.titleEn}. ${card.status}`}
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
          <OutlineButton
            label={LESSON_DOOR.title}
            icon={<WaveformGlyph size={20} color={paper.ink} />}
            disabled={checking}
            onPress={() => openLesson(false)}
          />
          <GhostButton label={LESSON_DOOR.quiet} disabled={checking} onPress={() => openLesson(true)} />
          <GhostButton label={view.talkFreely} disabled={checking} onPress={() => nav.navigate('Convo')} />
        </View>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  scroll: { paddingTop: space(2), paddingBottom: space(6) },
  headline: { ...type.display, color: paper.ink },
  sub: { ...type.body, color: paper.inkSoft, marginTop: space(2) },
  promise: { ...type.bodyStrong, color: paper.ink, marginTop: space(4) },
  microphoneNotice: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  hero: { marginTop: space(5), gap: space(3) },
  heroArt: { alignSelf: 'center' },
  rows: { marginTop: space(5), gap: space(2) },
  checking: { ...type.small, color: paper.inkSoft, textAlign: 'center', marginTop: space(3) },
  footer: { marginTop: space(5), gap: space(1) },
});
