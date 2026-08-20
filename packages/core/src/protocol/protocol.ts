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
  /** Something went wrong that the learner needs to know about. */
  | { t: 'error'; message: string };

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
  /** Replay the current line in the tutor's voice. Not a ladder event. */
  | { t: 'hear' }
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
  return decodeAs<ServerMessage>(payload, SERVER_TAGS);
}

export function decodeClientMessage(payload: Uint8Array): ClientMessage | null {
  return decodeAs<ClientMessage>(payload, CLIENT_TAGS);
}

const SERVER_TAGS = new Set(['prompt', 'feedback', 'speaking', 'transcript', 'summary', 'convo', 'opening', 'recap', 'practice', 'drills', 'error']);
const CLIENT_TAGS = new Set(['ready', 'help', 'skip', 'choice', 'hear', 'slower', 'english', 'say', 'typing', 'leave']);

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
