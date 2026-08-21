/**
 * Free conversation over LiveKit — the brain, spoken.
 *
 * The sequencing here mirrors the playground's sessionLoop exactly, adapted to
 * voice: every decision lives in @parle/brain where it is tested, and this
 * file only sequences. The one structural difference from the scripted tutor
 * is that the pipeline LLM is NOT used for generation — the brain produces the
 * reply out of band, this agent speaks it with `session.say`, and every hook
 * path ends by throwing `voice.StopResponse` so the pipeline's own (unused)
 * LLM never answers on top of it. Without that throw the tutor speaks twice.
 *
 * The rescue keeps the playground's proven order: silence and aide-moi render
 * support INSTANTLY from material already in hand, and only then does the
 * model get asked for its warm in-character step-in. A stuck learner never
 * waits on a network round-trip to be handed the line.
 */

import { voice, type llm } from '@livekit/agents';
import { selectedBrain } from './preflight.ts';
import { TurnQueue } from './queue.ts';

import {
  APERO_FRAME,
  AnthropicBrainClient,
  BrainParseError,
  BrainRefusalError,
  CAFE_FRAME,
  ClaudeCliBrainClient,
  OpenAiCompatBrainClient,
  OpenAiResponsesBrainClient,
  RECOVERY_LINE,
  SplitBrainClient,
  ZERO_USAGE,
  addLlmUsage,
  applyCuration,
  applyExtractionToProfile,
  applyNonSpokenInput,
  applyTurnToProfile,
  assembleRecap,
  buildCurationRequest,
  buildDrillGenerationRequest,
  buildExtractionRequest,
  buildScenarioRequest,
  buildSystemBlocks,
  createConversation,
  finishSession,
  integrateTurn,
  learnerSnapshotFrom,
  repairProfile,
  prepareTurn,
  requestFallbackFrame,
  supportViewForAssistance,
  validLearnerName,
  type ConversationState,
  type CuratedTopic,
  type LearnerProfile,
  type LearnerTurnInput,
  type LlmClient,
  type LlmUsage,
  type NewPhrase,
  type ScenarioFrame,
  type SessionRecap,
  type TurnView,
} from '@parle/brain';
import { STUCK_SILENCE_MS, decodeClientMessage, validateExercise, type ServerMessage } from '@parle/core';

import { reportUsage } from './usage.ts';

/**
 * The wire shapes, derived from the protocol's own ServerMessage rather than
 * restated: core's barrel does not re-export the payload types, and deriving
 * them here means the mapping helpers are checked against the exact objects
 * `encodeMessage` will accept.
 */
export type ConvoView = Extract<ServerMessage, { t: 'convo' }>['view'];
export type RecapPayload = Extract<ServerMessage, { t: 'recap' }>['recap'];

/** Anything that can carry a message back to the app. */
type Publisher = (message: ServerMessage) => void;

// ─────────────────────────────────────────────── pure mapping helpers

/**
 * Map the brain's TurnView onto the wire's ConvoView, field by field. The
 * support shapes align structurally (brain's SupportView is the wire's
 * ConvoSupportView); the beat loses its internal id, which the app never
 * renders.
 */
export function toConvoView(view: TurnView): ConvoView {
  return {
    sceneReply: {
      speaker: view.sceneReply.speaker,
      fr: view.sceneReply.fr,
      frWritten: view.sceneReply.frWritten,
      en: view.sceneReply.en,
    },
    coachLine: view.coachLine,
    coachNow: view.coachNow.map((c) => ({
      kind: c.kind,
      quote: c.quote,
      better: c.better,
      betterWritten: c.betterWritten,
      betterEn: c.betterEn,
      why: c.why,
      weight: c.weight,
    })),
    narration:
      view.narration === null
        ? null
        : {
            speaker: view.narration.speaker,
            fr: view.narration.fr,
            frWritten: view.narration.frWritten,
            en: view.narration.en,
          },
    supportView: view.supportView,
    rung: view.rung,
    beat: { goalEn: view.beat.goalEn, position: view.beat.position, total: view.beat.total },
    recapDue: view.recapDue,
  };
}

/** The recap is already wire-shaped; the map is stated so it cannot silently widen. */
export function toRecapPayload(recap: SessionRecap): RecapPayload {
  return {
    headline: recap.headline,
    wins: recap.wins,
    fixes: recap.fixes,
    phrases: recap.phrases,
    nextFocus: recap.nextFocus,
    topics: recap.topics,
    cefr: recap.cefr,
    stats: recap.stats,
  };
}

/**
 * The app sends its stored LearnerProfile back as the opaque `snapshot` field
 * of the token metadata. Validation is deliberately loose — a tampered profile
 * only affects pedagogy, never minutes — but every top-level field the engine
 * dereferences at construction time must exist, or a bad snapshot crashes the
 * worker instead of degrading to a fresh profile.
 */
export function parseStoredProfile(snapshot: unknown): LearnerProfile {
  // Older apps send back version-1 profiles for as long as they live on a
  // device, and some version-2 profiles predate `memory` entirely. repairProfile
  // is the one place that knows how to bring either forward without discarding
  // what the tutor already learned about this person.
  return repairProfile(snapshot);
}

/**
 * Which scene this session opens on. No model call at session start — a
 * scenario-builder round-trip would put seconds of latency (and cost) in front
 * of the opening line. The two fixture frames alternate: a learner who just
 * did the café gets the apéro, and back. Frames are identified by title,
 * because that is what `finishSession` records in `lastScenarios`.
 */
export function chooseFrame(profile: LearnerProfile): ScenarioFrame {
  // Alternate on the MOST RECENT scene only. Keying on membership would lock
  // the learner out of the café forever after their first visit — the list
  // remembers everything, so `includes` is a one-way door.
  const last = profile.preferences.lastScenarios[profile.preferences.lastScenarios.length - 1];
  return last === CAFE_FRAME.title ? APERO_FRAME : CAFE_FRAME;
}

// ─────────────────────────────────────────────── the voice agent

/**
 * The brain, selected exactly like the scripted tutor's TUTOR_LLM switch, so
 * one .env flag moves both session shapes between quality tiers together.
 *
 * `anthropic` is the default and the shape this is built for: coaching quality
 *          is the product, and routing.ts already keeps realtime turns on the
 *          fast tier. Needs ANTHROPIC_API_KEY.
 * `groq` — the documented $0 fallback for key-less setups.
 * `claude-cli` — a Claude subscription through the command line, so the
 *          coaching can be judged before an API key is bought. Split, because
 *          a CLI call costs about eight seconds: the post-session calls get
 *          Claude, the learner's turn stays on Groq.
 * `claude-cli-all` — the same subscription behind everything, the learner's
 *          turn included, for development only. It buys coaching quality with
 *          eight to twelve seconds of dead air per turn, which is why it is not
 *          the default and why preflight says so out loud. It exists because
 *          Groq's free tier rate-limits a real session, and a fourth value on
 *          the one enum beats a second flag that could disagree with it.
 *
 * Exported for one reason worth stating: the promise that moving to the API is
 * a change of TUTOR_LLM and nothing else is only worth making if a test holds
 * it, and a private function cannot be held to anything.
 */
