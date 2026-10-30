import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Press } from '../components.tsx';
import { bType, decorative } from '../theme.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import type { OrbState } from '../tutor/VoiceOrb.tsx';
import { enterSubmits, keyPressFrom } from '../tutor/enterSubmit.ts';
import { BMic } from '../today/TodayParts.tsx';
import type { TurnLine } from './turns.ts';
import { canResumeSpeaking, liveRoomControlsVisible } from './c2TranscriptPolicy.ts';
import { RoomReportSheet } from './ReportSheet.tsx';
import { reportAddress, REPORT_COPY } from '../settings/reportMail.ts';
import { AskedCard, BulbGlyph, CloseGlyph, HelpLadder, HelpSheet, KeyboardMark, LiveTopBar, SheetPrimary, SheetSecondary, SideControl } from './LiveParts.tsx';
import { GoalStamps, PortraitStage } from './StageParts.tsx';
import { NotebookSheet } from './NotebookParts.tsx';
import { CloudMic, CLOUD, RoomMenu } from './DockParts.tsx';
import { Toast } from '../art/mascots/Toast.tsx';
import { Rise } from '../motion/MascotMotion.tsx';
import type { HeldTurnState, TutorVoiceKey } from '@luvani/core';
import { HELP_COPY, CHEER_MS, portraitFit, askedLabel, cloudExpression, freshGoals, quietVoiceControl, roomMenuRows, roomNote, sendButton, tapToSendControl, helpLadder, ladderSpoken, lastTutorLine, moreHelpOffered, type RoomMenuRow, type SupportKind } from './liveRoomView.ts';

/**
 * Presentation only. Every action is supplied by the existing session owner.
 *
 * 2026-10-30 UI-014, direction D: face to face with a notebook. On the room's
 * blue ground, the top bar, the goal stamps and the tutor's portrait with live
 * level rings (StageParts); under them the notebook sheet (NotebookParts) with
 * the dock of Type, the cloud mic and Help (DockParts). The room's state is
 * spoken from a live region that is not drawn, and every rule is in
 * liveRoomView.ts and notebookView.ts.
 *
 * The room menu holds the transcript, Quiet voice and Tap to send switches
 * and, in the closed beta, "Report this reply", which opens the room report
 * sheet in the same layer as Help. The room never opens Mail, because leaving
 * the app drops the room: the sheet saves the report (`report.pending`, owned
 * by the screen) and the end card opens the mail sheet by itself. A saved
 * report puts a sun dot on the menu disc. The owner passes `report` only for
 * the live room itself, never for the waiting, error or safety surfaces.
 */
