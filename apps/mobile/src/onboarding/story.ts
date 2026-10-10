/** Short visual labels; the underlying answer keys and plan rules stay stable. */
import { colour, paper } from '../palette.ts';
import type { PreAccountPage, Reason } from './preAccountDraft.ts';

export const REASON_LABELS: Record<Reason, string> = {
  food: 'Food and drinks', family: 'Friends and family', trip: 'Travel',
  moving: 'Everyday life', work: 'Work', because: 'Just exploring',
};
export function storyGround(page: PreAccountPage, celebrated: boolean) {
  if (page === 'hear-it') return colour.blue;
  if (page === 'reason') return colour.coral;
  if (page === 'start-level' || page === 'remind') return colour.mint;
  if (page === 'confidence') return colour.sun;
  if (page === 'focus' || page === 'choose-tutor') return colour.blue;
  if (page === 'time' || page === 'plan') return colour.sun;
  if (page === 'recap' && celebrated) return colour.coral;
  return paper.ground;
}
export function personalPlanTitle(reason: Reason | null): string {
  if (reason === 'trip') return 'Your trip starts here.';
  if (reason === 'family') return 'Make room for connection.';
  if (reason === 'moving') return 'Feel more at home.';
  if (reason === 'work') return 'Bring French to work.';
  return 'Your French starts here.';
}
