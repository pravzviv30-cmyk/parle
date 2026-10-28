/**
 * A per-user memo of judge verdicts, so a learner who sends the same attempt
 * twice does not pay for a second judge call.
 *
 * What it holds, precisely: a sha256 key and the parsed verdict, in process
 * memory, per user, for at most 24 hours. The key is a hash of the user id,
 * the memo version, the judge model, the endpoint and the fully built judge
 * request, so the key cannot be read back into the attempt, and a changed
 * drill, prompt or model misses on its own. The verdict is readable, and its
 * model-written note and better line may quote the learner's words, which is
 * why it stays per user and short-lived. Only successful verdicts are kept,
 * never a failure. It is cleared for a user on account deletion, entirely on
 * restart, and nothing from it is ever logged.
 */

import { createHash } from 'node:crypto';

import { openAiModelFor, type BrainJudgeRequest } from '@luvani/brain/llm';

export const JUDGE_MEMO_VERSION = 1;
export type JudgeMemoEndpoint = 'own-words' | 'fix-line';

/** NFC, trimmed, internal whitespace runs collapsed. Case, accents and punctuation stay. */
export function normaliseAttempt(attempt: string): string {
  return attempt.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

interface Entry { userId: string; verdict: unknown; expiresAt: number }

export interface JudgeMemoOptions {
  maxEntries?: number;
  maxPerUser?: number;
  ttlMs?: number;
  now?: () => number;
  /** The judge model name; part of the key. Production is OpenAI-only. */
  model?: () => string;
}

export class JudgeMemo {
  readonly #entries = new Map<string, Entry>();
  readonly #perUser = new Map<string, Set<string>>();
  readonly #maxEntries: number;
  readonly #maxPerUser: number;
  readonly #ttlMs: number;
  readonly #now: () => number;
  readonly #model: () => string;

  constructor(options: JudgeMemoOptions = {}) {
    this.#maxEntries = options.maxEntries ?? 5_000;
    this.#maxPerUser = options.maxPerUser ?? 200;
    this.#ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000;
    this.#now = options.now ?? Date.now;
    this.#model = options.model ?? (() => openAiModelFor('judge'));
  }

  get size(): number { return this.#entries.size; }

  #key(userId: string, endpoint: JudgeMemoEndpoint, request: BrainJudgeRequest): string {
    const { signal: _signal, ...rest } = request;
    return createHash('sha256')
      .update(JSON.stringify([userId, JUDGE_MEMO_VERSION, this.#model(), endpoint, rest]))
      .digest('hex');
  }

  #delete(key: string): void {
    const entry = this.#entries.get(key);
    if (!entry) return;
    this.#entries.delete(key);
    const keys = this.#perUser.get(entry.userId);
    keys?.delete(key);
    if (keys?.size === 0) this.#perUser.delete(entry.userId);
  }

  get(userId: string, endpoint: JudgeMemoEndpoint, request: BrainJudgeRequest): unknown {
    const key = this.#key(userId, endpoint, request);
    const entry = this.#entries.get(key);
    if (!entry || entry.userId !== userId) return undefined;
    if (this.#now() >= entry.expiresAt) { this.#delete(key); return undefined; }
    // Refresh recency in both orders.
    this.#entries.delete(key); this.#entries.set(key, entry);
    const keys = this.#perUser.get(userId)!;
    keys.delete(key); keys.add(key);
    return entry.verdict;
  }

  set(userId: string, endpoint: JudgeMemoEndpoint, request: BrainJudgeRequest, verdict: unknown): void {
    const key = this.#key(userId, endpoint, request);
    this.#delete(key);
    let keys = this.#perUser.get(userId);
    if (!keys) { keys = new Set(); this.#perUser.set(userId, keys); }
    while (keys.size >= this.#maxPerUser) this.#delete(keys.values().next().value!);
    while (this.#entries.size >= this.#maxEntries) this.#delete(this.#entries.keys().next().value!);
    this.#entries.set(key, { userId, verdict, expiresAt: this.#now() + this.#ttlMs });
    this.#perUser.get(userId)?.add(key) ?? this.#perUser.set(userId, new Set([key]));
  }

  forgetUser(userId: string): void {
    for (const key of [...(this.#perUser.get(userId) ?? [])]) this.#delete(key);
    this.#perUser.delete(userId);
  }
}

/**
 * The memo, or null. Off unless LUVANI_JUDGE_MEMO is exactly '1': the in-app
 * privacy notice promises no copy of an answer or its verdict is kept, so
 * turning this on needs that notice updated and reviewed first (COST-002).
 */
export function judgeMemoFromEnv(env: Record<string, string | undefined>): JudgeMemo | null {
  return env.LUVANI_JUDGE_MEMO === '1' ? new JudgeMemo() : null;
}

/** The one line printed on a hit. It names the endpoint and nothing from the body. */
export function judgeMemoHitLine(endpoint: JudgeMemoEndpoint): string {
  return `[luvani:judge] memo hit ${endpoint}`;
}
