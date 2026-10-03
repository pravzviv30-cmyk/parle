/**
 * The card at the top of Practice, and the quiet doors under it, decided whole.
 *
 * The tab draws one prominent action: Resume practice when a sitting is
 * waiting on this phone, Start a short practice when there is playable
 * material, or, for a learner with nothing yet, the guided sound lesson that
 * opens on "Bonjour" (notebook Phase 3, 2026-09-27). Under
 * it, quieter doors: scheduled review when review is due, another saved
 * conversation when there is one, and the tutor revisit when the plan opens it.
 *
 * Every word is `copy.ts`'s and every decision is here, so the tab stays a
 * layout and this stays a test.
 *
 * ## The line on the card is never one the sitting asks for (whole-app phase 2)
 *
 * The card sets a French line large, with its meaning, straight above the
 * button that opens a sitting of English-to-French asks. It used to show the
 * sitting's own first target, so a learner read the answer and was then
 * credited with recalling it cold, which is exactly what `exposed` and
 * `assisted` exist to prevent after the fact.
 *
 * Of the two honest fixes, marking the whole sitting exposed would downgrade
 * every target to practice for a preview the learner may not even have read;
 * choosing a line that is not a target costs nothing and keeps recall honest.
 * So the preview is, in order: another line from the conversation the card
 * names (on topic, not in the sitting), a phrase the learner already holds and
 * is not due (theirs, and not asked for today), then the café lesson's lines.
 * A sitting is capped at six phrases and the lesson has more than six, so a
 * line outside the sitting always exists. A resumed sitting's own phrases are
 * handed in as `resuming`, because the recommendation does not carry them.
 */

import { dueCards, isDue, phraseKeyOf, CAFE_LESSON, type ConversationPack, type ReviewCard } from '@luvani/core';
import { practiceRouteParams, type PracticeRouteParams } from './practiceRoute.ts';
import { PRACTICE_ALTERNATIVES, RECOMMENDED } from './copy.ts';
import { starterFrom } from './starter.ts';
import { SOUND_LEAD } from './soundLead.ts';
import type { Recommendation } from './recommendation.ts';

export interface PracticeCard {
  /** The line the card opens on. */
  phrase: { fr: string; en: string };
  /** The one primary action. */
  action:
    /**
     * The Drill route's own flat params. The targets are not carried: the
     * screen reselects them from the same stores with the same selector, so
     * the address bar never holds an object.
     */
    | { kind: 'practice'; label: string; params: PracticeRouteParams }
    | { kind: 'resume'; label: string }
    /**
     * Day one on Practice (notebook Phase 3, 2026-09-27): the guided
     * pronunciation lesson that opens on "Bonjour". It runs live while a tutor
     * is connected and on this phone when not, so it says `liveMinutes`.
     */
    | { kind: 'lesson'; label: string }
    /**
     * A live conversation for a learner who already has one but nothing to
     * practise from it yet. Opens exactly as `first` does; only the words
     * differ, because this learner is not starting their first.
     */
    | { kind: 'talk'; label: string };
  /** Where the sitting comes from, said with the action. Null says nothing. */
  source: string | null;
  /**
   * The conversation the source line names, so the rows under the card can
   * say theirs only when it is a different one. Null when none is named.
   */
  sourcePackId: string | null;
  /** Always said under a module sitting; never under the lesson or a conversation, which can be live. */
  noMinutes: string | null;
  /** Said under the lesson only: it uses live minutes while the tutor is connected. */
  liveMinutes: string | null;
}

export interface PracticeDoors {
  /** Scheduled review, only when the deck has something due. */
  review: string | null;
  /** Another saved conversation, only when one exists. */
  choose: string | null;
  /** The tutor revisit, only when a conversation exists and the plan opens it. */
  revisit: { label: string; uses: string; packId: string } | null;
}

/**
 * A French line to show above the action that the sitting will not ask for.
 *
 * `avoid` is every phrase key the sitting holds. Candidates are tried in the
 * order the header gives, and the first one outside the sitting wins.
 */
