/**
 * The one product event a finished live session sends, for the beta.
 *
 * Built from numbers the end of a session already holds (the lesson summary or
 * the conversation recap) and the reply wait the phone measured. Every property
 * is a count, a boolean or one of a closed set, and the server and database
 * refuse anything else. It never says why the learner is learning: the privacy
 * document promises no event does, so beta cohorts are read by joining these
 * events to the synced profile on the server instead.
 */

import type { ProductEvent } from './track.ts';

export interface FinishedSession {
  kind: 'lesson' | 'convo';
  voice: boolean;
  turns: number;
  rescues: number;
  /** 0 to 1, as the summary and recap report it. */
  unassistedRate: number;
  /** Median phone-measured reply wait, or null when nothing was measured. */
  replyLatencyMs: number | null;
}

const count = (value: number, max: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(0, Math.round(value))) : 0;

/** Pure: the event for one finished session. */
export function sessionFinishedEvent(session: FinishedSession): Extract<ProductEvent, { name: 'live_session_finished' }> {
  const latency = session.replyLatencyMs;
  return {
    name: 'live_session_finished',
    properties: {
      kind: session.kind,
      voice: session.voice,
      turns: count(session.turns, 1_000),
      rescues: count(session.rescues, 1_000),
      unassistedPct: count(session.unassistedRate * 100, 100),
      replyLatencyMs: latency === null || !Number.isFinite(latency) || latency < 0 || latency > 30_000 ? null : Math.round(latency),
    },
  };
}