export function brainClient(env: Record<string, string | undefined> = process.env): LlmClient {
  const brain = selectedBrain(env);
  if (brain === 'groq') return new OpenAiCompatBrainClient({ apiKey: env.GROQ_API_KEY ?? '' });
  if (brain === 'openai') {
    return new OpenAiResponsesBrainClient({
      apiKey: env.OPENAI_API_KEY,
      turnModel: env.OPENAI_TURN_MODEL,
      analystModel: env.OPENAI_ANALYST_MODEL,
    });
  }
  // No split, and no key: the subscription answers everything through the
  // `claude` binary, and Groq drops out of the session entirely.
  if (brain === 'claude-cli-all') return new ClaudeCliBrainClient();
  if (brain === 'claude-cli') {
    // The subscription answers well and slowly. Give it the three calls that
    // run once the room has closed, and leave the learner's turn on the fast
    // one. See SplitBrainClient for why this is wiring and not routing.
    return new SplitBrainClient({
      realtime: new OpenAiCompatBrainClient({ apiKey: env.GROQ_API_KEY ?? '' }),
      considered: new ClaudeCliBrainClient(),
    });
  }
  return new AnthropicBrainClient(); // reads ANTHROPIC_API_KEY
}

/**
 * Everything the tutor says before a scene exists, hand-written so the session
 * opens with zero model calls and (once warmed) zero synthesis. The opener is
 * ISSEN's lesson taken literally: the tutor talks first, within seconds, and
 * asks the learner what they want to talk about.
 *
 * The opener and the suggestion are SPOKEN IN ENGLISH: a brand-new learner
 * must never be opened at in a language they do not have yet. The French rides
 * along on screen as exposure. The bridge stays French — by then the learner
 * has answered, and "Ah, très bien" is lesson-zero vocabulary doing its job.
 */
export const CONVO_LINES = {
  opener: { fr: "Alors, de quoi on parle aujourd'hui ?", en: 'So, what do you want to talk about today?' },
  /**
   * fr and en are the pair the screen shows. `spoken` is what the learner
   * actually hears, and it is the only one of the three that has to do two
   * jobs: the French stays, because by now they have answered and "Ah, très
   * bien" is lesson-zero vocabulary earning its place, but designing a scene
   * takes ten to twenty five seconds and across all of it this was the only
   * thing they heard. A line that says what is happening is the difference
   * between waiting and being abandoned.
   */
  bridge: {
    fr: 'Ah, très bien. Alors…',
    en: 'Ah, very good. So…',
    spoken: "Ah, très bien. Give me a moment, I'm setting the scene.",
  },
  suggest: {
    fr: 'Tout marche. Votre journée, vos projets, un café à Paris. Dites-le en anglais ou en français.',
    en: "Anything goes. Your day, your plans, ordering coffee in Paris. Say it in English or French and we're off.",
  },
} as const;

/**
 * A topic the learner already talked about, tapped on a practice card and
 * carried here in the join token's metadata. The token server validated it and
 * signed it; this file checks it again on arrival, because signed is not the
 * same as sane and the value goes straight into a line the tutor speaks.
 */
export interface SeedTopic {
  fr: string;
  en: string;
}

/** A topic card's title, and nothing longer. The token server's cap, restated. */
const MAX_SEED_TOPIC_CHARS = 120;

/**
 * The seed, kept only when it really is one: two strings, both with something
 * in them once trimmed, both short enough to be a title. Half a seed is no
 * seed, so a pair that fails either way is dropped whole rather than half
 * kept — an empty title would put a hole in the tutor's opening line.
 *
 * Dropped, never refused: the learner gets the ordinary choosing question,
 * which is exactly the session they would have had without a card to tap.
 */
export function validSeedTopic(value: unknown): SeedTopic | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { fr, en } = value as { fr?: unknown; en?: unknown };
  if (typeof fr !== 'string' || typeof en !== 'string') return undefined;
  const trimmed: SeedTopic = { fr: fr.trim(), en: en.trim() };
  if (trimmed.fr.length === 0 || trimmed.en.length === 0) return undefined;
  if (trimmed.fr.length > MAX_SEED_TOPIC_CHARS || trimmed.en.length > MAX_SEED_TOPIC_CHARS) return undefined;
  return trimmed;
}

/**
 * The opening question, with the learner's name on the front of it.
 *
 * Composed in code rather than by the model, because `open()` exists to put a
 * voice in the room within seconds of joining and a model call here would
 * spend the whole of that budget saying hello.
 *
 * One string, not two `say()` calls: the framework splits sentences inside a
 * single speech handle, so "Hi Sam." and the question keep their own cache
 * keys — the question is already warmed, so only the two-word greeting is a
 * cold miss and it plays first while the warm half streams from disk.
 */
export function openerFor(name: string | null): { fr: string; en: string } {
  if (name === null || name.length === 0) return { fr: CONVO_LINES.opener.fr, en: CONVO_LINES.opener.en };
  return {
    fr: `Bonjour ${name}. ${CONVO_LINES.opener.fr}`,
    en: `Hi ${name}. ${CONVO_LINES.opener.en}`,
  };
}

/** The title as it read on the card, with any full stop of its own removed. */
function titleOf(text: string): string {
  return text.trim().replace(/\.+$/, '').trim();
}

/**
 * What the tutor says when the session already knows its subject.
 *
 * A statement, not a question: the tutor says what is about to happen before it
 * happens, and someone who just tapped a topic has already answered the
 * question — asking it again would be the app forgetting what it was told.
 *
 * The title leads and the promise follows, which is both how the card read a
 * moment ago and the one shape that stays grammatical in both languages
 * whatever the title turns out to be. Threading the title through a preposition
 * instead would trip over the first French topic that starts with a vowel.
 */
export function seededOpening(seed: SeedTopic): { fr: string; en: string } {
  return {
    fr: `${titleOf(seed.fr)}. On en reparle.`,
    en: `${titleOf(seed.en)}. Let's talk about it again.`,
  };
}

/**
 * Which language the recogniser should be listening for.
 *
 * The opener is spoken in English on purpose: a brand-new learner must never be
 * opened at in a language they do not have yet. But the recogniser was pinned to
 * French for the whole session, so the learner's very first answer — the one
 * that decides what the entire scene will be about — went to Deepgram as French
 * and came back as nonsense, and the scenario builder had to guess a topic from
 * the wreckage.
 *
 * So the multilingual window is exactly as wide as the moment English is the
 * expected answer, and no wider. The scene stays pinned to French because the
 * comment at the recogniser's construction is right: learner French is mangled
 * French, and an explicit hint beats a multilingual default at telling mangled
 * French from English. The scripted lesson never opens in English at all, so it
 * listens in French from its first word.
 *
 * Unconditional rather than a flag: the English opener is unconditional, so a
 * flag would only preserve the broken pairing as the default.
 */
