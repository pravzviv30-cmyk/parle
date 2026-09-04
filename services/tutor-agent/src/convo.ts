/**
 * Free conversation over LiveKit — the brain, spoken.
 *
 * The sequencing here mirrors the playground's sessionLoop exactly, adapted to
 * voice: every decision lives in @luvani/brain where it is tested, and this
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
// One replay ledger for the worker, not one per agent class. Both session
// shapes are served by the same process and both report to the same endpoint,
// so a spent credential has to be spent for both of them.
import {
  REPLAYED_SESSION_MESSAGE,
  UNSIGNED_SESSION_ID,
  noteSessionReported,
  sessionAlreadyReported,
} from './tutor.ts';

import {
  APERO_FRAME,
  AnthropicBrainClient,
  BrainParseError,
  BrainRefusalError,
  CAFE_FRAME,
  ClaudeCliBrainClient,
  OpenAiCompatBrainClient,
  OpenAiResponsesBrainClient,
  recoveryLine,
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
  priceUsage,
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
  type Pace,
  type Strictness,
  type TurnView,
  missionFrame,
} from '@luvani/brain';
import {
  STUCK_SILENCE_MS,
  buildConversationPack,
  decodeClientMessage,
  validateExercise,
  type MissionId,
  type Rung,
  type ServerMessage,
  type TutorPersona,
  type DrillExercise,
} from '@luvani/core';
/**
 * The authored mission scenes, reached by file rather than through brain's
 * barrel because `@luvani/brain` does not re-export `missions/` yet and its
 * package `exports` map admits only `.`, `./llm` and `./profile`. One line in
 * that barrel turns this back into an ordinary named import from '@luvani/brain';
 * the file lives in brain's territory, so it is filed rather than edited here.
 */

import { reportUsage } from './usage.ts';
import { reportConversationPack } from './conversationPacks.ts';
import { outputGuard, recordSafetyDecision, safetyDecision } from './safety.ts';

/**
 * The wire shapes, derived from the protocol's own ServerMessage rather than
 * restated: core's barrel does not re-export the payload types, and deriving
 * them here means the mapping helpers are checked against the exact objects
 * `encodeMessage` will accept.
 */
export type ConvoView = Extract<ServerMessage, { t: 'convo' }>['view'];
export type RecapPayload = Extract<ServerMessage, { t: 'recap' }>['recap'];

/**
 * Anything that can carry a message back to the app.
 *
 * The return value is optional and almost every caller ignores it. One does
 * not: a stop closes the room straight after the message, and closing it before
 * a reliable data frame has flushed would take the crisis line with it. So a
 * publisher that knows when its frame has landed may say so, and `closeAfterStop`
 * is the only place that waits.
 */
type Publisher = (message: ServerMessage) => void | Promise<void>;

/**
 * The half of the framework's SpeechHandle this file uses.
 *
 * Structural rather than imported: `voice` does not re-export SpeechHandle, and
 * in text mode and in tests there is no handle at all.
 */
type SpokenLine = { waitForPlayout: () => Promise<void> } | undefined;

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
    // The win rides the turn that earned it. Required on the wire precisely so
    // that this mapping cannot quietly forget it: a view built without it would
    // read as "not yet" for the rest of the session, and the card that says the
    // learner just did a real thing in French would never come.
    missionDone: view.missionDone,
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

/** The three the engine builds a coaching policy for. */
const STRICTNESSES: readonly Strictness[] = ['flow', 'balanced', 'strict'];

/**
 * How much this learner asked to be corrected.
 *
 * Every scene this agent opens used to be built on the literal `'flow'`, so two
 * of the three policies `grading.ts` builds and tests never ran anywhere a
 * learner could hear them, and the eval and production disagreed about the
 * product. The preference already survives a session — `finishSession` refuses
 * to write it back precisely so it stays a setting rather than a log — and this
 * is the read that makes it mean something.
 *
 * Fresh profiles say `balanced`, from `createProfile`, so the live default is
 * one step firmer than it was. That change was approved on its own terms, and it
 * is still bounded: `INLINE_CAP` caps findings per turn, and K1's cooldown caps
 * uninvited interruptions per session, so `balanced` widens what may be said and
 * not how often the scene is broken into.
 *
 * Guarded rather than trusted, for the same reason the seed topic and the
 * mission id are. The profile rides the join credential: it is server-signed,
 * but the shape inside it came off a device, and a strictness the policy tables
 * have no row for is not a pedagogy difference, it is a `TypeError` in the first
 * turn of somebody's session. Anything unreadable lands where a brand new
 * learner lands.
 */
export function strictnessOf(profile: LearnerProfile): Strictness {
  const stored: unknown = profile.preferences?.strictness;
  return STRICTNESSES.find((known) => known === stored) ?? 'balanced';
}

/**
 * The pace a scene opens at, read the way strictness is: guarded, not trusted.
 * A learner who asked in Profile for a slower tutor gets shorter sentences from
 * the first line rather than after tapping Slower once per session. The field
 * is optional on the profile and unknown off a device, so anything but the one
 * word this app writes reads as 'normal', which is where every learner who has
 * never asked already is.
 */
