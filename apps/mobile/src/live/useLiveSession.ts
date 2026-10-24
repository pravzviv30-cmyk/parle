import type { FirstContribution } from '../onboarding/firstLiveModel.ts';
import { guestLiveBody } from '../onboarding/guestScene.ts';
import { unjoinedLease, disconnectLease, type UnjoinedLease } from './unjoinedLease.ts';
import { attachCorrectionReason } from './correctionReason.ts';
import { analyticsAllowed } from '../analytics/consent.ts';
import { loadConsent } from '../analytics/consentStore.ts';
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
import { scriptedPromptIdentity } from './c2TranscriptPolicy.ts';
import { ConnectionState, Room, RoomEvent, Track, type LocalAudioTrack, type RemoteAudioTrack } from 'livekit-client';
import {
  decodeServerMessage,
  ConversationTextRecorder,
  type ConversationTextLine,
  DEFAULT_TUTOR_VOICE,
  encodeMessage,
  PLANS,
  TOPIC_CLIENT,
  TOPIC_SERVER,
  type ClientMessage,
  type ConvoPhrase,
  type ConvoView,
  type DrillExercise,
  type Plan,
  type PlanSpec,
  type RecapPayload,
  type Rung,
  type SessionPrompt,
  type SessionSummary,
  type StartRefusal,
  type TurnFeedback,
  type TutorVoiceKey,
  type SettlementResult,
  type CanDoEvidence,
} from '@luvani/core';
import { ensureAudioSession, ensureLiveKitGlobals, releaseAudioSession, releaseLiveHold } from './globals.ts';
import { recapMayTakeTheAudio } from './recapAudio.ts';
import { authHeaders } from '../auth/adapter.ts';
import { journalRecap } from './journal.ts';
import { noteCatalogue } from '../wall/catalogue.ts';
import {
  classifyFailure,
  classifyPipelineError,
  failureCopy,
  micApiUnavailable,
  TokenServerError,
  tokenFailureCode,
  type LiveFailure,
} from './failure.ts';
import { pushTurn, type TurnLine } from './turns.ts';
import { nextStart, standDown, startStillOwns, NO_START } from './startOwnership.ts';
import { thinkingAfter } from './thinking.ts';
import { opensSession } from './sessionOpened.ts';
import { afterDismiss } from './safetyState.ts';
import { modeCarriesAudio, publishesMicAtConnect } from '../tutor/choosingView.ts';
import { stoppedBySafety, type SafetyDecision } from '../tutor/safetyView.ts';
import { shouldPingTyping } from '../tutor/typingPing.ts';
import type { ReplayLine } from '../tutor/sceneControls.ts';
import { onUserScopeReset } from '../storage/scope.ts';
import { createReplyLatencyClock, medianMs } from './replyLatency.ts';
import { refusalRefill, refusalWords } from './refusalRefill.ts';


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

/** No audio track in the room: before a microphone is published or the tutor is heard, and in every typed session. */
const NO_TRACKS: LiveSession['audioTracks'] = { mic: null, tutor: null };

/**
 * The analytics consent a start or release sends, read safely.
 *
 * A guest has no signed-in user, and the consent store lives behind the auth
 * gate: `loadConsent` throws synchronously there, before it returns a promise,
 * so a `.catch` chained on its call never caught it and a signed-out guest scene
 * failed before its token request. The guest body never uses consent, so a
 * guest does not read it at all; a signed-in read is wrapped so a synchronous
 * throw becomes null too.
 */
function readConsent(guest: boolean): Promise<Awaited<ReturnType<typeof loadConsent>> | null> {
  if (guest) return Promise.resolve(null);
  return Promise.resolve().then(loadConsent).catch(() => null);
}

/**
 * Hand the account's session lease back when the tutor never turned up.
 *
 * A grant takes a thirty-minute lease so one account cannot run two sessions at
 * once, and only the agent's /session/end gives it back. An agent that never
 * joined can never call it, so the learner was told the truth — nothing was
 * counted against their minutes — and then refused their own next attempt for
 * half an hour by a session that never happened, with a screen blaming their
 * sign-in. This is the one lease call the app makes, and it is the way out.
 *
 * Fire and forget, and deliberately silent on failure. It runs while the
 * learner is already being shown an error, so its own network trouble has
 * nothing useful to add: the lease lapses on its own TTL either way, and the
 * only thing a second error screen could do is make the first one wrong.
 */
async function abandonSession(userId: string, sessionId: string): Promise<void> {
  try {
    const [headers, consent] = await Promise.all([authHeaders(), readConsent(false)]);
    const res = await fetch(`${TOKEN_SERVER}/session/abandon`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ userId, sessionId }),
    });
    trace('abandoned', { status: res.status });
  } catch (err: unknown) {
    trace('abandon-failed', { error: String(err) });
  }
}

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
  /** Recent waits from a confirmed learner turn to the tutor's voice. See replyLatency.ts. */
  replyLatencyMs: number[];
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
    replyLatencyMs: [],
  };
}

/** One stable prefix so a developer can filter the console to just this. */
function trace(event: string, detail?: Record<string, unknown>): void {
  console.info(`[luvani:live] ${event}`, detail ?? {});
}

/* ─────────────────────────────────────────────────── the 402, and what it means
 *
 * The token server refuses a session it will not grant with a 402 carrying
 * three things: a machine-readable reason, a sentence, and its whole plan
 * catalogue. This hook used to cast all of that down to `{ message?: string }`,
 * which threw away the reason and the catalogue at the door and rendered the
 * sentence raw.
 *
 * Both halves of that were wrong. The catalogue is the only thing a paywall can
 * be built out of, and the sentence is written for whoever is reading a log:
 * one of them says "The introductory minutes for this installation have already
 * been used by another account", which is an internal noun and an accusation
 * shown to somebody who has done nothing, and another counts down the seconds
 * left. `failure.ts` already refuses to render the server's prose for every
 * other 4xx and answers from a closed local table instead; the 402 was the one
 * path that escaped that rule. This is the rule, extended to it.
 */

/**
 * Why the session was refused, spelled exactly as the wire spells it.
 *
 * The two `StartRefusal` values are `canStartSession`'s own and reach us as
 * `error` on the body. `trial already claimed` is the token server's, from the
 * one-free-allowance-per-device check it makes before it asks about minutes at
 * all (one free allowance per device, REV-001).
 * `unknown` covers a refusal newer than this build, including a body that will
 * not parse: the status alone is enough to know a session was refused over
 * minutes, and a learner should never meet a blank screen because a field moved.
 *
 * One name per refusal rather than ours and theirs, so nothing has to be kept in
 * step. A fourth reason added to core does not compile until the table below
 * says what the learner is told about it.
 */
