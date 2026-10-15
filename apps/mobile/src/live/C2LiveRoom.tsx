import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Press } from '../components.tsx';
import { boldType as type, decorative } from '../theme.ts';
import { boldRhythm as c } from '../palette.ts';
import { BoldVoiceOrb } from '../onboarding/BoldVoiceOrb.tsx';
import type { OrbState } from '../tutor/VoiceOrb.tsx';
import { Transcript } from '../tutor/Transcript.tsx';
import { enterSubmits, keyPressFrom } from '../tutor/enterSubmit.ts';
import type { TurnLine } from './turns.ts';
import { canResumeSpeaking, liveRoomControlsVisible } from './c2TranscriptPolicy.ts';

/** Presentation only. Every action is supplied by the existing session owner. */
export function C2LiveRoom({ tutorName, description, state, caption, turns, tutorSpeaking, partialTranscript,
  typing, startedWithSpeech = true, ready = true, modePending = false, active = true, embedded = false,
  transcriptVisible, onTranscriptVisibility, draft, onDraft, onSend, onModeChange, onMic, micOpen,
  onEnd, onReplayTutor, canSend = true, top, support, tools, footer, notice,
}: {
  tutorName: string; description: string; state: OrbState; caption: string;
  turns: readonly TurnLine[]; tutorSpeaking: boolean; partialTranscript?: string | null;
  typing: boolean; startedWithSpeech?: boolean; ready?: boolean; modePending?: boolean;
  active?: boolean; embedded?: boolean; transcriptVisible: boolean; onTranscriptVisibility: (visible: boolean) => void;
  draft: string; onDraft: (text: string) => void; onSend: () => Promise<boolean>;
  onModeChange: (typing: boolean) => void; onMic: () => void; micOpen: boolean;
  onEnd: () => void; onReplayTutor?: () => void; canSend?: boolean;
  top?: ReactNode; support?: ReactNode; tools?: ReactNode; footer?: ReactNode; notice?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const input = useRef<TextInput>(null);
  const sendLock = useRef(false);
  const mounted = useRef(true);
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [focusRevision, setFocusRevision] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const controlsVisible = liveRoomControlsVisible(focused, keyboardOpen);
  const dismiss = () => { input.current?.blur(); Keyboard.dismiss(); setFocused(false); setKeyboardOpen(false); };
  useEffect(() => {
    mounted.current = true;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      setKeyboardOpen(true);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => { input.current?.blur(); setFocused(false); setKeyboardOpen(false); });
    return () => { mounted.current = false; show.remove(); hide.remove(); };
  }, []);
  useEffect(() => { if (!active) dismiss(); }, [active]);
  const submit = async () => {
    if (!canSend || !ready || !draft.trim() || sendLock.current) return;
    sendLock.current = true; setSending(true); dismiss();
    try { await onSend(); }
    finally { sendLock.current = false; if (mounted.current) setSending(false); }
  };
  const keyDraft = (event: { preventDefault: () => void }) => {
    if (!enterSubmits(Platform.OS, keyPressFrom(event), draft)) return;
    event.preventDefault(); void submit();
  };
  return <KeyboardAvoidingView style={st.shell} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} enabled={Platform.OS !== 'web'}>
    <View style={[st.column, { paddingTop: embedded ? 12 : insets.top + 20, paddingBottom: keyboardOpen ? 10 : Math.max(insets.bottom, 10) + 10 }]}>
      <View style={st.head} onTouchEnd={dismiss}>
        <Text accessibilityRole="header" style={[type.heading, st.center]}>{`${tutorName}, your tutor`}</Text>
        <Text style={[type.small, st.secondary, st.center]}>{description}</Text>
        <BoldVoiceOrb state={state} size={focused || keyboardOpen ? 64 : typing ? 88 : 112} active={active} />
        <Text accessibilityLiveRegion="polite" style={[type.small, st.secondary, st.center]}>{caption}</Text>
      </View>
      {top ? <ScrollView style={st.top} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">{top}</ScrollView> : null}
      <Press haptic="none" accessibilityLabel={transcriptVisible ? 'Hide live transcript' : 'Show live transcript'}
        accessibilityState={{ expanded: transcriptVisible }} aria-expanded={transcriptVisible} onPress={() => { dismiss(); onTranscriptVisibility(!transcriptVisible); }} style={st.transcriptToggle}>
        <Text style={[type.label, st.violet]}>{transcriptVisible ? 'Hide transcript' : 'Show transcript'}</Text>
      </Press>
      {/* Keep the thread mounted while hidden so its history and scroll survive. */}
      <View style={[st.thread, !transcriptVisible && st.hidden]} accessibilityElementsHidden={!transcriptVisible} aria-hidden={!transcriptVisible} importantForAccessibility={transcriptVisible ? 'auto' : 'no-hide-descendants'}>
        <Transcript turns={turns} tutorName={tutorName} tutorSpeaking={tutorSpeaking} announceReply={typing}
          onReplayTutor={onReplayTutor} partialTranscript={partialTranscript} focusRevision={focusRevision} focusActive={focused || keyboardOpen} onDismissKeyboard={dismiss} />
      </View>
      {!transcriptVisible && <View style={st.thread} onTouchEnd={dismiss} />}
      {notice ? <Text accessibilityLiveRegion="polite" style={[type.small, st.secondary, st.notice]}>{notice}</Text> : null}
      {support || tools ? <>
        {controlsVisible && <Press haptic="none" onPress={() => setHelpOpen(value => !value)} style={st.helpToggle}
          accessibilityLabel={helpOpen ? 'Hide practice support' : 'Show practice support'} accessibilityState={{ expanded: helpOpen }}>
          <Text style={[type.small, st.violet]}>{helpOpen ? 'Hide practice support' : 'Practice support'}</Text>
        </Press>}
        {helpOpen && controlsVisible && <ScrollView style={st.support} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>{support}{tools}</ScrollView>}
      </> : null}
      <View style={st.footer}>
        {footer ?? <>
          {typing ? <View style={st.composer}>
            {controlsVisible && <Text style={[type.small, st.secondary, { paddingHorizontal: 16 }]}>Your message</Text>}
            <View style={st.composerRow}>
              <TextInput ref={input} accessibilityLabel="Your message to your tutor" value={draft} onChangeText={onDraft}
                placeholder="Write your reply…" placeholderTextColor={c.muted} maxLength={600} multiline scrollEnabled underlineColorAndroid="transparent"
                autoCapitalize="sentences" returnKeyType="send" submitBehavior="blurAndSubmit" onSubmitEditing={() => void submit()}
                onKeyPress={keyDraft} onFocus={() => { setFocused(true); setFocusRevision(value => value + 1); }}
                onBlur={() => setFocused(false)} editable={ready && !sending} style={[type.body, st.input]} />
              <Press haptic="none" accessibilityLabel={sending ? 'Sending your message' : 'Send message'}
                disabled={!canSend || !ready || !draft.trim() || sending} accessibilityState={{ disabled: !canSend || !ready || !draft.trim() || sending, busy: sending }}
                onPress={() => void submit()} style={[st.send, (!canSend || !ready || !draft.trim() || sending) && st.disabled]}>
                <Text style={[type.heading, { color: c.white }]}>↑</Text>
              </Press>
            </View>
            {focused && <View {...decorative} pointerEvents="none" style={[StyleSheet.absoluteFill, st.composerFocus]} />}
          </View> : ready && <Press haptic="none" accessibilityLabel={micOpen ? 'Pause microphone' : 'Open microphone'}
            disabled={modePending} onPress={onMic} style={[st.mic, modePending && st.disabled]}>
            <Text style={[type.label, { color: c.ink }]}>{micOpen ? 'Pause microphone' : 'Resume microphone'}</Text>
          </Press>}
          {controlsVisible && <View style={st.controlRow}>
            <View style={st.mode} accessibilityRole="tablist" accessibilityLabel="How you reply">
              {(['Speaking', 'Typing'] as const).map(label => {
                const selected = label === (typing ? 'Typing' : 'Speaking');
                const disabled = label === 'Speaking' ? !canResumeSpeaking(startedWithSpeech, ready, modePending) : !ready || modePending;
                return <Press key={label} haptic="none" accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected, disabled }} aria-selected={selected}
                  disabled={disabled} onPress={() => { if (!selected) onModeChange(label === 'Typing'); }}
                  frame={{ flex: 1 }} style={[st.segment, selected && st.segmentSelected, disabled && !selected && st.disabled]}>
                  <Text style={[type.small, selected ? st.violet : st.secondary]}>{label}</Text>
                </Press>;
              })}
            </View>
            <Press haptic="none" onPress={onEnd} accessibilityLabel="End session" frame={{ flex: 1 }} style={st.end}>
              <Text style={[type.small, st.violet]}>End session</Text>
            </Press>
          </View>}
          {typing && !startedWithSpeech && controlsVisible && <Text style={[type.small, st.secondary, st.center]}>This session started in typing mode.</Text>}
        </>}
      </View>
    </View>
  </KeyboardAvoidingView>;
}

