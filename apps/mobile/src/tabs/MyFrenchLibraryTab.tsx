import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View, type ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Press } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { MainButton, MainFeature, MainRow, MainScreen } from '../main/MainUI.tsx';
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { colour, frenchText, paper, radius, space, type } from '../theme.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { useLibraryData } from '../practice/useLibraryData.ts';
import { conversationsMatching, conversationTopics, conversationStateLine, libraryPhrases } from '../practice/library.ts';
import { relativeDay } from '../practice/sessionCard.ts';
import { recommendation, packSelection } from '../practice/recommendation.ts';
import { resumableOf } from '../practice/opening.ts';
import { offersMix } from '../practice/mix.ts';
import { practiceRouteParams } from '../practice/practiceRoute.ts';
import { dailyTutorVoice } from '../daily/tutorAudio.ts';
import { DAILY_ITEMS } from '../daily/catalogue.ts';
import { TUTOR_DAILY_AUDIO } from '../daily/tutorAudioManifest.ts';
import { shadowingPhrase } from '../daily/shadowing.ts';
import { scopeGeneration } from '../storage/scope.ts';

export type MyFrenchView = 'conversations' | 'practise' | 'saved';
const VIEWS = [
  { key: 'conversations', label: 'Conversations' },
  { key: 'practise', label: 'Practise' },
  { key: 'saved', label: 'Saved' },
] as const;