export type OutOfMinutesCode = StartRefusal | 'trial already claimed' | 'unknown';

interface OutOfMinutesCopy {
  /** The heading over the sentence. */
  label: string;
  /** One or two plain sentences. Never a number, never a reproach, never a price. */
  message: string;
}

/**
 * What we say, per refusal. `failure.ts`'s table, in the shape it uses.
 *
 * Three rules, and every one of them is load-bearing at the most pressurable
 * moment this product has. No number, because a countdown is a scarcity
 * mechanic and PRODUCT.md refuses one. No blame, because none of these is the
 * learner's doing. And nothing about buying: the store has no product yet, the
 * paywall ships dark until it does, and a sentence offering a purchase would be
 * a button that is not on the screen. What a purchase costs is the store's own
 * localized string when there is one, and never a number written here.
 */
const OUT_OF_MINUTES: Record<OutOfMinutesCode, OutOfMinutesCopy> = {
  // One code, two situations: a trial that is finished and a month that is
  // spent. The server tells them apart in prose we do not render, and the
  // catalogue does not say which plan the learner is on, so this sentence has
  // to be true of both. It is.
  exhausted: {
    label: 'Out of minutes',
    message:
      'You have used all the speaking time on your account for now. Practice and review work offline, so you can carry on there and come back to a conversation later.',
  },
  // The server's version of this one counts out the seconds, which is the
  // clearest reason of all four not to render what it wrote.
  'insufficient-for-session': {
    label: 'Not enough for a session',
    message:
      'There is a little speaking time left, but not quite enough for a whole conversation. Starting one now would end it partway through. Practice and review work offline, so you can carry on there.',
  },
  'subscription-lapsed': {
    label: 'Speaking plan ended',
    message:
      'Your previous speaking plan has ended. Practice and review still work offline, and the store can add more speaking time when you want it.',
  },
  // F168, and the reason it stayed open: the server's sentence names an
  // internal noun and accuses the reader of using somebody else's minutes. The
  // learner in front of it has usually done nothing at all, so this says what
  // is true, says it is not their fault, and stops.
  'trial already claimed': {
    label: 'Free conversation already used',
    message:
      'The free conversation on this device is already in use. Each device has one free allowance, so there is none waiting here for this account. Nothing is wrong on your side, and practice and review work offline.',
  },
  unknown: {
    label: 'Out of minutes',
    message:
      'Luvani cannot start a session on this account right now, and it is about minutes rather than anything you did. Practice and review work offline, so you can carry on there.',
  },
};

/**
 * The refusal the body names, or `unknown`.
 *
 * `Object.hasOwn` rather than `in`, because `in` walks the prototype chain and
 * would accept `toString` as a refusal and then hand the screen a function.
 */
function refusalCode(body: unknown): OutOfMinutesCode {
  const named = (body as { error?: unknown } | null)?.error;
  return typeof named === 'string' && Object.hasOwn(OUT_OF_MINUTES, named) ? (named as OutOfMinutesCode) : 'unknown';
}

/**
 * The plan catalogue the refusal carried, or null.
 *
 * Whole or nothing. A paywall drawn from a half catalogue renders holes, and a
 * body shaped differently from what this build expects is not something to
 * guess at — `null` means "there is nothing to offer from", which is also the
 * honest answer when the body never arrived.
 *
 * `priceUsd` rides along because it is part of the payload and dropping fields
 * at the door is the defect this replaces. It is our unit-economic model's own
 * number in dollars, not a price anybody may be shown: a purchase price comes
 * from the store's localized string or from nowhere.
 */
function plansIn(body: unknown): Record<Plan, PlanSpec> | null {
  const offered = (body as { plans?: unknown } | null)?.plans;
  if (typeof offered !== 'object' || offered === null) return null;
  const table = offered as Record<string, unknown>;
  for (const id of Object.keys(PLANS)) {
    const spec = table[id];
    if (typeof spec !== 'object' || spec === null) return null;
    const { label, secondsPerPeriod } = spec as Partial<PlanSpec>;
    if (typeof label !== 'string' || typeof secondsPerPeriod !== 'number') return null;
  }
  return offered as Record<Plan, PlanSpec>;
}

export type LiveStatus =
  | { phase: 'idle' }
  | { phase: 'connecting' }
  | { phase: 'live' }
  /**
   * Refused over minutes. Everything a paywall needs and nothing the server
   * wrote: `code` says which refusal it was, `plans` is the catalogue it came
   * with (null when there was none to read), and `label` and `message` are this
   * app's own words for it.
   */
  | {
      phase: 'out-of-minutes';
      code: OutOfMinutesCode;
      label: string;
      message: string;
      plans: Record<Plan, PlanSpec> | null;
    }
  | { phase: 'error'; failure: LiveFailure; message: string; canType: boolean }
  | { phase: 'ended' };

