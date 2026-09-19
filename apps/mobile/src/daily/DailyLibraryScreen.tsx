import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useBackToHome } from '../nav/useBackToHome.ts';
import { Field, GhostButton, TabBar } from '../components.tsx';
import { loadBookmarks } from '../bookmarks/store.ts';
import { DAILY_ITEMS } from './catalogue.ts';
import { DailyCard } from './DailyCard.tsx';
import { VOICED_WORD_IDS, VOICED_PHRASE_IDS } from './voicedSelection.ts';
import { paper, type } from '../theme.ts';

export function DailyLibraryScreen() {
  const goBack = useBackToHome();
  const nav = useNavigation<{ goBack: () => void }>();
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('saved');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(12);
  useFocusEffect(useCallback(() => { let live = true; void loadBookmarks().then(rows => { if (live) setSaved(new Set(rows.filter(r => r.saved).map(r => r.scenarioId))); }); return () => { live = false; }; }, []));
  const items = DAILY_ITEMS.filter(i => (filter === 'saved' ? saved.has(i.id) : filter === 'words' ? i.id.startsWith('word:') : i.id.startsWith('phrase:')) && `${i.fr} ${i.en}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <ScrollScreen bottom="inset" header={<ScreenHeader title="Daily collection" back={{ onPress: goBack }} />}>
    <Text style={[type.body, { color: paper.inkSoft }]}>1,000 words and 1,000 phrases. Tutor-matched audio is included for {VOICED_WORD_IDS.length} words and {VOICED_PHRASE_IDS.length} phrases.</Text>
    <TabBar tabs={[{ key: 'saved', label: 'Saved' }, { key: 'words', label: 'Words' }, { key: 'phrases', label: 'Phrases' }]} active={filter} onChange={key => { setFilter(key); setLimit(12); }} />
    <Field value={query} onChangeText={text => { setQuery(text); setLimit(12); }} placeholder="Search French or English" />
    {items.length === 0 && <Text style={[type.body, { color: paper.ink }]}>Save an item on Home or explore the packs here.</Text>}
    {items.slice(Math.max(0, limit - 12), limit).map(item => <DailyCard key={item.id} item={item} onSaved={(id, value) => setSaved(previous => { const next = new Set(previous); if (value) next.add(id); else next.delete(id); return next; })} />)}
    {limit > 12 && <GhostButton label="Previous page" onPress={() => setLimit(n => Math.max(12, n - 12))} />}
    {items.length > limit && <GhostButton label="Next page" onPress={() => setLimit(n => n + 12)} />}
  </ScrollScreen>;
}
