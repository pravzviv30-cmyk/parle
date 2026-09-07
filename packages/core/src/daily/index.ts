/**
 * The daily surface: one word and one situation, chosen by the day itself.
 *
 * Content and the rule that picks from it, kept together because they are only
 * meaningful together. Nothing here is stored, and nothing here knows what the
 * learner has done before, which is what makes the two cards on Home honest on
 * a first launch as well as on the four hundredth.
 */

export { DAILY_WORDS, type DailyWord } from './words.ts';
export { wordTierFor, wordsForLevel, scenariosForLevel, type WordTier } from './tier.ts';
export { shuffledOrder, shuffledPick, nextPosition } from './shuffle.ts';
export { DAILY_SCENARIOS, SEED_TOPIC_MAX, seedTopicOf, type DailyScenario } from './scenarios.ts';
export { dailyPick, dayIndex } from './pick.ts';
export { CONNECTOR_IDS, connectorWords } from './connectors.ts';
