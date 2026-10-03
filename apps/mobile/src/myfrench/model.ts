/**
 * Everything My French draws, folded once, so the screen decides nothing.
 *
 * `MyFrenchTab.tsx` used to ask its own questions: which situations had been
 * finished, what a sound check meant, whether a stamp was earned. Two of those
 * were already lifted into `progress/` and one was still inline. There is no
 * renderer in this workspace, so a judgement in a `.tsx` is a judgement no test
 * can reach, and the tab's own suite already bans it by name for
 * `independence`, `timesFinished` and `levelFor`.
 *
 * So: the screen loads what it always loaded, hands it here, and renders what
 * comes back. Every projection this composes is owned somewhere else and is
 * imported rather than copied.
 *
 * ## What revamp A took out of this fold, and where it went
 *
 * The tab was two lanes over one body of evidence, and it is now one page of
 * rows. The one line card, the retained rows, the cadence set and the notebook
 * moved to the Phrasebook route; the sound panel moved to the sound check; the
 * evidence rail went entirely, because it was the only place on this page that
 * drew a digit at a learner. What is left is the shape of the founder's mockup:
 * the places their French works, the phrase on the shelf, the scenes they saved
 * and the conversations they can go back to.
 *
 * The suggestion fold is the one addition. `suggestedMission` used to feed a
 * card of its own at the foot of the page with a pill on it; it now decides
 * which row leads "Next places", which is the same fact drawn once instead of
 * twice.
 *
 * Nothing is stored. `sync/policy.ts` states the rule this obeys: nothing is
 * recomputed, no mastery, no interval, no CEFR estimate, no independence rung.
 * A saved model would be a copy of a derived value that two devices could
 * disagree about.
 */

import { phraseKeyOf, type ConversationPack, type DailyScenario, type MissionPlace, type MissionProgress, type ReviewCard } from '@luvani/core';

import { isStamped, stampsFrom, type Stamp } from '../progress/passport.ts';
import { chipFor, type SituationChip } from './situations.ts';
import { situationAction, startLabel, type SituationAction } from '../progress/portfolio.ts';
import { hasSaved } from '../bookmarks/view.ts';
import { ledgerFrom, shelfLine } from './ledger.ts';
import { latestReadyPack } from '../conversationPacks/model.ts';

/** One situation's row, with every word and every colour on it already chosen. */
export interface SituationRow {
  /** The mission id, which is what the row opens and what the split orders by. */
  id: string;
  progress: MissionProgress;
  /** The place, for the row's mark. Lifted out so the screen never reaches through. */
  place: MissionPlace;
  /** The place's own paper, named here so the row never picks a colour (F467). */
  /** The French name of the scene, which is what the row is titled. */
  title: string;
  /** What it is in English, under it. */
  gloss: string;
  /** Whether this row draws a filled chip. Never a comparison the screen makes. */
  earned: boolean;
  /** The state in two or three words, for the chip beside the title. */
  chip: SituationChip;
  action: SituationAction;
  /**
   * What a screen reader hears: what this row will do, then what state it is
   * in. Two Texts and a chip reach assistive technology as three unrelated
   * nodes, so the row names itself once and says both halves.
   */
  accessibilityLabel: string;
}

/** One situation the learner bookmarked, dressed as a row. */
export interface SavedRow {
  /** The scenario itself, because the screen opens it through core's seed topic. */
  scenario: DailyScenario;
  place: MissionPlace;
  accessibilityLabel: string;
}

export interface MyFrench {
  /** Every situation in the catalogue, stamped and not, in catalogue order. */
  situations: readonly SituationRow[];
  /** Core's suggestion, which leads "Next places". Null suggests nothing. */
  suggestedId: string | null;
  /** The one line of French on the shelf, or the sentence that says what it is for. */
  shelf: string;
  saved: readonly SavedRow[];
  /** A shelf that says it is empty says the learner failed to fill it. */
  showSaved: boolean;
  /** True only when a conversation has actually become practice. */
  showConversations: boolean;
}

/**
 * The newest ready conversation's own phrase keys, so the shelf can seat a line
 * said last night above one said in June. Keys, not fronts: the deck's card id
 * is `phraseKeyOf(fr)` (review/store.ts), and the same rule here means a pack
 * phrase and its card meet without a second normaliser.
 */
function recentPhraseKeys(packs: readonly ConversationPack[]): ReadonlySet<string> {
  const pack = latestReadyPack(packs);
  return new Set(pack === null ? [] : pack.keyPhrases.map((phrase) => phraseKeyOf(phrase.fr)));
}

export function myFrenchFrom(input: {
  deck: readonly ReviewCard[];
  missions: readonly MissionProgress[];
  saved: readonly DailyScenario[];
  packs: readonly ConversationPack[];
  suggested: MissionProgress | null;
  now: number;
}): MyFrench {
  // Keyed rather than indexed: `stampsFrom` answers in the order it was given,
  // and a lookup by id stays right the first time somebody filters this list.
  const stamps: readonly Stamp[] = stampsFrom(input.missions);
  const byMission = new Map(stamps.map((stamp) => [stamp.missionId, stamp]));

  const situations: SituationRow[] = input.missions.map((progress) => {
    const stamp = byMission.get(progress.mission.id);
    const chip = chipFor(stamp?.state ?? 'not-yet', progress.state);
    const action = situationAction(progress);
    return {
      id: progress.mission.id,
      progress,
      place: progress.mission.place,
      title: progress.mission.title,
      gloss: progress.mission.titleEn,
      earned: stamp !== undefined && isStamped(stamp),
      chip,
      action,
      accessibilityLabel: `${action.accessibilityLabel}. ${chip.text}.`,
    };
  });

  const saved: SavedRow[] = input.saved.map((scenario) => ({
    scenario,
    place: scenario.place,
    accessibilityLabel: startLabel(scenario.titleEn),
  }));

  return {
    situations,
    suggestedId: input.suggested?.mission.id ?? null,
    shelf: shelfLine({
      ledger: ledgerFrom({ deck: input.deck, now: input.now, recent: recentPhraseKeys(input.packs) }),
      deck: input.deck,
    }),
    saved,
    showSaved: hasSaved(input.saved),
    showConversations: input.packs.length > 0,
  };
}
