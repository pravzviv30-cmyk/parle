/**
 * The drill-authoring eval: generated batches through core's deterministic
 * linter. Duolingo's accepted-answer sets are expert-curated; ours are
 * model-authored with a hard gate, and this run measures how much survives
 * the gate. Below the threshold, the generation prompt needs work before the
 * feature is worth its tokens.
 *
 *   npm run eval:drills -w @parle/brain-playground
 */

import 'dotenv/config';
import process from 'node:process';

import {
  AnthropicBrainClient,
  OpenAiCompatBrainClient,
  buildDrillGenerationRequest,
  buildSystemBlocks,
  type LlmClient,
} from '@parle/brain';
import { validateExercise } from '@parle/core';

import { addUsage, costUsd, ZERO_USAGE } from '../usage.ts';

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
    },
  },
];

function pickClient(): LlmClient {
  if (process.env.ANTHROPIC_API_KEY) return new AnthropicBrainClient();
  if (process.env.GROQ_API_KEY) return new OpenAiCompatBrainClient({ apiKey: process.env.GROQ_API_KEY });
  console.error('The drill eval needs a real model. Set ANTHROPIC_API_KEY (or GROQ_API_KEY) in services/brain-playground/.env');
  process.exit(2);
}

async function main(): Promise<void> {
  const client = pickClient();
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

    const total = result.batch.exercises.length;
    let clean = 0;
    const reasons = new Map<string, number>();
    for (const exercise of result.batch.exercises) {
      const verdict = validateExercise(exercise);
      if (verdict.ok) clean += 1;
      else for (const reason of verdict.reasons) reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }

    const share = total === 0 ? 0 : clean / total;
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const ok = total > 0 && share >= ACCEPT_THRESHOLD;
    if (!ok) failed = true;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${profile.label}: ${clean}/${total} clean (${seconds}s)`);
    for (const [reason, count] of [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
      console.log(`        ${count}× ${reason}`);
    }
  }

  console.log(`\n~$${costUsd(usage, 'claude-opus-5').toFixed(3)} for the run`);
  if (failed) process.exit(1);
}

await main();
