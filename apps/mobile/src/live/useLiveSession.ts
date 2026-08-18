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

import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import {
  decodeServerMessage,
  encodeMessage,
  TOPIC_CLIENT,
  TOPIC_SERVER,
  type ClientMessage,
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
import { classifyFailure, failureCopy, micApiUnavailable, TokenServerError, type LiveFailure } from './failure.ts';

/** Where the token server lives. Configurable per env for device testing. */
const TOKEN_SERVER = process.env.EXPO_PUBLIC_TOKEN_SERVER_URL ?? 'http://localhost:8787';

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
  convo: new Set(['convo', 'topics', 'recap']),
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
   * Free conversation's opening moment: the tutor's spoken question and the
   * tappable topic chips. Cleared the instant the first scene view arrives.
   */
  topics: { prompt: { fr: string; en: string }; chips: { label: string; en: string; value: string }[] } | null;
  /** Free conversation's end card, plus the updated profile blob to persist. */
  recap: { recap: RecapPayload; profile: unknown } | null;
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
  /** True while the browser refuses playback until it sees a user gesture. */
  audioBlocked: boolean;
  /**
   * True once the room is open but before the tutor has said anything. The
   * screens render a waiting state rather than an unexplained spinner.
   */
  waitingForTutor: boolean;
  /** Filled in when a session fails. Null otherwise. */
  diagnostics: LiveDiagnostics | null;
  /** Restart playback — call from a tap so the gesture satisfies autoplay policy. */
  resumeAudio: () => void;
  start: () => Promise<void>;
  sendHelp: () => void;
  sendSkip: () => void;
  /** Ask the agent to replay the current line in the tutor's voice. */
  sendHear: () => void;
  /** Choose a conversation topic by tapping its chip. */
  sendTopic: (value: string) => void;
  /** Ask the tutor to say it again slowly, and to stay slow. */
  sendSlower: () => void;
  /** Ask for the current line in English. */
  sendEnglish: () => void;
  /** Text-mode conversation: send a typed learner turn. */
  sendSay: (text: string) => void;
  leave: () => Promise<void>;
}

export function useLiveSession(
  userId: string,
  lessonId: string,
  startRung?: Rung,
  opts?: { mode?: 'lesson' | 'convo' | 'convo-text'; snapshot?: unknown },
): LiveSession {
  const [status, setStatus] = useState<LiveStatus>({ phase: 'idle' });
  const [prompt, setPrompt] = useState<SessionPrompt | null>(null);
  const [feedback, setFeedback] = useState<TurnFeedback | null>(null);
  const [tutorSpeaking, setTutorSpeaking] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [convo, setConvo] = useState<ConvoView | null>(null);
  const [topics, setTopics] = useState<LiveSession['topics']>(null);
  const [recap, setRecap] = useState<{ recap: RecapPayload; profile: unknown } | null>(null);
  const [drills, setDrills] = useState<DrillExercise[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [waitingForTutor, setWaitingForTutor] = useState(false);
  const [diagnostics, setDiagnostics] = useState<LiveDiagnostics | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Destructured so `start` does not churn on every render just because the
  // caller wrote the options object inline.
  const mode = opts?.mode;
  const snapshot = opts?.snapshot;
  const roomRef = useRef<Room | null>(null);
  const diagRef = useRef<LiveDiagnostics>(emptyDiagnostics());
  // The ready retries plus the give-up timer, so both can be cancelled the
  // instant the agent speaks — or the screen goes away.
  const watchdogRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const heardAgentRef = useRef(false);
  const sessionOpenedRef = useRef(false);
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

  const send = useCallback((message: ClientMessage) => {
    // TextEncoder types its output over ArrayBufferLike; livekit-client wants a
    // plain ArrayBuffer. The copy is a few dozen bytes once per tap.
    const bytes = Uint8Array.from(encodeMessage(message));
    void roomRef.current?.localParticipant.publishData(bytes, { topic: TOPIC_CLIENT, reliable: true }).catch(() => {
      // A lost tap is recoverable; the learner can tap again.
    });
  }, []);

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
    clearWatchdog();
    try {
      // Checked before anything else: with no microphone API there is nothing to
      // connect for, and the failure deep inside the client would be unreadable.
      if (mode !== 'convo-text' && micApiUnavailable()) throw new Error('navigator.mediaDevices is unavailable');

      const res = await fetch(`${TOKEN_SERVER}/session/start`, {
        method: 'POST',
        // The bearer token, when auth is live, lets the server verify the
        // asserted userId instead of trusting it. Mock mode adds nothing.
        headers: { 'content-type': 'application/json', ...(await authHeaders()) },
        // The token server signs startRung (and, for free conversation, the mode
        // and learner snapshot) into the join credential, so what the session
        // opens as is not something the client can quietly re-assert.
        body: JSON.stringify({
          userId,
          lessonId,
          ...(startRung !== undefined ? { startRung } : {}),
          ...(mode !== undefined ? { mode } : {}),
          ...(snapshot !== undefined ? { snapshot } : {}),
        }),
      });
      diagRef.current.tokenStatus = res.status;

      if (res.status === 402) {
        const body = (await res.json()) as { message?: string };
        setStatus({ phase: 'out-of-minutes', message: body.message ?? 'You are out of minutes.' });
        return;
      }
      if (!res.ok) throw new TokenServerError(res.status);

      const grant = (await res.json()) as { token: string; livekitUrl: string };
      diagRef.current.livekitUrl = grant.livekitUrl;
      trace('token', { status: res.status, livekitUrl: grant.livekitUrl });

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
            if (msg.final) setLastTranscript(msg.text);
            break;
          case 'summary':
            setSummary(msg.summary);
            setStatus({ phase: 'ended' });
            break;
          case 'convo':
            setConvo(msg.view);
            // The scene has opened; the choosing moment is over. An agent that
            // never sent topics (an older build, say) is also covered — the app
            // renders whatever arrives.
            setTopics(null);
            break;
          case 'topics':
            setTopics({ prompt: msg.prompt, chips: msg.chips });
            break;
          case 'recap':
            setRecap({ recap: msg.recap, profile: msg.profile });
            setStatus({ phase: 'ended' });
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
        await room.localParticipant.setMicrophoneEnabled(true);
        diagRef.current.micPublished = true;
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
  }, [userId, lessonId, startRung, mode, snapshot, send, removeAudioEls, clearWatchdog, leave, fail, openingTags]);

  const resumeAudio = useCallback(() => {
    // Success flips audioBlocked back via AudioPlaybackStatusChanged.
    void roomRef.current?.startAudio().catch(() => {});
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
    topics,
    recap,
    drills,
    notice,
    audioBlocked,
    waitingForTutor,
    diagnostics,
    resumeAudio,
    start,
    sendHelp: useCallback(() => send({ t: 'help' }), [send]),
    sendSkip: useCallback(() => send({ t: 'skip' }), [send]),
    sendHear: useCallback(() => send({ t: 'hear' }), [send]),
    sendTopic: useCallback((value: string) => send({ t: 'topic', value }), [send]),
    sendSlower: useCallback(() => send({ t: 'slower' }), [send]),
    sendEnglish: useCallback(() => send({ t: 'english' }), [send]),
    sendSay: useCallback((text: string) => send({ t: 'say', text }), [send]),
    leave,
  };
}
