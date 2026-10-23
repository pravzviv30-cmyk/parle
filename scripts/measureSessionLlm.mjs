/** Opt-in cost measurement for one whole mission session's LLM calls, on invented
 * French learner lines: every live turn, then the three post-session calls the
 * worker makes after the recap (curate and extract in parallel, then drills).
 * Makes real API calls and costs a few cents. It is a price measurement, not a
 * quality proof; read the printed drills and curation beside the eval suites.
 * node --experimental-strip-types scripts/measureSessionLlm.mjs <env-file> <report.json>
 *   [--analyst-model M] [--curate-model M] [--label name] [--max-usd 0.5]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { tutorSessionBrief } from '@luvani/core';
import { OpenAiResponsesBrainClient } from '../packages/brain/src/llm/openaiResponses.ts';
import { createConversation, integrateTurn, prepareTurn } from '../packages/brain/src/engine/conversation.ts';
import { missionFrame } from '../packages/brain/src/missions/frames.ts';
import { priceUsage } from '../packages/brain/src/llm/pricing.ts';
import { buildSystemBlocks } from '../packages/brain/src/prompt/system.ts';
import { buildCurationRequest } from '../packages/brain/src/curate/curate.ts';
import { buildExtractionRequest } from '../packages/brain/src/prompt/extractPrompt.ts';
import { buildDrillGenerationRequest } from '../packages/brain/src/drill/generate.ts';

const positional = []; const flags = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  if (!argv[i].startsWith('--')) { positional.push(argv[i]); continue; }
  flags[argv[i].slice(2)] = argv[i + 1]; i += 1;
}
const [envFile, reportFile] = positional;
if (!envFile || !reportFile) { console.error('Usage: measureSessionLlm.mjs <env-file> <report.json> [--analyst-model M] [--curate-model M] [--label name] [--max-usd 0.5]'); process.exit(2); }
const maxUsd = Number(flags['max-usd'] ?? 0.5);
const loaded = parseEnv(readFileSync(envFile, 'utf8'));
if (!loaded.OPENAI_API_KEY) throw new Error('The environment file has no OPENAI_API_KEY.');

// The request model is rewritten per activity here, exactly as an env override would.
let activity = null;
const models = {};
async function fetchFn(url, init) {
  const body = JSON.parse(init.body);
  if (activity === 'curate' && flags['curate-model']) body.model = flags['curate-model'];
  if ((activity === 'extract' || activity === 'drills') && flags['analyst-model']) body.model = flags['analyst-model'];
  models[activity] = body.model;
  return globalThis.fetch(url, { ...init, body: JSON.stringify(body) });
}
const client = new OpenAiResponsesBrainClient({ apiKey: loaded.OPENAI_API_KEY, turnModel: loaded.OPENAI_TURN_MODEL, liveModel: loaded.OPENAI_LIVE_MODEL }, fetchFn);

// A beginner's café mission: right answers, slips, an English reach and a help request.
const MISSION = 'mission:premier-cafe';
const LINES = [
  { type: 'spoke', text: 'Bonjour.' },
  { type: 'spoke', text: 'Je voudrais une café, s’il vous plaît.' },
  { type: 'spoke', text: 'Sur place, merci.' },
  { type: 'help' },
  { type: 'spoke', text: 'Avec du lait, please.' },
  { type: 'spoke', text: 'Et un croissant aussi.' },
  { type: 'spoke', text: 'C’est combien ?' },
  { type: 'spoke', text: 'Par carte, s’il vous plaît.' },
  { type: 'spoke', text: 'Merci, bonne journée !' },
];
const LEARNER = { cefr: 'A1', confidence: 'low', watchFor: [], lastRung: null, sessions: 0, name: null };

const calls = []; let spend = 0;
function record(kind, usage, extra = {}) {
  const priced = priceUsage(usage, models[kind] ?? usage.model);
  spend += priced.usd;
  calls.push({ kind, model: priced.pricedAs, exact: priced.exact, inputTokens: usage.inputTokens, cacheReadTokens: usage.cacheReadTokens,
    cacheWriteTokens: usage.cacheWriteTokens, outputTokens: usage.outputTokens, usd: Number(priced.usd.toFixed(6)), ...extra });
  console.log(`${kind.padEnd(8)} ${priced.pricedAs.padEnd(14)} in=${usage.inputTokens} cacheRead=${usage.cacheReadTokens} out=${usage.outputTokens} $${priced.usd.toFixed(5)}${priced.note ? ` (${priced.note})` : ''}`);
  if (spend > maxUsd) throw new Error(`Stopped: estimated spend $${spend.toFixed(4)} passed --max-usd ${maxUsd}.`);
}

const frame = missionFrame(MISSION);
let state = createConversation(frame, LEARNER, { strictness: 'balanced', maxTurns: 24, mission: true, missionId: MISSION });
const brief = tutorSessionBrief({ missionId: MISSION, seeded: false });
const spoken = [];
activity = 'turn';
for (const input of LINES) {
  const prepared = prepareTurn(state, input);
  const result = await client.turn({ ...prepared, messages: [...prepared.messages, { role: 'system', text: brief }], signal: AbortSignal.timeout(45_000) });
  const next = integrateTurn(state, input, result.turn);
  state = next.state;
  const chars = next.view.sceneReply.fr.length + (next.view.coachLine?.length ?? 0) + (next.view.narration?.fr?.length ?? 0);
  spoken.push({ fr: next.view.sceneReply.fr, coachLine: next.view.coachLine, chars });
  record('turn', result.usage, { spokenChars: chars });
}

const system = buildSystemBlocks();
const topics = state.topics.map(t => ({ en: t.en, fr: t.fr }));
// Sequential here (the worker runs curate and extract in parallel) so each request's model is unambiguous.
activity = 'curate';
const curateResult = await client.curate({ kind: 'curate', system, request: buildCurationRequest({ topics, phrases: state.phrases, learner: { cefr: 'A1', errorTags: [] }, knownPhrases: [] }) });
record('curate', curateResult.usage); const curated = curateResult.curation;
activity = 'extract';
const extractResult = await client.extract({ kind: 'extract', system, request: buildExtractionRequest({ history: state.history, knownFacts: [] }) });
record('extract', extractResult.usage); const extracted = extractResult.extraction;
activity = 'drills';
const drills = await client.drills({ kind: 'drills', system, request: buildDrillGenerationRequest({ sessionPhrases: state.phrases.slice(0, 5), profilePhrases: [], errorTags: [], topics }) });
record('drills', drills.usage, { exercises: drills.batch.exercises.length });

const byKind = Object.fromEntries(['turn', 'curate', 'extract', 'drills'].map(kind => [kind, Number(calls.filter(c => c.kind === kind).reduce((s, c) => s + c.usd, 0).toFixed(6))]));
const report = {
  startedAt: new Date().toISOString(), label: flags.label ?? null, syntheticOnly: true, mission: MISSION, learnerTurns: LINES.length, models,
  spendUsd: Number(spend.toFixed(6)), byKind, spokenCharsPerTurn: Number((spoken.reduce((s, x) => s + x.chars, 0) / spoken.length).toFixed(1)),
  calls, spoken, curation: curated, extraction: extracted, drills: drills.batch.exercises,
  costNote: 'Standard-tier list price from pricing.ts. Turns are sequential on one learner, so later turns read the prompt cache as the worker does.',
};
writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(`\n$${report.spendUsd} for the session: ${JSON.stringify(byKind)}; spoken chars per turn ${report.spokenCharsPerTurn}; ${drills.batch.exercises.length} exercises`);
