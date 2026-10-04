/**
 * Pronunciation scoring, whichever vendor answers.
 *
 * The seam speechace.ts promised when it said the differentiator should not be
 * welded to a single vendor. Two adapters sit behind it, TonePerfect (the
 * founder's choice, 2026-09-29) and Speechace (the alternative, one env var
 * away), and both translate through phoneMap.ts into the same
 * `PhonemeObservation[]`. `buildReport`, `grade()` and the end card never learn
 * which vendor answered, which is the point: if the experimental TonePerfect
 * model is withdrawn or recalibrated, the way back is `LUVANI_SCORING_VENDOR`,
 * not a revert.
 *
 * The policy is code, in this order:
 *
 *   1. No audio, no request. A live turn with the flag off calls this every
 *      turn, and silence is not worth a round trip, a credit or a log line.
 *   2. The vendor is the one named in `LUVANI_SCORING_VENDOR`, or TonePerfect
 *      when its key is set, or Speechace when its key is. Blank is unset.
 *   3. A vendor named without its key scores nothing. The learner's voice is
 *      never redirected to a vendor nobody chose.
 *   4. One deadline per call, shared by every attempt the adapter makes. When
 *      it fires the turn goes on unscored, even if the vendor client ignores
 *      the signal.
 *   5. Nothing here throws. `grade()` treats an absent score as "do not invent
 *      a penalty", so a timeout, a refusal or an outage degrades to text-only
 *      grading and is never a low grade.
 *
 * The vendor table mirrors the brain's activity table in
 * packages/brain/src/llm/routing.ts: one row per vendor, and the choice made in
 * one function rather than spread through call sites.
 */

import type { PhonemeObservation } from '@luvani/core';
import { scoreWithSpeechace } from './speechace.ts';
import { scoreWithTonePerfect } from './toneperfect.ts';

export interface ScoreRequest {
  /** The text the learner was supposed to say. Accuracy scoring is meaningless without it. */
  reference: string;
  /** Raw audio for the utterance. Absent when there is nothing to score. */
  audio?: Uint8Array;
  /** 'fr-fr' or 'fr-ca'. */
  dialect?: 'fr-fr' | 'fr-ca';
}

/**
 * Just enough of `fetch` to send a multipart POST and read a JSON body.
 *
 * Injectable for the same reason preflight.ts takes one: the request itself,
 * the reference text, the audio part, the dialect, is the one link in the
 * pronunciation claim a test has to be able to look at. A score the learner
 * sees is only honest if their voice actually reached the scorer.
 */
