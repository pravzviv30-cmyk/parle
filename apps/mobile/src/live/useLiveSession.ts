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
import { thinkingAfter } from './thinking.ts';
import { micOpensAtConnect } from '../tutor/choosingView.ts';
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

/**
 * The server messages that mean "there is now a session on screen" — per mode,
 * because the two session shapes render from different messages entirely.
 *
 * Mode-specific on purpose. A first cut used one shared set, and a stale agent
 * answering a conversation request with a lesson `prompt` therefore counted as
 * the conversation having opened: the watchdog stood down and ConvoScreen —
 * which renders `convo`, never `prompt` — span forever anyway. An agent that
 * serves the wrong protocol for the mode it was handed is a real fault and
 * should time out and say so, not be quietly accepted.
 */
const OPENING_TAGS: Record<'lesson' | 'convo', ReadonlySet<string>> = {
  lesson: new Set(['prompt', 'summary']),
  convo: new Set(['convo', 'opening', 'recap']),
};

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
  // The ready retries plus the give-up timer, so both can be cancelled the
  // instant the agent speaks — or the screen goes away.
  const watchdogRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const heardAgentRef = useRef(false);
  const sessionOpenedRef = useRef(false);
  // Monotonic, so a React key never collides and nothing depends on a clock.
  const turnSeq = useRef(0);
  // When the app last told the agent the learner is typing. A ref, not state:
  // it changes on keystrokes and must never cause a render.
  const typingPingAt = useRef<number | null>(null);
  // The <audio> elements holding the tutor's voice on web. Owned here so they are
  // guaranteed to leave the document when the session does.
  const audioElsRef = useRef<HTMLMediaElement[]>([]);

  // 'convo' and 'convo-text' are the same protocol; only the audio differs.
  const openingTags = mode === 'convo' || mode === 'convo-text' ? OPENING_TAGS.convo : OPENING_TAGS.lesson;

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
    setStatus({ phase: 'connecting' });
    setWaitingForTutor(false);
    setDiagnostics(null);
    diagRef.current = emptyDiagnostics();
    heardAgentRef.current = false;
    sessionOpenedRef.current = false;
    typingPingAt.current = null;
    setTurns([]);
    setThinking(false);
    setMicOpen(false);
    clearWatchdog();
    try {
      // Checked before anything else: with no microphone API there is nothing to
      // connect for, and the failure deep inside the client would be unreadable.
      if (mode !== 'convo-text' && micApiUnavailable()) throw new Error('navigator.mediaDevices is unavailable');

      const authStartedAt = Date.now();
      const headers = await authHeaders();
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
      diagRef.current.tokenStatus = res.status;
      diagRef.current.tokenMs = Date.now() - tokenStartedAt;
      diagRef.current.tokenServerTiming = res.headers.get('server-timing');

      if (res.status === 402) {
        const body = (await res.json()) as { message?: string };
        setStatus({ phase: 'out-of-minutes', message: body.message ?? 'You are out of minutes.' });
        return;
      }
      if (!res.ok) throw new TokenServerError(res.status);

      const grant = (await res.json()) as { token: string; livekitUrl: string };
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
      roomRef.current = room;

      // The tutor's voice arrives as a remote audio track. livekit-client never
      // auto-plays: without an explicit attach the session is a one-way call —
      // the learner is heard and hears nothing back.
      room.on(RoomEvent.TrackSubscribed, (track) => {
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
        diagRef.current.agentJoined = true;
        trace('participant-joined', { identity: participant.identity });
      });
      // The MONTER tap usually carries user activation through connect, but a slow
      // token fetch can outlive it and the browser then blocks playback. Surface
      // that as a tap-to-listen affordance rather than playing silence.
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        setAudioBlocked(!room.canPlaybackAudio);
      });

      room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
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
        // `speaking`, `transcript` and `feedback` deliberately do not count —
        // an agent hung inside its TTS emits `speaking` and nothing more.
        if (!sessionOpenedRef.current && openingTags.has(msg.t)) {
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
            void journalRecap(msg.recap, { profile: msg.profile });
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

      // Text mode carries no audio in either direction: no microphone to
      // request (the whole point — the train carriage, the denied permission)
      // and nothing the agent will ever speak.
      if (mode !== 'convo-text') {
        await ensureAudioSession();
      }
      const connectStartedAt = Date.now();
      await room.connect(grant.livekitUrl, grant.token, CONNECT_TIMEOUTS);
      diagRef.current.connectMs = Date.now() - connectStartedAt;
      trace('connected', { connectMs: diagRef.current.connectMs });
      if (mode !== 'convo-text') {
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
    openingTags,
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

  // Never leave a microphone open past the component that owns it.
  useEffect(() => {
    return () => {
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
