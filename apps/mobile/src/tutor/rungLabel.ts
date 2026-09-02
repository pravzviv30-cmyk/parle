/**
 * What each rung asks of the learner, in words.
 *
 * A function of the tutor's name rather than a frozen table of four strings,
 * because rung one names whoever is doing the speaking and that is now a fact
 * about the learner's profile. A constant would tell somebody who chose Celine
 * to repeat after Luc, and no amount of prompt wording repairs a name a screen
 * invented. The name comes from `tutorPersonaOf`.
 *
 * The other three deliberately name nobody. A rung says how much help is left,
 * not who is talking, and adding the tutor to the other three would turn a
 * description of the ladder into a description of a person.
 *
 * It lives here rather than beside `rungColor` in theme.ts because theme.ts
 * imports `Platform` and the mobile test runner has no react-native, which is
 * the same reason `palette.ts` exists. `theme.ts` re-exports it, so every
 * screen still reaches the label beside the colour it goes with. A sentence
 * that names the tutor is a decision, and docs/TESTING.md's rule for this
 * workspace is that a decision has to be somewhere a test can import.
 */

/** The four rungs, as the ladder numbers them. */
export type Rung = 1 | 2 | 3 | 4;

export function rungLabel(rung: Rung, tutorName: string): string {
  switch (rung) {
    case 1:
      return `Repeat after ${tutorName}`;
    case 2:
      return 'Choose a reply and say it';
    case 3:
      return 'Say it in your own words';
    default:
      return 'Free conversation';
  }
}
