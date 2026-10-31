import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, TextInput, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { GhostButton, PillButton, Sheet } from '../components.tsx';
import { bType, frenchText, space, type, radius, HAIRLINE } from '../theme.ts';
import { drillStage } from './drillStage.ts';
import { arrived } from '../motion/haptics.ts';
import { activeUserId, scopeGeneration } from '../storage/scope.ts';
import { discardRecording } from '../speech/discardRecording.ts';
import { transcribeRecordedAttempt } from '../speech/transcribeAttempt.ts';
import { judgeFixLine } from '../speech/fixLineAttempt.ts';
import type { ClosureRepair } from '../conversationPacks/closure.ts';
import { SpokenAttempt } from './SpokenAttempt.tsx';
import { FixLineSession, type FixLineState } from './fixLineSession.ts';
import { useB } from '../main/bTheme.tsx';

/**
 * Fix your line, opened from Recap. 2026-10-31 drill B v2 (UI-016; drill-b.md
 * "Screens and states" 9): the calm card sheet, what was said, "Try this" on
 * the speak stage's tint, then the one mic (`SpokenAttempt`, whose Cloud
 * listens only while the mic is live, as on every speak drill).
 *
 * Mounted only while open. Correction text never becomes a route or URL. */
export function FixLineSheet({ repair, onClose }: { repair: ClosureRepair; onClose(): void }) {
  const t = useB();
  const focused = useIsFocused();
  const owner = useRef(scopeGeneration());
  const userId = useRef(activeUserId());
  const foreground = useRef(AppState.currentState === 'active');
  const focus = useRef(focused); focus.current = focused;
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const [state, setState] = useState<FixLineState>({ phase: 'ready', attempt: '', hint: null });
  const [session] = useState(() => new FixLineSession({
    now: Date.now,
    current: () => focus.current && foreground.current && owner.current === scopeGeneration() && userId.current !== null && userId.current === activeUserId(),
    changed: setState,
    judge: (attempt, abort, current) => userId.current === null ? Promise.resolve(null) : judgeFixLine(userId.current, repair, attempt, owner.current, abort, current),
    transcribe: (uri, abort, current) => userId.current === null ? Promise.resolve(null) : transcribeRecordedAttempt(userId.current, uri, owner.current, { signal: abort, current }),
    discard: discardRecording,
    success: arrived,
  }));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      foreground.current = next === 'active';
      if (!foreground.current) { session.dispose(); closeRef.current(); }
    });
    const timer = setInterval(() => {
      if (owner.current !== scopeGeneration() || userId.current !== activeUserId()) { session.dispose(); closeRef.current(); return; }
    }, 250);
    return () => { clearInterval(timer); subscription.remove(); session.dispose(); };
  }, [session]);
  useEffect(() => { if (!focused) { session.dispose(); closeRef.current(); } }, [focused, session]);
  const close = () => { session.dispose(); onClose(); };
  const busy = state.phase === 'checking' || state.phase === 'transcribing';
  const ended = state.phase === 'success' || state.phase === 'finished';
  const take = useCallback((uri: string | null) => { void session.take(uri); }, [session]);
  const typing = useCallback(() => session.edit(), [session]);
  // The speak stage's tint behind "Try this", as the drill draws it (drill B v2).
  const stage = drillStage('fixes-say', t.mode);
  return <Sheet visible title="Fix your line" onClose={close} surface={t.card} ink={t.text} footer={<GhostButton label="Done" onPress={close} />}>
    <Text style={[type.small, { color: t.muted }]}>Take your time.</Text>
    <View style={{ gap: space(1) }}>
      <Text style={[bType.bold12, { color: t.muted }]}>You said</Text>
      <Text {...frenchText} style={[bType.bold16, { color: t.text }]}>{repair.quote}</Text>
    </View>
    <View style={{ backgroundColor: t[stage.band], borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, gap: 2 }}>
      <Text style={[bType.bold12, { color: t[stage.eyebrow] }]}>Try this</Text>
      <Text {...frenchText} style={[bType.title17, { color: t.text }]}>{repair.better}</Text>
      <Text style={[type.small, { color: t.muted }]}>{repair.betterEn}</Text>
    </View>
    <Text style={[type.small, { color: t.muted }]}>{repair.why}</Text>
    {!ended && <>
      <Text style={[bType.bold14, { color: t.text }]}>Try again, keeping the corrected part.</Text>
      <SpokenAttempt busy={busy} onTake={take} onTyping={typing} />
      {state.phase === 'transcribing' && <Text accessibilityLiveRegion="polite" style={[type.small, { color: t.text }]}>Preparing your words…</Text>}
      {state.phase !== 'ready' && state.phase !== 'transcribing' && <>
        <Text style={[type.small, { color: t.muted }]}>Check the transcript, then tap Check.</Text>
        <TextInput accessibilityLabel="Your French retry" placeholder="e.g. Je voudrais un café, s’il vous plaît." placeholderTextColor={t.muted}
          value={state.attempt} onChangeText={value => session.edit(value)} editable={!busy} multiline maxLength={600}
          style={[type.body, { color: t.text, borderColor: t.field, borderWidth: HAIRLINE, borderRadius: radius.card, padding: space(3), minHeight: 96 }]} />
        <PillButton label={state.phase === 'checking' ? 'Checking…' : 'Check'} disabled={busy || state.attempt.trim() === ''} onPress={() => { void session.check(); }} />
      </>}
    </>}
    {state.phase === 'retry' && <Text accessibilityLiveRegion="polite" style={[type.body, { color: t.text }]}>{state.hint ?? 'Try the corrected part once more.'}</Text>}
    {state.phase === 'unavailable' && <Text accessibilityLiveRegion="polite" style={[type.body, { color: t.muted }]}>The tutor couldn’t check this time. Keep the corrected line, or try again.</Text>}
    {state.phase === 'success' && <View style={{ backgroundColor: t.mint, borderRadius: radius.card, padding: space(4) }}><Text accessibilityLiveRegion="polite" style={[type.bodyStrong, { color: t.onMint }]}>That fixes the part we practised.</Text></View>}
    {state.phase === 'finished' && <Text accessibilityLiveRegion="polite" style={[type.body, { color: t.text }]}>Practice ended.</Text>}
    <Text style={[bType.note, { color: t.muted }]}>Text check only. This retry is not saved.</Text>
  </Sheet>;
}
