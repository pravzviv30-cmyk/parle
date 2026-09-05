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

// Six of the eight that were already drawn. Three of the six move.
//
// The missing two left the barrel when Phase 3 collapsed the first run, and
// both for the same reason: the only screen that drew them is gone.
// `LearnStack` was splash page two, and `OnboardSuitcase` was the
// why-are-you-learning-French page, which went because nothing ever read the
// answer. The drawings are still in `scenes/`, just no longer offered here: a
// scene is cheap to keep and expensive to redraw, but the barrel is a promise
// that something renders what it carries, and neither of these had a caller
// left. J14 in surfaceContract.test.ts is what noticed, and it is what will
// notice the next one.
export { HeroCafe } from './scenes/cafe.tsx';
export { SpeakBubbles } from './scenes/bubbles.tsx';
export { RecapPostcard } from './scenes/postcard.tsx';
// `OnboardClock` left with the goal sheet it headed, the same way as the two
// above: F368 put the daily goal on the Profile row itself, so nothing draws it.
export { OnboardWave, OnboardCake } from './scenes/onboarding.tsx';

// The six new ones: three empty states, two moments, two rooms.
export { NothingDue, NobodyYet, StillWriting } from './scenes/empty.tsx';
export { RewardMark } from './scenes/reward.tsx';
export { Phrasebook } from './scenes/rooms.tsx';

// Four places, one per mission that did not already have a drawing. The cafe
// keeps HeroCafe and the evening with friends keeps SpeakBubbles.
export { StreetCorner, MarketStall, FrontDesk, EveningIn } from './scenes/missions.tsx';

// The word of the day. Drawn by `home/WordOfDayCard.tsx`, and nowhere else:
// the seedling is that card's picture, not a general-purpose growth mark.
export { WordSprout } from './scenes/sprout.tsx';
