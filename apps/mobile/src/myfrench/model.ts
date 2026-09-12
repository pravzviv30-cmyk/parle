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
 * Nothing is stored. `sync/policy.ts` states the rule this obeys: nothing is
 * recomputed, no mastery, no interval, no CEFR estimate, no independence rung.
 * A saved model would be a copy of a derived value that two devices could
 * disagree about.
 */

import { phraseKeyOf, type ConversationPack, type DailyScenario, type MissionProgress, type ReviewCard } from '@luvani/core';

import { hasEvidence, type Evidence } from '../progress/evidence.ts';
import { hasStamps, isStamped, stampLabel, stampsFrom, type Stamp } from '../progress/passport.ts';
import { chipFor, ownLine, type SituationChip } from './situations.ts';
import { situationAction, type SituationAction } from '../progress/portfolio.ts';
import { missionStatus } from '../missions/chooserView.ts';
import { missionTint } from '../missions/missionTint.ts';
import type { TintName } from '../palette.ts';
import { hasSaved } from '../bookmarks/view.ts';
import { hasPhrases, type Phrasebook } from '../phrases/phrasebook.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { latestCheck, soundLine } from './sounds.ts';
import { acousticFor, type Acoustic } from './acoustic.ts';
import { cadenceFrom, type Cadence } from './cadence.ts';
import { hasLedger, ledgerFrom, type Ledger } from './ledger.ts';
import { latestReadyPack } from '../conversationPacks/model.ts';
import { oneLineFrom, type OneLine } from './oneLine.ts';

/** The words a learner meets before anything is theirs. */
export const OPENING = {
  title: 'Nothing is yours yet, and that is what this page is for.',
  body: 'Have one conversation. The first line you say without being asked lands here, and this page will hand it back to you to say again.',
  action: 'Talk to your tutor',
} as const;

/** One situation's row, with every word on it already chosen. */
export interface SituationRow {
  progress: MissionProgress;
  /** The place's own paper, named here so the row never picks a colour (F467). */
  tint: TintName;
  /** Whether this row draws a filled mark. Never a comparison the screen makes. */
  earned: boolean;
  /** What the mark claims, for a screen reader. */
  markLabel: string;
  /** What to do with this scene next, as a sentence. */
  status: string;
  /** The same state in two or three words, for the pill beside the title. */
  chip: SituationChip;
  /** The one honest pronunciation line, or null. */
  sound: string | null;
  action: SituationAction;
}

export interface MyFrench {
  oneLine: OneLine | null;
  ledger: Ledger;
  /**
   * The sound the learner's last check named, with its cue and its pair, or
   * null. Null whenever no check has ever named one, which is most learners for
   * most of their first week, and the screen draws nothing rather than a panel
   * of general advice dressed as a measurement.
   */
  acoustic: Acoustic | null;
  /** The authored connectors, the learner's own lifted to the top. */
  cadence: Cadence;
  evidence: Evidence;
  situations: readonly SituationRow[];
  /**
   * The fact beside the situations heading, or null.
   *
   * The mockup put "8 Scenarios Ready" here, and readiness is the one thing
   * this list cannot claim: `suggestedMission` says outright that every
   * situation is open in any order, so nothing is ever waiting to be unlocked
   * and a readiness count would be counting the catalogue. What IS worth saying
   * is the passport's own claim, which the evidence row does not make: that row
   * counts situations finished with any amount of help, and this counts the
   * ones handled with nothing handed over. A count and never a fraction, on
   * `passport.ts`'s rule, and absent until the first one is earned.
   */
  readyLine: string | null;
  /** False draws no marks at all: a rail of empty marks is a quota. */
  showStamps: boolean;
  saved: readonly DailyScenario[];
  next: MissionProgress | null;
  book: Phrasebook;
  packs: readonly ConversationPack[];
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
  checks: readonly SoundCheckEvidence[];
  evidence: Evidence;
  book: Phrasebook;
  saved: readonly DailyScenario[];
  next: MissionProgress | null;
  packs: readonly ConversationPack[];
  now: number;
}): MyFrench {
  // Keyed rather than indexed: `stampsFrom` answers in the order it was given,
  // and a lookup by id stays right the first time somebody filters this list.
  const stamps: readonly Stamp[] = stampsFrom(input.missions);
  const byMission = new Map(stamps.map((stamp) => [stamp.missionId, stamp]));

  const situations: SituationRow[] = input.missions.map((progress) => {
    const stamp = byMission.get(progress.mission.id);
    return {
      progress,
      tint: missionTint(progress.mission.place),
      earned: stamp !== undefined && isStamped(stamp),
      markLabel: stamp === undefined ? '' : stampLabel(stamp),
      status: missionStatus(progress.state, progress.independence),
      chip: chipFor(stamp?.state ?? 'not-yet', progress.state),
      sound: soundLine(latestCheck(progress.mission.id, input.checks)),
      action: situationAction(progress),
    };
  });

  const earned = situations.filter((row) => row.earned).length;

  // The most recent check across every situation, because a sound belongs to
  // the learner rather than to the scene it was noticed in.
  const newest = [...input.checks].sort((a, b) => b.at - a.at)[0] ?? null;

  return {
    oneLine: oneLineFrom({ deck: input.deck, now: input.now }),
    acoustic: acousticFor(newest?.phoneme ?? null),
    cadence: cadenceFrom({ deck: input.deck }),
    readyLine: ownLine(earned),
    ledger: ledgerFrom({ deck: input.deck, now: input.now, recent: recentPhraseKeys(input.packs) }),
    evidence: input.evidence,
    situations,
    showStamps: hasStamps(stamps),
    saved: input.saved,
    next: input.next,
    book: input.book,
    packs: input.packs,
  };
}

/**
 * The Spoken Map lane: where this learner's French works.
 *
 * The week's story is deliberately absent from this question, and from this
 * model entirely. F233 holds `progress/story.ts` to exactly one importer in the
 * whole app, so that nothing scheduled, backgrounded or notified can carry a
 * learner's week anywhere; a second importer here would spend that guarantee to
 * decide something it does not decide. The situations list draws whenever the
 * catalogue has loaded, so the lane has a body with or without a week in it.
 * The screen keeps the story, its gate and its one import.
 */
export function hasMapLane(model: MyFrench): boolean {
  return hasEvidence(model.evidence) || model.situations.length > 0 || hasSaved(model.saved) || model.acoustic !== null;
}

/** The Memory Deck lane: which lines are theirs. */
export function hasDeckLane(model: MyFrench): boolean {
  // The cadence set is authored, so it is always there. It is deliberately NOT
  // counted here: a lane whose only content is a list nobody has earned yet is
  // a lane the learner was sent to for nothing, and the opening card says the
  // truer thing.
  return hasLedger(model.ledger) || hasPhrases(model.book) || model.packs.length > 0;
}

/**
 * Whether this page has anything to say yet.
 *
 * Deliberately NOT named `hasEvidence`: `progress/evidence.ts` already exports
 * that for a narrower question on this same screen, and two near identical
 * predicates deciding two zero states is how one of them quietly stops being
 * consulted. Gated on the model rather than on an array length so the opening
 * card cannot flash while storage is still answering.
 */
export function hasMyFrench(model: MyFrench): boolean {
  return model.oneLine !== null || hasMapLane(model) || hasDeckLane(model);
}
