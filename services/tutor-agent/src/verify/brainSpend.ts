/**
 * The F101 measurement checkpoint: what a session actually costs the brain.
 *
 * Runs two real sessions against the configured brain — one full, one short —
 * and prints the `[parle:brain:summary]` line for each. That line is what the
 * F101 decision rules in docs/KNOWN_ISSUES.md are read against, and until it
 * exists the analyst routing is being tuned on an estimate.
 *
 * Microphone free and text mode, so no speech vendor is touched: brain spend is
 * the only thing being measured and the only thing F101 decides on. A real
 * ParleConversation is driven exactly the way convo.test.ts drives one, with a
 * live client in place of the mock, so the numbers come from the same code path
 * a learner runs and not from a rehearsal of it.
 *
 * Needs real keys, so like every other verify script it is NOT part of the gate.
 *
 *   npm run verify:spend
 *
 * Costs real money — a handful of cents — and says so before it spends any.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import dotenv from 'dotenv';

// The worker's own .env, not the repo root's: this script can be run from
// anywhere, and the key it needs lives with the service that normally reads it.
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

import { createProfile } from '@parle/brain';
import { encodeMessage, type ClientMessage } from '@parle/core';

import { ParleConversation } from '../convo.ts';

/** Anything pointed at the token server is a debit, and a debit is not the subject. */
const DEBIT_HOSTS = ['127.0.0.1', 'localhost'];

/**
 * Answer the token server, let everything else reach the wire.
 *
 * The debit is stubbed for two reasons: a checkpoint must not spend a real
 * learner's minutes, and `reportUsage` otherwise retries three times with
 * backoff against a server nobody started, which would add half a minute of
 * nothing to every run.
 */
function stubDebitOnly(): void {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init?: unknown) => {
    const url = String(typeof input === 'string' ? input : ((input as { url?: string })?.url ?? ''));
    if (DEBIT_HOSTS.some((host) => url.includes(host))) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ secondsRemaining: 600 }),
      } as never;
    }
    return real(input as never, init as never);
  }) as typeof fetch;
}

/** The half of AgentSession a voiceless conversation actually reaches for. */
function stubSession() {
  const said: string[] = [];
  return {
    session: {
      generateReply() {},
      say(text: string) {
        said.push(text);
      },
    } as never,
    said,
  };
}

function tapped(message: ClientMessage): Uint8Array {
  return encodeMessage(message);
}

/** One session: choose a topic, take N turns, then leave. */
async function runSession(label: string, topic: string, turns: readonly string[]): Promise<void> {
  console.log(`\n===== ${label} — ${turns.length} learner turns =====`);
  const convo = new ParleConversation(createProfile(), {
    voiceless: true,
    setSttLanguage: () => {},
  });
  const { session } = stubSession();
  Object.defineProperty(convo, 'session', { value: session, configurable: true });
  convo.sessionId = `checkpoint-${label.toLowerCase()}`;
  convo.attach(() => {});

  convo.open(session);
  // The first `say` is the learner choosing what to talk about. This is the
  // frame call — the one they audibly wait through before the scene opens.
  const frameStarted = Date.now();
  await convo.handleClientMessage(session, tapped({ t: 'say', text: topic }));
  console.log(`  frame ${Date.now() - frameStarted}ms`);

  for (const [index, text] of turns.entries()) {
    const started = Date.now();
    await convo.handleClientMessage(session, tapped({ t: 'say', text }));
    console.log(`  turn ${index + 1}/${turns.length} ${Date.now() - started}ms`);
  }

  // Leaving runs the recap, the debit, the three analyst calls and then the
  // summary. Everything this checkpoint is for happens after this line.
  const closing = Date.now();
  await convo.handleClientMessage(session, tapped({ t: 'leave' }));
  console.log(`  close (recap + analyst) ${Date.now() - closing}ms`);
}

const TOPIC = 'commander un café dans un café à Lyon';

/**
 * Twelve turns, which is `CONVO_MAX_TURNS`, so the full run is a whole scene
 * rather than a sample of one. One turn is deliberately English: that is the
 * `english-to-french` path, and it is a normal thing for a learner to do.
 */
const FULL_TURNS = [
  'Bonjour ! Je voudrais un café, s’il vous plaît.',
  'Un café au lait, et un croissant aussi.',
  'Oui, pour manger ici. Il fait beau aujourd’hui.',
  'Je travaille dans un bureau pas loin d’ici.',
  'Je suis informaticien. Et vous, vous aimez ce quartier ?',
  'Ma sœur vient me voir ce week-end, je suis content.',
  'Elle habite à Lyon, elle arrive samedi matin.',
  'On va peut-être visiter un musée, si elle veut.',
  'I am not sure how to say that I want to book a table.',
  'Merci beaucoup ! Je vais réserver pour deux personnes.',
  'À samedi alors. Combien je vous dois ?',
  'Voilà. Bonne journée à vous !',
];

/** The session that decides whether a short visit still pays the whole tax. */
const SHORT_TURNS = ['Bonjour, un café s’il vous plaît.', 'Merci, au revoir !'];

if (process.env.OPENAI_API_KEY === undefined && process.env.ANTHROPIC_API_KEY === undefined) {
  console.error('No brain key in the environment. This script spends real money and needs a real key.');
  process.exit(1);
}

console.log(`brain: ${process.env.TUTOR_LLM ?? 'anthropic (default)'} — two sessions, real calls, real spend.`);
stubDebitOnly();

await runSession('FULL', TOPIC, FULL_TURNS);
await runSession('SHORT', TOPIC, SHORT_TURNS);

console.log('\nRead the two [parle:brain:summary] lines above against the F101 rules in docs/KNOWN_ISSUES.md.');
console.log('If either line reports abandoned>0, the split is a floor and the checkpoint is void.');
