/**
 * Home — tonight's French, not a summary.
 *
 * The tab used to open on the word of the day and offer the next situation as
 * a row near the foot. The founder's brief opens it on the one thing to do
 * tonight, with the proof that the last times counted, and that is the whole
 * of this rewrite. Seven blocks, top to bottom:
 *
 *   1. the greeting, alone, one word swiping up out of a fixed slot;
 *   2. the hero: one situation, why it, how long, the tutor's one line of
 *      memory when there is a real one, and the tab's one pill;
 *   3. what the learner can now do, one row per situation handled on their
 *      own, and nothing before one is;
 *   4. today's situation, with its starting line, a bookmark and an outline;
 *   5. daily momentum, four cards, there from the first day;
 *   6. the word of the day, under the momentum rather than over everything;
 *   7. the sprout note.
 *
 * Nothing on this screen decides anything. The greeting is `home/greeting.ts`
 * and `home/useGreetingRotation.ts`, the hero is `home/homeMission.ts`, the
 * memory line is `tutor/continuity.ts`, the abilities are `home/abilities.ts`
 * over the passport, the two daily cards are `dailyPick` over core's pools,
 * the four momentum cards are `progress/momentum.ts`, which of the twenty
 * drawings today gets is `home/wordScenes.ts` and `home/WordScene.tsx`, and
 * whether a start starts anything is `tutor/gate.ts`. There is no renderer in
 * this workspace, so a rule that hid in this file would be a rule nothing
 * could ask a question about.
 *
 * ## What is deliberately absent
 *
 * A streak, still: PRODUCT.md calls it a guilt mechanic implicated in
 * intermediate-plateau churn, and "Days active" is built so that it cannot
 * become one (see `momentum.ts`). A score of the learner, a mark out of ten and
 * a red bar: none of the three exists here.
 *
 * One percentage does. Home shows how much of the review deck comes back when
 * it is asked for, as "Recall", and only once ten real reviews are behind it;
 * it is a fact about a deck rather than a verdict on a person, and below that
 * floor it is withheld rather than guessed. Nothing on this page scores how
 * well anything was pronounced or spoken.
 *
 * What is no longer absent is the momentum block itself. Until 2026-09-05 the
 * four counts were held back entirely until one of them was real, so a
 * first-run learner met no tile at all. The founder overturned that: the four
 * cards ship from day one so a learner can see what this app will ever claim
 * about them, and where a count would be nought the numeral is simply not
 * drawn and `momentum.ts`'s own start line stands in its place. No empty rail
 * names a target. The one line that asks for anything is the goal card's, and
 * it asks for a promise rather than for work: with no daily goal set it carries
 * Profile's own `DAILY_GOAL_UNSET`, "Pick a daily promise".
 *
 * ## One clock, one day
 *
 * `now` is read once per focus and every "today" on the screen comes from that
 * one reading: the hero's label, the word, the drawing beside it, the
 * situation, the day marks and the goal. A screen that read the clock five
 * times could show two different days at midnight.
 *
 * The situation and the drawing are on screen before the bridge answers,
 * because both are a pure function of the day and a pool. The word is not, and
 * that is deliberate: it is pitched at the learner's tier, the tier comes from
 * the level standing, and the level standing is XP that has to be read. A word
 * drawn before the read would be a tier one word replaced a moment later,
 * which is the app appearing to change its mind about a learner.
 */

import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import {
  DAILY_SCENARIOS,
  DAILY_WORDS,
  dailyPick,
  levelFor,
  missionStates,
  totalXp,
  scenariosForLevel,
  wordsForLevel,
  type DailyScenario,
  type DailyWord,
} from '@luvani/core';

