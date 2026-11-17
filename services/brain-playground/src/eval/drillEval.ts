/**
 * The drill-authoring eval: generated batches through core's deterministic
 * linter and then the production filter (`groundedDrills`, F1124). Duolingo's
 * accepted-answer sets are expert-curated; ours are model-authored with a hard
 * gate, and this run measures how much survives what a learner would see. It
 * prints both counts; the verdict rests on the production one. Below the
 * threshold, the generation prompt needs work before the feature is worth its
 * tokens.
 *
 *   npm run eval:drills -w @luvani/brain-playground
 */

import 'dotenv/config';
import process from 'node:process';

import {
  AnthropicBrainClient,
  OpenAiCompatBrainClient,
  buildDrillGenerationRequest,
  buildSystemBlocks,
  type LlmClient,
} from '@luvani/brain';

import { addUsage, evalCostLine, ZERO_USAGE } from '../usage.ts';
import { drillCounts } from './drillCounts.ts';
import { openAiEvalClient } from './openaiEval.ts';
import { EVAL_ORDER, pickProvider } from './provider.ts';

/** Below this share of clean exercises, the authoring prompt is not earning its keep. */
const ACCEPT_THRESHOLD = 0.7;

/** Two learner shapes: a first session's haul, and a lived-in error profile. */
const PROFILES = [
  {
    label: 'first session (café phrases, no history)',
    input: {
      sessionPhrases: [
        { fr: "un café, s'il vous plaît", frWritten: null, en: 'a coffee, please', enLiteral: null, register: 'courant' as const, note: null },
        { fr: 'ça marche', frWritten: null, en: 'works for me', enLiteral: 'it walks', register: 'courant' as const, note: null },
        { fr: 'sur place', frWritten: null, en: 'for here', enLiteral: 'on the spot', register: 'courant' as const, note: null },
      ],
      profilePhrases: [],
      errorTags: [],
      topics: [{ en: 'Ordering at a café', fr: 'Commander au café' }],
    },
  },
  {
    label: 'returning learner (unmastered backlog, recurring errors)',
    input: {
      sessionPhrases: [
        { fr: "j'suis crevé", frWritten: 'je suis crevé', en: 'I am wiped', enLiteral: null, register: 'familier' as const, note: null },
      ],
      profilePhrases: [
        { fr: 'on fait quoi samedi ?', frWritten: null, en: 'what are we doing Saturday?' },
        { fr: 'carrément', frWritten: null, en: 'totally' },
        { fr: "t'as faim ?", frWritten: 'tu as faim ?', en: 'are you hungry?' },
      ],
      errorTags: ['ne-retention', 'tu-vous-mixing'],
      topics: [{ en: 'Making weekend plans', fr: 'Organiser le week-end' }],
    },
  },
];

function pickClient(): { client: LlmClient; costModel: string } {
  const provider = pickProvider(process.env, EVAL_ORDER);
  if (provider === 'openai') {
    return openAiEvalClient('drills', process.env.OPENAI_API_KEY ?? '');
  }
  if (provider === 'anthropic') {
    return { client: new AnthropicBrainClient(), costModel: 'claude-opus-5' };
  }
  if (provider === 'groq') {
    return { client: new OpenAiCompatBrainClient({ apiKey: process.env.GROQ_API_KEY ?? '' }), costModel: 'groq' };
  }
  console.error('The drill eval needs a real model. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GROQ_API_KEY in services/brain-playground/.env');
  process.exit(2);
}

async function main(): Promise<void> {
  const { client, costModel } = pickClient();
  let usage = ZERO_USAGE;
  let failed = false;

  for (const profile of PROFILES) {
    const started = Date.now();
    const result = await client.drills({
      kind: 'drills',
      system: buildSystemBlocks(),
      request: buildDrillGenerationRequest(profile.input),
    });
    usage = addUsage(usage, result.usage);

    const { total, basic, kept: valid, reasons } = drillCounts(result.batch.exercises, profile.input);

    const share = total === 0 ? 0 : valid.length / total;
    const kinds = new Set(valid.map((exercise) => exercise.kind));
    const difficulties = new Set(valid.map((exercise) => exercise.difficulty));
    const varied = kinds.size >= 3 && difficulties.has('recognition') && difficulties.has('production');
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const ok = total >= 6 && total <= 14 && share >= ACCEPT_THRESHOLD && varied;
    if (!ok) failed = true;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'}  ${profile.label}: ${basic}/${total} pass the basic check, ${valid.length}/${total} survive the production filter (${seconds}s)`,
    );
    for (const [reason, count] of [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
      console.log(`        ${count}× ${reason}`);
    }
    if (basic > valid.length) {
      console.log(`        ${basic - valid.length}× dropped by the production filter (ungrounded phrase, repeated id, unsafe or oversized text)`);
    }
    if (total < 6 || total > 14) console.log(`        batch size ${total}, want 6-14`);
    if (!varied) {
      console.log(`        want at least 3 valid formats plus recognition and production; got ${[...kinds].join(', ') || 'none'}`);
    }
  }

  console.log(`\n${evalCostLine(usage, costModel)} for the run`);
  if (failed) process.exit(1);
}

await main();
