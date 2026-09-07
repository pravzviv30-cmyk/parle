/**
 * The daily situation pool.
 *
 * Home's second card offers one scene to talk through today, and tapping it
 * opens a live session seeded with that scene. So unlike a mission, a scenario
 * here teaches the agent nothing: it rides the existing `seedTopic` pipe, which
 * carries exactly two strings and no structure at all.
 *
 * That pipe is why this file has a character cap in it. The token server drops
 * a seed topic longer than `MAX_SEED_TOPIC_CHARS` rather than truncating it,
 * and a dropped seed is a tutor that opens on nothing in particular while the
 * card on screen promises a café. `SEED_TOPIC_MAX` mirrors that number and the
 * test refuses any entry that would not survive the trip.
 *
 * A scenario is a situation, not a lesson. It names where the learner is, what
 * they are trying to get done, and the first thing they could say. Everything
 * after that first line is a real conversation, which is the point: the
 * missions are the scaffolded version and they are pinned to the agent's
 * frames, so a scenario is deliberately the loose one.
 *
 * Same content rules as `words.ts`: permanent ids, no digits, no em dash, no
 * filler, and English a learner reads rather than decodes. `place` is a
 * `MissionPlace` because the disc art is already drawn per place, and inventing
 * a second vocabulary of places would mean a second set of illustrations.
 */

import type { MissionPlace } from '../missions/missions.ts';
import { SCENES_ADMIN_AND_PAPERWORK } from './scenes/adminAndPaperwork.ts';
import { SCENES_CAFE_AND_FOOD } from './scenes/cafeAndFood.ts';
import { SCENES_CULTURE_AND_DAYS_OFF } from './scenes/cultureAndDaysOff.ts';
import { SCENES_FRIENDS_AND_SMALL_TALK } from './scenes/friendsAndSmallTalk.ts';
import { SCENES_GOING_OUT } from './scenes/goingOut.ts';
import { SCENES_HEALTH_AND_PHARMACY } from './scenes/healthAndPharmacy.ts';
import { SCENES_HOME_AND_NEIGHBOURS } from './scenes/homeAndNeighbours.ts';
import { SCENES_SHOPS_AND_MARKETS } from './scenes/shopsAndMarkets.ts';
import { SCENES_TRANSPORT } from './scenes/transport.ts';
import { SCENES_WORK_AND_STUDY } from './scenes/workAndStudy.ts';

export interface DailyScenario {
  /** Stable id, e.g. 'situation:cafe-terrace'. Never reused, never renumbered. */
  id: string;
  /** The card's headline, in English. */
  titleEn: string;
  /** The French name of the scene, and the `fr` half of the seed topic. */
  titleFr: string;
  /** Two short sentences: what the learner is doing, and why. The `en` half. */
  bodyEn: string;
  /** The first line the learner could say, in French. */
  openingFr: string;
  /** That line in English. */
  openingEn: string;
  /**
   * Three beats of the learner's own side of the scene: how you open it, how
   * you handle the middle of it, how you close it.
   *
   * Practice's suggestion card draws all three as chips, which is what the
   * founder's mockup asks for and what `openingFr` alone could not give it.
   * They are always the LEARNER's lines and never the other person's, so a
   * learner reading the card is reading things they could say rather than
   * things they will have to understand.
   */
  lines: readonly ScenarioLine[];
  /** Which place this happens in. Picks the disc art. */
  place: MissionPlace;
  /**
   * What kind of life this scene belongs to.
   *
   * Ten of them, and they are not `place`: `place` picks which of six drawings
   * sits behind the card, and a pharmacy and a post office share one. The theme
   * is what the scene is about, and it exists so the pool can be authored and
   * checked for an even spread rather than quietly becoming four hundred
   * restaurants. Nothing on screen reads it yet.
   */
  theme: ScenarioTheme;
  /**
   * Who this is pitched at, one, two or three.
   *
   * The same three tiers `tier.ts` already pitches the word of the day with,
   * and read through the same function, so the app cannot grow a second opinion
   * about how far a learner has come. A tier is a pitch and not an assessment:
   * being shown a tier three scene is not a claim that somebody has mastered
   * tier one.
   */
  tier: ScenarioTier;
}

/**
 * The ten kinds of everyday life the pool covers.
 *
 * The founder chose this set on 2026-09-06 over a travel-weighted one, for
 * somebody living in France rather than visiting: what they actually do in a
 * week, in roughly the order they meet it.
 */
export type ScenarioTheme =
  | 'cafe-and-food'
  | 'shops-and-markets'
  | 'transport'
  | 'home-and-neighbours'
  | 'friends-and-small-talk'
  | 'work-and-study'
  | 'health-and-pharmacy'
  | 'admin-and-paperwork'
  | 'going-out'
  | 'culture-and-days-off';

/** One, two or three, and the same scale the word pool is pitched on. */
export type ScenarioTier = 1 | 2 | 3;

/** One thing the learner could say, and what it means. */
export interface ScenarioLine {
  fr: string;
  en: string;
}

/**
 * The longest a seed topic string may be.
 *
 * Mirrored by hand from `MAX_SEED_TOPIC_CHARS` in
 * `services/token-server/src/tokens.ts`, because core is platform-free and
 * cannot import a server. If that number ever moves, this one moves with it:
 * the server drops an over-long topic silently, so the failure mode is a card
 * that promises a scene and a tutor that never heard of it.
 */
export const SEED_TOPIC_MAX = 120;

/**
 * Every situation, in one pool.
 *
 * The entries live under `scenes/`, one file per theme. They were in this file
 * until it reached five hundred of them, which is seven thousand lines, and a
 * diff nobody can read is a diff nobody checks. Splitting them changed nothing
 * at runtime: this is still the one array, in a fixed order, and `dailyPick`
 * still walks it by the day.
 *
 * The order is the order below, and it is theme by theme. That matters for
 * exactly one thing and it is worth knowing: `dailyPick` is `dayIndex % length`
 * over this array, so Home walks it in this order, a theme at a time. Practice
 * does not, because `shuffledPick` deals its own order per learner, which is
 * the whole reason that function exists.
 */
export const DAILY_SCENARIOS: readonly DailyScenario[] = [
  ...SCENES_CAFE_AND_FOOD,
  ...SCENES_SHOPS_AND_MARKETS,
  ...SCENES_TRANSPORT,
  ...SCENES_HOME_AND_NEIGHBOURS,
  ...SCENES_FRIENDS_AND_SMALL_TALK,
  ...SCENES_WORK_AND_STUDY,
  ...SCENES_HEALTH_AND_PHARMACY,
  ...SCENES_ADMIN_AND_PAPERWORK,
  ...SCENES_GOING_OUT,
  ...SCENES_CULTURE_AND_DAYS_OFF,
];

/**
 * The two strings the tutor is opened with.
 *
 * The French name of the scene and the English description of what the learner
 * is doing, which is exactly what `seedTopic` carries: no beats, no phrases and
 * no frame. A scenario is a subject to talk about, and the agent decides the
 * conversation the same way it does when a learner picks a topic in Practice.
 */
export function seedTopicOf(s: DailyScenario): { fr: string; en: string } {
  return { fr: s.titleFr, en: s.bodyEn };
}
