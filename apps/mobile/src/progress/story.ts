/**
 * The week, told back.
 *
 * At most three sentences about the last seven local days, built from the
 * sessions the learner already produced. A learner who comes back after a while
 * away wants to know what they did, and the honest answer to that is a short
 * account of what happened. Not a chart, not a rate, and never a comparison.
 *
 * ## No week-over-week delta, at all
 *
 * This is the rule the file is shaped around, so it is first.
 *
 * A delta has a down direction. A down direction is a loss state, and a loss
 * state is the streak PRODUCT.md has now refused twice, wearing a different hat:
 * "you said fewer words than last week" is a scold with arithmetic in front of
 * it. The learner who most needs this surface is the one whose last fortnight
 * went badly, and they are exactly who a delta punishes.
 *
 * So the rule is not "we chose not to compare". `storyFrom` narrows to the seven
 * days it is allowed to talk about and hands *only those* to the sentence
 * builder, which is a private function that never sees the rest of the history.
 * Anyone who wanted a comparison would have to change the shape of this file to
 * get one, and story.test.ts holds that as a property over generated weeks
 * rather than as one example: any prior history at all, of any size, leaves this
 * week's sentences byte for byte identical.
 *
 * `buildProgressReport` in `packages/core/src/progress/history.ts` is the
 * all-time report and it stays all-time. It compares the earliest third of a
 * learner's whole history with the latest third, which is a claim about a person
 * over months. This is a claim about a week, and the two must not be merged.
 *
 * ## Nothing on an empty week
 *
 * A quiet week gets no sentences, and `hasStory` is false, and Profile draws
 * none of it. This is `hasToday`'s rule and `hasStamps`' rule: a surface that can
 * render empty is a quota, and a quota you have not met is guilt with better
 * manners. An empty week is an invitation, and the screen already carries one.
 *
 * The opposite also holds, and matters as much. A week with anything in it gets
 * a sentence, even a thin one where the learner produced no words and leaned on
 * the tutor throughout. Turning up and finding it hard is still a week that
 * happened, and refusing to mention it is its own small judgement.
 *
 * ## Why there are digits here when `today.ts` forbids them
 *
 * `today.ts` bans digits outright, and it is right to. It draws a rail of marks
 * on Home, in the present tense, against a shape of two sittings a day. A number
 * in that position is read as a target whether or not one was meant, and a
 * target you have not hit at eleven at night is the whole mechanic we refuse.
 *
 * This surface is the other case. It is read on demand, on Profile, and it
 * looks backwards at a week that has already finished. A number here cannot be a
 * target because there is nothing left to hit. So a count is evidence: fourteen
 * different French words is a thing the learner made, and rounding it away to
 * "some words" would be throwing away the proof they came for.
 *
 * The licence is narrow and the tests hold it there. A digit may only ever be a
 * count of something the learner produced. Never a percentage, because a
 * percentage of a week is a quota with the denominator hidden. Never a count of
 * days, because "three of seven" names the four that did not happen. Never a
 * weekday name, for the same reason. The only digit this file can print is a
 * count of words.
 *
 * ## Independence leads, and is never a number
 *
 * When most of the week's sessions were mostly unaided, the story opens by
 * saying so in words. `unassistedRate` is the measure underneath, and it stays
 * underneath: printing "82% unassisted" would turn the one thing that means
 * getting better into a score to defend, and next week's lower one into a
 * failure. The sentence says the true thing the rate is for, and the rate itself
 * never reaches the screen.
 *
 * ## What a week is made of (F560)
 *
 * The scripted lesson is the only thing that writes the `history` namespace,
 * so a story read from sessions alone was quiet by construction for a learner
 * who only ever talked to the tutor. The week is now four things the phone
 * already holds, each narrowed to the same seven local days before a sentence
 * is decided: the lesson sessions, the activity log, the conversation packs
 * and the mission completions. A completion names a place, by an authored
 * noun rather than the mission's English title, which contains "day". A pack
 * names a topic, and only when the topic's own words pass every rule the
 * sentences below are held to; a topic this file cannot say is skipped, never
 * trimmed into shape. The activity log adds no sentence of its own: it is what
 * makes a week of drills and review count as a week that happened.
 *
 * ## Where this lives
 *
 * Beside `today.ts` and `passport.ts`, and deliberately not in `packages/core`.
 * Those two established the seam: learner-facing progress copy as a pure,
 * node-testable projection, with a `.tsx` doing nothing but drawing it. The copy
 * rules are the other half of the reason. Every guilt-sensitive sentence in this
 * repo is checked against the one list in `copy/guilt.ts`, and a core test
 * cannot import app code without inverting the workspace dependency direction,
 * so a core version of this file would have to keep a second copy of the ban
 * list. One list is the whole point of that file.
 *
 * Nothing is stored. There is no `WeekStory` on disk and there must not be one,
 * for `sync/policy.ts`'s stated reason: a saved projection of derived values is
 * something two devices can disagree about. This takes what the caller already
 * loaded and returns a value.
 *
 * ## Read, never pushed
 *
 * This module is reached from Profile, by a learner who went looking. It is
 * not on the path of anything that arrives uninvited, and it imports nothing
 * that could put it there. The mirror of that rule is enforced from the other
 * side too, by a source scan that refuses any module in `reminders/` the ability
 * to see whether the learner practised. Both halves say the same thing: a
 * message that changes with your behaviour is a streak with the guilt moved into
 * the delivery layer.
 */

