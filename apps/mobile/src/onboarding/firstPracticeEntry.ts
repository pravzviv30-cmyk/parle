import type { GuestPractice } from './guestModel.ts';
import type { PreAccountOnboardingDraft } from './preAccountDraft.ts';

/** Account setup can precede practice. A Terms declaration is not a completed session. */
export function shouldStartFirstPractice(draft: PreAccountOnboardingDraft, guest: GuestPractice | null): boolean {
  if (guest?.completed === true || guest?.live?.outcome === 'completed' || guest?.finishedAt?.length) return false;
  return draft.accountReturnPage === 'choose-tutor' || draft.page === 'choose-tutor' || draft.eligibilityConfirmed !== true;
}
