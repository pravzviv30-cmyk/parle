import { tutorVoice } from '@luvani/core';
import type { PreAccountOnboardingDraft } from './preAccountDraft.ts';

/**
 * The tutor step with a recommended tutor already selected (F926, LR-27).
 *
 * The draft's voice is shown as chosen from the first frame, so the button is
 * never disabled waiting for a pick: it reads "Continue with <name>", using the
 * persona name the rest of the app uses. A draft from an older build that
 * stored `tutorChosen: false` counts the same way: its voice is preselected,
 * and Continue records it as chosen so the account keeps that voice.
 */
export function tutorStep(draft: Pick<PreAccountOnboardingDraft, 'tutorVoice'>): { chosen: PreAccountOnboardingDraft['tutorVoice']; label: string } {
  return { chosen: draft.tutorVoice, label: `Continue with ${tutorVoice(draft.tutorVoice).persona.name}` };
}
