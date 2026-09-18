/**
 * Home — tonight's French, not a summary.
 *
 * Revamp A cut this screen to the two things the founder's mockup shows. The
 * greeting with the hour's question under it, then one card with one situation
 * on it and one pill, then one row saying what this learner can now do in
 * French. That is the whole tab:
 *
 *   1. the greeting, one word swiping up out of a fixed slot, the hour's
 *      question beneath it, and the watercolour bleeding off the top corner;
 *   2. the hero: one situation, what is happening, the picture of the place,
 *      how long it takes, a corner to save it, and the tab's one pill;
 *   3. "Real progress": one sentence about what they can now do, and a way
 *      into the whole of it.
 *
 * Nothing on this screen decides anything. The greeting is `home/greeting.ts`
 * and `home/useGreetingRotation.ts`, the hero and its start are
 * `home/homeMission.ts`, the minutes are `home/estimate.ts`, the sentence is
 * `home/abilities.ts` over the passport, and whether a start starts anything is
 * `tutor/gate.ts`. There is no renderer in this workspace, so a rule that hid
 * in this file would be a rule nothing could ask a question about.
 *
 * ## What left, and where it went
 *
 * The four momentum cards and the word of the day moved to the Progress screen,
 * behind the "Real progress" row: they are worth a page and they were never
 * worth the first screen, because a learner opening this app at nine in the
 * evening is deciding whether to speak, not reading about themselves. The daily
 * situation card folded into the hero, along with its bookmark, so there is one
 * way into a conversation on the screen whose whole job is to open one. The six
 * guided missions are reached from the Tutor tab and from My French. The sprout
 * footer went with them.
 *
 * ## What is deliberately absent
 *
 * A streak, a score of the learner, a mark out of ten, a red bar, and now every
 * count: the one numeral left on this page is how many minutes the card in
 * front of them is likely to take, which is a fact about the next few minutes
 * rather than a measurement of a person. The percentage that used to live here
 * ("Recall") went to Progress with the block that carried it.
 *
 * ## One clock, one day
 *
 * `now` is read once per focus and every "today" on the screen comes from that
 * one reading: the hero's label, the scene it picks, and the minutes on it. A
 * screen that read the clock twice could show two different days at midnight.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { levelFor, missionStates, totalXp } from '@luvani/core';

import { HeaderArt } from '../art/HeaderArt.tsx';
import { HEADER_ART } from '../art/maps.ts';
import { ScrollScreen, TabHeader } from '../layout.tsx';
import { space } from '../theme.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { useGreetingRotation } from '../home/useGreetingRotation.ts';
import { MissionHero } from '../home/MissionHero.tsx';
import { AbilitiesCard } from '../home/AbilitiesCard.tsx';
import { canDoSentence, type CanDo } from '../home/abilities.ts';
import { fallbackHero, homeMissionFrom, type HomeMission } from '../home/homeMission.ts';
import { loadActivity } from '../progress/activity.ts';
import { stampsFrom } from '../progress/passport.ts';
import { loadDeck } from '../review/store.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { loadScenarioProgress } from '../missions/progressStore.ts';
import { hasSpokenBefore, missionCompletionsFrom } from '../missions/chooserView.ts';
import { firstNameOf } from '../tutor/dashboard.ts';

export function HomeTab() {
  // A bottom tab stays mounted after its first visit, so the greeting's timers
  // would keep running behind whatever the learner is actually doing. The tab
  // cannot ask the hook for itself — useIsFocused throws outside a
  // NavigationContainer — so the tab reads it and passes it down.
  const focused = useIsFocused();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile } = useProfile();

  // One name rule for the whole app. A learner who skipped the question is
  // greeted by the word alone, never by "you".
  const firstName = firstNameOf(profile.name);
  const greeting = useGreetingRotation({ firstName, focused });

  // Null here means the storage read has not answered yet, not that there is
  // nothing to offer: the hero is on every page that read anything at all.
  const [hero, setHero] = useState<HomeMission | null>(null);
  // What the learner can now do, or null before the passport has been read.
  const [can, setCan] = useState<CanDo | null>(null);

  // Re-read on every return: finishing a sitting anywhere in the app should be
  // visible here the moment the learner comes back to look, and a phone that
  // was asleep at midnight gets today's scene the moment it is opened.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const now = Date.now();
      // All independent reads cross the native storage bridge together.
      void Promise.all([loadActivity(), loadDeck(), loadMissionCompletions(), loadScenarioProgress()])
        .then(([activity, deck, completions, records]) => {
          if (cancelled) return;
          // The scene is pitched, so it waits. `scenariosForLevel` narrows the
          // pool to the learner's tier inside the rule, and the standing is the
          // app's one level rule, read rather than re-derived: a second opinion
          // about how far a learner has come would disagree with My French on
          // the tab next door.
          const standing = levelFor(totalXp(activity));
          // One projection of where every scene stands, read once and handed to
          // both rules that draw from it, so the hero and the sentence beneath
          // it can never disagree about the same finish.
          const progress = missionStates(missionCompletionsFrom(completions), deck, now);
          setHero(
            homeMissionFrom({
              progress,
              records,
              spokenBefore: hasSpokenBefore(activity),
              levelIndex: standing.index,
              now,
            }),
          );
          setCan(canDoSentence(stampsFrom(progress)));
        })
        .catch(() => {
          if (cancelled) return;
          // The hero survives, on the café with the hour's own label. That is
          // true of the café for every learner alive, so it claims nothing
          // about the one who could not be read, and it keeps the page's one
          // pill on the page.
          //
          // The sentence does not. "Your first conversation is where this
          // starts" said to somebody who has been practising for months is the
          // app forgetting them, so it is withheld rather than guessed.
          // Nothing on screen mentions the disk: a learner cannot act on a
          // storage fault, and the greeting and the one pill are still there.
          setHero(fallbackHero(now));
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    // bottom="tab": the tab bar owns the bottom edge, so the frame leaves it the
    // inset rather than paying it twice on a notched phone.
    <ScrollScreen bottom="tab">
      <View>
        {/* The greeting, the hour's question, and the watercolour behind both.
            `title` is the still line, which is what a screen reader hears and
            what a learner who asked for less movement reads; `titleSwap` is the
            moving half, and it is null when nothing may move. The art is
            absolute, decorative and silent, and it is not drawn at all at the
            larger reading sizes. */}
        <View style={st.head}>
          <HeaderArt name={HEADER_ART.home} />
          <TabHeader title={greeting.rest} titleSwap={greeting.swap} purpose={greeting.subline} />
        </View>

        {/* The hero is outside every other gate. It is drawn for a learner with
            nothing behind them, and a gate around it would be a blank page on a
            first run. Null only means the storage read has not answered. */}
        {hero !== null && <MissionHero hero={hero} />}

        {can !== null && <AbilitiesCard can={can} onOpen={() => nav.navigate('Progress')} />}
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  // The corner art is absolute inside this, so it can bleed off the top right
  // of the page behind a greeting that changes language every few seconds.
  head: { position: 'relative', marginTop: space(2) },
});
