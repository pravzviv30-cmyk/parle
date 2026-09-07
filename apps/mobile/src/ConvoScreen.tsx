/**
 * The free-conversation driver and surface.
 *
 * The convo sibling of LiveSessionScreen: connect on mount, publish the
 * microphone, render whatever the agent says to render. Everything pedagogical —
 * the scene, the coaching, when support appears, when the recap is due — happens
 * in the agent's brain; this screen is deliberately unable to disagree with it.
 *
 * What is deliberately absent compared to the lesson surface: no rung row (a
 * conversation is not a ladder), no numeric position (mid-session copy carries
 * no numbers — the station line alone gives the sense of moving through beats).
 */

import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePreventRemove } from '@react-navigation/native';
import {
  conversationXp,
  phraseKeyOf,
  type ConvoPhrase,
  type DrillExercise,
  type IncomingTopic,
  type RecapPayload,
  type Rung,
} from '@luvani/core';
import { accent, paper, signal, space, type, radius, HAIRLINE, HIT } from './theme.ts';
import {
  Card,
  Label,
  PillButton,
  GhostButton,
  StationLine,
  EarGlyph,
  HelpGlyph,
  fitDisplay,
} from './components.tsx';
import { SupportBlock } from './SessionView.tsx';
import { ConfirmSheet, ScreenHeader } from './layout.tsx';
import { leaveConfirmCopy } from './live/leaveConfirm.ts';
import { RecapScreen } from './RecapScreen.tsx';
import { mergeExercises } from './drill/store.ts';
import { bankPractice, journalDrills, journalPractice } from './live/journal.ts';
import { MAX_RECOVERED_PHRASES, convoUsesFrom, type PracticeBatch } from './live/journalRules.ts';
import { recordActivity } from './progress/activity.ts';
import { useLiveSession } from './live/useLiveSession.ts';
import { CONNECTING_TICK_MS, connectingTick, connectingView } from './live/connectingView.ts';
import { LiveErrorView } from './live/LiveErrorView.tsx';
import { connectionLine } from './live/connectionLine.ts';
import { takeTypedDoor, typedDoorFor } from './live/typedDoor.ts';
import { useProfile } from './app/ProfileContext.tsx';
import { isUnderAgeStop } from './profile/age.ts';
import { prefersTyping } from './profile/typing.ts';
import { withAgeStop } from './profile/store.ts';
import { VoiceOrb, type OrbState } from './tutor/VoiceOrb.tsx';
import { Transcript } from './tutor/Transcript.tsx';
import { QUIET_DOOR, choosingView } from './tutor/choosingView.ts';
import { safetySurface, stoppedBySafety } from './tutor/safetyView.ts';
import { waitingView } from './tutor/waitingView.ts';
import { SafetyBanner, SafetyStopView } from './tutor/SafetyStopView.tsx';
import { enterSubmits, keyPressFrom } from './tutor/enterSubmit.ts';
import { tutorNameOf } from './tutor/tutorName.ts';
import { tutorVoiceOf } from './tutor/tutorVoice.ts';
import { OPEN_MIC_LABEL, sceneControls, typedTurn } from './tutor/sceneControls.ts';
import { NO_WIN, dismissWin, winAfterTurn, winCard, type WinState } from './tutor/missionWin.ts';
import { recapWait } from './tutor/recapWait.ts';

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
import {
  COACH_MARK_TEXT,
  coachMarksAfter,
  coachMarksAt,
  dismissCoachMark,
  type CoachMarkState,
} from './tutor/coachMarks.ts';
import { loadSeenCoachMarks, markCoachMarkSeen } from './tutor/store.ts';
import { recordMissionCompletion } from './missions/store.ts';
import { recordScenarioProgress } from './missions/progressStore.ts';
import { replayNote, type MissionReplay } from './missions/chooserView.ts';
import { trackProductEvent } from './analytics/track.ts';
import { MOMENT_ANSWER_MS, momentAnswer } from './practice/statusLine.ts';
import { settleIn, useReduceMotion } from './motion.ts';
import { Paywall } from './purchases/Paywall.tsx';

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

