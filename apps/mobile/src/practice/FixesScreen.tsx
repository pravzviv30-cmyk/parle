/**
 * Your fixes (2026-10-21 UI-008, artboard B-Fixes), opened as `Fixes {packId}`,
 * in light and dark.
 *
 * The corrections a conversation saved, tried before they are shown. The
 * first untried fix asks for the French from its English; the learner says it
 * in a drill sitting or types it here, and only then does the screen show what
 * they said, a more natural way, and why. Every other untried fix waits as a
 * collapsed row with "Try it". A fix the deck already holds as tried shows the
 * comparison, with a way to say it once more. The pattern that comes up often
 * sits above them, from authored copy only and never with a count. Every
 * decision is `practice/fixesView.ts`'s; nothing here writes anything, and the
 * typed attempt lives only as long as the screen.
 *
 * It reads through `useLibraryData`, under the same account fence as Practice,
 * and never asks the plan itself: the lock badge comes from the access seam.
 */

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Field, Skeleton } from '../components.tsx';
import { ScrollScreen } from '../layout.tsx';
import { bType, radius, space } from '../theme.ts';
import { useB } from '../main/bTheme.tsx';
import { BButton } from '../today/TodayParts.tsx';
import type { RootStackParamList } from '../nav/types.ts';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { useLibraryData } from './useLibraryData.ts';
import { useFeatureAccess } from '../access/useFeatureAccess.ts';
import { tapThrough } from '../access/featureAccess.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { COMES_UP_SHORT, PRACTISE_THIS, patternCard, type PracticeRoute } from './practiceTabView.ts';
import { AttemptCard, ComparedCard, FixesHeader, FixesNotice, FixesPatternCard, PhraseList, ScopeToggle, WaitingRow } from './FixesParts.tsx';
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
  practiseAllDoor,
  type FixesScope,
} from './fixesView.ts';

export { FIXES_TITLE };

export function FixesScreen() {
  // The lock seam, so the badge follows a standing change while the screen is open.
  const locks = useFeatureAccess();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void; goBack: () => void; canGoBack: () => boolean }>();
  const { profile } = useProfile();
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
  const t = useB();
  const pack = data === null ? null : fixesPack(packId, data.packs);
  const locked = fixesLocked(locks.access);

  if (data === null) {
    return (
      <ScrollScreen bottom="inset" topGap={8}>
        <View style={st.page}>
          <FixesHeader title={FIXES_TITLE} subtitle={null} locked={false} onBack={back} />
          {library.failed ? (
            <FixesNotice title="Your fixes couldn’t be loaded." body={null} action="Try again" disabled={library.loading} onPress={library.retry} />
          ) : (
            <View accessibilityLabel="Loading your fixes">
              <Skeleton blocks={[{ height: space(20), radius: radius.card }, { height: space(40), radius: radius.card }]} />
            </View>
          )}
        </View>
      </ScrollScreen>
    );
  }

  // An unknown or unavailable conversation: a calm word and the way back.
  if (pack === null) {
    return (
      <ScrollScreen bottom="inset" topGap={8}>
        <View style={st.page}>
          <FixesHeader title={FIXES_TITLE} subtitle={null} locked={false} onBack={back} />
          <FixesNotice title={FIX_COPY.unknownTitle} body={FIX_COPY.unknownBody} action={FIX_COPY.back} onPress={back} />
        </View>
      </ScrollScreen>
    );
  }

  const fixes = fixesFor({ pack, packs: data.packs, deck: data.deck, bank: data.bank, scope, now });
  const rows = fixRows(fixes, { active, typed });
  const all = practiseAllDoor(fixes, scope, pack.id, typed);
  const phrases = phraseRows(pack, data.deck);
  // 2026-10-21 UI-008, artboard B-Fixes, founder: Comes up often shows, authored copy only, never a count.
  // 2026-10-21, learning-science review: only a pattern a fix in this scope shows.
  const pattern = patternCard({ patterns: profile.brain.errorPatterns, packs: data.packs, bank: data.bank, access: locks.access, within: scope === 'this' ? [pack] : data.packs });

  return (
    <ScrollScreen bottom="inset" topGap={8}>
      <View style={st.page}>
        <FixesHeader title={FIXES_TITLE} subtitle={fixesSubtitle(pack, now)} locked={locked} onBack={back} />

        <ScopeToggle scopes={SCOPES} active={scope} onChange={(key) => { setScope(key); setActive(null); setTyping(null); setDraft(''); }} />

        {pattern !== null && (
          <FixesPatternCard eyebrow={COMES_UP_SHORT} title={pattern.row.title} hint={pattern.row.hint} practise={PRACTISE_THIS} locked={pattern.row.locked}
            onPractise={pattern.row.practise === null ? null : () => tapThrough(locks.access, 'fixes', locks.open, () => go(pattern.row.practise!))} />
        )}

        {rows.length === 0 && <FixesNotice title={FIX_COPY.none} body={null} action={FIX_COPY.back} onPress={back} />}
        {rows.map((row) => {
          if (row.kind === 'attempt') {
            return (
              <AttemptCard key={row.key} label={fixLabel(row)} prompt={FIX_COPY.sayThis} english={row.english} note={FIX_COPY.afterTry}
                say={row.say === null ? null : { label: FIX_COPY.say, onPress: () => go(row.say!) }}
                type={{ label: FIX_COPY.type, onPress: () => { setTyping(row.key); setDraft(''); } }}
                typing={typing === row.key ? (
                  <View style={st.typing}>
                    <Field label={FIX_COPY.typePlaceholder} value={draft} onChangeText={setDraft} autoCapitalize="sentences" />
                    <BButton label={FIX_COPY.showAfterTyping} height={48} ground={t.quiet} ink={t.text} text={bType.bold15} disabled={draft.trim() === ''}
                      onPress={() => { if (!library.ownsNow() || draft.trim() === '') return; setTyped((was) => ({ ...was, [row.key]: draft.trim() })); setTyping(null); setDraft(''); }} />
                  </View>
                ) : null} />
            );
          }
          if (row.kind === 'waiting') {
            return (
              <WaitingRow key={row.key} label={fixLabel(row)} english={row.english} tryIt={FIX_COPY.tryIt} onTry={() => { setActive(row.key); setTyping(null); setDraft(''); }} />
            );
          }
          return (
            <ComparedCard key={row.key} label={fixLabel(row)}
              wrote={row.wrote === null ? null : { label: FIX_COPY.youWrote, text: row.wrote }}
              said={row.said} quote={row.quote} natural={FIX_COPY.natural} better={row.better} english={row.english}
              hear={{ label: 'Hear it', playing: playing === row.key, onPress: () => hear(row.key, row.better) }}
              why={row.why.trim() !== '' ? { label: FIX_COPY.why, text: row.why } : null}
              again={row.again === null ? null : { label: FIX_COPY.again, onPress: () => go(row.again!) }} />
          );
        })}

        {phrases.length > 0 && (
          <PhraseList title={FIX_COPY.phrasesTitle} phrases={phrases} hearLabel="Hear it" playing={playing} onHear={(fr) => hear(fr, fr)} />
        )}

        {all !== null && <BButton label={FIX_COPY.practiseAll} height={54} ground={t.primary} ink={t.onPrimary} text={bType.bold17} onPress={() => { if (all.kind === 'drill') go(all.route); else { setActive(all.key); setTyping(null); setDraft(''); } }} />}
      </View>
    </ScrollScreen>
  );
}

// The detail page's gap from the artboard: 18.
const st = StyleSheet.create({
  page: { gap: space(4.5) },
  typing: { gap: space(3) },
});