export function paceOf(profile: LearnerProfile): Pace {
  return profile.preferences?.pace === 'slow' ? 'slow' : 'normal';
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
  /**
   * What the scene says instead, when the output guard takes a tutor line out.
   *
   * The learner did nothing, so nothing is said to them about it: no apology,
   * no notice, no hint that anything was removed. It hands the floor straight
   * back, because the one thing a suppressed line must never do is leave
   * somebody sitting in front of a scene that has stopped answering.
   */
  carryOn: {
    fr: "On continue. Vas-y, je t'écoute.",
    en: "Let's keep going. Go ahead, I'm listening.",
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
 * The mission this session was started on, kept only when this build knows it.
 *
 * A second passenger on the pipe the seed topic already rides, and checked on
 * arrival for the same reason: signed is not the same as sane, and the value
 * decides which scene a learner is dropped into.
 *
 * The id space itself is brain's to own, so the check IS `missionFrame` — it
 * already answers `undefined` for an id this build has never heard of and for
 * the inherited property names that make an ordinary object lookup dangerous.
 * Restating that list here would be a second opinion that could disagree.
 *
 * Dropped, never refused: an app and an agent ship on different days, so an
 * unknown id gets the ordinary choosing question, which is exactly the session
 * the learner would have had without a mission to tap.
 */
export function validMissionId(value: unknown): MissionId | undefined {
  if (typeof value !== 'string') return undefined;
  const id = value.trim();
  return missionFrame(id) === undefined ? undefined : (id as MissionId);
}

/** A title closed off exactly once, whatever punctuation it arrived with. */
function asSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * What the tutor says on the way into a mission.
 *
 * One short line, and a statement rather than a question: the learner chose
 * this scene a moment ago, so asking them again would be the app forgetting
 * what it was told. It is not the bridge line either — the bridge exists to
 * cover a scenario build, and a mission has none to cover.
 *
 * The title leads and the promise follows, the same shape (and the same
 * argument) as `seededOpening`: that is how the card read a moment ago, and it
 * stays grammatical in both languages whatever the title turns out to be —
 * including the one mission whose title is itself a question.
 */
export function missionOpening(frame: ScenarioFrame): { fr: string; en: string } {
  return {
    fr: `${asSentence(frame.title)} On y va.`,
    en: `${asSentence(frame.titleEn)} Here we go.`,
  };
}

/**
 * The opening question, with the learner's name on the front of it.
 *
 * Composed in code rather than by the model, because `open()` exists to put a
 * voice in the room within seconds of joining and a model call here would
 * spend the whole of that budget saying hello.
 *
 * One string, not two `say()` calls: the framework splits sentences inside a
 * single speech handle, so the greeting and the question keep their own cache
 * keys. The question is already warmed, so only the greeting is a cold miss,
 * and it plays first while the warm half streams from disk.
 *
 * THE GREETING HAS TO BE LONG ENOUGH TO BE ITS OWN SENTENCE, and that is not a
 * style note. The framework's splitter takes a `minSentenceLength` of 20
 * (@livekit/agents basic.js), so "Hi Sam." glued to the question and the pair
 * took ONE cache key that the warm run had never seen. The warm script splits
 * with the same tokenizer, so it stored the bare question, and the bare
 * question is only ever what an unnamed learner hears. Every named learner's
 * first line of every session was a full cold vendor round trip, at the one
 * moment a learner is deciding whether this thing works, while the comment
 * here said the opposite. Measured, not reasoned: the glued form tokenizes to
 * one chunk, the current form to two, for names from one letter to nine.
 */
export function openerFor(name: string | null): { fr: string; en: string } {
  if (name === null || name.length === 0) return { fr: CONVO_LINES.opener.fr, en: CONVO_LINES.opener.en };
  return {
    // The French is shown, never spoken (open() says the English), so only the
    // spoken half has to clear the splitter's twenty-character floor.
    fr: `Bonjour ${name}. ${CONVO_LINES.opener.fr}`,
    en: `Hi ${name}, good to see you. ${CONVO_LINES.opener.en}`,
  };
}

/**
 * The tutor's whole answer as one utterance: at most one short English support
 * segment, then the character's French line.
 *
 * One string rather than three say() calls, and that is not tidying. Each
 * speech handle is a full speaking → listening → speaking cycle in the
 * framework, so a single turn was producing three of them. The latency record
 * split three ways with only the first carrying its marks, so no usable
 * per-turn number existed. The rescue clock arms on `listening` and speak() is
 * fire-and-forget, so a sentence whose first audio byte was slow could fire a
 * rescue while the tutor was still mid-answer, costing a ladder drop and an
 * unearned brain turn. And the orb flipped to green "your turn" in the gaps
 * between the tutor's own sentences.
 *
 * The cache is unaffected: the framework splits sentences inside one handle, so
 * each sentence keeps the key it always had. Which is why every part is closed
 * off with terminal punctuation first — a part that ran into the next one would
 * make a new sentence and, with it, a new cache key for a line already on disk.
 */
export function spokenTurn(view: TurnView): string {
  /**
   * A learner came here to have a conversation, not to hear the tutor read
   * every card on screen back to them. Routine corrections still appear in the
   * UI and reach the recap, but they do not break the scene out loud.
   *
   * Reaching for English is the useful exception: the learner has explicitly
   * asked for language help through what they said. In that case the coach line
   * gives the natural French meaning before the scene carries on. A scene shift
   * and a translation would otherwise create two English explanations in the
   * same breath, so the learner's immediate need wins; the shift remains
   * visible on screen.
   */
  const support = view.reachedForEnglish ? view.coachLine : view.narration?.en;
  const parts = [support, view.sceneReply.fr];
  return parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => {
      const text = part.trim();
      return /[.!?…]$/.test(text) ? text : `${text}.`;
    })
    .join(' ');
}

/**
 * Whether this turn plays out in full.
 *
 * The strictest of the parts wins, because one utterance carries one answer. A
 * scene shift is never interruptible — a learner who misses the new picture
 * cannot follow anything said inside it — and on the low rungs nothing is,
 * because without headphones the microphone hears the tutor and a barge-in
 * during a modelled line is almost never the learner.
 */
export function turnIsUninterruptible(view: TurnView): boolean {
  return view.narration !== null || view.rung <= 2;
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
 * A model call, a promise that it will end, and a way to stop paying for it.
 *
 * Every vendor SDK here can leave a request open indefinitely — a socket that
 * stays up and says nothing looks exactly like a model that is still thinking.
 * One helper for both calls that a learner is waiting on, so a hung turn and a
 * hung scene builder cannot drift into two different ideas of patience.
 *
 * The race alone was only half of it. Giving up on a promise does not stop the
 * work behind it: the request stayed open, the model kept generating, the
 * vendor kept billing, and because `recordBrainUsage` sits after the `await`
 * that never returned, not one token of it was ever metered. The worst case is
 * the biggest call — a healthy drill batch runs about sixty-five seconds
 * against a ninety-second bound, so an unlucky one is a full-price batch nobody
 * reads and nobody counts. Hence the controller: the deadline aborts the call
 * as well as abandoning it.
 *
 * `work` is a factory rather than a promise because the signal has to reach the
 * request, and every caller used to build the request first. Taking the factory
 * is what makes the abort reach the wire instead of stopping here.
 *
 * `onAbandoned` fires at the deadline itself, not off the rejection, so the
 * count is of calls this agent gave up on — never of whichever error happened
 * to win the race afterwards.
 *
 * The losing timer is always cleared: an unhandled rejection from a settled race
 * takes the worker down, which strands every learner on it.
 */
async function withDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  ms: number,
  what: string,
  onAbandoned?: () => void,
): Promise<T> {
  const controller = new AbortController();
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      deadline = setTimeout(() => {
        const expired = new Error(`no ${what} after ${ms}ms`);
        onAbandoned?.();
        // Abort first: the point of this timer is that the spend stops, and a
        // rejection handled before the abort leaves the socket open for as
        // long as the vendor feels like keeping it.
        controller.abort(expired);
        reject(expired);
      }, ms);
    });
    return await Promise.race([work(controller.signal), timeout]);
  } finally {
    if (deadline !== undefined) clearTimeout(deadline);
  }
}

/**
 * The text-mode silence window. Typing is slower than speaking and a reader
 * pauses differently from a speaker, so the four-second voice rule would feel
 * like being hovered over. Twelve seconds of nothing still means stuck.
 */
export const TEXT_SILENCE_MS = 12_000;

/**
 * How long "give me a moment" buys, before the ordinary silence policy resumes.
 *
 * One constant in one place, and a guess to be tuned by ear in a live session.
 * The floor under any mis-tuning is that nothing here is a decision about the
 * learner: what eventually arrives is the ordinary first rescue with its English
 * intent hint, so the worst case is support landing slightly early or late.
 *
 * Bounded rather than open-ended because the alternative is a learner sitting in
 * front of a scene with nothing coming, which is the one thing this session is
 * never allowed to do.
 */
export const MOMENT_GRACE_MS = 20_000;

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
 * What a session cost, kept where the room cannot take it with it.
 *
 * The per-call `[luvani:brain]` line is a running commentary and nothing more:
 * it lives in the worker's stdout for as long as the room does, it is one line
 * per call in a stream shared with every other session on the worker, and
 * adding it up by eye is not a measurement. The checkpoint question — is prompt
 * caching landing, and which activity is actually expensive — needs the totals,
 * once, at the end, in a shape something can parse.
 */
export type BrainActivity = 'turn' | 'frame' | 'extract' | 'curate' | 'drills';

/** The order the summary prints in: the scene, the live turns, then the analyst. */
const BRAIN_ACTIVITIES: readonly BrainActivity[] = ['frame', 'turn', 'extract', 'curate', 'drills'];

export interface ActivitySpend {
  /** Calls that came back with a bill — parsed or not, used or not. */
  calls: number;
  /**
   * Calls this agent gave up on at the deadline. Counted separately because
   * they are the one kind of spend with nothing at all to show for it, and
   * because a rising count here is the signal that a bound is set too tight.
   */
  abandoned: number;
  usage: LlmUsage;
}

export type SessionSpend = Record<BrainActivity, ActivitySpend>;

/** A meter with nothing on it yet. */
export function emptySpend(): SessionSpend {
  const spend = {} as SessionSpend;
  for (const activity of BRAIN_ACTIVITIES) spend[activity] = { calls: 0, abandoned: 0, usage: ZERO_USAGE };
  return spend;
}

/**
 * What the vendor charges input on: uncached tokens plus both halves of the
 * cache. `inputTokens` is UNCACHED input on every adapter, so the three add up
 * rather than overlapping — the sum is the denominator a cache hit rate means.
 */
function chargedInput(usage: LlmUsage): number {
  return usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
}

