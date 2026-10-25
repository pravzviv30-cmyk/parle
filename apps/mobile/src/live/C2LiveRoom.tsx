import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Press } from '../components.tsx';
import { bType, decorative } from '../theme.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import type { OrbState } from '../tutor/VoiceOrb.tsx';
import { Transcript } from '../tutor/Transcript.tsx';
import { enterSubmits, keyPressFrom } from '../tutor/enterSubmit.ts';
import { BMic } from '../today/TodayParts.tsx';
import type { TurnLine } from './turns.ts';
import { canResumeSpeaking, liveRoomControlsVisible } from './c2TranscriptPolicy.ts';
import { RoomReportSheet } from './ReportSheet.tsx';
import { reportAddress, REPORT_COPY } from '../settings/reportMail.ts';
import { AskedCard, BulbGlyph, CloseGlyph, FlagGlyph, GoalsStrip, HelpLadder, HelpSheet, KeyboardMark, LiveOrb, LiveTopBar, MicControl, SheetPrimary, SheetSecondary, SideControl, TutorBubble, YouBubble } from './LiveParts.tsx';
import type { HeldTurnState } from '@luvani/core';
import { HELP_COPY, askedLabel, quietVoiceControl, roomNote, sendButton, tapToSendControl, goalStrip, helpLadder, ladderSpoken, liveBubbles, lastTutorLine, moreHelpOffered, type SupportKind } from './liveRoomView.ts';

/**
 * Presentation only. Every action is supplied by the existing session owner.
 *
 * 2026-10-21 UI-008, artboards B-Live and B-LiveHelp: the room on its blue
 * ground in both themes. The top bar (leave, the scene, its pace), the goals
 * strip, the tutor's orb with the state in words, the tutor's last line and
 * the learner's words, then Type, the mic and Help. Help opens the cream sheet
 * (the M3 ground in dark): what the tutor asked, the ladder Hint, Choices,
 * Line given over the live rung, the rung's own content, "More help: show the
 * line", "Say your choice" and the footnote. Every rule is in liveRoomView.ts.
 *
 * Closed beta: when the owner passes `report`, a quiet flag disc sits after
 * the pace pill and opens "Report this reply" in the same sheet layer as Help.
 * The room never opens Mail, because leaving the app drops the room: the
 * sheet saves the report (`report.pending`, owned by the screen) and the end
 * card opens the mail sheet by itself. A saved report fills the disc.
 * The owner passes it only for the live room itself, never for the waiting,
 * error or safety surfaces.
 */
