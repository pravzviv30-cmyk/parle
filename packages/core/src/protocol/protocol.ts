/**
 * The wire protocol between the app and the tutor agent.
 *
 * The agent is authoritative. It owns `SessionState`, runs the ladder, and tells the
 * app what to render; the app publishes microphone audio and a few intent events and
 * otherwise does as it is told.
 *
 * That split is deliberate and worth stating plainly, because the obvious
 * alternative — let the app run the ladder, since it already can — fails three ways:
 *
 *   1. Two copies of the pedagogy drift. The rule "four seconds of silence is being
 *      stuck, not thinking" would exist in two places within a month.
 *   2. Metered minutes become a suggestion. Anything the client counts, the client
 *      can edit.
 *   3. State dies with the app. A commute ends, the app is killed, and the learner
 *      restarts at turn one — which is precisely the friction we are selling against.
 *
 * Messages are JSON over LiveKit's data channel. Small, human-readable in logs, and
 * the volume here is a handful of messages per turn.
 */

import type { Rung } from '../ladder/ladder.ts';
import type { SessionPrompt, SessionSummary, TurnFeedback } from '../session/session.ts';
import type { DrillExercise } from '../drill/types.ts';

/** Data-channel topics. Kept distinct so each side can subscribe narrowly. */
export const TOPIC_SERVER = 'parle.server';
export const TOPIC_CLIENT = 'parle.client';

// ─────────────────────────────────────────────── free-conversation payloads
//
// Structural mirrors of shapes assembled in @parle/brain. Core cannot import
// brain (brain depends on core), so the wire contract is stated here and the
// agent maps brain's richer objects onto it field by field. Deliberate
// duplication: a wire format should not silently widen because an internal
// type grew a field.

export interface ConvoSpeakerLine {
  speaker: string;
  fr: string;
  /** Written form when it differs from how the line is actually said. */
  frWritten: string | null;
  en: string;
}

/** Same shape as the scripted path's support, minus IPA — see brain's SupportView. */
export type ConvoSupportView =
  | { kind: 'full-line'; line: string; written: string | null; gloss: string }
  | { kind: 'options'; options: { text: string; en: string }[] }
  | { kind: 'hint'; hint: string }
  | { kind: 'none' };

export interface ConvoCoachItem {
  kind: string;
  /** Verbatim fragment of what the learner said. */
  quote: string;
  /** What a local would actually say, in spoken form. */
  better: string;
  betterWritten: string | null;
  betterEn: string;
  /** One short plain sentence. Never scolds, never carries a number. */
  why: string;
  weight: 'matters-now' | 'minor';
}

export interface ConvoPhrase {
  fr: string;
  frWritten: string | null;
  en: string;
  enLiteral: string | null;
  register: string;
  note: string | null;
}

/** What the app renders after each free-conversation turn. */
export interface ConvoView {
  sceneReply: ConvoSpeakerLine;
  /** The one spoken coaching line this turn, or null when coaching deferred. */
  coachLine: string | null;
  /**
   * The corrections behind the coach line, quote and better form intact, so
   * the app can show the recast instead of only saying it. Research on
   * recasts is blunt: one that is neither seen nor repeated mostly does not
   * land. Empty when nothing surfaced this turn.
   */
  coachNow: ConvoCoachItem[];
  /**
   * Narrator scene-setting spoken over the top of the scene ("Imagine the
   * scene: you bump into a tall man…"). Present on the opening view and on
   * beat transitions; null the rest of the time. The narrator is not a
   * character — the white notice tone, not the green plaque.
   */
  narration: ConvoSpeakerLine | null;
  supportView: ConvoSupportView;
  rung: Rung;
  beat: { goalEn: string; position: number; total: number };
  recapDue: boolean;
  /**
   * Every beat of a mission is done: the learner did the real thing they came
   * for. Sticky once raised, and false for the whole of an ordinary
   * free-conversation session, which has no mission to finish.
   *
   * A field on the turn rather than a tag of its own, deliberately. The win
   * belongs to the line that earned it, so it must arrive in the same message
   * as that line — a second message would race the turn it is celebrating, and
   * would be invisible to an app that had never heard of it anyway.
   *
   * Required, not optional, so that every place a view is built has to say
   * whether this turn was the win. An optional field would let a construction
   * site drift into silence and read as "not yet" forever.
   *
   * The mismatched pair, stated plainly because the type cannot: an agent that
   * shipped before missions omits the key, and `decodeServerMessage` fills it
   * in as `false` on the way past, which is exactly right — that session had no
   * mission. Required here and filled in there, so the app never has to ask
   * whether a required field is really present. An app that shipped before
   * missions ignores the key and renders the turn exactly as it does today.
   */
  missionDone: boolean;
}

