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
