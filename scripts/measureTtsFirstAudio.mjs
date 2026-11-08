#!/usr/bin/env node
/**
 * How long until ElevenLabs' FIRST AUDIO FRAME arrives through Luvani's own TTS stack, for each of the two
 * cache-miss transports ('http' and 'ws')? Opt-in, dev-only, never imported by the app.
 *
 * What it measures: vendor first audio through the CachedTTS wrapper (buildTTS in voice.ts), called straight
 * at ElevenLabs with the real key, OFF the paid proxy, from a developer machine. It is NOT phone-audible
 * latency (no LiveKit, no network to a handset, no jitter buffer) and NOT a quality claim. It BILLS ElevenLabs
 * characters: --max-chars (default 3000) caps the total across transports and reps, refused up front.
 *
 * The decision it informs: the ws transport cannot run on staging until the paid proxy has a websocket
 * route. This number says whether that work is worth doing. The first sentence of a ws run opens the socket
 * (reported as `cold`); later sentences ride the warm socket (p50/p95). Sentences run one at a time, and are
 * non-authored so the disk cache is never read or written (asserted at startup).
 *
 *   node --experimental-strip-types scripts/measureTtsFirstAudio.mjs <tutor .env file> <report.json> \
 *     [--transports http,ws] [--reps 1] [--max-chars 3000] [--voice alexandre]
 *
 * Needs ELEVEN_API_KEY in the env file. The key is never printed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

export const TRANSPORTS = ['http', 'ws'];
export const DEFAULT_MAX_CHARS = 3000;

/** Natural café/hotel tutor replies, 40 to 90 characters, none of them authored lines. */
export const SENTENCES = [
  'Très bien, et vous prenez votre café avec du sucre ?',
  'Désolé, nous n’avons plus de croissants ce matin, mais il reste des pains au chocolat.',
  'Votre chambre est au deuxième étage, juste à côté de l’ascenseur.',
  'Le petit déjeuner est servi de sept heures à dix heures dans la salle du fond.',
  'Vous préférez une table près de la fenêtre ou sur la terrasse ?',
  'Je vous apporte l’addition tout de suite, un instant s’il vous plaît.',
  'Voulez-vous que je vous réserve un taxi pour demain matin ?',
  'Ce sera un thé citron et une tarte aux pommes, c’est bien ça ?',
  'La clé de votre chambre est à la réception, vous pouvez la prendre ce soir.',
  'Nous avons un menu du jour à quatorze euros, entrée, plat et dessert.',
  'Attention, le café est très chaud, je pose la tasse devant vous.',
  'Merci beaucoup, bonne journée et à très bientôt dans notre petit hôtel !',
];

export function parseArgs(argv) {
  const positional = [];
  const flags = { transports: [...TRANSPORTS], reps: 1, maxChars: DEFAULT_MAX_CHARS, voice: 'alexandre', help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') flags.help = true;
    else if (a === '--transports') flags.transports = String(argv[++i] ?? '').split(',').filter(Boolean);
    else if (a === '--reps') flags.reps = Number(argv[++i]);
    else if (a === '--max-chars') flags.maxChars = Number(argv[++i]);
    else if (a === '--voice') flags.voice = argv[++i];
    else if (a.startsWith('--')) throw new Error(`Unknown flag ${a}.`);
    else positional.push(a);
  }
  if (!flags.transports.length || flags.transports.some((t) => !TRANSPORTS.includes(t))) throw new Error('--transports takes http, ws or http,ws.');
  if (!Number.isInteger(flags.reps) || flags.reps < 1) throw new Error('--reps needs a whole number of 1 or more.');
  if (!(flags.maxChars > 0)) throw new Error('--max-chars needs a positive number.');
  if (!flags.voice) throw new Error('--voice needs a voice key.');
  return { envFile: positional[0], reportFile: positional[1], ...flags };
}

/** Nearest-rank percentile; null for an empty list. */
export function percentile(values, p) {
  const v = values.filter((x) => x != null).sort((a, b) => a - b);
  return v.length ? v[Math.max(0, Math.ceil((p / 100) * v.length) - 1)] : null;
}

/** Characters this run will bill: every sentence, on every transport, on every rep. */
export function plannedChars(sentences, transports, reps) {
  return sentences.reduce((n, s) => n + s.length, 0) * transports.length * reps;
}

export function checkSpend(sentences, transports, reps, maxChars) {
  const chars = plannedChars(sentences, transports, reps);
  if (chars > maxChars) throw new Error(`This run would bill ${chars} characters, over --max-chars ${maxChars}.`);
  return chars;
}

/** Throws if any test sentence is an authored line (those would be cached on disk, and not measure a miss). */
export function assertNotAuthored(sentences, authoredLines, normalise) {
  const authored = new Set(authoredLines.map(normalise));
  const hit = sentences.filter((s) => authored.has(normalise(s)));
  if (hit.length) throw new Error(`Test sentence is an authored line: ${hit[0]}`);
}

