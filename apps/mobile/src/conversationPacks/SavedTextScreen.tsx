import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { SavedConversationText } from '@luvani/core';
import { useAuth } from '../auth/useAuth.tsx';
import { GhostButton, Ledger, LedgerRow } from '../components.tsx';
import { ScrollScreen, ScreenHeader, ConfirmSheet } from '../layout.tsx';
import { paper, space, type, frenchText } from '../theme.ts';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { deleteText, listText } from './textClient.ts';

export function SavedTextScreen() {
  const nav = useNavigation<{ goBack: () => void }>();
  const { user, adapter } = useAuth();
  const [rows, setRows] = useState<SavedConversationText[] | null>(null);
  const [selected, setSelected] = useState<SavedConversationText | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const loadingMore = useRef(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const ticket = useRef(0);
  const scope = useRef(scopeGeneration()).current;
  const ownerId = useRef(user?.id).current;
  const exit = () => { if (selected) { setSelected(null); setConfirming(false); } else nav.goBack(); };
  useHardwareBack(selected !== null || confirming, confirming ? () => setConfirming(false) : exit);
  useFocusEffect(useCallback(() => {
    const issued = ++ticket.current;
    setRows(null); setSelected(null); setConfirming(false); setMessage(null); setNextCursor(null); loadingMore.current = false; setMoreBusy(false); setBusy(false);
    if (!user || scope !== scopeGeneration()) return;
    void listText(user, adapter).then(result => {
      if (issued !== ticket.current || scope !== scopeGeneration()) return;
      if (result.ok) { setRows(result.value.conversations); setNextCursor(result.value.nextCursor); } else setMessage(result.message);
    }).catch(() => { if (issued === ticket.current && scope === scopeGeneration()) setMessage('Saved text could not be loaded. Try again.'); });
    return () => { ticket.current++; };
  }, [user, adapter, attempt, scope]));
  const more = () => {
    if (!user || nextCursor === null || loadingMore.current) return;
    const issued = ticket.current;
    loadingMore.current = true; setMoreBusy(true); setMessage(null);
    void listText(user, adapter, fetch, nextCursor).then(result => {
      if (issued !== ticket.current || scope !== scopeGeneration()) return;
      if (result.ok) {
        setRows(current => [...(current ?? []), ...result.value.conversations.filter(row => !current?.some(old => old.sessionId === row.sessionId))]);
        setNextCursor(result.value.nextCursor);
      } else setMessage(result.message);
    }).catch(() => { if (issued === ticket.current && scope === scopeGeneration()) setMessage('Older saved text could not be loaded. Try again.'); }).finally(() => { if (issued === ticket.current && scope === scopeGeneration()) { loadingMore.current = false; setMoreBusy(false); } });
  };
  const remove = () => {
    if (!user || !selected || busy) return;
    const sessionId = selected.sessionId;
    const issued = ticket.current;
    setBusy(true); setMessage(null);
    void deleteText(user, adapter, sessionId).then(result => {
      if (issued !== ticket.current || scope !== scopeGeneration()) return;
      if (result.ok) { setRows(current => current?.filter(row => row.sessionId !== sessionId) ?? []); setSelected(null); setConfirming(false); }
      else setMessage(result.message);
    }).catch(() => { if (issued === ticket.current && scope === scopeGeneration()) setMessage('Deletion could not finish. Try again.'); }).finally(() => { if (issued === ticket.current && scope === scopeGeneration()) setBusy(false); });
  };
  if (scope !== scopeGeneration() || user?.id !== ownerId) return null;
  return <ScrollScreen bottom="inset" header={<ScreenHeader back={{ onPress: exit }} title={selected?.title ?? 'Saved conversation text'} />}>
    <Text style={[type.small, { color: paper.inkSoft, marginBottom: space(4) }]}>Only text you chose to save. Speech recognition can differ from what you said. No recordings are kept here.</Text>
    {!user ? <Text style={[type.body, { color: paper.inkSoft }]}>Sign in to read saved conversation text.</Text> : selected ? <>
      <Text style={[type.small, { color: paper.inkSoft, marginBottom: space(3) }]}>Saved {new Date(selected.savedAt).toLocaleDateString()}. You chose to keep this text after the conversation.</Text>
      {selected.lines.map(line => <View key={line.id} style={{ gap: space(1), marginBottom: space(4) }}>
        <Text style={[type.small, { color: paper.inkSoft }]}>{line.who === 'learner' ? 'You' : line.who === 'narration' ? 'Scene' : line.who === 'coach' ? 'Tutor coaching' : 'Tutor'}</Text>
        <Text {...(line.who === 'coach' ? {} : frenchText)} style={[type.body, { color: paper.ink }]}>{line.frWritten ?? line.fr}</Text>
        {line.en ? <Text style={[type.small, { color: paper.inkSoft }]}>{line.en}</Text> : null}
      </View>)}
      <GhostButton label="Delete this conversation text" disabled={busy} onPress={() => setConfirming(true)} />
    </> : rows === null ? <Text style={[type.body, { color: paper.inkSoft }]}>{message ? 'The saved text could not be loaded.' : 'Loading saved text…'}</Text> : rows.length === 0 ? <Text style={[type.body, { color: paper.inkSoft }]}>No conversation text saved. After a conversation, you can choose Save conversation text on the last recap page.</Text> : <Ledger>{rows.map(row => <LedgerRow key={row.sessionId} title={row.title} gloss={`${new Date(row.savedAt).toLocaleDateString()}${row.lines[0] ? `, ${row.lines[0].frWritten ?? row.lines[0].fr}` : ''}`} onPress={() => setSelected(row)} />)}</Ledger>}
    {message ? <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.inkSoft, marginTop: space(3) }]}>{message}</Text> : null}
    {!selected && nextCursor !== null && <GhostButton label={moreBusy ? 'Loading…' : 'Load older conversations'} disabled={moreBusy} onPress={more} />}
    {!selected && rows === null && message ? <GhostButton label="Try again" onPress={() => setAttempt(value => value + 1)} /> : null}
    <ConfirmSheet visible={confirming} title="Delete this conversation text?" body="The saved words are permanently removed. Your curated phrases, corrections and practice stay. This text cannot be saved again from this session." confirmLabel={busy ? 'Deleting…' : 'Delete text permanently'} cancelLabel="Keep this text" onConfirm={remove} onCancel={() => { if (!busy) setConfirming(false); }} />
  </ScrollScreen>;
}
