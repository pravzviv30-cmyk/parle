import { EmptyStateCard } from '../empty/EmptyStateCard.tsx';
import { NOTEBOOK_ART } from '../empty/emptyStates.ts';
/** A quiet library of the learner's own, curated Tutor conversations. */

import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import type { ConversationPack } from '@luvani/core';
import { IconAction, Card, GhostButton, Label, OutlineButton, PillButton } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { frenchText, space, type } from '../theme.ts';
import { CONVERSATION_PAGE_SIZE } from './store.ts';
import { PRACTICE_ALTERNATIVES, RECOMMENDED } from '../practice/copy.ts';
import { loadPracticeHistory } from '../practice/historyStore.ts';
import type { PracticeHistoryItem } from '../practice/history.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { PRACTICE_BEFORE, REVISION_COPY, correctionLine, revisionEvidence } from './revision.ts';
import { useB } from '../main/bTheme.tsx';
import { hasPackPractice, packPracticeView } from './practiceStatus.ts';

type DeleteResult = { ok: true } | { ok: false; message: string };

function packStatus(pack: ConversationPack): string {
  const practice = packPracticeView(pack);
  if (practice.listLine !== null) return practice.listLine;
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
  const t = useB();
  const nav = useNavigation<{ navigate: (screen: string) => void }>();
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
    // Ported from ce1fa976 (B3, 2026-10-20): a conversation opened straight
    // from a link or from Practice goes back where it came from, not to a list
    // the learner never saw.
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
    // The practice action sits at the safe-area footer (ported from ce1fa976,
    // B3, 2026-10-20), only when the conversation saved something to practise.
    const hasPractice = hasPackPractice(selected);
    const practice = packPracticeView(selected);
    return (
      <ScrollScreen bottom="tab" header={<ScreenHeader back={{ onPress: leaveDetail }} />}
        footer={hasPractice ? (
          <View style={st.footer}>
            <PillButton label="Practise this conversation" disabled={busy} onPress={() => onReview(selected)} />
            <Text style={[type.small, { color: t.muted, textAlign: 'center' }]}>{RECOMMENDED.noMinutes}</Text>
          </View>
        ) : undefined}>
        <Label>Practice from conversation</Label>
        <Text accessibilityRole="header" style={[type.display, { color: t.text, marginTop: space(2) }]}>{selected.title.en}</Text>
        <Text style={[type.bodyStrong, { color: t.text, marginTop: space(1) }]}>{selected.title.fr}</Text>
        <Text style={[type.body, { color: t.muted, marginTop: space(3) }]}>{selected.summary}</Text>
        {practice.note !== null && (
          <Card style={{ marginTop: space(4) }}>
            <Text accessibilityLiveRegion="polite" style={[type.small, { color: t.text }]}>{practice.note}</Text>
          </Card>
        )}

        {selected.keyPhrases.length > 0 && (
          <View style={st.section}>
            <Label>Useful phrases</Label>
            <View style={st.phrases}>
              {selected.keyPhrases.map((phrase) => (
                <Card key={`${phrase.fr}\u0000${phrase.en}`}>
                  <Text {...frenchText} style={[type.bodyStrong, { color: t.text }]}>{phrase.fr}</Text>
                  {phrase.frWritten !== null && <Text {...frenchText} style={[type.small, { color: t.muted, marginTop: space(1) }]}>{phrase.frWritten}</Text>}
                  <Text style={[type.small, { color: t.muted, marginTop: space(1) }]}>{phrase.en}</Text>
                </Card>
              ))}
            </View>
          </View>
        )}

        {selected.corrections[0] && (
          <View style={st.section}>
            <Label>One useful focus</Label>
            <Card style={{ marginTop: space(2.5) }}>
              <Text {...frenchText} style={[type.bodyStrong, { color: t.text }]}>{selected.corrections[0].better}</Text>
              <Text style={[type.small, { color: t.muted, marginTop: space(1) }]}>{selected.corrections[0].betterEn}</Text>
              <Text style={[type.small, { color: t.muted, marginTop: space(2) }]}>{selected.corrections[0].why}</Text>
            </Card>
          </View>
        )}

        {/* Before and after, only for a revisit whose source is still here.
            The process line says what the tutor was asked to do; whether the
            one-detail change happened or went well is recorded nowhere, so
            nothing here says so. Only the curated quote and better are shown. */}
        {revision !== null && (
          <View style={st.section}>
            <Label>{REVISION_COPY.label}</Label>
            <Text style={[type.body, { color: t.muted, marginTop: space(2) }]}>{REVISION_COPY.process}</Text>
            {revision.before.correction !== null && (
              <Card style={{ marginTop: space(2.5) }}>
                <Text style={[type.small, { color: t.muted }]}>{REVISION_COPY.earlier}</Text>
                <Text style={[type.small, { color: t.muted, marginTop: space(1) }]}>« {revision.before.correction.quote} »</Text>
                <Text style={[type.bodyStrong, { color: t.text, marginTop: space(1) }]}>{revision.before.correction.better}</Text>
              </Card>
            )}
            {revision.before.practice !== null && (
              <Text style={[type.small, { color: t.muted, marginTop: space(2) }]}>{PRACTICE_BEFORE[revision.before.practice]}</Text>
            )}
            {correctionLine(revision) !== null && (
              <Text style={[type.body, { color: t.text, marginTop: space(2) }]}>{correctionLine(revision)}</Text>
            )}
          </View>
        )}

        {selected.pronunciationFocus !== null && (
          <View style={st.section}>
            <Label>Pronunciation, if helpful</Label>
            <Text style={[type.body, { color: t.muted, marginTop: space(2) }]}>{selected.pronunciationFocus}</Text>
          </View>
        )}

        {selected.state === 'ready' && practice.pending === null ? (
          <View style={st.actions}>
            {/* Two routes, each saying what it costs. Practice is module work
                and uses no live minutes, said under the footer pill; the tutor
                revisit is live, is drawn only when the plan opens it, and says
                it uses minutes. */}
            {!hasPractice && practice.status !== 'failed' && <Text style={[type.small, { color: t.muted }]}>There are no practice phrases in this conversation yet.</Text>}
            {onContinue !== undefined && (
              <>
                <OutlineButton label="Talk about this again" disabled={busy} onPress={() => onContinue(selected)} />
                <Text style={[type.small, { color: t.muted }]}>{PRACTICE_ALTERNATIVES.revisitUses}</Text>
              </>
            )}
          </View>
        ) : (
          <Card style={st.section}>
            <Text style={[type.bodyStrong, { color: t.text }]}>{practice.pending ?? 'This conversation needs a little more time.'}</Text>
            <Text style={[type.small, { color: t.muted, marginTop: space(2) }]}>Your saved phrases remain available in Progress.</Text>
          </Card>
        )}

        {message !== null && <Text style={[type.small, { color: t.text, marginTop: space(4) }]}>{message}</Text>}
        <View style={st.delete}>
          {confirming === selected.id ? (
            <>
              <Text style={[type.small, { color: t.muted, textAlign: 'center' }]}>Delete this curated conversation and its details? Your earned phrases and reviews stay. They won’t show this conversation’s name.</Text>
              <OutlineButton label={busy ? 'Deleting…' : 'Delete conversation'} disabled={busy} onPress={() => removeOne(selected)} />
              <GhostButton label="Keep conversation" color={t.text} disabled={busy} onPress={() => setConfirming(null)} />
            </>
          ) : (
            <GhostButton label="Delete this conversation" color={t.text} onPress={() => setConfirming(selected.id)} />
          )}
        </View>
      </ScrollScreen>
    );
  }

  return (
    <ScrollScreen bottom="tab" header={<ScreenHeader back={{ onPress: onBack }} />}>
      <Label>Progress</Label>
      <Text accessibilityRole="header" style={[type.display, { color: t.text, marginTop: space(2) }]}>Practice from conversations</Text>
      <Text style={[type.body, { color: t.muted, marginTop: space(2) }]}>Curated phrases and corrections from situations you spoke through. Full conversation text is saved only if you choose it separately after a recap.</Text>
      {pageNote !== undefined && <Text accessibilityLiveRegion="polite" style={[type.small, { color: t.muted, marginTop: space(2) }]}>{pageNote}</Text>}
      {linkMessage != null && <Text accessibilityLiveRegion="polite" style={[type.small, { color: t.muted, marginTop: space(2) }]}>{linkMessage}</Text>}

      {ordered.length === 0 && unavailableRows.length===0 ? (
        <EmptyStateCard art={NOTEBOOK_ART} title="No conversations on this page" body="Finish a Tutor conversation and its curated practice can appear here."
          action={{ label: 'Choose a scene', onPress: () => nav.navigate('Missions') }} />
      ) : (
        <View style={st.packs}>
          {ordered.map((pack) => (
            <Card key={pack.id}>
              <Text style={[type.bodyStrong, { color: t.text }]}>{pack.title.en}</Text>
              <Text style={[type.small, { color: t.muted, marginTop: space(1) }]}>{pack.title.fr}</Text>
              <Text style={[type.small, { color: t.muted, marginTop: space(2) }]}>{pack.summary}</Text>
              <Text style={[type.small, { color: t.muted, marginTop: space(2) }]}>{packStatus(pack)}{dateLine(pack.createdAt) ? `, ${dateLine(pack.createdAt)}` : ''}</Text>
              <View style={st.cardActions}>
                <OutlineButton label="Open conversation" onPress={() => setSelected(pack)} />
                {pack.state === 'ready' && onContinue !== undefined && (
                  <IconAction layout="inline" icon="chat" label="Continue talking"  onPress={() => onContinue(pack)} />
                )}
              </View>
            </Card>
          ))}
        </View>
      )}

      {unavailableRows.map(row=>(
        <Card key={row.id} style={st.empty}>
          <Text style={[type.bodyStrong,{color:t.text}]}>This saved conversation is too large for this page.</Text>
          <Text style={[type.small,{color:t.muted,marginTop:space(1)}]}>{dateLine(row.createdAt)}. Its saved content has not been removed.</Text>
          {onOpenUnavailable!==undefined && <OutlineButton label={busy?'Opening…':'Open conversation'} disabled={busy} onPress={()=>{setBusy(true);void onOpenUnavailable(row.id).then(result=>{if(result.ok)setSelected(result.pack);else setMessage(result.message);}).catch(()=>setMessage('This conversation could not be opened.')).finally(()=>setBusy(false));}} />}
          {onDeleteUnavailable!==undefined && (confirming===row.id ? <>
            <Text style={[type.small,{color:t.muted}]}>Delete this saved conversation? Your earned phrases and reviews stay.</Text>
            <OutlineButton label={busy?'Deleting…':'Delete conversation'} disabled={busy} onPress={()=>{setBusy(true);void onDeleteUnavailable(row.id).then(result=>{if(!result.ok)setMessage(result.message);else setConfirming(null);}).catch(()=>setMessage('This conversation was not changed.')).finally(()=>setBusy(false));}} />
            <GhostButton label="Keep conversation" disabled={busy} onPress={()=>setConfirming(null)} />
          </> : <GhostButton label="Delete this unavailable conversation" disabled={busy} onPress={()=>setConfirming(row.id)} />)}
        </Card>
      ))}

      <View style={st.cardActions}>
        {onOlder !== undefined && <OutlineButton label="Older conversations" disabled={paginationPending || busy} onPress={onOlder} />}
        {onNewest !== undefined && <IconAction layout="inline" icon="sort" label="Newest conversations" disabled={paginationPending || busy} onPress={onNewest} />}
        {onRetryPage !== undefined && <OutlineButton label="Retry loading conversations" disabled={paginationPending || busy} onPress={onRetryPage} />}
      </View>

      {(ordered.length > 0 || unavailableRows.length>0) && (
        <View style={st.deleteAll}>
          {confirming === 'all' ? (
            <>
              <Text style={[type.small, { color: t.muted, textAlign: 'center' }]}>Delete all curated Tutor conversations? Your earned phrases and reviews stay. They won’t show these conversations’ names.</Text>
              <OutlineButton label={busy ? 'Deleting…' : 'Delete all conversations'} disabled={busy} onPress={removeAll} />
              <GhostButton label="Keep conversations" color={t.text} disabled={busy} onPress={() => setConfirming(null)} />
            </>
          ) : (
            <GhostButton label="Delete all saved conversations" color={t.text} onPress={() => setConfirming('all')} />
          )}
          {message !== null && <Text style={[type.small, { color: t.text, textAlign: 'center' }]}>{message}</Text>}
        </View>
      )}
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  section: { marginTop: space(7) },
  footer: { gap: space(2) },
  phrases: { gap: space(2.5), marginTop: space(3) },
  actions: { marginTop: space(7), gap: space(3) },
  delete: { marginTop: space(7), gap: space(3) },
  empty: { marginTop: space(7) },
  packs: { marginTop: space(7), gap: space(3) },
  cardActions: { marginTop: space(4), gap: space(2) },
  deleteAll: { marginTop: space(8), gap: space(3), paddingBottom: space(4) },
});
