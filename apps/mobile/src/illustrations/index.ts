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

// The daily pack: nineteen more drawings for that same card, which rotates
// through them a day at a time. `WordSprout` above is the twentieth, so a
// learner sees three weeks of mornings before one comes round again.
//
// They are grouped by subject rather than by what moves, because the card
// picks one for the day and never picks by kind. Every one of them takes the
// same `SceneProps` as the seedling and moves once: swap any for any other and
// the card does not notice.
export {
  WordKettle,
  WordCroissant,
  WordCandle,
  WordCasserole,
  WordTeapot,
} from './scenes/daily/kitchen.tsx';
export {
  WordUmbrella,
  WordCloud,
  WordKite,
  WordLeaves,
  WordSnowflake,
} from './scenes/daily/weather.tsx';
export {
  WordPostbox,
  WordBicycle,
  WordFountain,
  WordPigeon,
  WordLantern,
  WordShutters,
} from './scenes/daily/street.tsx';
export { WordSnail, WordCat, WordSailboat } from './scenes/daily/garden.tsx';
