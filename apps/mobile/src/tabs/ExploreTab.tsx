/**
 * Explore, direction B (2026-10-20 UI-008, artboard B-Explore), in light and
 * dark.
 *
 * Top to bottom as drawn: the title and avatar, search, the four filter chips
 * in a row that runs off the edge, Prepare for something real, the four
 * illustrated topic tiles, Situations for you, the indigo next-conversation
 * card, A little practice as a bleeding row of every real door, Take the
 * conversation further with its Free sample pill or lock, and Words and
 * phrases with hear buttons. Every decision (what a filter keeps, a row's
 * meta, which drawing and badge a place takes, where a row goes) is
 * `main/exploreView.ts`'s or `main/exploreArt.ts`'s; this file is layout.
 * Prepare's lock comes only from `access/featureAccess.ts`.
 */

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MISSIONS } from '@luvani/core';
import { useProfile } from '../app/ProfileContext.tsx';
import { practicePreferencesOf } from '../profile/practicePreferences.ts';
import { learningSuggestions } from '../main/learningSuggestions.ts';
import { useConversationStart } from '../main/useConversationStart.ts';
import { EXPLORE_TOPICS, exploreMissions, explorePhrases, exploreScenarios, exploreTopicSeed, isExploreTopic, topicOf, type ExploreTopic } from '../main/exploreCatalogue.ts';
import { collectionCount, collectionCountLine, exploreCollection, PRACTICAL_COLLECTIONS, searchCollections, SKILL_COLLECTIONS, type ExploreCollection } from '../main/exploreCollections.ts';
import { collectionAccessNote, EXPLORE_FILTERS, phraseFacts, phraseMatches, realMomentParams, sectionShown, seedRowTitle, situationMeta, situationRoute, situationsFor, toggleFilter, type ExploreFilter } from '../main/exploreView.ts';
import { FURTHER_TILES, furtherBadge, metaParts, PRACTICE_CARDS, situationTile, TOPIC_TILES } from '../main/exploreArt.ts';
import { useFeatureAccess } from '../access/useFeatureAccess.ts';
import { useExploreAccess } from '../purchases/useExploreAccess.ts';
import { dailyTutorVoice, tutorAudioFor } from '../daily/tutorAudio.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { Ledger, LedgerRow, OutlineButton } from '../components.tsx';
import { Columns, ScrollScreen, TabHeader } from '../layout.tsx';
import { ProfileButton } from '../profile/ProfileButton.tsx';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { useHear } from '../scenes/useHear.ts';
import { MAX_SEED_TOPIC_CHARS } from '../tutor/realMoments.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { FilterRow, FurtherRow, ListCard, NextConversationCard, PracticeScroller, PrepareCard, SearchField, SectionHead, SituationRow, TopicTileCard, WordRow } from '../explore/ExploreParts.tsx';
import { bType } from '../theme.ts';

