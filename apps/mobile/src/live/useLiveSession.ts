/**
 * The live session hook — the app side of the wire protocol.
 *
 * Deliberately thin. The agent owns the ladder, the lesson position, the grading
 * and the rescue timing; this hook connects, publishes the microphone, and renders
 * whatever the agent says to render. If a piece of pedagogy logic ever appears in
 * this file, it is in the wrong place.
 *
 * It does own one thing beyond connecting: knowing when the tutor never turned
 * up. A room that opens and stays empty used to render a bare spinner forever,
 * with no message and no way out, while the meter ran. See the watchdog below.
 */

import { TOKEN_SERVER } from './serverUrl.ts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import {
  decodeServerMessage,
  encodeMessage,
  TOPIC_CLIENT,
  TOPIC_SERVER,
  type ClientMessage,
  type ConvoPhrase,
  type ConvoView,
  type DrillExercise,
  type RecapPayload,
  type Rung,
  type SessionPrompt,
  type SessionSummary,
  type TurnFeedback,
} from '@parle/core';
import { ensureAudioSession, ensureLiveKitGlobals, releaseAudioSession } from './globals.ts';
import { authHeaders } from '../auth/adapter.ts';
import { journalRecap } from './journal.ts';
import { classifyFailure, failureCopy, micApiUnavailable, TokenServerError, type LiveFailure } from './failure.ts';
import { pushTurn, type TurnLine } from './turns.ts';
import { nextStart, standDown, startStillOwns, NO_START } from './startOwnership.ts';
import { thinkingAfter } from './thinking.ts';
import { opensSession } from './sessionOpened.ts';
import { afterDismiss } from './safetyState.ts';
import { micOpensAtConnect, modeCarriesAudio } from '../tutor/choosingView.ts';
import { stoppedBySafety, type SafetyDecision } from '../tutor/safetyView.ts';
import { shouldPingTyping } from '../tutor/typingPing.ts';
import type { ReplayLine } from '../tutor/sceneControls.ts';


/**
 * How long to wait for the tutor to walk into the room.
 *
 * The room connecting proves the network works; it proves nothing about the
 * agent worker, which is a separate process that may be down, keyless, or
 * throwing inside its job entry. Twelve seconds is long enough for a cold
 * worker to pick up a job and short enough that nobody wonders if it is broken.
 */
const AGENT_JOIN_TIMEOUT_MS = 12000;

/**
 * How long to wait for the tutor to actually START the session once it is in
 * the room.
 *
 * This is a separate deadline because the two failures are separate, and
 * conflating them was a real bug in the first cut of this watchdog. An agent
 * that never dispatches is silent; an agent whose voice or brain is missing a
 * key JOINS, publishes `speaking` as it takes the floor, and then hangs inside
 * the vendor call forever — so treating "said anything at all" as proof of life
 * let exactly the more common failure sail straight through. Liveness is
 * content, not noise: a prompt, a scene, or the topic chips.
 *
 * Longer than the join deadline on purpose. Opening a free conversation runs
 * the scenario builder, which is a real model call and is allowed to think.
 */
const SESSION_OPEN_TIMEOUT_MS = 25000;

/**
 * When to say "ready" again while waiting.
 *
 * The first `ready` is normally DROPPED: LiveKit does not queue data for
 * participants who have not joined yet, and the agent only starts listening
 * after it has waited for us. Today that is invisible because both agents also
 * push their opening state unconditionally — these retries make the handshake
 * survive on its own terms rather than on that coincidence. Both agents answer
 * `ready` by republishing current state, so extra ones are harmless.
 */
const READY_RETRIES_MS = [1500, 3500, 6500];

/** Give up on the signal connection well before the learner does. */
const CONNECT_TIMEOUTS = { peerConnectionTimeout: 12000, websocketTimeout: 8000 };

/**
 * Everything worth knowing about why a session did or did not start, collected
 * as it happens and shown behind "What happened?" on an error screen. The point
 * is that the next person can tell an environment problem from a bug without
 * reading LiveKit's logs.
 */
export interface LiveDiagnostics {
  tokenServer: string;
  livekitUrl: string | null;
  tokenStatus: number | null;
  authMs: number | null;
  tokenMs: number | null;
  tokenServerTiming: string | null;
  connectMs: number | null;
  micPublished: boolean;
  agentJoined: boolean;
  audioTrackSubscribed: boolean;
  firstServerMessage: boolean;
  /** The tutor sent something the screen could actually render. */
  sessionOpened: boolean;
  lastFailure: LiveFailure | null;
}

function emptyDiagnostics(): LiveDiagnostics {
  return {
    tokenServer: TOKEN_SERVER,
    livekitUrl: null,
    tokenStatus: null,
    authMs: null,
    tokenMs: null,
    tokenServerTiming: null,
    connectMs: null,
    micPublished: false,
    agentJoined: false,
    audioTrackSubscribed: false,
    firstServerMessage: false,
    sessionOpened: false,
    lastFailure: null,
  };
}

