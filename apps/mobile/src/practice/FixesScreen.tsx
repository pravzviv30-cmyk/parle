/**
 * Your fixes (B3, 2026-10-20, artboard B-Fixes), opened as `Fixes {packId}`.
 *
 * The corrections a conversation saved, tried before they are shown. The
 * first untried fix asks for the French from its English; the learner says it
 * in a drill sitting or types it here, and only then does the screen show what
 * they said, a more natural way, and why. A fix the deck already holds as
 * tried shows the comparison, with a way to say it once more. Every decision
 * is `practice/fixesView.ts`'s; nothing here writes anything, and the typed
 * attempt lives only as long as the screen.
 *
 * It reads through `useLibraryData`, under the same account fence as Practice,
 * and never asks the plan itself: the lock badge comes from the access seam.
 */

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Card, ColourCard, Field, FrenchBlock, LockBadge, OutlineButton, PillButton, Skeleton, TabBar } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { frenchText, paper, radius, space, type } from '../theme.ts';
import type { RootStackParamList } from '../nav/types.ts';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { useLibraryData } from './useLibraryData.ts';
import type { PracticeRoute } from './practiceTabView.ts';
import {
  FIXES_TITLE,
  FIX_COPY,
  SCOPES,
  fixLabel,
  fixRows,
  fixesFor,
  fixesLocked,
  fixesPack,
  fixesSubtitle,
  phraseRows,
  practiseAll,
  type FixesScope,
} from './fixesView.ts';

export { FIXES_TITLE };