/** The free-conversation end card. Numbers are allowed here and only here. */
export interface RecapPayload {
  headline: string;
  wins: string[];
  fixes: ConvoCoachItem[];
  phrases: ConvoPhrase[];
  /** Exactly one thing to work on next. Never a list. */
  nextFocus: string;
  /** What the conversation was actually about, in order: the scene first, then every steer. */
  topics: { fr: string; en: string }[];
  cefr: { estimate: string; confidence: 'low' | 'medium' | 'high' };
  stats: { turns: number; rescues: number; unassistedRate: number };
}

// ────────────────────────────────────────────────────────── safety decisions
//
// Why the tutor stopped or steered away. The agent decides this in
// services/tutor-agent/src/safety.ts, and the eight names are restated here for
// the same reason brain's shapes are restated above: core cannot import the
// agent, because the agent imports core.
//
// Restated, not duplicated. A test in protocol.test.ts holds this list against
// the agent's own union, so a ninth category cannot reach the wire without core
// learning it in the same commit. Moving the union into core and having the
// agent import it back is the tidier shape and is still open; it needs an edit
// to the agent that this change does not make.

export type SafetyCategory =
  | 'under-13'
  | 'minor-sexual'
  | 'self-harm'
  | 'dangerous-instructions'
  | 'hate-or-harassment'
  | 'regulated-advice'
  | 'prompt-injection'
  | 'emotional-dependency';

/** The same eight, in the order the agent decides them, as a value a reader can walk. */
export const SAFETY_CATEGORIES: readonly SafetyCategory[] = [
  'under-13',
  'minor-sexual',
  'self-harm',
  'dangerous-instructions',
  'hate-or-harassment',
  'regulated-advice',
  'prompt-injection',
  'emotional-dependency',
];

// ─────────────────────────────────────────────────────── pipeline error kinds
//
// What broke, in the words of the thing that broke.
//
// The agent does not classify these itself. Its pipeline hands it an error event
// carrying a five-way discriminated union, and every arm of it already has a
// `type` and a `recoverable` flag the vendor adapter set: `stt_error`,
// `tts_error`, `llm_error`, `realtime_model_error`, `interruption_detection_error`.
// See the handler on AgentSessionEventTypes.Error in services/tutor-agent/src/agent.ts.
//
// The five names are used verbatim rather than translated into something
// prettier, for one reason worth more than the spelling: the agent's mapping is
// then the field itself, with no table in the middle to get wrong, and a sixth
// kind the pipeline learns fails to compile instead of arriving as a silent
// miscategorisation of one of these five.
//
// The app cares because the halves of the pipeline fail differently, and the way
// forward is different for each. A transcription outage means the learner cannot
// be heard, and the answer is the quiet twin. A voice outage means they will not
// hear the tutor, and the answer is the line on the screen. One unclassified
// sentence cannot be asked which of those just happened.

export type ErrorKind =
  | 'stt_error'
  | 'tts_error'
  | 'llm_error'
  | 'realtime_model_error'
  | 'interruption_detection_error';

/** The same five, as a value a reader can walk. */
export const ERROR_KINDS: readonly ErrorKind[] = [
  'stt_error',
  'tts_error',
  'llm_error',
  'realtime_model_error',
  'interruption_detection_error',
];

