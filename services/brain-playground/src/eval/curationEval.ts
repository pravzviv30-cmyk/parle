/**
 * The curation eval: does the practice editor keep the right five?
 *
 *   npm run eval:curation -w @luvani/brain-playground
 *
 * Phase 4 proved a practice batch survives a crash, a full disk and a retry.
 * Nothing proved the batch was worth surviving. This run is the other half:
 * twelve phrases go in, the model picks at most five, and the five it kept are
 * scored against the seven it dropped.
 *
 * ## The standard, and where it comes from
 *
 * There is exactly one written statement in this repo of what curation should
 * keep, and it is the prompt's own instruction in packages/brain/src/curate:
 * "the ones this learner would genuinely reach for again", and "prefer what
 * they struggled toward or asked for over pleasantries and filler". So that is
 * the standard measured here, and nothing grander. Every fixture phrase carries
 * one of three labels applied when the fixture was written:
 *
 *   reach  (+1)  the task language of the scene. The learner needed this line
 *                to get the thing done, reached for it, or asked how to say it.
 *   filler ( 0)  formulaic social lubricant. Real French, already automatic,
 *                and a keep slot spent here teaches nothing tomorrow.
 *   known  (-1)  the evidence record already calls it used. Strictly worse than
 *                filler because `applyCuration` refuses it outright, so a model
 *                that asks for one has misread the session.
 *
 * Those numbers are a RANK, not a quality bar. They encode the ordering the
 * instruction states and nothing else, which is why the run's pass condition is
 * directional — the kept must outrank the dropped — and carries no magnitude.
 * A curator with no signal, keeping a uniformly random five of twelve, has an
 * expected separation of exactly zero, so any positive separation is real
 * signal. What separation is GOOD ENOUGH is a product decision nobody has made,
 * and inventing a threshold here would dress a guess as a measurement. The
 * number is printed every run so that decision has data when someone takes it.
 *
 * ## What the labels are not
 *
 * They are one person's reading of twelve phrases, written down so they can be
 * argued with, not a validated instrument. The fixtures are deliberately
 * unambiguous at the ends ("bonjour" against "je peux payer par carte ?") and
 * carry no borderline cases, because a borderline case would measure the
 * labeller rather than the editor. `because` on each label is the argument, and
 * it prints beside any phrase the run disagrees about.
 *
 * ## Two scores, because code disposes
 *
 * `applyCuration` drops known phrases itself, so a kept set can never contain
 * one and scoring only the kept set would credit the prompt with work the code
 * did. The run therefore reports both: `proposedSeparation` over what the model
 * ASKED to keep, which scores the prompt, and `keptSeparation` over what became
 * a card, which scores what the learner actually gets. The run fails on the
 * second. When the first is flat and the second is not, the report says so in
 * as many words, because that is code carrying a prompt that stopped working.
 *
 * ## What this run does not prove
 *
 * The eval supplies `knownPhrases` itself. The agent side that reads the
 * evidence record and supplies them at runtime is wired separately and has its
 * own proof; a green run here says curate.ts honours the list, never that
 * anybody passed it one.
 *
 * With no API key this prints BLOCKED, names every check that stays unmeasured,
 * and exits non-zero. It never passes quietly.
 */

import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  AnthropicBrainClient,
  MAX_CURATED_TOPICS,
  MAX_EXTENSION_PHRASES,
  MAX_KEPT_PHRASES,
  OpenAiCompatBrainClient,
  OpenAiResponsesBrainClient,
  applyCuration,
  buildCurationRequest,
  buildSystemBlocks,
  extensionViolations,
  type Curation,
  type LlmClient,
  type NewPhrase,
} from '@luvani/brain';

import { addUsage, evalCostUsd, ZERO_USAGE } from '../usage.ts';
import { openAiEvalModel } from './openaiEval.ts';

// ---------------------------------------------------------------------------
// The standard
// ---------------------------------------------------------------------------

