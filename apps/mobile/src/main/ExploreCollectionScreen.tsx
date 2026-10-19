import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { seedTopicOf } from '@luvani/core';
import { useProfile } from '../app/ProfileContext.tsx';
import { practicePreferencesOf } from '../profile/practicePreferences.ts';
import { useExploreAccess } from '../purchases/useExploreAccess.ts';
import { dailyTutorVoice } from '../daily/tutorAudio.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { MainIllustration } from '../illustrations/MainIllustration.tsx';
import { Icon } from '../icons/Icon.tsx';
import { space, type, HIT, frenchText } from '../theme.ts';
import { MainButton, MainHeading, MainRow, MainScreen, MainText } from './MainUI.tsx';
import { useMainAppearance } from './MainAppearance.tsx';
import { learningSuggestions } from './learningSuggestions.ts';
import { scenarioTopic } from './exploreCatalogue.ts';
import { collectionCount, collectionCountLine, collectionItems, exploreCollection, exploreScenario, searchCollectionItems, TOPIC_COLLECTIONS, type ExploreAccessRef } from './exploreCollections.ts';
import { useConversationStart } from './useConversationStart.ts';

/** One root-stack destination for public collections and an existing scenario's preparation. */
export function ExploreCollectionScreen() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void; push: (screen: string, params?: object) => void; goBack: () => void; canGoBack: () => boolean }>();
  const route = useRoute();
  const id = (route.params as { id?: unknown } | undefined)?.id;
  const { colors, mode } = useMainAppearance(); const active = useIsFocused();
  const { profile } = useProfile(); const suggestions = learningSuggestions(practicePreferencesOf(profile));
  const voice = dailyTutorVoice(profile.tutorVoice); const conversation = useConversationStart();
  const access = useExploreAccess();
  const collection = exploreCollection(id); const scenario = exploreScenario(id);
  const accessLabel = scenario ? access.label({ kind: 'scenario', id: scenario.id }) : null;
  const needsPlan = accessLabel === 'Included with a plan';
  const [query, setQuery] = useState(''); const [limit, setLimit] = useState(12); const [showLines, setShowLines] = useState(false);
  useEffect(() => { setQuery(''); setLimit(12); setShowLines(false); }, [id]);
  useEffect(() => setLimit(12), [query]);
  const options = useMemo(() => ({ tier: suggestions.preferredTier, voice, audio: TUTOR_DAILY_AUDIO }), [suggestions.preferredTier, voice]);
  const items = useMemo(() => collection ? collectionItems(collection, options) : [], [collection, options]);
  const filtered = useMemo(() => searchCollectionItems(items, query), [items, query]);
  const back = () => nav.canGoBack() ? nav.goBack() : nav.navigate('Tabs');
  // Single action seam for content availability. The live tutor retains its own server admission.
  const openContent = (ref: ExploreAccessRef, textMode?: boolean) => {
    if (ref.kind === 'scenario') {
      const source = exploreScenario(ref.id);
      if (source) void access.open(ref, () => conversation.start({ seedTopic: seedTopicOf(source) }, textMode));
    } else if (ref.kind === 'daily') nav.navigate('DailyPractice', { id: ref.id });
    else nav.navigate('Missions', { focus: ref.id });
  };
  if (!collection && !scenario) return <MainScreen title="Collection unavailable" onBack={back}><MainText>This collection is not in this version of Luvani. You can still find a conversation or practise a phrase in Explore.</MainText><MainButton label="Browse Explore" onPress={() => nav.navigate('Tabs', { screen: 'Explore' })}/></MainScreen>;
  if (scenario) return <MainScreen title={scenario.titleEn} onBack={back}>
    <View style={[s.art, { backgroundColor: colors[scenarioTopic(scenario).tone] }]}>
      <MainIllustration motif={scenario.place === 'street' || scenario.place === 'hotel' ? 'travel' : scenario.place === 'cafe' || scenario.place === 'market' ? 'market' : 'talk'} theme={mode} width={260} active={active}/>
    </View>
    <MainText>{scenario.bodyEn}</MainText>
    {accessLabel !== null && <MainText muted>{accessLabel}</MainText>}
    <MainText muted>Speak or write with your tutor. You can follow this situation or take the conversation in your own direction.</MainText>
    <MainText muted>Conversations use your available tutor time.</MainText>
    <MainButton label={access.checking ? 'Checking your plan…' : conversation.checking ? 'Connecting…' : needsPlan ? 'View plans to start' : 'Start talking'} disabled={access.checking || conversation.checking} onPress={() => openContent({ kind: 'scenario', id: scenario.id })}/>
    <MainButton label={needsPlan ? 'View plans to write' : 'Write instead'} tone="quiet" disabled={access.checking || conversation.checking} onPress={() => openContent({ kind: 'scenario', id: scenario.id }, true)}/>
    {access.error !== null && <View accessibilityLiveRegion="polite"><MainText>{access.error}</MainText></View>}
    {conversation.failed && <MainText>Your tutor could not connect. Read the useful phrases below, or try again when you are connected.</MainText>}
    <MainHeading>A little preparation</MainHeading><MainText muted>Try your own words first, or look at a few things you could say.</MainText>
    <MainButton label={showLines ? 'Hide useful phrases' : 'Show useful phrases'} tone="quiet" onPress={() => setShowLines(value => !value)}/>
    {showLines && scenario.lines.map(line => <View key={line.fr} style={[s.phrase, { backgroundColor: colors.surface }]}><Text {...frenchText} style={[type.body, { color: colors.text }]}>{line.fr}</Text><MainText muted>{line.en}</MainText></View>)}
    <MainRow title="Your saved conversations" detail="After a session, revisit its saved learning notes and practise the phrases in Journey." onPress={() => nav.navigate('Tabs', { screen: 'MyFrench' })}/>
  </MainScreen>;
  if (!collection) return null;
  return <MainScreen title={collection.title} onBack={back}>
    <View style={[s.art, { backgroundColor: colors[collection.tone] }]}><MainIllustration motif={collection.motif} theme={mode} width={260} active={active}/></View>
    <MainText>{collection.outcome}</MainText>
    <MainText muted>{collectionCountLine(collection, collection.kind === 'topics' ? TOPIC_COLLECTIONS.length : items.length)}. {collection.kind === 'scenarios' ? 'Choose any starting point. There is no set order.' : collection.id === 'hear-and-practise' ? 'Record and compare locally. This activity does not score pronunciation.' : collection.kind === 'missions' ? 'Beginner material stays available whenever you want a refresher.' : 'Read the context and try the expression when it is useful.'}</MainText>
    {collection.kind === 'topics' ? TOPIC_COLLECTIONS.map(child => <MainRow key={child.id} title={child.title} detail={collectionCountLine(child, collectionCount(child, options))} onPress={() => nav.push('ExploreCollection', { id: child.id })}/>) : <>
      <View style={[s.search, { backgroundColor: colors.surface }]}><Icon name="search" size={24} color={colors.text}/><TextInput value={query} onChangeText={setQuery} accessibilityLabel={`Search ${collection.title}`} placeholder="Search this collection" placeholderTextColor={colors.muted} style={[type.body, s.input, { color: colors.text }]} autoCorrect={false} returnKeyType="search"/></View>
      {filtered.slice(0, limit).map(item => <MainRow key={item.id} title={item.title} detail={`${item.detail} ${item.kind === 'scenario' ? 'Tutor conversation.' : item.kind === 'daily' ? item.hasAudio ? 'Tutor recording. Hear and practise.' : 'Text and local recording.' : 'Writing is available.'}${access.label(item) ? ` ${access.label(item)}.` : ''}`} onPress={() => item.kind === 'scenario' ? nav.push('ExploreCollection', { id: item.id }) : openContent(item)}/>)}
      {filtered.length === 0 && <><MainText>{query.trim() ? 'Nothing matches that search. Try another word in French or English.' : collection.id === 'hear-and-practise' ? 'No recordings are available in your selected tutor’s voice in this version. You can still read and practise useful phrases.' : 'No activities are available in this collection in this version.'}</MainText><MainButton tone="quiet" label={query.trim() ? 'Clear search' : 'Browse words and phrases'} onPress={() => query.trim() ? setQuery('') : nav.navigate('DailyLibrary')}/></>}
      {filtered.length > limit && <MainButton label="Show more" tone="quiet" onPress={() => setLimit(n => n + 12)}/>}
    </>}
  </MainScreen>;
}
const s = StyleSheet.create({ art: { padding: space(4), borderRadius: 24, alignItems: 'center' }, search: { minHeight: 56, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4) }, input: { flex: 1, minWidth: 0, minHeight: HIT }, phrase: { gap: space(2), padding: space(4), borderRadius: 20 } });
