import {
  COACH_MARK_TEXT,
  coachMarksAfter,
  coachMarksAt,
  dismissCoachMark,
  type CoachMarkState,
} from './tutor/coachMarks.ts';
import { loadSeenCoachMarks, markCoachMarkSeen } from './tutor/store.ts';
import { loadMissionCompletions, recordMissionCompletion } from './missions/store.ts';
import { recordScenarioProgress } from './missions/progressStore.ts';
import { markPackContinued } from './conversationPacks/marks.ts';
import { recordRevisitStarted } from './practice/historyStore.ts';
import { recordGoalStepStarted } from './goals/store.ts';
import { replayNote, missionCompletionsFrom, type MissionReplay } from './missions/chooserView.ts';
import { trackProductEvent } from './analytics/track.ts';
import { MOMENT_ANSWER_MS, momentAnswer } from './practice/statusLine.ts';
import { OutOfMinutesView } from './live/OutOfMinutesView.tsx';
import { prepareWalk } from './walk/lifecycle.ts';
import { walkObserver } from './walk/observer.ts';
import { WalkRoom } from './walk/WalkRoom.tsx';
import { onUserScopeReset } from './storage/scope.ts';
import { currentCanDoQuote, readMissionTasks, sessionSettlementCopy, type CurrentMissionFinish, type MissionTasks } from '@luvani/core';
import { earnedFinish, firstEarnedFinish } from './recap/evidence.ts';
import type { MissionCompletion } from '@luvani/core';
/**
 * The free-conversation driver and surface.
 *
 * The convo sibling of LiveSessionScreen: connect on mount, publish the
 * microphone, render whatever the agent says to render. Everything pedagogical —
 * the scene, the coaching, when support appears, when the recap is due — happens
 * in the agent's brain; this screen is deliberately unable to disagree with it.
 *
 * What is deliberately absent compared to the lesson surface: no rung row and
 * no progress rail. A conversation is not a ladder, and a learner mid-sentence
 * does not need a score-like marker advancing above them.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, AppState } from 'react-native';
import { useIsFocused, usePreventRemove } from '@react-navigation/native';
import {
  conversationXp,
  missionStates,
  isEarned,
  getMission,
  phraseKeyOf,
  type ConvoPhrase,
  type DrillExercise,
  type IncomingTopic,
  type RecapPayload,
  type Rung,
} from '@luvani/core';
import { accent, paper, signal, space, type, radius, HAIRLINE, HIT } from './theme.ts';
import { IconAction,
  Card,
  Label,
  OutlineButton,
  GhostButton,
  EarGlyph,
  HelpGlyph,
  fitDisplay,
  ControlTile,
  Press,
  ChevronRight,
} from './components.tsx';
import { SupportBlock } from './SessionView.tsx';
import { ConfirmSheet, ScrollScreen } from './layout.tsx';
import { leaveConfirmCopy } from './live/leaveConfirm.ts';
import { RecapScreen, type RecapPracticePhrase } from './RecapScreen.tsx';
import { mergeExercises } from './drill/store.ts';
import { bankPractice, journalDrills, journalPractice } from './live/journal.ts';
import { saveRecapKeepsake } from './live/recapKeepsake.ts';
import { keepsakeLines } from './live/keepsake.ts';
import { MAX_RECOVERED_PHRASES, convoUsesFrom, type PracticeBatch } from './live/journalRules.ts';
import { recordActivity } from './progress/activity.ts';
import { settleSitting } from './game/settle.ts';
import type { GameDelta } from './game/delta.ts';
import { holdCelebrations } from './celebrate/queue.ts';
import { useReduceMotion } from './motion.ts';
import { useActiveClock } from './progress/useActiveClock.ts';
import { ACTIVE_CUTOFF_MS, learnerEngaged } from './progress/activeTime.ts';
import { useLiveSession } from './live/useLiveSession.ts';
import { CONNECTING_TICK_MS, connectingTick, connectingView } from './live/connectingView.ts';
import { LiveErrorView } from './live/LiveErrorView.tsx';
import { connectionLine } from './live/connectionLine.ts';
import { takeTypedDoor, typedDoorFor } from './live/typedDoor.ts';
import { useProfile } from './app/ProfileContext.tsx';
import { isUnderAgeStop } from './profile/age.ts';
import { prefersTyping } from './profile/typing.ts';
import { withAgeStop } from './profile/store.ts';
import type { OrbState } from './tutor/VoiceOrb.tsx';
import { C2LiveRoom } from './live/C2LiveRoom.tsx';
import { QUIET_DOOR, choosingView } from './tutor/choosingView.ts';
import { safetySurface, stoppedBySafety } from './tutor/safetyView.ts';
import { waitingView } from './tutor/waitingView.ts';
import { SafetyBanner, SafetyStopView } from './tutor/SafetyStopView.tsx';
import { tutorNameOf } from './tutor/tutorName.ts';
import { tutorVoiceOf } from './tutor/tutorVoice.ts';
import { OPEN_MIC_LABEL, sceneControls, simplerLabel, typedTurn } from './tutor/sceneControls.ts';
import { NO_WIN, dismissWin, winAfterTurn, winCard, type WinState } from './tutor/missionWin.ts';
import { MissionWin } from './tutor/MissionWin.tsx';
import { visibleMissionTasks } from './tutor/missionTasks.ts';
import { MissionTaskList } from './tutor/MissionTaskList.tsx';
import { useTaskTicks } from './tutor/useTaskTicks.ts';
import { OrbCue } from './tutor/OrbRipple.tsx';
import { sceneIllustration } from './art/flat/scenes.ts';
import { recapWait } from './tutor/recapWait.ts';
import { KeyboardGlyph, SpeakerSlowGlyph } from './glyphs.tsx';
import { RoomWait } from './live/RoomWait.tsx';
import { CONNECTING_TITLE, connectingBody } from './live/connectingView.ts';
import { waitingNote } from './tutor/waitingView.ts';
import { LiveRoomHeader } from './live/LiveRoomHeader.tsx';
import { RoomLevels } from './live/RoomLevels.tsx';
import { useThinkingLine } from './live/useThinkingLine.ts';

/**
 * Everything one conversation asks the practice stores to keep, in the shape
 * `bankPractice` takes.
 *
 * Both banks on this screen build it: the ordinary one when the practice
 * message lands, and the minimal one when the learner leaves before it does.
 * Two shapes here would be two sets of bugs, which is the same reason recovery
 * assembles this exact batch out of a journal found on disk.
 *
 * `batchId` is null on purpose. A name identifies a journal entry, and this
 * batch is banked straight from a live session rather than recovered from one;
 * `live/journal.ts` reads an unnamed batch as "clear the key", which is what
 * banking from the room has always done. What makes a repeat safe is content
 * identity inside every merge, not this field.
 *
 * `convoUses` comes from `convoUsesFrom` rather than a count worked out here.
 * The brain keeps the tally of correct unprompted uses and `repairProfile` is
 * the one place a learner model off the wire is made sense of, so a second
 * reading of that blob in a screen would be a second opinion about what
 * somebody knows.
 */