export type Worth = 'reach' | 'filler' | 'known';

/** The rank the curation instruction states. An ordering, not a quality bar. */
export const WORTH_VALUE: Record<Worth, number> = { reach: 1, filler: 0, known: -1 };

export interface LabelledPhrase {
  readonly phrase: NewPhrase;
  /** Where this phrase sits in the instruction's stated preference order. */
  readonly worth: Worth;
  /** The argument for the label, printed whenever the run disagrees with it. */
  readonly because: string;
}

export interface CurationFixture {
  readonly id: string;
  readonly label: string;
  readonly topics: readonly { en: string; fr: string }[];
  readonly learner: { cefr: string; errorTags: readonly string[] };
  /** Twelve, so a five-phrase cap forces a real choice rather than a copy. */
  readonly phrases: readonly LabelledPhrase[];
}

/** The checks a live run makes. A check leaves this list when its risk is gone. */
export const CURATION_CHECKS = [
  {
    id: 'keeps-beat-drops',
    title: 'the kept phrases outrank the dropped ones',
    why: 'a batch worth surviving the disk is a batch whose contents beat what it left behind',
  },
  {
    id: 'known-phrases-spend-no-slot',
    title: 'nothing the evidence record already calls used becomes a card',
    why: 'a keep slot spent re-teaching what the learner produces unprompted is the slot they needed most',
  },
  {
    id: 'cards-are-grounded',
    title: 'every card is a phrase the session recorded or a gated extension',
    why: 'practice for a conversation that never happened is the failure the editor exists to prevent',
  },
  {
    id: 'caps-hold',
    title: 'at most five phrases, two extensions and three topics survive',
    why: 'the card flood is what curation was built to stop, and the caps are the only thing stopping it',
  },
  {
    id: 'extensions-pass-the-gate',
    title: 'every authored extension on a card passes extensionViolations',
    why: 'an extension is the one string in the post-session path with nothing between it and the deck',
  },
] as const;

export type CurationCheckId = (typeof CURATION_CHECKS)[number]['id'];

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function phrase(
  fr: string,
  en: string,
  register: NewPhrase['register'],
  extra: { frWritten?: string; enLiteral?: string; note?: string } = {},
): NewPhrase {
  return {
    fr,
    frWritten: extra.frWritten ?? null,
    en,
    enLiteral: extra.enLiteral ?? null,
    register,
    note: extra.note ?? null,
  };
}

const reach = (p: NewPhrase, because: string): LabelledPhrase => ({ phrase: p, worth: 'reach', because });
const filler = (p: NewPhrase, because: string): LabelledPhrase => ({ phrase: p, worth: 'filler', because });
const known = (p: NewPhrase, because: string): LabelledPhrase => ({ phrase: p, worth: 'known', because });

/**
 * Two sessions, twelve phrases each: five that carried the task, five that were
 * social furniture, two the evidence record already calls used. The split is
 * fixed across both fixtures so the two runs are comparable.
 */
