/** A quiet library of the learner's own, curated Tutor conversations. */

import { useNavigation } from '@react-navigation/native';
import { MainButton, MainFeature, MainRow, MainScreen } from '../main/MainUI.tsx';
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { useEffect, useRef, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import type { ConversationPack } from '@luvani/core';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { frenchText, space, type } from '../theme.ts';
import { CONVERSATION_PAGE_SIZE } from './store.ts';
import { PRACTICE_ALTERNATIVES, RECOMMENDED } from '../practice/copy.ts';
import { loadPracticeHistory } from '../practice/historyStore.ts';
import type { PracticeHistoryItem } from '../practice/history.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { PRACTICE_BEFORE, REVISION_COPY, correctionLine, revisionEvidence } from './revision.ts';

type DeleteResult = { ok: true } | { ok: false; message: string };

function packStatus(pack: ConversationPack): string {
  if (pack.state === 'generating') return 'Becoming practice';
  if (pack.state === 'failed') return 'Needs a moment';
  if (pack.state === 'archived') return 'Archived';
  return `${pack.keyPhrases.length} ${pack.keyPhrases.length === 1 ? 'phrase' : 'phrases'} ready`;
}

function dateLine(iso: string): string | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : `Started ${date.toLocaleDateString()}`;
}

