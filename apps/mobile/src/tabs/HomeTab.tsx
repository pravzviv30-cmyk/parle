/**
 * Home — what there is to do today.
 *
 * The tab used to open on a summary of the past: a level, a rail of totals, a
 * list of headlines. The founder's mockup opens on something to do instead, and
 * that is the whole of this rewrite. Six blocks, top to bottom:
 *
 *   1. the greeting, alone, cycling Salut, Bonjour, Hello;
 *   2. the word of the day;
 *   3. today's situation, and the one way into a spoken conversation;
 *   4. daily momentum, when there is any;
 *   5. the next step, as a row;
 *   6. the sprout note.
 *
 * Nothing on this screen decides anything. The greeting is `home/greeting.ts`
 * and `home/useGreetingRotation.ts`, the two daily cards are `dailyPick` over
 * core's pools, the three counts are `progress/momentum.ts`, the next situation
 * is core's `suggestedMission`, the two next-step words are
 * `progress/portfolio.ts`, and whether a start starts anything is
 * `tutor/gate.ts`. There is no renderer in this workspace, so a rule that hid
 * in this file would be a rule nothing could ask a question about.
 *
 * ## What is deliberately absent
 *
 * A streak, still: PRODUCT.md calls it a guilt mechanic implicated in
 * intermediate-plateau churn, and "Days active" is built so that it cannot
 * become one (see `momentum.ts`). A score, a percentage of anything spoken, and
 * a red bar: none of the three exists here. And every count at zero, which is
 * the harder promise. A learner on their first run meets the greeting, a word,
 * a situation, a way in and a kind line. Not one empty rail, not one nudge.
 *
 * ## One clock, one day
 *
 * `now` is read once per focus and every "today" on the screen comes from that
 * one reading: the word, the situation, the day marks and the goal. A screen
 * that read the clock four times could show two different days at midnight.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import {
  DAILY_SCENARIOS,
  DAILY_WORDS,
  dailyPick,
  missionStates,
  suggestedMission,
  type DailyScenario,
  type DailyWord,
  type MissionProgress,
} from '@luvani/core';

import { SproutGlyph } from '../components.tsx';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import { paper, space, type } from '../theme.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { greetingRest } from '../home/greeting.ts';
import { useGreetingRotation } from '../home/useGreetingRotation.ts';
import { WordOfDayCard } from '../home/WordOfDayCard.tsx';
import { SituationCard } from '../home/SituationCard.tsx';
import { MomentumCards } from '../home/MomentumCards.tsx';
import { NextStepRow } from '../home/NextStepRow.tsx';
import { isBookmarked } from '../bookmarks/view.ts';
import { loadBookmarks, setBookmark, type BookmarkItem } from '../bookmarks/store.ts';
import { momentumFrom, type Momentum } from '../progress/momentum.ts';
import { loadActivity } from '../progress/activity.ts';
import { loadDeck } from '../review/store.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { firstNameOf } from '../tutor/dashboard.ts';

export function HomeTab() {
  // A bottom tab stays mounted after its first visit, so a looping scene here
  // keeps animating behind whatever the learner is actually doing. The scene
  // cannot ask for itself — useIsFocused throws outside a NavigationContainer,
  // and several scenes render above the navigator — so the tab passes it down.
  // The greeting's own timers stop on the same signal.
  const focused = useIsFocused();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile } = useProfile();

  // One name rule for the whole app. A learner who skipped the question is
  // greeted by the word alone, never by "you".
  const firstName = firstNameOf(profile.name);
  const greeting = useGreetingRotation({ firstName, focused });

  const [word, setWord] = useState<DailyWord | null>(null);
  const [scenario, setScenario] = useState<DailyScenario | null>(null);
  const [momentum, setMomentum] = useState<Momentum | null>(null);
  const [nextMission, setNextMission] = useState<MissionProgress | null>(null);
  const [bookmarks, setBookmarks] = useState<readonly BookmarkItem[]>([]);

  // Re-read on every return: finishing a sitting anywhere in the app should be
  // visible here the moment the learner comes back to look, and a phone that
  // was asleep at midnight gets today's word the moment it is opened.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const now = Date.now();
      // Neither daily card waits on storage. Both are a pure function of the
      // day and the pool, so they are on screen before the bridge answers.
      setWord(dailyPick(DAILY_WORDS, now));
      setScenario(dailyPick(DAILY_SCENARIOS, now));
      // All independent reads cross the native storage bridge together.
      void Promise.all([loadActivity(), loadDeck(), loadMissionCompletions(), loadBookmarks()]).then(
        ([activity, deck, completions, saved]) => {
          if (cancelled) return;
          setMomentum(momentumFrom({ activity, deck, profile, now }));
          setNextMission(suggestedMission(missionStates(missionCompletionsFrom(completions), deck, now)));
          setBookmarks(saved);
        },
      );
      return () => {
        cancelled = true;
      };
    }, [profile]),
  );

  const toggleBookmark = (id: string, saved: boolean) => {
    // Written, then read back, so what is drawn is what the store holds rather
    // than what this screen assumed it would hold.
    void setBookmark(id, !saved)
      .then(() => loadBookmarks())
      .then(setBookmarks);
  };

  return (
    // bottom="tab": the tab bar owns the bottom edge, so the frame leaves it the
    // inset rather than paying it twice on a notched phone.
    <ScrollScreen bottom="tab">
      <View style={st.scroll}>
        {/* The greeting alone. No purpose line and no monogram beside it: the
            founder asked for one line, and `titleAccessibilityLabel` is what a
            screen reader hears instead of a header renaming itself every few
            seconds. */}
        <TabHeader
          title={greeting.line}
          titleOpacity={greeting.opacity}
          titleAccessibilityLabel={greetingRest(firstName)}
        />

        {word !== null && <WordOfDayCard word={word} paused={!focused} />}

        {scenario !== null && (
          <SituationCard
            scenario={scenario}
            saved={isBookmarked(bookmarks, scenario.id)}
            onToggleBookmark={() => toggleBookmark(scenario.id, isBookmarked(bookmarks, scenario.id))}
          />
        )}

        {/* Absent at zero, in three independent pieces. Not a zero, not an
            empty state, not a nudge. */}
        {momentum !== null && <MomentumCards momentum={momentum} />}

        {nextMission !== null && (
          <NextStepRow
            next={nextMission}
            onViewPath={() => nav.navigate('Practice')}
            // The chooser confirms the choice before a session spends any time,
            // which is the door every other surface goes through. Nothing is
            // tracked here for that reason: this row opens the chooser, and the
            // chooser is what records a mission actually being started.
            onOpen={() => nav.navigate('Missions', { focus: nextMission.mission.id })}
          />
        )}

        <View style={st.footer}>
          <SproutGlyph />
          <Text style={st.note}>No pressure of perfection. Speak at your own pace.</Text>
        </View>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  scroll: { flexGrow: 1 },
  // Pushed to the foot of a short screen. No bottom padding: the frame owns the
  // air above the tab bar, once.
  footer: {
    marginTop: 'auto',
    paddingTop: space(7),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
  },
  note: { ...type.small, color: paper.inkSoft, flexShrink: 1 },
});