export function ExploreTab() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const t = useB();
  const st = useThemedStyles(makeStyles);
  const { profile } = useProfile(); const suggestions = learningSuggestions(practicePreferencesOf(profile)); const conversation = useConversationStart();
  const access = useExploreAccess();
  // The lock seam: re-renders on a standing change. Prepare's own door is App.tsx's locked RealMoment route.
  const locks = useFeatureAccess(); const voice = dailyTutorVoice(profile.tutorVoice); const tutorName = tutorNameOf(profile);
  const route = useRoute(); const routeTopic = (route.params as { topic?: unknown } | undefined)?.topic;
  const [topic, setTopic] = useState<ExploreTopic | null>(isExploreTopic(routeTopic) ? routeTopic : null); const [query, setQuery] = useState(''); const [limit, setLimit] = useState(12);
  const [filters, setFilters] = useState<ReadonlySet<ExploreFilter>>(new Set()); const [real, setReal] = useState('');
  const { width, fontScale } = useWindowDimensions(); const single = width < 350 || fontScale >= 1.5;
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
  // Every real practice door stays in the row (founder, 2026-10-20): Sound practice and the three skill collections.
  const practiceCards = [
    { key: 'sound', title: 'Sound practice', ...PRACTICE_CARDS.sound!, onPress: () => nav.navigate('SoundCheck') },
    ...SKILL_COLLECTIONS.map(collection => ({ key: collection.id, title: collection.id === 'guided-situations' && !suggestions.fresh ? 'Guided basics, if you want a refresher' : collection.title, ...(PRACTICE_CARDS[collection.id] ?? PRACTICE_CARDS.sound!), onPress: () => openCollection(collection.id) })),
  ];
  const furtherRows = [...PRACTICAL_COLLECTIONS].sort((a, b) => suggestions.fluent ? Number(b.id === 'tell-it-your-way') - Number(a.id === 'tell-it-your-way') : 0);
  const situationList = situations.slice(0, narrowing ? limit : 3);
  const topicTiles = EXPLORE_TOPICS.slice(0, 4).map(t => {
    const collection = exploreCollection(`topic:${t.key}`)!;
    return { key: t.key, title: t.title, tile: TOPIC_TILES[t.key]!, go: () => openCollection(collection.id) };
  });

  return <ScrollScreen bottom="tab" topGap={8}>
    <View style={st.page}>
      <View style={st.top}>
        <TabHeader title="Explore" trailing={<ProfileButton />} />
        <SearchField value={query} onChangeText={setQuery} placeholder="Search topics, situations or French" />
        <FilterRow filters={EXPLORE_FILTERS} chosen={filters} onToggle={key => setFilters(now => toggleFilter(now, key))} />
        {narrowing && <OutlineButton label={searching ? 'Clear search and filters' : 'Clear filters'} onPress={clear} />}
      </View>

      <Columns>
        <View style={st.column}>
          {shown('prepare') && <PrepareCard title="Prepare for something real" line={`Tell ${tutorName} what’s coming up`} label="What’s coming up?" value={real} onChangeText={setReal} placeholder="Dinner with my partner’s parents in Lyon" maxLength={MAX_SEED_TOPIC_CHARS} locked={locks.access('realMoment') === 'locked'} action="Build my practice" onAction={() => nav.navigate('RealMoment', realMomentParams(real))} />}

          {shown('topics') && <View style={st.stack}>
            <SectionHead title="French for real life" link={{ label: `All ${EXPLORE_TOPICS.length} topics`, onPress: () => openCollection('everyday') }} />
            <View style={[st.grid, single && st.gridSingle]}>{topicTiles.map(tile => (
              <View key={tile.key} style={[st.topicFrame, single && st.topicFrameSingle]}>
                <TopicTileCard tile={tile.tile} title={tile.title} onPress={tile.go} />
              </View>
            ))}</View>
          </View>}

          {searching && collections.length > 0 && <View style={st.stack}>
            <SectionHead title="Collections" />
            <Ledger>{collections.map(collection => <LedgerRow key={collection.id} title={collection.title} gloss={collectionCountLine(collection, collectionCount(collection, options))} onPress={() => openCollection(collection.id)} />)}</Ledger>
          </View>}

          {sectionShown('situations', filters) && <View style={st.stack}>
            <SectionHead title={topic ? topicOf(topic).title : searching ? 'Search results' : 'Situations for you'} link={!narrowing ? { label: 'See all', onPress: () => openCollection('everyday') } : undefined} />
            {situationList.length > 0 && <ListCard>{situationList.map((facts, index) => {
              const target = situationRoute(facts);
              // "free, offline" is never on a live situation (founder, 2026-10-20): the meta reads only the access label.
              const meta = metaParts(situationMeta(facts, facts.kind === 'scenario' ? access.label({ kind: 'scenario', id: facts.id }) : null));
              return <SituationRow key={facts.id} title={facts.title} practise={facts.practise} meta={meta} tile={situationTile(facts.topic)} last={index === situationList.length - 1} onPress={() => nav.navigate(target.screen, target.params)} />;
            })}</ListCard>}
            {situationList.length === 0 && <Text style={[bType.line16, { color: t.muted }]}>No situation matches yet. Try another word, or clear the filters.</Text>}
            {narrowing && situations.length > limit && <OutlineButton label="Show more situations" onPress={() => setLimit(n => n + 12)} />}
          </View>}

          {searching && <Ledger><LedgerRow title={seedRowTitle(topicSeed !== null, nothingFound)} gloss="Start your own conversation with your tutor and change direction as you go." disabled={conversation.checking} onPress={() => topicSeed ? conversation.start({ seedTopic: topicSeed }) : nav.navigate('Tutor')} /></Ledger>}
          {conversation.failed && <Text accessibilityLiveRegion="polite" style={[bType.line16, { color: t.text }]}>Your tutor could not connect. Browse the activities here or try Speak again.</Text>}
        </View>

        <View style={st.column}>
          {shown('next') && <NextConversationCard
            title="For your next conversation"
            line={`Live with ${tutorName}, picked for you`}
            ideas={suggestions.ideas.map(idea => ({ key: idea.fr, title: idea.title, detail: idea.fr, french: true }))}
            disabled={conversation.checking}
            onIdea={key => { const idea = suggestions.ideas.find(i => i.fr === key); if (idea) conversation.start({ seedTopic: { fr: idea.fr, en: idea.en } }); }}
          />}

          {shown('practice') && <View style={st.stack}>
            <SectionHead title="A little practice" />
            <PracticeScroller cards={practiceCards} />
          </View>}

          {shown('further') && <View style={st.stack}>
            <SectionHead title="Take the conversation further" />
            <ListCard>{furtherRows.map((collection, index) => {
              const art = FURTHER_TILES[collection.id];
              return <FurtherRow key={collection.id} title={collection.title} line={art?.line ?? collection.outcome} tile={art ?? FURTHER_TILES['plans-change']!} badge={furtherBadge(furtherNote(collection))} last={index === furtherRows.length - 1} onPress={() => openCollection(collection.id)} />;
            })}</ListCard>
          </View>}

          {sectionShown('words', filters) && <View style={st.stack}>
            <SectionHead title="Words and phrases" link={{ label: 'Browse all', onPress: () => nav.navigate('DailyLibrary') }} />
            {shownWords.length > 0 && <ListCard>{shownWords.map((item, index) => {
              const asset = tutorAudioFor(TUTOR_DAILY_AUDIO, item.id, voice);
              const hear = asset !== undefined || sound.deviceFrench ? { label: `Hear ${item.en}`, onPress: () => void sound.hear(item.fr, asset) } : null;
              return <WordRow key={item.id} fr={item.fr} en={item.en} hear={hear} last={index === shownWords.length - 1} onPress={() => nav.navigate('DailyPractice', { id: item.id })} />;
            })}</ListCard>}
            {shownWords.length === 0 && <Text style={[bType.line16, { color: t.muted }]}>No phrases match yet. Try another word or browse a topic.</Text>}
            {narrowing && words.length > limit && <OutlineButton label="Show more phrases" onPress={() => setLimit(n => n + 12)} />}
          </View>}

          <Ledger><LedgerRow title="From your conversations" gloss="Practise phrases from your saved conversation notes in Journey." onPress={() => nav.navigate('MyFrench')} /></Ledger>
        </View>
      </Columns>
    </View>
  </ScrollScreen>;
}

const makeStyles = (_t: B) =>
  StyleSheet.create({
    page: { gap: 24 },
    top: { gap: 14 },
    column: { gap: 24 },
    stack: { gap: 12 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridSingle: { flexDirection: 'column' },
    topicFrame: { flexBasis: '47%', flexGrow: 1, minWidth: 0 },
    topicFrameSingle: { width: '100%', flexBasis: 'auto', flexGrow: 0 },
  });
