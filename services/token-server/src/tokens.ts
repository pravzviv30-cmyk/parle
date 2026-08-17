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
 * 'convo-text' is the same conversation with the voice pipeline dark — the
 * learner types instead of speaking, for the train carriage and the denied
 * microphone. Metered like any session: the tutor is thinking either way.
 */
export type SessionMode = 'lesson' | 'convo' | 'convo-text';

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
  },
): Promise<GrantResult> {
  const decision = canStartSession(opts.entitlement, MIN_VIABLE_SESSION_SEC);
  if (!decision.allowed) {
    // 402 rather than 403: this is not "you may not", it is "you have run out".
    // The app renders a different screen for each, so the distinction matters.
    return { ok: false, status: 402, reason: decision.reason, message: decision.message };
  }

  const startRung = validStartRung(opts.startRung);
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