/** Agent → app. */
export type ServerMessage =
  /** Render this turn. Sent on every state change, including rescues. */
  | { t: 'prompt'; prompt: SessionPrompt }
  /** One short line after a turn. Never contains a score. */
  | { t: 'feedback'; feedback: TurnFeedback }
  /** The tutor is talking (or has stopped). Drives the mic control's state. */
  | { t: 'speaking'; speaking: boolean }
  /** What the learner actually said, as transcribed. */
  | { t: 'transcript'; text: string; final: boolean }
  /** The lesson is over. Carries the end card. */
  | { t: 'summary'; summary: SessionSummary }
  /** Free conversation: render this turn. The convo analog of `prompt`. */
  | { t: 'convo'; view: ConvoView }
  /**
   * Free conversation opens here: the tutor asks — in English, so a brand-new
   * learner is never opened at in a language they do not have yet — what the
   * learner wants to talk about. No menu: whatever they say (or type) becomes
   * the scene. The French rides along for the screen. The first `convo` view
   * ends the choosing.
   */
  | { t: 'opening'; prompt: { fr: string; en: string } }
  /**
   * Free conversation is over. Carries the recap, plus the updated learner
   * profile as an opaque blob the app persists and returns next session — the
   * agent owns the shape, the app is just the storage.
   */
  | { t: 'recap'; recap: RecapPayload; profile: unknown }
  /**
   * What this session leaves behind in Practice: the topics actually talked
   * about, each carrying the few phrases worth keeping. Curated agent-side
   * (the model proposes, code disposes) and sent exactly once per session,
   * after the recap. The app builds its topic cards and review cards from
   * this; nothing here is rendered live.
   */
  | { t: 'practice'; topics: { titleFr: string; titleEn: string; phrases: ConvoPhrase[] }[] }
  /**
   * Tomorrow's drills are the sentences you spoke today: exercises authored
   * from this session's phrases and errors, already validated agent-side.
   * The app merges them into its bank; nothing here is rendered live.
   */
  | { t: 'drills'; exercises: DrillExercise[] }
  /**
   * The tutor has stopped or steered away, and the learner is owed the reason
   * in words that stay on the screen.
   *
   * Its own tag rather than a shade of `error`, because the app renders
   * severity from the tag and from nothing else. An `error` clears itself after
   * a few seconds, which is right for a TTS outage and wrong for a crisis line.
   * The one message in this product that has to persist cannot arrive on the
   * channel built to disappear.
   *
   * `action` reports what the agent has already done, not what the app should
   * do. `stop` means the session is over; `redirect` means the conversation
   * carries on somewhere safer. `category` is the why, and it is for choosing
   * the copy and the resources that sit beside the message. It is never a label
   * to put in front of the learner.
   *
   * This frame is the only delivery. Sending the words on `error` as well was
   * considered and refused: a current app would draw the decision twice, once
   * as the surface that stays and once as a notice that erases itself, and the
   * erasing one teaches the learner the message was not important. The agent
   * and the app ship from this repo together and nothing is deployed yet, so
   * the skew that argument protects against does not exist. If a floor version
   * ever does, the answer is a floor check, not a second copy.
   */
  | { t: 'safety'; category: SafetyCategory; action: 'stop' | 'redirect'; message: string }
  /**
   * Transient pipeline trouble the learner should know about: a TTS outage, a
   * transcription drop, the sort of thing that usually passes on its own. That
   * is why the app is free to show it as a notice that clears itself.
   *
   * Never a safety decision. Those have to persist and they carry authority
   * this frame does not, so they go on `safety` above.
   *
   * `kind` says what failed and `recoverable` says whether it is expected to
   * pass, so the app can choose its severity and its way forward from the frame
   * instead of reading the sentence and guessing. Both are optional and both
   * stay optional, which is the entire point of adding them this way: an agent
   * that predates them sends a bare `error`, it still decodes, and it still
   * renders exactly as it does today. An error that is not a pipeline failure at
   * all, such as a session reaching its time limit, leaves `kind` off for the
   * same reason and reads the same way.
   *
   * The other direction is handled in `asTheAppReadsIt`, and it is the opposite
   * of the safety rule on purpose: a kind this build has never heard of is
   * dropped from the frame, never with the frame. The learner is owed the notice
   * whatever label it came with, and unlike `safety` there is no authority here
   * for unread input to inherit. Losing the label costs a nicer rendering;
   * losing the frame costs the learner the only sign that anything is wrong.
   */
  | { t: 'error'; message: string; kind?: ErrorKind; recoverable?: boolean };