export type SttLanguage = 'fr' | 'multi';

export function sttLanguageFor(kind: 'convo' | 'lesson', phase: ConversationPhase): SttLanguage {
  if (kind === 'lesson') return 'fr';
  return phase === 'scene' ? 'fr' : 'multi';
}

/** How long the scenario builder gets before a request-grounded scene opens instead. */
const FRAME_TIMEOUT_MS = 10_000;

/**
 * Measured Luna scene calls sit around ten to nineteen seconds. Ten seconds
 * therefore discarded healthy, request-specific scenes about half the time.
 * Twenty-five seconds clears the measured tail while still bounding a stuck socket.
 */
const OPENAI_FRAME_TIMEOUT_MS = 25_000;

/**
 * The same deadline when the whole brain is a command-line call, which takes
 * eight to twelve seconds on its own.
 *
 * Ten seconds would lose that race most times it was run, and losing it is not
 * a visible failure: a simpler request-grounded scene opens instead. The
 * deadline still follows the brain so a healthy custom scene is not discarded
 * just because its provider is slower than another one.
 */
const CLI_FRAME_TIMEOUT_MS = 30_000;

/** How long the scenario builder gets, given which brain is answering. */
export function frameDeadlineMs(env: Record<string, string | undefined> = process.env): number {
  const brain = selectedBrain(env);
  if (brain === 'claude-cli-all') return CLI_FRAME_TIMEOUT_MS;
  if (brain === 'openai') return OPENAI_FRAME_TIMEOUT_MS;
  return FRAME_TIMEOUT_MS;
}

/**
 * How long one brain turn gets before the call is treated as hung.
 *
 * A wedge detector, not a latency budget, and the difference decides the
 * numbers. Cutting off a call that was still coming costs the learner their
 * turn, so the deadline sits at several times the worst healthy call rather than
 * just above the usual one: fifteen seconds where an API answers in one to
 * three, forty-five where a command-line call measures eight to twelve.
 *
 * More patience than the scene builder gets, which looks backwards until you
 * see what each one falls back on. The builder has a request-grounded scene
 * ready and the learner is listening to the bridge line while it works, so
 * giving up early keeps the session usable. A turn has no equivalent fallback
 * but the recovery line, and that line is the learner losing the sentence they
 * just said.
 */
const TURN_TIMEOUT_MS = 15_000;
const CLI_TURN_TIMEOUT_MS = 45_000;

function turnDeadlineMs(env: Record<string, string | undefined> = process.env): number {
  return selectedBrain(env) === 'claude-cli-all' ? CLI_TURN_TIMEOUT_MS : TURN_TIMEOUT_MS;
}

/**
 * A model call, and a promise that it will end.
 *
 * Every vendor SDK here can leave a request open indefinitely — a socket that
 * stays up and says nothing looks exactly like a model that is still thinking.
 * One helper for both calls that a learner is waiting on, so a hung turn and a
 * hung scene builder cannot drift into two different ideas of patience.
 *
 * The losing timer is always cleared: an unhandled rejection from a settled race
 * takes the worker down, which strands every learner on it.
 */
async function withDeadline<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      deadline = setTimeout(() => reject(new Error(`no ${what} after ${ms}ms`)), ms);
    });
    return await Promise.race([work, timeout]);
  } finally {
    if (deadline !== undefined) clearTimeout(deadline);
  }
}

/**
 * The text-mode silence window. Typing is slower than speaking and a reader
 * pauses differently from a speaker, so the four-second voice rule would feel
 * like being hovered over. Twelve seconds of nothing still means stuck.
 */
const TEXT_SILENCE_MS = 12_000;

/** How long the post-session memory call gets before its enrichment is dropped. */
const EXTRACT_TIMEOUT_MS = 8_000;

/** How long the practice curation gets before the code fallback ships instead. */
const CURATE_TIMEOUT_MS = 10_000;

/** How long drill authoring gets — the biggest post-session call, still bounded. */
const DRILLS_TIMEOUT_MS = 25_000;

/**
 * Terra's structured post-session calls are intentionally more considered than
 * a live turn. Live drill evaluation puts a healthy 12-exercise batch at about
 * sixty-five seconds, so the generic 25-second wedge detector threw away good
 * practice every time. These calls run after the recap has already shipped;
 * the wider bounds do not hold up the learner or the room.
 */
const OPENAI_EXTRACT_TIMEOUT_MS = 30_000;
const OPENAI_CURATE_TIMEOUT_MS = 30_000;
const OPENAI_DRILLS_TIMEOUT_MS = 90_000;

export type PostSessionWork = 'extract' | 'curate' | 'drills';

/** A provider-aware wedge detector for background enrichment calls. */
export function postSessionDeadlineMs(
  work: PostSessionWork,
  env: Record<string, string | undefined> = process.env,
): number {
  if (selectedBrain(env) === 'openai') {
    if (work === 'extract') return OPENAI_EXTRACT_TIMEOUT_MS;
    if (work === 'curate') return OPENAI_CURATE_TIMEOUT_MS;
    return OPENAI_DRILLS_TIMEOUT_MS;
  }
  if (work === 'extract') return EXTRACT_TIMEOUT_MS;
  if (work === 'curate') return CURATE_TIMEOUT_MS;
  return DRILLS_TIMEOUT_MS;
}

/**
 * Flow strictness and a 12-turn budget make a framed 3–5 minute scene: coaching
 * mostly waits for the recap, and the beat cap keeps the scene moving.
 */
const CONVO_MAX_TURNS = 12;

/** Where a conversation is: choosing a topic, building the scene, or inside it. */
export type ConversationPhase = 'choosing' | 'starting' | 'scene';

export class ParleConversation extends voice.Agent {
  private state: ConversationState;
  private profile: LearnerProfile;
  private readonly client: LlmClient;
  /**
   * Retunes the recogniser mid-session. A no-op by default, and correctly so in
   * both voiceless mode and every test that is not about the recogniser: there
   * is nothing listening to retune.
   */
  private setSttLanguage: (language: SttLanguage) => void = () => {};
  private publish: Publisher = () => {};
  private silenceTimer?: ReturnType<typeof setTimeout>;
  private startedAt = Date.now();
  private ended = false;
  /**
   * Where the session is: choosing a topic, waiting on the scenario builder,
   * or inside the scene. The fallback conversation is constructed eagerly so
   * `state` is never null — `starting` only gates which inputs do what.
   */
  private phase: ConversationPhase = 'choosing';
  /** The opening question, kept for `ready` replays and silence re-offers. */
  private lastOpening: Extract<ServerMessage, { t: 'opening' }> | null = null;
  /** The suggestion is offered once; after that, silence on the choosing screen is fine. */
  private suggested = false;
  /** The last published view, kept for `ready` replays and rescue merging. */
  private lastView: ConvoView | null = null;
  /** The finished session's recap message, kept for post-end `ready` replays. */
  private lastRecap: Extract<ServerMessage, { t: 'recap' }> | null = null;

