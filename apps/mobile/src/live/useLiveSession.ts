/**
 * The live session hook — the app side of the wire protocol.
 *
 * Deliberately thin. The agent owns the ladder, the lesson position, the grading
 * and the rescue timing; this hook connects, publishes the microphone, and renders
 * whatever the agent says to render. If a piece of pedagogy logic ever appears in
 * this file, it is in the wrong place.
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

/** Where the token server lives. Configurable per env for device testing. */
const TOKEN_SERVER = process.env.EXPO_PUBLIC_TOKEN_SERVER_URL ?? 'http://localhost:8787';

export type LiveStatus =
  | { phase: 'idle' }
  | { phase: 'connecting' }
  | { phase: 'live' }
  | { phase: 'out-of-minutes'; message: string }
  | { phase: 'error'; message: string }
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
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Destructured so `start` does not churn on every render just because the
  // caller wrote the options object inline.
  const mode = opts?.mode;
  const snapshot = opts?.snapshot;
  const roomRef = useRef<Room | null>(null);
  // The <audio> elements holding the tutor's voice on web. Owned here so they are
  // guaranteed to leave the document when the session does.
  const audioElsRef = useRef<HTMLMediaElement[]>([]);

  const removeAudioEls = useCallback(() => {
    for (const el of audioElsRef.current) el.remove();
    audioElsRef.current = [];
  }, []);

  const send = useCallback((message: ClientMessage) => {
    // TextEncoder types its output over ArrayBufferLike; livekit-client wants a
    // plain ArrayBuffer. The copy is a few dozen bytes once per tap.
    const bytes = Uint8Array.from(encodeMessage(message));
    void roomRef.current?.localParticipant.publishData(bytes, { topic: TOPIC_CLIENT, reliable: true }).catch(() => {
      // A lost tap is recoverable; the learner can tap again.
    });
  }, []);

  const start = useCallback(async () => {
    setStatus({ phase: 'connecting' });
    try {
      const res = await fetch(`${TOKEN_SERVER}/session/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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

      if (res.status === 402) {
        const body = (await res.json()) as { message?: string };
        setStatus({ phase: 'out-of-minutes', message: body.message ?? 'You are out of minutes.' });
        return;
      }
      if (!res.ok) throw new Error(`token server replied ${res.status}`);

      const grant = (await res.json()) as { token: string; livekitUrl: string };

      ensureLiveKitGlobals();
      const room = new Room();
      roomRef.current = room;

      // The tutor's voice arrives as a remote audio track. livekit-client never
      // auto-plays: without an explicit attach the session is a one-way call —
      // the learner is heard and hears nothing back.
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
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
        setStatus((s) =>
          s.phase === 'ended' || s.phase === 'error' ? s : { phase: 'error', message: 'Connection lost. Your progress is saved.' },
        );
      });

      // Text mode carries no audio in either direction: no microphone to
      // request (the whole point — the train carriage, the denied permission)
      // and nothing the agent will ever speak.
      if (mode !== 'convo-text') {
        await ensureAudioSession();
      }
      await room.connect(grant.livekitUrl, grant.token);
      if (mode !== 'convo-text') {
        await room.localParticipant.setMicrophoneEnabled(true);
        try {
          await room.startAudio();
        } catch {
          // The status-changed handler shows the tap-to-listen plaque.
          setAudioBlocked(!room.canPlaybackAudio);
        }
      }
      setStatus({ phase: 'live' });
      send({ t: 'ready' });
    } catch (err) {
      // A half-started session must not stay half-started: without this the room
      // stays open behind the error screen, the agent keeps teaching an empty
      // call, and the meter keeps counting.
      void roomRef.current?.disconnect().catch(() => {});
      roomRef.current = null;
      removeAudioEls();
      const msg = err instanceof Error ? err.message : '';
      const name = err instanceof Error ? err.name : '';
      setStatus({
        phase: 'error',
        // A speaking app without a microphone cannot run, but the learner should
        // hear that in plain words, not a shrug.
        message: /NotAllowed|Permission|NotFound/i.test(`${name} ${msg}`)
          ? 'Parle needs your microphone to hear you speak. Allow the microphone in your browser and try again.'
          : /fetch/i.test(msg)
            ? 'Could not reach the session server. Is it running?'
            : 'Could not start the session.',
      });
    }
  }, [userId, lessonId, startRung, mode, snapshot, send, removeAudioEls]);

  const leave = useCallback(async () => {
    send({ t: 'leave' });
    await roomRef.current?.disconnect();
    roomRef.current = null;
    removeAudioEls();
    await releaseAudioSession();
  }, [send, removeAudioEls]);

  const resumeAudio = useCallback(() => {
    // Success flips audioBlocked back via AudioPlaybackStatusChanged.
    void roomRef.current?.startAudio().catch(() => {});
  }, []);

  // Never leave a microphone open past the component that owns it.
  useEffect(() => {
    return () => {
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
