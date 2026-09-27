/**
 * My French's recent conversations, and the one sentence of progress above
 * them, derived only from what was recorded.
 *
 * Each saved conversation gets a small phrase preview and the latest
 * meaningful thing that happened to it, chosen from the source-linked practice
 * history and nothing else. "Latest" is by time, not "best ever": an old
 * recall must not keep hiding what the learner did last.
 *
 * The order of meaning is two tiers:
 * 1. Completed practice on this conversation's own targets. The newest such
 *    sitting decides the line:
 *    - Recalled without choices: one of its targets came back unaided. That is
 *      decided upstream, and is already 'practised' after the warm-up.
 *    - Practised these phrases: it was answered, with help or choices.
 *    - Ready to revisit: every target was attempted and none resolved. Said as
 *      a fact about what comes next, never as a failure.
 * 2. Only when there is no completed practice at all: the newest of Warm-up
 *    completed, Tutor revisit started (a room opened, never that it was used
 *    while speaking), and the phone-only legacy marks, kept as activity and
 *    never promoted to an outcome.
 *
 * "Used while speaking" is never produced here, because nothing recorded
 * proves it. Nor is a level, a score, or a claim about a whole conversation.
 *
 * Attribution follows each target's own source, so review that shared a
 * sitting with a conversation does not count as practising it. Events for a
 * conversation no longer in the pack cache are dropped: a deleted
 * conversation is not resurrected by its history.
 *
 * Shapes are `practice/history.ts`'s, imported rather than restated: the synced
 * events, and `legacyMarkItems`' reader-only view of old phone marks, which is
 * never stored or synced and so can never become recall by migration.
 */

import type { ConversationPack } from '@luvani/core';
import { orderedConversationPacks } from '../conversationPacks/model.ts';
import { packTargetsOf, type PracticeHistoryItem, type SessionCompletedEvent } from '../practice/history.ts';
import { SENTENCE_END, asSentences } from '../copy/spoken.ts';

/**
 * What this model reads: the synced practice events, plus the reader-only view
 * of this phone's old pack marks. Both shapes are `history.ts`'s own.
 */
export type HistoryItem = PracticeHistoryItem;

export type ConversationEvidence =
  | 'recalled'
  | 'practised'
  | 'attempted'
  | 'warmup'
  | 'revisit-started'
  | 'legacy-practised'
  | 'legacy-continued';

export const EVIDENCE_LINE: Record<ConversationEvidence, string> = {
  recalled: 'Recalled without choices',
  practised: 'Practised these phrases',
  attempted: 'Ready to revisit',
  warmup: 'Warm-up completed',
  'revisit-started': 'Tutor revisit started',
  'legacy-practised': 'Practised earlier',
  'legacy-continued': 'Revisit opened earlier',
};

/** How many of this conversation's targets a sitting showed each way. */
interface Tally {
  recalled: number;
  practised: number;
}

export interface RecentConversation {
  pack: ConversationPack;
  /** Up to two French lines from the conversation itself. */
  preview: readonly string[];
  /** The latest meaningful recorded outcome, or null when nothing has been done with it yet. */
  evidence: ConversationEvidence | null;
  line: string | null;
  /** When that outcome was recorded, for ordering and nothing else. */
  at: number | null;
  /** For the progress sentence: the latest sitting's own counts, never shown as numbers. */
  tally: Tally | null;
  /**
   * What a screen reader hears for the row: title, French preview, then the
   * outcome, each once (whole-app phase 2). Three lines on glass are three
   * unrelated nodes unless the row names them together.
   */
  accessibilityLabel: string;
}

/**
 * The French preview read aloud. A saved line usually ends with its own full
 * stop or question mark, and a comma after it read as "café., Sur place", so
 * a line that already closes a sentence is followed by a space, not a comma.
 */
function spokenPreview(preview: readonly string[]): string {
  return preview
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .reduce((spoken, line) => (spoken === '' ? line : `${spoken}${SENTENCE_END.test(spoken) ? ' ' : ', '}${line}`), '');
}

/** Title, the preview lines, then the outcome, as sentences, skipping what is absent. */
function rowLabel(title: string, preview: readonly string[], line: string | null): string {
  return asSentences([title, spokenPreview(preview), line]);
}