export function C2LiveRoom({ tutorName, description, state, caption, turns, tutorSpeaking, partialTranscript,
  typing, startedWithSpeech = true, ready = true, modePending = false, active = true, embedded = false,
  transcriptVisible, onTranscriptVisibility, draft, onDraft, onSend, onModeChange, onMic, micOpen,
  onEnd, onReplayTutor, canSend = true, top, support, tools, footer, notice,
  title, pace = null, goals = [], helpKind = 'none', moreHelp, report, quietVoice = false, onQuietVoice,
  tapToSend = false, onTapToSend, heldTurn = null, onSendTurn, wrappingUp = false,
}: {
  tutorName: string; description: string; state: OrbState; caption: string;
  turns: readonly TurnLine[]; tutorSpeaking: boolean; partialTranscript?: string | null;
  typing: boolean; startedWithSpeech?: boolean; ready?: boolean; modePending?: boolean;
  active?: boolean; embedded?: boolean; transcriptVisible: boolean; onTranscriptVisibility: (visible: boolean) => void;
  draft: string; onDraft: (text: string) => void; onSend: () => Promise<boolean>;
  onModeChange: (typing: boolean) => void; onMic: () => void; micOpen: boolean;
  onEnd: () => void; onReplayTutor?: () => void; canSend?: boolean;
  top?: ReactNode; support?: ReactNode; tools?: ReactNode; footer?: ReactNode; notice?: string | null;
  /** The scene's name over its line; the tutor when there is no scene. */
  title?: string;
  /** "About N min", the scene's own pace (`paceLabel`), or null. */
  pace?: string | null;
  /** The scene's goals, from `visibleMissionTasks`. */
  goals?: readonly { id: string; goalEn: string; achieved: boolean }[];
  /** The live rung's content kind, for the help ladder. */
  helpKind?: SupportKind;
  /** Steps the rung on: the session's own help request. */
  moreHelp?: { onPress: () => void; disabled: boolean };
  /** The closed beta's report control: whether a report is saved for the end card. Absent: no control. */
  report?: { pending: boolean; onPending: (pending: boolean) => void };
  /** Quiet voice, the owner's device preference (useQuietVoice). Absent: no switch. */
  quietVoice?: boolean;
  onQuietVoice?: (on: boolean) => void;
  /** Tap to send, the owner's device preference (useTapToSend). Absent: no switch and no Send. */
  tapToSend?: boolean;
  onTapToSend?: (on: boolean) => void;
  /** Where the held turn stands (useLiveSession `heldTurn`). */
  heldTurn?: HeldTurnState | null;
  /** Commits the held turn (useLiveSession `sendTurn`). */
  onSendTurn?: () => void;
  /** The tutor has said time is nearly up (useLiveSession `wrappingUp`). */
  wrappingUp?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const t = useB();
  const st = useThemedStyles(makeStyles);
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
  // The report sheet shares Help's layer, so opening Help closes it.
  const [reportOpen, setReportOpen] = useState(false);
  const reportable = report !== undefined && reportAddress() !== null;
  useEffect(() => { if (helpOpen) setReportOpen(false); }, [helpOpen]);
  const chips = goalStrip(goals);
  const bubbles = liveBubbles(turns, partialTranscript);
  const asked = lastTutorLine(turns);
  const ladder = helpLadder(helpKind);
  const helpAvailable = Boolean(support || tools || moreHelp);
  const quiet = onQuietVoice ? quietVoiceControl(typing, quietVoice) : null;
  const tap = onTapToSend ? tapToSendControl(typing, tapToSend) : null;
  const sendTurn = tap !== null && tap.checked && onSendTurn && ready ? sendButton(heldTurn, tutorSpeaking) : null;
  const note = roomNote(typing, startedWithSpeech, tutorName, quiet !== null && quiet.checked, { wrappingUp, tapToSend: tap !== null && tap.checked, heldTurn });
  const speakDisabled = !canResumeSpeaking(startedWithSpeech, ready, modePending);
  const sayChoice = () => {
    setHelpOpen(false);
    if (typing) { input.current?.focus(); return; }
    if (!micOpen && ready && !modePending) onMic();
  };
  return <KeyboardAvoidingView style={st.shell} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} enabled={Platform.OS !== 'web'}>
    <View style={[st.column, { paddingTop: embedded ? 12 : insets.top + 20, paddingBottom: keyboardOpen ? 10 : Math.max(insets.bottom, 10) + 10 }]}>
      <View style={st.head} onTouchEnd={dismiss}>
        <LiveTopBar title={title ?? `${tutorName}, your tutor`} line={description} pace={pace}
          report={reportable ? <Press haptic="none" accessibilityLabel={report.pending ? REPORT_COPY.pendingControl : REPORT_COPY.control} accessibilityState={report.pending ? { selected: true } : { expanded: reportOpen }} onPress={() => { dismiss(); setHelpOpen(false); setReportOpen(value => !value); }} style={[st.report, report.pending && st.reportPending]}><FlagGlyph size={18} color={report.pending ? t.brand : t.onBrandSoft} /></Press> : null}
          leave={<Press haptic="none" onPress={onEnd} accessibilityLabel="End session" style={st.leave}><CloseGlyph size={18} color={t.onBrand} /></Press>} />
        <GoalsStrip chips={chips} />
      </View>
      {top ? <ScrollView style={st.top} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">{top}</ScrollView> : null}
      <View style={st.linkRow}>
      <Press haptic="none" accessibilityLabel={transcriptVisible ? 'Hide live transcript' : 'Show live transcript'}
        accessibilityState={{ expanded: transcriptVisible }} aria-expanded={transcriptVisible} onPress={() => { dismiss(); onTranscriptVisibility(!transcriptVisible); }} style={st.transcriptToggle}>
        <Text style={[bType.semi13, { color: t.onBrandSoft }]}>{transcriptVisible ? 'Hide transcript' : 'Show transcript'}</Text>
      </Press>
      {quiet && onQuietVoice ? <Press haptic="none" accessibilityRole="switch" accessibilityLabel={quiet.label} accessibilityHint={quiet.hint}
        accessibilityState={{ checked: quiet.checked }} aria-checked={quiet.checked}
        onPress={() => { dismiss(); const next = !quiet.checked; onQuietVoice(next); if (next) onTranscriptVisibility(true); }} style={st.transcriptToggle}>
        <Text style={[bType.semi13, { color: t.onBrandSoft }]}>{quiet.label}: {quiet.checked ? 'On' : 'Off'}</Text>
      </Press> : null}
      {tap && onTapToSend ? <Press haptic="none" accessibilityRole="switch" accessibilityLabel={tap.label} accessibilityHint={tap.hint}
        accessibilityState={{ checked: tap.checked }} aria-checked={tap.checked}
        onPress={() => { dismiss(); onTapToSend(!tap.checked); }} style={st.transcriptToggle}>
        <Text style={[bType.semi13, { color: t.onBrandSoft }]}>{tap.label}: {tap.checked ? 'On' : 'Off'}</Text>
      </Press> : null}
      </View>
      {/* Keep the thread mounted while hidden so its history and scroll survive. */}
      <View style={[st.thread, st.threadCard, !transcriptVisible && st.hidden]} accessibilityElementsHidden={!transcriptVisible} aria-hidden={!transcriptVisible} importantForAccessibility={transcriptVisible ? 'auto' : 'no-hide-descendants'}>
        <Transcript turns={turns} tutorName={tutorName} tutorSpeaking={tutorSpeaking} announceReply={typing}
          onReplayTutor={onReplayTutor} partialTranscript={partialTranscript} focusRevision={focusRevision} focusActive={focused || keyboardOpen} onDismissKeyboard={dismiss} />
      </View>
      {!transcriptVisible && <View style={st.thread} onTouchEnd={dismiss}>
        <LiveOrb state={state} active={active} caption={caption} size={focused || keyboardOpen || typing ? 'small' : 'full'} />
        <View style={st.bubbles}>
          {bubbles.tutor ? <TutorBubble name={tutorName} fr={bubbles.tutor.fr} en={bubbles.tutor.en} onHear={onReplayTutor} /> : null}
          {bubbles.you ? <YouBubble text={bubbles.you} /> : null}
        </View>
      </View>}
      {transcriptVisible ? <Text accessibilityLiveRegion="polite" style={[bType.bold16, st.center, { color: t.onBrand }]}>{caption}</Text> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={[bType.meta, st.notice]}>{notice}</Text> : null}
      <View style={st.footer}>
        {footer ? <View style={st.footerPanel}>{footer}</View> : <>
          {typing ? <View style={st.composer}>
            {controlsVisible && <Text style={[bType.semi13, { color: t.muted, paddingHorizontal: 16 }]}>Your message</Text>}
            <View style={st.composerRow}>
              <TextInput ref={input} accessibilityLabel="Your message to your tutor" value={draft} onChangeText={onDraft}
                placeholder="Write your reply…" placeholderTextColor={t.muted} maxLength={600} multiline scrollEnabled underlineColorAndroid="transparent"
                autoCapitalize="sentences" returnKeyType="send" submitBehavior="blurAndSubmit" onSubmitEditing={() => void submit()}
                onKeyPress={keyDraft} onFocus={() => { setFocused(true); setFocusRevision(value => value + 1); }}
                onBlur={() => setFocused(false)} editable={ready && !sending} style={[bType.line16, st.input]} />
              <Press haptic="none" accessibilityLabel={sending ? 'Sending your message' : 'Send message'}
                disabled={!canSend || !ready || !draft.trim() || sending} accessibilityState={{ disabled: !canSend || !ready || !draft.trim() || sending, busy: sending }}
                onPress={() => void submit()} style={[st.send, (!canSend || !ready || !draft.trim() || sending) && st.disabled]}>
                <Text style={[bType.bold20, { color: t.onBrand }]}>↑</Text>
              </Press>
            </View>
            {focused && <View {...decorative} pointerEvents="none" style={[StyleSheet.absoluteFill, st.composerFocus]} />}
          </View> : null}
          {sendTurn && onSendTurn && controlsVisible ? <Press haptic="light" accessibilityLabel={sendTurn.accessibilityLabel} accessibilityState={{ disabled: sendTurn.disabled }}
            disabled={sendTurn.disabled} onPress={onSendTurn} style={[st.sendTurn, sendTurn.disabled && st.disabled]}>
            <Text style={[bType.bold17, { color: t.onMint }]}>{sendTurn.label}</Text>
          </Press> : null}
          {controlsVisible && <View style={st.controlRow}>
            {typing
              ? <SideControl label="Speak" accessibilityLabel="Speak instead" icon={<BMic size={24} color={t.onBrand} />}
                  disabled={speakDisabled} onPress={() => onModeChange(false)} />
              : <SideControl label="Type" accessibilityLabel="Type instead" icon={<KeyboardMark size={24} color={t.onBrand} />}
                  disabled={!ready || modePending} onPress={() => onModeChange(true)} />}
            {!typing && ready ? <MicControl label={micOpen ? 'Listening' : 'Paused'} accessibilityLabel={micOpen ? 'Pause microphone' : 'Open microphone'}
              disabled={modePending} onPress={onMic} /> : <View {...decorative} style={st.micSpace} />}
            {helpAvailable ? <SideControl label="Help" accessibilityLabel={helpOpen ? 'Close help' : 'Get help'} expanded={helpOpen}
              icon={<BulbGlyph size={24} color={t.onBrand} />} onPress={() => setHelpOpen(value => !value)} /> : <View {...decorative} style={st.sideSpace} />}
          </View>}
          {note !== null && controlsVisible && <Text style={[bType.note, st.center, { color: t.onBrandSoft }]}>{note}</Text>}
        </>}
      </View>
    </View>
    {reportOpen && reportable && report && !helpOpen ? <View style={[st.sheetLayer, { paddingBottom: Math.max(insets.bottom, 10) + 20 }]}>
      <RoomReportSheet tutorName={tutorName} pending={report.pending} onPending={report.onPending} onClose={() => setReportOpen(false)} />
    </View> : null}
    {helpOpen && controlsVisible && helpAvailable && !footer ? <View style={[st.sheetLayer, { paddingBottom: Math.max(insets.bottom, 10) + 20 }]}>
      <HelpSheet title={HELP_COPY.title} closeLabel={HELP_COPY.close} onClose={() => setHelpOpen(false)}>
        <ScrollView style={st.support} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 4 }}>
          {asked ? <AskedCard label={askedLabel(tutorName)} fr={asked.fr} en={asked.en} /> : null}
          <HelpLadder steps={ladder} spoken={ladderSpoken(ladder)} />
          {support}
          {moreHelp && moreHelpOffered(helpKind) ? <SheetSecondary label={HELP_COPY.more} disabled={moreHelp.disabled} onPress={moreHelp.onPress} /> : null}
          <SheetPrimary label={typing ? 'Type your choice' : HELP_COPY.say} icon={typing ? <KeyboardMark size={20} color={t.onPrimary} /> : undefined} disabled={!ready} onPress={sayChoice} />
          <Text style={[bType.note, st.center, { color: t.muted }]}>{HELP_COPY.foot}</Text>
          {tools}
        </ScrollView>
      </HelpSheet>
    </View> : null}
  </KeyboardAvoidingView>;
}