export const CURATION_FIXTURES: readonly CurationFixture[] = [
  {
    id: 'cafe-first-session',
    label: 'a café order that needed three real negotiations',
    topics: [
      { en: 'Ordering at a café', fr: 'Commander au café' },
      { en: 'Paying', fr: 'Le paiement' },
    ],
    learner: { cefr: 'A1', errorTags: ['ne-retention'] },
    // Conversation order, not value order. A fixture sorted best-first would let
    // the deterministic fallback take the top five and score perfectly without
    // choosing anything, which measures the fixture rather than the editor.
    phrases: [
      filler(phrase('bonjour', 'hello', 'courant'),
        'automatic already, and a card for it teaches nothing tomorrow'),
      known(phrase('je voudrais un café', 'I would like a coffee', 'courant'),
        'the evidence record calls this used; they produced it unprompted in an earlier session'),
      reach(phrase('sur place, s’il vous plaît', 'for here, please', 'courant', { enLiteral: 'on the spot, please' }),
        'the counter asks every customer this and the learner froze on it'),
      reach(phrase('il vous reste des croissants ?', 'do you have any croissants left?', 'courant'),
        'they asked how to say this mid-turn, which is the instruction word for word'),
      reach(phrase('c’est quoi la différence entre les deux ?', 'what is the difference between the two?', 'familier'),
        'they struggled toward it for two turns before getting it out'),
      filler(phrase('d’accord', 'okay', 'courant'),
        'a backchannel; keeping it spends a slot on agreement noise'),
      reach(phrase('je vais prendre celui-là', 'I will take that one', 'courant'),
        'the line that closed the order, and it transfers to every counter in France'),
      reach(phrase('je peux payer par carte ?', 'can I pay by card?', 'courant'),
        'the learner had no cash and had to ask; the order stalls without this line'),
      known(phrase('ça marche', 'works for me', 'familier', { enLiteral: 'it walks' }),
        'also on the used list, so a keep slot here re-teaches what they already reach for'),
      filler(phrase('oui, voilà', 'yes, exactly', 'familier'),
        'agreement noise again, and the learner never had to work for it'),
      filler(phrase('merci beaucoup', 'thank you very much', 'courant'),
        'formulaic politeness the learner produced without hesitating'),
      filler(phrase('au revoir', 'goodbye', 'courant'),
        'the same: social furniture, not language they reached for'),
    ],
  },
  {
    id: 'weekend-plans-returning',
    label: 'a returning learner making weekend plans with a friend',
    topics: [
      { en: 'Making weekend plans', fr: 'Organiser le week-end' },
      { en: 'Turning an invitation down', fr: 'Refuser une invitation' },
    ],
    learner: { cefr: 'A2', errorTags: ['tu-vous-mixing', 'ne-retention'] },
    phrases: [
      filler(phrase('salut', 'hi', 'familier'),
        'automatic; a card for it is a card wasted'),
      filler(phrase('ça va ?', 'how are you?', 'familier'),
        'the opening formula, produced without a pause'),
      known(phrase('carrément', 'totally', 'familier'),
        'on the used list; they reach for it unprompted'),
      reach(phrase('ça te dit d’aller au ciné ?', 'do you fancy going to the cinema?', 'familier', { enLiteral: 'does it say to you to go to the cinema?' }),
        'the invitation itself; the whole conversation needed it and they asked for it'),
      filler(phrase('ah bon', 'oh really', 'familier'),
        'a reaction noise; it carries no task'),
      reach(phrase('je peux pas, j’ai un truc', 'I cannot, I have a thing', 'familier', { frWritten: 'je ne peux pas, j’ai un truc' }),
        'turning something down without offence, which is what they came to practise'),
      reach(phrase('ça m’arrange mieux', 'that suits me better', 'courant'),
        'negotiating a time is the task, and this is the line that does it'),
      reach(phrase('on se dit ça demain ?', 'shall we settle it tomorrow?', 'familier'),
        'they struggled toward leaving a plan open and got there on the third try'),
      filler(phrase('super', 'great', 'courant'),
        'enthusiasm filler, already automatic'),
      known(phrase('t’as faim ?', 'are you hungry?', 'familier', { frWritten: 'tu as faim ?' }),
        'also used, so curation owes them a new phrase instead'),
      reach(phrase('je te tiens au courant', 'I will keep you posted', 'courant'),
        'closes an unfinished plan, and it transfers to work and family alike'),
      filler(phrase('à plus', 'see you', 'familier'),
        'the closing formula, same story'),
    ],
  },
];

export function knownPhrasesOf(fixture: CurationFixture): string[] {
  return fixture.phrases.filter((p) => p.worth === 'known').map((p) => p.phrase.fr);
}

