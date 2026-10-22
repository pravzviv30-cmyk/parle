/**
 * The turn contract — what one call to the model must give back.
 *
 * This is the seam the whole brain hangs on. The model is asked for a single
 * structured object per learner turn: what it observed, what it would coach,
 * the in-character line that moves the scene, and the support material a
 * struggling learner might need next. Code makes every decision *about* that
 * object (ladder movement, what surfaces now vs at the recap, sanitization);
 * the model only observes and generates language. Keeping that split honest is
 * what makes the pedagogy testable without a network.
 *
 * Structured-outputs constraints shape the style here:
 *   - every field is required; absence is expressed with `.nullable()`, never
 *     `.optional()` — the API wants every property present
 *   - no `.min()`/`.max()`/regex refinements — unsupported server-side, and a
 *     client-side-only check would turn a model slip into a hard parse failure.
 *     Length caps are enforced in code after the parse instead. The single
 *     exception is `ScenarioFrameSchema.beats.min(1)`, which survives the trip
 *     (the SDK forwards `minItems` when it is 0 or 1) and guards a field the
 *     engine dereferences before any code could check it — see the note there
 *   - no recursion, shallow nesting
 *
 * Imported from 'zod/v4' deliberately: the SDK's zodOutputFormat converts via
 * zod v4's own toJSONSchema, which cannot read v3-classic schemas. zod 3.25+
 * ships both APIs; this file must stay on the v4 side.
 */

import { z } from 'zod/v4';

