/**
 * The moment a mission is finished, decided outside the screen that draws it.
 *
 * `ConvoView.missionDone` is sticky: once the beats come together it is true on
 * that turn and on every turn after it, because the fact it states does not
 * stop being true. A card driven straight off that flag would therefore appear
 * once and then never leave, which is the opposite of what it is for. The whole
 * job of this file is the difference between "the mission is done" and "the
 * mission just became done", and that difference is a transition, not a value,
 * so it cannot be read off a single render. ConvoScreen has no renderer in this
 * suite (docs/TESTING.md), so a transition rule left inside it is a rule nobody
 * can defend.
 *
 * Three things are true of the card and each of them is enforced here rather
 * than by a comment:
 *
 * - It shows **exactly once**, at the flip. Dismissing it is final for the
 *   session, and a later turn that still carries the flag changes nothing.
 * - It never shows in a session that had no mission. A free conversation has no
 *   goal to have reached, and an agent that predates missions sends `false`
 *   anyway.
 * - The completion record is written at the flip and nowhere else, carrying the
 *   rung the winning view carried. Independence is decided by code from that
 *   rung (`independenceFrom` in core), so a record that guessed it later would
 *   be a fabricated statement about how much help somebody needed.
 *
 * What is deliberately NOT here: banking. `finish()` agent-side is still the
 * only recap point, and "Finish and see your recap" sends the ordinary `leave`.
 * A card that banked its own recap would give a learner two of them.
 */

import { getMission, type MissionId, type Rung } from '@luvani/core';

export interface WinState {
  /**
   * The flip has already happened this session. The card is a moment, and a
   * moment that can recur is a banner.
   */
  seen: boolean;
  /** The card is on screen right now. At most one, and only just after the flip. */
  showing: boolean;
}

/** Where every conversation starts, mission or not. */
export const NO_WIN: WinState = { seen: false, showing: false };

export interface WinStep {
  state: WinState;
  /**
   * Non-null on exactly the turn the win is earned, and null on every other
   * turn of the session. The caller writes it through `missions/store.ts`.
   *
   * Returned rather than written here so this stays a pure function over the
   * turn: the same view twice must produce the same answer, and a module that
   * touched storage could not promise that.
   */
  record: { id: MissionId; rung: Rung } | null;
}

/**
 * Fold one turn's view into the win state.
 *
 * `missionId` is what the session was started for. An id this build does not
 * know behaves exactly like no mission at all, because the card's content is
 * the mission's own `winEn` and there is nothing honest to put on a card for a
 * mission that is not in the catalogue.
 */
export function winAfterTurn(
  state: WinState,
  view: { missionDone: boolean; rung: Rung } | null,
  missionId: string | null | undefined,
): WinStep {
  if (view === null || !view.missionDone) return { state, record: null };
  if (state.seen) return { state, record: null };

  const mission = missionId == null ? undefined : getMission(missionId);
  // No mission, or one this build has never heard of. Marking it seen would be
  // a claim about a session that had nothing to finish, so the state is left
  // exactly as it was.
  if (mission === undefined) return { state, record: null };

  return { state: { seen: true, showing: true }, record: { id: mission.id, rung: view.rung } };
}

/**
 * The learner closed the card, either way.
 *
 * `seen` stays true so a later turn carrying the same sticky flag cannot bring
 * it back. This is the same shape for both doors on purpose: "Keep talking"
 * dismisses, and "Finish and see your recap" dismisses and then leaves, so the
 * card is never on screen over a recap.
 */
export function dismissWin(state: WinState): WinState {
  return { seen: true, showing: false };
}

export interface WinCard {
  /** The mission's own line about what the learner just did. Never praise. */
  line: string;
  keepLabel: string;
  /**
   * Under "Keep talking", and it is the reason the card exists rather than an
   * auto-continue. Minutes are metered, so carrying on is a thing the learner
   * chooses knowing what it costs, never a thing that happens to them.
   */
  keepSub: string;
  finishLabel: string;
}

/**
 * What the card says. Null for a mission this build does not know, which is the
 * same answer `winAfterTurn` gives, so the two cannot disagree.
 *
 * The line is content and comes from core, not from here. It describes what the
 * learner did rather than praising them for it: "you ordered a coffee, start to
 * finish" is a fact they can check, and "Amazing work" is a thing an app says.
 */
export function winCard(missionId: string | null | undefined): WinCard | null {
  const mission = missionId == null ? undefined : getMission(missionId);
  if (mission === undefined) return null;
  return {
    line: mission.winEn,
    keepLabel: 'Keep talking',
    keepSub: 'Carrying on uses your minutes.',
    finishLabel: 'Finish and see your recap',
  };
}