export interface LiveSession {
  pauseMic: () => Promise<boolean>;
  partialTranscript: string | null;
  /** Entire received thread, memory only; null for overflow, incomplete rooms or safety stops. */
  conversationText: readonly ConversationTextLine[] | null;
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
  /** Persistent server-confirmed settlement; never inferred from leaving. */
  settlement: SettlementResult | null;
  canDoEvidence: CanDoEvidence | null;
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
   * The room's two audio tracks, for the orb to measure (`live/RoomLevels`):
   * the learner's published microphone and the tutor's voice.
   *
   * Handed over when a track is published or subscribed and taken back when it
   * goes, so this changes a handful of times a session and never per audio
   * frame; the levels themselves never pass through React state. Both null in a
   * typed session, and the microphone stays null until the circle is tapped.
   */
  audioTracks: { mic: LocalAudioTrack | null; tutor: RemoteAudioTrack | null };
  /**
   * True once this session is publishing a microphone.
   *
   * A free conversation connects with it closed and opens it when the learner
   * taps the circle, so this is what the circle reads to know which of the two
   * things it is: an invitation, or the learner's own turn.
   */
  micOpen: boolean;
  /**
   * True once this session has gone quiet, in the room it is already in.
   *
   * Not the same question as `micOpen`, which is false for a whole spoken
   * conversation until the circle is tapped. This one says the learner has
   * chosen to type: the microphone is down and the tutor has been asked to stop
   * speaking. The screens read it to draw the typed row without needing to
   * remember, on their own, which of the two things a closed microphone means.
   */
  voiceless: boolean;
  /**
   * True while livekit-client is putting a dropped connection back together.
   *
   * A blip is not a failure, and until now it was rendered as nothing at all:
   * the room went quiet, the tutor stopped answering, and the screen carried on
   * looking live. The learner deserves to know the difference between the tutor
   * thinking and the network being away.
   */
  reconnecting: boolean;
  /**
   * True once the room is open but before the tutor has said anything. The
   * screens render a waiting state rather than an unexplained spinner.
   */
  waitingForTutor: boolean;
  /** Filled in when a session fails. Null otherwise. */
  diagnostics: LiveDiagnostics | null;
  /**
   * The server's id for the session this screen holds, from its grant.
   *
   * Read-only, and null until a grant for the current start has arrived; every
   * new start clears it first, so a rebuilt session never reports the old id.
   * It proves only that a grant was issued, not that a room opened or a tutor
   * spoke: a caller that records a room as started must also wait for a view.
   */
  sessionId: string | null;
  /** Restart playback — call from a tap so the gesture satisfies autoplay policy. */
  resumeAudio: () => void;
  /**
   * Publish the microphone. Call it from a tap: the circle is where a learner
   * agrees to be heard, and on the web the gesture is also what the browser
   * wants before it will hand over a device.
   */
  openMic: () => Promise<boolean>;
  /**
   * Go quiet without leaving the room.
   *
   * The quiet twin used to cost a whole session: mode was fixed when the grant
   * was minted, so a learner who boarded a train, or whose transcription vendor
   * dropped out mid-scene, had to end the conversation and start another one to
   * stop speaking — and was then refused by their own thirty-minute lease. This
   * takes the microphone down, tells the agent to stop speaking, and keeps
   * everything else: the same room, the same scene, the same meter, no grant.
   *
   * Returns true when the switch happened in this room, and false when there is
   * no room to switch in — a session that failed before it connected, say. False
   * is the caller's cue to use the cold-start path and open a typed session from
   * scratch, which is the only case that still needs one.
   *
   * The mode frame itself is fire and forget. The agent reads `voiceless`
   * strictly and a frame it cannot read moves nothing, so a lost one leaves the
   * learner exactly where they were with the control still there to tap again.
   */
  switchToText: () => boolean;
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
  /** Median phone-measured reply wait this session, or null before any was measured. */
  replyLatencyMs: () => number | null;
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
    guestToken?: string;
    onConfirmedContribution?: (turn: FirstContribution) => void;
    mode?: 'lesson' | 'convo' | 'convo-text' | 'lesson-text';
    noTypedRecovery?: boolean;
    /**
     * Listen only: a voiced mode whose microphone stays closed at connect. The
     * tutor speaks as usual and the learner answers by typing or tapping. Not
     * sent anywhere; the server and the agent see an ordinary voiced session.
     */
    listenOnly?: boolean;
    snapshot?: unknown;
    /**
     * What the learner asked to talk about, when a topic card started this.
     * Both strings, both non-empty, or nothing: the server drops a malformed
     * seed and opens a generic session rather than refusing, because a bad
     * hint must never strand anyone, but that is not a reason to send blanks.
     */
    seedTopic?: { fr: string; en: string };
    /** Owner-scoped lookup on the server; no stored conversation text is sent. */
    continuationPackId?: string;
    /**
     * Which authored mission this session is, when a mission card started it.
     * It rides the same pipe `seedTopic` rides, into the join token and on to
     * the agent, which opens the scene straight from the authored frame. A
     * session with no mission opens exactly as it always has.
     */
    missionId?: string;
    /**
     * Which of the catalogue voices this learner chose.
     *
     * Optional to the caller and never optional on the wire. It is resolved to
     * the default below and sent on every start, the default included, because
     * the app has a picker and the agent has a fallback and the one thing they
     * must not do is disagree about what "unchosen" means. Sending nothing
     * would leave that agreement resting on two independently written defaults
     * in two repos' worth of process.
     *
     * A key, never a vendor id. The ids exist in one process, the agent, and
     * this value has to survive a signed token and a stored profile.
     */
    tutorVoice?: TutorVoiceKey;
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
  const [canDoEvidence, setCanDoEvidence] = useState<CanDoEvidence | null>(null);
  const evidenceSessionRef = useRef<string | null>(null);
  const [settlement, setSettlement] = useState<SettlementResult | null>(null);
  const terminalFailureRef = useRef(false);
  const [safety, setSafety] = useState<SafetyDecision | null>(null);
  const [turns, setTurns] = useState<TurnLine[]>([]);
  const conversationTextRef = useRef(new ConversationTextRecorder());
  useEffect(() => onUserScopeReset(() => {
    conversationTextRef.current.clear();
    setTurns([]);
    setPartialTranscript(null);
    confirmedIds.current.clear();
    terminalFailureRef.current = false;
    setSettlement(null);
    setCanDoEvidence(null);
    evidenceSessionRef.current = null;
  }), []);
  const [thinking, setThinking] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [micOpen, setMicOpen] = useState(false);
  const [voiceless, setVoiceless] = useState(false);
  const [audioTracks, setAudioTracks] = useState<LiveSession['audioTracks']>(NO_TRACKS);
  // F763: the microphone this session published has been confirmed closed after
  // the recap arrived. Read by the effect that gives the recap back its sound.
  const [micClosedAtRecap, setMicClosedAtRecap] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [waitingForTutor, setWaitingForTutor] = useState(false);
  const [diagnostics, setDiagnostics] = useState<LiveDiagnostics | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A transport result belongs to the typed input that started it, even when
  // another input is sent in the same room before that result returns.
  const typedSendRevision = useRef(0);
  // Destructured so `start` does not churn on every render just because the
  // caller wrote the options object inline.
  const guestToken = opts?.guestToken;
  const contributionCallback = useRef(opts?.onConfirmedContribution);
  contributionCallback.current = opts?.onConfirmedContribution;
  const confirmedIds = useRef(new Set<string>());
  const [partialTranscript, setPartialTranscript] = useState<string | null>(null);
  const captureQueue = useRef<Promise<unknown>>(Promise.resolve());
  const mode = opts?.mode;
  const noTypedRecovery = opts?.noTypedRecovery ?? false;
  const listenOnly = opts?.listenOnly ?? false;
  const snapshot = opts?.snapshot;
  const seedTopic = opts?.seedTopic;
  const continuationPackId = opts?.continuationPackId;
  const missionId = opts?.missionId;
  const tutorVoice = opts?.tutorVoice;
  const roomRef = useRef<Room | null>(null);
  const leaseRef = useRef<UnjoinedLease | null>(null);
  const diagRef = useRef<LiveDiagnostics>(emptyDiagnostics());
  const replyClock = useRef(createReplyLatencyClock());
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
  // Voiceless again, as a ref, for the same reason: the data handler is built
  // once at connect time, and the `error` case has to know whether this learner
  // is still listening before it decides an audio failure is worth their
  // attention. State for the screens, ref for the wire, assigned together.
  const voicelessRef = useRef(false);
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

