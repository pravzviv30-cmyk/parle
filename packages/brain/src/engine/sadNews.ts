/**
 * Does this line sound like sad news from the learner's own life?
 *
 * Not a safety category, and deliberately nowhere near `safety.ts`. Sad news
 * is not danger and nothing here stops, redirects or logs learner text. It
 * exists for one guard: a turn on which somebody tells the tutor their mother
 * died must never be the turn the session ends. A model that hears "le mois
 * dernier" and decides the scene is over would show a grieving learner a
 * recap card, which is the failure this file is here to make impossible.
 *
 * So the list errs wide. A false positive costs one sentence of turn context
 * (which tells the tutor to carry on if it is a story or the scene) and one
 * deferred recap. A false negative costs what it cost before: the prompt
 * section still covers it, only without the code guard behind it.
 *
 * Idioms of hunger and laughter ("je meurs de faim", "est mort de rire") never
 * match: the list names deaths and illnesses, not the verb on its own.
 */

/** Lowercased, accents and apostrophe styles folded, so "décédé" and "decede" are one word. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ');
}

const SAD_NEWS: readonly RegExp[] = [
  // English
  /\b(died|passed away|passed on|funeral)\b/,
  /\b(has|have|got|with) cancer\b/,
  /\bin (the )?hospital\b/,
  /\bis (very |really |seriously )?(ill|sick)\b/,
  /\b(bad|sad|terrible|awful) news\b/,
  // "Lost" only with someone it can mean losing: "I lost my keys" is not grief.
  /\blost (my|our) (mum|mom|mother|dad|father|parents?|wife|husband|partner|son|daughter|baby|brother|sister|grand\w*|aunt|uncle|cousin|friend|best friend|dog|cat)\b/,
  // French
  /\b(est|sont) (mort|morte|morts|mortes|decede|decedee|decedes|decedees)\b(?! de rire)/,
  /\bdecede(e|s|es)?\b/,
  /\bdeces\b/,
  /\b(enterrement|obseques|funerailles)\b/,
  /\bla mort de\b/,
  /\bj'ai perdu (mon|ma|mes)\b/,
  /\ba (un|le) cancer\b/,
  /\ba l'hopital\b/,
  /\b(est|sont) (tres |gravement )?malades?\b/,
  /\b(mauvaise|triste|terrible) nouvelle\b/,
];

export function sharesSadNews(text: string): boolean {
  const folded = fold(text);
  return SAD_NEWS.some((pattern) => pattern.test(folded));
}