import { SproutGlyph } from '../components.tsx';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import { paper, space, type } from '../theme.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { useGreetingRotation } from '../home/useGreetingRotation.ts';
import { gentlestWord } from '../home/gentlestWord.ts';
import { WordOfDayCard } from '../home/WordOfDayCard.tsx';
import { WORD_SCENES, type WordSceneKey } from '../home/wordScenes.ts';
import { SituationCard } from '../home/SituationCard.tsx';
import { MomentumCards } from '../home/MomentumCards.tsx';
import { MissionHero } from '../home/MissionHero.tsx';
import { AbilitiesCard } from '../home/AbilitiesCard.tsx';
import { abilitiesFrom, type Abilities } from '../home/abilities.ts';
import { fallbackHero, homeMissionFrom, type HomeMission } from '../home/homeMission.ts';
import { bookmarkControl, bookmarkDecisions, isBookmarkedIn, type BookmarkWrite } from '../bookmarks/view.ts';
import { loadBookmarks, setBookmark, type BookmarkItem } from '../bookmarks/store.ts';
import { loadConversationPacks } from '../conversationPacks/store.ts';
import { momentumFrom, type Momentum } from '../progress/momentum.ts';
import { loadActivity } from '../progress/activity.ts';
import { stampsFrom } from '../progress/passport.ts';
import { loadDeck } from '../review/store.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { loadScenarioProgress } from '../missions/progressStore.ts';
import { hasSpokenBefore, missionCompletionsFrom } from '../missions/chooserView.ts';
import { continuityFrom } from '../tutor/continuity.ts';
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
  const [scene, setScene] = useState<WordSceneKey | null>(null);
  const [scenario, setScenario] = useState<DailyScenario | null>(null);
  const [momentum, setMomentum] = useState<Momentum | null>(null);
  // Null here means the storage read has not answered yet, not that there is
  // nothing to offer: the hero is on every page that read anything at all.
  const [hero, setHero] = useState<HomeMission | null>(null);
  // The tutor's one line of memory, or null when there is no real record.
  const [continuity, setContinuity] = useState<string | null>(null);
  // What the learner can now do, or null before anything is stamped.
  const [abilities, setAbilities] = useState<Abilities | null>(null);
  const [bookmarks, setBookmarks] = useState<readonly BookmarkItem[]>([]);
  // Where the bookmark tap has got to. A save is a write and a read back, which
  // is two trips over the storage bridge, and the button said the same word for
  // the whole of it.
  const [bookmarkWrite, setBookmarkWrite] = useState<BookmarkWrite>('idle');

  // Folded once per change rather than once per render. This was a whole Map
  // rebuilt on every render to answer one boolean.
  const decisions = useMemo(() => bookmarkDecisions(bookmarks), [bookmarks]);

  // Re-read on every return: finishing a sitting anywhere in the app should be
  // visible here the moment the learner comes back to look, and a phone that
  // was asleep at midnight gets today's word the moment it is opened.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const now = Date.now();
      // Today's drawing does not wait on storage: it is a pure function of the
      // day and a pool of twenty, and it says nothing about the learner.
      setScene(dailyPick(WORD_SCENES, now));
      // All independent reads cross the native storage bridge together.
      void Promise.all([
        loadActivity(),
        loadDeck(),
        loadMissionCompletions(),
        loadBookmarks(),
        loadScenarioProgress(),
        loadConversationPacks(),
      ])
        .then(([activity, deck, completions, saved, records, packs]) => {
          if (cancelled) return;
          // The word is pitched, so it waits. `wordsForLevel` narrows the pool
          // to the learner's tier and `dailyPick` takes today out of what is
          // left, on the same `now` as everything else on the screen. The
          // standing is the app's one level rule, read rather than re-derived:
          // a second opinion about how far a learner has come would disagree
          // with My French on the tab next door.
          const standing = levelFor(totalXp(activity));
          setWord(dailyPick(wordsForLevel(DAILY_WORDS, standing.index), now));
          // The situation is pitched too, since the founder grew the pool to
          // five hundred and the range widened from ordering a coffee to
          // explaining a problem to an official. Same `now`, same standing,
          // same rule as the word, so the two cannot disagree about the day or
          // about how far this learner has come.
          setScenario(dailyPick(scenariosForLevel(DAILY_SCENARIOS, standing.index), now));
          setMomentum(momentumFrom({ activity, deck, profile, now }));
          // One projection of where every scene stands, read once and handed
          // to the three rules that draw from it, so the hero, the memory line
          // and the abilities can never disagree about the same finish.
          const progress = missionStates(missionCompletionsFrom(completions), deck, now);
          setHero(homeMissionFrom({ progress, records, spokenBefore: hasSpokenBefore(activity), now }));
          setContinuity(continuityFrom({ brain: profile.brain, packs, records, progress })?.line ?? null);
          setAbilities(abilitiesFrom(stampsFrom(progress)));
          setBookmarks(saved);
        })
        .catch(() => {
          if (cancelled) return;
          // What survives is the word, because it is a fact about the day and a
          // pool rather than a claim about this learner. It is pitched at the
          // gentlest tier for the reason `tier.ts` already gives: a learner
          // whose standing could not be read should meet the gentlest pool
          // rather than a blank screen, and a pitch claims nothing.
          //
          // The hero survives too, on the café with the chooser's line for a
          // scene nobody has started. That is true of the café for every
          // learner alive, so it claims nothing about the one who could not be
          // read, and it keeps the page's one pill on the page.
          //
          // What does not survive is every count and every memory. A nought
          // where a real number belongs, or a line about a scene nobody could
          // read, is the app forgetting somebody who has been practising for
          // months, so the momentum block, the memory line and the abilities
          // stay absent. Nothing on screen mentions the disk: a learner cannot
          // act on a storage fault, and the greeting, the word, the hero and
          // the situation are all still there.
          setWord(gentlestWord(now));
          setScenario(dailyPick(scenariosForLevel(DAILY_SCENARIOS, 0), now));
          setHero(fallbackHero(now));
        });
      return () => {
        cancelled = true;
      };
    }, [profile]),
  );

  /**
   * Save a situation to come back to, or take it off the shelf.
   *
   * Written, then read back, so what is drawn is what the store holds rather
   * than what this screen assumed it would hold. The flag around it is what
   * makes the wait visible: without it the learner tapped, nothing moved for
   * two bridge crossings, and they tapped again.
   *
   * A write that will not land says so and leaves the button live, because the
   * way to try again is the thing they already pressed. Nothing tells them they
   * did anything wrong, because they did not.
   */
  const toggleBookmark = (id: string, saved: boolean) => {
    if (bookmarkWrite === 'writing') return;
    setBookmarkWrite('writing');
    void setBookmark(id, !saved)
      .then(() => loadBookmarks())
      .then((rows) => {
        setBookmarks(rows);
        setBookmarkWrite('idle');
      })
      .catch(() => setBookmarkWrite('refused'));
  };

  return (
    // bottom="tab": the tab bar owns the bottom edge, so the frame leaves it the
    // inset rather than paying it twice on a notched phone.
    <ScrollScreen bottom="tab">
      <View style={st.scroll}>
        {/* The greeting alone. No purpose line and no monogram beside it: the
            founder asked for one line. `title` is the still line, which is what
            a screen reader hears and what a learner who asked for less movement
            reads; `titleSwap` is the moving half, and it is null when nothing
            may move. Neither is a header that renames itself out loud every few
            seconds. */}
        <TabHeader title={greeting.rest} titleSwap={greeting.swap} />

        {/* The hero is outside every other gate. It is drawn for a learner with
            nothing behind them, and a gate around it would be a blank page on a
            first run. Null only means the storage read has not answered. */}
        {hero !== null && (
          <MissionHero hero={hero} continuity={continuity} />
        )}

        {abilities !== null && <AbilitiesCard abilities={abilities} onOpen={() => nav.navigate('MyFrench')} />}

        {scenario !== null && (
          <SituationCard
            scenario={scenario}
            saved={isBookmarkedIn(decisions, scenario.id)}
            bookmark={bookmarkControl(isBookmarkedIn(decisions, scenario.id), scenario.titleEn, bookmarkWrite)}
            onToggleBookmark={() => toggleBookmark(scenario.id, isBookmarkedIn(decisions, scenario.id))}
          />
        )}

        {/* Null here means the storage read has not answered yet, not that
            there is nothing to say. Without this gate a learner who has been
            practising for months would meet the four start lines for a frame
            before their own numbers arrived, which is the app appearing to
            forget them. */}
        {momentum !== null && <MomentumCards momentum={momentum} onReviewPhrases={() => nav.navigate('Review')} />}

        {word !== null && scene !== null && (
          <WordOfDayCard word={word} scene={scene} paused={!focused} />
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
