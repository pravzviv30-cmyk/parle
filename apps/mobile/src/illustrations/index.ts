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

// Two of the eight that were already drawn. Both of them move.
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
// Revamp A retired nine more, and for the opposite reason to the two above:
// not a screen that left, but a drawing that was replaced. `RecapPostcard`,
// `OnboardCake`, `NothingDue` and the `Phrasebook` room are watercolour PNGs
// now, registered in `art/registry.ts` as `recap-postcard`, `onboard-cake`,
// `empty-table` and `phrasebook` and drawn through `art/Art.tsx`. Their scene
// files went with them, because a vector kept beside the raster that replaced
// it is the next person's coin toss. J14 is what noticed all four.
//
// The five place drawings went the same way and one step later. `HeroCafe`,
// `StreetCorner`, `MarketStall`, `FrontDesk` and `EveningIn` reached a screen
// only through `missions/MissionArt.tsx`, which `missions/MissionDisc.tsx` was
// the only caller of, and which nothing rendered once the chooser and the rows
// took `heroArt` and `PlaceGlyph`. Two levels of indirection is exactly how a
// drawing keeps looking alive to a walk over source while no learner has seen
// it for a pass, so the two components went with the scenes. `SpeakBubbles`
// stays: the tutor intro draws it.
export { SpeakBubbles } from './scenes/bubbles.tsx';
// `OnboardClock` left with the goal sheet it headed, the same way as the two
// above: F368 put the daily goal on the Profile row itself, so nothing draws it.
export { OnboardWave } from './scenes/onboarding.tsx';

// The empty states and the tick.
export { NobodyYet, StillWriting } from './scenes/empty.tsx';
export { RewardMark } from './scenes/reward.tsx';

// The word of the day. Drawn by `progress/WordOfDayCard.tsx`, and nowhere else:
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
