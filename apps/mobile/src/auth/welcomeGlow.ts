import { welcomeGlowColour } from '../palette.ts';

/** Figma node 3:54: preserve both shadows and every exported keyframe. */
const rest = `0px 4px 12px 0px ${welcomeGlowColour.rest}, 0px 1px 3px 0px ${welcomeGlowColour.insetRest} inset`;
const peak = `0px 4px 22px 0px ${welcomeGlowColour.peak}, 0px 1px 8px 0px ${welcomeGlowColour.insetPeak} inset`;
const settle = `0px 4px 15px 0px ${welcomeGlowColour.settle}, 0px 1px 4px 0px ${welcomeGlowColour.insetSettle} inset`;
export const welcomeGlow = {
  duration: '3.2s',
  rest,
  keyframes: {
    '0%': { animationTimingFunction: 'ease-in-out', boxShadow: rest },
    '14.063%': { animationTimingFunction: 'ease-in-out', boxShadow: rest },
    '37.5%': { animationTimingFunction: 'ease-in-out', boxShadow: peak },
    '71.875%': { animationTimingFunction: 'ease-in-out', boxShadow: settle },
    '100%': { boxShadow: rest },
  },
} as const;

/** No decorative loop behind another screen, in the background or during auth. */
export function welcomeGlowEnabled(active: boolean, reduced: boolean, focused: boolean, appState: string | null): boolean {
  return active && !reduced && focused && appState === 'active';
}