  /** Set from the room identity so usage lands on the right account. */
  learnerId = 'anonymous';
  /** Raw provider-neutral tokens, so development sessions produce real cost evidence. */
  private modelUsage: LlmUsage = ZERO_USAGE;
  private modelCalls = 0;

  /**
   * Text mode: the same conversation with the voice pipeline dark. Learner
   * turns arrive as typed `say` messages, the tutor's lines render instead of
   * sounding, and the silence rescue runs on a reader's clock. Everything
   * pedagogical is identical — that is the point.
   */
  private readonly voiceless: boolean;
  /** Every brain turn and every rescue runs through here, one at a time. */
  private readonly queue = new TurnQueue();
  /**
   * How long the scenario builder gets. Read once, at construction, from the
   * same TUTOR_LLM that chose the brain — a slow brain gets a longer deadline
   * rather than the simpler recovery scene opening before the rich one arrives.
   */
  private readonly frameTimeoutMs = frameDeadlineMs();
  /**
   * How long one brain turn gets. Read the same way and for the same reason:
   * a brain that answers in eight seconds must not be called hung at four.
   */
  private readonly turnTimeoutMs = turnDeadlineMs();
  /** True between the learner taking the floor and their turn being integrated. */
  private learnerSpeaking = false;
  /**
   * The topic this session already knows about, or nothing. Only ever set for a
   * free conversation: the scripted lesson has its own script and nothing to
   * choose, so a seed would have nowhere to land.
   */
  private readonly seedTopic: SeedTopic | undefined;

  /**
   * `client` is the seam a test drives this class through. Without it the
   * constructor reaches for a real vendor SDK and an API key, which is why
   * every behaviour below went untested: the object could not be built.
   */
  constructor(
    profile: LearnerProfile,
    opts: {
      voiceless?: boolean;
      client?: LlmClient;
      setSttLanguage?: (language: SttLanguage) => void;
      /**
       * The topic this session was started on, if it was started from a card.
       * `unknown` on purpose: the guard, not the caller, decides what a seed
       * is, so the worker cannot hand this class a half-built one.
       */
      seedTopic?: unknown;
    } = {},
  ) {
    // The pipeline LLM never generates here; see the header. One line keeps
    // the framework satisfied and makes the intent grep-able.
    super({ instructions: 'You are unused; replies are generated out of band.' });
    this.profile = profile;
    this.voiceless = opts.voiceless ?? false;
    this.state = createConversation(chooseFrame(profile), learnerSnapshotFrom(profile), {
      strictness: 'flow',
      maxTurns: CONVO_MAX_TURNS,
    });
    this.client = opts.client ?? brainClient();
    this.seedTopic = validSeedTopic(opts.seedTopic);
    if (opts.setSttLanguage) this.setSttLanguage = opts.setSttLanguage;
  }

  /** Where the conversation has got to. Read-only, for the worker and for tests. */
  get conversationState(): ConversationState {
    return this.state;
  }

  /** Current model meter, exposed read-only for diagnostics and tests. */
  get brainMeter(): { calls: number; usage: LlmUsage } {
    return { calls: this.modelCalls, usage: { ...this.modelUsage } };
  }

  private recordBrainUsage(activity: 'turn' | 'frame' | 'extract' | 'curate' | 'drills', usage: LlmUsage): void {
    this.modelCalls += 1;
    this.modelUsage = addLlmUsage(this.modelUsage, usage);
    const chargedInput = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
    if (chargedInput === 0 && usage.outputTokens === 0) return;
    const totalInput = this.modelUsage.inputTokens + this.modelUsage.cacheReadTokens + this.modelUsage.cacheWriteTokens;
    console.info(
      `[parle:brain] ${activity}: ${chargedInput} input (${usage.cacheReadTokens} cached), ${usage.outputTokens} output; ` +
        `session total ${this.modelCalls} calls, ${totalInput} input, ${this.modelUsage.outputTokens} output`,
    );
  }

  /** Every spoken line funnels through here so text mode can stay silent. */
  private say(text: string, options: { allowInterruptions?: boolean } = {}): void {
    if (this.voiceless) return;
    this.session.say(text, options);
  }

  /** Wire up the channel back to the app. */
  attach(publish: Publisher): void {
    this.publish = publish;
  }

  /** Latency marks for the stages this class owns. The worker wires the sink. */
  private markTiming: (stage: 'brainSent' | 'brainParsed' | 'sayCalled') => void = () => {};

  /**
   * Wire the per-turn latency record. The record and the clock live with the
   * worker (agent.ts), which owns the other stages; this class only says when
   * its own moments happen. Unwired (tests, the playground) they cost nothing.
   */
  attachTiming(sink: (stage: 'brainSent' | 'brainParsed' | 'sayCalled') => void): void {
    this.markTiming = sink;
  }

  /** Drives the microphone control: live while the learner has the floor. */
  sendSpeaking(speaking: boolean): void {
    this.publish({ t: 'speaking', speaking });
  }

  /** Tell the learner something went wrong, in plain unscolding words. */
  publishError(message: string): void {
    this.publish({ t: 'error', message });
  }

  /**
   * Open the session on the choosing moment: the tutor asks — in English, out
   * loud — what the learner wants to talk about, and nothing costs a model
   * call. No menu: the scene opens from whatever answer arrives, spoken or
   * typed, English or French.
   *
   * Unless the session already knows: a conversation started from a practice
   * card skips the question and opens on the topic it was handed.
   */
  open(session: voice.AgentSession): void {
    void session; // kept for signature parity with ParleTutor; speech goes via this.session
    // A session started from a practice card already has its answer. Asking
    // again would be the app forgetting what it was just told, so the tutor
    // says what is about to happen and goes straight to the scene. The opening
    // is still published, because the app opens a conversation on that message
    // and would otherwise wait for one that never comes. From there this is the
    // ordinary path: startScene owns the bridge line, the frame call, the
    // timeout and the request-grounded fallback, and every one is inherited.
    if (this.seedTopic) {
      const seeded = seededOpening(this.seedTopic);
      this.lastOpening = { t: 'opening', prompt: seeded };
      this.publish(this.lastOpening);
      this.say(seeded.en, { allowInterruptions: false });
      void this.startScene(this.seedTopic.en).catch((error: unknown) => {
        console.error('[parle] the seeded scene could not be started:', error);
      });
      return;
    }
    // A remembered opener beats the generic question: "So, how was that
    // interview?" is the moment the tutor stops being an app. One line of live
    // synthesis per session, pennies, worth every one of them.
    // A remembered opener is a whole greeting the analyst wrote after the last
    // session, in its own time, and it already knows the learner's name. Only
    // the generic question needs one stapled to the front.
    const opener = this.profile.memory.opener ?? openerFor(validLearnerName(this.profile.memory.name));
    this.lastOpening = { t: 'opening', prompt: { fr: opener.fr, en: opener.en } };
    this.publish(this.lastOpening);
    this.say(opener.en, { allowInterruptions: false });
    if (this.voiceless) this.armRescue(this.session);
  }

