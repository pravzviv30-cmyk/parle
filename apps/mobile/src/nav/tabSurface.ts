/**
 * The one quiet ground used to acknowledge the selected destination.
 *
 * Screens and navigation name the job, not a palette colour. Keeping the
 * mapping here preserves the same boundary as missionTint: the primitive owns
 * the colour and the bar only asks for an active-tab surface.
 */
import { accent, tint } from '../palette.ts';

export const ACTIVE_TAB_SURFACE = tint.lilac;
export const ACTIVE_TAB_OUTLINE = accent.primary;
