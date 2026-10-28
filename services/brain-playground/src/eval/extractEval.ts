/**
 * The memory extraction eval: what does the post-session call remember, and
 * what does it wrongly remember?
 *
 *   npm run eval:extract -w @luvani/brain-playground
 *   npm run eval:extract -w @luvani/brain-playground -- --out base.json
 *   npm run eval:extract -w @luvani/brain-playground -- --model gpt-6-luna --effort low --trim --baseline base.json
 *
 * It sends the real request (buildExtractionRequest + buildSystemBlocks()) for
 * each synthetic session in extractFixtures.ts through the real OpenAI client,
 * and scores what comes back. The default config is production: the model
 * `openAiModelFor('extract')` picks, the routed effort, the full transcript.
 * `--model` moves the analyst model (extract's tier) and `--effort` overrides the
 * extract route only, both through the client's existing config seams.
 * `--trim` is eval-only: it drops `(noted …)`, `(taught: …)` and `(beat: …)`
 * assistant lines before the request is built, to measure whether a shorter
 * transcript loses anything.
 *
 * ## What the labels are
 *
 * Each fixture was labelled when written: `expected` real facts (recall is
 * measured on these), `optional` minor real facts, `fiction` (scene content),
 * `sensitive` (what memoryPolicy.ts forbids storing), and `known` facts already
 * on file. Matching is lowercase keyword substrings on a fact's en + fr. A fact
 * matching none of the labels is reported as unlabelled, to be argued over by a
 * person, never auto-failed.
 *
 * ## What it does not prove
 *
 * Keyword matching is coarse: a leak phrased without any listed keyword is
 * missed, and a fine fact can trip a keyword. Ten invented sessions are not
 * real learners, and the persona is the default one, not a learner's chosen
 * tutor. So a PASS means "no worse than the baseline on these sessions", not
 * "safe" and not "good". Without a baseline no recall verdict is given, because
 * no recall threshold has been decided and inventing one would be a guess.
 */

import process from 'node:process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import {
  DEFAULT_ROUTING,
  OpenAiResponsesBrainClient,
  buildExtractionRequest,
  buildSystemBlocks,
  openAiModelFor,
  type BrainEffort,
  type BrainRouting,
  type ChatMessage,
  type LlmUsage,
  type MemoryExtraction,
} from '@luvani/brain';

import { evalCostUsd } from '../usage.ts';
import { EXTRACT_FIXTURES, type ExtractFixture, type Matcher } from './extractFixtures.ts';

// ---------------------------------------------------------------------------
// Scoring (pure)
// ---------------------------------------------------------------------------

export interface ExtractTokens { in: number; cacheRead: number; cacheWrite: number; out: number; reasoning: number }

export interface ExtractCallScore {
  fixtureId: string;
  /** Expected facts found / expected. Null when the fixture expects none. */
  recall: number | null;
  unlabelled: string[];
  fictionLeaks: string[];
  sensitiveLeaks: string[];
  knownRepeats: string[];
  openerOk: boolean;
  /** The call returned no parsed extraction (parse, refusal, schema or network error). */
  structuredFailure: boolean;
  tokens: ExtractTokens;
  usd: number;
  latencyMs: number;
}

export function matches(matcher: Matcher, text: string): boolean {
  const lower = text.toLowerCase();
  return matcher.every((group) => group.some((keyword) => lower.includes(keyword)));
}

const anyMatch = (matchers: readonly Matcher[], text: string): boolean => matchers.some((matcher) => matches(matcher, text));
/** Each entry is one OR-group, so a hit on any keyword of any group counts. */
const anyGroup = (groups: readonly string[][], text: string): boolean => groups.some((group) => matches([group], text));