  /**
   * A topic landed. Say the cached bridge line so the learner is never
   * waiting in silence, design the scene, and open it. The scenario builder
   * failing — parse error, outage, timeout — falls back to a flexible frame
   * that carries the learner's own request. The learner gets a scene either
   * way, but never an unrelated café because a provider missed its deadline.
   *
   * The tail is guarded separately, and that is the whole of F28. buildFrame's
   * own catch covers a builder that will not answer; it cannot cover a builder
   * that answers with something the engine then chokes on — a frame with no
   * beats, say. That threw between `starting` and `scene`, so the phase never
   * moved, and every later press early-returned with no log and no publish. The
   * founder's "I typed it and nothing happened" is partly this: the natural
   * answer to a screen that will not change is to press Send again, and every
   * one of those went into the same hole.
   */
  private async startScene(request: string): Promise<void> {
    if (this.ended) return;
    if (this.phase !== 'choosing') {
      // A duplicate press during a healthy build stays dropped — the scene is
      // seconds away and two would open on top of each other — but it says so,
      // because a drop nobody can see is how this took a week to find.
      console.warn(`[parle] a topic arrived while the session was ${this.phase}; the scene already coming is the one that opens`);
      return;
    }
    this.phase = 'starting';
    this.clearRescue();
    this.say(CONVO_LINES.bridge.spoken, { allowInterruptions: false });

    let frame: ScenarioFrame;
    try {
      frame = await this.buildFrame(request);
    } catch (error) {
      frame = requestFallbackFrame(request);
      console.error('[parle] scenario build failed; opening a simpler scene on the learner request:', error);
      this.publish({ t: 'error', message: "I've kept your topic. We'll start with a simpler version." });
    }
    if (this.ended) return;

    try {
      this.state = createConversation(frame, learnerSnapshotFrom(this.profile), {
        strictness: 'flow',
        maxTurns: CONVO_MAX_TURNS,
        // So a loanword the learner themself used is not read as a French leak
        // when the opening narration is checked.
        request,
      });
      this.phase = 'scene';
      this.openScene();
    } catch (error) {
      console.error('[parle] the scene could not be opened; handing back the choosing moment:', error);
      this.returnToChoosing();
    }
  }

  /**
   * Give the learner the question back.
   *
   * Not an apology and not an explanation: they asked for something, it is not
   * there, and the one useful thing left is the moment they were in before —
   * the question on screen, the question spoken, and a session that will act on
   * the next thing they say. Never a dead end, which is the invariant this is
   * here to keep.
   *
   * The recogniser goes back to the multilingual window with it. openScene pins
   * it to French as its first act, so a scene that fell over halfway leaves the
   * choosing moment listening for the wrong language.
   */
  private returnToChoosing(): void {
    this.phase = 'choosing';
    this.setSttLanguage(sttLanguageFor('convo', 'choosing'));
    if (this.seedTopic) {
      // A session that came from a topic card has no question to go back to:
      // its opening is a statement about the topic they tapped, and repeating
      // it would promise the same scene a second time. The ordinary question is
      // honest about where they now are, and it is something they can answer.
      this.lastOpening = { t: 'opening', prompt: { fr: CONVO_LINES.opener.fr, en: CONVO_LINES.opener.en } };
    }
    if (this.lastOpening) this.publish(this.lastOpening);
    // The quiet twin: text mode arms its own clock, exactly as `open` does.
    if (this.voiceless) this.armRescue(this.session);
    else if (this.lastOpening) this.say(this.lastOpening.prompt.en, { allowInterruptions: false });
  }

  /** One frame call with a hard deadline — a learner is audibly waiting. */
  private async buildFrame(request: string): Promise<ScenarioFrame> {
    const snapshot = learnerSnapshotFrom(this.profile);
    const facts = this.profile.memory.facts.slice(-5).map((fact) => fact.en);
    const unmasteredPhrases = Object.values(this.profile.phrases)
      .filter((phrase) => !phrase.mastered)
      .slice(0, 5)
      .map((phrase) => `${phrase.fr} (${phrase.en})`);
    const result = await withDeadline(
      this.client.frame({
        kind: 'frame',
        system: buildSystemBlocks(),
        request: buildScenarioRequest({
          request,
          learner: {
            cefr: snapshot.cefr,
            watchFor: snapshot.watchFor,
            name: snapshot.name,
            facts,
            recentScenarios: this.profile.preferences.lastScenarios,
            unmasteredPhrases,
          },
        }),
      }),
      this.frameTimeoutMs,
      'frame',
    );
    this.recordBrainUsage('frame', result.usage);
    return result.frame;
  }

  /**
   * Open the scene: publish the opening view built from material the frame
   * already carries (no model call), then speak the narrator's scene-setting
   * and the character's opening line, uninterruptible so a speakerphone echo
   * cannot cut the scene's first words.
   */
  private openScene(): void {
    // The learner has chosen, in English, and everything from here is French.
    this.setSttLanguage(sttLanguageFor('convo', 'scene'));
    const frame = this.state.frame;
    const opening = frame.openingLine;
    const narration = frame.openingNarration;
    const beats = frame.beats;
    const beatIndex = Math.max(
      0,
      beats.findIndex((b) => b.id === this.state.currentBeat),
    );
    const beat = beats[beatIndex]!;

    this.publishView({
      sceneReply: { speaker: opening.speaker, fr: opening.fr, frWritten: opening.frWritten, en: opening.en },
      coachLine: null,
      coachNow: [],
      narration: { speaker: narration.speaker, fr: narration.fr, frWritten: narration.frWritten, en: narration.en },
      supportView: supportViewForAssistance(0, this.state.lastSupport),
      rung: this.state.ladder.rung,
      beat: { goalEn: beat.goalEn, position: beatIndex + 1, total: beats.length },
      recapDue: false,
    });
    // The narration is spoken in English: the learner must be able to picture
    // the scene before a word of French lands on them.
    this.say(narration.en, { allowInterruptions: false });
    this.say(opening.fr, { allowInterruptions: false });
  }