import { MISSIONS, localDayKey } from '@luvani/core';
import type { ConversationPack, MissionPlace, StoredSession } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';

/** Seven local days: this one and the six behind it. Never a rolling 168 hours. */
export const DAYS_IN_THE_STORY = 7;

/**
 * Three, on `buildProgressReport`'s stated reason: a learner who sees a wall of
 * facts reads none of them.
 */
export const MAX_STORY_SENTENCES = 3;

export interface WeekStory {
  /**
   * At most `MAX_STORY_SENTENCES`, in reading order. Empty when the week was
   * quiet, which is the case the screen must draw nothing for.
   */
  sentences: readonly string[];
}

/** Absent. Not "a quiet week": absent. */
const NOTHING: WeekStory = { sentences: [] };

/**
 * Everything the story may read, whole and unnarrowed. Which seven days count
 * is decided here, once, for all four; a caller that narrowed first would be
 * walking past the no-delta guarantee.
 */
export interface StoryInput {
  /** The scripted lesson's sessions, from the history store. */
  sessions: readonly StoredSession[];
  /** Every sitting the activity log holds, of any kind. */
  activity: readonly { at: number }[];
  /** The learner's conversation packs, as the store holds them. */
  packs: readonly ConversationPack[];
  /** Finished missions, as the completions store holds them. */
  completions: readonly { id: string; at: number }[];
  now: number;
}

/** The narrowed week: the same four inputs, inside the seven days. */
interface Week {
  sessions: readonly StoredSession[];
  activity: readonly { at: number }[];
  packs: readonly ConversationPack[];
  completions: readonly { id: string; at: number }[];
}

/** True when My French should draw the story at all. */
export function hasStory(story: WeekStory): boolean {
  return story.sentences.some((line) => line !== IT_HAPPENED);
}

/**
 * A session where the learner composed French for themselves on most turns.
 *
 * Above a half rather than at it, so a session that came out an even split is
 * not counted as independence. The claim in the copy is a strong one and it
 * should be earned twice over: most turns in a session, and most sessions in the
 * week.
 */
const UNAIDED_SESSION = 0.6;

/**
 * The local calendar dates the story is allowed to talk about.
 *
 * Stepped with local date components rather than by subtracting milliseconds, so
 * the week is seven of the learner's own days across a clock change, and a
 * sitting at half past eleven counts for the evening it felt like. This is
 * `localDayKey`'s reason for existing, applied seven times.
 */
function localDaysInTheStory(now: number): ReadonlySet<string> {
  const here = new Date(now);
  const keys = new Set<string>();
  for (let back = 0; back < DAYS_IN_THE_STORY; back += 1) {
    keys.add(localDayKey(new Date(here.getFullYear(), here.getMonth(), here.getDate() - back).getTime()));
  }
  return keys;
}

