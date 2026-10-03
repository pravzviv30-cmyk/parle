import { correctionSourceMatches, readCorrectionReason, type CorrectionReasonEvidence } from '@luvani/core';
import type { TurnLine } from './turns.ts';
/** Attach only to the exact issued-session correction, never the latest bubble. */
export function attachCorrectionReason(lines: readonly TurnLine[], raw: CorrectionReasonEvidence, expectedSessionId: string | null): TurnLine[] {
  const evidence = readCorrectionReason(raw);
  if (!evidence || evidence.sessionId !== expectedSessionId) return lines as TurnLine[];
  return lines.map(line => {
    if (line.who !== 'learner' || !correctionSourceMatches(line.fr, evidence.quote, evidence.better)) return line;
    let changed = false;
    const recasts = line.recasts?.map(recast => {
      if (recast.textTurnId !== evidence.textTurnId || recast.correctionIndex !== evidence.correctionIndex
        || recast.quote !== evidence.quote || recast.better !== evidence.better || recast.reason === evidence.reason) return recast;
      changed = true;
      return {...recast, reason: evidence.reason};
    });
    return changed ? {...line,recasts} : line;
  });
}