  /**
   * Arm the rescue. Called once the tutor has finished speaking; four silent
   * seconds mean stuck, not thinking, and support renders instantly.
   *
   * On the spoken choosing screen the same silence gets a gentler answer: one
   * spoken suggestion, once. Text mode never does this. Choosing "Unable to
   * speak" opens a blank reply surface and waits for the learner's own topic;
   * it must not turn into an example-answer prompt after a timer.
   * While the scenario builder runs, silence is expected and the timer stays
   * dark.
   */
  armRescue(session: voice.AgentSession): number {
    this.clearRescue();
    void session; // kept for signature parity with ParleTutor; speech goes via this.session
    // Captured now, checked when the timer fires. Returned so the caller — and
    // a test — can name the moment this particular wait began.
    const generation = this.queue.generation;
    if (this.ended || this.phase === 'starting') return generation;
    const window = this.silenceWindow();
    if (this.phase === 'choosing') {
      if (this.voiceless) return generation;
      if (this.suggested) return generation;
      this.silenceTimer = setTimeout(() => {
        this.suggested = true;
        this.say(CONVO_LINES.suggest.en, { allowInterruptions: false });
        if (this.lastOpening) this.publish(this.lastOpening);
      }, window);
      return generation;
    }
    this.silenceTimer = setTimeout(() => void this.runRescue(generation), window);
    return generation;
  }

  /** How long nothing may happen before the learner is stuck rather than thinking. */
  private silenceWindow(): number {
    return this.voiceless ? TEXT_SILENCE_MS : STUCK_SILENCE_MS;
  }

  /**
   * The silence rescue itself, separated from the timer that schedules it.
   *
   * Clearing a timeout cannot unschedule a callback that has already fired, so
   * "the learner answered half a beat after the clock ran out" arrives here with
   * the rescue already in flight. Three things stop it: they are speaking right
   * now, a turn is being written for them right now, or something else has been
   * queued since this wait began.
   *
   * The middle one is the newest and the least obvious. The queue counts work
   * when it is ENQUEUED, so a clock armed after the learner's turn was queued
   * captures a generation that already includes it — the check below passes,
   * and the rescue lands behind a turn still in flight. Groq's sub-second turns
   * meant nothing was ever still running when the clock ran out; a brain that
   * takes eight to twelve seconds is rescued out of its own thinking time on
   * every turn. Waiting for the tutor is not being stuck, whatever the brain.
   *
   * Standing down is not standing down for good: the turn ends by publishing,
   * and publishing re-arms.
   */
  async runRescue(generation: number): Promise<void> {
    if (this.ended || this.learnerSpeaking) return;
    if (this.queue.busy) return;
    await this.queue.runIfCurrent(generation, () => this.rescue({ type: 'silence', durationMs: this.silenceWindow() }));
  }

  /**
   * The learner has the floor, or has given it up.
   *
   * Stands down a rescue that has already fired and is on its way — clearing the
   * timeout cannot, and a rescue landing on top of a spoken turn costs them one
   * of the two.
   */
  setLearnerSpeaking(speaking: boolean): void {
    this.learnerSpeaking = speaking;
    if (speaking) this.clearRescue();
  }

  /** Settle once every queued turn has been integrated. For tests. */
  settled(): Promise<void> {
    return this.queue.idle();
  }

  clearRescue(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = undefined;
  }

  /**
   * Handle an intent the learner expressed by tapping rather than speaking.
   *
   * Never throws, on purpose. The worker fires this off with `void` for every
   * frame that lands on the data channel, so one throw in here is an unhandled
   * rejection on a process that is serving every learner on it — one learner's
   * mistimed tap taking down everybody else's session. Containment is not
   * politeness here, it is the blast radius.
   */
  async handleClientMessage(session: voice.AgentSession, payload: Uint8Array): Promise<void> {
    try {
      await this.routeClientMessage(session, payload);
    } catch (error) {
      console.error('[parle] a client message could not be handled; the session carries on:', error);
    }
  }

  /** What a client message actually does. Wrapped by handleClientMessage. */
  private async routeClientMessage(session: voice.AgentSession, payload: Uint8Array): Promise<void> {
    const msg = decodeClientMessage(payload);
    if (!msg) return; // a malformed frame must not disturb a live conversation

    if (msg.t === 'typing') {
      // Typing is presence, not silence. Measured live, a learner writing one
      // answer was rescued about every twenty seconds, because the only thing
      // the clock could see was that nobody had spoken — and being told to say
      // it once more mid-sentence is a remark on hesitating, which the tutor
      // never makes. So the window restarts from the last keystroke.
      //
      // Only ever a restart: if no clock is running, none is started. armRescue
      // owns when the tutor may wait on a learner (never while the scene is
      // being built, once only on the choosing screen), and a keystroke must
      // not be a second opinion about that.
      if (this.silenceTimer) this.armRescue(this.session);
      return;
    }

    if (msg.t === 'ready') {
      // After the scene has closed, the recap IS the current state — replaying
      // the last scene view would hand a reconnecting app a session that no
      // longer exists and swallow its recap and updated profile.
      if (this.ended && this.lastRecap) this.publish(this.lastRecap);
      // Before the scene exists, the opening IS the current state — including
      // while the builder runs, which is the whole of a seeded session's life
      // before the scene. An app sends `ready` precisely because it fears it
      // missed the moment, and answering that with nothing is the fear coming
      // true.
      else if (this.phase !== 'scene' && this.lastOpening) this.publish(this.lastOpening);
      else if (this.lastView) this.publish({ t: 'convo', view: this.lastView });
      return;
    }
    if (msg.t === 'leave') return void this.finish();

    // Before the scene exists, every other tap gets the same gentle answer as
    // silence: a spoken suggestion and the question again. There is no ladder
    // to move and no line to replay yet. A typed answer IS the topic —
    // awaited, not fired and forgotten, so a caller (or a test) that waits on
    // this message is waiting for the scene rather than for the tick that
    // happens to open it.
    if (this.phase !== 'scene') {
      if (msg.t === 'say') return this.startScene(msg.text);
      if (msg.t === 'help' || msg.t === 'skip') {
        this.clearRescue();
        this.suggested = true;
        this.say(CONVO_LINES.suggest.en, { allowInterruptions: false });
        if (this.lastOpening) this.publish(this.lastOpening);
      }
      return;
    }

    if (msg.t === 'hear') {
      // Replay the current support line, uninterruptible so it plays out whole.
      // An empty line means the brain would not vouch for it as the learner's
      // own (learnerSideSupport), and the card is showing the English hint
      // instead. There is nothing to replay: speaking the scene's own line here
      // would hand back exactly what the brain just took out.
      const line = this.state.lastSupport.fullLine.fr;
      if (line.trim().length > 0) this.say(line, { allowInterruptions: false });
      return;
    }
    if (msg.t === 'slower') {
      // Two effects, both honest: the line again right now, and a pace flag
      // that rides every later turn's context so the tutor STAYS slow. The
      // audio itself replays at the cached speed until slow synthesis is
      // proven out with the voice vendor.
      this.state = { ...this.state, pace: 'slow' };
      if (this.lastView) this.say(this.lastView.sceneReply.fr, { allowInterruptions: false });
      return;
    }
    if (msg.t === 'english') {
      // The gloss is already in hand — saying it costs nothing and is never a
      // ladder event. Asking to understand is a healthy act.
      if (this.lastView) this.say(this.lastView.sceneReply.en, { allowInterruptions: false });
      return;
    }
    if (msg.t === 'say') {
      // A typed learner turn: text-mode conversation, or a voice learner who
      // could not say it aloud just now. Identical to speech from here on —
      // including the queue. Going straight to the engine left the moment
      // unmarked, so a rescue that had already fired still counted as current
      // and folded a second turn into the scene on top of their answer.
      this.clearRescue();
      this.publish({ t: 'transcript', text: msg.text, final: true });
      await this.queue.run(() => this.runBrainTurn({ type: 'spoke', text: msg.text }));
      return;
    }
    if (msg.t === 'help' || msg.t === 'skip') {
      // The brain has no skip: a learner reaching for either button is lost,
      // and what a lost learner needs is support, not a hole in the scene.
      // Queued for the same reason as the typed turn: asking for help is the
      // learner answering the silence themselves, and it must retire the
      // rescue that was already on its way.
      this.clearRescue();
      await this.queue.run(() => this.rescue({ type: 'help' }));
    }
    // 'choice' arrives as speech as well, exactly like the scripted path.
  }