/** Three views of the learner's existing material; one permanent place to return. */
export function MyFrenchLibraryTab({ initialView = 'conversations' }: { initialView?: MyFrenchView }) {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { colors } = useMainAppearance();
  const { profile } = useProfile();
  const { adapter } = useAuth();
  const [view, setView] = useState<MyFrenchView>(initialView);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [view]);
  const [query, setQuery] = useState('');
  const [phraseQuery, setPhraseQuery] = useState('');
  const [topic, setTopic] = useState<string | null>(null);
  const [allTopics, setAllTopics] = useState(false);
  const accountScope = scopeGeneration();
  useEffect(() => { setQuery(''); setPhraseQuery(''); setTopic(null); setAllTopics(false); setView(initialView); }, [accountScope, initialView]);
  const library = useLibraryData();
  const { data } = library;
  const now = Date.now();
  const topics = useMemo(() => conversationTopics(data?.page ?? []), [data?.page]);
  const shown = useMemo(() => conversationsMatching(data?.page ?? [], query, topic), [data?.page, query, topic]);
  const phrases = useMemo(() => libraryPhrases(data?.deck ?? [], data?.packs ?? [], phraseQuery), [data?.deck, data?.packs, phraseQuery]);
  const rec = data === null ? null : recommendation({ resumable: resumableOf(data.session, data.packs, data.bank), deck: data.deck, bank: data.bank, packs: data.packs, now });
  const localPhrase = shadowingPhrase(DAILY_ITEMS, TUTOR_DAILY_AUDIO, dailyTutorVoice(profile.tutorVoice));
  const canMix = data !== null && offersMix(data.deck.filter(card => data.bank.some(exercise => exercise.phraseKey === card.id)), data.topics, now);
  const open = (screen: string, params?: object) => { if (library.ownsNow()) nav.navigate(screen, params); };
  const openPack = (packId: string) => open('Conversations', { packId });
  const ready = data?.packs.filter(pack => pack.state === 'ready' && packSelection({ packId: pack.id, packs: data.packs, deck: data.deck, bank: data.bank, now }) !== null) ?? [];

  const search = (value: string, change: (query: string) => void, label: string) => (
    <View style={[st.search, { backgroundColor: colors.surface }]}>
      <Icon name="search" color={colors.text} size={space(5.5)} />
      <TextInput accessibilityLabel={label} value={value} onChangeText={change} placeholder={label}
        placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} returnKeyType="search"
        style={[type.small, st.searchInput, { color: colors.text }]} />
      {value !== '' && <Press accessibilityLabel="Clear search" onPress={() => change('')} style={st.clear}><Icon name="close" color={colors.text} size={space(5)} /></Press>}
    </View>
  );
  const heading = (label: string) => <Text accessibilityRole="header" style={[type.heading, { color: colors.text }]}>{label}</Text>;
  const note = (label: string) => <Text style={[type.small, { color: colors.muted }]}>{label}</Text>;
  const empty = (title: string, body: string, action?: ReactNode) => <View style={[st.empty, { backgroundColor: colors.surface }]}>{heading(title)}<Text style={[type.body, { color: colors.muted }]}>{body}</Text>{action}</View>;

  return <MainScreen title={view === 'practise' ? 'Practise' : view === 'saved' ? 'Saved' : 'My French'} scrollRef={scroll}>
    <View accessibilityRole="tablist" style={[st.views, { backgroundColor: colors.inset }]}>
      {VIEWS.map(item => <Press key={item.key} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: item.key === view }}
        aria-selected={item.key === view} frame={st.viewFrame} onPress={() => setView(item.key)} style={[st.view, item.key === view && { backgroundColor: colour.blue }]}>
        <Text style={[type.small, st.viewLabel, { color: item.key === view ? coloursOnSelection : colors.text }]}>{item.label}</Text>
      </Press>)}
    </View>

    {data === null && !library.failed && <View style={st.loading}><ActivityIndicator color={colors.text} accessibilityLabel="Loading My French" />{note('Loading your conversations and phrases…')}</View>}
    {library.failed && data === null && empty('Your French couldn’t be loaded.', 'Try again to open your saved material.', <MainButton label="Try again" onPress={library.retry} />)}
    {library.failed && data !== null && <View accessibilityLiveRegion="polite" style={[st.notice, { backgroundColor: colors.inset }]}>{note('Your latest saved material could not be checked. Try loading it again.')}<MainButton label="Try again" tone="quiet" onPress={library.retry} disabled={library.loading} /></View>}
    {library.olderPage && data === null && <MainButton label="Back to newest conversations" tone="quiet" onPress={library.newest} />}
    {library.cached && <View accessibilityLiveRegion="polite" style={[st.notice, { backgroundColor: colors.inset }]}>{note('Showing what is saved on this phone. Connect and retry to check for newer conversations.')}<MainButton label="Retry connection" tone="quiet" onPress={library.retry} disabled={library.loading} /></View>}

    {data !== null && view === 'conversations' && <>
      {search(query, setQuery, 'Search your conversations')}
      {topics.length > 0 && <View style={st.filters}>
        {[{ key: null, title: 'All' }, ...(allTopics ? topics : topics.slice(0, 5))].map(item => {
          const chosen = item.key === topic || item.key === null && !topics.some(found => found.key === topic);
          return <Press key={item.key ?? 'all'} accessibilityRole="button" accessibilityState={{ selected: chosen }} aria-pressed={chosen} onPress={() => setTopic(item.key)}
            style={[st.filter, { backgroundColor: chosen ? colors.hero : colors.inset }]}><Text style={[type.small, { color: chosen ? paper.onInk : colors.text }]}>{item.title}</Text></Press>;
        })}
      </View>}
      {topics.length > 5 && <MainButton tone="quiet" label={allTopics ? 'Show fewer topics' : 'More topics'} onPress={() => setAllTopics(value => !value)} />}
      {heading('Your conversations')}
      {note(library.olderPage ? 'An older page. Search and topics apply to this page.' : 'Newest conversations. Search and topics apply to this page.')}
      {shown.map((pack, index) => <View key={pack.id} style={st.conversation}>
        {index === 0 ? <MainFeature title={pack.title.en} body={pack.summary || conversationStateLine(pack)} motif="phrases" tone="plum"
          action={{ label: 'Open conversation', onPress: () => openPack(pack.id) }} />
          : <MainRow title={pack.title.en} detail={`${relativeDay(pack.createdAt, now)}. ${conversationStateLine(pack)}`} onPress={() => openPack(pack.id)} />}
        {index === 0 && note(`${relativeDay(pack.createdAt, now)}. ${conversationStateLine(pack)}`)}
        {pack.state === 'ready' && packSelection({ packId: pack.id, packs: data.packs, deck: data.deck, bank: data.bank, now }) !== null &&
          <MainRow title="Practise this conversation" detail="Recognise the meaning, try a reply and bring it back from memory." onPress={() => open('ConversationPractice', { packId: pack.id })} />}
      </View>)}
      {shown.length === 0 && (data.page.length === 0 ? empty('Your conversations will live here.', 'After speaking with your tutor, come back for useful phrases and learning notes.', <MainButton label="Explore conversations" onPress={() => nav.navigate('Explore')} />)
        : empty('No conversations match yet.', 'Try another word, or clear the topic and search.', <MainButton label="Clear filters" tone="quiet" onPress={() => { setQuery(''); setTopic(null); }} />))}
      {data.unavailable.length > 0 && <MainRow title="Some conversations need a closer look" detail="Open the full library to load these saved conversations individually." onPress={() => open('Conversations')} />}
      {library.nextCursor !== null && <MainButton label={library.loading ? 'Loading…' : 'Older conversations'} tone="quiet" disabled={library.loading} onPress={library.older} />}
      {library.olderPage && <MainButton label="Newest conversations" tone="quiet" disabled={library.loading} onPress={library.newest} />}
      {note('These are learning notes from your conversations. Full conversation text is kept only when you choose to save it separately.')}
      {adapter.kind === 'supabase' && <MainRow title="Saved conversation text" detail="Read the original words you chose to keep." onPress={() => open('SavedConversationText')} />}
    </>}

    {data !== null && view === 'practise' && <>
      {rec?.kind === 'resume' ? <MainFeature title="Pick up where you stopped." body={rec.source ? `Continue your practice from ${rec.source.title.en}.` : 'Your unfinished practice is ready on this phone.'} motif="practice" tone="ochre"
        action={{ label: 'Resume practice', onPress: () => open('Drill', practiceRouteParams({ origin: 'resume', packId: null, exposed: false })) }} />
        : rec?.kind === 'start' ? <MainFeature title="Ready to review." body={rec.source ? `Bring back phrases from ${rec.source.title.en}, alongside anything due for review.` : 'Bring back phrases from your own French.'} motif="practice" tone="ochre"
          action={{ label: 'Try this review', onPress: () => open('Drill', practiceRouteParams({ origin: 'recommended', packId: null, exposed: false })) }} />
          : <MainFeature title={data.packs.some(pack => pack.state === 'generating') ? 'Your practice is on its way.' : 'Give your French another go.'} body="Your tutor conversations leave useful phrases here. Pick a topic, then return to practise what came up." motif="practice" tone="ochre"
            action={{ label: 'Explore conversations', onPress: () => nav.navigate('Explore') }} />}
      {rec !== null && rec.kind !== 'none' && note('No live minutes used. Your answers decide the next review.')}
      {ready.slice(0, 2).map(pack => <MainRow key={pack.id} title={`From ${pack.title.en}`} detail="Meaning, listening and replies from this conversation." onPress={() => open('ConversationPractice', { packId: pack.id })} />)}
      {heading('Choose what to practise')}
      <MainRow title="A conversation" detail="Choose one of your tutor conversations." onPress={() => setView('conversations')} />
      <MainRow title="Useful phrases" detail="Open the phrases already in your review collection." onPress={() => open('Phrasebook')} />
      {canMix && <MainRow title="Mix your conversations" detail="Review language due from different topics." onPress={() => open('Drill', { mix: true })} />}
      {localPhrase !== null && <MainRow title="Hear, say and compare" detail="Your tutor’s recorded example. Available offline; your temporary take is not graded." onPress={() => open('DailyPractice', { id: localPhrase.id, mode: 'shadowing' })} />}
      <MainRow title="Use it in a conversation" detail="Choose a situation and speak freely with your tutor." onPress={() => nav.navigate('Explore')} />
    </>}

    {data !== null && view === 'saved' && <>
      {search(phraseQuery, setPhraseQuery, 'Search your saved phrases')}
      <MainRow title="Open your phrasebook" detail="Hear available tutor recordings and practise your phrases." onPress={() => open('Phrasebook')} />
      <MainRow title="Saved situations" detail="Return to the situations you bookmarked in your collection." onPress={() => open('DailyLibrary')} />
      {adapter.kind === 'supabase' && <MainRow title="Saved conversation text" detail="The original words you chose to save, with separate delete controls." onPress={() => open('SavedConversationText')} />}
      {heading('Useful phrases')}
      {phrases.slice(0, phraseLimit).map(({ card, source }) => <View key={card.id} style={[st.phrase, { backgroundColor: colors.surface }]}>
        <Text {...frenchText} style={[type.french, { color: colors.text }]}>{card.front}</Text>
        <Text style={[type.body, { color: colors.muted }]}>{card.back}</Text>
        {source !== null && <MainButton tone="quiet" label={`From ${source.title.en}`} onPress={() => openPack(source.id)} />}
      </View>)}
      {phrases.length > phraseLimit && note('Open your phrasebook to browse the rest of your saved French.')}
      {phrases.length === 0 && empty(phraseQuery.trim() === '' ? 'A place for useful French.' : 'No phrases match yet.', phraseQuery.trim() === '' ? 'Phrases kept from your learning will appear here. Start with a conversation or explore a situation.' : 'Try another word in French or English.')}
    </>}
  </MainScreen>;
}

