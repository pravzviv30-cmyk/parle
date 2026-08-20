/**
 * Room access tokens, and the entitlement gate in front of them.
 *
 * The gate lives here rather than in the app on purpose. A client-side minute
 * counter is a suggestion anyone can edit; a server that refuses to mint a token
 * is the actual boundary, because a learner with no token has no room to join and
 * no agent to talk to.
 */

import { AccessToken } from 'livekit-server-sdk';
import { canStartSession, MIN_VIABLE_SESSION_SEC, secondsRemaining, type Entitlement } from '@parle/core';

export interface TokenConfig {
  apiKey: string;
  apiSecret: string;
  /** How long the join credential stays valid. Not the session length. */
  ttlSeconds?: number;
}

export interface SessionGrant {
  token: string;
  roomName: string;
  identity: string;
  secondsRemaining: number;
}

export type GrantResult = { ok: true; grant: SessionGrant } | { ok: false; status: number; reason: string; message: string };

/** Room names are per-user-per-session so two learners never share a tutor. */
export function roomNameFor(userId: string, lessonId: string, now = Date.now()): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'anon';
  const safeLesson = lessonId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'lesson';
  return `parle-${safeLesson}-${safeUser}-${now.toString(36)}`;
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

export async function grantSession(
  opts: {
    userId: string;
    lessonId: string;
    entitlement: Entitlement;
    config: TokenConfig;
    now?: number;
    /** Where the ladder should open. Validated here; invalid values are dropped. */
    startRung?: number;
    /** Which session shape the app asked for. Defaults to the scripted lesson. */
    mode?: SessionMode;
    /** A compact learner snapshot, passed through opaquely for the agent. */
    snapshot?: object;
    /**
     * A topic to open on, from a practice card. Validated here rather than at
     * the edge, which is why it arrives as `unknown`: one place decides what a
     * seed is, and it is the place that signs it.
     */
    seedTopic?: unknown;
  },
): Promise<GrantResult> {
  const decision = canStartSession(opts.entitlement, MIN_VIABLE_SESSION_SEC);
  if (!decision.allowed) {
    // 402 rather than 403: this is not "you may not", it is "you have run out".
    // The app renders a different screen for each, so the distinction matters.
    return { ok: false, status: 402, reason: decision.reason, message: decision.message };
  }

  const startRung = validStartRung(opts.startRung);
  const seedTopic = validSeedTopic(opts.seedTopic);
  const roomName = roomNameFor(opts.userId, opts.lessonId, opts.now);
  const at = new AccessToken(opts.config.apiKey, opts.config.apiSecret, {
    identity: opts.userId,
    ttl: opts.config.ttlSeconds ?? 60 * 60,
    // The agent reads these to know which lesson to teach and where the learner
    // left off, so a session never restarts from turn one after an interruption.
    metadata: JSON.stringify({
      lessonId: opts.lessonId,
      secondsRemaining: decision.secondsRemaining,
      mode: opts.mode ?? 'lesson',
      ...(startRung !== undefined ? { startRung } : {}),
      ...(seedTopic !== undefined ? { seedTopic } : {}),
      ...(opts.snapshot !== undefined ? { snapshot: opts.snapshot } : {}),
    }),
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    // The learner publishes audio and their own state events, nothing else.
    canPublishData: true,
  });

  return {
    ok: true,
    grant: {
      token: await at.toJwt(),
      roomName,
      identity: opts.userId,
      secondsRemaining: secondsRemaining(opts.entitlement),
    },
  };
}