function practiceEvidence(event: SessionCompletedEvent, packId: string): { evidence: ConversationEvidence; tally: Tally } | null {
  // The shared reader: review targets in the same sitting never count here.
  const own = packTargetsOf(event, packId);
  if (own.length === 0) return null;
  const tally = {
    recalled: own.filter((t) => t.outcome === 'recalled').length,
    practised: own.filter((t) => t.outcome === 'practised').length,
  };
  if (tally.recalled > 0) return { evidence: 'recalled', tally };
  if (tally.practised > 0) return { evidence: 'practised', tally };
  return { evidence: 'attempted', tally };
}

function activityEvidence(event: HistoryItem, packId: string): ConversationEvidence | null {
  switch (event.kind) {
    case 'session-completed':
      return null;
    case 'warmup-completed':
      return event.packId === packId ? 'warmup' : null;
    case 'revisit-started':
      return event.packId === packId ? 'revisit-started' : null;
    case 'legacy-mark':
      if (event.packId !== packId) return null;
      return event.label === 'practised' ? 'legacy-practised' : 'legacy-continued';
  }
}

export const RECENT_LIMIT = 3;
const PREVIEW_LINES = 2;

export function recentConversations(input: {
  packs: readonly ConversationPack[];
  events: readonly HistoryItem[];
  limit?: number;
}): RecentConversation[] {
  const live = orderedConversationPacks(input.packs).filter((pack) => pack.state === 'ready');
  return live.slice(0, input.limit ?? RECENT_LIMIT).map((pack) => {
    let practice: { evidence: ConversationEvidence; tally: Tally; at: number } | null = null;
    let activity: { evidence: ConversationEvidence; at: number } | null = null;
    for (const event of input.events) {
      if (event.kind === 'session-completed') {
        const found = practiceEvidence(event, pack.id);
        if (found !== null && (practice === null || event.at > practice.at)) practice = { ...found, at: event.at };
        continue;
      }
      const found = activityEvidence(event, pack.id);
      if (found !== null && (activity === null || event.at > activity.at)) activity = { evidence: found, at: event.at };
    }
    const chosen = practice ?? activity;
    const preview = pack.keyPhrases.slice(0, PREVIEW_LINES).map((phrase) => phrase.fr);
    const line = chosen === null ? null : EVIDENCE_LINE[chosen.evidence];
    return {
      pack,
      preview,
      evidence: chosen?.evidence ?? null,
      line,
      at: chosen?.at ?? null,
      tally: practice?.tally ?? null,
      accessibilityLabel: rowLabel(pack.title.en, preview, line),
    };
  });
}

/**
 * Every ready conversation, read exactly as the recent rows are, uncapped.
 *
 * The page draws at most `RECENT_LIMIT` rows, but the progress sentence must
 * not be blind to practice on an older conversation (whole-app phase 2 review),
 * so it reads this instead of the drawn rows.
 */
export function allConversations(input: { packs: readonly ConversationPack[]; events: readonly HistoryItem[] }): RecentConversation[] {
  return recentConversations({ ...input, limit: Number.POSITIVE_INFINITY });
}

/**
 * The one progress sentence at the top of My French, or null.
 *
 * Only a completed sitting with a recalled or practised target earns one, and
 * it says only what the newest such sitting showed, about the conversation it
 * came from. Singular when one phrase is behind the claim, never a number.
 * A warm-up, a room opening, an unresolved sitting or a legacy mark earns none.
 */
export function progressStatement(recent: readonly RecentConversation[]): string | null {
  const newest = [...recent]
    .filter((r) => (r.evidence === 'recalled' || r.evidence === 'practised') && r.tally !== null)
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0];
  if (newest === undefined || newest.tally === null) return null;
  const title = newest.pack.title.en;
  if (newest.evidence === 'recalled') {
    return newest.tally.recalled === 1
      ? `You recalled a phrase from ${title} without choices.`
      : `You recalled phrases from ${title} without choices.`;
  }
  return newest.tally.practised === 1 ? `You practised a phrase from ${title}.` : `You practised phrases from ${title}.`;
}
