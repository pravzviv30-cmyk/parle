/** Opt-in latency measurement for the OpenAI live conversation turn, on invented French
 * learner lines: how long before the tutor's spoken line is available. Makes real API
 * calls and costs a few cents. Nothing here is a quality or accuracy proof.
 * node --experimental-strip-types scripts/measureLiveTurn.mjs <env-file> <report.json>
 *   [--reps N] [--cases id,id] [--model M] [--effort none|low|medium]
 *   [--verbosity low|medium|omit] [--service-tier priority|default]
 *   [--instructions-patch file.json] [--label name] [--list-models] [--max-usd 5]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { tutorSessionBrief } from '@luvani/core';
import { OpenAiResponsesBrainClient } from '../packages/brain/src/llm/openaiResponses.ts';
import { createConversation, prepareTurn } from '../packages/brain/src/engine/conversation.ts';
import { missionFrame } from '../packages/brain/src/missions/frames.ts';
import { priceUsage } from '../packages/brain/src/llm/pricing.ts';
import { atOffset, deltasBefore, milestones, summarise } from './liveTurnMilestones.mjs';

const USAGE = `Usage: node --experimental-strip-types scripts/measureLiveTurn.mjs <env-file> <report.json> [--reps N] [--cases id,id]
  [--model M] [--effort none|low|medium] [--verbosity low|medium|omit] [--service-tier priority|default]
  [--instructions-patch file.json] [--label name] [--list-models] [--max-usd 5]`;
const VALUE_FLAGS = new Set(['reps', 'cases', 'model', 'effort', 'verbosity', 'service-tier', 'instructions-patch', 'label', 'max-usd']);
const positional = []; const flags = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (!arg.startsWith('--')) { positional.push(arg); continue; }
  const name = arg.slice(2);
  if (name === 'list-models') flags[name] = true;
  else if (VALUE_FLAGS.has(name) && argv[i + 1] !== undefined) { flags[name] = argv[i + 1]; i += 1; }
  else { console.error(`Unknown or incomplete flag: ${arg}\n${USAGE}`); process.exit(2); }
}
const [envFile, reportFile] = positional;
if (!envFile || (!reportFile && !flags['list-models'])) { console.error(USAGE); process.exit(2); }
const oneOf = (name, allowed) => { if (flags[name] !== undefined && !allowed.includes(flags[name])) { console.error(`--${name} must be one of ${allowed.join(', ')}`); process.exit(2); } };
oneOf('effort', ['none', 'low', 'medium']); oneOf('verbosity', ['low', 'medium', 'omit']); oneOf('service-tier', ['priority', 'default']);
const reps = Number(flags.reps ?? 1);
const maxUsd = Number(flags['max-usd'] ?? 5);
if (!Number.isInteger(reps) || reps < 1 || !Number.isFinite(maxUsd) || maxUsd <= 0) { console.error('--reps must be a whole number of 1 or more and --max-usd a positive number.'); process.exit(2); }

const loaded = parseEnv(readFileSync(envFile, 'utf8'));
const env = Object.fromEntries(['OPENAI_API_KEY', 'OPENAI_LIVE_MODEL', 'OPENAI_TURN_MODEL', 'BRAIN_EFFORT'].map(key => [key, loaded[key]]));
if (!env.OPENAI_API_KEY) throw new Error('The environment file has no OPENAI_API_KEY.');
if (env.BRAIN_EFFORT) process.env.BRAIN_EFFORT = env.BRAIN_EFFORT; // the client reads it when routing

if (flags['list-models']) {
  const response = await fetch('https://api.openai.com/v1/models', { headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` } });
  if (!response.ok) throw new Error(`Listing models failed with status ${response.status}.`);
  const { data } = await response.json();
  for (const id of data.map(model => model.id).sort()) console.log(id);
  process.exit(0);
}

const patches = flags['instructions-patch'] ? JSON.parse(readFileSync(flags['instructions-patch'], 'utf8')) : [];
if (!Array.isArray(patches) || patches.some(p => typeof p?.find !== 'string' || typeof p?.replace !== 'string')) throw new Error('--instructions-patch must be a JSON array of {find, replace} strings.');

// ---- the fetch wrapper: applies the experiment flags, tees the SSE stream, never alters bytes
let call = null; // the call in flight: one at a time
const newCall = () => ({ start: performance.now(), body: null, headersMs: null, arrivals: [], text: '', usage: null, serviceTier: null });
function sideParse(block) {
  const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
  if (!data || data === '[DONE]') return;
  let event; try { event = JSON.parse(data); } catch { return; }
  if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
    call.text += event.delta;
    call.arrivals.push({ offset: call.text.length, t: performance.now() - call.start });
  } else if ((event.type === 'response.completed' || event.type === 'response.incomplete') && event.response) {
    call.usage = event.response.usage ?? null;
    call.serviceTier = event.response.service_tier ?? null;
  }
}
async function fetchFn(url, init) {
  const body = JSON.parse(init.body);
  if (flags.model) body.model = flags.model;
  if (flags.effort) body.reasoning = { effort: flags.effort };
  if (flags.verbosity === 'omit') { if (body.text) delete body.text.verbosity; }
  else if (flags.verbosity) body.text = { ...body.text, verbosity: flags.verbosity };
  if (flags['service-tier']) body.service_tier = flags['service-tier'];
  for (const { find, replace } of patches) {
    if (!body.instructions.includes(find)) throw new Error(`Instructions patch not found: ${JSON.stringify(find.slice(0, 60))}`);
    body.instructions = body.instructions.split(find).join(replace);
  }
  call.body = { model: body.model, reasoning: body.reasoning ?? null, verbosity: body.text?.verbosity ?? null,
    service_tier: body.service_tier ?? null, prompt_cache_key: body.prompt_cache_key ?? null, instructionsChars: body.instructions.length };
  call.arrivals = []; call.text = ''; // a rate-limit retry starts the stream over
  const response = await globalThis.fetch(url, { ...init, body: JSON.stringify(body) });
  call.headersMs = performance.now() - call.start;
  if (!response.ok || !response.body) return response;
  const decoder = new TextDecoder(); let buffer = '';
  const tee = new TransformStream({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, '\n');
      let cut;
      while ((cut = buffer.indexOf('\n\n')) !== -1) { sideParse(buffer.slice(0, cut)); buffer = buffer.slice(cut + 2); }
    },
    flush() { if (buffer.trim()) sideParse(buffer); },
  });
  return new Response(response.body.pipeThrough(tee), { status: response.status, statusText: response.statusText, headers: response.headers });
}
const client = new OpenAiResponsesBrainClient({ apiKey: env.OPENAI_API_KEY, turnModel: env.OPENAI_TURN_MODEL, liveModel: env.OPENAI_LIVE_MODEL }, fetchFn);

// ---- invented learner lines. Each seeds a beat and the line the character just said.
const LEARNER = { cefr: 'A1', confidence: 'low', watchFor: [], lastRung: null, sessions: 0, name: null };
const SEEDS = {
  'mission:premier-cafe': {
    'greet-and-order': [],
    'say-where': [['user', 'Bonjour, je voudrais un café, s’il vous plaît.'], ['assistant', 'Karim: Sur place ou à emporter ?']],
    pay: [['user', 'Sur place, merci.'], ['assistant', 'Karim: Ça fait deux euros. Par carte ou en espèces ?']],
  },
  'mission:hotel': {
    arrive: [],
    'show-id': [['user', 'Bonsoir, j’ai une réservation au nom de Martin.'], ['assistant', 'Martine: Très bien. Vous avez une pièce d’identité ?']],
    'ask-about-stay': [['user', 'Voilà mon passeport.'], ['assistant', 'Martine: Merci, c’est noté. Vous avez des questions ?']],
    'take-key': [['user', 'Le petit déjeuner, c’est à quelle heure ?'], ['assistant', 'Martine: De sept heures à dix heures. Voilà votre clé, la chambre est au deuxième.']],
  },
};
const CASES = [
  { id: 'cafe-clean-order', mission: 'mission:premier-cafe', beat: 'greet-and-order', text: 'Bonjour, je voudrais un café, s’il vous plaît.' },
  { id: 'cafe-gender-error', mission: 'mission:premier-cafe', beat: 'greet-and-order', text: 'Bonjour, je voudrais une café, s’il vous plaît.' },
  { id: 'cafe-conjugation-error', mission: 'mission:premier-cafe', beat: 'greet-and-order', text: 'Bonjour, nous voudrait deux cafés, s’il vous plaît.' },
  { id: 'cafe-english-reach', mission: 'mission:premier-cafe', beat: 'greet-and-order', text: 'Bonjour, can I have a croissant?' },
  { id: 'cafe-franglais', mission: 'mission:premier-cafe', beat: 'greet-and-order', text: 'Bonjour, je voudrais un coffee avec du milk, please.' },
  { id: 'cafe-help', mission: 'mission:premier-cafe', beat: 'say-where', type: 'help' },
  { id: 'cafe-long-clauses', mission: 'mission:premier-cafe', beat: 'say-where', text: 'Alors, je pense que je vais le prendre sur place parce qu’il fait froid dehors, mais si vous avez une table près de la fenêtre, ce serait parfait.' },
  { id: 'cafe-short-oui', mission: 'mission:premier-cafe', beat: 'say-where', text: 'Oui.' },
  { id: 'cafe-paying-mid-beat', mission: 'mission:premier-cafe', beat: 'pay', text: 'Voilà, je paie par carte. C’est combien ?' },
  { id: 'cafe-ask-character', mission: 'mission:premier-cafe', beat: 'pay', text: 'Et vous, Karim, vous travaillez ici depuis longtemps ?' },
  { id: 'hotel-checkin-error', mission: 'mission:hotel', beat: 'arrive', text: 'Bonsoir, j’ai un réservation au nom de Martin.' },
  { id: 'hotel-english-question', mission: 'mission:hotel', beat: 'ask-about-stay', text: 'Is breakfast included?' },
];
const wanted = flags.cases ? flags.cases.split(',') : null;
const unknown = (wanted ?? []).filter(id => !CASES.some(item => item.id === id));
if (unknown.length) { console.error(`Unknown case ids: ${unknown.join(', ')}\nKnown: ${CASES.map(item => item.id).join(', ')}`); process.exit(2); }
const cases = CASES.filter(item => !wanted || wanted.includes(item.id));

function requestFor(item) {
  const frame = missionFrame(item.mission);
  let state = createConversation(frame, LEARNER, { strictness: 'balanced', maxTurns: 24, mission: true, missionId: item.mission });
  const index = frame.beats.findIndex(beat => beat.id === item.beat);
  if (index > 0 || SEEDS[item.mission][item.beat].length) {
    state = { ...state, currentBeat: item.beat, beatStatus: Object.fromEntries(frame.beats.map((beat, i) => [beat.id, i < index ? 'done' : 'pending'])),
      history: SEEDS[item.mission][item.beat].map(([role, text]) => ({ role, text })) };
  }
  const prepared = prepareTurn(state, item.type === 'help' ? { type: 'help' } : { type: 'spoke', text: item.text });
  // As the live agent assembles it: the default persona's blocks, then the session teaching brief.
  const brief = tutorSessionBrief({ missionId: item.mission, seeded: false });
  return { ...prepared, messages: [...prepared.messages, { role: 'system', text: brief }] };
}

// ---- run
const startedAt = new Date().toISOString();
const calls = []; let spend = 0, stopped = null, failures = 0, firstBody = null;
const round = value => (value === null || value === undefined ? null : Math.round(value));
const fmt = value => (value === null || value === undefined ? '  n/a' : String(Math.round(value)).padStart(5));
console.log(`${cases.length} cases x ${reps} reps${flags.label ? `, label ${flags.label}` : ''}, spend cap $${maxUsd}`);
outer: for (let rep = 1; rep <= reps; rep += 1) {
  for (const item of cases) {
    call = newCall();
    const row = { id: item.id, rep };
    let result = null;
    try {
      const request = requestFor(item);
      call.start = performance.now();
      let spokenAt = null;
      result = await client.turn({ ...request, signal: AbortSignal.timeout(45_000), onSpokenFields: () => { spokenAt ??= performance.now() - call.start; } });
      row.fullMs = round(performance.now() - call.start);
      row.spokenFieldsMs = round(spokenAt);
      failures = 0;
    } catch (error) {
      if (String(error?.message).startsWith('Instructions patch')) throw error; // a setup mistake, not a failed call
      row.error = error?.name ?? 'Error'; row.message = String(error?.message ?? '').slice(0, 200);
      row.fullMs = round(performance.now() - call.start);
      failures += 1;
    }
    firstBody ??= call.body;
    const m = milestones(call.text);
    const at = offset => round(atOffset(call.arrivals, offset));
    const usage = call.usage ?? {};
    const input = usage.input_tokens ?? 0, cached = usage.input_tokens_details?.cached_tokens ?? 0;
    const priced = result ? priceUsage(result.usage, call.body?.model) : null;
    // A spent-but-failed call is still billed, but its usage is only on the stream; price that too.
    const rowPriced = priced ?? (call.usage ? priceUsage({ inputTokens: Math.max(0, input - cached), outputTokens: usage.output_tokens ?? 0, cacheReadTokens: cached, cacheWriteTokens: 0, model: call.body?.model }, call.body?.model) : null);
    spend += rowPriced?.usd ?? 0; // unknown models are priced at the fallback row, which overstates: safe for a cap
    const turn = result?.turn;
    Object.assign(row, {
      ttftMs: round(call.arrivals[0]?.t), headersMs: round(call.headersMs),
      ms: { coachEnd: at(m.coachEnd), coachLineEnd: at(m.coachLineEnd), narrationEnd: at(m.narrationEnd), sceneReplyStart: at(m.sceneReplyStart),
        frFirstSentenceEnd: at(m.frFirstSentenceEnd), frEnd: at(m.frEnd), sceneReplyEnd: at(m.sceneReplyEnd), streamEnd: at(m.end) },
      deltas: { beforeSceneReplyStart: deltasBefore(call.arrivals, m.sceneReplyStart), beforeFrEnd: deltasBefore(call.arrivals, m.frEnd),
        beforeSceneReplyEnd: deltasBefore(call.arrivals, m.sceneReplyEnd), total: call.arrivals.length },
      outputTokens: usage.output_tokens ?? null, reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? null,
      inputTokens: input || null, cachedTokens: cached, serviceTier: call.serviceTier,
      coachItems: turn ? turn.coach.length : null, coachChars: turn ? turn.coach.reduce((sum, c) => sum + c.quote.length + c.better.length + c.betterEn.length + c.why.length, 0) : null,
      frChars: turn ? turn.sceneReply.fr.length : null,
      costUsd: rowPriced?.exact ? Number(rowPriced.usd.toFixed(6)) : null,
      // Synthetic text only, kept so quality can be read next to the timings.
      coach: turn?.coach ?? null, coachLine: turn?.coachLine ?? null, fr: turn?.sceneReply.fr ?? null,
    });
    calls.push(row);
    console.log(`${item.id}#${rep} ${row.error ? `ERROR ${row.error}: ${row.message} ` : ''}ttft=${fmt(row.ttftMs)} coach=${fmt(row.ms.coachEnd)} reply0=${fmt(row.ms.sceneReplyStart)} fr1=${fmt(row.ms.frFirstSentenceEnd)} frEnd=${fmt(row.ms.frEnd)} replyEnd=${fmt(row.ms.sceneReplyEnd)} spoken=${fmt(row.spokenFieldsMs)} full=${fmt(row.fullMs)} ` +
      `deltas=${row.deltas.beforeSceneReplyStart ?? 'n/a'}/${row.deltas.total} out=${row.outputTokens ?? 'n/a'} cached=${cached}/${input} ${rowPriced?.exact ? `$${rowPriced.usd.toFixed(5)}` : 'cost unknown'}`);
    writeFileSync(reportFile, JSON.stringify(report(), null, 2));
    if (spend > maxUsd) { stopped = `Stopped: estimated spend $${spend.toFixed(4)} passed --max-usd ${maxUsd}.`; break outer; }
    if (failures >= 3) { stopped = 'Stopped: three calls in a row failed.'; break outer; }
  }
}

function report() {
  const ok = calls.filter(c => !c.error);
  const col = pick => ok.map(pick);
  const keys = ['coachEnd', 'coachLineEnd', 'narrationEnd', 'sceneReplyStart', 'frFirstSentenceEnd', 'frEnd', 'sceneReplyEnd', 'streamEnd'];
  const sumInput = ok.reduce((s, c) => s + (c.inputTokens ?? 0), 0), sumCached = ok.reduce((s, c) => s + c.cachedTokens, 0);
  return {
    startedAt, label: flags.label ?? null, settings: firstBody, syntheticOnly: true, stopped,
    spendUsdEstimate: Number(spend.toFixed(5)), costNote: 'Standard-tier list price from pricing.ts; unknown models are not priced.',
    calls,
    summary: {
      ttftMs: summarise(col(c => c.ttftMs)), headersMs: summarise(col(c => c.headersMs)),
      ...Object.fromEntries(keys.map(key => [key, summarise(col(c => c.ms[key]))])),
      spokenFieldsMs: summarise(col(c => c.spokenFieldsMs)), fullMs: summarise(col(c => c.fullMs)),
      deltasBeforeSceneReplyStart: summarise(col(c => c.deltas.beforeSceneReplyStart)),
      deltasBeforeFrEnd: summarise(col(c => c.deltas.beforeFrEnd)),
      deltasBeforeSceneReplyEnd: summarise(col(c => c.deltas.beforeSceneReplyEnd)),
      outputTokens: summarise(col(c => c.outputTokens)), reasoningTokens: summarise(col(c => c.reasoningTokens)),
      coachItems: summarise(col(c => c.coachItems)), coachChars: summarise(col(c => c.coachChars)), frChars: summarise(col(c => c.frChars)),
    },
    gains: {
      frEndVsSceneReplyEnd: summarise(col(c => (c.ms.sceneReplyEnd !== null && c.ms.frEnd !== null ? c.ms.sceneReplyEnd - c.ms.frEnd : null))),
      firstSentenceVsFrEnd: summarise(col(c => (c.ms.frEnd !== null && c.ms.frFirstSentenceEnd !== null ? c.ms.frEnd - c.ms.frFirstSentenceEnd : null))),
    },
    cacheHitRate: sumInput === 0 ? null : Number((sumCached / sumInput).toFixed(3)),
  };
}

const final = report();
writeFileSync(reportFile, JSON.stringify(final, null, 2));
const s = final.summary;
console.log(`\n${final.calls.length} calls, ${final.calls.filter(c => c.error).length} failed, est. spend $${final.spendUsdEstimate}${final.calls.some(c => c.costUsd === null) ? ' (cost unknown for some calls)' : ''}, cache hit ${final.cacheHitRate ?? 'n/a'}`);
console.log(`settings: ${JSON.stringify(final.settings)}`);
if (stopped) console.log(stopped);
console.log('milestone (ms)           n    p50    p95');
for (const [name, row] of [['ttft', s.ttftMs], ['coachEnd', s.coachEnd], ['sceneReplyStart', s.sceneReplyStart], ['frFirstSentenceEnd', s.frFirstSentenceEnd],
  ['frEnd', s.frEnd], ['sceneReplyEnd (stream)', s.sceneReplyEnd], ['sceneReplyEnd (spoken)', s.spokenFieldsMs], ['full', s.fullMs]]) {
  console.log(`${name.padEnd(24)}${String(row.n).padStart(2)} ${fmt(row.p50)}  ${fmt(row.p95)}`);
}
console.log(`deltas before sceneReply: p50 ${s.deltasBeforeSceneReplyStart.p50 ?? 'n/a'}, p95 ${s.deltasBeforeSceneReplyStart.p95 ?? 'n/a'} (p50 ${s.deltasBeforeSceneReplyEnd.p50 ?? 'n/a'} to the end of sceneReply)`);
console.log(`gain if spoken at frEnd instead of sceneReplyEnd: p50 ${fmt(final.gains.frEndVsSceneReplyEnd.p50)} ms; at first sentence instead of frEnd: p50 ${fmt(final.gains.firstSentenceVsFrEnd.p50)} ms`);
if (stopped || final.calls.some(c => c.error)) process.exitCode = 1;