// Selection uses the established brand foreground; all surrounding colours
// come from the same theme as the five main pages.
const coloursOnSelection = paper.onInk;
const phraseLimit = 30;
const st = StyleSheet.create({
  views: { flexDirection: 'row', borderRadius: radius.tile, padding: space(1), gap: space(1) },
  viewFrame: { flex: 1, minWidth: 0 },
  view: { minHeight: space(11), borderRadius: radius.field, alignItems: 'center', justifyContent: 'center', padding: space(1) },
  viewLabel: { textAlign: 'center' },
  search: { minHeight: space(14), flexDirection: 'row', alignItems: 'center', gap: space(3), borderRadius: radius.tile, paddingHorizontal: space(4) },
  searchInput: { flex: 1, minWidth: 0, minHeight: space(14) },
  clear: { minWidth: space(11), minHeight: space(11), alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  filter: { minHeight: space(11), justifyContent: 'center', borderRadius: radius.tile, paddingHorizontal: space(4), paddingVertical: space(2) },
  loading: { alignItems: 'center', gap: space(3), paddingVertical: space(8) },
  empty: { padding: space(5), borderRadius: radius.card, gap: space(3) },
  notice: { padding: space(4), borderRadius: radius.tile, gap: space(2) },
  conversation: { gap: space(3) },
  phrase: { padding: space(5), borderRadius: radius.card, gap: space(2) },
});
