/** Closed authored copy; the model can select an ID, never write this sentence. */
export const CORRECTION_REASONS = {
  gender: 'French forms can change to agree with a noun’s gender.',
  'verb-form': 'The verb form follows the subject, tense or grammatical pattern.',
  register: 'Different French expressions suit different levels of formality.',
  'word-order': 'This French pattern puts the words in a particular order.',
  'missing-word': 'A short word completes the French pattern here.',
} as const;
export type CorrectionReasonId = keyof typeof CORRECTION_REASONS;
export interface CorrectionReasonEvidence {sessionId:string;textTurnId:string;correctionIndex:number;quote:string;better:string;reason:CorrectionReasonId}
export function authoredCorrectionReason(id: unknown): string | null {
  return typeof id === 'string' && Object.hasOwn(CORRECTION_REASONS,id) ? CORRECTION_REASONS[id as CorrectionReasonId] : null;
}
function readable(value: unknown): value is string { return typeof value === 'string' && value.trim().length>0 && value.length<=400 && !/[\u0000-\u001f\u007f-\u009f]/u.test(value); }
export function correctionSourceMatches(said:string,quote:string,better:string): boolean {
  if (!readable(quote)||!readable(better)||quote.normalize('NFC').trim()===better.normalize('NFC').trim()) return false;
  for (let at=said.indexOf(quote);at>=0;at=said.indexOf(quote,at+1)) {
    const before=Array.from(said.slice(0,at)).at(-1)??'';const after=Array.from(said.slice(at+quote.length))[0]??'';
    if (!/[\p{L}\p{N}]/u.test(before)&&!/[\p{L}\p{N}]/u.test(after)) return true;
  }return false;
}
export function readCorrectionReason(value: unknown): CorrectionReasonEvidence | null {
  if (!value||typeof value!=='object'||Array.isArray(value)) return null;
  const row=value as Record<string,unknown>;
  if (typeof row.sessionId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(row.sessionId)
    ||typeof row.textTurnId!=='string'||!/^v[1-9]\d{0,3}$/.test(row.textTurnId)
    ||typeof row.correctionIndex!=='number'||!Number.isSafeInteger(row.correctionIndex)||row.correctionIndex<0||row.correctionIndex>3
    ||!readable(row.quote)||!readable(row.better)||row.quote.normalize('NFC').trim()===row.better.normalize('NFC').trim()||!authoredCorrectionReason(row.reason)) return null;
  return {sessionId:row.sessionId,textTurnId:row.textTurnId,correctionIndex:row.correctionIndex,quote:row.quote,better:row.better,reason:row.reason as CorrectionReasonId};
}
