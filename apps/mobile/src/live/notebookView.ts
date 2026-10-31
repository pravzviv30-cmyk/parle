/**
 * The notebook sheet's lines (UI-014, direction D), apart from drawing them.
 *
 * One notebook replaces the bubbles and the separate transcript. Only the
 * newest tutor line keeps its English; older tutor lines are French only. The
 * newest tutor line and the newest learner line are drawn large; the rest are
 * older. Narration, including the role line, keeps its words. A topic line
 * sent before the scene opened is not part of the scene and is left out (F905).
 *
 * `newest` mode is the sheet with every line hidden but the two that matter
 * now: the tutor's newest line and the learner's current or last words.
 */
import type { TurnLine } from './turns.ts';

export interface NotebookItem {
  id: string;
  kind: 'narration' | 'tutor' | 'learner';
  fr: string;
  en: string | null;
  emphasis: 'newest' | 'older';
  recasts: NonNullable<TurnLine['recasts']>;
  /** The learner's words still being heard. */
  partial?: true;
}

/** The id of the learner's live partial line. */
export const PARTIAL_ID = 'partial';

export function notebookLines(turns: readonly TurnLine[], partial: string | null | undefined, mode: 'all' | 'newest'): NotebookItem[] {
  const lines = turns.filter((turn) => !turn.topic);
  const heard = partial?.trim() ? partial.trim() : null;
  let newestTutor: string | null = null;
  let newestLearner: string | null = null;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const turn = lines[index]!;
    if (newestTutor === null && turn.who === 'tutor') newestTutor = turn.id;
    if (newestLearner === null && turn.who === 'learner') newestLearner = turn.id;
  }
  // While the learner is speaking, the partial is their newest line.
  if (heard !== null) newestLearner = null;

  const items: NotebookItem[] = lines.map((turn) => {
    if (turn.who === 'narration') {
      return { id: turn.id, kind: 'narration', fr: turn.en ?? turn.fr, en: null, emphasis: 'older', recasts: [] };
    }
    const newest = turn.id === newestTutor || turn.id === newestLearner;
    return {
      id: turn.id,
      kind: turn.who,
      fr: turn.fr,
      en: turn.who === 'tutor' && newest ? turn.en : null,
      emphasis: newest ? 'newest' : 'older',
      recasts: turn.recasts ?? [],
    };
  });
  if (heard !== null) items.push({ id: PARTIAL_ID, kind: 'learner', fr: heard, en: null, emphasis: 'newest', recasts: [], partial: true });

  if (mode === 'all') return items;
  return items.filter((item) => item.kind !== 'narration' && item.emphasis === 'newest');
}