export function C2LiveRoom({ tutorName, voice, description, state, caption, turns, tutorSpeaking, partialTranscript,
  typing, startedWithSpeech = true, ready = true, modePending = false, active = true, embedded = false,
  transcriptVisible, onTranscriptVisibility, draft, onDraft, onSend, onModeChange, onMic, micOpen,
  onEnd, onReplayTutor, canSend = true, top, support, tools, footer, notice,
  title, pace = null, goals = [], helpKind = 'none', moreHelp, report, quietVoice = false, onQuietVoice,
  tapToSend = false, onTapToSend, heldTurn = null, onSendTurn, wrappingUp = false,
}: {
  tutorName: string;
  /** The learner's tutor, drawn as their portrait on the orb (F945); absent, the shared orb. */
  voice?: TutorVoiceKey;
  description: string; state: OrbState; caption: string;
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
  goals?: readonly { id: string; goalEn: string; achieved: boolean; goalShortEn?: string }[];
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
  // The room menu shares the sheet layer too: Help closes it, and it closes Help.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { if (helpOpen) setMenuOpen(false); }, [helpOpen]);
  const asked = lastTutorLine(turns);
  const ladder = helpLadder(helpKind);
  const helpAvailable = Boolean(support || tools || moreHelp);
  const quiet = onQuietVoice ? quietVoiceControl(typing, quietVoice) : null;
  const tap = onTapToSend ? tapToSendControl(typing, tapToSend) : null;
  const sendTurn = tap !== null && tap.checked && onSendTurn && ready ? sendButton(heldTurn, tutorSpeaking) : null;
  const note = roomNote(typing, startedWithSpeech, tutorName, quiet !== null && quiet.checked, { wrappingUp, tapToSend: tap !== null && tap.checked, heldTurn });
  const speakDisabled = !canResumeSpeaking(startedWithSpeech, ready, modePending);
  const menuRows = roomMenuRows({ typing, transcriptVisible, quietVoice: onQuietVoice ? quietVoice : undefined, tapToSend: onTapToSend ? tapToSend : undefined, reportable, reportPending: report?.pending });
  // A goal reached since the room first looked makes the cloud cheer once (freshGoals).
  const goalLook = useRef<ReadonlySet<string> | null>(null);
  const cheered = useRef(new Set<string>());
  const [cheer, setCheer] = useState(0);
  const [cheering, setCheering] = useState(false);
  const goalSignature = goals.map((goal) => `${goal.id}:${goal.achieved ? 1 : 0}`).join('|');
  useEffect(() => {
    if (goals.length === 0) return undefined;
    const next = freshGoals(goalLook.current, goals);
    goalLook.current = next.firstLook;
    const fresh = next.fresh.filter((id) => !cheered.current.has(id));
    if (fresh.length === 0) return undefined;
    for (const id of fresh) cheered.current.add(id);
    setCheer((value) => value + 1);
    setCheering(true);
    const done = setTimeout(() => { if (mounted.current) setCheering(false); }, CHEER_MS);
    return () => clearTimeout(done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalSignature]);
  const face = cloudExpression({ micOpen, tutorSpeaking, thinking: state === 'thinking', typing, goalJustReached: cheering, modePending });
  const { fontScale, height } = useWindowDimensions();
  const largeText = fontScale >= 1.35;
  // The smaller portrait while typing, at the largest text, and on a short phone.
  const compact = focused || keyboardOpen || typing || largeText || height < 700;
  const [stageHeight, setStageHeight] = useState(0);
  const fit = portraitFit(stageHeight, fontScale, compact);
  const sayChoice = () => {
    setHelpOpen(false);
    if (typing) { input.current?.focus(); return; }
    if (!micOpen && ready && !modePending) onMic();
  };
  const menuRow = (row: RoomMenuRow) => {
    if (row.kind === 'transcript') onTranscriptVisibility(!transcriptVisible);
    if (row.kind === 'quietVoice' && quiet && onQuietVoice) { const next = !quiet.checked; onQuietVoice(next); if (next) onTranscriptVisibility(true); }
    if (row.kind === 'tapToSend' && tap && onTapToSend) onTapToSend(!tap.checked);
    if (row.kind === 'report') { setMenuOpen(false); setHelpOpen(false); setReportOpen(value => !value); }
  };
  const sheetBottom = Math.max(insets.bottom, 10) + 20;
  return <KeyboardAvoidingView style={st.shell} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} enabled={Platform.OS !== 'web'}>
    <View style={[st.column, { paddingTop: embedded ? 12 : insets.top + 20 }]}>
      <View style={st.head} onTouchEnd={dismiss}>
        <LiveTopBar title={title ?? `${tutorName}, your tutor`} line={description} pace={pace}
          report={<Press haptic="none" accessibilityLabel={report?.pending ? `Room settings. ${REPORT_COPY.pendingControl}` : 'Room settings'} accessibilityState={{ expanded: menuOpen }} aria-expanded={menuOpen}
            onPress={() => { dismiss(); setHelpOpen(false); setReportOpen(false); setMenuOpen(value => !value); }} style={st.menu}>
            <Svg {...decorative} width={20} height={6} viewBox="0 0 20 6">
              <Circle cx={3} cy={3} r={2.2} fill={t.onBrand} /><Circle cx={10} cy={3} r={2.2} fill={t.onBrand} /><Circle cx={17} cy={3} r={2.2} fill={t.onBrand} />
            </Svg>
            {report?.pending ? <View {...decorative} style={st.reportPending} /> : null}
          </Press>}
          leave={<Press haptic="none" onPress={onEnd} accessibilityLabel="End session" style={st.leave}><CloseGlyph size={18} color={t.onBrand} /></Press>} />
        <GoalStamps goals={goals} />
      </View>
      {top ? <ScrollView style={st.top} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">{top}</ScrollView> : null}
      {/* The stage takes what is left and the portrait yields to fit it (portraitFit), so it
          never draws over the goal stamps, the owner's top slot or the sheet. */}
      <View style={st.stage} onTouchEnd={dismiss} onLayout={(event) => setStageHeight(event.nativeEvent.layout.height)}>
        {fit !== 'none' ? <PortraitStage state={state} voice={voice} name={tutorName} active={active} compact={fit === 'compact'} /> : null}
        {/* The state the orb used to say in words: spoken, not drawn. */}
        <Text accessibilityLiveRegion="polite" style={st.spoken}>{caption}</Text>
      </View>
      <View style={[st.sheet, largeText && st.sheetLarge, { paddingBottom: keyboardOpen ? 10 : Math.max(insets.bottom, 10) + 10 }]}>
        <NotebookSheet turns={turns} partialTranscript={partialTranscript} transcriptVisible={transcriptVisible} tutorName={tutorName} tutorSpeaking={tutorSpeaking}
          announceReply={typing} onReplayTutor={onReplayTutor} focusRevision={focusRevision} focusActive={focused || keyboardOpen} onDismissKeyboard={dismiss}>
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
              {note !== null && controlsVisible && <Text style={[bType.note, st.center, { color: t.muted }]}>{note}</Text>}
              {sendTurn && onSendTurn && controlsVisible ? <Press haptic="light" accessibilityLabel={sendTurn.accessibilityLabel} accessibilityState={{ disabled: sendTurn.disabled }}
                disabled={sendTurn.disabled} onPress={onSendTurn} style={[st.sendTurn, sendTurn.disabled && st.disabled]}>
                <Text style={[bType.bold17, { color: t.onMint }]}>{sendTurn.label}</Text>
              </Press> : null}
              {controlsVisible && <View style={st.controlRow}>
                {typing
                  ? <SideControl label="Speak" accessibilityLabel="Speak instead" icon={<BMic size={24} color={t.text} />}
                      disabled={speakDisabled} onPress={() => onModeChange(false)} />
                  : <SideControl label="Type" accessibilityLabel="Type instead" icon={<KeyboardMark size={24} color={t.text} />}
                      disabled={!ready || modePending} onPress={() => onModeChange(true)} />}
                {!typing && ready && face !== null ? <CloudMic expression={face} label={micOpen ? 'Listening' : 'Paused'} accessibilityLabel={micOpen ? 'Pause microphone' : 'Open microphone'}
                  cheer={cheer} disabled={modePending} onPress={onMic} /> : <View {...decorative} style={st.micSpace} />}
                {helpAvailable ? <SideControl label="Help" accessibilityLabel={helpOpen ? 'Close help' : 'Get help'} expanded={helpOpen}
                  icon={<BulbGlyph size={24} color={t.text} />} onPress={() => setHelpOpen(value => !value)} /> : <View {...decorative} style={st.sideSpace} />}
              </View>}
            </>}
          </View>
        </NotebookSheet>
      </View>
    </View>
    {/* One scrim behind whichever sheet is open, in front of the room. A tap closes
        that sheet, with the same "Close" the shared Sheet's scrim carries. */}
    {(menuOpen && !helpOpen && !reportOpen) || (reportOpen && reportable && report && !helpOpen) || (helpOpen && controlsVisible && helpAvailable && !footer)
      ? <View style={st.scrim}><Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill}
          onPress={() => { setHelpOpen(false); setMenuOpen(false); setReportOpen(false); }} /></View> : null}
    {menuOpen && !helpOpen && !reportOpen ? <View style={[st.sheetLayer, { paddingBottom: sheetBottom }]}>
      <RoomMenu rows={menuRows} onRow={menuRow} onClose={() => setMenuOpen(false)} />
    </View> : null}
    {reportOpen && reportable && report && !helpOpen ? <View style={[st.sheetLayer, { paddingBottom: sheetBottom }]}>
      <RoomReportSheet tutorName={tutorName} pending={report.pending} onPending={report.onPending} onClose={() => setReportOpen(false)} />
    </View> : null}
    {helpOpen && controlsVisible && helpAvailable && !footer ? <View style={[st.sheetLayer, { paddingBottom: sheetBottom }]}>
      {/* The toast peeks over the sheet's top edge, clear of its close button. Decorative. */}
      <View {...decorative} pointerEvents="none" style={st.peek}><Rise><Toast size={54} /></Rise></View>
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
    column: { flex: 1, minHeight: 0, width: '100%', maxWidth: 560, alignSelf: 'center' },
    head: { flexShrink: 0, paddingHorizontal: 16 },
    leave: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.violetDeep, alignItems: 'center', justifyContent: 'center' },
    // The room menu: the leave disc's size and colour, at the other end of the bar.
    menu: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.violetDeep, alignItems: 'center', justifyContent: 'center' },
    // A report saved for the end card: a 10pt sun dot on the menu disc.
    reportPending: { position: 'absolute', top: 2, right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: t.sun },
    center: { textAlign: 'center' },
    top: { flexGrow: 0, flexShrink: 0, maxHeight: '20%', paddingTop: 8, paddingHorizontal: 22 },
    stage: { flex: 1, minHeight: 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    // Spoken, not drawn: a 1pt clipped box in the ground's own colour, which a
    // screen reader still reads (opacity 0 would hide it from VoiceOver).
    spoken: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'hidden', color: t.brand },
    // The notebook and the dock on the theme's ground; its own height up to the cap.
    sheet: { flexShrink: 1, maxHeight: '64%', paddingTop: 22, overflow: 'hidden', backgroundColor: t.ground, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
    sheetLarge: { maxHeight: '75%' },
    notice: { paddingVertical: 6, paddingHorizontal: 20, textAlign: 'center', color: t.muted },
    support: { flexGrow: 0, flexShrink: 1 },
    // The theme's scrim at 0.4, as the shared Sheet draws it.
    scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: t.scrim, opacity: 0.4 },
    // 54 by 60 over the top edge, 96pt from the right: the close button sits in the last 66.
    peek: { position: 'absolute', top: -50, right: 96, width: 54, height: 60, overflow: 'hidden' },
    sheetLayer: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '80%', backgroundColor: t.ground, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
    footer: { gap: 10, paddingTop: 4, paddingHorizontal: 28 },
    footerPanel: { backgroundColor: t.card, borderRadius: 24, padding: 16, gap: 10 },
    composer: { backgroundColor: t.card, borderColor: t.field, borderWidth: 1.5, borderRadius: 22, paddingTop: 8, paddingBottom: 8 },
    composerFocus: { borderRadius: 22, borderColor: t.text, borderWidth: 2 },
    composerRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 10, gap: 8 },
    input: { color: t.text, flex: 1, minHeight: 36, maxHeight: 104, padding: 0, paddingVertical: 4, ...(Platform.OS === 'web' ? { outlineStyle: 'solid' as const, outlineWidth: 0 } : {}) },
    send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: t.brand },
    // Mint: Send is the end of the learner's own turn.
    sendTurn: { minHeight: 54, borderRadius: 27, backgroundColor: t.mint, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, alignSelf: 'center', minWidth: 160 },
    controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    micSpace: { width: CLOUD.slot }, sideSpace: { width: 72 },
    disabled: { opacity: 0.55 },
  });
}
