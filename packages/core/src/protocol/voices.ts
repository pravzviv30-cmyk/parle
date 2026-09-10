/**
 * The tutor's voice, and the person that voice belongs to.
 *
 * A learner picks who teaches them. Six voices, each one a real French speaker,
 * each verified by the vendor to read French AND English-with-a-French-accent on
 * the model the agent pins, so the tutor can gloss a word without changing who
 * is talking. That last part is not a formality: it was once true of none of
 * them, and the tutor said its English half in an American accent for weeks
 * (F508). Six that hold the promise beat eight that do not.
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
 *   3. The persona must follow the voice. Half of them are women. A single
 *      hardcoded "he" persona means Marie opens her first sentence introducing
 *      herself as a man, and no amount of prompt wording fixes a mismatch the
 *      code created. The pronoun travels with the sound, in the same row, so
 *      they cannot drift apart. It is also why a key never changes gender: the
 *      name is the persona, so a woman's voice under a man's name is the same
 *      mismatch wearing a different hat. Keys retire; they do not transition.
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

/** The six voices. A closed union, so a typo is a compile error. */
export type TutorVoiceKey =
  | 'alexandre'
  | 'emilie'
  | 'guillaume'
  | 'marie'
  | 'anatole'
  | 'sarah';

/**
 * Who the tutor is, as far as a prompt is concerned. Deliberately two fields
 * and no more: a name to introduce and a pronoun to agree with. Everything else
 * about the tutor's character is one shared persona and stays that way, because
 * six characters is six sets of pedagogy to keep in step.
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
  alexandre: {
    key: 'alexandre',
    persona: { name: 'Alexandre', pronoun: 'he' },
    sound: "A man's voice, from France.",
    gender: 'male',
    ageBand: 'middle-aged',
  },
  emilie: {
    key: 'emilie',
    persona: { name: 'Émilie', pronoun: 'she' },
    sound: "A woman's voice, from Paris.",
    gender: 'female',
    ageBand: 'middle-aged',
  },
  guillaume: {
    key: 'guillaume',
    persona: { name: 'Guillaume', pronoun: 'he' },
    sound: "A man's voice, from France.",
    gender: 'male',
    ageBand: 'middle-aged',
  },
  marie: {
    key: 'marie',
    persona: { name: 'Marie', pronoun: 'she' },
    sound: "A woman's voice, from France.",
    gender: 'female',
    ageBand: 'middle-aged',
  },
  anatole: {
    key: 'anatole',
    persona: { name: 'Anatole', pronoun: 'he' },
    sound: "A young man's voice, from France.",
    gender: 'male',
    ageBand: 'young',
  },
  // The key is ASCII and the name is not, the same way it was for Benoît before
  // her. A learner reads "Sarah"; every path that stores or signs a choice
  // carries the key.
  sarah: {
    key: 'sarah',
    persona: { name: 'Sarah', pronoun: 'she' },
    sound: "A young woman's voice, from France.",
    gender: 'female',
    ageBand: 'young',
  },
});

/**
 * Who a learner gets before they have chosen, and who they keep if they never
 * do. Every line of first-run copy that names the tutor derives from this entry
 * rather than spelling a name out, so moving the default moves the copy with it.
 *
 * It moved once, from Luc, and the reason is worth keeping: no voice the vendor
 * verifies for French-accented English sounded anything like the recording Luc
 * had, so keeping the name would have introduced the tutor as a man who no
 * longer sounds like himself. A name is cheaper to change than a promise.
 */
export const DEFAULT_TUTOR_VOICE: TutorVoiceKey = 'alexandre';

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

/**
 * How a voice introduces itself, in the clip a learner plays before choosing.
 *
 * TWO SENTENCES: the French introduction, then the same introduction in English.
 * A learner choosing a voice is choosing both languages, because the tutor
 * speaks French in the scene and English when it explains, and the shortest
 * honest demonstration is one of each.
 *
 * It was one sentence for a day, joined by "and in English", on the theory that
 * a single request carrying both languages would let the French half prime the
 * accent of the English half. The clips were made and played, and it did not:
 * the accent follows the RECORDING, not the request, and the recordings were
 * not verified for French-accented English at all (F508, then F502). So the
 * mechanism bought nothing, and it cost something real, because "and in English,
 * my name is Luc" is a person saying their own name twice as though the second
 * one were a translation. Names do not translate. It reads as a joke.
 *
 * The count is still worth pinning, at two. Not for the accent any more, but
 * because two is what the provenance manifest records, what the beat is inserted
 * between, and what a live session would send for the same text. One means the
 * bridge crept back; three means a stray period ships inside every download.
 *
 * IT LIVES HERE because the screen that shows these words and the script that
 * speaks them are different processes, and this is the only module both import.
 * It was written out by hand in both, drifted, and shipped a caption that
 * disagreed with the audio for a week. Composing it from `persona.name` is also
 * what stops a clip introducing itself as somebody else: half of them are women,
 * and a line saying "Guillaume" in Marie's voice is the mismatch the catalogue
 * exists to prevent.
 *
 * The copy rules that police it are asserted in the agent's own suite, beside
 * the script that pays to synthesise it, rather than duplicated here.
 */
export function tutorSampleLine(key: TutorVoiceKey): string {
  const { name } = tutorVoice(key).persona;
  return `Bonjour, je m’appelle ${name}. Hi, my name is ${name}.`;
}