export function sessionPhrasesOf(fixture: CurationFixture): NewPhrase[] {
  return fixture.phrases.map((p) => p.phrase);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const keyOf = (fr: string): string => fr.trim().toLowerCase();

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

export interface CurationProblem {
  readonly check: CurationCheckId;
  readonly detail: string;
}

export interface CurationScore {
  readonly fixtureId: string;
  /** Fixture phrases that became a card, in card order. */
  readonly kept: readonly string[];
  /** Fixture phrases that did not. */
  readonly dropped: readonly string[];
  /** Fixture phrases the model ASKED to keep, before code disposed of them. */
  readonly proposed: readonly string[];
  /** Mean worth of the kept minus mean worth of the dropped. The run's verdict. */
  readonly keptSeparation: number;
  /** The same over the raw proposal. Scores the prompt rather than the pipeline. */
  readonly proposedSeparation: number;
  readonly reachKept: number;
  readonly reachTotal: number;
  /** Used phrases the model asked for. Code refused them; the prompt still asked. */
  readonly knownProposed: number;
  /** Used phrases that reached a card. Contractually zero. */
  readonly knownKept: number;
  /** Phrase strings the model named that the session never recorded. */
  readonly ungroundedProposals: number;
  readonly extensionsOffered: number;
  /** Offered extensions that would fail the content gate. */
  readonly extensionsUnclean: number;
  readonly extensionsOnCards: number;
  readonly topicCount: number;
  readonly problems: readonly CurationProblem[];
  readonly ok: boolean;
}

/**
 * Score one curation proposal against its fixture.
 *
 * Runs `applyCuration` itself rather than accepting a topic list, so a score is
 * always a score of what the shipping code would really produce. `raw` may be
 * null, which is the call-failed path: the deterministic fallback still has to
 * beat its own drops.
 */
export function scoreCuration(fixture: CurationFixture, raw: Curation | null): CurationScore {
  const worthByKey = new Map<string, LabelledPhrase>();
  for (const labelled of fixture.phrases) worthByKey.set(keyOf(labelled.phrase.fr), labelled);

  const topics = applyCuration(raw, sessionPhrasesOf(fixture), fixture.topics, knownPhrasesOf(fixture));
  const cards = topics.flatMap((topic) => topic.phrases);

  const keptKeys: string[] = [];
  const seen = new Set<string>();
  const extensionCards: NewPhrase[] = [];
  const problems: CurationProblem[] = [];

  const offered = raw === null ? [] : raw.topics.flatMap((topic) => topic.extensions);
  const offeredKeys = new Set(offered.map((extension) => keyOf(extension.fr)));

  for (const card of cards) {
    const key = keyOf(card.fr);
    if (seen.has(key)) {
      problems.push({ check: 'cards-are-grounded', detail: `"${card.fr}" appears on two cards` });
      continue;
    }
    seen.add(key);
    if (worthByKey.has(key)) {
      keptKeys.push(key);
      continue;
    }
    extensionCards.push(card);
    if (!offeredKeys.has(key)) {
      problems.push({ check: 'cards-are-grounded', detail: `"${card.fr}" is on a card and the session never recorded it` });
    }
  }

  for (const extension of extensionCards) {
    const reasons = extensionViolations(extension);
    if (reasons.length > 0) {
      problems.push({ check: 'extensions-pass-the-gate', detail: `"${extension.fr}": ${reasons.join('; ')}` });
    }
  }

  const keptSet = new Set(keptKeys);
  const droppedKeys = [...worthByKey.keys()].filter((key) => !keptSet.has(key));

  const knownKept = keptKeys.filter((key) => worthByKey.get(key)?.worth === 'known');
  for (const key of knownKept) {
    const labelled = worthByKey.get(key);
    problems.push({
      check: 'known-phrases-spend-no-slot',
      detail: `"${labelled?.phrase.fr ?? key}" became a card: ${labelled?.because ?? 'already used'}`,
    });
  }

  const proposedKeys: string[] = [];
  let ungroundedProposals = 0;
  if (raw !== null) {
    const named = new Set<string>();
    for (const topic of raw.topics) {
      for (const fr of topic.phraseFr) {
        const key = keyOf(fr);
        if (key === '' || named.has(key)) continue;
        named.add(key);
        if (worthByKey.has(key)) proposedKeys.push(key);
        else ungroundedProposals += 1;
      }
    }
  }
  const proposedSet = new Set(proposedKeys);

  const valueOf = (key: string): number => WORTH_VALUE[worthByKey.get(key)?.worth ?? 'filler'];
  const keptSeparation = mean(keptKeys.map(valueOf)) - mean(droppedKeys.map(valueOf));
  const notProposed = [...worthByKey.keys()].filter((key) => !proposedSet.has(key));
  const proposedSeparation =
    proposedKeys.length === 0 ? 0 : mean(proposedKeys.map(valueOf)) - mean(notProposed.map(valueOf));

  if (keptKeys.length === 0) {
    problems.push({ check: 'keeps-beat-drops', detail: 'no phrase from the session survived, so keeps cannot beat drops' });
  } else if (keptSeparation <= 0) {
    problems.push({
      check: 'keeps-beat-drops',
      detail: `separation ${keptSeparation.toFixed(2)}: the kept phrases do not outrank the dropped ones`,
    });
  }

  if (keptKeys.length > MAX_KEPT_PHRASES) {
    problems.push({ check: 'caps-hold', detail: `${keptKeys.length} phrases kept, cap is ${MAX_KEPT_PHRASES}` });
  }
  if (extensionCards.length > MAX_EXTENSION_PHRASES) {
    problems.push({ check: 'caps-hold', detail: `${extensionCards.length} extensions kept, cap is ${MAX_EXTENSION_PHRASES}` });
  }
  if (topics.length > MAX_CURATED_TOPICS) {
    problems.push({ check: 'caps-hold', detail: `${topics.length} topics, cap is ${MAX_CURATED_TOPICS}` });
  }

  const reachTotal = fixture.phrases.filter((p) => p.worth === 'reach').length;
  const frOf = (key: string): string => worthByKey.get(key)?.phrase.fr ?? key;

  return {
    fixtureId: fixture.id,
    kept: keptKeys.map(frOf),
    dropped: droppedKeys.map(frOf),
    proposed: proposedKeys.map(frOf),
    keptSeparation,
    proposedSeparation,
    reachKept: keptKeys.filter((key) => worthByKey.get(key)?.worth === 'reach').length,
    reachTotal,
    knownProposed: proposedKeys.filter((key) => worthByKey.get(key)?.worth === 'known').length,
    knownKept: knownKept.length,
    ungroundedProposals,
    extensionsOffered: offered.length,
    extensionsUnclean: offered.filter((extension) => extensionViolations(extension).length > 0).length,
    extensionsOnCards: extensionCards.length,
    topicCount: topics.length,
    problems,
    ok: problems.length === 0,
  };
}

export interface CurationSummary {
  readonly ok: boolean;
  readonly lines: readonly string[];
}

/**
 * The honesty check, borrowed whole from the Supabase harness: a run is ok only
 * when every declared fixture produced a score. A fixture that never ran, or a
 * score for a fixture nobody declared, fails the run exactly as a bad score
 * does. Without this a run that quietly stopped halfway still exits 0.
 */
export function summariseCuration(
  scores: readonly CurationScore[],
  fixtures: readonly CurationFixture[] = CURATION_FIXTURES,
): CurationSummary {
  const byId = new Map(scores.map((score) => [score.fixtureId, score]));
  const lines: string[] = [];
  let ok = true;

  for (const fixture of fixtures) {
    const score = byId.get(fixture.id);
    if (score === undefined) {
      ok = false;
      lines.push(`MISS ${fixture.id}: never ran, so nothing is known about it`);
      continue;
    }
    if (!score.ok) ok = false;
    lines.push(
      `${score.ok ? 'ok  ' : 'FAIL'} ${fixture.id}: kept ${score.kept.length}` +
        ` (${score.reachKept}/${score.reachTotal} worth reaching for),` +
        ` separation ${score.keptSeparation.toFixed(2)} kept / ${score.proposedSeparation.toFixed(2)} proposed`,
    );
    lines.push(`       kept: ${score.kept.join(' · ') || 'nothing'}`);
    lines.push(`       dropped: ${score.dropped.join(' · ') || 'nothing'}`);
    if (score.knownProposed > 0) {
      lines.push(`       ${score.knownProposed} already-used phrase(s) asked for and refused by code`);
    }
    if (score.ungroundedProposals > 0) {
      lines.push(`       ${score.ungroundedProposals} phrase(s) named that the session never recorded`);
    }
    if (score.extensionsOffered > 0) {
      lines.push(
        `       extensions: ${score.extensionsOnCards} on cards, ${score.extensionsOffered} offered,` +
          ` ${score.extensionsUnclean} would fail the gate`,
      );
    }
    // Only when there WAS a proposal. A failed call proposed nothing, and
    // calling that a carried prompt would blame the model for a network error.
    if (score.proposed.length > 0 && score.keptSeparation > 0 && score.proposedSeparation <= 0) {
      lines.push('       the code carried the prompt here: what the model asked for did not outrank what it left');
    }
    for (const problem of score.problems) lines.push(`       ${problem.check}: ${problem.detail}`);
  }

  const declared = new Set(fixtures.map((fixture) => fixture.id));
  for (const score of scores) {
    if (declared.has(score.fixtureId)) continue;
    ok = false;
    lines.push(`UNKNOWN ${score.fixtureId}: a score for a fixture nobody declared`);
  }

  lines.push(ok ? `all ${fixtures.length} curation fixtures kept better than they dropped` : 'curation did not clear its own standard');
  return { ok, lines };
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

export type Environment = Record<string, string | undefined>;

/** Any one of these runs the eval, so "missing" means none of them is set. */
export const CREDENTIAL_ENV = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GROQ_API_KEY'] as const;

export function missingCredentials(env: Environment): string[] {
  const present = CREDENTIAL_ENV.filter((name) => {
    const value = env[name];
    return typeof value === 'string' && value.trim() !== '';
  });
  return present.length > 0 ? [] : [...CREDENTIAL_ENV];
}

/** The honest no-credentials report: what is missing, what stays unmeasured, no claim. */
export function blockedReport(missing: readonly string[]): string {
  const lines = [
    `BLOCKED: none of ${missing.join(', ')} is set, so nothing below has been measured.`,
    'Put one in services/brain-playground/.env and run this again:',
    '  npm run eval:curation -w @luvani/brain-playground',
    `Unmeasured until then (${CURATION_CHECKS.length}):`,
  ];
  for (const check of CURATION_CHECKS) lines.push(`  - ${check.id}: ${check.title}`);
  return lines.join('\n');
}

/**
 * The providers, in the order they are tried when BRAIN_LLM says nothing.
 *
 * Curation is turn-tier work — routing.ts puts it on the fast model because
 * nobody waits for it — so OpenAI is priced on the model the client really
 * sends curate to (`openAiEvalModel`, env overrides included), never on a
 * constant. Pricing it as analyst work overstates the bill by roughly ten times.
 */
const PROVIDERS = [
  { name: 'openai', key: 'OPENAI_API_KEY' },
  { name: 'anthropic', key: 'ANTHROPIC_API_KEY' },
  { name: 'groq', key: 'GROQ_API_KEY' },
] as const;

/** What the run is priced on: the model the client really uses for curate. */
export function curationCostModel(name: ProviderName, env: Environment): string {
  if (name === 'openai') return openAiEvalModel('curate', env);
  return name === 'anthropic' ? 'claude-sonnet-5' : 'groq';
}

export type ProviderName = (typeof PROVIDERS)[number]['name'];

/**
 * Which provider will answer, from the environment alone.
 *
 * Only a provider whose key is actually set can be chosen, including when
 * BRAIN_LLM names one. Falling through to another provider's absent key builds
 * a client that fails on the wire, and a wire failure would be scored as a
 * fallback deck rather than reported as the missing credential it is.
 */
export function pickProvider(env: Environment): ProviderName | null {
  const withKey = PROVIDERS.filter((provider) => {
    const value = env[provider.key];
    return typeof value === 'string' && value.trim() !== '';
  });
  const choice = (env.BRAIN_LLM ?? '').toLowerCase();
  return (withKey.find((provider) => provider.name === choice) ?? withKey[0])?.name ?? null;
}

function buildClient(name: ProviderName, env: Environment): { client: LlmClient; costModel: string } {
  const provider = PROVIDERS.find((candidate) => candidate.name === name) as (typeof PROVIDERS)[number];
  const apiKey = env[provider.key] ?? '';
  const costModel = curationCostModel(name, env);
  if (name === 'openai') return { client: new OpenAiResponsesBrainClient({ apiKey }), costModel };
  if (name === 'anthropic') return { client: new AnthropicBrainClient({ apiKey }), costModel };
  return { client: new OpenAiCompatBrainClient({ apiKey }), costModel };
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

export async function runCurationEval(options: {
  env: Environment;
  log: (line: string) => void;
}): Promise<{ ok: boolean; blocked: boolean }> {
  const missing = missingCredentials(options.env);
  if (missing.length > 0) {
    options.log(blockedReport(missing));
    return { ok: false, blocked: true };
  }

  const provider = pickProvider(options.env);
  if (provider === null) {
    // Unreachable while missingCredentials is the only gate above, and kept
    // because a blocked run that says nothing is the failure this file exists
    // to avoid.
    options.log(blockedReport([...CREDENTIAL_ENV]));
    return { ok: false, blocked: true };
  }
  const { client, costModel } = buildClient(provider, options.env);
  options.log(`curation eval on ${provider}, ${CURATION_FIXTURES.length} fixtures`);
  const scores: CurationScore[] = [];
  let usage = ZERO_USAGE;

  for (const fixture of CURATION_FIXTURES) {
    const started = Date.now();
    let raw: Curation | null = null;
    try {
      const result = await client.curate({
        kind: 'curate',
        system: buildSystemBlocks(),
        request: buildCurationRequest({
          topics: fixture.topics,
          phrases: sessionPhrasesOf(fixture),
          learner: fixture.learner,
          knownPhrases: knownPhrasesOf(fixture),
        }),
      });
      usage = addUsage(usage, result.usage);
      raw = result.curation;
    } catch (error) {
      // A failed call is not a missing result. The fallback still gets scored,
      // because a session whose curation call died still hands the learner a
      // deck and that deck is still either worth keeping or not.
      options.log(`     ${fixture.id}: the curation call failed, scoring the fallback — ${error instanceof Error ? error.message : String(error)}`);
    }
    scores.push(scoreCuration(fixture, raw));
    options.log(`     ${fixture.label} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  }

  const summary = summariseCuration(scores);
  for (const line of summary.lines) options.log(line);
  options.log(`\n~$${evalCostUsd(usage, costModel).toFixed(3)} for the run`);
  return { ok: summary.ok, blocked: false };
}

async function main(): Promise<void> {
  const dotenv = await import('dotenv');
  // The playground's own env file, not the caller's cwd, so the self-test can
  // point LUVANI_ENV_FILE somewhere empty and prove the blocked path without
  // borrowing this machine's real keys.
  const envFile = process.env.LUVANI_ENV_FILE ?? fileURLToPath(new URL('../../.env', import.meta.url));
  dotenv.config({ path: envFile, override: false, quiet: true });
  const result = await runCurationEval({ env: process.env, log: (line) => console.log(line) });
  // Blocked exits 2 and failed exits 1: both non-zero, and neither is a pass.
  process.exitCode = result.blocked ? 2 : result.ok ? 0 : 1;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  await main();
}