/** App → agent. */
export type ClientMessage =
  /** The app has mounted and is ready to render. Agent replies with the first prompt. */
  | { t: 'ready' }
  /** "aide-moi" — never counted against the learner. */
  | { t: 'help' }
  /** Move past this turn. */
  | { t: 'skip' }
  /** The learner chose a rung-2 option and said it aloud. */
  | { t: 'choice'; text: string }
  /**
   * Replay a line in the tutor's voice. Not a ladder event, ever: asking to
   * hear something again is support, not an attempt.
   *
   * `line` says which one. `'support'` is the line the learner is being offered
   * to say; `'scene'` is the tutor's own last line, which is how "replay the
   * last tutor line" is served without a second tag competing for the wire.
   *
   * Optional on purpose, and absent means `'support'` — which is what `hear`
   * has always meant. An agent that shipped before this field ignores it and
   * speaks the support line, so a learner asking for the tutor's line back gets
   * a line rather than silence. Degraded, not dead.
   *
   * The other direction is handled in `decodeClientMessage`, which drops a line
   * name this build does not know. The field decides which text goes to the
   * voice, so it is unvalidated input reaching the speaker: clamp it at the
   * boundary, and the request degrades to the plain hear it has always been.
   */
  | { t: 'hear'; line?: 'support' | 'scene' }
  /**
   * "plus lent" — say the line again slowly, and stay slow from here on.
   * Support, never a ladder event: asking to slow down is a healthy act.
   */
  | { t: 'slower' }
  /** "en anglais" — say the current line's English gloss aloud. Not a ladder event. */
  | { t: 'english' }
  /** Text-mode conversation: the learner typed this instead of speaking it. */
  | { t: 'say'; text: string }
  /**
   * The learner is composing. Presence, not content.
   *
   * Silence is how the agent decides someone is stuck, and a learner typing is
   * the one kind of silence that means the opposite. This says "still here" so
   * the stuck clock stands down and nobody is rescued mid-sentence — which
   * would be a remark on their hesitation, and we never make one.
   *
   * Deliberately carries no text. The draft is the learner's until they send
   * it: half a sentence is not something to put on a data channel or into a
   * log, and the agent has no use for it.
   */
  | { t: 'typing' }
  /**
   * "Give me a moment" — the learner has asked for time.
   *
   * Presence, not failure. This is the argument `typing` already settled, in
   * words rather than keystrokes: silence is how the agent decides someone is
   * stuck, and a learner who says "wait" is the one kind of silence that means
   * the opposite. It defers the clock and does nothing else.
   *
   * Never a ladder event, never a rescue count, never a rung. Nothing about the
   * learner's progress may move because they tapped it, and nobody may remark
   * on the pause — on screen or aloud. A learner who asks for time has got
   * nothing wrong, and a spoken acknowledgement of a pause is a remark on it.
   *
   * Payload-free for the same reason `typing` is: the agent's clock only needs
   * to know the learner is there. What they are thinking about is theirs.
   */
  | { t: 'moment' }
  /**
   * Go voiceless, or come back to voice, without leaving the room.
   *
   * Until now the quiet twin cost a whole session. Mode was fixed when the grant
   * was minted, so a learner who boarded a quiet train, or whose transcription
   * vendor dropped out mid-scene, had to end the conversation and start another
   * one to stop speaking. Ending the scene to avoid speaking is a strand with
   * extra steps, and this tag is what removes it. `true` means the learner is
   * typing and listening only; `false` means voice is back.
   *
   * Both agent classes already carry a `voiceless` flag, set once from the
   * session mode, so this flips something that exists rather than introducing a
   * second idea of what mode means. It says nothing about the ladder, nothing
   * about metered minutes and nothing about the scene: the conversation carries
   * on from exactly where it was, which is the difference between switching mode
   * and starting again.
   *
   * Read strictly in `asTheAgentReadsIt`, and that is the part worth arguing
   * over, because strict is not this file's habit. There is no honest default
   * for a `voiceless` that is not a boolean. Reading it as `true` silences a
   * learner who wanted to speak, and reading it as `false` keeps talking at one
   * who asked for quiet, which is as close as this product gets to making
   * somebody speak aloud. So an unreadable frame moves nothing, and the mode the
   * learner already has keeps working in both directions. Nobody is stranded by
   * a dropped frame; they are simply still where they were, and the control can
   * be tapped again.
   */
  | { t: 'mode'; voiceless: boolean }
  /** The learner left. Ends the session so metered seconds are debited promptly. */
  | { t: 'leave' };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeMessage(message: ServerMessage | ClientMessage): Uint8Array {
  return encoder.encode(JSON.stringify(message));
}

