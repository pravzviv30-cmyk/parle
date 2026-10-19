import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { SavedConversationText } from '@luvani/core';
import { useAuth } from '../auth/useAuth.tsx';
import { MainButton, MainRow, MainScreen } from '../main/MainUI.tsx';
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { ConfirmSheet } from '../layout.tsx';
import { space, type, frenchText } from '../theme.ts';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { deleteText, listText } from './textClient.ts';

export function SavedTextScreen() {
  const nav = useNavigation<{ goBack: () => void }>();
  const { user, adapter } = useAuth();
  const { colors } = useMainAppearance();
  const route = useRoute<{ key: string; name: string; params?: { sessionId?: string } }>();
  const rawSessionId = route.params?.sessionId;
  const initialSessionId = typeof rawSessionId === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(rawSessionId) ? rawSessionId : null;
  const openedInitial = useRef(false);
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
  const exit = () => { if (selected && selected.sessionId !== initialSessionId) { setSelected(null); setConfirming(false); } else nav.goBack(); };
  // An original-text link selects only its own session. Loading another page
  // can find it later; it never substitutes a similarly titled conversation.
  useEffect(() => {
    if (openedInitial.current || initialSessionId === null || rows === null || scope !== scopeGeneration()) return;
    const found = rows.find(row => row.sessionId === initialSessionId);
    if (found) { openedInitial.current = true; setSelected(found); }
  }, [rows, initialSessionId, scope]);
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
  const linkedMissing = initialSessionId !== null && !openedInitial.current && rows !== null && !rows.some(row => row.sessionId === initialSessionId);
  return <MainScreen title={selected?.title ?? 'Saved conversation text'} onBack={exit} bottom="inset">
    <Text style={[type.small, { color: colors.muted }]}>Only text you chose to save. Speech recognition can differ from what you said. No recordings are kept here.</Text>
    {!user ? <Text style={[type.body, { color: colors.muted }]}>Sign in to read saved conversation text.</Text> : selected ? <>
      <Text style={[type.small, { color: colors.muted }]}>Saved {new Date(selected.savedAt).toLocaleDateString()}. You chose to keep this text after the conversation.</Text>
      {selected.lines.map(line => <View key={line.id} style={{ gap: space(2), padding: space(5), borderRadius: space(6), backgroundColor: line.who === 'learner' ? colors.ochre : line.who === 'tutor' ? colors.inset : colors.surface }}>
        <Text style={[type.label, { color: colors.text }]}>{line.who === 'learner' ? 'You' : line.who === 'narration' ? 'Scene' : line.who === 'coach' ? 'Tutor coaching' : 'Tutor'}</Text>
        <Text {...(line.who === 'coach' ? {} : frenchText)} style={[type.body, { color: colors.text }]}>{line.frWritten ?? line.fr}</Text>
        {line.en ? <Text style={[type.small, { color: colors.muted }]}>{line.en}</Text> : null}
      </View>)}
      <MainButton label="Delete this conversation text" tone="quiet" disabled={busy} onPress={() => setConfirming(true)} />
    </> : rows === null ? <Text style={[type.body, { color: colors.muted }]}>{message ? 'The saved text could not be loaded.' : 'Loading saved text…'}</Text> : <>
      {linkedMissing && <Text accessibilityLiveRegion="polite" style={[type.body, { color: colors.text }]}>{nextCursor !== null ? 'This conversation’s text is not on the loaded page. Load older saved text to look for it.' : 'There is no saved text here for this conversation. It may not have been saved, or it may have been deleted. Its practice is separate.'}</Text>}
      {rows.length === 0 ? <Text style={[type.body, { color: colors.muted }]}>No conversation text saved. After a conversation, you can choose Save conversation text on the last recap page.</Text> : rows.map(row => <MainRow key={row.sessionId} title={row.title} detail={`${new Date(row.savedAt).toLocaleDateString()}${row.lines[0] ? `. ${row.lines[0].frWritten ?? row.lines[0].fr}` : ''}`} onPress={() => setSelected(row)} />)}
    </>}
    {message !== '' && message != null && <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.muted }]}>{message}</Text>}
    {!selected && nextCursor !== null && <MainButton label={moreBusy ? 'Loading…' : 'Load older saved text'} tone="quiet" disabled={moreBusy} onPress={more} />}
    {!selected && rows === null && message !== null && <MainButton label="Try again" onPress={() => setAttempt(value => value + 1)} />}
    <ConfirmSheet visible={confirming} title="Delete this conversation text?" body="The saved words are permanently removed. Your curated phrases, corrections and practice stay. This text cannot be saved again from this session." confirmLabel={busy ? 'Deleting…' : 'Delete text permanently'} cancelLabel="Keep this text" onConfirm={remove} onCancel={() => { if (!busy) setConfirming(false); }} />
  </MainScreen>;
}
