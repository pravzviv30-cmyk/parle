/**
 * The one place a scene key becomes a drawing.
 *
 * `wordScenes.ts` says which twenty there are and which day each of them is;
 * this file says what each one looks like, and it is the whole of what it
 * does. No width, no pause rule, no reduce-motion branch: the width comes from
 * the card, `paused` comes from the tab through the card, and every scene owns
 * its own resting frame through `useSceneMotion`.
 *
 * ## Why a switch rather than a map
 *
 * A `Record<WordSceneKey, ComponentType>` is shorter and it is the wrong
 * shape here. `surfaceContract.test.ts`'s J14 asks that every name the
 * illustration barrel exports is reached from somewhere, as `<Name` or
 * `Name(`, which is how the app notices a drawing that ships and renders
 * nowhere. A map of bare identifiers matches neither pattern, so all twenty
 * would read as dead code the day they landed. `missions/MissionArt.tsx` is
 * the same shape for the same reason, and this file follows it deliberately
 * rather than inventing a second answer.
 *
 * ## Twenty cases and a default
 *
 * Every key has its own case, so the union and this switch stay in step: add a
 * key to the pool without a drawing for it and the compiler says so here. The
 * `default` underneath is therefore unreachable today, and it is kept anyway
 * because a learner is never stranded: a key arriving from a pool this build
 * does not know about draws the seedling rather than a hole where a picture
 * was. The seedling is the card's oldest drawing and the one every other scene
 * in the pack was drawn to sit beside.
 */

import {
  WordBicycle,
  WordCandle,
  WordCasserole,
  WordCat,
  WordCloud,
  WordCroissant,
  WordFountain,
  WordKettle,
  WordKite,
  WordLantern,
  WordLeaves,
  WordPigeon,
  WordPostbox,
  WordSailboat,
  WordShutters,
  WordSnail,
  WordSnowflake,
  WordSprout,
  WordTeapot,
  WordUmbrella,
} from '../illustrations.tsx';
import type { WordSceneKey } from './wordScenes.ts';

/** Today's drawing for the word card, at the card's width and the tab's pause. */
export function WordScene({
  scene,
  width,
  paused,
}: {
  scene: WordSceneKey;
  width: number;
  paused: boolean;
}) {
  switch (scene) {
    case 'sprout':
      return <WordSprout width={width} paused={paused} />;
    case 'kettle':
      return <WordKettle width={width} paused={paused} />;
    case 'postbox':
      return <WordPostbox width={width} paused={paused} />;
    case 'umbrella':
      return <WordUmbrella width={width} paused={paused} />;
    case 'croissant':
      return <WordCroissant width={width} paused={paused} />;
    case 'bicycle':
      return <WordBicycle width={width} paused={paused} />;
    case 'snail':
      return <WordSnail width={width} paused={paused} />;
    case 'cloud':
      return <WordCloud width={width} paused={paused} />;
    case 'candle':
      return <WordCandle width={width} paused={paused} />;
    case 'fountain':
      return <WordFountain width={width} paused={paused} />;
    case 'kite':
      return <WordKite width={width} paused={paused} />;
    case 'cat':
      return <WordCat width={width} paused={paused} />;
    case 'casserole':
      return <WordCasserole width={width} paused={paused} />;
    case 'pigeon':
      return <WordPigeon width={width} paused={paused} />;
    case 'leaves':
      return <WordLeaves width={width} paused={paused} />;
    case 'teapot':
      return <WordTeapot width={width} paused={paused} />;
    case 'lantern':
      return <WordLantern width={width} paused={paused} />;
    case 'sailboat':
      return <WordSailboat width={width} paused={paused} />;
    case 'snowflake':
      return <WordSnowflake width={width} paused={paused} />;
    case 'shutters':
      return <WordShutters width={width} paused={paused} />;
    default:
      return <WordSprout width={width} paused={paused} />;
  }
}