function makeStyles(t: B) {
  return StyleSheet.create({
    shell: { flex: 1, minHeight: 0, backgroundColor: t.brand },
    column: { flex: 1, minHeight: 0, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 22 },
    head: { flexShrink: 0 },
    leave: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.violetDeep, alignItems: 'center', justifyContent: 'center' },
    // The report disc: the leave disc's size and place in the bar, but quieter, an
    // outline on the room rather than a filled disc, so leaving stays the louder exit.
    report: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: t.violetDeep, alignItems: 'center', justifyContent: 'center' },
    // Filled like the leave disc once a report is saved for the end card.
    // Filled in the room's words colour, not violetDeep: violetDeep on the brand
    // ground is 1.3:1, so the saved state could not be told from the empty one.
    reportPending: { backgroundColor: t.onBrand, borderColor: t.onBrand },
    center: { textAlign: 'center' },
    top: { flexGrow: 0, maxHeight: '20%', paddingTop: 8 },
    linkRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 8 },
    transcriptToggle: { minHeight: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingHorizontal: 12 },
    thread: { flex: 1, minHeight: 0 }, hidden: { flex: 0, height: 0, opacity: 0, overflow: 'hidden' },
    threadCard: { backgroundColor: t.card, borderRadius: 22, paddingHorizontal: 12 },
    bubbles: { paddingTop: 20, gap: 10 },
    notice: { paddingVertical: 6, textAlign: 'center', color: t.onBrandSoft },
    support: { flexGrow: 0, flexShrink: 1 },
    sheetLayer: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '80%', backgroundColor: t.ground, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
    footer: { gap: 10, paddingTop: 8 },
    footerPanel: { backgroundColor: t.card, borderRadius: 24, padding: 16, gap: 10 },
    composer: { backgroundColor: t.card, borderColor: t.sun, borderWidth: 1.5, borderRadius: 22, paddingTop: 8, paddingBottom: 8 },
    composerFocus: { borderRadius: 22, borderColor: t.sun, borderWidth: 2 },
    composerRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 10, gap: 8 },
    input: { color: t.text, flex: 1, minHeight: 36, maxHeight: 104, padding: 0, paddingVertical: 4, ...(Platform.OS === 'web' ? { outlineStyle: 'solid' as const, outlineWidth: 0 } : {}) },
    send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: t.brand },
    // Mint like the mic beside it: Send is the end of the learner's own turn.
    sendTurn: { minHeight: 54, borderRadius: 27, backgroundColor: t.mint, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, alignSelf: 'center', minWidth: 160 },
    controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    micSpace: { width: 84 }, sideSpace: { width: 72 },
    disabled: { opacity: 0.55 },
  });
}