/**
 * Decode a message, or return null.
 *
 * Never throws. A malformed frame on the data channel must not take down a live
 * conversation — the learner is mid-sentence, and a dropped frame is recoverable
 * where a crashed session is not.
 *
 * Null on an unknown tag is also how the two halves ship independently. The app
 * on a learner's phone and the agent in the room update on different days, so a
 * new tag always meets an old peer for a while. Adding one is safe because the
 * old side ignores it and behaves exactly as it did before; changing or removing
 * one is not, and needs a plan for the mismatched pair.
 */
export function decodeServerMessage(payload: Uint8Array): ServerMessage | null {
  const message = decodeAs<ServerMessage>(payload, SERVER_TAGS);
  return message === null ? null : asTheAppReadsIt(message);
}

export function decodeClientMessage(payload: Uint8Array): ClientMessage | null {
  const message = decodeAs<ClientMessage>(payload, CLIENT_TAGS);
  return message === null ? null : asTheAgentReadsIt(message);
}

const SERVER_TAGS = new Set(['prompt', 'feedback', 'speaking', 'transcript', 'summary', 'convo', 'opening', 'recap', 'practice', 'drills', 'safety', 'error']);
const CLIENT_TAGS = new Set(['ready', 'help', 'skip', 'choice', 'hear', 'slower', 'english', 'say', 'typing', 'moment', 'mode', 'leave']);
const SAFETY_CATEGORY_TAGS: ReadonlySet<string> = new Set(SAFETY_CATEGORIES);
const ERROR_KIND_TAGS: ReadonlySet<string> = new Set(ERROR_KINDS);

/**
 * Reading a frame is where tolerance lives.
 *
 * "Version or tolerate" has two halves and only one of them is a wire change.
 * The wire half is written into the message types above. This is the other
 * half: what a reader does with a frame from a peer that is a version behind or
 * a version ahead. It runs on receipt, on the reader's own side, which is why
 * it needs no agreement from anybody and costs the sender nothing.
 *
 * Most of the rules here are about a single field rather than a tag, and none
 * of those ever drops a frame. A reader that cannot make sense of one field of
 * a message it otherwise understands still renders the turn, because the
 * learner is mid-scene and stranding them there is the worse failure by a long
 * way.
 *
 * Two rules are the exception and go the other way, dropping the frame rather
 * than repairing it, and both are frames whose unread field would decide
 * something on the learner's behalf. A safety decision this build cannot read is
 * dropped whole; so is a mode switch that does not say which mode. The arguments
 * are on `isReadableSafetyFrame` and on the `mode` tag, and they are the same
 * argument: there is no honest default, so there is nothing to repair towards.
 */
