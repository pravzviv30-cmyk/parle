/**
 * Room access tokens, and the entitlement gate in front of them.
 *
 * The gate lives here rather than in the app on purpose. A client-side minute
 * counter is a suggestion anyone can edit; a server that refuses to mint a token
 * is the actual boundary, because a learner with no token has no room to join and
 * no agent to talk to.
 */

import { AccessToken, RoomConfiguration, TrackSource } from 'livekit-server-sdk';
import { randomUUID } from 'node:crypto';
import { canStartSession, MIN_VIABLE_SESSION_SEC, secondsRemaining, parseTutorRevision, type Entitlement, type TutorRevision } from '@luvani/core';
import type { ReservedTutorSession } from './tutorSessions.ts';

export interface TokenConfig {
  apiKey: string;
  apiSecret: string;
  /** How long the join credential stays valid. Not the session length. */
  ttlSeconds?: number;
}

export interface SessionGrant {
  token: string;
  /** Server-generated billing and active-room id. */
  sessionId: string;
  roomName: string;
  identity: string;
  secondsRemaining: number;
}

export type GrantResult = { ok: true; grant: SessionGrant } | { ok: false; status: number; reason: string; message: string };

/**
 * The room a grant configures, and what each number actually costs.
 *
 * Exported rather than written inline because two of these are capacity
 * decisions with a price, and a price nobody wrote down gets changed by whoever
 * finds the number inconvenient. Every figure under `measured` came off the
 * live voice lifecycle harness on this machine, not out of the documentation,
 * and the two costs below are derived from those figures rather than guessed.
 *
 * The guess worth naming, because the ledger made it (F78) and the measurement
 * refused it: an abandoned room does NOT hold a tutor. Dispatch follows a
 * PARTICIPANT, so a room with nobody in it gets no tutor — measured, a room
 * created at `emptyTimeout=20` held 20.1s with none dispatched into it. Luvani
 * never creates a room any other way either: the grant does not create one, and
 * a grant nobody joins leaves no room at all. So `emptyTimeoutSec` is a
 * backstop rather than a live cost, and lowering it would buy nothing while
 * costing a learner on a slow network the room they were about to join.
 *
 * `departureTimeoutSec` is the one that holds a worker. The tutor stays in the
 * room until LiveKit closes it, measured at 20.6s after the learner left, so
 * every finished session keeps a worker slot for about that long after the
 * learner has gone. That is the real concurrency ceiling: at N worker slots, a
 * session every 20 seconds per slot is the floor on turnover, whatever the
 * sessions themselves cost.
 */
export const ROOM_LIFECYCLE = {
  /** One learner, one tutor, and nobody else, ever. */
  maxParticipants: 2,
  /** Seconds LiveKit keeps a room that has nobody in it. */
  emptyTimeoutSec: 30,
  /** Seconds LiveKit keeps a room after its last participant leaves. */
  departureTimeoutSec: 20,
  /** What the harness watched happen, at the timeouts it ran with. */
  measured: {
    /** A room created through the server API and never joined. */
    emptyRoom: { emptyTimeoutSec: 20, heldSec: 20.1, tutorDispatched: false },
    /** A room a learner joined and then left, with the tutor still in it. */
    departedRoom: { departureTimeoutSec: 20, roomGoneAfterSec: 20.6 },
  },
  /** Zero, because no tutor is dispatched into a room nobody joined. */
  workerOccupancySecPerAbandonedRoom: 0,
  /** The tutor sits in the closing room for the whole departure window. */
  workerOccupancySecPerFinishedSession: 20,
} as const;

/** Room names are per-user-per-session so two learners never share a tutor. */
export function roomNameFor(userId: string, lessonId: string, now = Date.now()): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'anon';
  const safeLesson = lessonId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'lesson';
  return `luvani-${safeLesson}-${safeUser}-${now.toString(36)}`;
}

/**
 * The session shapes the app may request. The agent stays authoritative.
 * 'lesson-text' is the scripted lesson with the voice pipeline dark, and
 * 'convo-text' is the same conversation with the voice pipeline dark — the
 * learner types instead of speaking, for the train carriage and the denied
 * microphone. Metered like any session: the tutor is thinking either way.
 */
export type SessionMode = 'lesson' | 'convo' | 'convo-text' | 'lesson-text';

/**
 * A requested opening rung, kept only when it really is one. Anything else —
 * out of range, fractional, or not a number at all — is dropped rather than
 * signed, because whatever lands in the token metadata arrives at the agent
 * with the server's signature on it.
 */
