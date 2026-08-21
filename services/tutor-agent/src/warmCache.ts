/**
 * Warm the voice cache.
 *
 * Synthesizes every scripted line of every lesson once, so the first learner
 * session plays entirely from disk and the vendor bill for lesson content is a
 * one-off measured in cents. Run it after keys land, and again whenever lesson
 * text or the configured voice changes:
 *
 *   npm run warm-cache -w @parle/tutor-agent
 *
 * Rerunning is free: cached lines are skipped.
 */

import 'dotenv/config';
import { initializeLogger, tokenize } from '@livekit/agents';
import { LESSONS } from '@parle/core';
import { APERO_FRAME, CAFE_FRAME } from '@parle/brain';
import { buildTTS } from './voice.ts';
import { CONVO_LINES } from './convo.ts';

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

async function main(): Promise<void> {
  if (!process.env.ELEVEN_API_KEY) {
    console.error('[warm-cache] ELEVEN_API_KEY is empty in services/tutor-agent/.env. Add it, then rerun.');
    process.exit(1);
  }

  // Always HTTP here, whatever the environment says.
  //
  // This script exits by letting the event loop drain, and the websocket
  // transport holds a pooled vendor socket open for up to its 180s inactivity
  // timeout — so a warm run under PARLE_TTS_MISS_TRANSPORT=ws looks hung for
  // three minutes. That flag lives in the same .env this file loads, so "set it
  // on the agent, not on the warm run" was advice that could not be followed.
  // Pinning it is the fix; the trap is gone rather than documented.
  const cached = buildTTS({ missTransport: 'http' });
  const lines = scriptedLines();
  console.log(`[warm-cache] ${lines.length} scripted lines, cache dir ${cached.opts.dir}`);

  let chars = 0;
  for (const line of lines) {
    const had = cached.hits;
    await cached.synthesize(line).collect();
    const hit = cached.hits > had;
    if (!hit) chars += line.length;
    console.log(`  ${hit ? 'cached ' : 'synthd '} ${line}`);
  }

  console.log(`[warm-cache] done: ${cached.hits} already cached, ${cached.misses} synthesized (~${chars} chars billed)`);
}

main().catch((err) => {
  console.error('[warm-cache] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
