/**
 * How a tutor turn is remembered in the transcript.
 *
 * The raw provider blocks are neither portable nor stable, so history stores a
 * compact deterministic rendering instead: the same bytes whichever adapter
 * produced the turn, which keeps multi-turn prompt caching honest and lets a
 * session swap providers without rewriting its past.
 */

import type { TutorTurn } from '../contract/types.ts';

export function historyViewOfTurn(turn: TutorTurn): string {
  const lines: string[] = [];

  if (turn.narration) lines.push(`(narration) ${turn.narration.en}`);
  if (turn.coachLine) lines.push(`(coach) ${turn.coachLine}`);
  lines.push(`${turn.sceneReply.speaker}: ${turn.sceneReply.fr}`);

  for (const c of turn.coach) {
    lines.push(`(noted ${c.kind}: "${c.quote}" -> "${c.better}")`);
  }
  for (const p of turn.newPhrases) {
    lines.push(`(taught: ${p.fr} = ${p.en})`);
  }

  const flags = [turn.scene.beatDone ? 'done' : '', turn.scene.sceneDone ? 'scene done' : '']
    .filter(Boolean)
    .join(', ');
  lines.push(`(beat: ${turn.scene.beat}${flags ? `, ${flags}` : ''})`);

  return lines.join('\n');
}
