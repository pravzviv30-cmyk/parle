import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { useBackToHome } from '../nav/useBackToHome.ts';
import { IconAction, IconButton, Field, Label, TabBar } from '../components.tsx';
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
import { paper, radius, space, type } from '../theme.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { libraryPlace, pageItems, rememberLibraryPlace } from './libraryPlace.ts';

/**
 * The daily collection. The learner's saved items lead; an empty Saved tab
 * offers a few starters instead of the catalogue's size, which belongs to the
 * two browsing tabs. Every rule is `libraryView.ts`'s.
 */
export function DailyLibraryScreen() {
  const { colors, mode } = useMainAppearance();
  const goBack = useBackToHome();
  const scope = scopeGeneration();
  const place = libraryPlace(scope);
  const [loaded, setLoaded] = useState<{ scope: number; saved: Set<string> } | null>(null);
  const saved = loaded?.scope === scope ? loaded.saved : null;
  const [filter, setFilter] = useState<LibraryFilter>(place.filter);
  const [query, setQuery] = useState(place.query);
  const [limit, setLimit] = useState(place.limit);
  const [placeScope, setPlaceScope] = useState(scope);
  const [unreadScope, setUnreadScope] = useState<number | null>(null);
  const unread = unreadScope === scope;
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const next = libraryPlace(scope);
    setFilter(next.filter); setQuery(next.query); setLimit(next.limit); setPlaceScope(scope);
  }, [scope]);
  useFocusEffect(useCallback(() => { let live = true; setLoaded(null); setUnreadScope(null); void loadBookmarks().then(rows => { if (live && scope === scopeGeneration()) setLoaded({ scope, saved: new Set(rows.filter(r => r.saved).map(r => r.scenarioId)) }); }).catch(() => { if (live && scope === scopeGeneration()) setUnreadScope(scope); }); return () => { live = false; }; }, [scope, attempt]));
  const change = (next: { filter?: LibraryFilter; query?: string; limit?: number }) => {
    const updated = { filter: next.filter ?? filter, query: next.query ?? query, limit: next.limit ?? limit };
    setFilter(updated.filter); setQuery(updated.query); setLimit(updated.limit);
    rememberLibraryPlace(scope, updated);
  };
  const onSaved = (id: string, value: boolean) => setLoaded(previous => { if (previous?.scope !== scope) return previous; const next = new Set(previous.saved); if (value) next.add(id); else next.delete(id); return { scope, saved: next }; });
  const lead = saved === null ? 'none' : libraryLead(filter, saved.size, query);
  const items = saved === null ? [] : libraryItems(filter, saved, query);
  return <ScrollScreen bottom="inset" ground={colors.background} header={<ScreenHeader ink={colors.text} muted={colors.muted} title="Daily collection" back={{ onPress: goBack }} />}>
    {placeScope !== scope ? <Text style={[type.body, { color: colors.muted, marginTop: space(3) }]}>Loading your collection…</Text> : <>
    <View style={{ backgroundColor: paper.card, borderRadius: radius.input, padding: space(3), gap: space(3) }}>
    <TabBar appearance="underline" tabs={[{ key: 'saved', label: 'Saved' }, { key: 'words', label: 'Words' }, { key: 'phrases', label: 'Phrases' }]} active={filter} onChange={key => change({ filter: key, limit: 12 })} />
    <Field placeholder={SEARCH_PLACEHOLDER} value={query} onChangeText={text => change({ query: text, limit: 12 })} />
    </View>
    {unread && <><Text accessibilityLiveRegion="polite" style={[type.body, { color: colors.text, marginTop: space(3) }]}>Your saved items could not be loaded. Try again to see them.</Text><IconAction layout="inline" ground={mode === 'dark' ? 'blue' : 'paper'} icon="refresh" label="Retry saved items" onPress={() => setAttempt(value => value + 1)} /></>}
    {!unread && saved === null && <Text style={[type.body, { color: colors.muted, marginTop: space(3) }]}>Loading your collection…</Text>}
    {lead === 'inventory' && <Text style={[type.small, { color: colors.muted, marginTop: space(2) }]}>{inventoryLine(VOICED_WORD_IDS.length, VOICED_PHRASE_IDS.length)}</Text>}
    {!unread && lead === 'starter' && <>
      <Label color={colors.muted}>{STARTER_TITLE}</Label>
      <Text style={[type.small, { color: colors.muted, marginTop: space(1) }]}>{STARTER_NOTE}</Text>
      {starterItems().map(item => <DailyCard key={item.id} item={item} onSaved={onSaved} />)}
    </>}
    {!unread && saved !== null && lead !== 'starter' && items.length === 0 && <><Text style={[type.body, { color: colors.text, marginTop: space(3) }]}>{NO_MATCH}</Text>{query.trim() !== '' && <IconButton icon="close" label="Clear search" onPress={() => change({ query: '', limit: 12 })} />}</>}
    {!unread && saved !== null && pageItems(items, limit).map(item => <DailyCard key={item.id} item={item} onSaved={onSaved} />)}
    {!unread && saved !== null && limit > 12 && <IconAction layout="inline" ground={mode === 'dark' ? 'blue' : 'paper'} icon="back" label="Previous page" onPress={() => change({ limit: Math.max(12, limit - 12) })} />}
    {!unread && saved !== null && items.length > limit && <IconAction layout="inline" ground={mode === 'dark' ? 'blue' : 'paper'} icon="forward" label="Next page" onPress={() => change({ limit: limit + 12 })} />}
    </>}
  </ScrollScreen>;
}
