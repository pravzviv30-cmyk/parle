/**
 * Explore, direction B (B1, 2026-10-20, artboard B-Explore).
 *
 * A selective front door on the shared frame: search, four derived filters,
 * then the sections in the artboard's order. Collection details hold the full,
 * real catalogue. Every decision (what a filter keeps, a row's meta line,
 * which section stands, where a row goes) is `main/exploreView.ts`'s; this
 * file is layout. Lock badges come only from `access/featureAccess.ts`.
 */

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { MISSIONS } from '@luvani/core';
import { useProfile } from '../app/ProfileContext.tsx';
import { practicePreferencesOf } from '../profile/practicePreferences.ts';
import { learningSuggestions } from '../main/learningSuggestions.ts';
import { useConversationStart } from '../main/useConversationStart.ts';
import { EXPLORE_TOPICS, exploreMissions, explorePhrases, exploreScenarios, exploreTopicSeed, isExploreTopic, topicOf, type ExploreTopic } from '../main/exploreCatalogue.ts';
import { collectionCount, collectionCountLine, exploreCollection, PRACTICAL_COLLECTIONS, searchCollections, SKILL_COLLECTIONS, type ExploreCollection } from '../main/exploreCollections.ts';
import { collectionAccessNote, EXPLORE_FILTERS, phraseFacts, phraseMatches, realMomentParams, sectionShown, seedRowTitle, situationMeta, situationRoute, situationsFor, toggleFilter, type ExploreFilter } from '../main/exploreView.ts';
import { useFeatureAccess } from '../access/useFeatureAccess.ts';
import { useExploreAccess } from '../purchases/useExploreAccess.ts';
import { dailyTutorVoice, tutorAudioFor } from '../daily/tutorAudio.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { MainIllustration } from '../illustrations/MainIllustration.tsx';
import { Card, Chip, ColourCard, Field, IconAction, Ledger, LedgerRow, LockBadge, OutlineButton, PillButton } from '../components.tsx';
import { Columns, ScrollScreen, TabHeader } from '../layout.tsx';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { useHear } from '../scenes/useHear.ts';
import { Icon } from '../icons/Icon.tsx';
import { DEVICE_VOICE, RECORDED_AUDIO, TEXT_ONLY } from '../copy/access.ts';
import { MAX_SEED_TOPIC_CHARS } from '../tutor/realMoments.ts';
import { decorative, onColour, paper, space, textOn, type, HIT } from '../theme.ts';

/** The four pastels the artboard sets under the illustrated tiles, by catalogue tone. */
const TILE_GROUND = { rose: 'pastel.peach', plum: 'pastel.lavender', teal: 'pastel.sage', ochre: 'pastel.butter' } as const;

