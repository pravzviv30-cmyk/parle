/**
 * The end card, assembled entirely in code.
 *
 * Everything the recap needs was collected turn by turn in structured form, so
 * no model call happens here: the recap is deterministic, free, instant, and
 * cannot scold. It follows the product's "say one thing, not everything" rule
 * — a single next focus, a handful of fixes, never eleven red bars.
 *
 * Numbers are allowed here and only here; mid-session they read as grades.
 */

import { unassistedRate } from '@luvani/core';

import type { CoachItem, SessionRecap } from '../contract/types.ts';
import type { CefrBand } from '../types.ts';
import type { ConversationState } from './conversation.ts';
import { KIND_PRIORITY } from './grading.ts';

const MAX_FIXES = 6;
const MAX_WINS = 5;
const MAX_PHRASES = 12;

/**
 * Friendly phrasing for the tags the model reports most. Anything unmapped
 * falls back to plain words rather than leaking a kebab tag to a learner.
 */
const FOCUS_BY_TAG: Record<string, string> = {
  'ne-retention': "Drop the ne. Je sais pas, j'ai pas, c'est pas.",
  'tu-vous-mixing': 'Pick tu or vous for each person and stay there.',
  'gender-agreement': 'Le or la. Catch the gender with each new noun.',
  'verb-conjugation': 'One verb at a time: say the je, tu and il forms out loud.',
  anglicism: 'When a phrase feels English-shaped, ask for the French shape.',
  'textbook-phrasing': 'Trade one textbook phrase for its street version each session.',
};

const DEFAULT_FOCUS = "Keep listening for the ne that isn't there.";

function focusFrom(errorTags: Record<string, number>): string {
  const top = Object.entries(errorTags).sort((a, b) => b[1] - a[1])[0];
  if (!top) return DEFAULT_FOCUS;
  const [tag] = top;
  return FOCUS_BY_TAG[tag] ?? `Work on: ${tag.replace(/-/g, ' ')}.`;
}

/**
 * The line at the top of the end card, in three families rather than three
 * lines.
 *
 * This is the last thing a learner reads before they close the app, and it is
 * the one they will see most often, because most sessions land in the same
 * branch. Three sentences, forever, is how an end card stops meaning anything.
 * Rotated on the turn count, never randomly, so the same session always ends
 * the same way and the recap stays testable.
 *
 * First entry of each family is the line this shipped with.
 */
const HEADLINES = {
  carried: ['You carried that scene.', 'You held that whole conversation.', 'That one was yours.'],
  produced: [
    'Real French came out of you today.',
    'Real French, out loud, from you.',
    'You said things today you could not say before.',
  ],
  steady: [
    'Good session. The next one builds on it.',
    'Good work. We pick this up next time.',
    'That is a session. The next one goes further.',
  ],
} as const satisfies Record<string, readonly string[]>;

/**
 * The families, so a test can walk every line of every one. Literal keys, not a
 * Record, so naming a family that does not exist is a compile error.
 */
export const HEADLINE_FAMILIES: { [K in keyof typeof HEADLINES]: readonly string[] } = HEADLINES;

/** Sessions long enough to have been carried rather than merely started. */
const CARRIED_TURNS = 6;
const WINS_FOR_PRODUCED = 3;

function headlineFor(state: ConversationState, wins: string[]): string {
  const family =
    state.ladder.rescues === 0 && state.turnCount >= CARRIED_TURNS
      ? HEADLINES.carried
      : wins.length >= WINS_FOR_PRODUCED
        ? HEADLINES.produced
        : HEADLINES.steady;
  return family[Math.abs(Math.trunc(state.turnCount)) % family.length]!;
}

function dedupeFixes(deferred: readonly CoachItem[]): CoachItem[] {
  const seen = new Set<string>();
  const fixes: CoachItem[] = [];
  for (const item of deferred) {
    const key = `${item.kind}|${item.quote.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fixes.push(item);
  }
  return fixes
    .sort((a, b) => KIND_PRIORITY.indexOf(a.kind) - KIND_PRIORITY.indexOf(b.kind))
    .slice(0, MAX_FIXES);
}

export function assembleRecap(
  state: ConversationState,
  cefr: { estimate: CefrBand; confidence: 'low' | 'medium' | 'high' },
): { recap: SessionRecap; state: ConversationState } {
  const wins: string[] = [];
  const seenWins = new Set<string>();
  for (const w of state.usedWell) {
    const key = w.toLowerCase();
    if (seenWins.has(key)) continue;
    seenWins.add(key);
    wins.push(w);
    if (wins.length >= MAX_WINS) break;
  }

  const recap: SessionRecap = {
    headline: headlineFor(state, wins),
    wins,
    fixes: dedupeFixes(state.deferred),
    phrases: state.phrases.slice(0, MAX_PHRASES),
    nextFocus: focusFrom(state.errorTags),
    topics: state.topics.map((t) => ({ fr: t.fr, en: t.en })),
    cefr,
    stats: {
      turns: state.turnCount,
      rescues: state.ladder.rescues,
      unassistedRate: unassistedRate(state.ladder),
    },
  };

  return { recap, state: { ...state, finished: true } };
}