function validStartRung(value: unknown): 1 | 2 | 3 | 4 | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4
    ? (value as 1 | 2 | 3 | 4)
    : undefined;
}

/**
 * A topic the learner already talked about, tapped in Practice and handed back
 * so the conversation opens on it instead of asking what to talk about.
 */
export interface SeedTopic {
  fr: string;
  en: string;
}

/** A topic card's title, and nothing longer. Anything longer is not a title. */
const MAX_SEED_TOPIC_CHARS = 120;

/**
 * A requested topic, kept only when it really is one: two strings, both with
 * something in them once trimmed, both short enough to be a title. The trimmed
 * pair is what gets signed, because the trimmed pair is what the tutor will
 * say — and the same reasoning as the rung above applies with more force here,
 * since whatever lands in the token metadata arrives at the agent with the
 * server's signature on it and goes straight into a spoken line.
 *
 * Half a seed is no seed: a pair naming the topic in one language only would
 * open the tutor on a subject with no name on screen. So anything that fails
 * drops the whole thing rather than keeping the half that passed.
 *
 * Dropped, never refused. A bad hint is not a reason to deny someone their
 * session; they get the generic conversation, which is what they get today.
 */
function validSeedTopic(value: unknown): SeedTopic | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { fr, en } = value as { fr?: unknown; en?: unknown };
  if (typeof fr !== 'string' || typeof en !== 'string') return undefined;
  const trimmed: SeedTopic = { fr: fr.trim(), en: en.trim() };
  if (trimmed.fr.length === 0 || trimmed.en.length === 0) return undefined;
  if (trimmed.fr.length > MAX_SEED_TOPIC_CHARS || trimmed.en.length > MAX_SEED_TOPIC_CHARS) return undefined;
  return trimmed;
}

/** An id is a key, not a sentence. Anything longer is not one of ours. */
const MAX_MISSION_ID_CHARS = 64;

/**
 * A mission the learner chose, carried so the agent can open its authored scene
 * without asking what to talk about. Shape-checked only: a non-empty key of
 * sane length and sane characters, trimmed, because that is all this server can
 * honestly say about it.
 *
 * Deliberately NOT checked against the mission catalogue. The token server does
 * not own which missions exist — the agent resolves the id and degrades to the
 * ordinary choosing question when it does not know it — and a second copy of
 * that list here would be a second thing to keep in step.
 *
 * Dropped, never refused, and never anywhere near the entitlement decision. A
 * bad hint costs the learner their opening scene, never their session.
 */
function validMissionId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_MISSION_ID_CHARS) return undefined;
  if (!/^[a-zA-Z0-9:._-]+$/.test(trimmed)) return undefined;
  return trimmed;
}

/** A catalogue key, not a name and not a vendor id. */
const MAX_TUTOR_VOICE_CHARS = 32;

/**
 * Which tutor the learner chose to be taught by. The third passenger after the
 * seed topic and the mission, and it obeys exactly the same rules, because it
 * is exactly the same kind of thing: a hint the app sends, signed here, acted
 * on by the agent.
 *
 * Stricter in shape than a mission id on purpose. Voice keys are ours and we
 * chose them lowercase and hyphenated, so `/^[a-z][a-z0-9-]*$/` is a fact about
 * the catalogue rather than a guess. Anything with a colon, a dot, a slash, an
 * accent or a capital in it was not produced by our chooser.
 *
 * Deliberately NOT checked against the catalogue itself. The agent is the last
 * hop before a URL that bills someone, it is the only process holding the
 * vendor key, and it re-resolves this to a known voice or the default whatever
 * arrives. A second strict copy of the list here would be a second thing to
 * keep in step and a way for the two to disagree about the same learner. What
 * this function is for is making sure nothing shaped like an injection, a path
 * or a sentence inherits the server's signature on the way through.
 *
 * Dropped, never refused. A voice we cannot read costs the learner their chosen
 * tutor for one session, never the session. They get the default and can still
 * speak French, which is what they opened the app for.
 */
function validTutorVoice(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_TUTOR_VOICE_CHARS) return undefined;
  if (!/^[a-z][a-z0-9-]*$/.test(trimmed)) return undefined;
  return trimmed;
}

