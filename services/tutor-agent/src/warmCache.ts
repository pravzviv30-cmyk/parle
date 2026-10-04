/**
 * Warm the voice cache.
 *
 * Synthesizes every scripted line of every lesson once, so the first learner
 * session plays entirely from disk and the vendor bill for lesson content is a
 * one-off measured in cents. Run it after keys land, and again whenever lesson
 * text or the configured voice changes:
 *
 *   npm run warm-cache -w @luvani/tutor-agent
 *
 * Rerunning is free: cached lines are skipped.
 *
 * WHICH VOICES. The learner chooses from eight, and the voice is part of the
 * cache key, so warming is per voice with no sharing between them. One voice is
 * 62 sentences and 1,618 characters; eight is about 12,900, roughly a third of
 * a Starter month's allowance. A cold clone running this command is following
 * the README rather than asking to spend that, so the default is the default
 * voice alone:
 *
 *   npm run warm-cache -w @luvani/tutor-agent                       # luc only
 *   LUVANI_WARM_VOICES=celine,emilie npm run warm-cache -w ...      # two
 *   LUVANI_WARM_VOICES=all npm run warm-cache -w ...                # all eight
 *
 * The plan is resolved in warmPlan.ts before anything is built, so a mistyped
 * key refuses at once instead of after seven voices have been paid for. The run
 * prints what it is about to cost and then what each voice actually cost.
 *
 * Changing LUVANI_TTS_VENDOR is the expensive one. The cache key carries the
 * vendor and its sample rate, so every WAV already on disk is orphaned — not
 * corrupted, just never asked for again — and the first run on the new vendor
 * pays for every line a second time. Budget a full cold warm, not a top-up.
 */

import 'dotenv/config';
import { initializeLogger, tokenize } from '@livekit/agents';
import { LESSONS, type TutorVoiceKey } from '@luvani/core';
import { APERO_FRAME, CAFE_FRAME } from '@luvani/brain';
import { buildTTS, selectedVoiceVendor, VOICE_KEY } from './voice.ts';
import { CONVO_LINES } from './convo.ts';
import { voicesToWarm, warmCost, warmPlanLine, warmVoiceLine } from './warmPlan.ts';

import { assertDevelopmentPaidTool } from './standalonePaidTool.ts';
assertDevelopmentPaidTool();

// The worker CLI does this for the agent; a standalone script must do it itself.
initializeLogger({ pretty: true, level: 'warn' });

/**
 * The same sentence splitter the voice pipeline uses at runtime. This matters:
 * our TTS declares `streaming: false`, so the framework wraps it in a stream
 * adapter that synthesizes one *sentence* at a time — which means cache keys are
 * per sentence. Warming whole multi-sentence lines fills the cache with entries
 * nothing will ever request.
 */
const splitter = new tokenize.basic.SentenceTokenizer();

function scriptedLines(): string[] {
  const lines = new Set<string>();
  const add = (text: string) => {
    for (const sentence of splitter.tokenize(text)) lines.add(sentence);
  };
  for (const lesson of LESSONS) {
    for (const turn of lesson.turns) {
      add(turn.tutor); //           the tutor's own side of the exchange
      add(turn.target); //          spoken aloud for the learner to echo
      for (const o of turn.options) add(o.text); // offered aloud at rung 2
    }
  }
  // Free conversation's scripted moments, warmed AS SPOKEN: the opener and
  // the suggestion are said in English (a new learner is never opened at in
  // French), the bridge in French. Both fixture scenes' openings too — the
  // narration is English; the multilingual voice handles it.
  add(CONVO_LINES.opener.en);
  add(CONVO_LINES.suggest.en);
  add(CONVO_LINES.bridge.spoken);
  for (const frame of [CAFE_FRAME, APERO_FRAME]) {
    add(frame.openingNarration.en);
    add(frame.openingLine.fr);
    add(frame.openingSupport.fullLine.fr);
  }
  return [...lines];
}

/**
 * Warm one voice, and report what it cost.
 *
 * A fresh CachedTTS per voice, because the voice is baked into the cache key at
 * construction; reusing one across the loop would warm the first voice eight
 * times. Its own counters, so the per-voice report is that voice's bill rather
 * than a running total, and `chars` counts only misses because a hit costs
 * nothing.
 */
async function warmVoice(voice: TutorVoiceKey, lines: readonly string[]): Promise<number> {
  // Always HTTP here, whatever the environment says.
  //
  // This script exits by letting the event loop drain, and the websocket
  // transport holds a pooled vendor socket open for up to its 180s inactivity
  // timeout — so a warm run under LUVANI_TTS_MISS_TRANSPORT=ws looks hung for
  // three minutes. That flag lives in the same .env this file loads, so "set it
  // on the agent, not on the warm run" was advice that could not be followed.
  // Pinning it is the fix; the trap is gone rather than documented.
  const cached = buildTTS({ voice, missTransport: 'http' });

  let chars = 0;
  for (const line of lines) {
    const had = cached.hits;
    await cached.synthesize(line).collect();
    const hit = cached.hits > had;
    if (!hit) chars += line.length;
    console.log(`  ${voice} ${hit ? 'cached ' : 'synthd '} ${line}`);
  }

  // Closing matters even on the HTTP path: the fish vendor holds a client the
  // process would otherwise idle on, and eight open ones is eight reasons this
  // script does not exit.
  await cached.close();

  console.log(`[warm-cache] ${warmVoiceLine(voice, { cached: cached.hits, synthesized: cached.misses, chars })}`);
  return chars;
}

async function main(): Promise<void> {
  // The plan first, because it is the only check here that is free. It reads
  // one environment variable and the catalogue, so a mistyped voice refuses
  // before a key is looked up, a vendor is constructed or a character is spent.
  let plan: TutorVoiceKey[];
  try {
    plan = voicesToWarm();
  } catch (err) {
    console.error(`[warm-cache] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // The key the *selected* vendor cannot speak without, not a literal. A fish
  // run refusing over ELEVEN_API_KEY would be a refusal about a credential it
  // was never going to send. One table in voice.ts holds the mapping.
  const key = VOICE_KEY[selectedVoiceVendor()];
  if (!process.env[key]) {
    console.error(`[warm-cache] ${key} is empty in services/tutor-agent/.env. Add it, then rerun.`);
    process.exit(1);
  }

  const lines = scriptedLines();
  const cost = warmCost(plan, lines);

  // What it is about to cost, before it costs it. Printed even for the
  // one-voice default: the habit of reading this line is what makes the eight
  // voice number land when someone does type `all`.
  console.log(`[warm-cache] ${lines.length} scripted lines: ${plan.join(', ')}`);
  console.log(`[warm-cache] ${warmPlanLine(cost)}`);

  let billed = 0;
  for (const voice of plan) billed += await warmVoice(voice, lines);

  console.log(`[warm-cache] done: ${cost.voices} ${cost.voices === 1 ? 'voice' : 'voices'}, ~${billed} chars billed`);
}

main().catch((err) => {
  console.error('[warm-cache] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
