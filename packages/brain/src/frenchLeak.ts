/**
 * Does a string that is supposed to be English carry French?
 *
 * Two places need this answer and they used to be one place: the scenario eval
 * checked it offline, where nobody is waiting, and nothing checked it at
 * runtime, where a learner is. The opening narration is spoken aloud as the
 * English setup for a scene, so a model that writes it in French means the
 * first thing a beginner hears is French they were never set up for. That is
 * the founder's "it goes straight into French".
 *
 * Accents are a cheap, deterministic leak detector and a rough one. The rough
 * edge that matters is the loanword: a learner who asks about a café, an
 * apéro or the métro should hear that word back, and repeating their own topic
 * to them is not handing over a French answer. So the allowance is exactly the
 * words the learner supplied, plus the handful English has fully adopted.
 */

const FRENCH_HINT = /[àâçéèêëîïôùûüœ]/i;
const WORD = /[A-Za-zÀ-ÖØ-öø-ÿŒœ]+/g;
const ENGLISH_ACCENTED_WORDS = ['café', 'cafés'];

/**
 * True when `text` uses an accented word the learner did not put there.
 * `allowedFrom` is whatever they wrote or said: their request, a scene title,
 * anything whose words are fair to echo.
 */
export function carriesFrench(text: string, allowedFrom = ''): boolean {
  const allowed = new Set([
    ...ENGLISH_ACCENTED_WORDS,
    ...(allowedFrom.match(WORD) ?? []).map((word) => word.toLowerCase()),
  ]);
  return (text.match(WORD) ?? []).some((word) => FRENCH_HINT.test(word) && !allowed.has(word.toLowerCase()));
}