  /** The learner said something. Run it through the brain, speak the answer. */
  override async onUserTurnCompleted(_chatCtx: llm.ChatContext, newMessage: llm.ChatMessage): Promise<void> {
    this.clearRescue();
    this.learnerSpeaking = false;
    const text = (newMessage.textContent ?? '').trim();
    if (text.length > 0 && !this.ended) {
      if (this.phase === 'choosing') {
        // Speech on the choosing screen IS the topic. The transcript shows
        // the learner they were heard; the scene does the rest.
        this.publish({ t: 'transcript', text, final: true });
        void this.startScene(text).catch((error: unknown) => {
          console.error('[parle] the spoken topic could not open a scene:', error);
        });
      } else if (this.phase === 'scene') {
        this.publish({ t: 'transcript', text, final: true });
        await this.queue.run(() => this.runBrainTurn({ type: 'spoke', text }));
      } else {
        // Speech while the scenario builder runs is still dropped: the scene
        // they asked for is seconds away and answering into it would talk over
        // the opening narration. But it is no longer dropped in silence. A
        // screen that does not change reads as "it did not hear me", and the
        // natural response is to say it again, into the same hole.
        this.publish({ t: 'transcript', text, final: true });
      }
    }
    // Every path out of this hook cancels the pipeline's own reply — the
    // brain already spoke; the unused pipeline LLM must not answer too.
    throw new voice.StopResponse();
  }

  /**
   * Silence or aide-moi. The ladder moves and the support renders NOW, from
   * material the last turn already carried; the model's warm in-character
   * step-in follows when the network gets around to it.
   */
  private async rescue(input: Extract<LearnerTurnInput, { type: 'silence' | 'help' }>): Promise<void> {
    if (this.ended) return;

    const { state, view } = applyNonSpokenInput(this.state, input);
    this.state = state;
    if (this.lastView) {
      // Merge: the scene has not moved, so the last reply stands; only the
      // support, the rung and the (now silent) coach change. Stale narration
      // clears too — a rescue is not a scene shift.
      this.publishView({
        ...this.lastView,
        coachLine: null,
        coachNow: [],
        narration: null,
        supportView: view.supportView,
        rung: view.rung,
      });
    }

    await this.runBrainTurn(input);
  }

  /**
   * One brain turn, sequenced exactly like the playground's runInput:
   * prepareTurn → client.turn → integrateTurn → fold into the profile →
   * publish → speak. A failed model turn says the recovery line and records
   * nothing — the learner must never be stranded mid-scene.
   */
  private async runBrainTurn(input: LearnerTurnInput): Promise<void> {
    const request = prepareTurn(this.state, input);
    let turn;
    try {
      this.markTiming('brainSent');
      // Raced, exactly as the scene builder is. A call that goes out and never
      // comes back used to sit here forever, and the queue reports itself busy
      // for as long as it does — so the rescue stood down, no clock ran, and the
      // learner was left in front of their own sentence with nothing coming.
      // A timeout lands in the catch below and is treated as what it is: a turn
      // that failed, indistinguishable downstream from a thrown one.
      const result = await withDeadline(this.client.turn(request), this.turnTimeoutMs, 'turn');
      turn = result.turn;
      this.recordBrainUsage('turn', result.usage);
      this.markTiming('brainParsed');
    } catch (error) {
      if (this.ended) return; // a failed turn against a finished session is just noise
      if (error instanceof BrainParseError || error instanceof BrainRefusalError) {
        this.recover();
        return;
      }
      // Anything else (network, provider outage) gets the same gentle exit:
      // an unhandled throw here would strand the learner in silence.
      console.error('[parle] convo brain turn failed:', error);
      this.recover();
      return;
    }

    // The session may have ended while the model call was in flight (the
    // learner left, or the recap fired from another path). A late turn must
    // not speak into a closed scene or mutate a profile already handed over.
    if (this.ended) return;

    // `this.state` is read fresh after the await: if another input completed
    // while this call was in flight, this turn folds into that newer state.
    const { state, view } = integrateTurn(this.state, input, turn);
    this.state = state;
    this.profile = applyTurnToProfile(this.profile, turn, new Date().toISOString());

    this.publishView(toConvoView(view));
    this.speak(view);

    if (view.recapDue) await this.finish();
  }

  /**
   * The model could not answer. Hand back the recovery line and record nothing —
   * a turn that never happened must not move the scene.
   *
   * In text mode `say` is a no-op and a failed turn publishes no view, so the
   * spoken session's whole recovery amounted to nothing: the learner sat looking
   * at their own typed sentence with no reply, no reason and no way to tell a
   * broken tutor from a slow one. The notice is the same words the spoken
   * session hears, on the one channel the app surfaces inside a live session
   * rather than as a dead end.
   *
   * Re-arming matters as much as the words. A spoken session re-arms when the
   * recovery line finishes playing (agent.ts, on `listening`); nothing plays
   * here, so without this the silence clock never restarts and the support a
   * stuck learner would be handed — rendered locally, no model needed — never
   * comes.
   */
  private recover(): void {
    this.say(RECOVERY_LINE);
    if (!this.voiceless) return;
    this.publishError(RECOVERY_LINE);
    this.armRescue(this.session);
  }

  /** Narration, then coach, then the scene reply — outside-in, like a film. */
  private speak(view: TurnView): void {
    // The recovery line (recover()) deliberately does not mark: a turn that
    // failed is not a data point about how fast a turn answers.
    this.markTiming('sayCalled');
    // On the low rungs the line must play out in full: without headphones the
    // learner's microphone hears the tutor, and a VAD "interruption" during a
    // modelled line is almost never the learner talking.
    const options = view.rung <= 2 ? { allowInterruptions: false } : {};
    // A scene shift is spoken in English and never interruptible: a learner
    // who misses the new picture cannot follow anything said inside it.
    if (view.narration !== null) this.say(view.narration.en, { allowInterruptions: false });
    if (view.coachLine !== null) this.say(view.coachLine, options);
    this.say(view.sceneReply.fr, options);
  }

