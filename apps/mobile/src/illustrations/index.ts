/**
 * The illustration module.
 *
 * Everything a screen needs comes through here, so a scene can be split into
 * its own file, gain a moving layer, or be redrawn entirely without any screen
 * knowing. `src/illustrations.tsx` re-exports this file, which is why moving
 * the scenes out cost zero changes at the thirteen call sites.
 */

export type { SceneProps } from './pen.tsx';
export { Frame, Stipple, Moving, Scene } from './pen.tsx';
export { useSceneMotion, arriveStyle } from './useSceneMotion.ts';
export type { SceneMotion, LoopSpec } from './useSceneMotion.ts';
export { unit, place, frameHeight, restFor } from './timing.ts';

// The eight that were already drawn. Four of them now move.
export { HeroCafe } from './scenes/cafe.tsx';
export { SpeakBubbles } from './scenes/bubbles.tsx';
export { LearnStack } from './scenes/stack.tsx';
export { RecapPostcard } from './scenes/postcard.tsx';
export { OnboardWave, OnboardCake, OnboardSuitcase, OnboardClock } from './scenes/onboarding.tsx';

// The six new ones: three empty states, two moments, two rooms.
export { NothingDue, NobodyYet, StillWriting } from './scenes/empty.tsx';
export { RewardMark } from './scenes/reward.tsx';
export { Phrasebook } from './scenes/rooms.tsx';

// Four places, one per mission that did not already have a drawing. The cafe
// keeps HeroCafe and the evening with friends keeps SpeakBubbles.
export { StreetCorner, MarketStall, FrontDesk, EveningIn } from './scenes/missions.tsx';