export async function grantSession(
  opts: {
    userId: string;
    lessonId: string;
    entitlement: Entitlement;
    config: TokenConfig;
    /** Database reservation, required by the production API before signing. */
    admitted?: ReservedTutorSession;
    now?: number;
    /** Where the ladder should open. Validated here; invalid values are dropped. */
    startRung?: number;
    /** Which session shape the app asked for. Defaults to the scripted lesson. */
    mode?: SessionMode;
    /** A compact learner snapshot, passed through opaquely for the agent. */
    snapshot?: object;
    /** Server-loaded, owner-scoped conversation learning context. */
    revision?: TutorRevision;
    /**
     * A topic to open on, from a practice card. Validated here rather than at
     * the edge, which is why it arrives as `unknown`: one place decides what a
     * seed is, and it is the place that signs it.
     */
    seedTopic?: unknown;
    /**
     * A mission to open on, from the chooser. Validated here for the same
     * reason the seed is: the place that signs it is the place that decides
     * what it is. Whether that mission exists is the agent's call, not ours.
     */
    missionId?: unknown;
    /**
     * Which voice the learner picked for their tutor. Validated here for shape
     * only; whether that voice exists is the agent's call, because the agent is
     * the only process that can turn a key into a vendor id.
     */
    tutorVoice?: unknown;
  },
): Promise<GrantResult> {
  const decision = opts.admitted
    ? { allowed: true as const, secondsRemaining: opts.admitted.secondsRemaining }
    : canStartSession(opts.entitlement, MIN_VIABLE_SESSION_SEC);
  if (!decision.allowed) {
    // 402 rather than 403: this is not "you may not", it is "you have run out".
    // The app renders a different screen for each, so the distinction matters.
    return { ok: false, status: 402, reason: decision.reason, message: decision.message };
  }

  const startRung = validStartRung(opts.startRung);
  const seedTopic = validSeedTopic(opts.seedTopic);
  const missionId = validMissionId(opts.missionId);
  const tutorVoice = validTutorVoice(opts.tutorVoice);
  const revision = parseTutorRevision(opts.revision);
  if (opts.admitted && (opts.admitted.userId !== opts.userId || opts.admitted.mode !== (opts.mode ?? 'lesson'))) {
    throw new Error('reservation identity mismatch');
  }
  const sessionId = opts.admitted?.sessionId ?? randomUUID();
  const roomName = opts.admitted?.roomName ?? `${roomNameFor(opts.userId, opts.lessonId, opts.now)}-${sessionId.slice(0, 12)}`;
  const at = new AccessToken(opts.config.apiKey, opts.config.apiSecret, {
    identity: opts.userId,
    // The credential only has to survive the join and any full reconnect the
    // session needs after it. A connected participant is not ejected when this
    // expires, and a captured token should have minutes, not an hour, in which
    // it can be replayed.
    //
    // A floor on that replay window, not a ceiling: LiveKit validates `exp`
    // with leeway, measured live at roughly 90 seconds (a credential 30s past
    // expiry was accepted, 900s past was refused). Shortening this does not
    // close replay and does break a learner whose network drops mid-session, so
    // the boundary that actually closes it is the tutor refusing a session id
    // that has already been reported — see tutor.ts (F77).
    ttl: opts.config.ttlSeconds ?? 5 * 60,
    // The agent reads these to know which lesson to teach and where the learner
    // left off, so a session never restarts from turn one after an interruption.
    metadata: JSON.stringify({
      sessionId,
      lessonId: opts.lessonId,
      secondsRemaining: opts.admitted?.reservedSeconds ?? decision.secondsRemaining,
      ...(opts.admitted ? { lifecycleVersion: 1, joinDeadline: opts.admitted.joinDeadline } : {}),
      mode: opts.mode ?? 'lesson',
      ...(startRung !== undefined ? { startRung } : {}),
      ...(seedTopic !== undefined ? { seedTopic } : {}),
      ...(revision !== undefined ? { revision } : {}),
      ...(missionId !== undefined ? { missionId } : {}),
      ...(tutorVoice !== undefined ? { tutorVoice } : {}),
      ...(opts.snapshot !== undefined ? { snapshot: opts.snapshot } : {}),
    }),
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishSources: [TrackSource.MICROPHONE],
    canSubscribe: true,
    // The learner publishes audio and their own state events, nothing else.
    canPublishData: true,
  });
  at.roomConfig = new RoomConfiguration({
    name: roomName,
    maxParticipants: ROOM_LIFECYCLE.maxParticipants,
    emptyTimeout: ROOM_LIFECYCLE.emptyTimeoutSec,
    departureTimeout: ROOM_LIFECYCLE.departureTimeoutSec,
  });

  return {
    ok: true,
    grant: {
      token: await at.toJwt(),
      sessionId,
      roomName,
      identity: opts.userId,
      secondsRemaining: opts.admitted?.secondsRemaining ?? secondsRemaining(opts.entitlement),
    },
  };
}