export function scoreExtraction(
  fixture: ExtractFixture,
  extraction: MemoryExtraction | null,
  meta: { usage: LlmUsage; usd: number; latencyMs: number },
): ExtractCallScore {
  const tokens: ExtractTokens = {
    in: meta.usage.inputTokens,
    cacheRead: meta.usage.cacheReadTokens,
    cacheWrite: meta.usage.cacheWriteTokens,
    out: meta.usage.outputTokens,
    reasoning: meta.usage.reasoningTokens ?? 0,
  };
  const base = { fixtureId: fixture.id, tokens, usd: meta.usd, latencyMs: meta.latencyMs };
  if (extraction === null) {
    return {
      ...base, recall: fixture.expected.length === 0 ? null : 0, unlabelled: [], fictionLeaks: [], sensitiveLeaks: [],
      knownRepeats: [], openerOk: false, structuredFailure: true,
    };
  }

  // happensAround is part of the fact: the prompt asks for the when there, not in en.
  const texts = extraction.facts.map((fact) => ({ en: fact.en, text: `${fact.en} ${fact.fr ?? ''} ${fact.happensAround ?? ''}` }));
  const found = fixture.expected.filter((item) => texts.some((fact) => matches(item.match, fact.text))).length;
  const unlabelled: string[] = [];
  const fictionLeaks: string[] = [];
  const sensitiveLeaks: string[] = [];
  const knownRepeats: string[] = [];

  for (const fact of texts) {
    const isExpected = fixture.expected.some((item) => matches(item.match, fact.text));
    const isSensitive = anyGroup(fixture.sensitive, fact.text);
    const isFiction = !isExpected && anyGroup(fixture.fiction, fact.text);
    const isRepeat = !isExpected && anyGroup(fixture.known, fact.text);
    if (isSensitive) sensitiveLeaks.push(fact.en);
    if (isFiction) fictionLeaks.push(fact.en);
    if (isRepeat) knownRepeats.push(fact.en);
    if (!isExpected && !isSensitive && !isFiction && !isRepeat && !anyMatch(fixture.optional, fact.text)) unlabelled.push(fact.en);
  }
  for (const opener of [extraction.openerEn, extraction.openerFr]) {
    if (opener === null) continue;
    if (anyGroup(fixture.sensitive, opener)) sensitiveLeaks.push(`(opener) ${opener}`);
    // The prompt says never reference the scene's fiction. An opener that names
    // a real expected fact is fine even when a fiction keyword overlaps it.
    const real = fixture.expected.some((item) => matches(item.match, opener.toLowerCase()));
    if (!real && anyGroup(fixture.fiction, opener)) fictionLeaks.push(`(opener) ${opener}`);
  }

  const hasOpener = extraction.openerEn !== null && extraction.openerFr !== null;
  const noOpener = extraction.openerEn === null && extraction.openerFr === null;
  return {
    ...base,
    recall: fixture.expected.length === 0 ? null : found / fixture.expected.length,
    unlabelled, fictionLeaks, sensitiveLeaks, knownRepeats,
    openerOk: fixture.openerExpected ? hasOpener : noOpener,
    structuredFailure: false,
  };
}

