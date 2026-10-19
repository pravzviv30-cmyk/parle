import { MISSIONS, isEarned, missionStates } from '@luvani/core';
import { useNavigation } from '@react-navigation/native';
import { MainFeature, MainHeading, MainRow, MainScreen, MainText } from '../main/MainUI.tsx';
import { useMainLearning } from '../main/useMainLearning.ts';
import { allConversations } from '../myfrench/recentConversations.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { goalRows, goalRouteKey } from '../goals/rows.ts';
import { useStreak } from '../game/GameProvider.tsx';
import { LevelXpCard } from '../game/LevelXpCard.tsx';
import { StreakSummaryCard } from '../game/StreakSummaryCard.tsx';
import { CountsGrid } from '../game/CountsGrid.tsx';
import { BadgeShelf } from '../game/BadgeShelf.tsx';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
/** Progress reports saved evidence; it never creates an achievement by opening. */
export function MyFrenchTab() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile } = useProfile(); const run = useStreak();
  const goals = goalRows(profile.learnerGoals, MISSIONS);
  const { data, failed, reload } = useMainLearning();
  const history = data ? allConversations({ packs: data.packs, events: data.history }) : [];
  const worked = history.filter(item => item.line !== null);
  const earned = data ? missionStates(missionCompletionsFrom(data.completions), data.deck, Date.now()).filter(isEarned) : [];
  return <MainScreen title="Your progress">
    <MainFeature title={'See what\nyou’ve practised.'} motif="journal" tone="ochre" body="See the French you used and came back to." action={{ label: 'View learning history', onPress: () => nav.navigate('Library', { view: 'conversations' }) }}/>
    {failed ? <><MainText>Your learning history could not be loaded.</MainText><MainRow title="Try loading again" onPress={reload}/></> : !data ? <MainText muted>Loading your learning history…</MainText> : <>
      {worked.length > 0 && <MainHeading>What you’ve worked on</MainHeading>}
      {worked.slice(0, 6).map(item => <MainRow key={item.pack.id} title={item.pack.title.en} detail={item.line ?? undefined} onPress={() => nav.navigate('Conversations', { packId: item.pack.id })}/>)}
      {earned.length > 0 && <MainHeading>French you can use</MainHeading>}
      {earned.map(item => <MainRow key={item.mission.id} title={item.mission.earnedEn} detail="From your completed speaking practice." onPress={() => nav.navigate('Missions', { focus: item.mission.id })}/>)}
      {worked.length === 0 && earned.length === 0 && <><MainHeading>Your French starts here</MainHeading><MainText>Conversations and completed practice will give you examples to look back on.</MainText><MainRow title="Start a conversation" onPress={() => nav.navigate('Tutor')}/></>}
    </>}
    {data !== null && run !== null && run.lifetimeDays > 0 && <>
      <MainHeading>Your practice, over time</MainHeading><LevelXpCard/><StreakSummaryCard/>
      <CountsGrid phrases={data.deck.filter(card => card.kind !== 'phoneme').length} conversations={data.packs.filter(pack => pack.state === 'ready').length}/><BadgeShelf/>
    </>}
    {goals.length > 0 && <MainHeading>What you’re working towards</MainHeading>}
    {goals.map(row => <MainRow key={goalRouteKey(row.goal)} title={row.goal} detail={row.line ?? undefined} onPress={() => nav.navigate('GoalStep', { key: goalRouteKey(row.goal) })}/>)}
    <MainHeading>Keep going</MainHeading><MainRow title="Your pronunciation" detail="Look back at measured sound checks and practise a sound." onPress={() => nav.navigate('SoundJourney')}/>
    <MainRow title="Your practice rhythm" detail="Your recorded days of French and personal goal." onPress={() => nav.navigate('Streak')}/>
    <MainRow title="Practise your saved French" detail="Remember a reply, then use it for something new." onPress={() => nav.navigate('Library', { view: 'practise' })}/><MainRow title="Your week in French" detail="A story from your recorded learning." onPress={() => nav.navigate('WeekWrapped')}/><MainRow title="Your places and milestones" onPress={() => nav.navigate('Postcards')}/>
  </MainScreen>;
}