/** One stable prefix so a developer can filter the console to just this. */
function trace(event: string, detail?: Record<string, unknown>): void {
  console.info(`[parle:live] ${event}`, detail ?? {});
}

export type LiveStatus =
  | { phase: 'idle' }
  | { phase: 'connecting' }
  | { phase: 'live' }
  | { phase: 'out-of-minutes'; message: string }
  | { phase: 'error'; failure: LiveFailure; message: string; canType: boolean }
  | { phase: 'ended' };

export interface LiveSession {
  status: LiveStatus;
  prompt: SessionPrompt | null;
  feedback: TurnFeedback | null;
  /** True while the tutor holds the floor — the mic control renders idle. */
  tutorSpeaking: boolean;
  /** The learner's own words, as the agent heard them. */
  lastTranscript: string | null;
  summary: SessionSummary | null;
  /** Free conversation: the current turn to render. Null on the lesson path. */
  convo: ConvoView | null;
  /**
   * Free conversation's opening moment: the tutor's spoken question (English,
   * with the French alongside for the screen). No menu — the learner answers
   * in their own words. Cleared the instant the first scene view arrives.
   */
  opening: { prompt: { fr: string; en: string } } | null;
  /** Free conversation's end card, plus the updated profile blob to persist. */
  recap: { recap: RecapPayload; profile: unknown } | null;
  /**
   * The session's practice leave-behind: the topics actually talked about,
   * each with its few curated phrases. Arrives once, after the recap. The app
   * banks it (topic store + review deck); nothing renders it live.
   */
  practice: { titleFr: string; titleEn: string; phrases: ConvoPhrase[] }[] | null;
  /**
   * Exercises authored from this session, arriving shortly after the recap.
   * The app persists them into its drill bank; nothing renders them live.
   */
  drills: DrillExercise[] | null;
  /**
   * A transient trouble notice from the agent (a voice hiccup, say). The session
   * is still live — this renders IN the session, never as a terminal screen.
   */
  notice: string | null;
  /**
   * The tutor's safety decision for this session, or null. Never a notice.
   *
   * A notice clears itself after eight seconds and is superseded by whatever
   * arrives next, which is right for a voice hiccup and was catastrophic for a
   * crisis sentence: the emergency number vanished and the recap card
   * congratulated the learner on the same tick. This one has no timer at all,
   * it survives the recap, the summary and the room dropping, and only the
   * learner can put it away — and only when it is a redirect. What the two
   * screens draw from it is `tutor/safetyView.ts`.
   */
  safety: SafetyDecision | null;
  /** The learner putting a redirect away. A no-op when the action is 'stop'. */
  dismissSafety: () => void;
  /**
   * The conversation so far, accumulated on this side because the wire only
   * ever describes the current turn. Empty on the lesson path.
   */
  turns: TurnLine[];
  /**
   * True between the learner finishing a turn and the tutor answering it.
   * Derived here from messages that already exist — the agent has no
   * "thinking" message and does not need one.
   */
  thinking: boolean;
  /** True while the browser refuses playback until it sees a user gesture. */
  audioBlocked: boolean;
  /**
   * True once this session is publishing a microphone.
   *
   * A free conversation connects with it closed and opens it when the learner
   * taps the circle, so this is what the circle reads to know which of the two
   * things it is: an invitation, or the learner's own turn.
   */
  micOpen: boolean;
  /**
   * True once the room is open but before the tutor has said anything. The
   * screens render a waiting state rather than an unexplained spinner.
   */
  waitingForTutor: boolean;
  /** Filled in when a session fails. Null otherwise. */
  diagnostics: LiveDiagnostics | null;
  /** Restart playback — call from a tap so the gesture satisfies autoplay policy. */
  resumeAudio: () => void;
  /**
   * Publish the microphone. Call it from a tap: the circle is where a learner
   * agrees to be heard, and on the web the gesture is also what the browser
   * wants before it will hand over a device.
   */
  openMic: () => void;
  start: () => Promise<void>;
  sendHelp: () => void;
  sendSkip: () => void;
  /**
   * Ask the agent to replay a line in the tutor's voice.
   *
   * `'support'` (the default, and what `hear` has always meant) is the line the
   * learner is being offered to say. `'scene'` is the tutor's own last line,
   * which is what tapping their bubble asks for. Call it with no argument from
   * anything that hands its handler straight to a Pressable, because the press
   * event would arrive here as the line name.
   */
  sendHear: (line?: ReplayLine) => void;
  /**
   * Answer a scripted turn by tapping one of its options.
   *
   * Graded exactly as a spoken turn, and deliberately not counted as an
   * utterance anybody listened to — so the end card reports that nothing was
   * scored rather than implying a tap sounded good.
   */
  sendChoice: (text: string) => void;
  /** Ask the tutor to say it again slowly, and to stay slow. */
  sendSlower: () => void;
  /** Ask for the current line in English. */
  sendEnglish: () => void;
  /** Text-mode conversation: send a typed learner turn. */
  sendSay: (text: string) => Promise<boolean>;
  /**
   * "Still here." Presence, not content, and throttled inside the hook so a
   * caller can hand it every keystroke without thinking about it.
   */
  sendTyping: () => void;
  /**
   * "Give me a moment." The learner has asked for time, and the agent's silence
   * clock stands down.
   *
   * Not throttled, unlike `sendTyping`: this one comes from a deliberate tap
   * rather than from every keystroke, and a learner who taps it twice is asking
   * twice. Nothing about their progress moves because they pressed it, and the
   * app answers on screen and never aloud.
   */
  sendMoment: () => void;
  /**
   * Ask the tutor to wrap up, and stay in the room while it does.
   *
   * Distinct from `leave`, which publishes the same tag and then immediately
   * disconnects. That is right for a learner walking out and wrong for one who
   * pressed a button promising them a recap: the recap is published back over
   * this room, so tearing it down is closing the door the answer comes through.
   * The screen already renders the recap in place for exactly this reason.
   */
  requestRecap: () => void;
  leave: () => Promise<void>;
}

