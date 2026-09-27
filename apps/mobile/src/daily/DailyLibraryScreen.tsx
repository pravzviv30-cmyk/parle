import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useBackToHome } from '../nav/useBackToHome.ts';
import { Field, GhostButton, Label, TabBar } from '../components.tsx';
import { loadBookmarks } from '../bookmarks/store.ts';
import { DailyCard } from './DailyCard.tsx';
import { VOICED_WORD_IDS, VOICED_PHRASE_IDS } from './voicedSelection.ts';
import {
  NO_MATCH,
  SEARCH_PLACEHOLDER,
  STARTER_NOTE,
  STARTER_TITLE,
  inventoryLine,
  libraryItems,
  libraryLead,
  starterItems,
  type LibraryFilter,
} from './libraryView.ts';
import { paper, space, type } from '../theme.ts';

/**
 * The daily collection. The learner's saved items lead; an empty Saved tab
 * offers a few starters instead of the catalogue's size, which belongs to the
 * two browsing tabs. Every rule is `libraryView.ts`'s.
 */
export function DailyLibraryScreen() {
  const goBack = useBackToHome();
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<LibraryFilter>('saved');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(12);
  useFocusEffect(useCallback(() => { let live = true; void loadBookmarks().then(rows => { if (live) setSaved(new Set(rows.filter(r => r.saved).map(r => r.scenarioId))); }); return () => { live = false; }; }, []));
  const onSaved = (id: string, value: boolean) => setSaved(previous => { const next = new Set(previous); if (value) next.add(id); else next.delete(id); return next; });
  const lead = libraryLead(filter, saved.size, query);
  const items = libraryItems(filter, saved, query);
  return <ScrollScreen bottom="inset" header={<ScreenHeader title="Daily collection" back={{ onPress: goBack }} />}>
    <TabBar tabs={[{ key: 'saved', label: 'Saved' }, { key: 'words', label: 'Words' }, { key: 'phrases', label: 'Phrases' }]} active={filter} onChange={key => { setFilter(key); setLimit(12); }} />
    <Field placeholder={SEARCH_PLACEHOLDER} value={query} onChangeText={text => { setQuery(text); setLimit(12); }} />
    {lead === 'inventory' && <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{inventoryLine(VOICED_WORD_IDS.length, VOICED_PHRASE_IDS.length)}</Text>}
    {lead === 'starter' && <>
      <Label>{STARTER_TITLE}</Label>
      <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{STARTER_NOTE}</Text>
      {starterItems().map(item => <DailyCard key={item.id} item={item} onSaved={onSaved} />)}
    </>}
    {lead !== 'starter' && items.length === 0 && <Text style={[type.body, { color: paper.ink, marginTop: space(3) }]}>{NO_MATCH}</Text>}
    {items.slice(Math.max(0, limit - 12), limit).map(item => <DailyCard key={item.id} item={item} onSaved={onSaved} />)}
    {limit > 12 && <GhostButton label="Previous page" onPress={() => setLimit(n => Math.max(12, n - 12))} />}
    {items.length > limit && <GhostButton label="Next page" onPress={() => setLimit(n => n + 12)} />}
  </ScrollScreen>;
}