/**
 * The mission is finished, said once.
 *
 * DESIGN.md asks for a subtle, satisfying completion moment, and subtle is a
 * constraint rather than a mood: no confetti, no score, no percentage, nothing
 * that says how well. The line is the mission's own sentence about what the
 * learner actually did, which is a thing they can check, and the two doors are
 * both honest about what they cost.
 *
 * One primary action. "Keep talking" is the pill because the session is still
 * running underneath the card and carrying on is the cheaper of the two
 * decisions to get wrong; the line under it says plainly that it uses minutes,
 * so continuing is chosen and never assumed. Leaving is the ghost, and the
 * standing Leave in the header still works, as it must on any metered screen.
 *
 * Motion is the app's one settle: transform and opacity, native driver, and the
 * final frame under reduce motion. The arrival is the flourish; the sentence is
 * the point, and nobody waits through a flourish to read that they did it.
 */
function MissionWin({
  card,
  onKeep,
  onFinish,
}: {
  card: { line: string; keepLabel: string; keepSub: string; finishLabel: string };
  onKeep: () => void;
  onFinish: () => void;
}) {
  const settle = useRef(new Animated.Value(0)).current;
  const reduced = useReduceMotion();
  useEffect(() => {
    const animation = settleIn(settle, reduced);
    return () => animation?.stop();
  }, [settle, reduced]);

  return (
    <Animated.View
      style={[
        st.win,
        {
          opacity: settle,
          transform: [{ translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
    >
      <Card>
        <Text
          accessibilityLiveRegion="polite"
          style={[fitDisplay(card.line), { color: paper.ink, textAlign: 'center' }]}
        >
          {card.line}
        </Text>
        <View style={st.winPrimary}>
          <PillButton label={card.keepLabel} onPress={onKeep} />
        </View>
        <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center', marginTop: space(2) }]}>
          {card.keepSub}
        </Text>
        <View style={st.winSecondary}>
          <GhostButton label={card.finishLabel} onPress={onFinish} />
        </View>
      </Card>
    </Animated.View>
  );
}

export function ConvoScreen({
  userId,
  snapshot,
  onRecap,
  onExit,
  startInTextMode = false,
  seedTopic,
  missionId,
  replay,
}: {
  userId: string;
  /** The stored learner model, passed through to the agent opaquely. */
  snapshot: unknown;
  /** The conversation ended: here is the end card and the updated model. */
  onRecap: (recap: RecapPayload, profileBlob: unknown) => void;
  onExit: () => void;
  /** "Can't speak right now": the same tutor, typed. */
  startInTextMode?: boolean;
  /**
   * What the learner asked to talk about again, from a topic card. It rides the
   * start body into the join token, the same channel mode and the snapshot use.
   * A session with no seed opens exactly as it always has.
   */
  seedTopic?: { fr: string; en: string };
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
}) {
  const insets = useSafeAreaInsets();
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
    mode: openedTyped ? 'convo-text' : 'convo',
    snapshot,
    seedTopic,
    ...(missionId !== undefined ? { missionId } : {}),
    tutorVoice: tutorVoiceOf(profile),
  });

  // Connect on mount, and again only in the one case a session has to be built
  // from cold to be typed. The hook tears the room down on unmount.
  useEffect(() => {
    void live.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedTyped]);

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

  const sendDraft = () => {
    const turn = typedTurn(draft);
    if (turn === null) return;
    setDraft('');
    void live.sendSay(turn.text).then((sent) => {
      if (!sent) setDraft((current) => (current.trim().length > 0 ? current : turn.text));
    });
  };

  // Typing is presence. The hook throttles, so this can be handed every letter.
  const changeDraft = (text: string) => {
    setDraft(text);
    live.sendTyping();
  };

  /**
   * The return key, on the one platform where the props are not enough.
   *
   * react-native-web 0.21 has never heard of `submitBehavior`, and it runs its
   * own Enter branch from inside the very handler it calls this one from. So
   * this goes first and calls preventDefault, which makes that branch stand
   * down: exactly one send, and the caret stays where the learner left it.
   * See tutor/enterSubmit.ts for what the platform actually does.
   */
  const keyDraft = (event: { preventDefault: () => void }) => {
    if (!enterSubmits(Platform.OS, keyPressFrom(event), draft)) return;
    event.preventDefault();
    sendDraft();
  };

  // The recap renders here, not on a separate screen: the room must outlive
  // the end card, because the agent's background work — the enriched profile
  // and tonight's generated drills — arrives seconds AFTER the recap, and a
  // torn-down room would lose both. onRecap persists; it no longer navigates.
  const bankedRef = useRef(false);
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
  if (openedAtRef.current === null && live.convo !== null) openedAtRef.current = Date.now();
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
      void recordActivity('convo', xp, endedAt, openedAt === null ? {} : { durationMs: endedAt - openedAt });
    }
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

  const [win, setWin] = useState<WinState>(NO_WIN);
  /**
   * The learner pressed the door that promises a recap, and is waiting for it.
   *
   * It is a state rather than a straight `leaveNow()` because `leave()` publishes
   * the wrap-up tag and then disconnects, and the recap is published back over
   * that same room. Tearing it down is closing the door the answer comes
   * through, so the button promised something it then made impossible.
   */
  const [finishing, setFinishing] = useState(false);

  // A recap that never comes must not leave them holding a dead screen. The
  // ceiling is generous because the agent is assembling a recap and folding a
  // profile at this point, and short of it the fallback is the ordinary exit,
  // which still banks what they said.
  useEffect(() => {
    if (!finishing || live.recap) return;
    const bail = setTimeout(() => leaveNow(), RECAP_WAIT_MS);
    return () => clearTimeout(bail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishing, live.recap]);
  useEffect(() => {
    // Nothing is completed by a session that was stopped, and a mission written
    // down here is a congratulation the learner meets later on another screen.
    if (stopped) return;
    const step = winAfterTurn(win, live.convo, missionId);
    // Written at the flip and nowhere else, with the rung the winning view
    // carried. Independence is decided by code from that rung, so a record
    // that guessed it later would be a fabricated claim about how much help
    // this learner needed.
    if (step.record) {
      void recordMissionCompletion(step.record.id, step.record.rung);
      void trackProductEvent({
        name: 'mission_completed',
        properties: { missionId: step.record.id, rung: step.record.rung },
      });
    }
    if (step.state !== win) setWin(step.state);
  }, [live.convo, win, missionId, stopped]);

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

  const leaveNow = () => {
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
    void live.leave().finally(onExit);
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
    return <RecapScreen recap={live.recap.recap} onDone={leaveNow} />;
  }

  if (live.status.phase === 'connecting' || live.status.phase === 'idle') {
    // The longest silence in the product, and it used to be one unchanging
    // sentence with no door, returned above every control this screen owns.
    // The words and the way out are both the view model's now. Leaving here is
    // safe: `leave()` takes the session number with it, so an attempt still
    // waiting on a token stands down rather than opening a room for a screen
    // that has gone. See live/connectingView.ts and live/startOwnership.ts.
    const connecting = connectingView(connectingMs);
    return (
      <View style={st.center}>
        <ActivityIndicator color={paper.inkSoft} />
        <Text
          accessibilityLiveRegion="polite"
          style={[type.small, { color: paper.inkSoft, marginTop: space(3), textAlign: 'center' }]}
        >
          {connecting.headline}
        </Text>
        <View style={st.terminalAction}>
          <GhostButton label={connecting.leaveLabel} onPress={leaveNow} />
        </View>
      </View>
    );
  }

  if (live.status.phase === 'out-of-minutes') {
    return (
      <View style={st.center}>
        <Label color={paper.inkSoft}>You are out of minutes</Label>
        <Text style={[type.title, { color: paper.ink, marginTop: space(3), textAlign: 'center' }]}>
          {live.status.message}
        </Text>
        <Paywall userId={userId} />
        <View style={st.terminalAction}>
          <PillButton label="Back" onPress={onExit} />
        </View>
      </View>
    );
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
        message={live.status.message}
        diagnostics={live.diagnostics}
        onBack={leaveNow}
        onType={typedDoorFor(live.status.failure, { typing }) ? goQuiet : null}
      />
    );
  }

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
    return (
      <View style={st.shell}>
        {live.audioBlocked ? <ListenPlaque onPress={live.resumeAudio} tutorName={tutorName} /> : null}

        <View style={[st.root, { paddingTop: insets.top + space(2), paddingBottom: insets.bottom + space(2) }]}>
          {/* Metered minutes must always have a door, and it is the shared
              header's Leave now, which asks before it disconnects. */}
          <ScreenHeader leave={{ onPress: () => setConfirming(true), label: 'Leave', accessibilityLabel: 'Leave the conversation' }} />

          <ScrollView
            style={choosing.showTranscript ? st.chooseHeadShrink : st.chooseHeadGrow}
            contentContainerStyle={choosing.showTranscript ? st.chooseTop : st.chooseScroll}
            showsVerticalScrollIndicator={false}
            // Every other input screen in this app sets this. Without it the
            // keyboard closing eats the first tap, which is why Send worked in
            // the scene and did nothing here.
            keyboardShouldPersistTaps="handled"
          >
            {choosing.showQuestion ? (
              <>
                <Text style={[fitDisplay(live.opening.prompt.en), { color: paper.ink, textAlign: 'center' }]}>
                  {live.opening.prompt.en}
                </Text>
                <Text style={[type.french, { color: paper.inkSoft, textAlign: 'center', marginTop: space(1.5) }]}>
                  {live.opening.prompt.fr}
                </Text>
              </>
            ) : null}

            {/* The circle is the primary action here until it is tapped: the
                tutor asks out loud, and this is where the learner agrees to be
                heard. One label on one control, so the orb's own is silenced. */}
            <View style={choosing.showQuestion ? st.chooseOrb : st.chooseOrbTight}>
              {choosing.orbIsButton ? (
                <Pressable
                  onPress={live.openMic}
                  accessibilityRole="button"
                  accessibilityLabel={choosing.orbLabel}
                  style={({ pressed }) => [st.orbTap, pressed && { opacity: 0.7 }]}
                >
                  <VoiceOrb state={choosing.orb} announce={false} />
                </Pressable>
              ) : (
                <View style={st.orbTap} accessibilityRole="image" accessibilityLabel={choosing.orbLabel}>
                  <VoiceOrb state={choosing.orb} announce={false} />
                </View>
              )}
            </View>

            {choosing.helper ? (
              <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center', marginTop: space(4) }]}>
                {choosing.helper}
              </Text>
            ) : null}
          </ScrollView>

          {/* Everything said so far, arriving with the app's one settle. This
              is what makes a sent topic land on screen at once instead of
              three to ten seconds later. */}
          {choosing.showTranscript ? (
            <Transcript
              turns={live.turns}
              tutorName={tutorNameOf(profile)}
              tutorSpeaking={live.tutorSpeaking && !typing}
            />
          ) : null}

          {/* The tutor steered away and said why. It stays until the learner
              puts it away, unlike the notice below it, which is a hiccup on a
              timer. */}
          {safety.kind === 'redirect' ? <SafetyBanner surface={safety} onDismiss={live.dismissSafety} /> : null}

          {/* The quiet slot: a vendor hiccup on its own timer, or a connection
              being rebuilt, which has no timer and must not be given one. See
              live/connectionLine.ts for which wins and why. */}
          {line.text ? (
            <View style={st.notice}>
              <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>
                {line.text}
              </Text>
            </View>
          ) : null}

          {choosing.showInput ? (
            <View style={st.typeRow}>
              <TextInput
                value={draft}
                onChangeText={changeDraft}
                onSubmitEditing={sendDraft}
                onKeyPress={keyDraft}
                placeholder="Type what you want to talk about"
                placeholderTextColor={paper.inkFaint}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                submitBehavior="submit"
                accessibilityLabel="Type what you want to talk about"
                onFocus={() => setFocusedInput('topic')}
                onBlur={() => setFocusedInput(null)}
                style={[st.typeInput, focusedInput === 'topic' && st.typeInputFocused]}
              />
              <Pressable
                onPress={sendDraft}
                accessibilityRole="button"
                accessibilityLabel="Send your topic"
                style={({ pressed }) => [st.typeSend, pressed && { opacity: 0.88 }]}
              >
                <Text style={[type.button, { color: paper.onInk }]}>Send</Text>
              </Pressable>
            </View>
          ) : choosing.showQuietDoor ? (
            // The quiet twin, offered where a learner finds out they need it:
            // on a train, mid-question, not two screens back. It goes quiet in
            // the room that is already open, so the tutor does not start again
            // and the account's own lease is never asked a second question.
            <View style={st.quietDoor}>
              <GhostButton label={QUIET_DOOR} onPress={goQuiet} />
            </View>
          ) : null}
        </View>
        <ConfirmSheet
          visible={confirming}
          title={leaveCopy.title}
          body={leaveCopy.body}
          confirmLabel={leaveCopy.leave}
          cancelLabel={leaveCopy.stay}
          onConfirm={() => {
            setConfirming(false);
            setLeaving(true);
          }}
          onCancel={() => setConfirming(false)}
        />
      </View>
    );
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
    return (
      <View style={st.center}>
        {waiting.banner ? (
          <View style={st.waitingBanner}>
            <SafetyBanner surface={waiting.banner} onDismiss={live.dismissSafety} />
          </View>
        ) : null}
        <ActivityIndicator color={paper.inkSoft} />
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(3) }]}>{waiting.headline}</Text>
        <View style={st.terminalAction}>
          <GhostButton label={waiting.leaveLabel} onPress={leaveNow} />
        </View>
      </View>
    );
  }

  // Finish promised a recap. Until it lands, this is what the promise looks
  // like: the scene steps aside rather than sitting there inviting another
  // sentence out of somebody who has just ended the conversation. The fifteen
  // second bail above is the floor under this, and the door is the same exit.
  // See tutor/recapWait.ts.
  const finishWait = recapWait({ finishing, recapArrived: live.recap !== null });
  if (finishWait) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={paper.inkSoft} />
        <Text
          accessibilityLiveRegion="polite"
          style={[type.bodyStrong, { color: paper.ink, marginTop: space(3), textAlign: 'center' }]}
        >
          {finishWait.headline}
        </Text>
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2), textAlign: 'center' }]}>
          {finishWait.note}
        </Text>
        <View style={st.terminalAction}>
          <GhostButton label={finishWait.leaveLabel} onPress={leaveNow} />
        </View>
      </View>
    );
  }

  const listening = !live.tutorSpeaking;
  const controls = sceneControls({
    supportView: view.supportView,
    textMode: typing,
    listening,
    typingOpen,
    micOpen: live.micOpen,
  });
  const card = win.showing ? winCard(missionId) : null;
  const line = connectionLine({ reconnecting: live.reconnecting, notice: live.notice });
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

  return (
    <View style={st.shell}>
      {/* One calm white notice, gone the moment it is tapped. */}
      {live.audioBlocked ? <ListenPlaque onPress={live.resumeAudio} tutorName={tutorName} /> : null}

      <View style={[st.root, { paddingTop: insets.top + space(2), paddingBottom: insets.bottom + space(2) }]}>
        <View style={st.header}>
          {/* Metered minutes must always have a door, and it is the shared
              header's Leave now, which asks before it ends the scene. Leaving
              still delivers the recap the session has earned. */}
          <ScreenHeader leave={{ onPress: () => setConfirming(true), label: 'Leave', accessibilityLabel: 'Leave the conversation' }} />
          <View style={{ marginTop: space(2) }}>
            <StationLine total={view.beat.total} index={view.beat.position - 1} />
          </View>
          {/* What is different about walking back into a scene you have
              already finished. Said once, in ink rather than in a rung colour,
              and gone as soon as the learner answers. */}
          {replayLine ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[type.small, { color: paper.inkSoft, textAlign: 'center', marginTop: space(2) }]}
            >
              {replayLine}
            </Text>
          ) : null}
        </View>

        {/* The tutor, as an object. Toward the top, and the only thing on the
            screen that moves. */}
        <View style={st.orbBlock}>
          {controls.showOpenMic ? (
            <Pressable
              onPress={live.openMic}
              accessibilityRole="button"
              accessibilityLabel={OPEN_MIC_LABEL}
              style={({ pressed }) => [st.orbTap, pressed && { opacity: 0.7 }]}
            >
              <VoiceOrb state={orbState} />
            </Pressable>
          ) : (
            <VoiceOrb state={orbState} />
          )}
        </View>

        {/* Same banner in the scene as in the choosing moment: a redirect does
            not end anything, so the conversation carries on underneath it. */}
        {safety.kind === 'redirect' ? <SafetyBanner surface={safety} onDismiss={live.dismissSafety} /> : null}

        {/* The same quiet slot as the choosing moment. A rebuilt connection is
            not a notice and gets no timer: eight seconds of silence explained,
            and then the explanation gone while the silence carried on, is what
            this replaces. */}
        {line.text ? (
          <View style={st.notice}>
            <Text accessibilityLiveRegion="polite" style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>
              {line.text}
            </Text>
          </View>
        ) : null}

        {/* The conversation so far. Takes what is left and no more — the
            current turn's support and controls below it are what the learner
            is acting on. Tapping the tutor's last bubble plays it again: the
            same `hear`, asking for the scene line rather than the support one. */}
        <Transcript
          turns={live.turns}
          onReplayTutor={listening && !typing ? () => live.sendHear('scene') : undefined}
          tutorName={tutorNameOf(profile)}
          tutorSpeaking={live.tutorSpeaking && !typing}
        />

        {card ? (
          <MissionWin
            card={card}
            onKeep={() => setWin(dismissWin)}
            onFinish={() => {
              setWin(dismissWin);
              setFinishing(true);
              live.requestRecap();
            }}
          />
        ) : (
          <>
            {view.supportView.kind !== 'none' ? (
              <View style={st.support}>
                <SupportBlock
                  support={view.supportView}
                  // Replays come from the agent in the premium voice, and only while
                  // the learner holds the floor — a replay must not talk over the
                  // tutor. Text mode has no voice to replay. And there has to BE a
                  // line: `hear` speaks the support line, so on a hint turn or an
                  // options turn this button used to be pressable and silent.
                  onHearLine={controls.showHearIt ? () => live.sendHear() : undefined}
                />
              </View>
            ) : null}

          <View style={st.controls}>
            {/* The recast now renders in the thread, attached to the line it
                corrects, so only the spoken coaching line belongs here. */}
            {view.coachLine ? (
              <Text style={[type.bodyStrong, { color: paper.ink, textAlign: 'center', marginBottom: space(2) }]}>
                {view.coachLine}
              </Text>
            ) : null}

            {/* The answer to "Give me a moment": on screen, in the calm slot,
                and never spoken. A spoken acknowledgement of a pause is a
                remark on the pause. */}
            {momentTaps > 0 ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[type.small, { color: paper.inkSoft, textAlign: 'center', marginBottom: space(2) }]}
              >
                {momentAnswer(tutorName)}
              </Text>
            ) : null}

            {/* One contextual note at a time, dismissed by tapping it, and
                nothing underneath it stops working while it is up. */}
            {marks.showing ? (
              <Pressable
                onPress={closeMark}
                accessibilityRole="button"
                accessibilityLabel={`${COACH_MARK_TEXT[marks.showing]} Tap to close.`}
                style={({ pressed }) => [st.mark, pressed && { opacity: 0.7 }]}
              >
                <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>
                  {COACH_MARK_TEXT[marks.showing]}
                </Text>
              </Pressable>
            ) : null}

            {controls.showInput ? (
              <View style={st.typeRow}>
                <TextInput
                  value={draft}
                  onChangeText={changeDraft}
                  onSubmitEditing={sendDraft}
                  onKeyPress={keyDraft}
                  placeholder="Type your reply"
                  placeholderTextColor={paper.inkFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  submitBehavior="submit"
                  accessibilityLabel="Type your reply"
                  onFocus={() => setFocusedInput('reply')}
                  onBlur={() => setFocusedInput(null)}
                  style={[st.typeInput, focusedInput === 'reply' && st.typeInputFocused]}
                />
                <Pressable
                  onPress={sendDraft}
                  accessibilityRole="button"
                  accessibilityLabel="Send your reply"
                  style={({ pressed }) => [st.typeSend, pressed && { opacity: 0.88 }]}
                >
                  <Text style={[type.button, { color: paper.onInk }]}>Send</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={st.helpRow}>
              <Pressable
                onPress={() => {
                  closeMark();
                  live.sendHelp();
                }}
                disabled={!listening}
                accessibilityRole="button"
                accessibilityLabel="Ask for help with this line"
                style={({ pressed }) => [st.helpItem, !listening && st.helpItemOff, pressed && listening && { opacity: 0.6 }]}
              >
                <HelpGlyph size={15} />
                <Text style={[type.small, { color: listening ? paper.inkSoft : paper.inkFaint }]}>Help me out</Text>
              </Pressable>
              {/* Not disabled while the tutor talks, unlike the rest of this row.
                  Everything else here asks for a line and would talk over them;
                  this one only asks the clock to wait, and the learner who most
                  needs it is the one who can already see their turn coming. */}
              <Pressable
                onPress={askForAMoment}
                accessibilityRole="button"
                accessibilityLabel="Give me a moment"
                style={({ pressed }) => [st.helpItem, pressed && { opacity: 0.6 }]}
              >
                <Text style={[type.small, { color: paper.inkSoft }]}>Give me a moment</Text>
              </Pressable>
              {!typing ? (
                <>
                  <Pressable
                    onPress={() => {
                      closeMark();
                      live.sendSlower();
                    }}
                    disabled={!listening}
                    accessibilityRole="button"
                    accessibilityLabel={`Ask ${tutorName} to slow down`}
                    style={({ pressed }) => [st.helpItem, !listening && st.helpItemOff, pressed && listening && { opacity: 0.6 }]}
                  >
                    <Text style={[type.small, { color: listening ? paper.inkSoft : paper.inkFaint }]}>Slower</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      closeMark();
                      live.sendEnglish();
                    }}
                    disabled={!listening}
                    accessibilityRole="button"
                    accessibilityLabel="Ask for it in English"
                    style={({ pressed }) => [st.helpItem, !listening && st.helpItemOff, pressed && listening && { opacity: 0.6 }]}
                  >
                    <Text style={[type.small, { color: listening ? paper.inkSoft : paper.inkFaint }]}>In English</Text>
                  </Pressable>
                </>
              ) : null}
              {/* The quiet twin, offered where a learner finds out they need it.
                  It opens the box in place: `say` is already a full typed turn
                  agent-side, so nothing here rebuilds the session or costs the
                  learner the scene they are standing in. */}
              {controls.showTypeInstead ? (
                <Pressable
                  onPress={() => {
                    closeMark();
                    setTypingOpen(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Type your reply instead of saying it"
                  style={({ pressed }) => [st.helpItem, pressed && { opacity: 0.6 }]}
                >
                  <Text style={[type.small, { color: paper.inkSoft }]}>Type instead</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          </>
        )}
      </View>
      <ConfirmSheet
        visible={confirming}
        title={leaveCopy.title}
        body={leaveCopy.body}
        confirmLabel={leaveCopy.leave}
        cancelLabel={leaveCopy.stay}
        onConfirm={() => {
          setConfirming(false);
          setLeaving(true);
        }}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

const st = StyleSheet.create({
  orbBlock: { alignItems: 'center', paddingTop: space(4), paddingBottom: space(7) },
  support: { paddingBottom: space(2) },
  shell: { flex: 1, backgroundColor: paper.ground },
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  center: { flex: 1, backgroundColor: paper.ground, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(8) },
  listen: { minHeight: HIT, paddingHorizontal: space(5), paddingTop: space(3) },
  terminalAction: { marginTop: space(6), alignSelf: 'stretch' },
  // The waiting screen centres its children, so the banner has to be told to
  // take the width: a safety sentence shrink-wrapped to its longest word is
  // unreadable, and this one is the whole reason the branch draws anything.
  waitingBanner: { alignSelf: 'stretch', marginBottom: space(3) },
  header: { paddingBottom: space(3) },
  notice: { paddingBottom: space(2) },
  // Nothing but the question and the circle yet: they sit in the middle of the
  // screen, exactly as they always have.
  chooseHeadGrow: { flex: 1 },
  chooseScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: space(6) },
  // Once the thread opens it takes the room, and the head above it gives way
  // rather than pushing anything off the bottom.
  chooseHeadShrink: { flexGrow: 0, flexShrink: 1 },
  chooseTop: { alignItems: 'center', paddingTop: space(2), paddingBottom: space(4) },
  chooseOrb: { alignItems: 'center', marginTop: space(7), marginBottom: space(8) },
  chooseOrbTight: { alignItems: 'center', marginTop: space(2), marginBottom: space(8) },
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
    paddingHorizontal: space(4),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: accent.primary,
    borderRadius: radius.pill,
  },
  helpRow: {
    marginTop: space(3),
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space(1),
  },
  // The completion card sits where the support card would have been, so the
  // screen keeps its shape and the win does not shove the thread off the top.
  win: { paddingBottom: space(3) },
  winPrimary: { marginTop: space(5), alignSelf: 'stretch' },
  winSecondary: { marginTop: space(3), alignItems: 'center' },
  // A note, not a dialogue: no border, no shadow, nothing to answer. The touch
  // floor is here because the whole strip is what dismisses it.
  mark: {
    minHeight: HIT,
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: space(4),
    paddingVertical: space(2),
    marginBottom: space(2),
    backgroundColor: paper.groundDeep,
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