export function ExploreTab() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { profile } = useProfile(); const suggestions = learningSuggestions(practicePreferencesOf(profile)); const conversation = useConversationStart();
  const access = useExploreAccess();
  // The lock seam: re-renders on a standing change. Prepare's own door is App.tsx's locked RealMoment route.
  const locks = useFeatureAccess(); const voice = dailyTutorVoice(profile.tutorVoice); const tutorName = tutorNameOf(profile);
  const route = useRoute(); const routeTopic = (route.params as { topic?: unknown } | undefined)?.topic;
  const [topic, setTopic] = useState<ExploreTopic | null>(isExploreTopic(routeTopic) ? routeTopic : null); const [query, setQuery] = useState(''); const [limit, setLimit] = useState(12);
  const [filters, setFilters] = useState<ReadonlySet<ExploreFilter>>(new Set()); const [real, setReal] = useState('');
  const { width, fontScale } = useWindowDimensions(); const single = width < 350 || fontScale >= 1.5; const active = useIsFocused();
  const sound = useHear();
  useEffect(() => { if (isExploreTopic(routeTopic)) setTopic(routeTopic); }, [routeTopic]);
  useEffect(() => setLimit(12), [topic, query, filters]);
  const env = useMemo(() => ({ audio: TUTOR_DAILY_AUDIO, voice }), [voice]);
  const missions = useMemo(() => exploreMissions(query, topic), [query, topic]);
  const phrases = useMemo(() => explorePhrases(query, topic, suggestions.preferredTier), [query, topic, suggestions.preferredTier]);
  const scenarios = useMemo(() => exploreScenarios(query, topic, suggestions.preferredTier), [query, topic, suggestions.preferredTier]);
  const collections = useMemo(() => topic ? [] : searchCollections(query), [topic, query]);
  const searching = query.trim().length > 0 || topic !== null; const topicSeed = exploreTopicSeed(query, topic);
  const narrowing = searching || filters.size > 0;
  const situations = useMemo(() => situationsFor(scenarios, searching ? missions : MISSIONS, filters, env, narrowing ? limit + 1 : 3), [scenarios, missions, searching, filters, env, narrowing, limit]);
  const words = useMemo(() => phrases.filter(item => phraseMatches(phraseFacts(item, env), filters)), [phrases, filters, env]);
  const shownWords = words.slice(0, narrowing ? limit : 3);
  const options = { tier: suggestions.preferredTier, audio: TUTOR_DAILY_AUDIO, voice };
  const nothingFound = situations.length === 0 && words.length === 0 && collections.length === 0;
  const clear = () => { setQuery(''); setTopic(null); setFilters(new Set()); nav.navigate('Explore', { topic: undefined }); };
  const openCollection = (id: string) => nav.navigate('ExploreCollection', { id });
  const shown = (section: Parameters<typeof sectionShown>[0]) => !searching && sectionShown(section, filters);
  const furtherNote = (collection: ExploreCollection) => collectionAccessNote((collection.refs ?? []).map(ref => access.label(ref)));
  const practiceTiles = [
    { key: 'sound', title: 'Sound practice', detail: 'One sound at a time', motif: 'listen' as const, ground: 'pastel.lavender' as const, go: () => nav.navigate('SoundCheck') },
    ...SKILL_COLLECTIONS.map(collection => ({ key: collection.id, title: collection.id === 'guided-situations' && !suggestions.fresh ? 'Guided basics, if you want a refresher' : collection.title, detail: collectionCountLine(collection, collectionCount(collection, options)), motif: collection.motif, ground: TILE_GROUND[collection.tone], go: () => openCollection(collection.id) })),
  ];

  const tile = (key: string, title: string, detail: string, motif: Parameters<typeof MainIllustration>[0]['motif'], ground: typeof TILE_GROUND[keyof typeof TILE_GROUND], go: () => void) => (
    <View key={key} style={[st.topicFrame, single && st.topicFrameSingle]}>
      <ColourCard ground={ground} lift onPress={go} accessibilityLabel={`${title}, ${detail}`} style={st.tile}>
        <View {...decorative} style={st.tileArt}><MainIllustration motif={motif} width={132} active={active} /></View>
        <Text style={[type.label, { color: paper.ink }]}>{title}</Text>
        <Text style={[type.small, { color: paper.inkOnPastel }]}>{detail}</Text>
      </ColourCard>
    </View>
  );

  const situationList = situations.slice(0, narrowing ? limit : 3);

  return <ScrollScreen bottom="tab">
    <TabHeader title="Explore" trailing={<ProfileButton />} />
    <View style={st.page}>
      <View style={st.search}><Icon name="search" size={24} color={paper.ink} /><TextInput value={query} onChangeText={setQuery} accessibilityLabel="Search topics, situations or French" placeholder="Search topics, situations or French" placeholderTextColor={paper.inkSoft} style={[type.body, st.input, { color: paper.ink }]} autoCorrect={false} returnKeyType="search" /></View>
      <View accessibilityRole="toolbar" accessibilityLabel="Filters" style={st.chips}>
        {EXPLORE_FILTERS.map(f => <Chip key={f.key} variant="filter" role="button" label={f.label} selected={filters.has(f.key)} onPress={() => setFilters(now => toggleFilter(now, f.key))} />)}
      </View>
      {narrowing && <OutlineButton label={searching ? 'Clear search and filters' : 'Clear filters'} onPress={clear} />}

      <Columns>
        <View style={st.column}>
          {shown('prepare') && <Card style={st.stack}>
            <View style={st.titleRow}><Text accessibilityRole="header" style={[type.heading, st.grow, { color: paper.ink }]}>Prepare for something real</Text>{locks.access('realMoment') === 'locked' && <LockBadge />}</View>
            <Text style={[type.small, { color: paper.inkSoft }]}>{`Tell ${tutorName} what’s coming up`}</Text>
            <Field label="What’s coming up?" value={real} onChangeText={setReal} placeholder="Dinner with my partner’s parents in Lyon" autoCapitalize="sentences" returnKeyType="done" maxLength={MAX_SEED_TOPIC_CHARS} />
            <PillButton label="Build my practice" onPress={() => nav.navigate('RealMoment', realMomentParams(real))} />
          </Card>}

          {shown('topics') && <View style={st.stack}>
            <View style={st.titleRow}><Text accessibilityRole="header" style={[type.heading, st.grow, { color: paper.ink }]}>French for real life</Text><OutlineButton label={`All ${EXPLORE_TOPICS.length} topics`} onPress={() => openCollection('everyday')} /></View>
            <View style={[st.grid, single && { flexDirection: 'column' }]}>{EXPLORE_TOPICS.slice(0, 4).map(t => {
              const collection = exploreCollection(`topic:${t.key}`)!;
              return tile(t.key, t.title, collectionCountLine(collection, collectionCount(collection, options)), t.motif, TILE_GROUND[t.tone], () => openCollection(collection.id));
            })}</View>
          </View>}

          {searching && collections.length > 0 && <View style={st.stack}>
            <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>Collections</Text>
            <Ledger>{collections.map(collection => <LedgerRow key={collection.id} title={collection.title} gloss={collectionCountLine(collection, collectionCount(collection, options))} onPress={() => openCollection(collection.id)} />)}</Ledger>
          </View>}

          {sectionShown('situations', filters) && <View style={st.stack}>
            <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{topic ? topicOf(topic).title : searching ? 'Search results' : 'Situations for you'}</Text>
            {situationList.length > 0 && <Ledger>{situationList.map(facts => {
              const target = situationRoute(facts);
              return <LedgerRow key={facts.id} title={facts.title} gloss={facts.practise} note={situationMeta(facts, facts.kind === 'scenario' ? access.label({ kind: 'scenario', id: facts.id }) : null)} onPress={() => nav.navigate(target.screen, target.params)} />;
            })}</Ledger>}
            {situationList.length === 0 && <Text style={[type.body, { color: paper.inkSoft }]}>No situation matches yet. Try another word, or clear the filters.</Text>}
            {narrowing && situations.length > limit && <OutlineButton label="Show more situations" onPress={() => setLimit(n => n + 12)} />}
          </View>}

          {searching && <Ledger><LedgerRow title={seedRowTitle(topicSeed !== null, nothingFound)} gloss="Start your own conversation with your tutor and change direction as you go." disabled={conversation.checking} onPress={() => topicSeed ? conversation.start({ seedTopic: topicSeed }) : nav.navigate('Tutor')} /></Ledger>}
          {conversation.failed && <Text accessibilityLiveRegion="polite" style={[type.body, { color: paper.ink }]}>Your tutor could not connect. Browse the activities here or try Speak again.</Text>}
        </View>

        <View style={st.column}>
          {shown('next') && <ColourCard ground="blue">
            <View style={st.stack}>
              <Text accessibilityRole="header" style={[type.heading, { color: textOn.blue }]}>For your next conversation</Text>
              <Text style={[type.small, { color: onColour.blue }]}>{`Live with ${tutorName}, picked for you`}</Text>
            </View>
            {/* Ink rows need a white ground: on the blue they fail the 4.5 floor. */}
            <Card padded={false} style={st.ideas}><Ledger>{suggestions.ideas.map(idea => <LedgerRow key={idea.fr} title={idea.title} gloss={idea.detail} disabled={conversation.checking} onPress={() => conversation.start({ seedTopic: { fr: idea.fr, en: idea.en } })} />)}</Ledger></Card>
          </ColourCard>}

          {shown('practice') && <View style={st.stack}>
            <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>A little practice</Text>
            <View style={[st.grid, single && { flexDirection: 'column' }]}>{practiceTiles.map(p => tile(p.key, p.title, p.detail, p.motif, p.ground, p.go))}</View>
          </View>}

          {shown('further') && <View style={st.stack}>
            <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>Take the conversation further</Text>
            <Ledger>{[...PRACTICAL_COLLECTIONS].sort((a, b) => suggestions.fluent ? Number(b.id === 'tell-it-your-way') - Number(a.id === 'tell-it-your-way') : 0).map(collection => (
              <LedgerRow key={collection.id} title={collection.title} gloss={collection.outcome} note={furtherNote(collection)} onPress={() => openCollection(collection.id)} />
            ))}</Ledger>
          </View>}

          {sectionShown('words', filters) && <View style={st.stack}>
            <View style={st.titleRow}><Text accessibilityRole="header" style={[type.heading, st.grow, { color: paper.ink }]}>Words and phrases</Text><OutlineButton label="Browse all" onPress={() => nav.navigate('DailyLibrary')} /></View>
            {shownWords.length > 0 && <Ledger>{shownWords.map(item => {
              const asset = tutorAudioFor(TUTOR_DAILY_AUDIO, item.id, voice);
              return <View key={item.id} style={st.wordRow}>
                <View style={st.grow}><LedgerRow lang="fr" title={item.fr} gloss={item.en} note={asset !== undefined ? RECORDED_AUDIO : sound.deviceFrench ? DEVICE_VOICE : TEXT_ONLY} onPress={() => nav.navigate('DailyPractice', { id: item.id })} /></View>
                {(asset !== undefined || sound.deviceFrench) && <IconAction layout="inline" icon="speaker" label="Hear" accessibilityLabel={`Hear ${item.en}`} onPress={() => void sound.hear(item.fr, asset)} />}
              </View>;
            })}</Ledger>}
            {shownWords.length === 0 && <Text style={[type.body, { color: paper.inkSoft }]}>No phrases match yet. Try another word or browse a topic.</Text>}
            {narrowing && words.length > limit && <OutlineButton label="Show more phrases" onPress={() => setLimit(n => n + 12)} />}
          </View>}

          <Ledger><LedgerRow title="From your conversations" gloss="Practise phrases from your saved conversation notes in Journey." onPress={() => nav.navigate('MyFrench')} /></Ledger>
        </View>
      </Columns>
    </View>
  </ScrollScreen>;
}

const st = StyleSheet.create({
  page: { gap: space(6) },
  column: { gap: space(6) },
  stack: { gap: space(3) },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space(2) },
  grow: { flex: 1, minWidth: 0 },
  search: { minHeight: 56, borderRadius: 999, backgroundColor: paper.card, flexDirection: 'row', alignItems: 'center', gap: space(2.5), paddingHorizontal: space(4.5) },
  input: { flex: 1, minWidth: 0, minHeight: HIT },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  topicFrame: { flexBasis: '47%', flexGrow: 1, minWidth: 0 },
  topicFrameSingle: { width: '100%', flexBasis: 'auto', flexGrow: 0 },
  tile: { flex: 1, padding: space(4), gap: space(1) },
  tileArt: { alignItems: 'center' },
  ideas: { paddingHorizontal: space(4) },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: HIT },
});