export function previewOutside(input: {
  avoid: ReadonlySet<string>;
  source: ConversationPack | null;
  deck: readonly ReviewCard[];
  now: number;
}): { fr: string; en: string } {
  const { avoid, source, deck, now } = input;
  const outside = (fr: string): boolean => !avoid.has(phraseKeyOf(fr));

  const fromSource = [
    ...(source?.keyPhrases.map((p) => ({ fr: p.fr, en: p.en })) ?? []),
    ...(source?.corrections.map((c) => ({ fr: c.better, en: c.betterEn })) ?? []),
  ].find((p) => outside(p.fr));
  if (fromSource !== undefined) return fromSource;

  const held = deck.find((card) => !isDue(card, now) && !avoid.has(card.id) && outside(card.front));
  if (held !== undefined) return { fr: held.front, en: held.back };

  const starter = starterFrom().phrase;
  if (outside(starter.fr)) return starter;
  const lesson = CAFE_LESSON.turns.find((turn) => outside(turn.target));
  return lesson !== undefined ? { fr: lesson.target, en: lesson.targetEn } : starter;
}

export function practiceCard(input: {
  rec: Recommendation;
  deck: readonly ReviewCard[];
  packs: readonly ConversationPack[];
  now: number;
  /** The phrase keys of the saved sitting a resume would reopen. Empty when none. */
  resuming: readonly string[];
}): PracticeCard {
  const { rec, deck, now } = input;

  if (rec.kind === 'resume') {
    return {
      phrase: previewOutside({ avoid: new Set(input.resuming), source: rec.source, deck, now }),
      action: { kind: 'resume', label: RECOMMENDED.resume },
      source: rec.source !== null ? `${RECOMMENDED.fromConversation} ${rec.source.title.en}` : RECOMMENDED.resumeLine,
      sourcePackId: rec.source?.id ?? null,
      noMinutes: RECOMMENDED.noMinutes,
      liveMinutes: null,
    };
  }

  if (rec.kind === 'start') {
    const avoid = new Set(rec.selection.targets.map((t) => t.phraseKey));
    return {
      phrase: previewOutside({ avoid, source: rec.source, deck, now }),
      action: {
        kind: 'practice',
        label: RECOMMENDED.start,
        params: practiceRouteParams({ origin: 'recommended', packId: null, exposed: false }),
      },
      source: rec.source !== null ? `${RECOMMENDED.fromConversation} ${rec.source.title.en}` : RECOMMENDED.fromReview,
      sourcePackId: rec.source?.id ?? null,
      noMinutes: RECOMMENDED.noMinutes,
      liveMinutes: null,
    };
  }

  // Nothing playable. `recommendation` already knows whether this learner has
  // had a conversation; collapsing both into "first" told a learner whose
  // conversation was still being prepared to start their first one.
  if (rec.fallback === 'talk') {
    const preparing = input.packs.some((pack) => pack.state === 'generating');
    return {
      phrase: starterFrom().phrase,
      action: { kind: 'talk', label: RECOMMENDED.talk },
      source: preparing ? RECOMMENDED.preparing : null,
      sourcePackId: null,
      noMinutes: null,
      liveMinutes: null,
    };
  }

  // Day one opens on the same greeting the sound lesson asks for.
  const greeting = CAFE_LESSON.turns[0]!;
  return {
    phrase: { fr: greeting.target, en: greeting.targetEn },
    action: { kind: 'lesson', label: SOUND_LEAD.lesson },
    source: null,
    sourcePackId: null,
    noMinutes: null,
    liveMinutes: SOUND_LEAD.lessonCost,
  };
}

export function practiceDoors(input: {
  deck: readonly ReviewCard[];
  packs: readonly ConversationPack[];
  now: number;
  /**
   * Whether the plan opens the tutor revisit. Supplied by the caller from the
   * existing plan rule; false hides the door rather than showing it refused.
   */
  revisitAllowed: boolean;
  /** The conversation the revisit door opens, when one is named on the card. */
  revisitPackId: string | null;
}): PracticeDoors {
  const ready = input.packs.filter((p) => p.state === 'ready');
  return {
    review: dueCards(input.deck, input.now).length > 0 ? PRACTICE_ALTERNATIVES.review : null,
    choose: ready.length > 0 ? PRACTICE_ALTERNATIVES.choose : null,
    revisit:
      input.revisitAllowed && input.revisitPackId !== null && ready.some((p) => p.id === input.revisitPackId)
        ? { label: PRACTICE_ALTERNATIVES.revisit, uses: PRACTICE_ALTERNATIVES.revisitUses, packId: input.revisitPackId }
        : null,
  };
}