function asTheAppReadsIt(message: ServerMessage): ServerMessage | null {
  // An agent that predates missions sends a view with no `missionDone` key.
  // `ConvoView` calls the field required, and this is what makes that true:
  // anything that is not literally `true` reads as `false`. A session with no
  // mission has no win, so nothing is ever celebrated that was not earned.
  if (message.t === 'convo' && typeof message.view === 'object' && message.view !== null) {
    if (message.view.missionDone !== true) message.view.missionDone = false;
  }

  // A safety decision arrives with authority: it ends a session and puts a
  // notice on the screen that will not clear itself. It is the one frame that
  // has to be read strictly before any of that is allowed to happen.
  if (message.t === 'safety' && !isReadableSafetyFrame(message)) return null;

  // An error keeps its words and loses only what this build cannot read. An
  // agent one version ahead classifies a failure this app has never heard of,
  // and the learner still gets told something went wrong: the label is a
  // rendering hint, so a missing one costs a nicer notice and nothing else.
  // Deleting rather than leaving the unknown value in place matters, because
  // `kind` is typed as a value from a closed set and the app is entitled to
  // switch on it exhaustively.
  if (message.t === 'error') {
    const frame = message as { kind?: unknown; recoverable?: unknown };
    if (frame.kind !== undefined && !(typeof frame.kind === 'string' && ERROR_KIND_TAGS.has(frame.kind))) {
      delete frame.kind;
    }
    if (frame.recoverable !== undefined && typeof frame.recoverable !== 'boolean') {
      delete frame.recoverable;
    }
  }

  return message;
}

/**
 * Is this safety decision one this build can act on?
 *
 * Strict where the rest of this file is forgiving, for the reason
 * `validStartRung()` is strict in the token server: never let unvalidated input
 * inherit your authority. There is no honest default to fall back on either.
 * Reading an unknown action as `redirect` would quietly soften a stop, and
 * reading it as `stop` would end somebody's lesson over a typo.
 *
 * Dropping the frame is safe in a way that dropping a turn would never be,
 * because the frame is not the safety response. By the time it lands the agent
 * has already said the line aloud and already closed the session. What a
 * dropped frame costs is the words staying on the screen, not the decision, so
 * nobody is left in a scene that has a crisis in it.
 *
 * Text mode is the one place that is not true, because nothing is said aloud
 * there. That is the other reason the agent keeps sending the same words on
 * `error` as well until every app in the wild knows this tag.
 */
function isReadableSafetyFrame(frame: Extract<ServerMessage, { t: 'safety' }>): boolean {
  // The types above are a claim about what the agent meant to send, not a fact
  // about the bytes, so every field is read here as if it were unknown.
  const { category, action, message } = frame as { category: unknown; action: unknown; message: unknown };
  if (typeof category !== 'string' || !SAFETY_CATEGORY_TAGS.has(category)) return false;
  if (action !== 'stop' && action !== 'redirect') return false;
  // A notice with nothing written on it is a dead end rather than a warning.
  return typeof message === 'string' && message.trim() !== '';
}

function asTheAgentReadsIt(message: ClientMessage): ClientMessage | null {
  // A replay naming a line this build has never heard of is read as the plain
  // hear it has always been, rather than carried on to the voice. The learner
  // who tapped replay still gets the support line: degraded, never silence,
  // and never a control that does nothing.
  if (message.t === 'hear' && message.line !== undefined && message.line !== 'support' && message.line !== 'scene') {
    delete message.line;
  }

  // A mode switch that does not say which mode is dropped whole, the way a
  // safety decision is on the other side of the wire, and for the same reason:
  // both defaults available here are a decision about the learner's voice that
  // the learner did not make. See the tag for the argument. This is the only
  // client frame read that strictly, because it is the only one where guessing
  // wrong either takes the learner's voice away or keeps talking at them.
  if (message.t === 'mode' && typeof (message as { voiceless: unknown }).voiceless !== 'boolean') return null;

  return message;
}

function decodeAs<T>(payload: Uint8Array, tags: ReadonlySet<string>): T | null {
  try {
    const parsed: unknown = JSON.parse(decoder.decode(payload));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const tag = (parsed as { t?: unknown }).t;
    if (typeof tag !== 'string' || !tags.has(tag)) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

/** Turn a client message into the session input the engine understands. */
export function toLearnerInput(message: ClientMessage): { type: 'help' } | { type: 'skip' } | null {
  if (message.t === 'help') return { type: 'help' };
  if (message.t === 'skip') return { type: 'skip' };
  return null;
}
