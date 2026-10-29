import { FIRST_MISSION, type MissionId } from '@luvani/core';
import type { GuestPractice } from './guestModel.ts';
import { firstSceneFor } from './plan.ts';
import type { PreAccountOnboardingDraft } from './preAccountDraft.ts';

/** Account setup can precede practice. A Terms declaration is not a completed session. */
export function shouldStartFirstPractice(draft: PreAccountOnboardingDraft, guest: GuestPractice | null): boolean {
  if (guest?.completed === true || guest?.live?.outcome === 'completed' || guest?.finishedAt?.length) return false;
  return draft.accountReturnPage === 'choose-tutor' || draft.page === 'choose-tutor' || finishesGuestScene(draft) || draft.eligibilityConfirmed !== true;
}

/**
 * "Save and finish the scene" (founder decision 16, F925) signs up with
 * 'practice' as the return page: the guest left the café scene early, so the
 * new account opens that scene, not Home and not the plan's first scene.
 */
export function finishesGuestScene(draft: PreAccountOnboardingDraft): boolean {
  return draft.accountReturnPage === 'practice' || draft.page === 'practice';
}

/** The scene the first run opens after the account is made. */
export function firstRunScene(draft: PreAccountOnboardingDraft): MissionId {
  return finishesGuestScene(draft) ? FIRST_MISSION : firstSceneFor(draft.startLevel, draft.reason, draft.skipAhead === true);
}