export const RegisterZ = z.enum(['argot', 'familier', 'courant', 'soutenu']);
export const CefrBandZ = z.enum(['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

/**
 * The coaching taxonomy. `textbook-phrasing` is the product: correct French
 * nobody actually says. It is a distinct kind precisely so policy code can
 * guarantee it always surfaces inline, at every strictness.
 */
export const CoachKindZ = z.enum([
  'blocking-error',
  'english-to-french',
  'grammar-slip',
  'textbook-phrasing',
  'register-mismatch',
  'anglicism',
]);

/** A phrase as spoken, with the standard spelling when the spoken form bends it. */
export const PhraseZ = z.object({
  fr: z.string(),
  frWritten: z.string().nullable(),
  en: z.string(),
});

const OptionZ = z.object({ fr: z.string(), en: z.string() });

/**
 * Material for every rung of the ladder, every turn — mirroring how a scripted
 * LessonTurn carries all its scaffolding at once. The ladder can drop between
 * any two turns, and a rescue must render instantly, never wait on a second
 * model call.
 */
export const SupportZ = z.object({
  fullLine: PhraseZ,
  options: z.array(OptionZ),
  hintEn: z.string(),
});

export const CoachItemZ = z.object({
  kind: CoachKindZ,
  /** Verbatim fragment of what the learner said. */
  quote: z.string(),
  /** What a local would actually say, in spoken form. */
  better: z.string(),
  betterWritten: z.string().nullable(),
  betterEn: z.string(),
  /** One short plain sentence. Never scolds, never carries a number. */
  why: z.string(),
  weight: z.enum(['matters-now', 'minor']),
});

export const NewPhraseZ = PhraseZ.extend({
  /** Word-for-word gloss when it differs from the natural `en`. */
  enLiteral: z.string().nullable(),
  register: RegisterZ,
  /** One-line culture or usage note, or null. */
  note: z.string().nullable(),
});

/**
 * Observations about the learner's last turn only. The model never decides
 * consequences — rung movement and feedback timing belong to code.
 */
export const AssessmentZ = z.object({
  understood: z.boolean(),
  taskAchieved: z.boolean(),
  comprehensibility: z.enum(['clear', 'strained', 'breakdown']),
  language: z.enum(['french', 'mixed', 'english', 'none']),
  cefrEvidence: CefrBandZ.nullable(),
});

export const SpeakerLineZ = z.object({
  speaker: z.string(),
  fr: z.string(),
  frWritten: z.string().nullable(),
  en: z.string(),
});

/**
 * Field ORDER is part of this contract. Strict structured output writes the
 * properties in schema order, and the live tutor starts speaking as soon as
 * every field the spoken line depends on has streamed in (see
 * `EarlySpokenTurnSchema` and LIVE_VOICE.md). So everything that decides what
 * is said (the assessment, the coaching that may be recast, the coach line,
 * the narration and the reply itself) comes first, and everything that is only
 * shown or remembered comes after. Moving a field above `sceneReply` delays the
 * tutor's voice by the time it takes to write that field.
 */
export const TurnSchema = z.object({
  assessment: AssessmentZ,
  coach: z.array(CoachItemZ),
  /** One sayable coach sentence when something needs saying now, else null. */
  coachLine: z.string().nullable(),
  /**
   * Narrator scene-setting spoken over the top of the scene, addressed to the
   * learner directly ("The man turns to leave, but stops…"). Null on almost
   * every turn; present only when the scene shifts and the learner needs the
   * new picture before the next line lands. speaker is always "narration".
   */
  narration: SpeakerLineZ.nullable(),
  /** The in-character line that moves the scene. Clean speech, TTS-ready. */
  sceneReply: SpeakerLineZ,
  support: SupportZ,
  newPhrases: z.array(NewPhraseZ),
  profileSignals: z.object({
    /** Recurring-error tags in kebab-case, e.g. "ne-retention". */
    errorPatterns: z.array(z.object({ tag: z.string(), example: z.string() })),
    /** Phrases the learner produced natively and correctly. */
    usedWell: z.array(z.string()),
  }),
  /**
   * Where the learner steered the conversation when they plainly left the
   * current topic — a short noun phrase in both languages — else null.
   * Observation only: code records it and the tutor follows the learner;
   * beats never move because of it.
   */
  topicShift: z.object({ en: z.string(), fr: z.string() }).nullable(),
  scene: z.object({
    /** Id of the beat the conversation is on, from the scenario frame. */
    beat: z.string(),
    beatDone: z.boolean(),
    /** Exact current authored goal met by the last learner reply; uncertain = null. */
    goalMet: z.boolean().nullable(),
    sceneDone: z.boolean(),
  }),
});

/**
 * The leading fields of a turn: everything the spoken line depends on.
 *
 * A streaming provider hands these over the moment `sceneReply` closes, so
 * the tutor can start speaking while the rest of the turn (support, phrases,
 * profile signals, scene progress) is still being written. They are validated
 * here exactly as the full turn is; nothing partial is ever spoken.
 */
export const EarlySpokenTurnSchema = TurnSchema.pick({
  assessment: true,
  coach: true,
  coachLine: true,
  narration: true,
  sceneReply: true,
});

/** Compatibility at adapter parse seams only; never repair an invalid judgment. */
export function withMissingGoalObservation(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const turn = value as Record<string, unknown>;
  if (typeof turn.scene !== 'object' || turn.scene === null || Array.isArray(turn.scene)) return value;
  const scene = turn.scene as Record<string, unknown>;
  return Object.hasOwn(scene, 'goalMet') ? value : { ...turn, scene: { ...scene, goalMet: null } };
}

/**
 * Post-session memory extraction — the one question a good tutor asks
 * themselves after a lesson: what did I learn about this person? What comes
 * back is code-capped and merged into the profile; the model only proposes.
 */
export const MemoryFactZ = z.object({
  kind: z.enum(['interest', 'life-event', 'goal', 'preference']),
  /** The fact in simple French when it translates naturally, else null. */
  fr: z.string().nullable(),
  en: z.string(),
  /** A when, loosely ("Tuesday", "next month"), or null. */
  happensAround: z.string().nullable(),
});

export const MemoryExtractionSchema = z.object({
  facts: z.array(MemoryFactZ),
  /** One short spoken opener for the NEXT session, or null when nothing real surfaced. */
  openerFr: z.string().nullable(),
  openerEn: z.string().nullable(),
});

/**
 * The scenario frame — one call at session start turns a freeform request
 * ("I'm meeting friends at a café in Paris") into a playable scene. Characters
 * carry their own register, because that is where slang depth is decided: the
 * barista gets courant, the old friend gets argot.
 */
export const ScenarioFrameSchema = z.object({
  title: z.string(),
  titleEn: z.string(),
  setting: z.string(),
  learnerRole: z.string(),
  characters: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      register: RegisterZ,
    }),
  ),
  /** One short paragraph: how people actually talk in this scene. */
  registerGuidance: z.string(),
  /**
   * 3–6 ordered goals; the conversation's spine and the unit of "stuck".
   *
   * `.min(1)` is the one refinement in this file, and it earns the exception on
   * both counts the header cares about. It is not client-side-only: the SDK's
   * schema transform passes `minItems` through to the API when the value is 0
   * or 1, so the model is actually held to it (`.min(3)`, matching the 3–6
   * above, would be demoted to a prose hint — which is exactly the trap the
   * header warns about, so it stays a comment).
   *
   * And an empty spine is not a model slip we can absorb after the parse: the
   * engine reads `beats[0]` the moment the scene is created, so zero beats
   * throws between "choosing" and "scene" and strands the learner in a phase
   * where everything they say is dropped. Refusing it here puts the failure
   * inside buildFrame's catch, which opens the request-grounded recovery scene.
   */
  beats: z.array(z.object({ id: z.string(), goal: z.string(), goalEn: z.string() })).min(1),
  /** Lines a local would actually use here, register-labelled. */
  goalPhrases: z.array(PhraseZ.extend({ register: RegisterZ })),
  /**
   * The "imagine the scene…" moment: two or three short sentences that put
   * the learner inside the scene before the first line is spoken to them.
   * en is what is said aloud (the learner must understand the setup); fr is
   * the same picture in simple French, shown for exposure.
   */
  openingNarration: SpeakerLineZ,
  openingLine: SpeakerLineZ,
  /** Support for turn zero, so a session opens with no extra model call. */
  openingSupport: SupportZ,
  cultureNotes: z.array(z.string()),
});
