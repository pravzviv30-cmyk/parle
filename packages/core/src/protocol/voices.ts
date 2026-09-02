/**
 * The tutor's voice, and the person that voice belongs to.
 *
 * A learner picks who teaches them. Eight voices, each one a real French
 * speaker, each verified to read both French and English so the tutor can gloss
 * a word without changing who is talking.
 *
 * Why this is a catalogue in core and not a dropdown in the app:
 *
 *   1. Three processes need it and they ship independently. The app needs the
 *      names and the lines to render a chooser. The token server needs to know
 *      the value is a key so it can shape-check it before its signature goes on
 *      it. The agent needs the key to reach a vendor id. Core is the only
 *      package all three import, and the chosen voice is a wire value, so the
 *      catalogue sits beside the protocol rather than in a fourth place.
 *
 *   2. The keys are OURS, not the vendor's. A voice re-cloned, re-recorded or
 *      moved to a different supplier is one line in the agent's id table, and
 *      every learner's stored preference survives it. Store a vendor id in a
 *      profile and you have promised that supplier forever.
 *
 *   3. The persona must follow the voice. Two of the eight are women. A single
 *      hardcoded "Luc, he" persona means Celine opens her first sentence
 *      introducing herself as a man, and no amount of prompt wording fixes a
 *      mismatch the code created. The pronoun travels with the sound, in the
 *      same row, so they cannot drift apart.
 *
 * On `sound`: it is learner-facing copy and it may state only what has actually
 * been verified about the recording. Gender, where the accent is from, and
 * "young" for the one voice whose age band is known. Not warmth, not timbre,
 * and above all nothing comparative. "The most native sounding" would be a
 * claim about the other seven that is not true, and a learner who picks by
 * adjective and then dislikes the voice has been mis-sold. They pick by name
 * and by listening; the line is orientation, not a review.
 *
 * Three Parisian men therefore read alike here, and that is the honest outcome
 * of the rule rather than an oversight: the sample the chooser plays is what
 * tells them apart, and inventing an adjective to fill the gap is exactly the
 * thing this comment exists to stop.
 *
 * Vendor ids appear NOWHERE in this file. They live in the agent, which is the
 * only process holding the key that bills for them, and `voices.test.ts` reads
 * this source back to prove it. Core reaches the phone in the app bundle.
 */

/** The eight voices. A closed union, so a typo is a compile error. */
export type TutorVoiceKey =
  | 'luc'
  | 'alexandre'
  | 'enrick'
  | 'mathieu'
  | 'guillaume'
  | 'benoit'
  | 'celine'
  | 'emilie';

/**
 * Who the tutor is, as far as a prompt is concerned. Deliberately two fields
 * and no more: a name to introduce and a pronoun to agree with. Everything else
 * about the tutor's character is one shared persona and stays that way, because
 * eight characters is eight sets of pedagogy to keep in step.
 */
export interface TutorPersona {
  /** Introduced in the first line, so it carries its accents. */
  name: string;
  /**
   * The pronoun the prompt agrees with. English, not French, because both
   * prompt pipelines are written in English and this is an instruction to the
   * model rather than anything a learner reads.
   */
  pronoun: 'he' | 'she';
}

/**
 * What the recording is. Structured rather than folded into `sound`, because a
 * chooser wants to group and a test wants to check the pronoun agrees with it,
 * and neither can be done against a sentence.
 */
export type TutorVoiceGender = 'male' | 'female';

/** Only two bands, and only because one voice is audibly younger. */
export type TutorVoiceAgeBand = 'young' | 'middle-aged';

export interface TutorVoice {
  key: TutorVoiceKey;
  persona: TutorPersona;
  /** One short plain sentence a learner reads while choosing. */
  sound: string;
  gender: TutorVoiceGender;
  ageBand: TutorVoiceAgeBand;
}

/**
 * The catalogue.
 *
 * A `Record` rather than an array so the agent's id table can be typed
 * `Record<TutorVoiceKey, string>` and a voice added here without an id becomes
 * a compile error there, rather than a 404 at the vendor mid-session.
 *
 * The order of these entries is the order a chooser shows them in: the default
 * first, then the rest. Nothing depends on it, but a reader will assume it.
 */
export const TUTOR_VOICES: Readonly<Record<TutorVoiceKey, TutorVoice>> = Object.freeze({
  luc: {
    key: 'luc',
    persona: { name: 'Luc', pronoun: 'he' },
    sound: "A man's voice, from Quebec.",
    gender: 'male',
    ageBand: 'middle-aged',
  },
  alexandre: {
    key: 'alexandre',
    persona: { name: 'Alexandre', pronoun: 'he' },
    sound: "A man's voice, from Paris.",
    gender: 'male',
    ageBand: 'middle-aged',
  },
  enrick: {
    key: 'enrick',
    persona: { name: 'Enrick', pronoun: 'he' },
    sound: "A man's voice, from France.",
    gender: 'male',
    ageBand: 'middle-aged',
  },
  mathieu: {
    key: 'mathieu',
    persona: { name: 'Mathieu', pronoun: 'he' },
    sound: "A man's voice, from France.",
    gender: 'male',
    ageBand: 'middle-aged',
  },
  guillaume: {
    key: 'guillaume',
    persona: { name: 'Guillaume', pronoun: 'he' },
    sound: "A man's voice, from Paris.",
    gender: 'male',
    ageBand: 'middle-aged',
  },
  benoit: {
    // The key is ASCII and the name is not. A key travels through a URL, a
    // profile file and a signed token; a name is only ever read.
    key: 'benoit',
    persona: { name: 'Benoît', pronoun: 'he' },
    sound: "A man's voice, from Paris.",
    gender: 'male',
    ageBand: 'middle-aged',
  },
  celine: {
    key: 'celine',
    persona: { name: 'Céline', pronoun: 'she' },
    sound: "A woman's voice, from France.",
    gender: 'female',
    ageBand: 'middle-aged',
  },
  emilie: {
    key: 'emilie',
    persona: { name: 'Émilie', pronoun: 'she' },
    sound: "A young woman's voice, from Paris.",
    gender: 'female',
    ageBand: 'young',
  },
});

/**
 * Who a learner gets before they have chosen, and who they keep if they never
 * do. Luc is the voice the first-run copy already describes, so changing this
 * without changing that copy introduces the tutor by the wrong name.
 */
export const DEFAULT_TUTOR_VOICE: TutorVoiceKey = 'luc';

/**
 * Is this one of ours?
 *
 * `Object.hasOwn` rather than `in` or a truthy lookup, and that is not
 * fastidiousness: `'toString' in TUTOR_VOICES` is true, and a guard written
 * that way would hand `constructor` to the agent as a voice to resolve. Every
 * value crossing this boundary came off a wire or out of a stored profile, so
 * the prototype chain is reachable from outside.
 */
export function isTutorVoiceKey(value: unknown): value is TutorVoiceKey {
  return typeof value === 'string' && Object.hasOwn(TUTOR_VOICES, value);
}

/**
 * The entry for a key. Total by construction, because the parameter is the
 * union, so this never throws and never returns undefined.
 *
 * Anything arriving from outside must pass `isTutorVoiceKey` first, or be
 * resolved to the default by the agent. That resolve deliberately does not live
 * here: core is imported by the app, and the last hop before a billed vendor
 * URL is the only place a fallback can be authoritative.
 */
export function tutorVoice(key: TutorVoiceKey): TutorVoice {
  return TUTOR_VOICES[key];
}