const st = StyleSheet.create({
  shell: { flex: 1, minHeight: 0, backgroundColor: c.paper },
  column: { flex: 1, minHeight: 0, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24 },
  head: { alignItems: 'center', gap: 8, flexShrink: 1 },
  center: { textAlign: 'center', color: c.ink }, secondary: { color: c.muted }, violet: { color: c.violet },
  top: { flexGrow: 0, maxHeight: '20%', paddingTop: 8 },
  transcriptToggle: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  thread: { flex: 1, minHeight: 0 }, hidden: { flex: 0, height: 0, opacity: 0, overflow: 'hidden' },
  notice: { paddingVertical: 6, textAlign: 'center' },
  helpToggle: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  support: { flexGrow: 0, maxHeight: '25%', marginBottom: 8 },
  footer: { gap: 10, paddingTop: 8 },
  composer: { backgroundColor: c.white, borderColor: c.violet, borderWidth: 1.5, borderRadius: 22, paddingTop: 8, paddingBottom: 8 },
  composerFocus: { borderRadius: 22, borderColor: c.violet, borderWidth: 2 },
  composerRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 10, gap: 8 },
  input: { color: c.ink, flex: 1, minHeight: 36, maxHeight: 104, padding: 0, paddingVertical: 4, ...(Platform.OS === 'web' ? { outlineStyle: 'solid' as const, outlineWidth: 0 } : {}) },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.violet },
  mic: { minHeight: 52, borderRadius: 20, backgroundColor: c.lavender, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  controlRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  mode: { flex: 1.85, minHeight: 44, backgroundColor: c.lavender, borderRadius: 22, padding: 4, flexDirection: 'row' },
  segment: { minHeight: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' }, segmentSelected: { backgroundColor: c.white },
  end: { minHeight: 44, paddingHorizontal: 10, borderWidth: 1.5, borderColor: c.violet, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  disabled: { opacity: 0.55 },
});
