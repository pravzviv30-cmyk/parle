import type { TurnLine } from '../live/turns.ts';

/** A single backward walk leaves the bounded history and its row identities intact. */
export function transcriptTail(turns: readonly TurnLine[]): { tutor: TurnLine | null; correctionId: string | null } {
  let tutor: TurnLine | null = null;
  let correctionId: string | null = null;
  for (let i=turns.length-1;i>=0;i--) {
    const turn=turns[i]!;
    if (tutor === null && turn.who === 'tutor') tutor=turn;
    if (correctionId === null && turn.recasts?.length) correctionId=turn.id;
    if (tutor !== null && correctionId !== null) break;
  }
  return {tutor,correctionId};
}

export function replyAnnouncement(turn: TurnLine, tutorName: string): string {
  return `${tutorName}: ${turn.fr}${turn.en ? `\n${turn.en}` : ''}`;
}

/** The latest tutor line already announced, and whether its English was in it. */
export interface ReplyAnnounced { id: string; withEn: boolean }

/**
 * What VoiceOver says for the latest tutor line, or null for nothing. A new line
 * is announced at once, French first; an early-spoken line (F988) has no English
 * yet, so when its view later fills the English under the same id, the English
 * alone is said, once.
 */
export function nextReplyAnnouncement(turn: TurnLine | null, tutorName: string, prior: ReplyAnnounced | null): { say: string; announced: ReplyAnnounced } | null {
  if (turn === null) return null;
  const withEn = !!turn.en;
  if (prior?.id !== turn.id) return { say: replyAnnouncement(turn, tutorName), announced: { id: turn.id, withEn } };
  if (prior.withEn || !withEn) return null;
  return { say: turn.en!, announced: { id: turn.id, withEn: true } };
}

/**
 * Whether a bubble is read with a French voice. The spoken coach line (F988,
 * `coach:<id>` from roleLine.ts) is English said aloud; every other line is French.
 */
export function readsAsFrench(turn: TurnLine): boolean {
  return !turn.id.startsWith('coach:');
}
