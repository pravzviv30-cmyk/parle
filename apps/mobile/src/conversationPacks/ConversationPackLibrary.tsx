import { Illustration } from '../art/flat/Illustration.tsx';
/** A quiet library of the learner's own, curated Tutor conversations. */

import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import type { ConversationPack } from '@luvani/core';
import { Card, GhostButton, Label, OutlineButton, PillButton } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { paper, signal, space, type } from '../theme.ts';
import { orderedConversationPacks } from './model.ts';
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
}: {
  packs: readonly ConversationPack[];
  /**
   * Open on this conversation's detail, once the packs have loaded and only if
   * it is still among them. A deleted or unknown id leaves the list showing.
   */
  initialPackId?: string;
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
  const nav = useNavigation<{ navigate: (screen: string) => void }>();
  const [selected, setSelected] = useState<ConversationPack | null>(null);
  const [confirming, setConfirming] = useState<string | 'all' | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const ordered = orderedConversationPacks(packs);
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
    const target = packs.find((pack) => pack.id === initialPackId);
    if (target === undefined) return;
    openedRef.current = true;
    setSelected(target);
  }, [packs, initialPackId]);

  const leaveDetail = () => {
    setConfirming(null);
    setMessage(null);
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
    }).finally(() => setBusy(false));
  };

  const removeAll = () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    void onDeleteAll().then((result) => {
      if (result.ok) setConfirming(null);
      else setMessage(result.message);
    }).finally(() => setBusy(false));
  };

  if (selected !== null) {
    return (
      <ScrollScreen bottom="tab" header={<ScreenHeader back={{ onPress: leaveDetail }} />}>
        <Label>Practice from conversation</Label>
        <Text accessibilityRole="header" style={[type.display, { color: paper.ink, marginTop: space(2) }]}>{selected.title.en}</Text>
        <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(1) }]}>{selected.title.fr}</Text>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(3) }]}>{selected.summary}</Text>

        {selected.keyPhrases.length > 0 && (
          <View style={st.section}>
            <Label>You practised</Label>
            <View style={st.phrases}>
              {selected.keyPhrases.map((phrase) => (
                <Card key={`${phrase.fr}\u0000${phrase.en}`}>
                  <Text style={[type.bodyStrong, { color: paper.ink }]}>{phrase.fr}</Text>
                  {phrase.frWritten !== null && <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{phrase.frWritten}</Text>}
                  <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{phrase.en}</Text>
                </Card>
              ))}
            </View>
          </View>
        )}

        {selected.corrections[0] && (
          <View style={st.section}>
            <Label>One useful focus</Label>
            <Card style={{ marginTop: space(2.5) }}>
              <Text style={[type.bodyStrong, { color: paper.ink }]}>{selected.corrections[0].better}</Text>
              <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{selected.corrections[0].betterEn}</Text>
              <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{selected.corrections[0].why}</Text>
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
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{REVISION_COPY.process}</Text>
            {revision.before.correction !== null && (
              <Card style={{ marginTop: space(2.5) }}>
                <Text style={[type.small, { color: paper.inkSoft }]}>{REVISION_COPY.earlier}</Text>
                <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>« {revision.before.correction.quote} »</Text>
                <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(1) }]}>{revision.before.correction.better}</Text>
              </Card>
            )}
            {revision.before.practice !== null && (
              <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{PRACTICE_BEFORE[revision.before.practice]}</Text>
            )}
            {correctionLine(revision) !== null && (
              <Text style={[type.body, { color: paper.ink, marginTop: space(2) }]}>{correctionLine(revision)}</Text>
            )}
          </View>
        )}

        {selected.pronunciationFocus !== null && (
          <View style={st.section}>
            <Label>Pronunciation, if helpful</Label>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{selected.pronunciationFocus}</Text>
          </View>
        )}

        {selected.state === 'ready' ? (
          <View style={st.actions}>
            {/* Two routes, each saying what it costs. Practice is module work
                and uses no live minutes; the tutor revisit is live, is drawn
                only when the plan opens it, and says it uses minutes. */}
            <PillButton label="Review phrases" onPress={() => onReview(selected)} />
            <Text style={[type.small, { color: paper.inkSoft }]}>{RECOMMENDED.noMinutes}</Text>
            {onContinue !== undefined && (
              <>
                <OutlineButton label="Continue talking" onPress={() => onContinue(selected)} />
                <Text style={[type.small, { color: paper.inkSoft }]}>{PRACTICE_ALTERNATIVES.revisitUses}</Text>
              </>
            )}
          </View>
        ) : (
          <Card style={st.section}>
            <Text style={[type.bodyStrong, { color: paper.ink }]}>{selected.state === 'generating' ? 'Your conversation is becoming practice.' : 'This conversation needs a little more time.'}</Text>
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>Your saved phrases remain available in Progress.</Text>
          </Card>
        )}

        {message !== null && <Text style={[type.small, { color: signal.correspondance, marginTop: space(4) }]}>{message}</Text>}
        <View style={st.delete}>
          {confirming === selected.id ? (
            <>
              <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>Delete this curated conversation and its details? Your earned phrases and reviews stay.</Text>
              <OutlineButton label={busy ? 'Deleting…' : 'Delete conversation'} disabled={busy} onPress={() => removeOne(selected)} />
              <GhostButton label="Keep conversation" color={paper.ink} disabled={busy} onPress={() => setConfirming(null)} />
            </>
          ) : (
            <GhostButton label="Delete this conversation" color={signal.correspondance} onPress={() => setConfirming(selected.id)} />
          )}
        </View>
      </ScrollScreen>
    );
  }

  return (
    <ScrollScreen bottom="tab" header={<ScreenHeader back={{ onPress: onBack }} />}>
      <Label>Progress</Label>
      <Text accessibilityRole="header" style={[type.display, { color: paper.ink, marginTop: space(2) }]}>Practice from conversations</Text>
      <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>Curated phrases and corrections from situations you spoke through. Full conversation text is saved only if you choose it separately after a recap.</Text>

      {ordered.length === 0 ? (
        <Card style={st.empty}>
          <Illustration name="state-notebook" fit="small" />
          <Text style={[type.bodyStrong, { color: paper.ink }]}>No conversation practice yet</Text>
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>Finish a Tutor conversation and its curated practice can appear here.</Text>
        <PillButton label="Choose a scene" onPress={() => nav.navigate('Missions')} /></Card>
      ) : (
        <View style={st.packs}>
          {ordered.map((pack) => (
            <Card key={pack.id}>
              <Text style={[type.bodyStrong, { color: paper.ink }]}>{pack.title.en}</Text>
              <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{pack.title.fr}</Text>
              <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{pack.summary}</Text>
              <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{packStatus(pack)}{dateLine(pack.createdAt) ? `, ${dateLine(pack.createdAt)}` : ''}</Text>
              <View style={st.cardActions}>
                <OutlineButton label="Open conversation" onPress={() => setSelected(pack)} />
                {pack.state === 'ready' && onContinue !== undefined && (
                  <GhostButton label="Continue talking" color={paper.ink} onPress={() => onContinue(pack)} />
                )}
              </View>
            </Card>
          ))}
        </View>
      )}

      {ordered.length > 0 && (
        <View style={st.deleteAll}>
          {confirming === 'all' ? (
            <>
              <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>Delete all curated Tutor conversations? Your earned phrases and reviews stay.</Text>
              <OutlineButton label={busy ? 'Deleting…' : 'Delete all conversations'} disabled={busy} onPress={removeAll} />
              <GhostButton label="Keep conversations" color={paper.ink} disabled={busy} onPress={() => setConfirming(null)} />
            </>
          ) : (
            <GhostButton label="Delete all saved conversations" color={signal.correspondance} onPress={() => setConfirming('all')} />
          )}
          {message !== null && <Text style={[type.small, { color: signal.correspondance, textAlign: 'center' }]}>{message}</Text>}
        </View>
      )}
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  section: { marginTop: space(7) },
  phrases: { gap: space(2.5), marginTop: space(3) },
  actions: { marginTop: space(7), gap: space(3) },
  delete: { marginTop: space(7), gap: space(3) },
  empty: { marginTop: space(7) },
  packs: { marginTop: space(7), gap: space(3) },
  cardActions: { marginTop: space(4), gap: space(2) },
  deleteAll: { marginTop: space(8), gap: space(3), paddingBottom: space(4) },
});
