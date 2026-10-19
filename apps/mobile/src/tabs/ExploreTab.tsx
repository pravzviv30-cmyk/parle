import { asSentences } from '../copy/spoken.ts';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useProfile } from '../app/ProfileContext.tsx';
import { practicePreferencesOf } from '../profile/practicePreferences.ts';
import { learningSuggestions } from '../main/learningSuggestions.ts';
import { useConversationStart } from '../main/useConversationStart.ts';
import { MainHeading, MainRow, MainScreen, MainText, MainButton } from '../main/MainUI.tsx';
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { EXPLORE_TOPICS, exploreMissions, explorePhrases, exploreScenarios, exploreTopicSeed, isExploreTopic, topicOf, type ExploreTopic } from '../main/exploreCatalogue.ts';
import { collectionCount, collectionCountLine, exploreCollection, PRACTICAL_COLLECTIONS, searchCollections, SKILL_COLLECTIONS } from '../main/exploreCollections.ts';
import { useExploreAccess } from '../purchases/useExploreAccess.ts';
import { dailyTutorVoice, tutorAudioFor } from '../daily/tutorAudio.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { MainIllustration } from '../illustrations/MainIllustration.tsx';
import { Press } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { space, type, HIT } from '../theme.ts';

/** A selective front door; collection details hold the full, real catalogue. */
export function ExploreTab() {
  const { colors, mode } = useMainAppearance(); const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile } = useProfile(); const suggestions = learningSuggestions(practicePreferencesOf(profile)); const conversation = useConversationStart();
  const access = useExploreAccess(); const voice = dailyTutorVoice(profile.tutorVoice);
  const route = useRoute(); const routeTopic = (route.params as { topic?: unknown } | undefined)?.topic;
  const [topic, setTopic] = useState<ExploreTopic | null>(isExploreTopic(routeTopic) ? routeTopic : null); const [query, setQuery] = useState(''); const [limit, setLimit] = useState(12);
  const { width, fontScale } = useWindowDimensions(); const single = width < 350 || fontScale >= 1.5; const active = useIsFocused();
  useEffect(() => { if (isExploreTopic(routeTopic)) setTopic(routeTopic); }, [routeTopic]);
  useEffect(() => setLimit(12), [topic, query]);
  const missions = useMemo(() => exploreMissions(query, topic), [query, topic]);
  const phrases = useMemo(() => explorePhrases(query, topic, suggestions.preferredTier), [query, topic, suggestions.preferredTier]);
  const scenarios = useMemo(() => exploreScenarios(query, topic, suggestions.preferredTier), [query, topic, suggestions.preferredTier]);
  const collections = useMemo(() => topic ? [] : searchCollections(query), [topic, query]);
  const searching = query.trim().length > 0 || topic !== null; const topicSeed = exploreTopicSeed(query, topic);
  const options = { tier: suggestions.preferredTier, audio: TUTOR_DAILY_AUDIO, voice };
  const clear = () => { setQuery(''); setTopic(null); nav.navigate('Explore', { topic: undefined }); };
  const openCollection = (id: string) => nav.navigate('ExploreCollection', { id });
  return <MainScreen title="Explore">
    <View style={[s.search, { backgroundColor: colors.surface }]}><Icon name="search" size={24} color={colors.text}/><TextInput value={query} onChangeText={setQuery} accessibilityLabel="Search topics, situations or French" placeholder="Search topics, situations or French" placeholderTextColor={colors.muted} style={[type.body, s.input, { color: colors.text }]} autoCorrect={false} returnKeyType="search"/></View>
    {searching && <MainButton tone="quiet" label="Clear search and topics" onPress={clear}/>}
    {!searching && <>
      <MainHeading>French for real life</MainHeading>
      <View style={[s.grid, single && { flexDirection: 'column' }]}>{EXPLORE_TOPICS.slice(0, 4).map(t => {
        const collection = exploreCollection(`topic:${t.key}`)!;
        return <Press key={t.key} accessibilityRole="button" onPress={() => openCollection(collection.id)} frame={[s.topicFrame, single && s.topicFrameSingle]} style={[s.tile, { backgroundColor: colors[t.tone] }]}><MainIllustration motif={t.motif} theme={mode} width={132} active={active}/><Text style={[type.label, { color: colors.text }]}>{t.title}</Text><Text style={[type.small, { color: colors.muted }]}>{collectionCountLine(collection, collectionCount(collection, options))}</Text></Press>;
      })}</View>
      <MainButton tone="quiet" label={`Browse all ${EXPLORE_TOPICS.length} topics`} onPress={() => openCollection('everyday')}/>
      <MainHeading>For your next conversation</MainHeading>
      {suggestions.ideas.map(idea => <MainRow key={idea.fr} title={idea.title} detail={`${idea.detail} Live tutor conversation.`} disabled={conversation.checking} onPress={() => conversation.start({ seedTopic: { fr: idea.fr, en: idea.en } })}/>)}
      <MainHeading>A little practice</MainHeading>
      {SKILL_COLLECTIONS.map(collection => <MainRow key={collection.id} title={collection.id === 'guided-situations' && !suggestions.fresh ? 'Guided basics, if you want a refresher' : collection.title} detail={asSentences([collection.outcome, collectionCountLine(collection, collectionCount(collection, options))])} onPress={() => openCollection(collection.id)}/>)}
      <MainHeading>Take the conversation further</MainHeading>
      {[...PRACTICAL_COLLECTIONS].sort((a, b) => suggestions.fluent ? Number(b.id === 'tell-it-your-way') - Number(a.id === 'tell-it-your-way') : 0).map(collection => <MainRow key={collection.id} title={collection.title} detail={asSentences([collection.outcome, collectionCountLine(collection, collectionCount(collection, options))])} onPress={() => openCollection(collection.id)}/>)}
    </>}
    {conversation.failed && <MainText>Your tutor could not connect. Browse the activities below or try Speak again.</MainText>}
    {searching && <>
      <MainHeading>{topic ? topicOf(topic).title : 'Search results'}</MainHeading>
      {collections.length > 0 && <><MainHeading>Collections</MainHeading>{collections.map(collection => <MainRow key={collection.id} title={collection.title} detail={collectionCountLine(collection, collectionCount(collection, options))} onPress={() => openCollection(collection.id)}/>)}</>}
      <MainHeading>Conversations</MainHeading>
      {scenarios.slice(0, limit).map(scenario => <MainRow key={scenario.id} title={scenario.titleEn} detail={asSentences([scenario.bodyEn, 'Tutor conversation', access.label({ kind: 'scenario', id: scenario.id }) ?? ''])} onPress={() => openCollection(scenario.id)}/>)}
      {scenarios.length === 0 && <MainText muted>No conversation starter matches this search. You can still bring the topic to your tutor.</MainText>}
      <MainHeading>Guided activities</MainHeading>
      {missions.map(m => <MainRow key={m.id} title={m.titleEn} detail={asSentences([m.goalEn, 'Guided beginner activity, with help and writing available'])} onPress={() => nav.navigate('Missions', { focus: m.id })}/>)}
      {missions.length === 0 && <MainText muted>No guided beginner activity matches this search.</MainText>}
      <MainRow title={topicSeed ? 'Talk about this topic' : 'Talk about your own topic'} detail="Start your own conversation with your tutor and change direction as you go." disabled={conversation.checking} onPress={() => topicSeed ? conversation.start({ seedTopic: topicSeed }) : nav.navigate('Tutor')}/>
    </>}
    <MainHeading>{searching ? 'Words & phrases' : suggestions.focusTitle}</MainHeading>
    {phrases.slice(0, searching ? limit : 3).map(item => <MainRow key={item.id} title={item.fr} detail={asSentences([item.en, tutorAudioFor(TUTOR_DAILY_AUDIO, item.id, voice) !== undefined ? 'Tutor recording. Hear and practise' : 'Read and practise'])} onPress={() => nav.navigate('DailyPractice', { id: item.id })}/>)}
    {phrases.length === 0 && <MainText>No phrases match yet. Try another word or browse a topic.</MainText>}
    {searching && (phrases.length > limit || scenarios.length > limit) && <MainButton label="Show more results" tone="quiet" onPress={() => setLimit(n => n + 12)}/>}
    {!searching && <MainRow title="Browse words and phrases" detail="Find a useful expression in French or English." onPress={() => nav.navigate('DailyLibrary')}/>}
    <MainRow title="From your conversations" detail="Practise phrases from your saved conversation notes in Journey." onPress={() => nav.navigate('MyFrench')}/>
  </MainScreen>;
}
const s = StyleSheet.create({ search: { minHeight: 56, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4) }, input: { flex: 1, minWidth: 0, minHeight: HIT }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }, topicFrame: { flexBasis: '47%', flexGrow: 1, minWidth: 0 }, topicFrameSingle: { width: '100%', flexBasis: 'auto', flexGrow: 0 }, tile: { flex: 1, alignSelf: 'stretch', padding: space(4), borderRadius: 24, gap: space(2), alignItems: 'flex-start', minWidth: 0 } });
