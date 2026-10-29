import type { PreAccountOnboardingDraft } from './preAccountDraft.ts';

/**
 * The tutor step with a recommended tutor already selected (F926, LR-27).
 *
 * The draft's voice is shown as chosen from the first frame, so the screen's
 * button is never disabled waiting for a pick: it reads "Continue with <name>"
 * from the persona name (`tutorName` in PreAccountOnboarding.tsx). A draft from an older build that
 * stored `tutorChosen: false` counts the same way: its voice is preselected,
 * and Continue records it as chosen so the account keeps that voice.
 */
export function tutorStep(draft: Pick<PreAccountOnboardingDraft, 'tutorVoice'>): { chosen: PreAccountOnboardingDraft['tutorVoice'] } {
  return { chosen: draft.tutorVoice };
}
