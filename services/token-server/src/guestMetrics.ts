export const GUEST_METRICS = [
  'practice_started',
  'useful_reply',
  'feedback_seen',
  'retry',
  'help_used',
  'phrase_kept',
  'save_progress',
  'useful_return',
  'practice_finished',
] as const;
export type GuestMetric = (typeof GUEST_METRICS)[number];
export interface GuestMetricValue {
  name: GuestMetric;
  evidence: 'typed' | 'spoken' | 'none';
}
/** No free text, identifiers, answer values or audio can enter optional evidence. */
export function parseGuestMetric(value: unknown): GuestMetricValue | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).sort().join(',') !== 'evidence,name') return null;
  if (
    !GUEST_METRICS.includes(data.name as GuestMetric) ||
    !['typed', 'spoken', 'none'].includes(String(data.evidence))
  )
    return null;
  return {
    name: data.name as GuestMetric,
    evidence: data.evidence as GuestMetricValue['evidence'],
  };
}