/**
 * samples: every sentence of one transport in order, { chars, firstFrameMs, lastFrameMs }, across all reps.
 * `cold` is the first sentence of each rep (the one that opens the socket); p50/p95 are over the rest.
 */
export function summariseTransport(samples, reps = 1) {
  const per = samples.length / reps;
  const isCold = (_, i) => i % per === 0;
  const cold = samples.filter(isCold).map((s) => s.firstFrameMs);
  const warm = samples.filter((s, i) => !isCold(s, i));
  const first = warm.map((s) => s.firstFrameMs);
  return {
    samples: samples.map((s) => ({ textLength: s.chars, firstFrameMs: s.firstFrameMs, lastFrameMs: s.lastFrameMs })),
    cold: reps === 1 ? cold[0] ?? null : cold,
    p50: percentile(first, 50),
    p95: percentile(first, 95),
    lastFrameP50: percentile(warm.map((s) => s.lastFrameMs), 50),
  };
}

export function buildReport({ generatedAt, model, voice, byTransport, reps = 1 }) {
  return {
    generatedAt, model, voice,
    transports: Object.fromEntries(Object.entries(byTransport).map(([t, samples]) => [t, summariseTransport(samples, reps)])),
  };
}

export function formatTable(report) {
  return Object.entries(report.transports).map(([t, r]) => ({
    transport: t, n: r.samples.length, 'cold first-frame ms': r.cold,
    'warm first-frame p50': r.p50, 'warm first-frame p95': r.p95, 'last-frame p50': r.lastFrameP50,
  }));
}

/** Times one synthesize() call from the call to the first and the last SynthesizedAudio packet. */
export async function timeSynthesis(cached, text, now = () => performance.now()) {
  const start = now();
  let firstFrameMs = null, lastFrameMs = null;
  for await (const _audio of cached.synthesize(text)) {
    lastFrameMs = Math.round(now() - start);
    firstFrameMs ??= lastFrameMs;
  }
  if (firstFrameMs == null) throw new Error('No audio came back for a sentence.');
  return { chars: text.length, firstFrameMs, lastFrameMs };
}

async function main(argv) {
  const usage = 'usage: node --experimental-strip-types scripts/measureTtsFirstAudio.mjs <tutor .env file> <report.json> [--transports http,ws] [--reps 1] [--max-chars 3000] [--voice alexandre]';
  let flags;
  try { flags = parseArgs(argv); } catch (e) { console.error(`${e.message}\n${usage}`); process.exit(2); }
  if (flags.help || !flags.envFile || !flags.reportFile) { console.error(usage); process.exit(2); }

  const key = parseEnv(readFileSync(flags.envFile, 'utf8')).ELEVEN_API_KEY;
  if (!key) throw new Error('ELEVEN_API_KEY is missing from the env file.');
  process.env.ELEVEN_API_KEY = key;
  // The measurement is of plain requests; an exported switch would stitch every sentence after the first.
  delete process.env.LUVANI_TTS_STITCH;

  const { AUTHORED_SPEECH_LINES } = await import('../services/tutor-agent/src/authoredSpeech.ts');
  const { normaliseLine } = await import('../services/tutor-agent/src/ttsCache.ts');
  assertNotAuthored(SENTENCES, AUTHORED_SPEECH_LINES, normaliseLine);
  const chars = checkSpend(SENTENCES, flags.transports, flags.reps, flags.maxChars);
  // The plugin logs through the framework logger, which must exist before any TTS is built.
  const agents = await import(pathToFileURL(createRequire(join(ROOT, 'services/tutor-agent/package.json')).resolve('@livekit/agents')).href);
  agents.initializeLogger({ pretty: false, level: 'error' });
  const { buildTTS, MODEL } = await import('../services/tutor-agent/src/voice.ts');

  console.log(`Billing about ${chars} ElevenLabs characters (cap ${flags.maxChars}).`);
  const byTransport = Object.fromEntries(flags.transports.map((t) => [t, []]));
  for (const missTransport of flags.transports) {
    for (let rep = 0; rep < flags.reps; rep++) {
      const cached = buildTTS({ voice: flags.voice, missTransport });
      try {
        for (const text of SENTENCES) {
          const s = await timeSynthesis(cached, text);
          byTransport[missTransport].push(s);
          console.log(`${missTransport} rep ${rep + 1}: first ${s.firstFrameMs} ms, last ${s.lastFrameMs} ms`);
        }
      } finally {
        await cached.close();
      }
    }
  }
  const report = buildReport({ generatedAt: new Date().toISOString(), model: MODEL, voice: flags.voice, byTransport, reps: flags.reps });
  writeFileSync(flags.reportFile, JSON.stringify(report, null, 2));
  console.table(formatTable(report));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
}