export function FixesScreen() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void; goBack: () => void; canGoBack: () => boolean }>();
  const route = useRoute<RouteProp<RootStackParamList, 'Fixes'>>();
  const packId = typeof route.params?.packId === 'string' ? route.params.packId : '';
  const library = useLibraryData();
  const { data } = library;
  const [scope, setScope] = useState<FixesScope>('this');
  const [active, setActive] = useState<string | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  // A typed attempt, kept only while this screen is open. Never stored.
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [playing, setPlaying] = useState<string | null>(null); // the key or phrase being said

  // Another conversation or another account starts clean.
  useEffect(() => { setScope('this'); setActive(null); setTyping(null); setDraft(''); setTyped({}); }, [packId, data === null]);
  useEffect(() => () => tutorVoice.stop(), []);
  useFocusEffect(useCallback(() => () => { tutorVoice.stop(); setPlaying(null); }, []));

  const back = () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Tabs', { screen: 'Practice' }));
  const go = (target: PracticeRoute) => {
    if (!library.ownsNow()) return;
    tutorVoice.stop();
    nav.navigate(target.screen, 'params' in target ? target.params : undefined);
  };
  const hear = (key: string, french: string) => {
    if (!library.ownsNow()) return;
    if (playing === key) { tutorVoice.stop(); setPlaying(null); return; }
    setPlaying(key);
    tutorVoice.speak(french, { onDone: () => setPlaying(null) });
  };

  const now = Date.now();
  const pack = data === null ? null : fixesPack(packId, data.packs);
  const header = <ScreenHeader back={{ onPress: back }} title={FIXES_TITLE} />;

  if (data === null) {
    return (
      <ScrollScreen header={header}>
        {library.failed ? (
          <Card style={st.stack}>
            <Text style={[type.bodyStrong, { color: paper.ink }]}>Your fixes couldn’t be loaded.</Text>
            <OutlineButton label="Try again" disabled={library.loading} onPress={library.retry} />
          </Card>
        ) : (
          <View accessibilityLabel="Loading your fixes">
            <Skeleton blocks={[{ height: space(20), radius: radius.card }, { height: space(40), radius: radius.card }]} />
          </View>
        )}
      </ScrollScreen>
    );
  }

  // An unknown or unavailable conversation: a calm word and the way back.
  if (pack === null) {
    return (
      <ScrollScreen header={header}>
        <Card style={st.stack}>
          <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{FIX_COPY.unknownTitle}</Text>
          <Text style={[type.body, { color: paper.inkSoft }]}>{FIX_COPY.unknownBody}</Text>
          <OutlineButton label={FIX_COPY.back} onPress={back} />
        </Card>
      </ScrollScreen>
    );
  }

  const fixes = fixesFor({ pack, packs: data.packs, deck: data.deck, bank: data.bank, scope, now });
  const rows = fixRows(fixes, { active, typed });
  const all = practiseAll(fixes, scope, pack.id);
  const phrases = phraseRows(pack, data.deck);
  const locked = fixesLocked();

  return (
    <ScrollScreen header={header}>
      <View style={st.page}>
        <View style={st.small}>
          <Text style={[type.body, { color: paper.inkSoft }]}>{fixesSubtitle(pack, now)}</Text>
          {locked && <LockBadge />}
        </View>

        <TabBar tabs={SCOPES} active={scope} accessibilityLabel="Which fixes" onChange={(key) => { setScope(key); setActive(null); setTyping(null); setDraft(''); }} />

        {/* 2026-10-20, B3.1, founder: hide until Phase C. "Comes up often" returns built from a stored correction reason. */}

        {rows.length === 0 && <Text style={[type.body, { color: paper.inkSoft }]}>{FIX_COPY.none}</Text>}
        {rows.map((row) => {
          if (row.kind === 'attempt') {
            return (
              <Card key={row.key} style={st.stack}>
                <Text style={[type.small, { color: paper.inkSoft }]}>{fixLabel(row)}</Text>
                <Text style={[type.label, { color: paper.ink }]}>{FIX_COPY.sayThis}</Text>
                <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{row.english}</Text>
                <Text style={[type.small, { color: paper.inkSoft }]}>{FIX_COPY.afterTry}</Text>
                {typing === row.key ? (
                  <View style={st.stack}>
                    <Field label={FIX_COPY.typePlaceholder} value={draft} onChangeText={setDraft} autoCapitalize="sentences" />
                    <PillButton variant="secondary" label={FIX_COPY.showAfterTyping} disabled={draft.trim() === ''}
                      onPress={() => { if (!library.ownsNow() || draft.trim() === '') return; setTyped((was) => ({ ...was, [row.key]: draft.trim() })); setTyping(null); setDraft(''); }} />
                  </View>
                ) : (
                  <View style={st.actions}>
                    {row.say !== null && <PillButton variant="secondary" compact label={FIX_COPY.say} onPress={() => go(row.say!)} />}
                    <PillButton variant="secondary" compact label={FIX_COPY.type} onPress={() => { setTyping(row.key); setDraft(''); }} />
                  </View>
                )}
              </Card>
            );
          }
          if (row.kind === 'waiting') {
            return (
              <Card key={row.key} style={st.stack}>
                <Text style={[type.small, { color: paper.inkSoft }]}>{fixLabel(row)}</Text>
                <Text style={[type.bodyStrong, { color: paper.ink }]}>{row.english}</Text>
                <OutlineButton label={FIX_COPY.tryIt} accessibilityLabel={`${FIX_COPY.tryIt}, ${row.english}`} onPress={() => { setActive(row.key); setTyping(null); setDraft(''); }} />
              </Card>
            );
          }
          return (
            <Card key={row.key} style={st.stack}>
              <Text style={[type.small, { color: paper.inkSoft }]}>{fixLabel(row)}</Text>
              {row.wrote !== null && (
                <View style={st.small}>
                  <Text style={[type.small, { color: paper.inkSoft }]}>{FIX_COPY.youWrote}</Text>
                  <Text {...frenchText} style={[type.frenchSm, { color: paper.ink }]}>{row.wrote}</Text>
                </View>
              )}
              <View style={st.small}>
                <Text style={[type.small, { color: paper.inkSoft }]}>{row.said}</Text>
                <Text {...frenchText} style={[type.frenchSm, { color: paper.inkSoft }]}>{row.quote}</Text>
              </View>
              <View style={st.small}>
                <Text style={[type.small, { color: paper.inkSoft }]}>{FIX_COPY.natural}</Text>
                <FrenchBlock size="md" french={row.better} english={row.english} playing={playing === row.key} onHear={() => hear(row.key, row.better)} />
              </View>
              {row.why.trim() !== '' && <Text style={[type.small, { color: paper.ink }]}>{FIX_COPY.why} {row.why}</Text>}
              {row.again !== null && <PillButton variant="secondary" compact label={FIX_COPY.again} onPress={() => go(row.again!)} />}
            </Card>
          );
        })}

        {phrases.length > 0 && (
          <View style={st.stack}>
            <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>{FIX_COPY.phrasesTitle}</Text>
            <Card style={st.stack}>
              {phrases.map((phrase) => (
                <View key={phrase.fr} style={st.small}>
                  <FrenchBlock size="md" french={phrase.fr} english={phrase.en} playing={playing === phrase.fr} onHear={() => hear(phrase.fr, phrase.fr)} />
                  <Text style={[type.small, { color: paper.inkSoft }]}>{phrase.status}</Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        {all !== null && <PillButton label={FIX_COPY.practiseAll} onPress={() => go(all)} />}
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  page: { gap: space(6) },
  stack: { gap: space(3) },
  small: { gap: space(1), alignItems: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
});