/** `n/a` rather than `0%`, because nothing charged is not a cache that missed. */
function cacheHitRate(usage: LlmUsage): string {
  const charged = chargedInput(usage);
  if (charged === 0) return 'n/a';
  return `${Math.round((usage.cacheReadTokens / charged) * 100)}%`;
}

/**
 * Reasoning tokens, or the honest absence of them.
 *
 * Absent means the vendor did not break them out, which is not the same as a
 * measured zero, so it prints as `n/a`. They are never added to a cost either:
 * both vendors bill thinking inside `output_tokens`, so counting them again
 * would double-charge the most expensive column in the table.
 */
function reasoningOf(usage: LlmUsage): string {
  return usage.reasoningTokens === undefined ? 'n/a' : String(usage.reasoningTokens);
}

/** Dollars, at the precision a single session actually costs. */
function usd(amount: number): string {
  return amount.toFixed(6);
}

/**
 * One line, per activity and in total, priced from the model that answered.
 *
 * Pure and exported so the shape can be asserted directly rather than scraped
 * back out of a console mock. The total is the SUM of the per-activity prices,
 * never a price of the summed usage: a session mixes a cheap live model with a
 * dear analyst one, `addLlmUsage` drops the stamp when they disagree, and
 * pricing a mixed total would fall back to the dearest row and be wrong by an
 * order of magnitude in exactly the number that decides which brain ships.
 */
export function formatBrainSummary(spend: SessionSpend, sessionId: string): string {
  const segments: string[] = [];
  let calls = 0;
  let abandoned = 0;
  let total = ZERO_USAGE;
  let dollars = 0;

  for (const activity of BRAIN_ACTIVITIES) {
    const row = spend[activity];
    calls += row.calls;
    abandoned += row.abandoned;
    total = addLlmUsage(total, row.usage);
    const priced = priceUsage(row.usage);
    dollars += priced.usd;
    // An activity nobody used says nothing. An activity that was only ever
    // abandoned still has to appear: that is the spend with no usage attached.
    if (row.calls === 0 && row.abandoned === 0) continue;
    segments.push(
      `${activity} calls=${row.calls} abandoned=${row.abandoned} in=${row.usage.inputTokens} ` +
        `cacheRead=${row.usage.cacheReadTokens} cacheWrite=${row.usage.cacheWriteTokens} ` +
        `out=${row.usage.outputTokens} reasoning=${reasoningOf(row.usage)} cacheHit=${cacheHitRate(row.usage)} ` +
        `usd=${usd(priced.usd)} pricedAs=${priced.pricedAs}` +
        (priced.exact ? '' : ` unpriced=${priced.unknownModel ?? 'none-stamped'}`),
    );
  }

  const head =
    `[luvani:brain:summary] session=${sessionId.slice(0, 8)} usd=${usd(dollars)} calls=${calls} ` +
    `abandoned=${abandoned} in=${total.inputTokens} cacheRead=${total.cacheReadTokens} ` +
    `cacheWrite=${total.cacheWriteTokens} out=${total.outputTokens} reasoning=${reasoningOf(total)} ` +
    `cacheHit=${cacheHitRate(total)}`;
  return segments.length === 0 ? head : `${head} | ${segments.join(' | ')}`;
}

/**
 * A 12-turn budget makes a framed 3–5 minute scene, and the beat cap keeps it
 * moving. How much of it is coaching is the learner's, not this file's: see
 * `strictnessOf`.
 */
const CONVO_MAX_TURNS = 12;

/** Where a conversation is: choosing a topic, building the scene, or inside it. */
export type ConversationPhase = 'choosing' | 'starting' | 'scene';

export class LuvaniConversation extends voice.Agent {
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
  /**
   * The learner asked for time and has not used it yet.
   *
   * It exists because the grace was being destroyed by the very thing it is
   * there to tolerate. The grace shares the one silence-clock handle, and
   * `agent.ts` re-arms that clock on every transition to `listening` while
   * `setLearnerSpeaking(true)` clears it — so a learner who tapped the control
   * and then shifted in their chair, or started a word and stopped, lost the
   * whole twenty seconds and was rescued four seconds later anyway. The control
   * silently did nothing in the exact situation it exists for.
   *
   * So a NOISE no longer spends the grace and neither does a re-arm; only the
   * learner actually taking their turn does, or the grace running out on its
   * own. That is the distinction the control is making in the first place:
   * being quiet is not being stuck, and a sound is not an answer.
   */
  private momentHeld = false;
  private startedAt = Date.now();
  private ended = false;
  /** One completion timestamp shared by the generating claim and ready upsert. */
  private finishedAt: string | null = null;
  /** A hard safety stop must never create a durable learning artefact. */
  private safetyStopped = false;
  /**
   * Turns the learner actually produced: spoken, typed, or a help/skip tap.
   * Everything except the silence rescue, which is the one input the agent
   * applies on their behalf. Billing reads this and never `recap.stats.turns`,
   * which `integrateTurn` advances for a rescue too — see `finish()`.
   */
  private learnerTurns = 0;
  /** A spent credential re-opened this room, so this tutor never goes on air. */
  private refused = false;
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

  private sessionIdValue = UNSIGNED_SESSION_ID;

  /** Signed into the join token; retries with this id can never double-debit. */
  get sessionId(): string {
    return this.sessionIdValue;
  }

  /**
   * Where the replay check lands, for the same reason and by the same rule as
   * `LuvaniTutor`: agent.ts writes the signed session id here before the tutor
   * opens its mouth, and a credential whose session was already reported is
   * spent. Refusing here is what stops a re-created room from buying a whole
   * free conversation — scene build, brain turns, speech and all.
   */
  set sessionId(value: string) {
    this.sessionIdValue = value;
    if (!sessionAlreadyReported(value)) return;
    this.refused = true;
    this.ended = true;
    this.clearRescue();
    console.warn(`[luvani] refused a replayed join credential for session ${value.slice(0, 8)}`);
  }
  /** Raw provider-neutral tokens, so development sessions produce real cost evidence. */
  private modelUsage: LlmUsage = ZERO_USAGE;
  private modelCalls = 0;
  /** The same tokens, split by what they bought. What the summary line reads. */
  private spend: SessionSpend = emptySpend();

  /**
   * Text mode: the same conversation with the voice pipeline dark. Learner
   * turns arrive as typed `say` messages, the tutor's lines render instead of
   * sounding, and the silence rescue runs on a reader's clock. Everything
   * pedagogical is identical — that is the point.
   *
   * Not readonly, because the learner may change their mind. The `mode` frame
   * flips exactly this, mid-scene, and nothing else moves: see `setVoiceless`.
   */
  private voiceless: boolean;
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
   * The mission this session was started on, or nothing. Its scene was authored
   * ahead of time, which is the whole of why a mission opens in seconds.
   */
  private readonly missionId: MissionId | undefined;
  /**
   * The rung this session was asked to open on, or nothing.
   *
   * Set only when the learner is replaying a mission they have already
   * finished: core's `replayRung` decides the raise, the token server signs it
   * and agent.ts clamps it, so by the time it lands here it is a `Rung` and
   * this class re-decides nothing about it. Consumed in `openMission` alone —
   * see there for why it is deliberately not read anywhere else.
   */
  private readonly startRung: Rung | undefined;

