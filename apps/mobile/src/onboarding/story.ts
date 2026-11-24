/** Short visual labels; the underlying answer keys and plan rules stay stable. */
import type { Reason } from './preAccountDraft.ts';

export const REASON_LABELS: Record<Reason, string> = {
  food: 'Food and drinks', family: 'Friends and family', trip: 'Travel',
  moving: 'Everyday life', work: 'Work', because: 'Just exploring',
};