export type ScoreFetch = (
  url: string,
  init: { method: string; body: FormData; headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** The environment, as far as scoring reads it. `process.env` unless a test says otherwise. */
export type ScoringEnv = Readonly<Record<string, string | undefined>>;

/** What an adapter is handed. The router fills in the signal; nobody else should need to. */
export interface ScoreDeps {
  /** Real `fetch` when absent, read at call time so a test's tripwire catches a forgotten stub. */
  fetchFn?: ScoreFetch;
  env?: ScoringEnv;
  /** The one deadline for this utterance, shared by every attempt. */
  signal?: AbortSignal;
}

/** One vendor's way of turning an utterance into observations. Never throws; `[]` means no score. */
export type PronunciationScorer = (req: ScoreRequest, deps?: ScoreDeps) => Promise<PhonemeObservation[]>;

/** What a caller of the router may set. The router owns the signal, so callers set a budget instead. */
export interface ScoreOptions {
  fetchFn?: ScoreFetch;
  env?: ScoringEnv;
  /** Defaults to `SCORING_TIMEOUT_MS`. */
  timeoutMs?: number;
  /** Account/session/request cancellation composes with the utterance deadline. */
  signal?: AbortSignal;
}

export type ScoringVendor = 'toneperfect' | 'speechace';

/**
 * How long a live turn waits for a score before going on without one.
 *
 * The one real TonePerfect call took 3.4 s for a 1.7 s clip, and a live score
 * is awaited before the brain replies. Five seconds caps the silence; hitting
 * it costs that turn's score and nothing else. The token server passes its own
 * budget, because a drill learner is waiting for a verdict, not a reply.
 */
export const SCORING_TIMEOUT_MS = 5000;

const VENDORS: Record<ScoringVendor, { keyName: string; score: PronunciationScorer }> = {
  toneperfect: { keyName: 'TONEPERFECT_API_KEY', score: scoreWithTonePerfect },
  speechace: { keyName: 'SPEECHACE_API_KEY', score: scoreWithSpeechace },
};

function isVendor(name: string): name is ScoringVendor {
  return Object.hasOwn(VENDORS, name);
}

/** Blank is unset: an empty `KEY=` line reads as "unset" to a person and as "set" to `??`. */
function present(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

/** Misconfiguration is said once per process, not once per turn. */
const warned = new Set<string>();
function warnOnce(topic: string, message: string): void {
  if (warned.has(topic)) return;
  warned.add(topic);
  console.warn(message);
}

/**
 * Which vendor scores this process's utterances, or null when none is set up.
 *
 * `LUVANI_SCORING_VENDOR` is honoured as written, key or no key; what happens
 * without the key is the router's call. Any other value is warned about once
 * and treated as unset, so a typo falls back to the default rather than to
 * nothing. Unset: TonePerfect when its key is set, else Speechace when its key
 * is, else none.
 */
export function selectScoringVendor(env: ScoringEnv = process.env): ScoringVendor | null {
  const named = (env.LUVANI_SCORING_VENDOR ?? '').trim().toLowerCase();
  if (isVendor(named)) return named;
  if (named.length > 0) {
    warnOnce(
      `unknown:${named}`,
      `[scoring] LUVANI_SCORING_VENDOR=${named} is not a scoring vendor (toneperfect or speechace), so it is ignored ` +
        'and the vendor is chosen by which key is set.',
    );
  }
  if (present(env[VENDORS.toneperfect.keyName])) return 'toneperfect';
  if (present(env[VENDORS.speechace.keyName])) return 'speechace';
  return null;
}

/**
 * Score one utterance with whichever vendor is configured, or return nothing.
 *
 * Returning `[]` rather than throwing is deliberate. `grade()` in the session
 * engine treats an absent score as "do not invent a penalty", so a scorer
 * outage degrades the session to text-only grading instead of ending it. A
 * learner mid-conversation should never be interrupted because a third-party
 * API is down.
 */
export async function scoreUtterance(req: ScoreRequest, options: ScoreOptions = {}): Promise<PhonemeObservation[]> {
  if (!req.audio || req.audio.length === 0 || options.signal?.aborted) return [];

  const env = options.env ?? process.env;
  const vendor = selectScoringVendor(env);
  if (vendor === null) {
    warnOnce(
      'none',
      '[scoring] audio arrived but no scoring vendor is configured (set TONEPERFECT_API_KEY, or SPEECHACE_API_KEY), ' +
        'so nothing is scored and the learner is told so.',
    );
    return [];
  }

  const { keyName, score } = VENDORS[vendor];
  if (!present(env[keyName])) {
    warnOnce(
      `nokey:${vendor}`,
      `[scoring] LUVANI_SCORING_VENDOR names ${vendor} but ${keyName} is not set, so nothing is scored. ` +
        'The audio is not sent to any other vendor.',
    );
    return [];
  }

  const timeoutMs = Math.max(1, Math.min(10_000, options.timeoutMs ?? SCORING_TIMEOUT_MS));
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
  try {
    return await untilDeadline(score(req, { fetchFn: options.fetchFn, env, signal }), signal, () =>
      console.warn(`[scoring] ${vendor} did not answer within ${timeoutMs} ms, so this utterance is unscored`),
    );
  } catch {
    // The adapters do not throw. This is the backstop for the day one does.
    console.warn(`[scoring] ${vendor} failed unexpectedly, so this utterance is unscored`);
    return [];
  }
}

/**
 * The adapter's answer, or `[]` the moment the deadline fires.
 *
 * Real fetch gives up when its signal aborts, but the learner's turn should not
 * depend on every vendor client remembering to: this stops waiting either way.
 */
function untilDeadline(
  work: Promise<PhonemeObservation[]>,
  signal: AbortSignal,
  onTimeout: () => void,
): Promise<PhonemeObservation[]> {
  return new Promise((resolve, reject) => {
    const abandon = () => {
      onTimeout();
      resolve([]);
    };
    if (signal.aborted) return abandon();
    signal.addEventListener('abort', abandon, { once: true });
    work.then(
      (observations) => {
        signal.removeEventListener('abort', abandon);
        resolve(observations);
      },
      (err: unknown) => {
        signal.removeEventListener('abort', abandon);
        reject(err);
      },
    );
  });
}