  /**
   * The chosen person, or nothing.
   *
   * Held rather than resolved: `undefined` means nobody chose, and
   * `buildSystemBlocks` answers that from the catalogue, so this class never
   * carries a second opinion about who the tutor is by default and a learner
   * who has never picked gets byte-for-byte the prompt they got before.
   *
   * Every `buildSystemBlocks` call in this file takes it. There are five, they
   * are far apart, and four of them are on paths a test rarely walks (the scene
   * build, curation, memory, drills). Miss one and nothing breaks: that path
   * simply introduces the catalogue default while the rest of the session is
   * someone else, which is the mismatch F292 exists to stop and which only
   * shows up as a learner hearing a woman's voice call herself Luc.
   * `convo.test.ts` reads this file back to prove no bare call survives.
   */
  private readonly persona: TutorPersona | undefined;

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
      /**
       * The mission this session was started on, if it was started from the
       * chooser. `unknown` for the same reason the seed is: the guard decides
       * what a mission id is, not the caller.
       */
      missionId?: unknown;
      /**
       * Open a replayed mission on this rung instead of the ordinary opening.
       * A `Rung` and not `unknown`, unlike the two above: this value is decided
       * before it gets here — agent.ts clamps the signed number into the
       * ladder — so there is nothing left for a guard on this side to decide.
       */
      startRung?: Rung;
      /**
       * The person the learner chose to be taught by. Resolved by the agent,
       * which holds the vendor key and therefore decides which voice speaks,
       * and handed down here so the prompt and the voice describe one person.
       */
      persona?: TutorPersona;
    } = {},
  ) {
    // The pipeline LLM never generates here; see the header. One line keeps
    // the framework satisfied and makes the intent grep-able.
    super({ instructions: 'You are unused; replies are generated out of band.' });
    this.profile = profile;
    this.voiceless = opts.voiceless ?? false;
    this.state = createConversation(chooseFrame(profile), learnerSnapshotFrom(profile), {
      strictness: strictnessOf(profile),
      pace: paceOf(profile),
      maxTurns: CONVO_MAX_TURNS,
    });
    this.client = opts.client ?? brainClient();
    this.seedTopic = validSeedTopic(opts.seedTopic);
    this.missionId = validMissionId(opts.missionId);
    // Held, not applied. The placeholder state built just above is the scene
    // nobody is in yet, and every real scene is built again when it opens.
    this.startRung = opts.startRung;
    this.persona = opts.persona;
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

  /** The same meter, split by activity. Read-only, for the summary and for tests. */
  get brainSpend(): SessionSpend {
    const copy = {} as SessionSpend;
    for (const activity of BRAIN_ACTIVITIES) {
      const row = this.spend[activity];
      copy[activity] = { calls: row.calls, abandoned: row.abandoned, usage: { ...row.usage } };
    }
    return copy;
  }

  private recordBrainUsage(activity: BrainActivity, usage: LlmUsage): void {
    this.modelCalls += 1;
    this.modelUsage = addLlmUsage(this.modelUsage, usage);
    const row = this.spend[activity];
    this.spend[activity] = { calls: row.calls + 1, abandoned: row.abandoned, usage: addLlmUsage(row.usage, usage) };
    const charged = chargedInput(usage);
    if (charged === 0 && usage.outputTokens === 0) return;
    const totalInput = this.modelUsage.inputTokens + this.modelUsage.cacheReadTokens + this.modelUsage.cacheWriteTokens;
    console.info(
      `[luvani:brain] ${activity}: ${charged} input (${usage.cacheReadTokens} cached), ${usage.outputTokens} output; ` +
        `session total ${this.modelCalls} calls, ${totalInput} input, ${this.modelUsage.outputTokens} output`,
    );
  }

  /**
   * A call this agent gave up on. Named, counted, and never silent.
   *
   * The abandonment is the whole of the cost: the request went out, the vendor
   * answered it or is still answering it, and the only thing that did not
   * happen is anybody reading the answer. A count that only ever goes up under
   * one activity is a bound set too tight, which is a question about a number
   * in this file rather than about the model.
   */
  private noteAbandoned(activity: BrainActivity, ms: number): void {
    const row = this.spend[activity];
    this.spend[activity] = { ...row, abandoned: row.abandoned + 1 };
    console.warn(`[luvani:brain] ${activity} abandoned after ${ms}ms`);
  }

  /**
   * A call that was billed and then thrown away, metered anyway.
   *
   * `BrainParseError` is the expensive failure: a full prompt in, a full answer
   * out, a retry on top of it, and nothing usable at the end. Dropping its
   * usage made the single most costly outcome the one outcome the meter never
   * saw. Anything else that throws here (a socket, an abort, an outage) carries
   * no usage to record and passes through untouched.
   */
  private recordFailedCall(activity: BrainActivity, error: unknown): void {
    if (error instanceof BrainParseError && error.usage !== undefined) this.recordBrainUsage(activity, error.usage);
  }

  /**
   * What this session cost, once, on the way out.
   *
   * Emitted from `finish()` AFTER the analyst calls have settled. Emitting it
   * where the recap ships would have excluded extraction, curation and drill
   * authoring — the three biggest calls the session makes, and the exact spend
   * this line exists to measure.
   */
  private logSpendSummary(): void {
    console.info(formatBrainSummary(this.spend, this.sessionId));
  }

  /**
   * Every spoken line funnels through here so text mode can stay silent.
   *
   * The handle comes back so one caller can wait on the words: a stop closes
   * the room, and it must not close it over the top of the only sentence that
   * mattered. Text mode returns nothing, which is the honest answer there.
   */
  private say(text: string, options: { allowInterruptions?: boolean } = {}): SpokenLine {
    if (this.voiceless) return undefined;
    return this.session.say(text, options);
  }

  /**
   * Go quiet, or come back to voice, without leaving the scene.
   *
   * The whole switch is this flag, which is why it is a switch at all rather
   * than a new session: `say` already funnels every spoken line through it and
   * `silenceWindow` already reads it, so flipping it silences the tutor and
   * moves the clock onto a reader's pace in one move. The conversation, the
   * ladder, the beat and the meter carry on from exactly where they were —
   * which is the difference between switching mode and starting again.
   *
   * Nothing is torn down and nothing is interrupted. A line already on its way
   * out finishes: cutting the tutor off mid-word to honour a control the
   * learner tapped while listening would be a worse answer than the half second
   * it saves. Nothing NEW is spoken after this returns.
   *
   * The clock is re-armed only if one was already running, the same rule
   * `typing` keeps: `armRescue` owns whether the tutor may be waiting on a
   * learner at all, and a mode switch must not be a second opinion about that.
   * Re-armed rather than left alone because the two windows are different
   * lengths, and a learner who switches to text to start typing would otherwise
   * be rescued four seconds later, mid-sentence, by a voice clock.
   *
   * Silent, on purpose. Nobody is told the tutor noticed.
   */
  setVoiceless(voiceless: boolean): void {
    if (this.voiceless === voiceless) return;
    this.voiceless = voiceless;
    if (this.silenceTimer) this.armRescue(this.session);
  }

  /**
   * The worker's own room close, wired by agent.ts. Unwired (tests, the
   * playground) it costs nothing.
   *
   * The tutor does not disconnect anything itself. It owns one judgement — that
   * this session is over and the learner has heard why — and the worker owns
   * the room, exactly as it already does for the hard stop and for a learner
   * who walks away.
   */
  private closeRoom: () => void = () => {};

  /**
   * Wire the room's disconnect.
   *
   * After a stop the session will neither hear nor answer, and until this
   * existed the microphone stayed published and the recogniser kept
   * transcribing into it. Nothing downstream reads those words, so the only
   * thing they cost is the learner's belief that somebody is still listening.
   */
  attachRoomClose(close: () => void): void {
    this.closeRoom = close;
  }

  /** Wire up the channel back to the app. */
  attach(publish: Publisher): void {
    this.publish = publish;
    // The refusal is decided when the signed session id lands, which is before
    // there is any channel back to the app. Say it now or nobody hears it.
    if (this.refused) this.publishError(REPLAYED_SESSION_MESSAGE);
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
   * Handle explicit high-risk content before it can become model context.
   *
   * The words leave on the `safety` frame and not on `error`. They are the same
   * words either way, but the app renders severity from the tag: an `error` is
   * a self-clearing notice built for a TTS outage, and a crisis line that
   * removes itself after eight seconds is worse than not saying it. Sent once,
   * on one channel, because both ends of this ship from one repo and a doubled
   * send would give a current app the vanishing toast as well as the surface
   * that stays.
   */
  private handleSafety(text: string): boolean {
    const decision = safetyDecision(text);
    if (decision === null) return false;
    this.releaseMoment();
    this.clearRescue();
    recordSafetyDecision({
      sessionId: this.sessionId,
      category: decision.category,
      action: decision.action,
      rule: decision.rule,
      mode: 'convo',
      voiceless: this.voiceless,
    });
    const delivered = this.publish({ t: 'safety', category: decision.category, action: decision.action, message: decision.message });
    const spoken = this.say(decision.message, { allowInterruptions: false });
    if (decision.action === 'stop') this.safetyStopped = true;
    if (decision.action === 'stop') void this.closeAfterStop(delivered, spoken);
    return true;
  }

  /**
   * A stop, all the way through: the words, then the room.
   *
   * `finish()` is started and deliberately not awaited. It debits the seconds
   * and then runs the analyst, which is up to a minute and a half of
   * post-session model work — and a microphone that stays published for a
   * minute and a half after the tutor has said it cannot help is the whole of
   * this defect. The books still close on their own; the room does not wait for
   * them.
   *
   * What the room does wait for is delivery. In a spoken session that is the
   * speech handle. In a typed one there is no speech at all, so the reliable
   * data frame is the only delivery there is, and disconnecting before it
   * flushes would take the message with it.
   */
  private async closeAfterStop(delivered: void | Promise<void>, spoken: SpokenLine): Promise<void> {
    void this.finish();
    try {
      await delivered;
      await spoken?.waitForPlayout();
    } catch (error) {
      // A line that could not finish playing is still a line that was said, and
      // a room that stays open is worse than one that closes a beat early.
      console.warn('[luvani] the stop message did not settle cleanly; closing the room anyway:', error);
    }
    this.closeRoom();
  }

  /**
   * What the tutor is about to say, checked before the learner hears it.
   *
   * `safetyDecision` reads learner input and nothing read the model's own
   * lines, so a scene reply, a coach line, a narration and the remembered
   * opener were spoken exactly as they arrived. This is the other half.
   *
   * The consequence is a substitution and never a stop: the learner did
   * nothing, and a session that ends because the model misbehaved punishes the
   * wrong person. `null` back means the line is fine, which is nearly always.
   */
  private guardLine(line: string, surface: string): boolean {
    const finding = outputGuard(line);
    if (finding === null) return true;
    recordSafetyDecision({
      sessionId: this.sessionId,
      category: finding.category,
      action: 'suppress',
      rule: finding.rule,
      mode: 'convo',
      voiceless: this.voiceless,
    });
    console.warn(`[luvani] a tutor ${surface} failed the output guard and was replaced`);
    return false;
  }

  /**
   * One turn's three tutor surfaces, each checked on its own.
   *
   * Checked per surface rather than on the joined utterance, because the
   * answers differ: a coach line and a narration can simply go, and the scene
   * reply cannot — something has to be said or the scene stops answering. The
   * engine state is untouched, so the model's own line stays in the history the
   * next turn is built from. That is a real limit and it is the brain's to
   * close, not this file's.
   */
  private guardView(view: TurnView): TurnView {
    const sceneOk = this.guardLine(`${view.sceneReply.fr} ${view.sceneReply.en}`, 'scene reply');
    const coachOk = view.coachLine === null || this.guardLine(view.coachLine, 'coach line');
    const narrationOk = view.narration === null || this.guardLine(`${view.narration.fr} ${view.narration.en}`, 'narration');
    if (sceneOk && coachOk && narrationOk) return view;
    return {
      ...view,
      sceneReply: sceneOk
        ? view.sceneReply
        : { ...view.sceneReply, fr: CONVO_LINES.carryOn.fr, frWritten: null, en: CONVO_LINES.carryOn.en },
      coachLine: coachOk ? view.coachLine : null,
      narration: narrationOk ? view.narration : null,
    };
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
    void session; // kept for signature parity with LuvaniTutor; speech goes via this.session
    // A spent credential gets no opening line, no scenario call and no scene.
    // This is the guard that keeps a replayed room from costing model money.
    if (this.refused) return;
    // A mission's scene was written before the learner ever tapped it, so there
    // is nothing to design and nothing to wait for: no scenario call, none of
    // G3's ten to twenty five seconds of unexplained silence, and no F37 fall
    // back to a café nobody asked for. This is the mechanism under the promise
    // that a learner says their first useful French line inside a minute.
    const mission = this.missionId === undefined ? undefined : missionFrame(this.missionId);
    if (mission) {
      this.openMission(mission);
      return;
    }
    // A session started from a practice card already has its answer. Asking
    // again would be the app forgetting what it was just told, so the tutor
    // says what is about to happen and goes straight to the scene. The opening
    // is still published, because the app opens a conversation on that message
    // and would otherwise wait for one that never comes. From there this is the
    // ordinary path: startScene owns the bridge line, the frame call, the
    // timeout and the request-grounded fallback, and every one is inherited.
    if (this.seedTopic) {
      // Checked here, ahead of the publish and ahead of the speech. startScene
      // checks the same text, but it is called last on this path, so the tutor
      // said the topic out loud and the app rendered it before anything read
      // it. The title comes off a practice card, which is the learner's own
      // past session played back at them, so the one thing it must not do is
      // be spoken before it is read.
      if (this.handleSafety(this.seedTopic.en)) {
        // A stop has already closed the session. A redirect has not, and a
        // redirect with no opening after it is a screen that never changes —
        // so the seeded scene is dropped and the ordinary choosing question
        // takes its place, exactly as an invalid seed would have done.
        if (this.ended) return;
      } else {
        const seeded = seededOpening(this.seedTopic);
        this.lastOpening = { t: 'opening', prompt: seeded };
        this.publish(this.lastOpening);
        this.say(seeded.en, { allowInterruptions: false });
        void this.startScene(this.seedTopic.en).catch((error: unknown) => {
          console.error('[luvani] the seeded scene could not be started:', error);
        });
        return;
      }
    }
    // A remembered opener beats the generic question: "So, how was that
    // interview?" is the moment the tutor stops being an app. One line of live
    // synthesis per session, pennies, worth every one of them.
    // A remembered opener is a whole greeting the analyst wrote after the last
    // session, in its own time, and it already knows the learner's name. Only
    // the generic question needs one stapled to the front.
    const remembered = this.profile.memory.opener;
    // The remembered opener is the sharpest edge of the tampered-profile hole:
    // a whole greeting written by a model last session, stored on the device,
    // and handed back to the worker in the join token. It arrives as data and
    // leaves as speech, so it is read before it is either. A greeting that
    // fails falls back to the ordinary question, which is the session the
    // learner would have had anyway.
    const opener =
      remembered && this.guardLine(`${remembered.fr} ${remembered.en}`, 'remembered opener')
        ? remembered
        : openerFor(validLearnerName(this.profile.memory.name));
    this.lastOpening = { t: 'opening', prompt: { fr: opener.fr, en: opener.en } };
    this.publish(this.lastOpening);
    this.say(opener.en, { allowInterruptions: false });
    if (this.voiceless) this.armRescue(this.session);
  }

  /**
   * Open a mission: publish the opening, say one short line, and be in the
   * scene. `buildFrame` is never called on this path — the frame is authored,
   * so the model has nothing left to decide about where this conversation
   * starts. Everything after that is the ordinary scene: `openScene` pins the
   * recogniser to French, publishes the first view, and (in the quiet twin)
   * arms the clock, and the tutor still writes every line of the mission live.
   *
   * The frame is a setting, not a script. The beats are aims, a learner who
   * wants to talk about something else can, and nothing here narrows what
   * anybody may say — only where the scene begins and what finishing it means.
   *
   * Guarded like startScene's tail for the same reason F28 records: a frame the
   * engine chokes on must hand back a moment the learner can act in, never a
   * screen that will not change.
   */
  private openMission(frame: ScenarioFrame): void {
    const opening = missionOpening(frame);
    this.lastOpening = { t: 'opening', prompt: opening };
    this.publish(this.lastOpening);
    this.say(opening.en, { allowInterruptions: false });

    try {
      this.state = createConversation(frame, learnerSnapshotFrom(this.profile), {
        strictness: strictnessOf(this.profile),
        pace: paceOf(this.profile),
        maxTurns: CONVO_MAX_TURNS,
        // The engine's own flag: finishing every beat of a mission is a win to
        // be shown, not a session to be closed. Code decides that, not a prompt.
        mission: true,
        // The only place this is read. A learner walking back into a mission
        // they have already finished should get less help than last time, and
        // core's `replayRung` is what decided how much less — this line is the
        // last hop of that decision, not a second opinion about it.
        //
        // Spread rather than passed, so a session with nothing to replay sends
        // no field at all and the engine's ordinary opening rule answers, which
        // is exactly today's behaviour for every mission opened for the first
        // time.
        //
        // The two sibling `createConversation` calls — the placeholder in the
        // constructor and the scene in `startScene` — deliberately do not get
        // this. That is what makes a rung riding somebody's token unable to
        // stiffen a conversation nobody asked to replay.
        ...(this.startRung !== undefined ? { startRung: this.startRung } : {}),
      });
      this.phase = 'scene';
      this.openScene();
    } catch (error) {
      console.error('[luvani] the mission scene could not be opened; handing back the choosing moment:', error);
      this.returnToChoosing();
    }
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
    if (this.handleSafety(request)) return;
    if (this.phase !== 'choosing') {
      // A duplicate press during a healthy build stays dropped — the scene is
      // seconds away and two would open on top of each other — but it says so,
      // because a drop nobody can see is how this took a week to find.
      console.warn(`[luvani] a topic arrived while the session was ${this.phase}; the scene already coming is the one that opens`);
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
      console.error('[luvani] scenario build failed; opening a simpler scene on the learner request:', error);
      this.publish({ t: 'error', message: "I've kept your topic. We'll start with a simpler version." });
    }
    if (this.ended) return;

    try {
      this.state = createConversation(frame, learnerSnapshotFrom(this.profile), {
        strictness: strictnessOf(this.profile),
        pace: paceOf(this.profile),
        maxTurns: CONVO_MAX_TURNS,
        // So a loanword the learner themself used is not read as a French leak
        // when the opening narration is checked.
        request,
      });
      this.phase = 'scene';
      this.openScene();
    } catch (error) {
      console.error('[luvani] the scene could not be opened; handing back the choosing moment:', error);
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
    if (this.seedTopic || this.missionId) {
      // A session that came from a topic card or a mission has no question to go back to:
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
    try {
      const result = await withDeadline(
        (signal) =>
          this.client.frame({
            kind: 'frame',
            system: buildSystemBlocks(this.persona),
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
            signal,
          }),
        this.frameTimeoutMs,
        'frame',
        () => this.noteAbandoned('frame', this.frameTimeoutMs),
      );
      this.recordBrainUsage('frame', result.usage);
      return result.frame;
    } catch (error) {
      // The fallback scene is startScene's business, not this one's. All that
      // happens here is that a billed failure gets metered on its way past.
      this.recordFailedCall('frame', error);
      throw error;
    }
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
    // The frame is the scenario builder's answer, so its opening line and its
    // narration are model text like any other. A frame the builder wrote around
    // an injected request lands here.
    const openingOk = this.guardLine(`${frame.openingLine.fr} ${frame.openingLine.en}`, 'scene opening');
    const opening = openingOk
      ? frame.openingLine
      : { ...frame.openingLine, fr: CONVO_LINES.carryOn.fr, frWritten: null, en: CONVO_LINES.carryOn.en };
    const narrationOk = this.guardLine(
      `${frame.openingNarration.fr} ${frame.openingNarration.en}`,
      'scene opening narration',
    );
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
      narration: narrationOk
        ? { speaker: narration.speaker, fr: narration.fr, frWritten: narration.frWritten, en: narration.en }
        : null,
      supportView: supportViewForAssistance(0, this.state.lastSupport),
      rung: this.state.ladder.rung,
      beat: { goalEn: beat.goalEn, position: beatIndex + 1, total: beats.length },
      recapDue: false,
      // Read off the state rather than written as false: nothing is won before
      // the learner has said a word, and the engine is the one that says so.
      missionDone: this.state.missionDone,
    });
    // The narration is spoken in English: the learner must be able to picture
    // the scene before a word of French lands on them. A suppressed narration
    // is simply not said — the scene still opens, on its opening line.
    if (narrationOk) this.say(narration.en, { allowInterruptions: false });
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
    // A grace already on the clock is not re-decided by anything that happens
    // while it runs. `agent.ts` calls this on every transition to `listening`,
    // which for a thinking learner is a stray sound and nothing more.
    if (this.momentHeld && this.silenceTimer) return this.queue.generation;
    this.clearRescue();
    void session; // kept for signature parity with LuvaniTutor; speech goes via this.session
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
    // Taking the floor stands the ordinary clock down, but it must not spend a
    // grace the learner has not used: `runRescue` already stands down on its own
    // while they hold the floor, so leaving the grace running costs nothing and
    // keeps the twenty seconds they asked for.
    if (speaking && !this.momentHeld) this.clearRescue();
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
   * One bounded grace window, and then the ordinary policy again.
   *
   * The same handle as the silence clock on purpose, so there is exactly one
   * timer in this class and everything that already stands a clock down —
   * taking the floor, typing, answering, leaving — stands this one down too.
   * A second timer would be a second idea of when the tutor may step in.
   *
   * Bounded, and it hands back to `armRescue` rather than to a smaller version
   * of itself: what eventually comes is the ordinary first rescue with its
   * English intent hint. Nobody is stranded, which is the invariant, and a
   * learner may ask again as many times as they like — asking for time is being
   * present, and presence is what this clock measures.
   *
   * The generation is captured by `armRescue` when the grace runs out, exactly
   * as every other wait captures it: a turn queued while the learner was
   * thinking makes the wait that follows a wait for the tutor, and `runRescue`
   * stands down for that on its own.
   */
  private deferForAMoment(): void {
    this.clearRescue();
    this.momentHeld = true;
    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = undefined;
      this.momentHeld = false;
      this.armRescue(this.session);
    }, MOMENT_GRACE_MS);
  }

  /**
   * The learner used the time. Anything that is a real turn releases the grace:
   * speaking, typing, asking for help, or the session ending. A grace nobody
   * released would be a clock that never comes back, and PEDAGOGY.md's first
   * invariant is that a learner is never stranded.
   */
  private releaseMoment(): void {
    this.momentHeld = false;
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
      console.error('[luvani] a client message could not be handled; the session carries on:', error);
    }
  }

  /** What a client message actually does. Wrapped by handleClientMessage. */
  private async routeClientMessage(session: voice.AgentSession, payload: Uint8Array): Promise<void> {
    if (this.refused) return; // a spent credential gets no conversation, whatever it taps
    const msg = decodeClientMessage(payload);
    if (!msg) return; // a malformed frame must not disturb a live conversation

    if (msg.t === 'mode') {
      // Handled before the phase branches below, because it is true in all of
      // them: a learner can board a quiet train while choosing a topic just as
      // easily as mid-scene, and the protocol already refused any frame whose
      // `voiceless` was not a boolean.
      this.setVoiceless(msg.voiceless);
      return;
    }

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

    if (msg.t === 'moment') {
      // "Give me a moment" is presence, not failure — the argument `typing`
      // already settled, said in words instead of keystrokes. It defers the
      // clock and does nothing else: no applyNonSpokenInput, no rung, no rescue
      // count, and not one word spoken. A learner who asks for time has got
      // nothing wrong, and a spoken acknowledgement of a pause is a remark on
      // the pause, which the tutor is told at every rung never to make. The app
      // answers on screen.
      //
      // While the scene is being built the clock is already dark (armRescue
      // returns early on `starting`), so there is nothing to defer. On the
      // choosing screen it behaves exactly like a keystroke: a restart if a
      // clock is running, and never a clock that was not.
      if (this.phase === 'starting') return;
      if (this.phase !== 'scene') {
        if (this.silenceTimer) this.armRescue(this.session);
        return;
      }
      this.deferForAMoment();
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
    if (msg.t === 'say' && this.handleSafety(msg.text)) return;

    // A typed line is the learner producing French, in either phase: before the
    // scene it IS the topic, and inside it it is the turn. `hear`, `slower`,
    // `english`, `typing` and `moment` are never counted — they are presence,
    // and none of them produces anything. See `finish()` for what it decides.
    if (msg.t === 'say') this.learnerTurns += 1;

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
      if (msg.line === 'scene') {
        // "Replay last tutor line", served by a field rather than a tag of its
        // own. This is the learner tapping the tutor's own bubble, where the
        // line on screen IS the character's, so handing it back is the only
        // honest answer — the opposite of the SAY THIS card below, and the
        // reason the two are told apart here rather than merged.
        const scene = this.lastView?.sceneReply.fr ?? '';
        if (scene.trim().length > 0) this.say(scene, { allowInterruptions: false });
        return;
      }
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
      this.releaseMoment();
      this.clearRescue();
      this.publish({ t: 'transcript', text: msg.text, final: true });
      await this.queue.run(() => this.runBrainTurn({ type: 'spoke', text: msg.text }));
      return;
    }
    if (msg.t === 'help' || msg.t === 'skip') {
      // Counted here rather than with `say` above, because before the scene
      // exists these two only re-offer the question: nothing moves, nothing is
      // produced, and a learner who only ever tapped them has had no session.
      this.learnerTurns += 1;
      // The brain has no skip: a learner reaching for either button is lost,
      // and what a lost learner needs is support, not a hole in the scene.
      // Queued for the same reason as the typed turn: asking for help is the
      // learner answering the silence themselves, and it must retire the
      // rescue that was already on its way.
      this.releaseMoment();
      this.clearRescue();
      await this.queue.run(() => this.rescue({ type: 'help' }));
    }
    // 'choice' arrives as speech as well, exactly like the scripted path.
  }

  /** The learner said something. Run it through the brain, speak the answer. */
  override async onUserTurnCompleted(_chatCtx: llm.ChatContext, newMessage: llm.ChatMessage): Promise<void> {
    if (this.refused) throw new voice.StopResponse();
    this.releaseMoment();
    this.clearRescue();
    this.learnerSpeaking = false;
    const text = (newMessage.textContent ?? '').trim();
    if (text.length > 0 && !this.ended) {
      if (this.handleSafety(text)) throw new voice.StopResponse();
      // Words came out of the learner and the recogniser read them, whatever
      // the phase does with them next. That is the whole test for whether this
      // room reached anybody — see `finish()`.
      this.learnerTurns += 1;
      if (this.phase === 'choosing') {
        // Speech on the choosing screen IS the topic. The transcript shows
        // the learner they were heard; the scene does the rest.
        this.publish({ t: 'transcript', text, final: true });
        void this.startScene(text).catch((error: unknown) => {
          console.error('[luvani] the spoken topic could not open a scene:', error);
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
    if (input.type === 'spoke' && this.handleSafety(input.text)) return;
    // The fifth system-block call, and the only one that is not written as one.
    // brain's `prepareTurn` builds the blocks itself and has no persona to
    // build them from, so its `buildSystemBlocks()` is the catalogue default.
    // This is the prompt the learner actually hears, every single turn: leave
    // it and the scene, the recap and tomorrow's drills all speak as the person
    // they chose while the spoken reply introduces Luc in her voice. Overridden
    // with brain's own builder rather than worked around, and the real repair is
    // a persona argument on `prepareTurn`, which lives in brain's territory and
    // is filed rather than edited here. This line comes out the day that lands.
    const request = { ...prepareTurn(this.state, input), system: buildSystemBlocks(this.persona) };
    let turn;
    try {
      this.markTiming('brainSent');
      // Raced, exactly as the scene builder is. A call that goes out and never
      // comes back used to sit here forever, and the queue reports itself busy
      // for as long as it does — so the rescue stood down, no clock ran, and the
      // learner was left in front of their own sentence with nothing coming.
      // A timeout lands in the catch below and is treated as what it is: a turn
      // that failed, indistinguishable downstream from a thrown one.
      const result = await withDeadline(
        (signal) => this.client.turn({ ...request, signal }),
        this.turnTimeoutMs,
        'turn',
        () => this.noteAbandoned('turn', this.turnTimeoutMs),
      );
      turn = result.turn;
      this.recordBrainUsage('turn', result.usage);
      this.markTiming('brainParsed');
    } catch (error) {
      // Metered before anything else decides what to do with it: a billed call
      // that could not be parsed is still a billed call, and the recovery below
      // is the same either way.
      this.recordFailedCall('turn', error);
      if (this.ended) return; // a failed turn against a finished session is just noise
      if (error instanceof BrainParseError || error instanceof BrainRefusalError) {
        this.recover();
        return;
      }
      // Anything else (network, provider outage) gets the same gentle exit:
      // an unhandled throw here would strand the learner in silence.
      console.error('[luvani] convo brain turn failed:', error);
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

    // Guarded once, before both, so the screen and the speaker can never carry
    // different words. Two checks would be two chances to disagree at the exact
    // moment agreement matters.
    const guarded = this.guardView(view);
    this.publishView(toConvoView(guarded));
    this.speak(guarded);

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
    // Rotated on the turn count so a session that fails twice does not say the
    // identical sentence twice, which is the moment a tutor stops being a
    // person. Same line spoken and published, so voice and text agree.
    const line = recoveryLine(this.state.turnCount);
    this.say(line);
    if (!this.voiceless) return;
    this.publishError(line);
    this.armRescue(this.session);
  }

  /** Narration, then coach, then the scene reply — outside-in, like a film. */
  private speak(view: TurnView): void {
    // The recovery line (recover()) deliberately does not mark: a turn that
    // failed is not a data point about how fast a turn answers.
    this.markTiming('sayCalled');
    this.say(spokenTurn(view), turnIsUninterruptible(view) ? { allowInterruptions: false } : {});
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
    this.finishedAt ??= new Date().toISOString();
    this.releaseMoment();
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
      `[luvani] convo complete — ${recap.stats.turns} turns (${this.learnerTurns} from the learner), ` +
        `${recap.stats.rescues} rescues, ${wallClockSec}s, cefr=${recap.cefr.estimate} (${recap.cefr.confidence})`,
    );
    // The same rule as the scripted tutor, for the same reason and with the
    // same defect underneath: `recap.stats.turns` is `state.turnCount`, and the
    // silence rescue runs a real brain turn through `integrateTurn`, which
    // advances it. So a conversation nobody could hear or be heard in used to
    // bill for its whole wall clock. Learner production is the test (F76).
    const billableSeconds = this.learnerTurns > 0 ? wallClockSec : 0;
    if (billableSeconds === 0) {
      console.log(`[luvani] SESSION_NOT_CHARGED session=${this.sessionId.slice(0, 8)} reason=no-learner-turn`);
    }
    // Spent before the call goes out: a crash between here and the debit must
    // not leave a used credential looking fresh to the next room it opens.
    noteSessionReported(this.sessionId);
    await reportUsage({
      userId: this.learnerId,
      sessionId: this.sessionId,
      seconds: billableSeconds,
      utterancesScored: 0,
    });

    // Claim a durable record before the slower analyst calls start. If the app
    // disappears at the recap, Practice can still show that its pack is being
    // prepared; the later upsert replaces it with the curated ready version.
    if (!this.safetyStopped) {
      await reportConversationPack(this.conversationPackFor(recap, null, [], 'generating'));
    }

    // Only now, with the recap shipped, the seconds debited and a durable
    // `generating` record claimed, the analyst does its background work. The
    // app is no longer the owner of post-session practice recovery.
    // Curation runs BEFORE drills so the drill author works from the curated
    // keep-list rather than everything the session touched.
    //
    // Joined rather than fired and forgotten, and note where the join is: AFTER
    // `reportUsage`, so the minutes debit never waits on telemetry, and BEFORE
    // the summary, so the summary includes these three calls. Fired and
    // forgotten they are also unmeasured — they run after every consumer of
    // this promise has moved on, and the worker tears the room down on
    // `finish().finally(...)`, so the biggest spend of the session was
    // structurally the part no summary could ever see.
    //
    // `allSettled`, not `all`: both of these already swallow their own model
    // failures, and a throw from a publish must not cost the summary that would
    // have told us what the failed session cost.
    await Promise.allSettled([this.extractMemory(state.turnCount), this.curateAndDrill(state, recap)]);
    this.logSpendSummary();
  }

  /**
   * The practice editor, then the drill author, in that order. Exactly one
   * `practice` message ships per session whatever happens: the model's
   * grouping when it answers in time, the deterministic code fallback when it
   * does not. Drills are then authored from the same keep-list, so the two
   * artefacts describe the same practice instead of two different sessions.
   */
  private async curateAndDrill(state: ConversationState, recap: SessionRecap): Promise<void> {
    const curated = await this.curatePractice(state);
    this.publish({
      t: 'practice',
      topics: curated.map((topic) => ({ titleFr: topic.title.fr, titleEn: topic.title.en, phrases: topic.phrases })),
    });
    const keepList = curated.flatMap((topic) => topic.phrases);
    const exercises = await this.generateDrills(state.turnCount, keepList.length > 0 ? keepList : undefined);

    // The app may close the instant it shows a recap; this agent continues and
    // writes the audio-free learning artefact directly to the server. The
    // server upserts on this signed session id, so retries cannot duplicate it.
    // Safety stops retain no recap-derived record, even though their existing
    // background work still closes its spend ledger before the room goes away.
    if (!this.safetyStopped) await reportConversationPack(this.conversationPackFor(recap, curated, exercises, 'ready'));
  }

  /** The same safe fallback builds both the early claim and the final artefact. */
  private conversationPackFor(
    recap: SessionRecap,
    curated: readonly CuratedTopic[] | null,
    exercises: readonly DrillExercise[],
    state: 'generating' | 'ready',
  ) {
    const fallbackTitle = recap.topics[0] ?? { fr: 'Votre conversation', en: 'Your conversation' };
    const title = curated?.[0]?.title ?? fallbackTitle;
    const phrases = curated?.flatMap((topic) => topic.phrases) ?? recap.phrases;
    return buildConversationPack({
      id: this.sessionId,
      sessionId: this.sessionId,
      learnerId: this.learnerId,
      createdAt: this.finishedAt ?? new Date().toISOString(),
      state,
      title,
      summary: recap.headline,
      learnerGoal: this.seedTopic?.en ?? null,
      tutorGoal: recap.nextFocus,
      cefr: recap.cefr.estimate,
      keyPhrases: phrases.map((phrase) => ({ fr: phrase.fr, frWritten: phrase.frWritten ?? null, en: phrase.en })),
      wins: recap.wins,
      corrections: recap.fixes.slice(0, 3).map((fix) => ({
        quote: fix.quote,
        better: fix.better,
        betterEn: fix.betterEn,
        why: fix.why,
      })),
      exercises,
    });
  }

  /**
   * The French this learner already produces unprompted.
   *
   * Curation's keep list is five slots wide, and a slot spent re-teaching a
   * phrase the learner has already said naturally is the one thing they need
   * least. `applyCuration` refuses these whatever the model proposes, and the
   * request lists them as evidence so it stops being asked blind — but only the
   * agent side can read the record, so this is where the answer comes from.
   *
   * `timesUsedWell` IS the evidence record's `convoUses`: the brain's count is
   * what `evidenceStateOf` reads to call a card `used`, and `MASTERY_USES` moved
   * into `packages/core/src/review/evidence.ts` so the deck and the phrase book
   * cannot hold two opinions of it. One correct natural use is the threshold
   * there and the threshold here.
   *
   * Honest about what it cannot see: the deck itself lives on the phone, so a
   * card promoted to `transferred` by a transfer drill without ever being
   * spoken in a conversation is invisible from in here. That under-matches, and
   * under-matching costs a re-taught phrase the learner already had — the safe
   * direction, and the reverse of the trade `applyTurnToProfile` makes about
   * credit, because this is about a practice slot and that is about mastery.
   */
  private knownPhrases(): string[] {
    return Object.values(this.profile.phrases)
      .filter((phrase) => phrase.timesUsedWell >= 1)
      .map((phrase) => phrase.fr);
  }

  /** One curation call with a hard deadline and a pure fallback. */
  private async curatePractice(state: ConversationState): Promise<CuratedTopic[]> {
    const sessionTopics = state.topics.map((t) => ({ en: t.en, fr: t.fr }));
    const known = this.knownPhrases();
    if (state.turnCount === 0) {
      return applyCuration(null, state.phrases, sessionTopics, known);
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
        knownPhrases: known,
      });
      const ms = postSessionDeadlineMs('curate');
      const result = await withDeadline(
        (signal) => this.client.curate({ kind: 'curate', system: buildSystemBlocks(this.persona), request, signal }),
        ms,
        'curation',
        () => this.noteAbandoned('curate', ms),
      );
      this.recordBrainUsage('curate', result.usage);
      return applyCuration(result.curation, state.phrases, sessionTopics, known);
    } catch (error) {
      this.recordFailedCall('curate', error);
      console.error('[luvani] curation failed; the code fallback ships instead:', error);
      return applyCuration(null, state.phrases, sessionTopics, known);
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
      const ms = postSessionDeadlineMs('extract');
      const result = await withDeadline(
        (signal) => this.client.extract({ kind: 'extract', system: buildSystemBlocks(this.persona), request, signal }),
        ms,
        'extraction',
        () => this.noteAbandoned('extract', ms),
      );
      this.recordBrainUsage('extract', result.usage);
      this.profile = applyExtractionToProfile(this.profile, result.extraction, new Date().toISOString());
      this.lastRecap = { ...this.lastRecap, profile: this.profile };
      this.publish(this.lastRecap);
    } catch (error) {
      this.recordFailedCall('extract', error);
      console.error('[luvani] memory extraction failed; the recap already shipped without it:', error);
    }
  }

  /**
   * Tomorrow's drills from today's sentences. Best-effort like the memory
   * call, with one extra gate: every generated exercise passes core's
   * deterministic linter before it ships, because a broken drill teaches
   * broken French and a rejected one costs nothing — fixtures cover the gap.
   */
  private async generateDrills(turnCount: number, keepList?: readonly NewPhrase[]): Promise<DrillExercise[]> {
    if (turnCount === 0) return [];
    // The curated keep-list when curation produced one; everything the session
    // recorded only as the fallback, so drills match the practice topics.
    const sessionPhrases = keepList ?? this.state.phrases;
    const profilePhrases = Object.values(this.profile.phrases)
      .filter((p) => !p.mastered)
      .slice(0, 10)
      .map((p) => ({ fr: p.fr, frWritten: p.frWritten, en: p.en }));
    if (sessionPhrases.length === 0 && profilePhrases.length === 0) return [];

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
      const ms = postSessionDeadlineMs('drills');
      const result = await withDeadline(
        (signal) => this.client.drills({ kind: 'drills', system: buildSystemBlocks(this.persona), request, signal }),
        ms,
        'drills',
        () => this.noteAbandoned('drills', ms),
      );
      this.recordBrainUsage('drills', result.usage);

      const valid = result.batch.exercises.filter((exercise) => validateExercise(exercise).ok);
      const dropped = result.batch.exercises.length - valid.length;
      if (dropped > 0) console.warn(`[luvani] drill linter rejected ${dropped} of ${result.batch.exercises.length} exercises`);
      if (valid.length === 0) return [];
      this.publish({ t: 'drills', exercises: valid });
      return valid;
    } catch (error) {
      this.recordFailedCall('drills', error);
      console.error('[luvani] drill generation failed; the fixture bank covers the gap:', error);
      return [];
    }
  }
}