/** Did the week, taken as a whole, belong to the learner rather than to the tutor. */
function mostlyUnaided(week: readonly StoredSession[]): boolean {
  const unaided = week.filter((stored) => stored.summary.unassistedRate >= UNAIDED_SESSION).length;
  return unaided * 2 > week.length;
}

/** Distinct French words the learner actually produced across the week. */
function wordsProduced(week: readonly StoredSession[]): number {
  const words = new Set<string>();
  for (const stored of week) for (const word of stored.summary.wordsProduced) words.add(word);
  return words.size;
}

/**
 * The sound that came out well most often this week, or null.
 *
 * Most often rather than best once, because the story is about a week and one
 * lucky vowel on a Tuesday is not a week. Ties fall to the higher score and then
 * to the symbol itself, so the same week always tells the same story.
 *
 * `wins` is core's own judgement of what scored well enough to be worth saying
 * out loud. Nothing is re-decided here.
 */
function soundThatLanded(week: readonly StoredSession[]): string | null {
  const tally = new Map<string, { times: number; best: number }>();
  for (const stored of week) {
    for (const stat of stored.summary.pronunciation.wins) {
      const seen = tally.get(stat.ipa) ?? { times: 0, best: 0 };
      tally.set(stat.ipa, { times: seen.times + 1, best: Math.max(seen.best, stat.meanScore) });
    }
  }
  const ranked = [...tally.entries()].sort(
    (a, b) => b[1].times - a[1].times || b[1].best - a[1].best || (a[0] < b[0] ? -1 : 1),
  );
  return ranked.length === 0 ? null : ranked[0]![0];
}

/**
 * Where a mission happens, as a noun a sentence can hold.
 *
 * Authored here rather than read from the mission, because `titleEn` is an
 * instruction ("Talk about your day") and one of them carries the word this
 * file may never print. A `Record` over the union, so a seventh place fails the
 * typecheck instead of landing in a sentence unnamed.
 */
const PLACE_NOUNS: Record<MissionPlace, string> = {
  cafe: 'the café',
  hotel: 'the hotel',
  market: 'the market',
  street: 'the street',
  home: 'a chat at home',
  friends: 'an evening with friends',
};

/** How many places one sentence names before it stops being a sentence. */
const MAX_PLACES = 3;

/**
 * The places entered this week, each once, in the order they were first
 * entered. A completion whose mission the catalogue no longer carries names
 * nothing.
 */
function placesEntered(week: readonly { id: string; at: number }[]): string[] {
  const seen = new Set<MissionPlace>();
  const nouns: string[] = [];
  for (const done of [...week].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const place = MISSIONS.find((mission) => mission.id === done.id)?.place;
    if (place === undefined || seen.has(place)) continue;
    seen.add(place);
    nouns.push(PLACE_NOUNS[place]);
  }
  return nouns.slice(0, MAX_PLACES);
}

/** "the café", "the café and the hotel", "the café, the hotel and the market". */
function listed(nouns: readonly string[]): string {
  if (nouns.length <= 1) return nouns[0] ?? '';
  return `${nouns.slice(0, -1).join(', ')} and ${nouns[nouns.length - 1]}`;
}

/** Longer than this is a paragraph the model wrote, not a topic. */
const MAX_TOPIC_CHARS = 48;

/**
 * A topic this file can say, or null.
 *
 * The topic is the model's own text riding into a sentence the learner reads,
 * so it is held to every rule the authored sentences are held to and one more:
 * letters, spaces and the marks a phrase can carry, nothing that would end the
 * sentence early or put a number in it. It is never trimmed, capitalised or
 * repaired into shape; a topic that fails is skipped whole and the next one is
 * tried, because a sentence built from a repaired phrase is a sentence nobody
 * wrote.
 */