export function useLiveSession(
  userId: string,
  lessonId: string,
  startRung?: Rung,
  opts?: {
    mode?: 'lesson' | 'convo' | 'convo-text' | 'lesson-text';
    snapshot?: unknown;
    /**
     * What the learner asked to talk about, when a topic card started this.
     * Both strings, both non-empty, or nothing: the server drops a malformed
     * seed and opens a generic session rather than refusing, because a bad
     * hint must never strand anyone, but that is not a reason to send blanks.
     */
    seedTopic?: { fr: string; en: string };
    /**
     * Which authored mission this session is, when a mission card started it.
     * It rides the same pipe `seedTopic` rides, into the join token and on to
     * the agent, which opens the scene straight from the authored frame. A
     * session with no mission opens exactly as it always has.
     */
    missionId?: string;
  },
): LiveSession {
  const [status, setStatus] = useState<LiveStatus>({ phase: 'idle' });
  const [prompt, setPrompt] = useState<SessionPrompt | null>(null);
  const [feedback, setFeedback] = useState<TurnFeedback | null>(null);
  const [tutorSpeaking, setTutorSpeaking] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [convo, setConvo] = useState<ConvoView | null>(null);
  const [opening, setOpening] = useState<LiveSession['opening']>(null);
  const [recap, setRecap] = useState<{ recap: RecapPayload; profile: unknown } | null>(null);
  const [practice, setPractice] = useState<LiveSession['practice']>(null);
  const [drills, setDrills] = useState<DrillExercise[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [safety, setSafety] = useState<SafetyDecision | null>(null);
  const [turns, setTurns] = useState<TurnLine[]>([]);
  const [thinking, setThinking] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [micOpen, setMicOpen] = useState(false);
  const [waitingForTutor, setWaitingForTutor] = useState(false);
  const [diagnostics, setDiagnostics] = useState<LiveDiagnostics | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Destructured so `start` does not churn on every render just because the
  // caller wrote the options object inline.
  const mode = opts?.mode;
  const snapshot = opts?.snapshot;
  const seedTopic = opts?.seedTopic;
  const missionId = opts?.missionId;
  const roomRef = useRef<Room | null>(null);
  const diagRef = useRef<LiveDiagnostics>(emptyDiagnostics());
  // Which attempt at starting owns the session. Bumped by leaving, by unmount
  // and by every new start, so an attempt still waiting on a token can find out
  // that it has been abandoned and give back what it built instead of handing a
  // live room to a screen that is gone. See startOwnership.ts for what it costs
  // when it does not.
  const startGenRef = useRef(NO_START);
  // The ready retries plus the give-up timer, so both can be cancelled the
  // instant the agent speaks — or the screen goes away.
  const watchdogRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const heardAgentRef = useRef(false);
  const sessionOpenedRef = useRef(false);
  // The safety decision again, as a ref. The data handler is a closure built
  // once at connect time and never sees a later render, so a `case` that needs
  // to know whether this session has been stopped — the recap does, before it
  // writes anything down — has to read it here. State for the screens, ref for
  // the wire; the two are only ever assigned together.
  const safetyRef = useRef<SafetyDecision | null>(null);
  // Monotonic, so a React key never collides and nothing depends on a clock.
  const turnSeq = useRef(0);
  // When the app last told the agent the learner is typing. A ref, not state:
  // it changes on keystrokes and must never cause a render.
  const typingPingAt = useRef<number | null>(null);
  // The <audio> elements holding the tutor's voice on web. Owned here so they are
  // guaranteed to leave the document when the session does.
  const audioElsRef = useRef<HTMLMediaElement[]>([]);

  const removeAudioEls = useCallback(() => {
    for (const el of audioElsRef.current) el.remove();
    audioElsRef.current = [];
  }, []);

  const clearWatchdog = useCallback(() => {
    for (const t of watchdogRef.current) clearTimeout(t);
    watchdogRef.current = [];
  }, []);

  const addTurn = useCallback((line: Omit<TurnLine, 'id'>) => {
    turnSeq.current += 1;
    const id = `t${turnSeq.current}`;
    setTurns((list) => pushTurn(list, line, id));
    return id;
  }, []);

  const publish = useCallback(async (message: ClientMessage): Promise<boolean> => {
    // TextEncoder types its output over ArrayBufferLike; livekit-client wants a
    // plain ArrayBuffer. The copy is a few dozen bytes once per tap.
    const bytes = Uint8Array.from(encodeMessage(message));
    const participant = roomRef.current?.localParticipant;
    if (!participant) return false;
    try {
      await participant.publishData(bytes, { topic: TOPIC_CLIENT, reliable: true });
      return true;
    } catch (err: unknown) {
      trace('publish-failed', { t: message.t, error: String(err) });
      return false;
    }
  }, []);

  const send = useCallback((message: ClientMessage) => {
    void publish(message);
  }, [publish]);

  /**
   * Defined before `start` so the watchdog can use the same exit the learner
   * has. Ending the room is what stops the meter, so a session that failed must
   * take this path and not simply render an error over a live room.
   */
  const leave = useCallback(async () => {
    // First, because everything below only tears down what has been built so
    // far. A start still waiting on a token has built nothing yet and would
    // sail straight past all of it, open a room a minute later, and leave the
    // tutor teaching an empty call at full price. This is the line that tells
    // it the session is no longer its to open.
    startGenRef.current = nextStart(startGenRef.current);
    clearWatchdog();
    send({ t: 'leave' });
    await roomRef.current?.disconnect();
    roomRef.current = null;
    removeAudioEls();
    await releaseAudioSession();
  }, [send, removeAudioEls, clearWatchdog]);

  /** Send the wrap-up tag and keep the room open for the answer. */
  const requestRecap = useCallback(() => {
    send({ t: 'leave' });
  }, [send]);

  const fail = useCallback((failure: LiveFailure) => {
    const copy = failureCopy(failure);
    diagRef.current.lastFailure = failure;
    setDiagnostics({ ...diagRef.current });
    setWaitingForTutor(false);
    trace('failed', { failure, ...diagRef.current });
    setStatus({ phase: 'error', failure, message: copy.message, canType: copy.canType });
  }, []);

  const start = useCallback(async () => {
    // This attempt's claim on the session, taken before anything else so that a
    // start beginning while an older one is still in flight owns the session
    // from here and the older one cannot write over it.
    const generation = nextStart(startGenRef.current);
    startGenRef.current = generation;
    /** Is this still the start the screen is waiting for? */
    const owns = (): boolean => startStillOwns(generation, startGenRef.current);
    // What this attempt has built, and therefore what it owes back if it turns
    // out nobody is waiting for it. Locals, not refs: the refs belong to
    // whoever owns the session now.
    let opened: Room | null = null;
    let audioSession = false;
    /**
     * Stop here if the learner has left, the screen has gone, or another start
     * has taken over. True means the caller must return, and by then everything
     * this attempt built has been given back.
     */
    const abandoned = async (): Promise<boolean> => {
      const plan = standDown(generation, startGenRef.current, { room: opened !== null, audioSession });
      if (plan === null) return false;
      trace('start-abandoned', { generation, current: startGenRef.current, ...plan });
      // Disconnecting is what stops the meter, and it stops the local tracks
      // with it, so the microphone closes here too. Neither call may throw:
      // this path exists to clean up, and a throw would put an error screen in
      // front of a learner who has already walked away.
      if (plan.disconnectRoom) await opened?.disconnect().catch(() => {});
      if (plan.releaseAudioSession) await releaseAudioSession().catch(() => {});
      return true;
    };
    setStatus({ phase: 'connecting' });
    setWaitingForTutor(false);
    setDiagnostics(null);
    diagRef.current = emptyDiagnostics();
    heardAgentRef.current = false;
    sessionOpenedRef.current = false;
    typingPingAt.current = null;
    // The one thing that clears a stop, and it is not a dismissal: a rebuilt
    // session is a different session, decided about separately.
    safetyRef.current = null;
    setSafety(null);
    setTurns([]);
    setThinking(false);
    setMicOpen(false);
    // A start that lands on top of a session that already opened takes the old
    // room with it. Nobody else will: the slot below is about to be overwritten,
    // and a room with no reference left to it is a room nobody disconnects while
    // the tutor keeps teaching it. ConvoScreen restarts exactly this way when a
    // learner switches to typing. The old room's own handlers are already deaf
    // by now, because the generation moved above.
    const previous = roomRef.current;
    roomRef.current = null;
    if (previous !== null) void previous.disconnect().catch(() => {});
    removeAudioEls();
    clearWatchdog();
    try {
      // Checked before anything else, and only for the modes that need one:
      // with no microphone API a spoken session has nothing to connect for, and
      // the failure deep inside the client would be unreadable.
      //
      // Asked of the mode table rather than as `mode !== 'convo-text'`, which
      // refused the typed lesson outright on a device with no mediaDevices —
      // precisely the learner that mode was built for.
      if (modeCarriesAudio(mode) && micApiUnavailable()) throw new Error('navigator.mediaDevices is unavailable');

      const authStartedAt = Date.now();
      const headers = await authHeaders();
      // Checked before the diagnostics are written, not after: the diagnostics
      // describe the session on screen, and this attempt may no longer be it.
      if (await abandoned()) return;
      diagRef.current.authMs = Date.now() - authStartedAt;
      const tokenStartedAt = Date.now();
      const res = await fetch(`${TOKEN_SERVER}/session/start`, {
        method: 'POST',
        // The bearer token, when auth is live, lets the server verify the
        // asserted userId instead of trusting it. Mock mode adds nothing.
        headers: { 'content-type': 'application/json', ...headers },
        // The token server signs startRung (and, for free conversation, the mode
        // and learner snapshot) into the join credential, so what the session
        // opens as is not something the client can quietly re-assert.
        body: JSON.stringify({
          userId,
          lessonId,
          ...(startRung !== undefined ? { startRung } : {}),
          ...(mode !== undefined ? { mode } : {}),
          ...(snapshot !== undefined ? { snapshot } : {}),
          ...(seedTopic !== undefined ? { seedTopic } : {}),
          ...(missionId !== undefined ? { missionId } : {}),
        }),
      });
      // The long wait, and the one this guard was built for. A cold start can
      // sit here for twenty five seconds, which is ample time to give up and
      // walk out, and the grant that arrives afterwards must not become a room.
      if (await abandoned()) return;
      diagRef.current.tokenStatus = res.status;
      diagRef.current.tokenMs = Date.now() - tokenStartedAt;
      diagRef.current.tokenServerTiming = res.headers.get('server-timing');

      if (res.status === 402) {
        const body = (await res.json()) as { message?: string };
        if (await abandoned()) return;
        setStatus({ phase: 'out-of-minutes', message: body.message ?? 'You are out of minutes.' });
        return;
      }
      if (!res.ok) throw new TokenServerError(res.status);

      const grant = (await res.json()) as { token: string; livekitUrl: string };
      // The last gate before a room exists at all. Everything past here has to
      // be given back rather than simply skipped.
      if (await abandoned()) return;
      diagRef.current.livekitUrl = grant.livekitUrl;
      trace('token', {
        status: res.status,
        livekitUrl: grant.livekitUrl,
        authMs: diagRef.current.authMs,
        tokenMs: diagRef.current.tokenMs,
        serverTiming: diagRef.current.tokenServerTiming,
      });

      ensureLiveKitGlobals();
      const room = new Room();
      // Held twice on purpose. `roomRef` is the session's room, read by every
      // control on the screen; `opened` is this attempt's room, and it is the
      // one that gets disconnected if this attempt turns out to be over. They
      // are the same object right up until a newer start replaces the ref.
      opened = room;
      roomRef.current = room;

      // The tutor's voice arrives as a remote audio track. livekit-client never
      // auto-plays: without an explicit attach the session is a one-way call —
      // the learner is heard and hears nothing back.
      room.on(RoomEvent.TrackSubscribed, (track) => {
        // A voice from a session nobody is in must never reach the document. It
        // would play over whatever the learner is doing now, from a tutor they
        // cannot answer.
        if (!owns()) return;
        if (track.kind !== Track.Kind.Audio) return;
        diagRef.current.audioTrackSubscribed = true;
        // On native the WebRTC session routes remote audio itself; the DOM path
        // is web-only.
        if (typeof document === 'undefined') return;
        const el = track.attach();
        el.style.display = 'none';
        document.body.appendChild(el);
        audioElsRef.current.push(el);
      });
      // Deliberately NOT gated on `owns`, unlike the rest of them. This one only
      // ever removes, and disconnecting an abandoned room is exactly when its
      // elements need taking out of the document.
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (typeof document === 'undefined') return;
        for (const el of track.detach()) {
          el.remove();
          audioElsRef.current = audioElsRef.current.filter((kept) => kept !== el);
        }
      });
      // Whether anyone else is in the room at all. The difference between "the
      // tutor is thinking" and "the tutor was never dispatched" is exactly this.
      room.on(RoomEvent.ParticipantConnected, (participant) => {
        // A tutor walking into an abandoned room is not proof of life for the
        // session on screen, and the watchdog reads this to decide which of the
        // two silences it is looking at.
        if (!owns()) return;
        diagRef.current.agentJoined = true;
        trace('participant-joined', { identity: participant.identity });
      });
      // The MONTER tap usually carries user activation through connect, but a slow
      // token fetch can outlive it and the browser then blocks playback. Surface
      // that as a tap-to-listen affordance rather than playing silence.
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (!owns()) return;
        setAudioBlocked(!room.canPlaybackAudio);
      });

      room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
        // Nothing an abandoned session says may reach the screen or the disk. A
        // recap is the sharp end of that: it is journalled the moment it
        // arrives, and a recap for a session the learner never had would land
        // in their review deck as practice they never did.
        if (!owns()) return;
        if (topic !== TOPIC_SERVER) return;
        const msg = decodeServerMessage(payload);
        if (!msg) return;
        // Any message at all proves the agent is in the room and talking to us.
        // It does NOT prove the session started — see SESSION_OPEN_TIMEOUT_MS.
        if (!heardAgentRef.current) {
          heardAgentRef.current = true;
          diagRef.current.firstServerMessage = true;
          trace('agent-first-message', { t: msg.t });
        }
        // Content, on the other hand, means the session is genuinely under way:
        // there is something on screen and the learner has a session to leave.
        // Which messages those are is `sessionOpened.ts`, per mode, and a safety
        // decision is one of them in every mode — a stop can be the first frame
        // there is, and the watchdog must not tear it down.
        if (!sessionOpenedRef.current && opensSession(mode, msg)) {
          sessionOpenedRef.current = true;
          diagRef.current.sessionOpened = true;
          clearWatchdog();
          setWaitingForTutor(false);
          trace('session-opened', { t: msg.t });
        }
        // Whether the tutor is still deciding is one rule about the whole
        // message union, not a line in each branch — see thinking.ts for what
        // scattering it cost.
        setThinking((was) => thinkingAfter(was, msg));

        switch (msg.t) {
          case 'prompt':
            setPrompt(msg.prompt);
            setFeedback(null);
            break;
          case 'feedback':
            setFeedback(msg.feedback);
            break;
          case 'speaking':
            setTutorSpeaking(msg.speaking);
            break;
          case 'transcript':
            if (msg.final) {
              setLastTranscript(msg.text);
              addTurn({ who: 'learner', fr: msg.text, frWritten: null, en: null });
            }
            break;
          case 'summary':
            setSummary(msg.summary);
            setStatus({ phase: 'ended' });
            break;
          case 'convo':
            setConvo(msg.view);
            // Narration lands before the line it introduces, the way it is
            // heard. `pushTurn` drops it when it is the same one as last turn.
            if (msg.view.narration) {
              addTurn({
                who: 'narration',
                fr: msg.view.narration.fr,
                frWritten: msg.view.narration.frWritten ?? null,
                en: msg.view.narration.en,
              });
            }
            addTurn({
              who: 'tutor',
              fr: msg.view.sceneReply.fr,
              frWritten: msg.view.sceneReply.frWritten ?? null,
              en: msg.view.sceneReply.en,
            });
            // A recast belongs under the learner line it corrects, so it is
            // attached backwards to the last thing the learner said.
            if (msg.view.coachNow.length > 0) {
              setTurns((list) => {
                const i = list.map((t) => t.who).lastIndexOf('learner');
                if (i < 0) return list;
                const next = [...list];
                next[i] = {
                  ...next[i]!,
                  recasts: msg.view.coachNow.map((c) => ({
                    quote: c.quote,
                    better: c.better,
                    betterEn: c.betterEn,
                    why: c.why,
                  })),
                };
                return next;
              });
            }
            // The scene has opened; the choosing moment is over. An agent that
            // never sent an opening (an older build, say) is also covered — the
            // app renders whatever arrives.
            setOpening(null);
            break;
          case 'opening':
            setOpening({ prompt: msg.prompt });
            // The opener is SPOKEN in English; the thread shows it the same way
            // round, with the French alongside as exposure.
            addTurn({ who: 'tutor', fr: msg.prompt.fr, frWritten: null, en: msg.prompt.en });
            break;
          case 'safety':
            // The tutor's decision about what is being said, and the only piece
            // of session state with no timer anywhere near it. Deliberately not
            // a notice: `error` below takes itself away after eight seconds,
            // which is right for a voice outage and was how an emergency number
            // came to vanish under a card saying "Good session."
            //
            // Nothing else in this switch may clear it, `dismissSafety` clears
            // only a redirect, and `start` clears it because a rebuilt session
            // is a new session. Those are the three, and the test enumerates
            // them. What the screens draw is `tutor/safetyView.ts`.
            safetyRef.current = msg;
            setSafety(msg);
            break;
          case 'recap':
            setRecap({ recap: msg.recap, profile: msg.profile });
            // Written down before anything else, because from here the learner
            // can close the app at any moment and the leave-early fallback only
            // runs when they tap Done. Cleared as soon as banking succeeds.
            //
            // The learner model rides with it. The journal reads one thing off
            // that blob, which is how often each phrase has been used well in
            // conversation, and folds it into the batch the deck is built from.
            // Journal the recap alone and those counts are read off an empty
            // profile, so a phrase somebody has genuinely started using arrives
            // in review looking exactly like one they read once.
            //
            // Unless this session was stopped. A stopped session leaves nothing
            // behind — the founder was asked and chose that deliberately,
            // including the ordinary practice from before the disclosure — and
            // the screens can only withhold what they are handed. This is the
            // one write they never see: it happens here, before any of them has
            // the recap, so a screen guarding its own recap would be guarding a
            // door the words had already gone through.
            if (!stoppedBySafety(safetyRef.current)) void journalRecap(msg.recap, { profile: msg.profile });
            setStatus({ phase: 'ended' });
            break;
          case 'practice':
            setPractice(msg.topics);
            break;
          case 'drills':
            setDrills(msg.exercises);
            break;
          case 'error':
            // The agent reports pipeline hiccups (a TTS outage, say) that usually
            // pass. The room, the microphone and the meter are all still running,
            // so this must never replace the session with a dead-end screen — it
            // surfaces inside the session and clears itself. The learner can
            // always leave through the session's own exit.
            setNotice(msg.message);
            if (noticeTimer.current) clearTimeout(noticeTimer.current);
            noticeTimer.current = setTimeout(() => setNotice(null), 8000);
            break;
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        // An abandoned room is disconnected on purpose, by the attempt that
        // built it, and that is not a drop. Without this line, tidying one up
        // would paint "The connection dropped" over the session the learner is
        // in now.
        if (!owns()) return;
        // If the summary already arrived this is a normal ending, and an earlier
        // error (a denied microphone, say) already explains itself — this handler
        // only covers the drop nobody else accounted for.
        clearWatchdog();
        setStatus((s) => {
          if (s.phase === 'ended' || s.phase === 'error') return s;
          const copy = failureCopy('dropped');
          return { phase: 'error', failure: 'dropped', message: copy.message, canType: copy.canType };
        });
      });

      // A quiet mode carries no audio in either direction: no microphone to
      // request (the whole point — the train carriage, the denied permission)
      // and nothing the agent will ever speak. Taking the audio session anyway
      // is how the typed lesson came to hear a tutor it could not answer.
      if (modeCarriesAudio(mode)) {
        await ensureAudioSession();
      }
      // Asked of the same mode table the block above asks, so the record of
      // what this attempt took cannot drift from what it took. `leave` runs
      // `releaseAudioSession` too early to catch this one: it fires while the
      // session is still being taken, finds nothing started, and returns.
      audioSession = modeCarriesAudio(mode);
      if (await abandoned()) return;
      const connectStartedAt = Date.now();
      await room.connect(grant.livekitUrl, grant.token, CONNECT_TIMEOUTS);
      // The room is up. From here an abandoned attempt is not a tidy-up but a
      // bill: the tutor is dispatched into a connected room, teaches nobody,
      // and the minutes come off the learner's allowance.
      if (await abandoned()) return;
      diagRef.current.connectMs = Date.now() - connectStartedAt;
      trace('connected', { connectMs: diagRef.current.connectMs });
      if (modeCarriesAudio(mode)) {
        // Publishing and playing back are two different permissions and now two
        // different moments. A free conversation waits for the circle to be
        // tapped before it opens a microphone; hearing the tutor cannot wait,
        // because the tutor is about to ask its question out loud.
        if (micOpensAtConnect(mode)) {
          await room.localParticipant.setMicrophoneEnabled(true);
          diagRef.current.micPublished = true;
          setMicOpen(true);
        }
        try {
          await room.startAudio();
        } catch {
          // The status-changed handler shows the tap-to-listen plaque.
          setAudioBlocked(!room.canPlaybackAudio);
        }
      }
      // The last gate, and the only one with nothing after it: from here to the
      // armed watchdog is a single tick, so a session cannot go live without
      // something watching it.
      if (await abandoned()) return;
      setStatus({ phase: 'live' });

      // The room is open. Now find out whether anyone is home.
      setWaitingForTutor(true);
      send({ t: 'ready' });
      // Leaving properly rather than just rendering an error over a live room:
      // an abandoned room is a room the meter is still counting.
      const giveUp = (failure: LiveFailure) => {
        void leave().catch(() => {});
        fail(failure);
      };
      watchdogRef.current = [
        ...READY_RETRIES_MS.map((ms) =>
          setTimeout(() => {
            if (heardAgentRef.current) return;
            trace('ready-retry', { afterMs: ms });
            send({ t: 'ready' });
          }, ms),
        ),
        // Nobody came. The worker is down, or was never dispatched to this room.
        setTimeout(() => {
          if (sessionOpenedRef.current) return;
          if (diagRef.current.agentJoined || heardAgentRef.current) return; // it is here, just slow — the next timer owns it
          giveUp('agent-absent');
        }, AGENT_JOIN_TIMEOUT_MS),
        // Somebody came and never started. Almost always a missing vendor key:
        // the agent takes the floor, the voice or the brain hangs, and the
        // opening line is never finished or published.
        setTimeout(() => {
          if (sessionOpenedRef.current) return;
          giveUp(diagRef.current.agentJoined || heardAgentRef.current ? 'agent-silent' : 'agent-absent');
        }, SESSION_OPEN_TIMEOUT_MS),
      ];
    } catch (err) {
      // An attempt that has already been taken over cannot fail on screen. The
      // usual way in is the learner leaving mid-connect: `leave` disconnects the
      // room, livekit reports the connection as cancelled, and it arrives here
      // as an error the learner would otherwise have been shown on their way
      // out. Give back what this attempt built, and say nothing.
      if (await abandoned()) return;
      // A half-started session must not stay half-started: without this the room
      // stays open behind the error screen, the agent keeps teaching an empty
      // call, and the meter keeps counting.
      clearWatchdog();
      void roomRef.current?.disconnect().catch(() => {});
      roomRef.current = null;
      removeAudioEls();
      fail(classifyFailure(err));
    }
  }, [
    userId,
    lessonId,
    startRung,
    mode,
    snapshot,
    seedTopic,
    missionId,
    send,
    removeAudioEls,
    clearWatchdog,
    requestRecap,
    leave,
    fail,
    addTurn,
  ]);

  const resumeAudio = useCallback(() => {
    // Success flips audioBlocked back via AudioPlaybackStatusChanged.
    void roomRef.current?.startAudio().catch(() => {});
  }, []);

  const openMic = useCallback(() => {
    const room = roomRef.current;
    if (room === null || room.localParticipant.isMicrophoneEnabled) return;
    void room.localParticipant
      .setMicrophoneEnabled(true)
      .then(() => {
        // Kept in step with the diagnostics panel, which reports this. Left
        // false it would make a healthy tap-to-talk session read as broken to
        // whoever debugs it next.
        diagRef.current.micPublished = true;
        trace('mic-opened');
        setMicOpen(true);
      })
      .catch((err: unknown) => {
        // Not a dead end and not a terminal screen: the room, the tutor and the
        // meter are all still running, and the quiet door is on the same screen.
        trace('mic-open-failed', { error: String(err) });
        setNotice('Your microphone did not open. You can switch to typing instead.');
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(null), 8000);
      });
  }, []);

  /**
   * The learner putting a redirect away.
   *
   * A stop comes back from `afterDismiss` unchanged and by identity, so this
   * does not even re-render: there is nothing underneath a stop to carry on
   * with, and handing the session back would be the surface disappearing under
   * a thumb.
   */
  const dismissSafety = useCallback(() => {
    const next = afterDismiss(safetyRef.current);
    if (next === safetyRef.current) return;
    safetyRef.current = next;
    setSafety(next);
  }, []);

  // Never leave a microphone open past the component that owns it.
  useEffect(() => {
    return () => {
      // The screen can be popped by navigation as well as by the door, and a
      // start in flight has to hear about it either way. Same reason as `leave`:
      // without this, the room arrives after the screen has gone.
      startGenRef.current = nextStart(startGenRef.current);
      for (const t of watchdogRef.current) clearTimeout(t);
      watchdogRef.current = [];
      void roomRef.current?.disconnect();
      roomRef.current = null;
      removeAudioEls();
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      void releaseAudioSession();
    };
  }, [removeAudioEls]);

  return {
    status,
    prompt,
    feedback,
    tutorSpeaking,
    lastTranscript,
    summary,
    convo,
    opening,
    recap,
    practice,
    drills,
    notice,
    safety,
    dismissSafety,
    turns,
    thinking,
    audioBlocked,
    micOpen,
    waitingForTutor,
    diagnostics,
    resumeAudio,
    openMic,
    start,
    sendHelp: useCallback(() => send({ t: 'help' }), [send]),
    sendSkip: useCallback(() => send({ t: 'skip' }), [send]),
    sendHear: useCallback(
      (line?: ReplayLine) => send(line === undefined ? { t: 'hear' } : { t: 'hear', line }),
      [send],
    ),
    sendChoice: useCallback((text: string) => send({ t: 'choice', text }), [send]),
    sendSlower: useCallback(() => send({ t: 'slower' }), [send]),
    sendEnglish: useCallback(() => send({ t: 'english' }), [send]),
    sendSay: useCallback(
      async (text: string) => {
        // The agent transcribes speech back to us but never echoes a TYPED
        // turn, so without this optimistic append the learner's own words
        // simply never appear in text mode.
        const optimisticId = addTurn({ who: 'learner', fr: text, frWritten: null, en: null });
        setThinking(true);
        const sent = await publish({ t: 'say', text });
        if (sent) return true;

        // Roll back only the turn this send added, and hand the words back to
        // ConvoScreen through the return value. A network miss must not make a
        // learner retype a sentence in a language they are still learning.
        setTurns((list) => list.filter((turn) => turn.id !== optimisticId));
        setThinking(false);
        setNotice('That did not send. Your words are back in the box.');
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(null), 8000);
        return false;
      },
      [publish, addTurn],
    ),
    sendTyping: useCallback(() => {
      const now = Date.now();
      if (!shouldPingTyping(typingPingAt.current, now)) return;
      typingPingAt.current = now;
      send({ t: 'typing' });
    }, [send]),
    sendMoment: useCallback(() => send({ t: 'moment' }), [send]),
    requestRecap,
    leave,
  };
}