export function ConversationPackLibrary({
  packs,
  onBack,
  onReview,
  onContinue,
  onDeleteOne,
  onDeleteAll,
  initialPackId,
  linkedPack,
  linkMessage,
  pageNote,
  paginationPending = false,
  onOlder,
  onNewest,
  onRetryPage,
  unavailable = [],
  onOpenUnavailable,
  onDeleteUnavailable,
}: {
  packs: readonly ConversationPack[];
  /**
   * Open on this conversation's detail, once the packs have loaded and only if
   * it is still among them. A deleted or unknown id leaves the list showing.
   */
  initialPackId?: string;
  /** One direct-link detail, independently fetched without extending the page. */
  linkedPack?: ConversationPack | null;
  linkMessage?: string | null;
  pageNote?: string;
  paginationPending?: boolean;
  onOlder?: () => void;
  onNewest?: () => void;
  onRetryPage?: () => void;
  unavailable?: readonly import('./store.ts').UnavailablePack[];
  onOpenUnavailable?: (id:string) => Promise<{ok:true;pack:ConversationPack}|{ok:false;message:string}>;
  onDeleteUnavailable?: (id:string) => Promise<DeleteResult>;
  onBack: () => void;
  onReview: (pack: ConversationPack) => void;
  /**
   * Revisit with the tutor. Omitted when the plan does not open it, and then
   * the door is not drawn at all rather than drawn and refused.
   */
  onContinue?: (pack: ConversationPack) => void;
  onDeleteOne: (pack: ConversationPack) => Promise<DeleteResult>;
  onDeleteAll: () => Promise<DeleteResult>;
}) {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { colors } = useMainAppearance();
  const { adapter } = useAuth();
  const [selected, setSelected] = useState<ConversationPack | null>(null);
  const [confirming, setConfirming] = useState<string | 'all' | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const unavailableRows=unavailable.slice(0,CONVERSATION_PAGE_SIZE);
  const ordered = packs.slice(0, CONVERSATION_PAGE_SIZE-unavailableRows.length);
  // What was practised on a revisit's source, read only to put a before beside
  // the after (Stage 4). Empty until read, and empty if it cannot be read: the
  // section then says what the packs themselves hold and nothing more.
  const [history, setHistory] = useState<readonly PracticeHistoryItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    const scope = scopeGeneration();
    void loadPracticeHistory().then(
      (events) => {
        if (!cancelled && scopeGeneration() === scope) setHistory(events);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, []);
  const revision = selected === null ? null : revisionEvidence(selected, packs, history);

  // The direct link, applied once: the first time the named pack is present.
  // Leaving the detail afterwards returns to the list, not back into it.
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current || initialPackId === undefined) return;
    const target = packs.find((pack) => pack.id === initialPackId) ?? (linkedPack?.id === initialPackId ? linkedPack : undefined);
    if (target === undefined) return;
    openedRef.current = true;
    setSelected(target);
  }, [packs, initialPackId, linkedPack]);

  const leaveDetail = () => {
    setConfirming(null);
    setMessage(null);
    if (initialPackId !== undefined && selected?.id === initialPackId) {
      onBack();
      return;
    }
    setSelected(null);
  };
  useHardwareBack(selected !== null, selected === null ? onBack : leaveDetail);

  const removeOne = (pack: ConversationPack) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    void onDeleteOne(pack).then((result) => {
      if (result.ok) {
        setConfirming(null);
        setSelected(null);
      } else {
        setMessage(result.message);
      }
    }).catch(() => setMessage('This conversation could not be changed. Check your connection and try again.')).finally(() => setBusy(false));
  };

  const removeAll = () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    void onDeleteAll().then((result) => {
      if (result.ok) setConfirming(null);
      else setMessage(result.message);
    }).catch(() => setMessage('Your conversations could not be changed. Check your connection and try again.')).finally(() => setBusy(false));
  };

  if (selected !== null) {
    const hasPractice = selected.state === 'ready' && (selected.keyPhrases.length > 0 || selected.corrections.length > 0);
    return <MainScreen title={selected.title.en} onBack={leaveDetail} bottom="inset"
      footer={hasPractice ? <View style={{ gap: space(2) }}><MainButton label="Practise this conversation" disabled={busy} onPress={() => onReview(selected)} /><Text style={[type.small, { color: colors.muted, textAlign: 'center' }]}>{RECOMMENDED.noMinutes}</Text></View> : undefined}>
      <Text style={[type.small, { color: colors.muted }]}>{dateLine(selected.createdAt)}. Learning notes</Text>
      <View style={[main.panel, { backgroundColor: colors.ochre }]}>
        <Text accessibilityRole="header" style={[type.heading, { color: colors.text }]}>What you worked on</Text>
        <Text style={[type.body, { color: colors.text }]}>{selected.summary || selected.title.fr}</Text>
      </View>
      <Text style={[type.small, { color: colors.muted }]}>Curated phrases and corrections from this conversation. Full conversation text is saved only if you choose it separately after a recap.</Text>

      {selected.keyPhrases.length > 0 && <View style={main.group}>
        <Text accessibilityRole="header" style={[type.heading, { color: colors.text }]}>Useful phrases</Text>
        {selected.keyPhrases.map(phrase => <View key={`${phrase.fr}\u0000${phrase.en}`} style={[main.panel, { backgroundColor: colors.inset }]}>
          <Text {...frenchText} style={[type.french, { color: colors.text }]}>{phrase.frWritten ?? phrase.fr}</Text>
          <Text style={[type.body, { color: colors.muted }]}>{phrase.en}</Text>
        </View>)}
      </View>}
      {selected.corrections[0] && <View style={[main.panel, { backgroundColor: colors.ochre }]}>
        <Text accessibilityRole="header" style={[type.heading, { color: colors.text }]}>One useful adjustment</Text>
        <Text style={[type.small, { color: colors.muted }]}>You said</Text>
        <Text {...frenchText} style={[type.frenchSm, { color: colors.text }]}>{selected.corrections[0].quote}</Text>
        <Text style={[type.small, { color: colors.muted }]}>Try this</Text>
        <Text {...frenchText} style={[type.french, { color: colors.text }]}>{selected.corrections[0].better}</Text>
        <Text style={[type.body, { color: colors.text }]}>{selected.corrections[0].betterEn}</Text>
        <Text style={[type.small, { color: colors.muted }]}>{selected.corrections[0].why}</Text>
      </View>}
      {revision !== null && <View style={[main.panel, { backgroundColor: colors.surface }]}>
        <Text accessibilityRole="header" style={[type.heading, { color: colors.text }]}>{REVISION_COPY.label}</Text>
        <Text style={[type.body, { color: colors.muted }]}>{REVISION_COPY.process}</Text>
        {revision.before.correction !== null && <><Text style={[type.small, { color: colors.muted }]}>{REVISION_COPY.earlier}</Text><Text {...frenchText} style={[type.frenchSm, { color: colors.muted }]}>{revision.before.correction.quote}</Text><Text {...frenchText} style={[type.frenchSm, { color: colors.text }]}>{revision.before.correction.better}</Text></>}
        {revision.before.practice !== null && <Text style={[type.small, { color: colors.muted }]}>{PRACTICE_BEFORE[revision.before.practice]}</Text>}
        {correctionLine(revision) !== null && <Text style={[type.body, { color: colors.text }]}>{correctionLine(revision)}</Text>}
      </View>}
      {onContinue !== undefined && selected.state === 'ready' && <>
        <MainRow title="Talk about this again" detail="Start a new conversation with this context." onPress={() => onContinue(selected)} disabled={busy} />
        <Text style={[type.small, { color: colors.muted }]}>{PRACTICE_ALTERNATIVES.revisitUses}</Text>
      </>}
      {adapter.kind === 'supabase' && <MainRow title="Read the original conversation" detail="Open the words you chose to save for this session." onPress={() => nav.navigate('SavedConversationText', { sessionId: selected.sessionId })} />}
      {!hasPractice && <View style={[main.panel, { backgroundColor: colors.surface }]}><Text style={[type.body, { color: colors.text }]}>{selected.state === 'generating' ? 'Your learning notes are still being prepared.' : selected.state === 'ready' ? 'There are no practice phrases in this conversation yet.' : 'These learning notes are not ready to practise yet.'}</Text><MainRow title="Your saved phrases" detail="Open the French already in your collection." onPress={() => nav.navigate('Phrasebook')} /></View>}
      {message !== null && <Text accessibilityRole="alert" style={[type.body, { color: colors.text }]}>{message}</Text>}
      {confirming === selected.id ? <View style={[main.panel, { backgroundColor: colors.surface }]}>
        <Text style={[type.body, { color: colors.text }]}>Delete this curated conversation and its details? Your earned phrases and reviews stay.</Text>
        <MainButton label={busy ? 'Deleting…' : 'Delete conversation'} disabled={busy} onPress={() => removeOne(selected)} />
        <MainButton label="Keep conversation" tone="quiet" disabled={busy} onPress={() => setConfirming(null)} />
      </View> : <MainButton label="Delete this conversation" tone="quiet" disabled={busy} onPress={() => setConfirming(selected.id)} />}
    </MainScreen>;
  }

  return <MainScreen title="Practice from conversations" onBack={onBack} bottom="inset">
    <Text style={[type.body, { color: colors.muted }]}>Curated phrases and corrections from situations you spoke through. Full conversation text is saved only if you choose it separately after a recap.</Text>
    {pageNote !== undefined && <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.muted }]}>{pageNote}</Text>}
    {linkMessage != null && <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.muted }]}>{linkMessage}</Text>}
    {ordered.length === 0 && unavailableRows.length === 0 && <View style={[main.panel, { backgroundColor: colors.surface }]}>
      <MainFeature title="No conversations on this page" body="Finish a tutor conversation and its learning notes can appear here." motif="phrases" tone="plum"/>
      <MainButton label="Choose a situation" onPress={() => nav.navigate('Missions')} />
    </View>}
    {ordered.map(pack => <View key={pack.id} style={main.group}>
      <MainRow title={pack.title.en} detail={`${dateLine(pack.createdAt) ?? ''}. ${packStatus(pack)}`} onPress={() => setSelected(pack)} disabled={busy} />
      {pack.state === 'ready' && onContinue !== undefined && <MainRow title="Continue talking" detail={PRACTICE_ALTERNATIVES.revisitUses} onPress={() => onContinue(pack)} disabled={busy} />}
    </View>)}
    {unavailableRows.map(row => <View key={row.id} style={[main.panel, { backgroundColor: colors.surface }]}>
      <Text style={[type.heading, { color: colors.text }]}>This saved conversation is too large for this page.</Text>
      <Text style={[type.small, { color: colors.muted }]}>{dateLine(row.createdAt)}. Its saved content has not been removed.</Text>
      {onOpenUnavailable !== undefined && <MainButton label={busy ? 'Opening…' : 'Open conversation'} disabled={busy} onPress={() => { setBusy(true); void onOpenUnavailable(row.id).then(result => { if (result.ok) setSelected(result.pack); else setMessage(result.message); }).catch(() => setMessage('This conversation could not be opened.')).finally(() => setBusy(false)); }} />}
      {onDeleteUnavailable !== undefined && (confirming === row.id ? <>
        <Text style={[type.body, { color: colors.text }]}>Delete this saved conversation? Your earned phrases and reviews stay.</Text>
        <MainButton label={busy ? 'Deleting…' : 'Delete conversation'} disabled={busy} onPress={() => { setBusy(true); void onDeleteUnavailable(row.id).then(result => { if (!result.ok) setMessage(result.message); else setConfirming(null); }).catch(() => setMessage('This conversation was not changed.')).finally(() => setBusy(false)); }} />
        <MainButton label="Keep conversation" tone="quiet" disabled={busy} onPress={() => setConfirming(null)} />
      </> : <MainButton label="Delete this unavailable conversation" tone="quiet" disabled={busy} onPress={() => setConfirming(row.id)} />)}
    </View>)}
    {onOlder !== undefined && <MainButton label="Older conversations" tone="quiet" disabled={paginationPending || busy} onPress={onOlder} />}
    {onNewest !== undefined && <MainButton label="Newest conversations" tone="quiet" disabled={paginationPending || busy} onPress={onNewest} />}
    {onRetryPage !== undefined && <MainButton label="Retry loading conversations" tone="quiet" disabled={paginationPending || busy} onPress={onRetryPage} />}
    {(ordered.length > 0 || unavailableRows.length > 0) && (confirming === 'all' ? <View style={[main.panel, { backgroundColor: colors.surface }]}>
      <Text style={[type.body, { color: colors.text }]}>Delete all curated Tutor conversations? Your earned phrases and reviews stay.</Text>
      <MainButton label={busy ? 'Deleting…' : 'Delete all conversations'} disabled={busy} onPress={removeAll} />
      <MainButton label="Keep conversations" tone="quiet" disabled={busy} onPress={() => setConfirming(null)} />
    </View> : <MainButton label="Delete all saved conversations" tone="quiet" disabled={busy} onPress={() => setConfirming('all')} />)}
    {message !== null && <Text accessibilityRole="alert" style={[type.body, { color: colors.text }]}>{message}</Text>}
  </MainScreen>;

}

const main = StyleSheet.create({ panel: { padding: space(5), borderRadius: space(6), gap: space(2.5) }, group: { gap: space(3) } });
