/**
 * The scenario-builder eval: canned topic requests through the real frame
 * call, judged by deterministic structural checks — beat counts, kebab ids,
 * narration present, English-only hints. No LLM judges an LLM here; a frame
 * either holds the contract the conversation engine stands on, or it fails
 * the run.
 *
 *   npm run eval:frames -w @parle/brain-playground
 */

import 'dotenv/config';
import process from 'node:process';

import {
  AnthropicBrainClient,
  DEFAULT_OPENAI_TURN_MODEL,
  OpenAiCompatBrainClient,
  OpenAiResponsesBrainClient,
  buildScenarioRequest,
  buildSystemBlocks,
  carriesFrench,
  copyViolations,
  type LlmClient,
  type ScenarioFrame,
} from '@parle/brain';

import { addUsage, costUsd, ZERO_USAGE } from '../usage.ts';

/** The founder's examples first; the rest span transactional to personal. */
const REQUESTS = [
  'a chance conversation with a stranger who bumps into you in a busy street',
  'ordering at a busy Paris café',
  'a Friday evening apéro with French friends',
  'checking into a small hotel in Nice late at night',
  'asking for directions to the métro when you are lost',
  'buying vegetables at an open-air market',
  'small talk with a taxi driver from the airport',
  'meeting your partner’s French parents for the first time',
  'speaking with my teacher at school about an assignment I do not understand',
] as const;

function checkFrame(frame: ScenarioFrame, request: string): string[] {
  const problems: string[] = [];

  if (frame.beats.length < 2 || frame.beats.length > 5) problems.push(`beats: ${frame.beats.length}, want 2-5`);
  for (const beat of frame.beats) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(beat.id)) problems.push(`beat id not kebab-case: "${beat.id}"`);
    if (beat.goalEn.trim().length === 0) problems.push(`beat ${beat.id} has no English gloss`);
  }

  if (frame.goalPhrases.length < 5 || frame.goalPhrases.length > 8) {
    problems.push(`goalPhrases: ${frame.goalPhrases.length}, want 5-8`);
  }
  if (frame.characters.length === 0) problems.push('no characters');

  const narration = frame.openingNarration;
  if (narration.speaker !== 'narration') problems.push(`narration speaker: "${narration.speaker}"`);
  if (narration.en.trim().length === 0) problems.push('narration has no English');
  if (carriesFrench(narration.en, request)) problems.push(`narration.en carries French: "${narration.en}"`);

  if (carriesFrench(frame.openingSupport.hintEn, request)) {
    problems.push(`hintEn carries French — the hint must never hand over words: "${frame.openingSupport.hintEn}"`);
  }
  if (frame.cultureNotes.length > 3) problems.push(`cultureNotes: ${frame.cultureNotes.length}, want at most 3`);

  for (const text of [narration.en, narration.fr, frame.openingLine.fr, frame.openingSupport.hintEn]) {
    for (const violation of copyViolations(text)) problems.push(`copy: ${violation} in "${text.slice(0, 60)}"`);
  }

  return problems;
}

function pickClient(): { client: LlmClient; costModel: string } {
  const choice = (process.env.BRAIN_LLM ?? '').toLowerCase();
  if ((choice === 'openai' || (choice === '' && !process.env.ANTHROPIC_API_KEY)) && process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAiResponsesBrainClient({ apiKey: process.env.OPENAI_API_KEY }),
      // Frames are designed by the turn model now, because the learner waits
      // through them. Pricing them as analyst work overstates the cost ~10x.
      costModel: DEFAULT_OPENAI_TURN_MODEL,
    };
  }
  if ((choice === 'anthropic' || choice === '') && process.env.ANTHROPIC_API_KEY) {
    return { client: new AnthropicBrainClient(), costModel: 'claude-sonnet-5' };
  }
  if ((choice === 'groq' || choice === '') && process.env.GROQ_API_KEY) {
    return { client: new OpenAiCompatBrainClient({ apiKey: process.env.GROQ_API_KEY }), costModel: 'groq' };
  }
  console.error('The frame eval needs a real model. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GROQ_API_KEY in services/brain-playground/.env');
  process.exit(2);
}

async function main(): Promise<void> {
  const { client, costModel } = pickClient();
  let failures = 0;
  let usage = ZERO_USAGE;

  for (const request of REQUESTS) {
    const started = Date.now();
    try {
      const result = await client.frame({
        kind: 'frame',
        system: buildSystemBlocks(),
        request: buildScenarioRequest({ request, learner: { cefr: 'A1', watchFor: ['ne-retention'] } }),
      });
      usage = addUsage(usage, result.usage);
      const problems = checkFrame(result.frame, request);
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      if (problems.length === 0) {
        console.log(`ok    ${request} — "${result.frame.title}" (${seconds}s)`);
      } else {
        failures += 1;
        console.log(`FAIL  ${request} (${seconds}s)`);
        for (const p of problems) console.log(`        ${p}`);
      }
    } catch (error) {
      failures += 1;
      console.log(`FAIL  ${request} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\n${REQUESTS.length - failures}/${REQUESTS.length} frames hold the contract · ~$${costUsd(usage, costModel).toFixed(3)}`);
  if (failures > 0) process.exit(1);
}

await main();
