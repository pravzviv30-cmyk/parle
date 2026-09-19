/**
 * Home combines an immediate conversation invitation with visible evidence
 * of the learner's progress. Four compact momentum tiles and the inline weekly
 * story replace the separate Progress destination and share its existing
 * projections, never made-up counts. A new learner receives forward-looking
 * copy rather than a false record. The hero is independent of the momentum gate.
 * All data is re-read on focus with one clock, so completion and midnight changes
 * appear as soon as the learner comes back.
 */

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { levelFor, missionStates, totalXp, type ReviewCard } from '@luvani/core';

import { ScrollScreen, TabHeader } from '../layout.tsx';
import { space, paper, type } from '../theme.ts';
import { Card, GhostButton, Label, PillButton } from '../components.tsx';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { DailyCarousel } from '../daily/DailyCarousel.tsx';
import { todayItems } from '../daily/catalogue.ts';
import { useSocial } from '../friends/useSocial.ts';
import { usefulFriends, usefulPace } from '../home/activitySections.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { useGreetingRotation } from '../home/useGreetingRotation.ts';
import { MissionHero } from '../home/MissionHero.tsx';
import { HomeProgressDetails } from '../progress/ProgressScreen.tsx';
import { canDoRows, type CanDoRow } from '../progress/progressView.ts';
import { storyFrom, type WeekStory } from '../progress/story.ts';
import { loadHistory } from '../progress/store.ts';
import { loadConversationPacks } from '../conversationPacks/store.ts';
import { fallbackHero, homeMissionFrom, type HomeMission } from '../home/homeMission.ts';
import { loadActivity, loadActiveDays } from '../progress/activity.ts';
import { stampsFrom } from '../progress/passport.ts';
import { loadDeck } from '../review/store.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { loadScenarioProgress } from '../missions/progressStore.ts';
import { hasSpokenBefore, missionCompletionsFrom } from '../missions/chooserView.ts';
import { firstNameOf } from '../tutor/dashboard.ts';
import { momentumFrom, type Momentum } from '../progress/momentum.ts';
import { HomeMomentum } from '../home/HomeMomentum.tsx';
import { homeActionFor } from '../home/nextAction.ts';
import { useHomeRefresh } from '../home/useHomeRefresh.ts';

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
  const [rows, setRows] = useState<readonly CanDoRow[] | null>(null);
  const [story, setStory] = useState<WeekStory | null>(null);
  const [momentum, setMomentum] = useState<Momentum | null>(null);
  const [daily, setDaily] = useState(() => todayItems(0, Date.now()));
  const [due, setDue] = useState<ReviewCard[]>([]);
  const [recalled, setRecalled] = useState(false);
  const revision = useHomeRefresh(focused);
  useEffect(() => { setRecalled(false); }, [due[0]?.id]);
  const { snapshot: social } = useSocial();
  const friendsActivity = usefulFriends(social);

  // Re-read on every return: finishing a sitting anywhere in the app should be
  // visible here the moment the learner comes back to look, and a phone that
  // was asleep at midnight gets today's scene the moment it is opened.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const now = Date.now();
      // All independent reads cross the native storage bridge together.
      void Promise.all([loadActivity(), loadDeck(), loadMissionCompletions(), loadScenarioProgress(), loadActiveDays(), loadHistory(), loadConversationPacks()])
        .then(([activity, deck, completions, records, activeDays, history, packs]) => {
          if (cancelled) return;
          // The scene is pitched, so it waits. `scenariosForLevel` narrows the
          // pool to the learner's tier inside the rule, and the standing is the
          // app's one level rule, read rather than re-derived: a second opinion
          // about how far a learner has come would disagree with My French on
          // the tab next door.
          const standing = levelFor(totalXp(activity));
          setDaily(todayItems(standing.index, now));
          setDue(deck.filter(card => card.due <= now && card.kind !== 'phoneme'));
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
          setRows(canDoRows(stampsFrom(progress)));
          setStory(storyFrom({ sessions: history, activity, packs, completions, now }));
          setMomentum(momentumFrom({ activity, deck, profile, now, activeDays }));
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
    }, [profile, revision]),
  );

  return (
    // bottom="tab": the tab bar owns the bottom edge, so the frame leaves it the
    // inset rather than paying it twice on a notched phone.
    <ScrollScreen bottom="tab">
      <View>
        {/* The greeting and the hour's question in the editorial masthead.
            `title` is the still line, which is what a screen reader hears and
            what a learner who asked for less movement reads; `titleSwap` is the
            moving half, and it is null when nothing may move. */}
        <View style={st.head}>
          <TabHeader title={greeting.rest} titleSwap={greeting.swap} purpose={greeting.subline} trailing={<ProfileButton />} />
        </View>

        {/* The hero is outside every other gate. It is drawn for a learner with
            nothing behind them, and a gate around it would be a blank page on a
            first run. Null only means the storage read has not answered. */}
        {hero !== null && (homeActionFor(hero, due.length) === 'review' ?
          <Card style={{ gap: space(3) }}><Label>A little French to bring back</Label><Text style={[type.frenchLg, { color: paper.ink }]}>{due.length === 1 ? 'One phrase is ready.' : `${due.length} phrases are ready.`}</Text><Text style={[type.body, { color: paper.inkSoft }]}>Try recalling a few phrases from your own collection. A short review is enough.</Text><PillButton label="Practise recall" onPress={() => nav.navigate('Review')} /><GhostButton label="I’d rather speak" onPress={() => nav.navigate('Tutor')} /></Card>
          : <MissionHero hero={hero} />)}

        {momentum !== null && <HomeMomentum momentum={momentum} onPhrases={() => nav.navigate('Phrasebook')} onReview={() => nav.navigate('Review')} onTarget={() => nav.navigate('Profile')} />}
        <DailyCarousel word={daily.word} phrase={daily.phrase} />
        <HomeProgressDetails story={story} rows={rows} />
        {due[0] && <Card style={{ marginTop: space(4), gap: space(2) }}><Label>Keep this phrase</Label><Text style={[type.body, { color: paper.inkSoft }]}>From your own collection. How would you say this?</Text><Text style={[type.bodyStrong, { color: paper.ink }]}>{due[0].back}</Text>{recalled ? <Text style={[type.french, { color: paper.ink }]}>{due[0].front}</Text> : <GhostButton label="Reveal the French" onPress={() => setRecalled(true)} />}<GhostButton label="Practise my phrases" onPress={() => nav.navigate('Review')} /></Card>}
        {momentum !== null && usefulPace(momentum) && <Card style={{ marginTop: space(3), gap: space(1) }}>
          <Label>Today, at your pace</Label><Text style={[type.small, { color: paper.inkSoft }]}>{momentum.goal.note}</Text>
          <GhostButton label="Adjust my optional speaking target" onPress={() => nav.navigate('Profile')} />
        </Card>}
        {friendsActivity !== null && <Card style={{ marginTop: space(3), gap: space(2) }}><Label>French with friends</Label><Text style={[type.body, { color: paper.ink }]}>{friendsActivity}</Text><GhostButton label="Open my circle" onPress={() => nav.navigate('Friends')} /></Card>}
        <GhostButton label="Explore my daily collection" onPress={() => nav.navigate('DailyLibrary')} />
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  // Keep the greeting aligned to the shared masthead rather than floating art.
  head: { position: 'relative', marginTop: space(2) },
});