/** Eval-only: drop the bookkeeping lines a shorter transcript would not carry. */
export function trimHistory(history: readonly ChatMessage[]): ChatMessage[] {
  return history.filter((message) => !(message.role === 'assistant' && /^\((noted |taught: |beat: )/.test(message.text)));
}

// ---------------------------------------------------------------------------
// Summary and pass rule (pure)
// ---------------------------------------------------------------------------

export interface ExtractRunConfig { model: string; effort: string; trim: boolean; repeats: number }

export interface ExtractRunSummary {
  config: ExtractRunConfig;
  calls: number;
  meanRecall: number;
  fictionLeaks: number;
  sensitiveLeaks: number;
  knownRepeats: number;
  structuredFailures: number;
  openerMisses: number;
  unlabelled: number;
  tokens: ExtractTokens;
  usdTotal: number;
  usdPerCall: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  scores: ExtractCallScore[];
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

export function summariseExtraction(scores: readonly ExtractCallScore[], config: ExtractRunConfig): ExtractRunSummary {
  const recalls = scores.flatMap((score) => (score.recall === null ? [] : [score.recall]));
  const sum = (pick: (score: ExtractCallScore) => number): number => scores.reduce((total, score) => total + pick(score), 0);
  const usdTotal = sum((score) => score.usd);
  return {
    config,
    calls: scores.length,
    meanRecall: recalls.length === 0 ? 0 : recalls.reduce((x, y) => x + y, 0) / recalls.length,
    fictionLeaks: sum((score) => score.fictionLeaks.length),
    sensitiveLeaks: sum((score) => score.sensitiveLeaks.length),
    knownRepeats: sum((score) => score.knownRepeats.length),
    structuredFailures: sum((score) => (score.structuredFailure ? 1 : 0)),
    openerMisses: sum((score) => (score.openerOk ? 0 : 1)),
    unlabelled: sum((score) => score.unlabelled.length),
    tokens: {
      in: sum((score) => score.tokens.in),
      cacheRead: sum((score) => score.tokens.cacheRead),
      cacheWrite: sum((score) => score.tokens.cacheWrite),
      out: sum((score) => score.tokens.out),
      reasoning: sum((score) => score.tokens.reasoning),
    },
    usdTotal,
    usdPerCall: scores.length === 0 ? 0 : usdTotal / scores.length,
    latencyP50Ms: percentile(scores.map((score) => score.latencyMs), 50),
    latencyP95Ms: percentile(scores.map((score) => score.latencyMs), 95),
    scores: [...scores],
  };
}

/**
 * Zero leaks, repeats, failures and opener misses always; recall at or above the
 * baseline's only when a baseline is given. No baseline, no recall verdict.
 */
export function passRule(summary: ExtractRunSummary, baseline: ExtractRunSummary | null): { pass: boolean; lines: string[] } {
  const checks: [string, boolean][] = [
    [`sensitive leaks ${summary.sensitiveLeaks} = 0`, summary.sensitiveLeaks === 0],
    [`fiction leaks ${summary.fictionLeaks} = 0`, summary.fictionLeaks === 0],
    [`known repeats ${summary.knownRepeats} = 0`, summary.knownRepeats === 0],
    [`structured failures ${summary.structuredFailures} = 0`, summary.structuredFailures === 0],
    [`opener misses ${summary.openerMisses} = 0`, summary.openerMisses === 0],
  ];
  if (baseline !== null) {
    checks.push([`mean recall ${summary.meanRecall.toFixed(3)} >= baseline ${baseline.meanRecall.toFixed(3)}`, summary.meanRecall >= baseline.meanRecall]);
  }
  const lines = checks.map(([label, ok]) => `${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const pass = checks.every(([, ok]) => ok);
  if (baseline === null) lines.push(`no baseline given, so no recall verdict: ${pass ? 'zero checks held' : 'zero checks FAILED'}`);
  else lines.push(pass ? 'PASS against the baseline' : 'FAIL against the baseline');
  return { pass, lines };
}

export function formatSummary(summary: ExtractRunSummary): string[] {
  const lines: string[] = [];
  for (const score of summary.scores) {
    const flags = [
      ...score.sensitiveLeaks.map((text) => `sensitive: ${text}`),
      ...score.fictionLeaks.map((text) => `fiction: ${text}`),
      ...score.knownRepeats.map((text) => `repeat: ${text}`),
      ...score.unlabelled.map((text) => `unlabelled: ${text}`),
      ...(score.openerOk ? [] : ['opener rule broken']),
      ...(score.structuredFailure ? ['no structured answer'] : []),
    ];
    lines.push(`  ${score.fixtureId}: recall ${score.recall === null ? 'n/a' : score.recall.toFixed(2)}, ${score.tokens.in}+${score.tokens.cacheRead}r+${score.tokens.cacheWrite}w in / ${score.tokens.out} out, ${(score.latencyMs / 1000).toFixed(1)}s`);
    for (const flag of flags) lines.push(`      ${flag}`);
  }
  const { config: c, tokens: t } = summary;
  lines.push(
    `config: model ${c.model}, effort ${c.effort}, ${c.trim ? 'trimmed' : 'full'} transcript, repeats ${c.repeats}`,
    `calls ${summary.calls}, mean recall ${summary.meanRecall.toFixed(3)}, unlabelled ${summary.unlabelled}`,
    `leaks: sensitive ${summary.sensitiveLeaks}, fiction ${summary.fictionLeaks}; known repeats ${summary.knownRepeats}; failures ${summary.structuredFailures}; opener misses ${summary.openerMisses}`,
    `tokens: in ${t.in}, cache read ${t.cacheRead}, cache write ${t.cacheWrite}, out ${t.out} (reasoning ${t.reasoning})`,
    `usd: total $${summary.usdTotal.toFixed(4)}, per call $${summary.usdPerCall.toFixed(4)}`,
    `latency: p50 ${(summary.latencyP50Ms / 1000).toFixed(1)}s, p95 ${(summary.latencyP95Ms / 1000).toFixed(1)}s`,
  );
  return lines;
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

export type Environment = Record<string, string | undefined>;

export function blockedReport(): string {
  return [
    'BLOCKED: OPENAI_API_KEY is not set, so nothing below has been measured.',
    'Production extraction is OpenAI-only. Put the key in services/brain-playground/.env and run:',
    '  npm run eval:extract -w @luvani/brain-playground',
  ].join('\n');
}

const EFFORTS: readonly BrainEffort[] = ['low', 'medium', 'high'];

export async function runExtractEval(options: { env: Environment; argv: string[]; log: (line: string) => void }): Promise<{ ok: boolean; blocked: boolean }> {
  const { values } = parseArgs({
    args: options.argv,
    options: {
      model: { type: 'string' },
      effort: { type: 'string' },
      trim: { type: 'boolean', default: false },
      repeats: { type: 'string', default: '1' },
      baseline: { type: 'string' },
      out: { type: 'string' },
    },
  });
  const apiKey = options.env.OPENAI_API_KEY?.trim() ?? '';
  if (apiKey === '') {
    options.log(blockedReport());
    return { ok: false, blocked: true };
  }
  if (values.effort !== undefined && !EFFORTS.includes(values.effort as BrainEffort)) throw new Error(`--effort must be one of ${EFFORTS.join(', ')}`);
  const repeats = Math.max(1, Number.parseInt(values.repeats ?? '1', 10) || 1);

  // --effort moves the extract route only; leaving it unset keeps the client's
  // own routing (resolveRouting, BRAIN_EFFORT included), exactly as production.
  const routing: BrainRouting | undefined = values.effort === undefined ? undefined
    : { ...DEFAULT_ROUTING, extract: { ...DEFAULT_ROUTING.extract, effort: values.effort as BrainEffort } };
  const modelConfig = { ...(values.model === undefined ? {} : { analystModel: values.model }), ...(routing === undefined ? {} : { routing }) };
  const client = new OpenAiResponsesBrainClient({ apiKey, ...modelConfig });
  const model = openAiModelFor('extract', options.env, modelConfig);
  const effort = values.effort ?? `${(routing ?? DEFAULT_ROUTING).extract.effort ?? 'default'} (routed)`;
  const config: ExtractRunConfig = { model, effort, trim: values.trim ?? false, repeats };
  options.log(`extraction eval: ${EXTRACT_FIXTURES.length} fixtures x ${repeats} on ${model}`);

  const scores: ExtractCallScore[] = [];
  for (let round = 0; round < repeats; round += 1) {
    for (const fixture of EXTRACT_FIXTURES) {
      const history = config.trim ? trimHistory(fixture.history) : fixture.history;
      const started = Date.now();
      let extraction: MemoryExtraction | null = null;
      let usage: LlmUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
      try {
        // Production passes the learner's chosen persona; the default persona is
        // the closest stand-in a synthetic learner has.
        const result = await client.extract({
          kind: 'extract',
          system: buildSystemBlocks(),
          request: buildExtractionRequest({ history, knownFacts: fixture.knownFacts }),
        });
        extraction = result.extraction;
        usage = result.usage;
      } catch (error) {
        options.log(`     ${fixture.id}: no structured answer, ${error instanceof Error ? error.message : String(error)}`);
      }
      scores.push(scoreExtraction(fixture, extraction, { usage, usd: evalCostUsd(usage, model), latencyMs: Date.now() - started }));
    }
  }

  const summary = summariseExtraction(scores, config);
  for (const line of formatSummary(summary)) options.log(line);
  const baseline = values.baseline === undefined ? null : (JSON.parse(readFileSync(values.baseline, 'utf8')) as ExtractRunSummary);
  const verdict = passRule(summary, baseline);
  for (const line of verdict.lines) options.log(line);
  if (values.out !== undefined) {
    writeFileSync(values.out, `${JSON.stringify(summary, null, 2)}\n`);
    options.log(`summary written to ${values.out}`);
  }
  return { ok: verdict.pass, blocked: false };
}

async function main(): Promise<void> {
  const dotenv = await import('dotenv');
  // LUVANI_ENV_FILE lets the self-test point at an empty file and prove the
  // blocked path without this machine's real keys.
  const envFile = process.env.LUVANI_ENV_FILE ?? fileURLToPath(new URL('../../.env', import.meta.url));
  dotenv.config({ path: envFile, override: false, quiet: true });
  const result = await runExtractEval({ env: process.env, argv: process.argv.slice(2), log: (line) => console.log(line) });
  // Blocked exits 2 and failed exits 1: both non-zero, and neither is a pass.
  process.exitCode = result.blocked ? 2 : result.ok ? 0 : 1;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  await main();
}
