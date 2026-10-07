/**
 * What Home's quests card says (F767; README Part 5.F, D22).
 *
 * The rows are the day's three, frozen when they were dealt (`core/quests`),
 * in the order they were dealt, each with its own progress from persisted
 * practice. Under the heading, "{done} of 3 quests done today", and once all
 * three are done the one quiet line "All three quests done today.". There is
 * no chest, no reward row and no countdown (D22).
 *
 * Null when the quests could not be read or have not been dealt for today:
 * the card is then not drawn, rather than drawn empty.
 *
 * Pure, so `questsCardView.test.ts` holds it without a renderer.
 */

import { questDef, questTitle, type DailyGoalMinutes, type QuestFamily } from '@luvani/core';

import type { BulkIconName } from '../icons/names.ts';
import { GAME_COPY } from './copy.ts';
import type { QuestsView } from './view.ts';

export interface QuestRowView {
  id: string;
  title: string;
  done: number;
  target: number;
  complete: boolean;
  /** Progress, 0 to 1. */
  fraction: number;
  /** "1 of 2", or "Done". */
  count: string;
  icon: BulkIconName;
  /** One phrase for a screen reader: the title and where it stands. */
  label: string;
}

export interface QuestsCardView {
  title: string;
  /** Quests done today, 0 to 3. */
  done: number;
  /** "{done} of 3 quests done today", or at three the one quiet line. */
  progress: string;
  /** True once all three are done: the line is then the quiet one. */
  allDone: boolean;
  rows: readonly QuestRowView[];
}

export function questsCardView(
  quests: QuestsView | null,
  options: { tutorName?: string | null; goalTarget?: DailyGoalMinutes | null } = {},
): QuestsCardView | null {
  if (quests === null || quests.ids === null || quests.ids.length === 0) return null;
  const rows: QuestRowView[] = [];
  for (const id of quests.ids) {
    const progress = quests.progress.find((p) => p.id === id);
    if (progress === undefined) continue;
    const title = questTitle(id, { tutorName: options.tutorName ?? null, goalTarget: options.goalTarget ?? null });
    const complete = progress.complete || quests.claimed.includes(id);
    const done = complete ? progress.target : progress.done;
    const count = complete ? GAME_COPY.quests.done : GAME_COPY.quests.count(done, progress.target);
    rows.push({
      id,
      title,
      done,
      target: progress.target,
      complete,
      fraction: progress.target > 0 ? Math.min(1, done / progress.target) : 0,
      count,
      icon: questIconFor(questDef(id).family),
      label: `${title}. ${count}.`,
    });
  }
  const done = Math.max(0, Math.min(3, Math.floor(quests.done)));
  return {
    title: GAME_COPY.quests.title,
    done,
    progress: GAME_COPY.quests.progress(done),
    allDone: done >= 3,
    rows,
  };
}

/** The Bulk icon each family of quest wears on its tile. */
export function questIconFor(family: QuestFamily): BulkIconName {
  switch (family) {
    case 'sittings':
      return 'practice';
    case 'phrase':
      return 'quote';
    case 'deck':
      return 'cards';
    case 'live':
      return 'chat';
    case 'drill':
      return 'practice';
    case 'xp':
      return 'star';
    case 'time':
      return 'clock';
    case 'sound':
      return 'waveform';
  }
}
