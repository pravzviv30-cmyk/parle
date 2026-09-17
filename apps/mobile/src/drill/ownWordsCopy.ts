/**
 * Every word the own-words drill says — F581.
 *
 * Here rather than in `DrillScreen.tsx` because a screen holds no copy: a
 * sentence written inside a component is a sentence no sweep can read and no
 * test can hold. These four lines are the whole of what this kind says on its
 * own; the verdict line itself is core's `feedbackMessage`, and the judge's
 * note is the judge's own words, already swept for French leaks and banned
 * words on the server side.
 *
 * The hint is the one that carries the pedagogy. The exercise wants speech, and
 * the phone can only read text, so it asks the learner to say it aloud first
 * and then type what they said. That is honest about the gap rather than
 * pretending a typed line is a spoken one, and it costs nothing when somebody
 * is on a train and cannot speak: "if you can".
 */

/** The caps label above the card. */
export const OWN_WORDS_LABEL = 'In your own words';

/** The caps label above the line that sets the scene. */
export const OWN_WORDS_SITUATION = 'Situation';

/** Under the meaning, above the field. */
export const OWN_WORDS_HINT = 'Say it out loud first if you can, then type what you said.';

/** In the field, before anything is typed. */
export const OWN_WORDS_PROMPT = 'Say it your way, in French';

/** What a screen reader hears on the field. */
export const OWN_WORDS_FIELD_LABEL = 'Your French';

/** What the Check button says it is checking. */
export const OWN_WORDS_CHECK_LABEL = 'Check what you said';

/**
 * The better line, offered after a success and never instead of one.
 *
 * "Another way" rather than "the right way": the learner's sentence already
 * carried the meaning, so this is a second option, not a correction. Marking
 * awkward-but-understood down is how somebody learns to say nothing rather
 * than say it badly.
 */
export const OWN_WORDS_ANOTHER = (line: string): string => `Another way: «${line}»`;

/** The tutor could not read it. Shown with the line, and no grade is written. */
export const JUDGE_UNAVAILABLE = 'Your tutor could not read that just now. Here is one way to say it.';

/** Every fixed line this module can say, for the copy sweeps. */
export const OWN_WORDS_COPY: readonly string[] = [
  OWN_WORDS_LABEL,
  OWN_WORDS_SITUATION,
  OWN_WORDS_HINT,
  OWN_WORDS_PROMPT,
  OWN_WORDS_FIELD_LABEL,
  OWN_WORDS_CHECK_LABEL,
  JUDGE_UNAVAILABLE,
];