function practiceBatch(
  phrases: readonly ConvoPhrase[],
  parts: { topics: IncomingTopic[]; drills: DrillExercise[] | null; profile: unknown },
): PracticeBatch {
  return {
    batchId: null,
    phrases: [...phrases],
    topics: parts.topics,
    // Drills have a journalled path of their own and normally arrive after
    // this, so this is usually empty. Carrying them costs nothing and covers
    // the session where they came first: the bank folds by exercise id.
    drills: parts.drills ?? [],
    convoUses: convoUsesFrom(parts.profile),
  };
}

/** How long the finish door waits for the recap before taking the ordinary exit. */
const RECAP_WAIT_MS = 15_000;

/**
 * The browser wants a gesture before it will play the tutor.
 *
 * On both surfaces now, not only inside a scene: the choosing moment promises
 * a tutor who asks out loud, and a promise that fails in silence is worse than
 * one that never got made. Sentence case rather than the caps micro-label,
 * because it is a control and DESIGN.md puts buttons in sentence case.
 */
function ListenPlaque({ onPress, tutorName }: { onPress: () => void; tutorName: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Tap to listen to ${tutorName}`}
      style={({ pressed }) => [st.listen, pressed && { opacity: 0.85 }]}
    >
      <Card style={{ alignItems: 'center' }}>
        <Text style={[type.bodyStrong, { color: paper.ink }]}>Tap to listen</Text>
      </Card>
    </Pressable>
  );
}

/** No goals: a conversation that is not a mission, or a room with no view yet. */
const NO_TASKS: MissionTasks['items'] = [];

export function ConvoScreen({
  userId,
  snapshot,
  onRecap,
  onExit,
  onPractice,
  startInTextMode = false,
  walkMode = false,
  seedTopic,
  continuationPackId,
  missionId,
  replay,
  goalStep,
}: {
  userId: string;
  /** The stored learner model, passed through to the agent opaquely. */
  snapshot: unknown;
  /** The conversation ended: here is the end card and the updated model. */
  onRecap: (recap: RecapPayload, profileBlob: unknown) => void;
  onExit: () => void;
  /** Leave the finished room and open a short own-words drill for its kept phrase. */
  onPractice?: (phrase: RecapPracticePhrase) => void;
  /** "Can't speak right now": the same tutor, typed. */
  startInTextMode?: boolean;
  walkMode?: boolean;
  /**
   * What the learner asked to talk about again, from a topic card. It rides the
   * start body into the join token, the same channel mode and the snapshot use.
   * A session with no seed opens exactly as it always has.
   */
  seedTopic?: { fr: string; en: string };
  /**
   * The finished conversation this room is genuinely carrying on.
   *
   * It is marked only after a live view arrives. A tap on Tutor is intent; a
   * published room is the evidence that the thread was actually picked up.
   */
  continuationPackId?: string;
  /**
   * Which authored mission this is, when a mission card opened it.
   *
   * It rides the same pipe `seedTopic` rides, and the agent opens the scene
   * straight from the authored frame instead of asking a model to write one.
   * App-side it is also what the win card is drawn from, so a session with no
   * mission has nothing to finish and never sees one.
   */
  missionId?: string;
  /**
   * This mission has been finished before: the rung it finished on, and the
   * rung this attempt asks to open on.
   *
   * The navigator reads it, because the rung is signed into the join token and
   * a session cannot change where it opened after the fact. Null for a first
   * attempt and for every conversation that is not a mission, which is exactly
   * what this screen did before there was a replay at all.
   */
  replay?: MissionReplay | null;
  /**
   * This conversation was opened from one of the learner's goals (Stage 4):
   * the goal's normalised key and the task id. Recorded once the room is real,
   * under the server's session id, and never sent to the agent.
   */
  goalStep?: { goalKey: string; task: string };
}) {
  const { profile, update } = useProfile();
  // Who this learner chose. Every line on this screen that names the tutor
  // reads it from here, so a learner who picked Celine is never told that Luc
  // is thinking.
  const tutorName = tutorNameOf(profile);
  // The mode this session CONNECTS in, and the only thing a rebuild can change.
  // It starts as the learner asked for it and flips exactly once, in the one
  // case the quiet door cannot be taken in place: a session that failed before
  // it ever had a room. Whether the learner is typing RIGHT NOW is
  // `live.voiceless`, which belongs to the room and is read below.
  const [openedTyped, setOpenedTyped] = useState(startInTextMode);
  const [draft, setDraft] = useState('');
  const [transcriptVisible, setTranscriptVisible] = useState(true);
  const [modePending, setModePending] = useState(false);
  // The leave gate. `confirming` shows the sheet; `leaving` is raised on commit,
  // which drops the guard so the exit can run from an effect rather than inline.
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leaveCopy = leaveConfirmCopy('conversation');
  // Which text input holds the caret, for the ink focus border. Visual only.
  const [focusedInput, setFocusedInput] = useState<'topic' | 'reply' | null>(null);
  // The learner tapped Type instead during a voice scene. Local to the screen
  // and deliberately NOT the quiet door: this opens the box without asking the
  // session, so the microphone stays live and the scene survives.
  //
  // Seeded from the stored choice, which is what "Prefer typing" means: the box
  // is already open when the room is. Still not the quiet door, and the seed
  // does not change that — the tutor speaks, and the circle is one tap away.
  const [typingOpen, setTypingOpen] = useState(prefersTyping(profile));
  const live = useLiveSession(userId, 'convo-01', replay?.startRung, {
    noTypedRecovery: walkMode,
    mode: openedTyped ? 'convo-text' : 'convo',
    snapshot,
    seedTopic,
    continuationPackId,
    ...(missionId !== undefined ? { missionId } : {}),
    tutorVoice: tutorVoiceOf(profile),
  });

  // Connect on mount, and again only in the one case a session has to be built
  // from cold to be typed. The hook tears the room down on unmount.
  const [walkRefused, setWalkRefused] = useState(false);
  const walkClose = useRef<() => void>(() => {});
  useEffect(() => {
    if (!walkMode) { void live.start(); return; }
    const gate = prepareWalk(walkObserver(), {
      start: live.start,
      end: () => { void live.leave().finally(onExit); },
    });
    let current = true;
    walkClose.current = gate.close;
    const reset = onUserScopeReset(gate.close);
    const app = AppState.addEventListener('change', state => { if (state === 'active') gate.check(); });
    void gate.started.then(started => { if (current && !started) setWalkRefused(true); });
    return () => { current = false; app.remove(); reset(); gate.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedTyped, walkMode]);
  const walkMicAsked = useRef(false);
  useEffect(() => {
    if (!walkMode || walkMicAsked.current || live.status.phase !== 'live' || live.convo === null) return;
    walkMicAsked.current = true;
    void live.openMic().then(opened => { if (!opened) walkClose.current(); });
  }, [walkMode, live.status.phase, live.convo, live.openMic]);

  // Retire a remembered pack only once this route has become a real room. The
  // ref is raised before the async write so a second view cannot queue a second
  // mark while the first disk hop is still in flight.
  const continuationMarkedRef = useRef(false);
  useEffect(() => {
    if (continuationMarkedRef.current || continuationPackId === undefined || live.convo === null) return;
    continuationMarkedRef.current = true;
    void markPackContinued(continuationPackId, Date.now()).catch(() => {});
  }, [continuationPackId, live.convo]);

  // The same moment, recorded in the account's practice history: a tutor
  // revisit of this saved conversation started. Only a room that published a
  // real view counts, keyed on the server's own session id, so a failed join
  // records nothing and a re-render or a reconnect records nothing twice. It
  // says the revisit started, never that anything was used while speaking.
  const revisitRecordedRef = useRef<string | null>(null);
  useEffect(() => {
    if (continuationPackId === undefined || live.convo === null || live.sessionId === null) return;
    if (revisitRecordedRef.current === live.sessionId) return;
    revisitRecordedRef.current = live.sessionId;
    void recordRevisitStarted({ sessionId: live.sessionId, packId: continuationPackId, at: Date.now() });
  }, [continuationPackId, live.convo, live.sessionId]);

  // The same moment for a goal (Stage 4): this conversation was opened from a
  // goal card. Same guard as the revisit, so a failed join records nothing, a
  // reconnect records nothing twice, and a rebuilt session (whose view `start`
  // clears) records only once its own room is real. It says the step started,
  // never how it went; what came of it is read later, by pack id.
  const goalStepRecordedRef = useRef<string | null>(null);
  useEffect(() => {
    if (goalStep === undefined || live.convo === null || live.sessionId === null) return;
    if (goalStepRecordedRef.current === live.sessionId) return;
    goalStepRecordedRef.current = live.sessionId;
    void recordGoalStepStarted({ sessionId: live.sessionId, goalKey: goalStep.goalKey, task: goalStep.task, at: Date.now() });
  }, [goalStep, live.convo, live.sessionId]);

  /**
   * The learner is typing: they opened this way, or they took the quiet door
   * mid-scene and the room went quiet around them.
   *
   * One value read from the room rather than a second copy of it on the screen.
   * A closed microphone means two different things here, and `voiceless` is the
   * only field that tells them apart: nobody has tapped the circle yet, or
   * somebody has chosen not to speak.
   */
  const typing = openedTyped || live.voiceless;

  /**
   * After six seconds of real thinking the header says so in words (core loop
   * 3.4): never sooner, never a pretend progress, and gone with the answer.
   * Asked here, above every early return, because it is a hook.
   */
  const stillThinking = useThinkingLine(live.thinking);
  /**
   * Whether this room is the screen in front of the learner. The orb's meters
   * (live/RoomLevels) run only while it is, and the app is active.
   */
  const roomFocused = useIsFocused();

  /**
   * Take the quiet door, wherever the learner found it.
   *
   * This is F201. It used to be `setTextMode(true)`, which the connect effect
   * above read as a new session, so the app asked the token server for a second
   * grant while this learner's own lease was still standing and the door led
   * straight into a refusal. `switchToText` goes quiet in the room that is
   * already open: same scene, same meter, no grant. The rebuild is kept for the
   * one case it is still right for, which is a session that never connected.
   */
  const goQuiet = () => {
    if (takeTypedDoor(live) === 'needs-a-new-session') setOpenedTyped(true);
  };

  // How long this connect has been running, for the copy that grows with it.
  // The interval lives only while the connecting branch IS the whole screen and
  // is cleared the moment the room opens or the screen goes away, so nothing
  // ticks behind a conversation. `connectingTick` hands back the number already
  // held while the stage is unchanged, so React bails out of the render: a
  // twenty five second wait costs two renders, not twenty five.
  const [connectingMs, setConnectingMs] = useState(0);
  // Read off `phase` rather than spelled out twice: the stop surface has to be
  // returned above every status branch, and safetyView.test.ts proves that by
  // finding the first mention of the connecting phase in the file. A hook that
  // spells the branch's own condition out up here moves that mark and makes the
  // ordering test read a line that is not a branch.
  const phase = live.status.phase;
  const awaitingRoom = phase === 'connecting' || phase === 'idle';
  useEffect(() => {
    if (!awaitingRoom) return;
    // A fresh attempt gets a fresh clock. The conversation reconnects when the
    // learner takes the quiet door, and without this the second attempt opened
    // on the first one's oldest sentence.
    setConnectingMs(0);
    const from = Date.now();
    const tick = setInterval(() => setConnectingMs((prev) => connectingTick(prev, Date.now() - from)), CONNECTING_TICK_MS);
    return () => clearInterval(tick);
  }, [awaitingRoom]);

  // The tutor stopped this session, and a stopped session leaves nothing
  // behind. One flag, read by every effect below that would otherwise award,
  // hand on or write something down. See tutor/safetyView.ts for why it is one
  // flag and not a decision made five times. The render asks the surface
  // instead, because that is what narrows the union to the copy it draws, and
  // `stoppedBySafety` is derived from `safetySurface` so the two cannot
  // disagree about what happened.
  const safety = safetySurface(live.safety);
  const stopped = stoppedBySafety(live.safety);

  // The scene's goals, and the moment one of them ticks (tutor/taskTicks.ts):
  // the row pops and is announced, and on the last goal the orb ripples once
  // before the scene's card arrives. Nothing moves after a stop.
  const reducedMotion = useReduceMotion();
  const missionItems = live.convo === null ? NO_TASKS : visibleMissionTasks(live.convo, missionId);
  const ticks = useTaskTicks(missionItems, live.sessionId, { stopped, reduced: reducedMotion });

  // One stop out of the eight is also a fact about the account, and until now
  // it lasted exactly one session: a child said they were eleven, lost that
  // session, tapped start, and was in another scene seconds later. Written once,
  // from the frame, and read back by the navigator on the next launch. Nothing
  // here clears or reads the safety state itself; `isUnderAgeStop` is the one
  // reader of that decision and it lives in profile/age.ts.
  const ageStopWrittenRef = useRef(false);
  useEffect(() => {
    if (ageStopWrittenRef.current || !isUnderAgeStop(live.safety)) return;
    ageStopWrittenRef.current = true;
    update(withAgeStop(profile));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.safety]);

  const sendDraft = async () => {
    if (live.tutorSpeaking || live.thinking || live.reconnecting) return false;
    const turn = typedTurn(draft);
    if (turn === null) return false;
    markLearnerAction();
    const sent = await live.sendSay(turn.text);
    if (sent) setDraft(current => current === draft ? '' : current);
    return sent;
  };
  const changeInput = async (nextTyping: boolean) => {
    if (modePending) return;
    setModePending(true);
    try {
      if (nextTyping) { if (await live.pauseMic()) setTypingOpen(true); }
      else if (!openedTyped && await live.openMic()) setTypingOpen(false);
    } finally { setModePending(false); }
  };

  // Typing is presence. The hook throttles, so this can be handed every letter.
  const changeDraft = (text: string) => {
    setDraft(text);
    live.sendTyping();
  };

  // The recap renders here, not on a separate screen: the room must outlive
  // the end card, because the agent's background work — the enriched profile
  // and tonight's generated drills — arrives seconds AFTER the recap, and a
  // torn-down room would lose both. onRecap persists; it no longer navigates.
  const bankedRef = useRef(false);
  /**
   * Active learning time (Practice time). The evidence is the conversation's
   * own rhythm once the room is open: each learner turn the agent heard, each
   * typed send, and each boundary where the tutor starts or stops speaking,
   * because listening to the tutor is part of the work. The 45 second cutoff
   * leaves a silent, abandoned room out. The room merely being open, and the
   * connecting screen before it, count for nothing.
   *
   * The tutor's boundaries are not the learner's own, though. In voice mode
   * the agent re-arms a silence rescue every few seconds, so a learner who
   * walked away with the app foregrounded would keep earning through them. A
   * tutor boundary therefore counts only while the learner acted within the
   * cutoff (`learnerEngaged`); a learner action always counts.
   */
  const clock = useActiveClock('convo');
  const lastLearnerActionAtRef = useRef<number | null>(null);
  const markLearnerAction = useCallback(() => {
    lastLearnerActionAtRef.current = Date.now();
    clock.touch();
  }, [clock]);
  const roomOpen = live.convo !== null;
  const learnerTurns = live.turns.filter((t) => t.who === 'learner').length;
  useEffect(() => {
    if (roomOpen && learnerTurns > 0) markLearnerAction();
  }, [roomOpen, learnerTurns, markLearnerAction]);
  useEffect(() => {
    if (!roomOpen) return;
    const now = Date.now();
    if (learnerEngaged(lastLearnerActionAtRef.current, now, ACTIVE_CUTOFF_MS.convo)) clock.touch(now);
  }, [roomOpen, live.tutorSpeaking, clock]);
  /**
   * When the room actually opened, which is the first view off the wire rather
   * than the mount.
   *
   * A learner sits on the connecting screen while a token is minted and a room
   * is joined, and none of that is time they spent speaking French. Home's
   * speaking goal counts what this measures, so it starts when there is
   * something to speak to. It is device wall clock and includes the tutor's
   * thinking and any reconnect, because that is time the learner spent; it is
   * not the metered seconds and is never shown as those.
   */
  const openedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (roomOpen && openedAtRef.current === null) openedAtRef.current = Date.now();
  }, [roomOpen]);

  /**
   * What the finished conversation changed, read back from disk by the settle
   * (game/settle.ts), for the recap's progress strip. Null until it lands, and
   * null for good if it never does: the strip then draws nothing rather than a
   * number nobody stored.
   */
  const [convoDelta, setConvoDelta] = useState<GameDelta | null>(null);
  /**
   * F766: the celebration queue waits from before the conversation settles
   * until the recap's result page is up, so a streak or a level published by
   * the settle can never start under the recap. The recap holds the queue
   * itself for as long as it is mounted, so this hold only has to cover the
   * hand-over, and it goes the moment the result page says it is showing (or
   * this screen goes).
   */
  const settleHold = useRef<(() => void) | null>(null);
  const [recapShown, setRecapShown] = useState(false);
  const resultShown = useCallback(() => setRecapShown(true), []);
  useEffect(() => {
    if (!recapShown) return;
    settleHold.current?.();
    settleHold.current = null;
  }, [recapShown]);
  useEffect(() => () => {
    settleHold.current?.();
    settleHold.current = null;
  }, []);
  useEffect(() => {
    // A stopped session hands nothing on and earns nothing. The recap is where
    // both used to happen on the same tick as the emergency number arriving.
    if (!live.recap || stopped) return;
    onRecap(live.recap.recap, live.recap.profile);
    // The recap arrives twice — once as itself, then again enriched with the
    // learner model — so this is banked exactly once per conversation.
    if (!bankedRef.current) {
      bankedRef.current = true;
      const { phrases, stats } = live.recap.recap;
      const openedAt = openedAtRef.current;
      // One clock read for both the instant and the length. The room's opening
      // is the start, not the mount: the connecting screen is not time anybody
      // spent speaking French.
      const endedAt = Date.now();
      const xp = conversationXp({ phraseCount: phrases.length, unassistedRate: stats.unassistedRate });
      const activeMs = clock.read();
      // A conversation that ran to its recap is a finished sitting, and it
      // settles here, inside the stop guard: a safety stop settles nothing (F137, F744).
      // The queue is held first (F766), and the recap draws what the settle read back.
      if (!recapShown) settleHold.current ??= holdCelebrations();
      void settleSitting({
        source: 'convo',
        at: endedAt,
        xpEarned: xp,
        activeMs,
        write: () => recordActivity('convo', xp, endedAt, openedAt === null ? { activeMs: activeMs, finished: true } : { durationMs: endedAt - openedAt, activeMs: activeMs, finished: true }),
      }).then(setConvoDelta);
    }
    // `clock` is the same controller for the screen's whole life, so it stays
    // out of the list the F386 test pins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.recap, onRecap, stopped]);

  // Tonight's generated practice, written down before it is merged.
  //
  // This arrives seconds AFTER the recap, out of the agent's background work,
  // and until now it went from the wire into memory and then into the drill
  // bank with nothing on disk in between. An app closed in that gap lost the
  // whole set, and nothing ever asked the agent for it again. So it goes into
  // the session journal first and the merge runs either way — the journal
  // cannot reject, and if it somehow did, the in-memory path is still the one
  // the learner is about to use. Recovery banks whatever is left on disk at the
  // next launch, through the same once-per-launch pass that rescues an unbanked
  // recap. Merging twice is safe: mergeExerciseBank unions by exercise id.
  useEffect(() => {
    const drills = live.drills;
    if (!drills || stopped) return;
    const merge = () => void mergeExercises(drills);
    void journalDrills(drills).then(merge, merge);
  }, [live.drills, stopped]);

  // ---- The win, the coach marks and the moment.
  //
  // All three are transitions rather than values, and none of them can be read
  // off a single render, which is why the rules are in tutor/missionWin.ts and
  // tutor/coachMarks.ts and only the wiring is here.

  // The learner's finish history before this session, or null while it is
  // unknown: not read yet, or the read failed. Unknown is said as unknown, so
  // the postcard never claims an earlier finish nobody could see (F777).
  const priorCompletions = useRef<readonly MissionCompletion[] | null>(null);
  // True for a first earn, false for an earn again, null when the history was unknown at the flip.
  const [firstEarned, setFirstEarned] = useState<boolean | null>(false);
  // This session's finish was on the learner's own (core's independence rule
  // on the rung the winning view carried), first time or not: the recap stamps
  // its postcard for every one of those and never for a finish with help.
  const [independentFinish, setIndependentFinish] = useState(false);
  useEffect(() => {
    let cancelled = false;
    // Another account's history never stands in for this one's while it loads.
    priorCompletions.current = null;
    void loadMissionCompletions({ strict: true })
      .then(rows => { if (!cancelled) priorCompletions.current = missionCompletionsFrom(rows); })
      .catch(() => { if (!cancelled) priorCompletions.current = null; });
    return () => { cancelled = true; };
  }, [userId]);
  const [win, setWin] = useState<WinState>(NO_WIN);
  const winSession = useRef<string | null>(null);
  const [currentFinish, setCurrentFinish] = useState<CurrentMissionFinish | null>(null);
  /**
   * The learner pressed the door that promises a recap, and is waiting for it.
   *
   * It is a state rather than a straight `leaveNow()` because `leave()` publishes
   * the wrap-up tag and then disconnects, and the recap is published back over
   * that same room. Tearing it down is closing the door the answer comes
   * through, so the button promised something it then made impossible.
   */
  const [finishing, setFinishing] = useState(false);

  const recapBailLeave = useRef<() => void>(() => {});
  useLayoutEffect(() => { recapBailLeave.current = leaveNow; });

  // A recap that never comes must not leave them holding a dead screen. The
  // ceiling is generous because the agent is assembling a recap and folding a
  // profile at this point, and short of it the fallback is the ordinary exit,
  // which still banks what they said.
  useEffect(() => {
    if (!finishing || live.recap) return;
    const bail = setTimeout(() => recapBailLeave.current(), RECAP_WAIT_MS);
    return () => clearTimeout(bail);
  }, [finishing, live.recap]);
  useEffect(() => {
    // Nothing is completed by a session that was stopped, and a mission written
    // down here is a congratulation the learner meets later on another screen.
    if (stopped) return;
    const changedSession = winSession.current !== live.sessionId;
    if (changedSession) { winSession.current = live.sessionId; setCurrentFinish(null); setIndependentFinish(false); }
    const currentWin = changedSession ? NO_WIN : win;
    const step = winAfterTurn(currentWin, live.convo, missionId);
    // Written at the flip and nowhere else, with the rung the winning view
    // carried. Independence is decided by code from that rung, so a record
    // that guessed it later would be a fabricated claim about how much help
    // this learner needed.
    if (step.record) {
      const currentTasks = readMissionTasks(live.convo?.missionTasks, step.record.id);
      setCurrentFinish(live.sessionId && currentTasks?.items.every(item => item.achieved) ? { sessionId: live.sessionId, missionId: step.record.id, rung: step.record.rung } : null);
      setFirstEarned(firstEarnedFinish(priorCompletions.current, step.record));
      setIndependentFinish(earnedFinish(step.record));
      void recordMissionCompletion(step.record.id, step.record.rung);
      void trackProductEvent({
        name: 'mission_completed',
        properties: { missionId: step.record.id, rung: step.record.rung },
      });
    }
    if (step.state !== win) setWin(step.state);
  }, [live.convo, live.sessionId, win, missionId, stopped]);

  const [marks, setMarks] = useState<CoachMarkState>(() => coachMarksAt([]));
  useEffect(() => {
    let alive = true;
    void loadSeenCoachMarks().then((seen) => {
      // Guarded rather than assigned: the read is a disk hop and a mark could
      // in principle have appeared while it was in flight. Overwriting the
      // state then would show that mark twice.
      if (alive) setMarks((state) => (state.usedItsTurn ? state : coachMarksAt(seen)));
    });
    return () => {
      alive = false;
    };
  }, []);

  const sceneOpen = live.convo !== null;
  const learnerSpoke = live.turns.some((t) => t.who === 'learner');
  const frenchLanded = (live.convo?.sceneReply.fr ?? '').trim().length > 0;
  useEffect(() => {
    setMarks((state) => coachMarksAfter(state, { sceneOpen, learnerSpoke, frenchLanded, voiceControlsShown: !typing }));
  }, [sceneOpen, learnerSpoke, frenchLanded, typing]);

  useEffect(() => {
    // Remembered the moment it appears, not when it is dismissed: a learner who
    // read a note and then killed the app has read it.
    if (marks.showing !== null) void markCoachMarkSeen(marks.showing);
  }, [marks.showing]);

  const closeMark = () => setMarks(dismissCoachMark);

  // ---- The replay note.
  //
  // The rung this session actually OPENED on, kept from the first published
  // view and never overwritten. The opening publish is the only honest source:
  // the app asks the token server for a rung, and the engine is free to clamp
  // it or refuse it and open where it always opens (see F222), so a note
  // pitched on the value we sent would be the app quoting itself. It is also
  // why this keeps the FIRST rung rather than tracking the live one, which
  // drops the moment the scene rescues anybody.
  const [openedRung, setOpenedRung] = useState<Rung | null>(null);
  const publishedRung = live.convo?.rung ?? null;
  useEffect(() => {
    if (publishedRung === null) return;
    setOpenedRung((prev) => prev ?? publishedRung);
  }, [publishedRung]);
  // Whether that is worth saying is missions/chooserView.ts's decision, not a
  // condition spelled out in a render. It is null far more often than not.
  const replayLine = replayNote({ replay: replay ?? null, openedRung, spokenThisSession: learnerSpoke });

  // The tap counter for "Give me a moment". A counter rather than a timestamp
  // because nothing on this screen may read a clock to decide something, and a
  // learner tapping twice is asking twice.
  const [momentTaps, setMomentTaps] = useState(0);
  useEffect(() => {
    if (momentTaps === 0) return;
    const timer = setTimeout(() => setMomentTaps(0), MOMENT_ANSWER_MS);
    return () => clearTimeout(timer);
  }, [momentTaps]);
  // The tutor said something: the wait is over and so is the line about it.
  useEffect(() => {
    setMomentTaps(0);
  }, [live.convo]);

  const askForAMoment = () => {
    live.sendMoment();
    setMomentTaps((n) => n + 1);
    closeMark();
  };

  // The session's practice leave-behind, banked exactly once: topic cards in
  // the topic store, the curated phrases into the review deck, staggered so
  // tomorrow is not a wall. RecapScreen shows all twelve phrases; only these
  // few become cards — that is curation doing its job.
  //
  // The ref starts the bank and claims nothing else. It used to stand in for
  // durability, which is how a phone with a full disk resolved every write,
  // deleted the journal and left the conversation stored nowhere at all. What
  // may clear the journal is `bankPractice`, and it decides on three
  // acknowledgements rather than on three promises resolving.
  const practiceBankedRef = useRef(false);
  useEffect(() => {
    // The founder was asked and chose this, cost included: a stopped session
    // banks nothing, not even the ordinary practice from before the disclosure.
    // Nothing is written down, which is what the privacy doc promises.
    if (!live.practice || practiceBankedRef.current || stopped) return;
    practiceBankedRef.current = true;
    // Journal first, then bank what the journal named. The batch that comes
    // back carries the id of the entry now on disk, and handing THAT to the
    // bank is what stops the clear at the end of a successful bank deleting a
    // journal this batch did not write. `journalPractice` never rejects.
    void journalPractice(practiceBatch(live.practice.flatMap((t) => t.phrases), {
      topics: live.practice.map((t) => ({
        title: { fr: t.titleFr, en: t.titleEn },
        phraseKeys: t.phrases.map((p) => phraseKeyOf(p.fr)),
      })),
      drills: live.drills,
      profile: live.recap?.profile,
    })).then(bankPractice);
  }, [live.practice, live.drills, live.recap, stopped]);

  const leaveTo = (afterLeave: () => void) => {
    // F402 — where they got to, so the tutor's resume card can offer it back
    // with a minutes line instead of a bare title.
    //
    // Four conditions, and each one is a thing that must NOT write. A free
    // conversation has no mission to come back to. A finished mission is not
    // half done, and `recordMissionCompletion` clears the record anyway, so
    // writing one here would be a race with the clear. A session the tutor
    // stopped leaves nothing behind at all, which is the same rule the recap,
    // the practice bank and the completion all follow above. And a room that
    // never opened has no elapsed time to report.
    //
    // The beat comes off the wire rather than being counted here: `position` is
    // the beat the learner is ON, so the number DONE is one less. The pace is
    // extrapolated in `missions/resume.ts`, which is also where it decides that
    // zero beats done means no estimate rather than a guess.
    const openedAt = openedAtRef.current;
    if (missionId !== undefined && live.convo !== null && !live.convo.missionDone && !stopped && openedAt !== null) {
      void recordScenarioProgress({
        missionId,
        at: Date.now(),
        elapsedMs: Date.now() - openedAt,
        beatsDone: Math.max(0, live.convo.beat.position - 1),
      });
    }
    // Leaving before the practice message landed: bank a minimal version from
    // the recap (its first few phrases under the session's own topic) so an
    // early exit never loses what the learner said. Through the same outbox as
    // the ordinary path, because an early exit that clears the journal on a
    // promise resolving is the identical bug one beat earlier. The only
    // remaining loss window is killing the app, same as the drills.
    if (!stopped && !practiceBankedRef.current && live.recap) {
      // The same cap the crash path uses, named rather than typed twice: a
      // learner who leaves early and a learner whose phone dies wake up to the
      // same few cards, and two literals is how those two drift apart.
      const phrases = live.recap.recap.phrases.slice(0, MAX_RECOVERED_PHRASES);
      const home = live.recap.recap.topics[0];
      if (phrases.length > 0 && home !== undefined) {
        practiceBankedRef.current = true;
        void journalPractice(practiceBatch(phrases, {
          topics: [{ title: home, phraseKeys: phrases.map((p) => phraseKeyOf(p.fr)) }],
          drills: live.drills,
          profile: live.recap.profile,
        })).then(bankPractice);
      }
    }
    void live.leave().finally(afterLeave);
  };

  const leaveNow = () => leaveTo(onExit);

  // A recap drill replaces this route only after the metered room is closed.
  // Navigating first leaves the live conversation underneath the drill, so
  // Back returns to a stale recap and the room can outlive its screen.
  const practiseAfterRecap = (phrase: RecapPracticePhrase) => {
    if (onPractice === undefined) return;
    leaveTo(() => onPractice(phrase));
  };

  // In the metered room only: the choosing moment and the open scene, the two
  // places minutes are being spent. Not the connecting, waiting, error, recap or
  // finishing screens, each of which owns its own door and calls leaveNow itself
  // — a guard active there would intercept that call's own pop.
  const inRoom =
    safety.kind !== 'stop' &&
    !live.recap &&
    !finishing &&
    phase !== 'connecting' &&
    phase !== 'idle' &&
    live.status.phase !== 'out-of-minutes' &&
    live.status.phase !== 'error' &&
    (live.convo != null || live.opening != null);

  // Android's hardware back and iOS's edge swipe both route through here, so
  // neither can pop the room without meeting the same sheet the header opens.
  usePreventRemove(inRoom && !leaving, () => setConfirming(true));

  // The exit runs from the effect, not from the sheet's confirm: with the guard
  // still up an inline pop would be prevented. Raising `leaving` lowers it first.
  useEffect(() => {
    if (leaving) leaveNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  // First, and before the recap and every status screen. A stop is normally
  // followed by the agent leaving the room, which the hook reads as a dropped
  // connection, so anything ordered above this would take the emergency number
  // off the screen a moment after it arrived.
  if (safety.kind === 'stop') {
    return <SafetyStopView surface={safety} onClose={leaveNow} />;
  }

  if (live.recap) {
    return (
      <RecapScreen
        recap={live.recap.recap}
        settlementMessage={live.settlement ? sessionSettlementCopy(live.settlement) : null}
        completedMissionId={win.seen ? missionId : undefined}
        firstEarned={firstEarned}
        independentFinish={win.seen && independentFinish}
        delta={convoDelta}
        momentKey={live.sessionId}
        onResultShown={resultShown}
        evidenceQuote={currentCanDoQuote(live.canDoEvidence, currentFinish, live.turns)}
        lines={keepsakeLines(live.turns)}
        onDone={leaveNow}
        onPractice={onPractice === undefined ? undefined : practiseAfterRecap}
        onSave={saveRecapKeepsake}
        conversationText={{ ownerId: userId, conversation: live.sessionId && live.conversationText ? { sessionId: live.sessionId, title: live.recap.recap.topics[0]?.en ?? 'Your conversation', lines: live.conversationText } : null }}
      />
    );
  }

  if (walkRefused) return <RoomWait title="Walk mode is unavailable" body="The audio interruption check could not start. Return to Tutor for an ordinary scene." stage="No Walk session started" leaveLabel="Back to Tutor" onLeave={leaveNow} />;

  if (live.status.phase === 'connecting' || live.status.phase === 'idle') {
    // The longest silence in the product, and it used to be one unchanging
    // sentence with no door, returned above every control this screen owns.
    // The words and the way out are both the view model's now. Leaving here is
    // safe: `leave()` takes the session number with it, so an attempt still
    // waiting on a token stands down rather than opening a room for a screen
    // that has gone. See live/connectingView.ts and live/startOwnership.ts.
    const connecting = connectingView(connectingMs);
    return <RoomWait state="connecting" title={CONNECTING_TITLE} body={connectingBody(tutorName)} stage={connecting.headline} leaveLabel={connecting.leaveLabel} onLeave={leaveNow} />;
  }

  if (live.status.phase === 'out-of-minutes') {
    return <OutOfMinutesView label={live.status.label} message={live.status.message} userId={userId} onExit={onExit} />;
  }

  if (live.status.phase === 'error') {
    // A microphone problem is a situation, not a dead end: the same tutor, the
    // same scene, typed instead of spoken. Which failures those are is the
    // taxonomy's business, rather than a regex over the rendered sentence, and
    // whether the door is offered at all is `typedDoorFor` rather than a
    // condition written out twice on two screens.
    //
    // Back leaves the room rather than walking away from it. A blocking failure
    // with a typed door deliberately keeps the room open so that door has
    // somewhere to go, so this is the one exit that has to close it.
    return (
      <LiveErrorView
        failure={live.status.failure}
        turns={live.turns}
        tutorName={tutorName}
        transcriptVisible={transcriptVisible}
        onTranscriptVisibility={setTranscriptVisible}
        message={walkMode ? "Walk mode cannot continue. Return to Tutor to try another scene or start a typed conversation." : live.status.message}
        diagnostics={live.diagnostics}
        settlementMessage={live.settlement ? sessionSettlementCopy(live.settlement) : null}
        restartAsText={live.settlement !== null}
        retryBlocked={live.settlement?.kind === 'pending' || live.settlement?.kind === 'reconciliation'}
        onBack={leaveNow}
        onType={!walkMode && typedDoorFor(live.status.failure, { typing }) ? goQuiet : null}
      />
    );
  }

  if (walkMode) return <WalkRoom tutor={tutorName} speaking={live.tutorSpeaking} micOpen={live.micOpen} finishing={finishing}
    safety={safety.kind === 'redirect' ? <SafetyBanner surface={safety} onDismiss={live.dismissSafety} /> : null}
    onExit={leaveNow} onMic={live.openMic} onHear={() => live.sendHear('scene')} onSlower={live.sendSlower}
    onFinish={() => { setFinishing(true); live.requestRecap(); }} />;

  const view = live.convo;

  // The opening moment: the tutor has asked, out loud and in English, what to
  // talk about. No menu — the circle listens, and whatever the learner says
  // (or types) becomes the scene. The first scene view replaces all of this.
  if (!view && live.opening) {
    const choosing = choosingView({
      textMode: typing,
      micOpen: live.micOpen,
      thinking: live.thinking,
      tutorSpeaking: live.tutorSpeaking,
      turns: live.turns,
      tutorName,
      typingOpen,
    });
    const line = connectionLine({ reconnecting: live.reconnecting, notice: live.notice });
    return <RoomLevels micTrack={live.audioTracks.mic} tutorTrack={live.audioTracks.tutor} micOpen={live.micOpen} tutorSpeaking={live.tutorSpeaking} focused={roomFocused}>
      <View style={{ flex: 1, minHeight: 0 }}>
        <C2LiveRoom tutorName={tutorName} description="Your French conversation" state={choosing.orb}
          caption={line.text ?? (live.thinking ? 'Thinking…' : live.tutorSpeaking ? `${tutorName} is speaking` : typing || typingOpen ? 'Typing, microphone paused' : live.micOpen ? 'Listening' : 'Ready when you are')}
          turns={live.turns} tutorSpeaking={live.tutorSpeaking} partialTranscript={live.partialTranscript}
          typing={typing || typingOpen} startedWithSpeech={!openedTyped} ready={!live.reconnecting && !live.waitingForTutor}
          modePending={modePending} active={roomFocused} transcriptVisible={transcriptVisible} onTranscriptVisibility={setTranscriptVisible}
          draft={draft} onDraft={changeDraft} onSend={sendDraft} canSend={!live.tutorSpeaking && !live.thinking}
          onModeChange={next => void changeInput(next)} onMic={() => void (live.micOpen ? live.pauseMic() : live.openMic())} micOpen={live.micOpen}
          onEnd={() => setConfirming(true)} notice={choosing.helper}
          top={<>{live.audioBlocked ? <ListenPlaque onPress={live.resumeAudio} tutorName={tutorName} /> : null}
            {safety.kind === 'redirect' ? <SafetyBanner surface={safety} onDismiss={live.dismissSafety} /> : null}</>}
        />
      <ConfirmSheet visible={confirming} title={leaveCopy.title} body={leaveCopy.body}
        confirmLabel={leaveCopy.leave} cancelLabel={leaveCopy.stay}
        onConfirm={() => { setConfirming(false); setLeaving(true); }} onCancel={() => setConfirming(false)} />
      </View>
    </RoomLevels>;
  }

  if (!view) {
    // An open room and a silent tutor. The hook's watchdog ends this state one
    // way or the other; until it does there are words and a door, which is
    // exactly what a down agent used to look like without either.
    //
    // The banner rides in the view model rather than being remembered here.
    // This is an early return, so everything below it — including the scene's
    // own banner — never runs, and a redirect published during startScene used
    // to vanish. See tutor/waitingView.ts.
    const waiting = waitingView({ waitingForTutor: live.waitingForTutor, safety, tutorName });
    return <RoomWait title={waiting.headline} body={waitingNote(tutorName)} leaveLabel={waiting.leaveLabel} onLeave={leaveNow}
      banner={waiting.banner ? <SafetyBanner surface={waiting.banner} onDismiss={live.dismissSafety} /> : undefined} />;
  }

  // Finish promised a recap. Until it lands, this is what the promise looks
  // like: the scene steps aside rather than sitting there inviting another
  // sentence out of somebody who has just ended the conversation. The fifteen
  // second bail above is the floor under this, and the door is the same exit.
  // See tutor/recapWait.ts.
  const finishWait = recapWait({ finishing, recapArrived: live.recap !== null });
  if (finishWait) {
    return <RoomWait title={finishWait.headline} body={finishWait.note}
      leaveLabel={finishWait.leaveLabel} onLeave={leaveNow} />;
  }

  const listening = !live.tutorSpeaking;
  const controls = sceneControls({
    supportView: view.supportView,
    textMode: typing,
    listening,
    typingOpen,
    micOpen: live.micOpen,
  });
  // The scene's card waits while the orb ripples for the last goal, and only
  // then (tutor/useTaskTicks.ts); with movement reduced it arrives at once.
  const card = win.showing && !ticks.holdingCard ? winCard(missionId) : null;
  const wonMission = missionId ? getMission(missionId) : undefined;
  const line = connectionLine({ reconnecting: live.reconnecting, notice: live.notice });
  // One line at a time in the header: a dropped connection or a notice first,
  // and only when the slot is otherwise empty, the long-wait line.
  const headerLine = line.text ?? stillThinking;
  // The orb says one thing at a time, and thinking outranks everything: the
  // learner has just spoken and nothing has come back yet.
  const orbState: OrbState = live.thinking
    ? 'thinking'
    : live.tutorSpeaking
      ? 'speaking'
      : typing
        ? 'idle'
        : // A closed microphone is not listening, and drawing it that way is the
          // half of F274 that made the other half invisible: the learner had no
          // reason to look for a control, because the orb said it was already
          // hearing them. `ready` is the same state the chooser's circle wears.
          controls.showOpenMic
          ? 'ready'
          : 'listening';

  return <RoomLevels micTrack={live.audioTracks.mic} tutorTrack={live.audioTracks.tutor} micOpen={live.micOpen} tutorSpeaking={live.tutorSpeaking} focused={roomFocused}>
    <OrbCue value={ticks.cue}>
    <View style={{ flex: 1, minHeight: 0 }}>
      <C2LiveRoom tutorName={tutorName} description={missionId ? getMission(missionId)?.titleEn ?? 'Guided conversation' : seedTopic?.en ?? 'Your French conversation'}
        state={live.reconnecting ? 'connecting' : orbState}
        caption={headerLine ?? (live.thinking ? 'Thinking…' : live.tutorSpeaking ? `${tutorName} is speaking` : typing || typingOpen ? 'Typing, microphone paused' : live.micOpen ? 'Listening' : 'Microphone paused')}
        turns={live.turns} tutorSpeaking={live.tutorSpeaking} partialTranscript={live.partialTranscript}
        typing={typing || typingOpen} startedWithSpeech={!openedTyped} ready={!live.reconnecting && !finishing}
        modePending={modePending} active={roomFocused} transcriptVisible={transcriptVisible} onTranscriptVisibility={setTranscriptVisible}
        draft={draft} onDraft={changeDraft} onSend={sendDraft} canSend={listening && !live.thinking}
        onModeChange={next => void changeInput(next)} onMic={() => void (live.micOpen ? live.pauseMic() : live.openMic())} micOpen={live.micOpen}
        onEnd={() => setConfirming(true)} onReplayTutor={listening && !typing ? () => live.sendHear('scene') : undefined}
        top={<>{live.audioBlocked ? <ListenPlaque onPress={live.resumeAudio} tutorName={tutorName} /> : null}
          <MissionTaskList items={missionItems} />
          {replayLine ? <Text accessibilityLiveRegion="polite" style={type.small}>{replayLine}</Text> : null}
          {safety.kind === 'redirect' ? <SafetyBanner surface={safety} onDismiss={live.dismissSafety} /> : null}</>}
        support={view.supportView.kind !== 'none' ? <SupportBlock support={view.supportView} onHearLine={controls.showHearIt ? () => live.sendHear() : undefined} /> : undefined}
        notice={momentTaps > 0 ? momentAnswer(tutorName) : view.coachLine}
        tools={<>
          {marks.showing ? <Press onPress={closeMark} haptic="none" accessibilityLabel={`${COACH_MARK_TEXT[marks.showing]} Tap to close.`} style={st.mark}><Text style={[type.small, { color: paper.onInk }]}>{COACH_MARK_TEXT[marks.showing]}</Text></Press> : null}
          <IconAction layout="inline" icon="hint" label="Help me out" disabled={!listening} onPress={() => { closeMark(); live.sendHelp(); }} />
          {!typing && <IconAction layout="inline" icon="chat" label="Simpler" accessibilityLabel={simplerLabel(tutorName)} disabled={!listening} onPress={() => { closeMark(); live.sendSlower(); }} />}
          <IconAction layout="inline" icon="moment" label="Give me a moment" onPress={askForAMoment} />
          {!typing && <IconAction layout="inline" icon="translate" label="In English" disabled={!listening} onPress={() => { closeMark(); live.sendEnglish(); }} />}
        </>}
        footer={card ? <><ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled"><MissionWin card={card} art={wonMission ? sceneIllustration(wonMission.id) : null}
          momentKey={`${live.sessionId ?? 'room'}:${missionId ?? 'scene'}`} onKeep={() => setWin(dismissWin)}
          onFinish={() => { setWin(dismissWin); setFinishing(true); live.requestRecap(); }} /></ScrollView>
          <IconAction icon="close" label="End session" onPress={() => setConfirming(true)} /></> : undefined}
      />
      <ConfirmSheet visible={confirming} title={leaveCopy.title} body={leaveCopy.body}
        confirmLabel={leaveCopy.leave} cancelLabel={leaveCopy.stay}
        onConfirm={() => { setConfirming(false); setLeaving(true); }} onCancel={() => setConfirming(false)} />
    </View>
    </OrbCue>
  </RoomLevels>;
}

const st = StyleSheet.create({
  orbBlock: { alignItems: 'center', paddingVertical: space(1) },
  support: { flexGrow: 0, flexShrink: 1, maxHeight: '35%', paddingBottom: space(2) },
  shell: { flex: 1, backgroundColor: paper.ground },
  root: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', backgroundColor: paper.ground, paddingHorizontal: space(5) },
  center: { flex: 1, backgroundColor: paper.ground, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(8) },
  listen: { minHeight: HIT, paddingHorizontal: space(5), paddingTop: space(3) },
  terminalAction: { marginTop: space(6), alignSelf: 'stretch' },
  // The centring root shrink-wraps its children, so the card is told to take
  // the width: a store offer sized to its longest word is not an offer.
  outOfMinutes: { alignSelf: 'stretch' },
  // The waiting screen centres its children, so the banner has to be told to
  // take the width: a safety sentence shrink-wrapped to its longest word is
  // unreadable, and this one is the whole reason the branch draws anything.
  waitingBanner: { alignSelf: 'stretch', marginBottom: space(3) },
  header: { paddingBottom: space(3) },
  // Nothing but the question and the circle yet: they sit in the middle of the
  // screen, exactly as they always have.
  chooseHeadGrow: { flex: 1 },
  chooseScroll: { flexGrow: 1, alignItems: 'center', paddingVertical: space(5) },
  // Once the thread opens it takes the room, and the head above it gives way
  // rather than pushing anything off the bottom.
  chooseHeadShrink: { flexGrow: 0, flexShrink: 1 },
  // Plain paper since the notebook redesign: the question and the circle sit on
  // the page, with no feature panel and no ink outline around them.
  chooseTop: { alignItems: 'center', padding: space(4), alignSelf: 'stretch' },
  chooseOrb: { alignItems: 'center', marginTop: space(5), marginBottom: space(5) },
  chooseOrbTight: { alignItems: 'center', marginTop: space(2), marginBottom: space(5) },
  // The circle is well past the touch floor already; the floor is here so it
  // stays past it if the circle ever shrinks.
  orbTap: { minWidth: HIT, minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
  quietDoor: { alignItems: 'center', paddingTop: space(2) },
  controls: { alignItems: 'center', paddingTop: space(1) },
  typeRow: { flexDirection: 'row', alignSelf: 'stretch', gap: space(2), alignItems: 'center' },
  typeInput: {
    flex: 1,
    minHeight: HIT + 6,
    backgroundColor: paper.card,
    borderWidth: 1.5,
    borderColor: paper.line,
    borderRadius: radius.input,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    ...type.body,
    color: paper.ink,
  },
  typeInputFocused: { borderColor: paper.ink },
  typeSend: {
    minHeight: HIT,
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.ink,
    borderRadius: radius.pill,
    minWidth: HIT,
  },
  helpRow: {
    marginTop: space(3),
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space(1),
  },
  // A note, not a dialogue: no border, no shadow, nothing to answer. The touch
  // floor is here because the whole strip is what dismisses it.
  mark: {
    minHeight: HIT,
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: space(4),
    paddingVertical: space(2),
    marginBottom: space(2),
    backgroundColor: paper.ink,
    borderRadius: radius.chip,
  },
  // Off, and it looks it. `components.tsx` argues this at length for the shared
  // controls: a control that is disabled and looks live is a control a learner
  // taps twice and then stops believing. These three are turned off while the
  // tutor holds the floor, and "Give me a moment" beside them deliberately is
  // not, so the difference has to be visible or the row is lying.
  helpItemOff: { opacity: 0.55 },
  helpItem: {
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(1.5),
    paddingHorizontal: space(2.5),
  },
});