function sayableTopic(en: string): string | null {
  const text = en.trim();
  if (text.length === 0 || text.length > MAX_TOPIC_CHARS) return null;
  if (!/^[a-zà-ÿ][a-zà-ÿ'’ ,-]*$/i.test(text)) return null;
  const lower = text.toLowerCase();
  if (lower.includes('day') || lower.includes('week')) return null;
  if (guiltIn(text) !== undefined) return null;
  // A sentence-case phrase sits mid-sentence with its opening letter lowered.
  // A name keeps its capital, and a name is the best this file can tell: one
  // capitalised word alone, a second capital after the first, or an acronym.
  // "Weather" mid-sentence is a small oddity; "paris" is wrong.
  const properNoun = !text.includes(' ') ? /^[A-ZÀ-Ý]/.test(text) : /^[A-ZÀ-Ý]\S*\s+[A-ZÀ-Ý]/.test(text) || /^[A-ZÀ-Ý]{2}/.test(text);
  return properNoun ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

/** The first topic the newest pack of the week can say, or null. */
function topicTalkedAbout(week: readonly ConversationPack[]): string | null {
  const newest = [...week].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  for (const pack of newest) {
    for (const topic of pack.topics) {
      const said = sayableTopic(topic.en);
      if (said !== null) return said;
    }
  }
  return null;
}

/**
 * The lead, when the week earned it. Said in words, and that is not a stylistic
 * preference: see the header on why `unassistedRate` stays underneath.
 */
const INDEPENDENCE = 'This week you mostly found the words on your own.';

/**
 * The floor. A week that produced no words, no sound worth naming and no
 * independence still happened, and this is what it gets. It thanks nobody and
 * asks for nothing.
 */
const IT_HAPPENED = 'You spent time with French this week.';

/**
 * The sentences, from the week and from nothing else.
 *
 * Private, and taking only the narrowed week, which is the structural half of
 * the no-delta rule. There is no argument here that could carry a prior week in.
 */
function storyOf(week: Week): WeekStory {
  const happened =
    week.sessions.length > 0 || week.activity.length > 0 || week.packs.length > 0 || week.completions.length > 0;
  if (!happened) return NOTHING;

  const sentences: string[] = [];

  if (week.sessions.length > 0 && mostlyUnaided(week.sessions)) sentences.push(INDEPENDENCE);

  const places = placesEntered(week.completions);
  if (places.length > 0) sentences.push(`Scenes you practised this week: ${listed(places)}.`);

  const topic = topicTalkedAbout(week.packs);
  if (topic !== null) sentences.push(`You talked about ${topic} this week.`);

  const words = wordsProduced(week.sessions);
  // "1 different French words" is the kind of sentence that tells a learner
  // nobody read this screen before shipping it.
  if (words === 1) sentences.push('You used 1 French word this week.');
  else if (words > 1) sentences.push(`You used ${words} different French words this week.`);

  const sound = soundThatLanded(week.sessions);
  if (sound !== null) sentences.push(`Your /${sound}/ came out clearly this week.`);

  if (sentences.length === 0) sentences.push(IT_HAPPENED);

  // Three candidates can never exceed three, and the slice is here so that a
  // fourth added later fails the cap test instead of quietly making it four.
  return { sentences: sentences.slice(0, MAX_STORY_SENTENCES) };
}

/**
 * What happened in the learner's last seven days, or nothing.
 *
 * `now` is passed in rather than read, for `todayFrom`'s reason: a rule about
 * dates that cannot be tested across a boundary is a rule nobody can trust.
 *
 * Every input is accepted whole because that is what the caller has, and each
 * is narrowed before a single sentence is decided. Everything older than the
 * week is dropped here and is never seen again. A pack's `createdAt` is an ISO
 * string off the wire; one that does not parse is outside every week.
 */
export function storyFrom(input: StoryInput): WeekStory {
  const days = localDaysInTheStory(input.now);
  const inWeek = (at: number): boolean => Number.isFinite(at) && days.has(localDayKey(at));
  return storyOf({
    sessions: input.sessions.filter((stored) => inWeek(stored.endedAt)),
    activity: input.activity.filter((entry) => inWeek(entry.at)),
    packs: input.packs.filter((pack) => inWeek(Date.parse(pack.createdAt))),
    completions: input.completions.filter((done) => inWeek(done.at)),
  });
}