  private publishView(view: ConvoView): void {
    this.lastView = view;
    this.publish({ t: 'convo', view });
    // Text mode has no speech, so no AgentStateChanged ever fires to start
    // the silence clock. The render is the moment the learner has the floor.
    if (this.voiceless) this.armRescue(this.session);
  }

  /**
   * End the session: assemble the recap in code, fold the session into the
   * profile, hand both to the app, then debit the metered seconds.
   *
   * Idempotent, because both an earned recap and a learner closing the app can
   * arrive here — and billing someone twice for one session is the kind of bug
   * that costs a refund and a review.
   */
  async finish(): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    this.clearRescue();

    const { recap, state } = assembleRecap(this.state, {
      estimate: this.profile.cefr.estimate,
      confidence: this.profile.cefr.confidence,
    });
    this.state = state;
    this.profile = finishSession(this.profile, state);

    // The profile rides along verbatim: the agent owns the shape, the app is
    // just the storage that brings it back next session. Kept for `ready`
    // replays, so an app that reconnects after the scene closed still gets its
    // recap and updated profile instead of a stale scene view.
    this.lastRecap = { t: 'recap', recap: toRecapPayload(recap), profile: this.profile };
    this.publish(this.lastRecap);

    const wallClockSec = Math.round((Date.now() - this.startedAt) / 1000);
    console.log(
      `[parle] convo complete — ${recap.stats.turns} turns, ${recap.stats.rescues} rescues, ` +
        `${wallClockSec}s, cefr=${recap.cefr.estimate} (${recap.cefr.confidence})`,
    );
    await reportUsage({ userId: this.learnerId, seconds: wallClockSec, utterancesScored: 0 });

    // Only now, with the recap shipped and the seconds debited, the analyst
    // does its background work. A learner who kills the app first loses this
    // session's memory, practice topics and drills, and nothing else.
    // Curation runs BEFORE drills so the drill author works from the curated
    // keep-list rather than everything the session touched.
    void this.extractMemory(state.turnCount);
    void this.curateAndDrill(state);
  }

  /**
   * The practice editor, then the drill author, in that order. Exactly one
   * `practice` message ships per session whatever happens: the model's
   * grouping when it answers in time, the deterministic code fallback when it
   * does not. Drills are then authored from the same keep-list, so the two
   * artefacts describe the same practice instead of two different sessions.
   */
  private async curateAndDrill(state: ConversationState): Promise<void> {
    const curated = await this.curatePractice(state);
    this.publish({
      t: 'practice',
      topics: curated.map((topic) => ({ titleFr: topic.title.fr, titleEn: topic.title.en, phrases: topic.phrases })),
    });
    const keepList = curated.flatMap((topic) => topic.phrases);
    await this.generateDrills(state.turnCount, keepList.length > 0 ? keepList : undefined);
  }

  /** One curation call with a hard deadline and a pure fallback. */
  private async curatePractice(state: ConversationState): Promise<CuratedTopic[]> {
    const sessionTopics = state.topics.map((t) => ({ en: t.en, fr: t.fr }));
    if (state.turnCount === 0) {
      return applyCuration(null, state.phrases, sessionTopics);
    }
    const errorTags = Object.entries(this.profile.errorPatterns)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([tag]) => tag);
    try {
      const request = buildCurationRequest({
        topics: sessionTopics,
        phrases: state.phrases,
        learner: { cefr: this.profile.cefr.estimate, errorTags },
      });
      const result = await withDeadline(
        this.client.curate({ kind: 'curate', system: buildSystemBlocks(), request }),
        postSessionDeadlineMs('curate'),
        'curation',
      );
      this.recordBrainUsage('curate', result.usage);
      return applyCuration(result.curation, state.phrases, sessionTopics);
    } catch (error) {
      console.error('[parle] curation failed; the code fallback ships instead:', error);
      return applyCuration(null, state.phrases, sessionTopics);
    }
  }

  /**
   * The post-session memory call. Best-effort by design: the recap already
   * shipped, so a failure here costs a nicety, never the session. On success
   * the enriched profile rides a second recap publish — idempotent for the
   * app, which just persists the newest blob.
   */
  private async extractMemory(turnCount: number): Promise<void> {
    // An empty session has nothing to remember, and asking would be spend
    // without a question.
    if (turnCount === 0 || this.lastRecap === null) return;
    try {
      const request = buildExtractionRequest({ history: this.state.history, knownFacts: this.profile.memory.facts });
      const result = await withDeadline(
        this.client.extract({ kind: 'extract', system: buildSystemBlocks(), request }),
        postSessionDeadlineMs('extract'),
        'extraction',
      );
      this.recordBrainUsage('extract', result.usage);
      this.profile = applyExtractionToProfile(this.profile, result.extraction, new Date().toISOString());
      this.lastRecap = { ...this.lastRecap, profile: this.profile };
      this.publish(this.lastRecap);
    } catch (error) {
      console.error('[parle] memory extraction failed; the recap already shipped without it:', error);
    }
  }

  /**
   * Tomorrow's drills from today's sentences. Best-effort like the memory
   * call, with one extra gate: every generated exercise passes core's
   * deterministic linter before it ships, because a broken drill teaches
   * broken French and a rejected one costs nothing — fixtures cover the gap.
   */
  private async generateDrills(turnCount: number, keepList?: readonly NewPhrase[]): Promise<void> {
    if (turnCount === 0) return;
    // The curated keep-list when curation produced one; everything the session
    // recorded only as the fallback, so drills match the practice topics.
    const sessionPhrases = keepList ?? this.state.phrases;
    const profilePhrases = Object.values(this.profile.phrases)
      .filter((p) => !p.mastered)
      .slice(0, 10)
      .map((p) => ({ fr: p.fr, frWritten: p.frWritten, en: p.en }));
    if (sessionPhrases.length === 0 && profilePhrases.length === 0) return;

    const errorTags = Object.entries(this.profile.errorPatterns)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([tag]) => tag);

    try {
      const request = buildDrillGenerationRequest({
        sessionPhrases,
        profilePhrases,
        errorTags,
        topics: this.state.topics.map((topic) => ({ en: topic.en, fr: topic.fr })),
      });
      const result = await withDeadline(
        this.client.drills({ kind: 'drills', system: buildSystemBlocks(), request }),
        postSessionDeadlineMs('drills'),
        'drills',
      );
      this.recordBrainUsage('drills', result.usage);

      const valid = result.batch.exercises.filter((exercise) => validateExercise(exercise).ok);
      const dropped = result.batch.exercises.length - valid.length;
      if (dropped > 0) console.warn(`[parle] drill linter rejected ${dropped} of ${result.batch.exercises.length} exercises`);
      if (valid.length === 0) return;
      this.publish({ t: 'drills', exercises: valid });
    } catch (error) {
      console.error('[parle] drill generation failed; the fixture bank covers the gap:', error);
    }
  }
}