  const addTurn = useCallback((line: Omit<TurnLine, 'id'>, confirmedId?: string) => {
    turnSeq.current += 1;
    const id = confirmedId ?? `t${turnSeq.current}`;
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
  const teardownRoom = useCallback(async () => {
    // First, because everything below only tears down what has been built so
    // far. A start still waiting on a token has built nothing yet and would
    // sail straight past all of it, open a room a minute later, and leave the
    // tutor teaching an empty call at full price. This is the line that tells
    // it the session is no longer its to open.
    const closingGeneration = nextStart(startGenRef.current);
    startGenRef.current = closingGeneration;
    clearWatchdog();
    const room = roomRef.current;
    const lease = leaseRef.current;
    send({ t: 'leave' });
    await disconnectLease(room, lease);
    // A newer start owns the shared audio refs and native session now.
    if (closingGeneration !== startGenRef.current) return;
    if (roomRef.current === room) roomRef.current = null;
    if (leaseRef.current === lease) leaseRef.current = null;
    removeAudioEls();
    await releaseAudioSession();
  }, [send, removeAudioEls, clearWatchdog]);

  const leave = useCallback(async () => {
    const closing = teardownRoom();
    conversationTextRef.current.clear();
    await closing;
  }, [teardownRoom]);

  /** Send the wrap-up tag and keep the room open for the answer. */
  const requestRecap = useCallback(() => {
    send({ t: 'leave' });
  }, [send]);

  /**
   * The session is over, so the microphone closes before the recap shows (F763).
   *
   * The room stays open behind the recap, because the enriched profile and the
   * drills arrive over it seconds later, and the microphone used to stay
   * published with it until the learner tapped Done: a recap read with the
   * microphone still live, and with the room's hold on the audio focus keeping
   * the recap's own moment silent. The circle is told first, so nothing on the
   * recap reads an open microphone; the close is confirmed before the recap is
   * allowed its sound (the effect below `recapMayTakeTheAudio`). A close that
   * fails keeps the hold, and `leave()` still ends both. A close confirmed after
   * the learner left, or after another start took the session, belongs to a
   * room that is gone and is not reported, so it can never give away the hold
   * a newer room took.
   *
   * Closed means the capture has stopped, not only that nothing is sent
   * (F777). `setMicrophoneEnabled(false)` mutes the published track and leaves
   * the device recording, so the iPhone's microphone indicator stayed on over
   * the recap. Once the mute lands, the microphone track is unpublished and
   * stopped; that is what lets the device go. A later `openMic` or `start`
   * makes a new track, as a first one does.
   */
  const closeMicForRecap = useCallback(() => {
    const room = roomRef.current;
    diagRef.current.micPublished = false;
    setMicOpen(false);
    if (room === null) return;
    const closingGeneration = startGenRef.current;
    const participant = room.localParticipant;
    void participant
      .setMicrophoneEnabled(false)
      .then(() => {
        const mic = participant.getTrackPublication(Track.Source.Microphone)?.track;
        return mic === undefined ? undefined : participant.unpublishTrack(mic, true);
      })
      .then(() => {
        if (roomRef.current !== room || closingGeneration !== startGenRef.current) return;
        trace('mic-closed-for-recap');
        setMicClosedAtRecap(true);
      })
      .catch((err: unknown) => {
        trace('mic-close-failed', { error: String(err) });
      });
  }, []);

  const fail = useCallback((failure: LiveFailure) => {
    const copy = failureCopy(failure);
    diagRef.current.lastFailure = failure;
    setDiagnostics({ ...diagRef.current });
    setWaitingForTutor(false);
    // Whatever this is, it is not a connection coming back.
    setReconnecting(false);
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
    // The account's session lease, once this attempt has taken one. A grant
    // acquires it before anyone joins the room, and only the agent's /session/end
    // gives it back — so an attempt that gets a grant and then fails to connect,
    // or is walked away from before a tutor joins, has to hand it back itself, or
    // the learner is refused their own next session for the thirty-minute lease.
    // That is F165. Released only while no tutor is in the room: once one has
    // joined it owns the session and will end it, and freeing a lease out from
    // under a live tutor is how one account comes to run two — the same rule the
    // give-up watchdog keeps for 'agent-silent'. Cleared on release so a second
    // teardown on the same attempt hands nothing back twice.
    let ownedLease: UnjoinedLease | null = null;
    const releaseHeldLease = (): void => {
      ownedLease?.release();
      if (leaseRef.current === ownedLease) leaseRef.current = null;
    };
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
      if (plan.disconnectRoom) {
        try { await disconnectLease(opened, ownedLease); } catch { return true; }
      }
      if (plan.releaseAudioSession) await releaseAudioSession().catch(() => {});
      // The grant this attempt took goes back with it: a start given up before a
      // tutor joined must not leave the account holding a lease nobody will end.
      releaseHeldLease();
      return true;
    };
    terminalFailureRef.current = false;
    setSettlement(null);
    setCanDoEvidence(null);
    evidenceSessionRef.current = null;
    setStatus({ phase: 'connecting' });
    setWaitingForTutor(false);
    setDiagnostics(null);
    // A new start is a new session: the old grant's id must not survive into it.
    setSessionId(null);
    diagRef.current = emptyDiagnostics();
    replyClock.current = createReplyLatencyClock();
    heardAgentRef.current = false;
    sessionOpenedRef.current = false;
    typingPingAt.current = null;
    // The one thing that clears a stop, and it is not a dismissal: a rebuilt
    // session is a different session, decided about separately.
    safetyRef.current = null;
    setSafety(null);
    setTurns([]);
    setPartialTranscript(null);
    confirmedIds.current.clear();
    // The last room's view goes with its turns: a rebuilt session is a new one,
    // and it is open only once its own agent publishes a view (Stage 4).
    setConvo(null);
    conversationTextRef.current.clear();
    setThinking(false);
    setMicOpen(false);
    setMicClosedAtRecap(false);
    setAudioTracks(NO_TRACKS);
    setReconnecting(false);
    // A rebuilt session opens as whatever its mode says, and the mode is signed
    // into the grant. Carrying the last session's quiet across would be the app
    // asserting a mode the token server never granted.
    voicelessRef.current = false;
    setVoiceless(false);
    // A start that lands on top of a session that already opened takes the old
    // room with it. Nobody else will: the slot below is about to be overwritten,
    // and a room with no reference left to it is a room nobody disconnects while
    // the tutor keeps teaching it. ConvoScreen restarts exactly this way when a
    // learner switches to typing. The old room's own handlers are already deaf
    // by now, because the generation moved above.
    const previous = roomRef.current;
    const previousLease = leaseRef.current;
    roomRef.current = null;
    leaseRef.current = null;
    void disconnectLease(previous, previousLease).catch(() => {});
    removeAudioEls();
    clearWatchdog();
    try {
      // First, and before the guard below reads it: on iOS and Android there is
      // no `navigator.mediaDevices` until `registerGlobals()` has installed the
      // WebRTC primitives, and this is the only call site that runs it. Asking
      // whether a microphone exists before installing the shim that provides it
      // answers "no" on every phone with a perfectly good microphone. A browser
      // already has mediaDevices, which is why web never saw this.
      //
      // Ungated by mode on purpose: it is idempotent, and every mode builds a
      // Room that needs RTCPeerConnection whether or not it carries audio.
      ensureLiveKitGlobals();

      // Checked before anything else, and only for the modes that need one:
      // with no microphone API a spoken session has nothing to connect for, and
      // the failure deep inside the client would be unreadable.
      //
      // Asked of the mode table rather than as `mode !== 'convo-text'`, which
      // refused the typed lesson outright on a device with no mediaDevices —
      // precisely the learner that mode was built for.
      if (modeCarriesAudio(mode) && micApiUnavailable()) throw new Error('navigator.mediaDevices is unavailable');

      const authStartedAt = Date.now();
      const [headers, consent] = await Promise.all([authHeaders(), readConsent(!!guestToken)]);
      // Checked before the diagnostics are written, not after: the diagnostics
      // describe the session on screen, and this attempt may no longer be it.
      if (await abandoned()) return;
      diagRef.current.authMs = Date.now() - authStartedAt;
      const tokenStartedAt = Date.now();
      const res = await fetch(`${TOKEN_SERVER}${guestToken ? '/onboarding/live' : '/session/start'}`, {
        method: 'POST',
        // The bearer token, when auth is live, lets the server verify the
        // asserted userId instead of trusting it. Mock mode adds nothing.
        headers: { 'content-type': 'application/json', ...headers, ...(guestToken ? { 'x-luvani-guest': guestToken } : {}) },
        // The token server signs startRung (and, for free conversation, the mode
        // and learner snapshot) into the join credential, so what the session
        // opens as is not something the client can quietly re-assert.
        // A guest scene grant names its mode (lesson or lesson-text); the older
        // guest conversation still sends an empty body. See onboarding/guestScene.ts.
        body: JSON.stringify(guestToken ? guestLiveBody(mode) : {
          userId,
          analyticsAllowed: analyticsAllowed(consent),
          lessonId,
          ...(startRung !== undefined ? { startRung } : {}),
          ...(mode !== undefined ? { mode } : {}),
          ...(snapshot !== undefined ? { snapshot } : {}),
          ...(seedTopic !== undefined ? { seedTopic } : {}),
          ...(continuationPackId !== undefined ? { continuationPackId } : {}),
          ...(missionId !== undefined ? { missionId } : {}),
          // Not a conditional spread, and that is the point of F291. Every
          // other field here is absent when it has nothing to say; this one is
          // always present, resolved, so the token server signs a voice the
          // learner can actually be shown to have.
          tutorVoice: tutorVoice ?? DEFAULT_TUTOR_VOICE,
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
        // Read whole, and kept whole. A body that will not parse is still a
        // 402: the refusal is the status, not the payload, and throwing here
        // would put a connection error in front of a learner whose connection
        // is fine.
        const body: unknown = await res.json().catch(() => null);
        if (await abandoned()) return;
        const code = refusalCode(body);
        // A free refusal may name when the conversation comes back (REV-001).
        const copy = refusalWords(OUT_OF_MINUTES[code], refusalRefill(body));
        const plans = plansIn(body);
        // Kept for the wall, which needs it on a page this refusal can lead to.
        noteCatalogue(plans);
        trace('out-of-minutes', { code, plans: plans !== null });
        setStatus({ phase: 'out-of-minutes', code, label: copy.label, message: copy.message, plans });
        return;
      }
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        if (await abandoned()) return;
        throw new TokenServerError(res.status, tokenFailureCode(res.status, body));
      }

      // sessionId rides along because the lease is keyed on it: it is what
      // /session/abandon compares against before releasing anything, which is
      // what stops one caller freeing another's session.
      const grant = (await res.json()) as { token: string; livekitUrl: string; sessionId: string };
      // The catalogue rides the grant as well as the refusal (F514), so a learner
      // who has started a session has seen what a plan buys without having to be
      // turned away first. Parsed by the same validator either way.
      noteCatalogue(plansIn(grant));
      // From here this attempt holds the account's session lease, keyed on this
      // sessionId. If it never reaches a room with a tutor in it, the teardown
      // paths below hand it back; see releaseHeldLease. F165.
      ownedLease = unjoinedLease(grant.sessionId, id => { if (!guestToken) void abandonSession(userId, id); });
      if (owns()) leaseRef.current = ownedLease;
      // The last gate before a room exists at all. Everything past here has to
      // be given back rather than simply skipped.
      if (await abandoned()) return;
      // Published only once this attempt still owns the session, and only when
      // the grant actually named one; nothing here invents an id.
      evidenceSessionRef.current = grant.sessionId;
      setSessionId(typeof grant.sessionId === 'string' && grant.sessionId !== '' ? grant.sessionId : null);
      diagRef.current.livekitUrl = grant.livekitUrl;
      trace('token', {
        status: res.status,
        livekitUrl: grant.livekitUrl,
        authMs: diagRef.current.authMs,
        tokenMs: diagRef.current.tokenMs,
        serverTiming: diagRef.current.tokenServerTiming,
      });

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
        // The orb measures the tutor's voice from this track, on a phone as well
        // as in a browser, so it is handed over before the web-only attach.
        const tutor = track as RemoteAudioTrack;
        setAudioTracks((tracks) => ({ ...tracks, tutor }));
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
        // Taken back from the orb only if it is the track the orb was given, so
        // an abandoned room cannot clear the session the learner is in now.
        setAudioTracks((tracks) => (tracks.tutor !== null && tracks.tutor === track ? { ...tracks, tutor: null } : tracks));
        if (typeof document === 'undefined') return;
        for (const el of track.detach()) {
          el.remove();
          audioElsRef.current = audioElsRef.current.filter((kept) => kept !== el);
        }
      });
      // The learner's microphone, for the orb's listening ring: handed over when
      // it is published (at connect, or when the circle is tapped) and taken
      // back when it goes. Never per frame; the levels are RoomLevels' business.
      room.on(RoomEvent.LocalTrackPublished, (publication) => {
        if (!owns()) return;
        if (publication.source !== Track.Source.Microphone || publication.track?.kind !== Track.Kind.Audio) return;
        const mic = publication.track as LocalAudioTrack;
        setAudioTracks((tracks) => ({ ...tracks, mic }));
      });
      room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        // Read now: LiveKit empties the publication as soon as this returns,
        // before React runs the updater, and the recap's unpublish (F777)
        // would otherwise leave the stopped track with the orb.
        const gone = publication.track;
        setAudioTracks((tracks) => (tracks.mic !== null && tracks.mic === gone ? { ...tracks, mic: null } : tracks));
      });
      // Whether anyone else is in the room at all. The difference between "the
      // tutor is thinking" and "the tutor was never dispatched" is exactly this.
      room.on(RoomEvent.ParticipantConnected, (participant) => {
        ownedLease?.observeTutor();
        // A tutor walking into an abandoned room is not proof of life for the
        // session on screen, and the watchdog reads this to decide which of the
        // two silences it is looking at.
        if (!owns()) return;
        diagRef.current.agentJoined = true;
        trace('participant-joined', { identity: participant.identity });
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        // LiveKit also rebuilds its roster during a full reconnect, before
        // announcing Reconnecting. Inspect the settled state after that stack.
        queueMicrotask(() => {
          if (!owns() || room.state !== ConnectionState.Connected || room.remoteParticipants.size > 0) return;
          // The worker's lease can end while the learner's WebRTC connection
          // stays open. An empty room cannot accept either speech or typing.
          clearWatchdog();
          setReconnecting(false);
          setMicOpen(false);
          setThinking(false);
          setTutorSpeaking(false);
          setStatus((status) => {
            if (status.phase === 'ended' || status.phase === 'error') return status;
            const copy = failureCopy('dropped');
            return { phase: 'error', failure: 'dropped', message: copy.message, canType: copy.canType };
          });
          // Preserve only an authoritative completed recap for its save-text
          // choice. An incomplete stream still goes with this failed room.
          if (conversationTextRef.current.snapshot() === null) conversationTextRef.current.clear();
          // Stop capture and fence this attempt without erasing a delivered recap.
          void teardownRoom().catch(() => {});
        });
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
        if (topic !== TOPIC_SERVER) return;
        const msg = decodeServerMessage(payload);
        if (!msg) return;
        ownedLease?.observeTutor();
        if (!owns()) return;
        conversationTextRef.current.receive(msg);
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
            // The scripted tutor's received line belongs in the same live
            // transcript as confirmed learner replies. Republished prompts
            // use the existing turn dedupe; this is display history only.
            addTurn({ who: 'tutor', fr: msg.prompt.turn.tutor, frWritten: null, en: msg.prompt.turn.tutorEn }, scriptedPromptIdentity(msg.prompt));
            setFeedback(null);
            break;
          case 'feedback':
            setFeedback(msg.feedback);
            break;
          case 'speaking': {
            setTutorSpeaking(msg.speaking);
            const waited = msg.speaking ? replyClock.current.tutorStartedSpeaking(Date.now()) : null;
            if (waited !== null) {
              diagRef.current.replyLatencyMs = [...replyClock.current.samples];
              trace('reply-latency', { ms: waited, medianMs: medianMs(replyClock.current.samples), turns: replyClock.current.samples.length });
            }
            break;
          }
          case 'transcript':
            if (msg.final) {
              setPartialTranscript(null);
              const confirmedId = msg.turnId ?? `legacy-${turnSeq.current + 1}`;
              if (confirmedIds.current.has(confirmedId)) break;
              confirmedIds.current.add(confirmedId);
              // After the dedupe: a re-sent final is not a new wait.
              replyClock.current.learnerTurnConfirmed(Date.now());
              contributionCallback.current?.({ id: confirmedId, text: msg.text, input: msg.input === 'typed' || msg.input === 'spoken' ? msg.input : 'unknown' });
              setLastTranscript(msg.text);
              addTurn({ who: 'learner', fr: msg.text, frWritten: null, en: msg.input === 'spoken' && msg.interpreted === true ? 'Interpreted from your speech' : null });
            } else setPartialTranscript(msg.text);
            break;
          case 'summary':
            setSummary(msg.summary);
            if (!terminalFailureRef.current) setStatus({ phase: 'ended' });
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
              }, msg.view.textTurnId ? `narration:${msg.view.textTurnId}` : undefined);
            }
            addTurn({
              who: 'tutor',
              fr: msg.view.sceneReply.fr,
              frWritten: msg.view.sceneReply.frWritten ?? null,
              en: msg.view.sceneReply.en,
            }, msg.view.textTurnId ? `tutor:${msg.view.textTurnId}` : undefined);
            // A recast belongs under the learner line it corrects, so it is
            // attached backwards to the last thing the learner said.
            if (msg.view.coachNow.length > 0) {
              setTurns((list) => {
                const i = list.map((t) => t.who).lastIndexOf('learner');
                if (i < 0) return list;
                const next = [...list];
                next[i] = {
                  ...next[i]!,
                  recasts: msg.view.coachNow.map((c, correctionIndex) => ({
                    textTurnId: msg.view.textTurnId,
                    correctionIndex,
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
            if (msg.action === 'stop') { setCanDoEvidence(null); evidenceSessionRef.current = null; }
            break;
          case 'recap':
            // The session has ended, so the microphone closes first and the
            // recap shows second (F763). A stopped session closes it too: the
            // recap of a stop is never drawn, and nobody is listening any more.
            closeMicForRecap();
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
            if (!guestToken && !stoppedBySafety(safetyRef.current)) void journalRecap(msg.recap, { profile: msg.profile });
            setStatus({ phase: 'ended' });
            break;
          case 'practice':
            setPractice(msg.topics);
            break;
          case 'drills':
            setDrills(msg.exercises);
            break;
          case 'correction-reason':
            if (evidenceSessionRef.current === grant.sessionId && !terminalFailureRef.current && !stoppedBySafety(safetyRef.current)) {
              setTurns(lines => attachCorrectionReason(lines, msg.evidence, grant.sessionId));
            }
            break;
          case 'can-do-evidence':
            if (msg.evidence.sessionId === grant.sessionId && evidenceSessionRef.current === grant.sessionId
              && msg.evidence.missionId === missionId && !terminalFailureRef.current && !stoppedBySafety(safetyRef.current)) setCanDoEvidence(msg.evidence);
            break;
          case 'settlement':
            if (terminalFailureRef.current) setSettlement(msg.result);
            break;
          case 'error': {
            if (msg.terminal === true) {
              terminalFailureRef.current = true;
              setCanDoEvidence(null);
              evidenceSessionRef.current = null;
              setSettlement({ kind: 'pending' });
            }
            // Most of these are hiccups that pass: the room, the microphone and
            // the meter are all still running, and replacing a live session with
            // a dead-end screen over a blip loses the conversation the learner
            // was having. Some of them are not. The frame now carries the
            // vendor's own kind and its recoverable flag, and which of the three
            // this is belongs to failure.ts, as a union rather than a flag, so
            // that showing a dead pipeline as a self-clearing notice is not
            // something this handler can do by forgetting an `if`.
            //
            // `spoken` is what the learner can actually feel, not what the mode
            // was granted as: a session that has taken the quiet door has no
            // audio in either direction any more, and telling somebody who is
            // typing that the tutor cannot hear them is the exact lie this
            // classification exists to stop.
            const outcome = classifyPipelineError(msg, {
              spoken: modeCarriesAudio(mode) && !voicelessRef.current,
            });
            if (outcome.severity === 'blocking') {
              console.warn(outcome.log);
              // A room the learner cannot use is a room the meter must not go on
              // counting. Where typing is a real answer the room is worth
              // keeping — it is the room `switchToText` carries on in — and
              // where it is not, the only honest move is to leave.
              if (!msg.terminal && (noTypedRecovery || !failureCopy(outcome.failure).canType)) void leave().catch(() => {});
              fail(outcome.failure);
              break;
            }
            console.info(outcome.log);
            if (outcome.severity === 'silent') break;
            setNotice(outcome.message);
            if (noticeTimer.current) clearTimeout(noticeTimer.current);
            noticeTimer.current = setTimeout(() => setNotice(null), 8000);
            break;
          }
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
        //
        // Reached only once livekit-client has given up reconnecting. The three
        // handlers below are everything before that point, and they are why a
        // blip at minute eight is now a pause rather than a lost session.
        clearWatchdog();
        setReconnecting(false);
        setStatus((s) => {
          if (s.phase === 'ended' || s.phase === 'error') return s;
          const copy = failureCopy('dropped');
          return { phase: 'error', failure: 'dropped', message: copy.message, canType: copy.canType };
        });
      });

      // A blip, and the three states livekit-client publishes on the way through
      // it. None of them is a failure: the client is already rebuilding the
      // connection, and the session on the other side is still there. What was
      // missing was any sign of it — the room went quiet, the tutor stopped
      // answering, and the screen carried on looking live while the learner
      // wondered what they had done.
      //
      // The signal channel alone. Media is still flowing, so the learner may
      // still be able to hear the tutor; what has gone is the path everything
      // else in this file rides on, including every frame the agent sends.
      room.on(RoomEvent.SignalReconnecting, () => {
        trace('signal-reconnecting');
        setReconnecting(true);
      });
      // The whole connection, media included. This is the one the learner feels.
      room.on(RoomEvent.Reconnecting, () => {
        trace('reconnecting');
        setReconnecting(true);
      });
      // Back. The room is the same room and the agent is the same agent, but
      // everything published during the gap is gone: LiveKit does not queue data
      // for a participant who was not there to receive it, so whatever state the
      // agent pushed while we were away was pushed into nothing.
      //
      // `ready` is how this app asks for that state again, and both agent classes
      // answer it by republishing where the session actually is. The replay path
      // has existed on the agent side all along and had never once been
      // triggered, because nothing ever sent a second `ready`.
      //
      // The mode frame rides with it when this session has gone quiet. The agent
      // holds its own voiceless flag and a reconnect does not touch it, but the
      // frame that set it may have been published into the outage that caused
      // this, and a tutor talking aloud at someone who asked for quiet is the one
      // failure of this pair that cannot be undone by waiting.
      room.on(RoomEvent.Reconnected, () => {
        trace('reconnected');
        setReconnecting(false);
        send({ t: 'ready' });
        if (voicelessRef.current) send({ t: 'mode', voiceless: true });
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
      if (room.remoteParticipants.size > 0) ownedLease?.observeTutor();
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
        // because the tutor is about to ask its question out loud. Listen only
        // withdraws the publish and keeps the playback.
        if (publishesMicAtConnect(mode, listenOnly)) {
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
        // The tutor never arrived, so no agent exists that could ever call
        // /session/end, and the account's lease would stand for thirty minutes
        // over a session that never happened. The learner is told nothing was
        // counted against their minutes, taps Back, tries again, and is refused
        // by themselves. This is the release, and it is the only failure that
        // gets it: 'agent-silent' means an agent IS in the room and may still be
        // holding the floor, and freeing a lease out from under a live session
        // is how one account comes to run two.
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
      try { await disconnectLease(opened, ownedLease); } catch { fail(classifyFailure(err)); return; }
      if (roomRef.current === opened) roomRef.current = null;
      removeAudioEls();
      // The grant this attempt took never reached a tutor, so hand the lease
      // back — a connect that threw is the strand F165 was filed for.
      releaseHeldLease();
      fail(classifyFailure(err));
    }
  }, [
    userId,
    guestToken,
    lessonId,
    startRung,
    mode,
    noTypedRecovery,
    listenOnly,
    snapshot,
    seedTopic,
    continuationPackId,
    missionId,
    tutorVoice,
    send,
    removeAudioEls,
    clearWatchdog,
    requestRecap,
    closeMicForRecap,
    leave,
    teardownRoom,
    fail,
    addTurn,
  ]);

  const resumeAudio = useCallback(() => {
    // Success flips audioBlocked back via AudioPlaybackStatusChanged.
    void roomRef.current?.startAudio().catch(() => {});
  }, []);

  const openMic = useCallback(() => {
    const work = captureQueue.current.then(() => {
    const room = roomRef.current;
    if (room === null) return Promise.resolve(false);
    if (room.localParticipant.isMicrophoneEnabled) return Promise.resolve(true);
    const openingGeneration = startGenRef.current;
    return room.localParticipant
      .setMicrophoneEnabled(true)
      .then(() => {
        if (roomRef.current !== room || openingGeneration !== startGenRef.current) {
          void room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
          return false;
        }
        // Kept in step with the diagnostics panel, which reports this. Left
        // false it would make a healthy tap-to-talk session read as broken to
        // whoever debugs it next.
        diagRef.current.micPublished = true;
        trace('mic-opened');
        setMicOpen(true);
        // Coming back from the quiet door. Publishing a microphone IS asking to
        // speak, and a tutor left voiceless would answer in silence for the rest
        // of the session with nothing on screen to say why.
        if (voicelessRef.current) {
          voicelessRef.current = false;
          setVoiceless(false);
          send({ t: 'mode', voiceless: false });
        }
        return true;
      })
      .catch((err: unknown) => {
        // Not a dead end and not a terminal screen: the room, the tutor and the
        // meter are all still running, and the quiet door is on the same screen.
        trace('mic-open-failed', { error: String(err) });
        if (roomRef.current !== room || openingGeneration !== startGenRef.current) return false;
        if (noTypedRecovery) { void leave().catch(() => {}); fail(classifyFailure(err)); return false; }
        setNotice('Your microphone did not open. You can switch to typing instead.');
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(null), 8000);
        return false;
      });
    });
    captureQueue.current = work.catch(() => {});
    return work;
  }, [send, noTypedRecovery, leave, fail]);

  /**
   * The quiet door, taken in the room the learner is already in.
   *
   * Three things, and deliberately not a fourth: the microphone goes down, the
   * agent is told to stop speaking, and the screens are told which of the two
   * kinds of closed microphone this is. No token is fetched, no room is built
   * and no grant is asked for, which is the whole point — the rebuild this
   * replaces asked the token server for a second session while the first one's
   * thirty-minute lease was still standing, and got the learner refused by
   * themselves for taking a door the app had just offered them.
   *
   * The error screen is cleared on the way through, because a blocking vendor
   * failure leaves the room open exactly so this door works: the learner tapped
   * "Continue by typing" and the session they are continuing is this one.
   */
  const pauseMic = useCallback((): Promise<boolean> => {
    const work = captureQueue.current.then(async () => {
      const room = roomRef.current;
      if (!room) return false;
      try {
        await room.localParticipant.setMicrophoneEnabled(false);
        const mic = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
        if (mic) await room.localParticipant.unpublishTrack(mic, true);
        if (roomRef.current !== room) return false;
        setMicOpen(false); diagRef.current.micPublished = false;
        return true;
      } catch { setNotice('Your microphone could not pause. Try again.'); return false; }
    });
    captureQueue.current = work.catch(() => {});
    return work;
  }, []);
  const switchToText = useCallback((): boolean => {
    const room = roomRef.current;
    // No room means a session that failed before it connected. Nothing here can
    // help, and saying so is what lets the caller open a typed session properly
    // instead of believing this one carried on.
    if (room === null) return false;
    if (terminalFailureRef.current) return false;
    voicelessRef.current = true;
    setVoiceless(true);
    // Fire and forget in both directions. The agent reads `voiceless` strictly,
    // so a frame it cannot read moves nothing and the control is still there to
    // tap again; and a microphone that will not close is not a reason to keep
    // the learner speaking into it.
    void room.localParticipant.setMicrophoneEnabled(false).catch((err: unknown) => {
      trace('mic-close-failed', { error: String(err) });
    });
    diagRef.current.micPublished = false;
    setMicOpen(false);
    send({ t: 'mode', voiceless: true });
    setStatus((s) => (s.phase === 'error' ? { phase: 'live' } : s));
    trace('switched-to-text');
    return true;
  }, [send]);

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

  // The recap's moment (F763, live/recapAudio.ts). The room held the learner's
  // ears from the moment it took the audio session, so no sound effect played
  // and no control gave a haptic while it was open, and it stays open behind
  // the recap. Once the session has ended, the microphone is confirmed closed
  // and the tutor is quiet, the hold goes and the recap may be felt. A stop
  // keeps it: a stopped session gets no moment. LiveKit's audio session itself
  // is still released by `leave()`.
  const recapArrived = recap !== null;
  const stoppedNow = stoppedBySafety(safety);
  useEffect(() => {
    if (!recapMayTakeTheAudio({ recapArrived, micClosed: micClosedAtRecap, tutorSpeaking, stopped: stoppedNow })) return;
    trace('live-hold-released-for-recap');
    releaseLiveHold();
  }, [recapArrived, micClosedAtRecap, tutorSpeaking, stoppedNow]);

  // Never leave a microphone open past the component that owns it.
  useEffect(() => {
    return () => {
      // The screen can be popped by navigation as well as by the door, and a
      // start in flight has to hear about it either way. Same reason as `leave`:
      // without this, the room arrives after the screen has gone.
      startGenRef.current = nextStart(startGenRef.current);
      conversationTextRef.current.clear();
      for (const t of watchdogRef.current) clearTimeout(t);
      watchdogRef.current = [];
      const room = roomRef.current;
      const lease = leaseRef.current;
      roomRef.current = null;
      leaseRef.current = null;
      void disconnectLease(room, lease).catch(() => {});
      removeAudioEls();
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      void releaseAudioSession();
    };
  }, [removeAudioEls]);

  return {
    conversationText: status.phase === 'ended' && !stoppedBySafety(safetyRef.current) ? conversationTextRef.current.snapshot() : null,
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
    settlement,
    canDoEvidence,
    safety,
    dismissSafety,
    turns,
    thinking,
    audioBlocked,
    audioTracks,
    micOpen,
    voiceless,
    reconnecting,
    waitingForTutor,
    diagnostics,
    partialTranscript,
    pauseMic,
    sessionId,
    resumeAudio,
    openMic,
    switchToText,
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
    replyLatencyMs: useCallback(() => medianMs(replyClock.current.samples), []),
    sendSay: useCallback(
      async (text: string) => {
        const room = roomRef.current;
        const generation = startGenRef.current;
        const revision = ++typedSendRevision.current;
        const ownsRoom = () => roomRef.current === room && startGenRef.current === generation;
        const ownsInput = () => ownsRoom() && typedSendRevision.current === revision;
        // Show a typed turn immediately. The current conversation agent echoes
        // it as a confirmed final transcript before running the brain; only
        // that received echo enters optional saved text, never an unsent draft.
        const optimisticId = addTurn({ who: 'learner', fr: text, frWritten: null, en: null });
        setThinking(true);
        const sent = await publish({ t: 'say', text });
        if (sent) return true;
        if (!ownsRoom()) return false;

        // Roll back only the turn this send added, and hand the words back to
        // ConvoScreen through the return value. A network miss must not make a
        // learner retype a sentence in a language they are still learning.
        setTurns((list) => list.filter((turn) => turn.id !== optimisticId));
        if (!ownsInput()) return false;
        setThinking(false);
        setNotice('That did not send. Your words are back in the box.');
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        const timer = setTimeout(() => {
          if (ownsInput() && noticeTimer.current === timer) setNotice(null);
        }, 8000);
        noticeTimer.current = timer;
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
