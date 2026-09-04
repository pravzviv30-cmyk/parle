/** A quiet library of the learner's own, curated Tutor conversations. */

import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import type { ConversationPack } from '@luvani/core';
import { Card, GhostButton, Label, OutlineButton, PillButton } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { paper, signal, space, type } from '../theme.ts';
import { orderedConversationPacks } from './model.ts';

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
}: {
  packs: readonly ConversationPack[];
  onBack: () => void;
  onReview: (pack: ConversationPack) => void;
  onContinue: (pack: ConversationPack) => void;
  onDeleteOne: (pack: ConversationPack) => Promise<DeleteResult>;
  onDeleteAll: () => Promise<DeleteResult>;
}) {
  const [selected, setSelected] = useState<ConversationPack | null>(null);
  const [confirming, setConfirming] = useState<string | 'all' | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const ordered = orderedConversationPacks(packs);

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
        <Label>Conversation</Label>
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

        {selected.pronunciationFocus !== null && (
          <View style={st.section}>
            <Label>Pronunciation, if helpful</Label>
            <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{selected.pronunciationFocus}</Text>
          </View>
        )}

        {selected.state === 'ready' ? (
          <View style={st.actions}>
            <PillButton label="Review phrases" onPress={() => onReview(selected)} />
            <OutlineButton label="Continue talking" onPress={() => onContinue(selected)} />
          </View>
        ) : (
          <Card style={st.section}>
            <Text style={[type.bodyStrong, { color: paper.ink }]}>{selected.state === 'generating' ? 'Your conversation is becoming practice.' : 'This conversation needs a little more time.'}</Text>
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>Your saved phrases remain available in My French.</Text>
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
      <Label>My French</Label>
      <Text accessibilityRole="header" style={[type.display, { color: paper.ink, marginTop: space(2) }]}>Your conversations</Text>
      <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>Curated phrases, corrections and practice from the situations you have spoken through.</Text>

      {ordered.length === 0 ? (
        <Card style={st.empty}>
          <Text style={[type.bodyStrong, { color: paper.ink }]}>No saved conversations yet</Text>
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>Finish a Tutor conversation and it will appear here as practice you can return to.</Text>
        </Card>
      ) : (
        <View style={st.packs}>
          {ordered.map((pack) => (
            <Card key={pack.id}>
              <Text style={[type.bodyStrong, { color: paper.ink }]}>{pack.title.en}</Text>
              <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{pack.title.fr}</Text>
              <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{pack.summary}</Text>
              <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{packStatus(pack)}{dateLine(pack.createdAt) ? ` · ${dateLine(pack.createdAt)}` : ''}</Text>
              <View style={st.cardActions}>
                <OutlineButton label="Open conversation" onPress={() => setSelected(pack)} />
                {pack.state === 'ready' && <GhostButton label="Continue talking" color={paper.ink} onPress={() => onContinue(pack)} />}
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
