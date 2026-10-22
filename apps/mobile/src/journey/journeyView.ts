/**
 * What the direction B Journey tab decides (2026-10-20, B4, artboards B-Journey
 * and the Journey panel of B-Empty-States).
 *
 * `tabs/MyFrenchTab.tsx` is layout; every line, gate, count and door it draws
 * is decided here, from the stores the tab already reads and the game layer.
 * Nothing here is persisted and no new key is read.
 *
 * Honesty rules this file keeps:
 * - Stages are words, never CEFR: Starter, Basics, Everyday, Chatting and
 *   Confident, the founder's names (B4 review, 2026-10-20), as Speak and the
 *   scene preview say them (`scenes/scenePreview.ts` `stageOf`). Only the first two stages are
 *   real (A0 and A1 from `spineFrom`); the other three are future steps that
 *   claim nothing.
 * - Abilities carry no "n of m earned" count (founder rule): the artboard's
 *   "1 of 3 earned" is dropped.
 * - Help is said in words only, the ladder's four (Line given, Choices, Hint,
 *   On your own). No number, percentage or dot ever leaves here for it.
 * - Sound lines are `myfrench/sounds.ts`'s, carry no date, and are drawn only
 *   when a saved check backs them.
 * - Lock badges come only from `access/featureAccess.ts`, passed in so a test
 *   can ask what a locked seam would draw.
 */

import {
  FRENCH_PHONEMES,
  MISSIONS,
  SCENE_SPINE,
  SUBSUMED_BY,
  earnedMissionIds,
  evidenceOf,
  getMission,
  spineFrom,
  type Mission,
  type MissionId,
  type MissionProgress,
  type ReviewCard,
  type Rung,
  type XpLevel,
  type CefrLevel,
} from '@luvani/core';

import { featureAccess, type FeatureAccess, type LockedFeature } from '../access/featureAccess.ts';
import { SO_FAR_WITH_HELP } from '../home/abilities.ts';
import { MY_FRENCH_TITLE } from '../myfrench/copy.ts';
import { COMPLETIONS_PER_MISSION } from '../missions/store.ts';
import { ledgerFrom } from '../myfrench/ledger.ts';
import { isMeasuredCheck, soundLine } from '../myfrench/sounds.ts';
import { isRetained } from '../progress/momentum.ts';
import { REFLECTION_COPY, hasReflection, type Reflection } from '../progress/reflection.ts';
import { STORY_INDEPENDENCE } from '../progress/story.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { HELP_WORDS } from '../tutor/speakTabView.ts';
import { MISSION_LEVELS } from '../scenes/scenePreview.ts';

export type Access = (feature: LockedFeature) => FeatureAccess;
const isLocked = (access: Access, feature: LockedFeature): boolean => access(feature) === 'locked';

/**
 * What a locked section says instead of its content (2026-10-20, lock seam
 * wiring). B-Journey draws each section's heading with the badge; the founder
 * rule keeps the summary (stage, streak, phrases kept) free, so a free learner
 * reads the heading, the badge and one line of what the trial shows, and a tap
 * on that line opens the Wall. The content itself is never in a locked view.
 */
export const JOURNEY_TEASERS = {
  canDo: 'See which abilities you’ve earned, and what each one needs',
  thenNow: 'See your first try next to your best',
  used: 'See the phrases you’ve used in conversation',
  help: 'See how much help you needed this week',
  sounds: 'See which sounds your checks named',
  week: 'See what went well, and what to try next',
} as const;

/** The teaser a section shows, or null when it is open. */
const teaserFor = (locked: boolean, section: keyof typeof JOURNEY_TEASERS): string | null => (locked ? JOURNEY_TEASERS[section] : null);

/** Every door on the page, as a route the tab hands to `navigate`. */
export type JourneyRoute =
  | { screen: 'ThenNow' }
  | { screen: 'ScenePreview'; params: { missionId: string } }
  | { screen: 'SoundCheck'; params: { missionId?: string } }
  | { screen: 'SoundJourney' }
  | { screen: 'Postcards' };

/** A stored completion as the missions store keeps it. */
export interface StoredCompletion {
  id: string;
  at: number;
  rung: number;
}

/** A run of words where the French part is tagged as French. */
export interface Segment {
  text: string;
  fr?: true;
}

export const segmentsText = (segments: readonly Segment[]): string => segments.map((s) => s.text).join('');

/** The page title, the one My French copy holds (`myfrench/copy.ts`). */
export const JOURNEY_TITLE = MY_FRENCH_TITLE;

// ───────────────────────────────────────────────────────────── dates

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** "12 Oct", from the learner's own calendar. */
export function shortDate(at: number): string {
  const d = new Date(at);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Whole local days between two instants, across a clock change. */
function localDaysBetween(from: number, to: number): number {
  const a = new Date(from);
  const b = new Date(to);
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((end - start) / 86_400_000);
}

/** "today", "yesterday", a weekday inside the last week, else "12 Oct". */
export function dayWord(at: number, now: number): string {
  const days = localDaysBetween(at, now);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return WEEKDAYS[new Date(at).getDay()]!;
  return shortDate(at);
}

// ───────────────────────────────────────────────────────────── the header

/** The five stages, in order. Only the first two are ever "here". */
export const STAGES = ['Starter', 'Basics', 'Everyday', 'Chatting', 'Confident'] as const;
export type StageWord = (typeof STAGES)[number];

export const STAGE_HEADING = 'Where you are';
export const STAGE_INTRO = 'Five stages, from first words to confident French';
export const YOU_ARE_HERE = 'You’re here';

export interface StageStep {
  number: number;
  label: StageWord;
  state: 'done' | 'here' | 'ahead';
  /** Said to a screen reader: the step, its name and where the learner is. */
  accessibilityLabel: string;
}

export interface StagesView {
  /** The eyebrow over the title: "Starter stage". */
  eyebrow: string;
  steps: readonly StageStep[];
  /**
   * "You’re here: Starter", drawn once under the ladder across its full width.
   * 2026-10-20, sim nits: under a fifth-width column it wrapped to two lines.
   */
  hereLine: string;
  /** "Earn all 3 Starter abilities to move up to Basics.", or null at Basics. */
  moveUp: string | null;
  /**
   * How far the brand fill runs along the track, as a fraction of the row
   * (2026-10-20 UI-008, artboard B-Journey: 7% at Starter, from the first
   * node's centre at 10%). Each stage reached adds a fifth. Never goes down:
   * it reads the same spine level as "You're here".
   */
  fill: number;
}

/** The real A0 missions on the spine, counted from the catalogue. */
export function startingOutMissions(): readonly Mission[] {
  return SCENE_SPINE.map((id) => getMission(id)).filter((m): m is Mission => m !== undefined && m.cefr === 'A0');
}

/** The artboard's fill at the first stage, as a fraction of the row. */
export const STAGE_FILL = 0.07;

/**
 * The stage a spine level stands at: A0 Starter, A1 Basics, A2 Everyday. Read
 * only from `spineFrom`'s level, so nothing past the earned level is reached.
 */
export function stageIndexOf(level: CefrLevel): number {
  return Math.max(0, MISSION_LEVELS.indexOf(level));
}

export function stagesFrom(progress: readonly MissionProgress[]): StagesView {
  const here = stageIndexOf(spineFrom(progress).level);
  const steps = STAGES.map((label, i): StageStep => {
    const state = i < here ? 'done' : i === here ? 'here' : 'ahead';
    const where = state === 'here' ? YOU_ARE_HERE : state === 'done' ? 'done' : 'ahead';
    return { number: i + 1, label, state, accessibilityLabel: `Stage ${i + 1}, ${label}, ${where}` };
  });
  const a0 = startingOutMissions().length;
  return {
    eyebrow: `${STAGES[here]!} stage`,
    steps,
    hereLine: `${YOU_ARE_HERE}: ${STAGES[here]!}`,
    moveUp: here === 0 ? `Earn all ${a0} ${STAGES[0]} abilities to move up to ${STAGES[1]}.` : null,
    fill: STAGE_FILL + here / STAGES.length,
  };
}

export interface LevelHeader {
  title: string;
  xp: string;
  /** Into this level over its span, 0 to 1. */
  fraction: number;
  /** The bar, said: "Level 2, 140 of 250 XP towards level 3". */
  barLabel: string;
}

export function levelHeader(level: XpLevel | null): LevelHeader | null {
  if (level === null) return null;
  const into = Math.max(0, Math.floor(level.intoLevel));
  const span = Math.max(1, Math.floor(level.levelSpan));
  const title = `Level ${level.level}`;
  const xp = `${into} of ${span} XP`;
  return { title, xp, fraction: Math.min(1, into / span), barLabel: `${title}, ${xp} towards level ${level.level + 1}` };
}

export interface HeaderStat {
  key: 'days' | 'minutes' | 'phrases';
  value: string;
  label: string;
}

/**
 * Days in a row, minutes practised and phrases saved (2026-10-20, sim nits: not "kept"). The minutes are every
 * finished sitting's measured minutes (`useMinutesPractised`), not spoken
 * minutes, so they are labelled "min practised". An unread figure is left out
 * rather than drawn as a nought.
 */
export function headerStats(input: { daysInARow: number | null; minutes: number | null; phrases: number }): HeaderStat[] {
  const stats: HeaderStat[] = [];
  if (input.daysInARow !== null) stats.push({ key: 'days', value: String(input.daysInARow), label: input.daysInARow === 1 ? 'day in a row' : 'days in a row' });
  if (input.minutes !== null) stats.push({ key: 'minutes', value: String(Math.max(0, Math.floor(input.minutes))), label: 'min practised' });
  stats.push({ key: 'phrases', value: String(input.phrases), label: input.phrases === 1 ? 'phrase saved' : 'phrases saved' });
  return stats;
}

// ───────────────────────────────────────────────────────────── what you can do

export const CAN_DO_HEADING = 'What you can do';

export interface CanDoRow {
  missionId: MissionId;
  /** The can-do, as the catalogue writes it. */
  title: string;
  mark: 'earned' | 'helped' | 'none';
  line: readonly Segment[];
  accessibilityLabel: string;
}

export interface CanDoView {
  /** Empty when locked: the teaser stands in. */
  rows: readonly CanDoRow[];
  locked: boolean;
  /** The line a locked section shows, null when open or when there is nothing to tease. */
  teaser: string | null;
  feature: LockedFeature;
}

/** The missions a stage section lists: this stage's, plus any other already walked. */
function missionsShown(progress: readonly MissionProgress[]): MissionProgress[] {
  const stage = spineFrom(progress).level;
  const order = new Map(SCENE_SPINE.map((id, i) => [id, i]));
  return progress
    .filter((item) => item.mission.cefr === stage || item.independence !== 'new')
    .sort((a, b) => (order.get(a.mission.id) ?? 99) - (order.get(b.mission.id) ?? 99));
}

/**
 * The line for an ability earned only through the bigger scene that contains
 * it (core's `SUBSUMED_BY`, the rule `earnedMissionIds` reads): "Earned when
 * you finished Au café du coin on your own". Null when the scene was earned
 * directly, or not earned. Shared by the tab and Then and now so they agree.
 */
export function earnedThroughBigger(missionId: string, earned: ReadonlySet<string>, completions: readonly StoredCompletion[]): Segment[] | null {
  if (!earned.has(missionId)) return null;
  if (completions.some((c) => c.id === missionId && c.rung === 4)) return null;
  const bigger = SUBSUMED_BY[missionId as MissionId];
  const scene = bigger === undefined ? undefined : getMission(bigger);
  if (scene === undefined) return null;
  return [{ text: 'Earned when you finished ' }, { text: scene.title, fr: true }, { text: ' on your own' }];
}

/** The help stem, as a sentence: "So far, with help." */
const SO_FAR = `${SO_FAR_WITH_HELP.trim().replace(/:$/, '')}.`;

export function canDoView(input: { progress: readonly MissionProgress[]; completions: readonly StoredCompletion[]; now: number; access?: Access }): CanDoView {
  const access = input.access ?? featureAccess;
  const earned = earnedMissionIds(input.progress);
  const rows = missionsShown(input.progress).map((item): CanDoRow => {
    const mission = item.mission;
    let mark: CanDoRow['mark'];
    let line: Segment[];
    if (earned.has(mission.id)) {
      mark = 'earned';
      const own = input.completions.filter((c) => c.id === mission.id && c.rung === 4).sort((a, b) => a.at - b.at)[0];
      line = own !== undefined
        ? [{ text: `Earned ${dayWord(own.at, input.now)}, without help` }]
        : earnedThroughBigger(mission.id, earned, input.completions) ?? [{ text: 'Earned without help' }];
    } else if (item.independence !== 'new') {
      mark = 'helped';
      line = [{ text: `${SO_FAR} Finish ` }, { text: mission.title, fr: true }, { text: ' on your own to earn it.' }];
    } else {
      mark = 'none';
      line = [{ text: 'Not started. Comes with ' }, { text: mission.title, fr: true }, { text: '.' }];
    }
    return { missionId: mission.id, title: mission.canDoEn, mark, line, accessibilityLabel: `${mission.canDoEn}. ${segmentsText(line)}` };
  });
  const locked = isLocked(access, 'fullJourney');
  if (locked) return { rows: [], locked, teaser: rows.length > 0 ? teaserFor(locked, 'canDo') : null, feature: 'fullJourney' };
  return { rows, locked, teaser: null, feature: 'fullJourney' };
}

// ───────────────────────────────────────────────────────────── then and now

export const THEN_NOW_HEADING = 'Then and now';
export const THEN_NOW_SUBTITLE = 'Your first try at a scene, next to your best';
export const SEE_ALL = 'See all';
export const TRY_AGAIN_FOR_BEST = 'Try again to see your best here';

/** One retained try, said in words. */
export interface Try {
  at: number;
  rung: Rung;
  help: string;
}

const validRung = (rung: number): rung is Rung => Number.isInteger(rung) && rung >= 1 && rung <= 4;

/** A mission's valid retained tries, oldest first. */
export function triesOf(completions: readonly StoredCompletion[], missionId: string): Try[] {
  return completions
    .filter((c) => c.id === missionId && validRung(c.rung) && Number.isFinite(c.at))
    .sort((a, b) => a.at - b.at)
    .map((c) => ({ at: c.at, rung: c.rung as Rung, help: HELP_WORDS[c.rung as Rung] }));
}

/**
 * The best try: the highest rung, the first time it was reached. This is the
 * same best-ever rule as core's `independenceFrom` (a tired replay never takes
 * it away); it is read here as the try itself so its date can be said.
 */
export function bestOf(tries: readonly Try[]): Try | null {
  let best: Try | null = null;
  for (const t of tries) if (best === null || t.rung > best.rung) best = t;
  return best;
}

/**
 * The first cell's label. Retention keeps a mission's most recent tries plus
 * its best (`missions/retain.ts`, at most `COMPLETIONS_PER_MISSION`), so once
 * a mission is at that cap its very first try may have been dropped: then it
 * is "First try we still have". Shared by the tab card and Then and now.
 */
export function firstLabel(tries: readonly Try[]): string {
  const word = tries.length >= COMPLETIONS_PER_MISSION ? 'First try we still have' : 'First';
  return `${word}, ${shortDate(tries[0]!.at)}`;
}

export interface ThenNowCard {
  missionId: string;
  /** The scene's French title. */
  scene: string;
  first: { label: string; help: string };
  best: { label: string; help: string } | null;
  /** Said in the dashed cell when there is no best yet (B-ThenNow's line, on the tab card too). */
  hint: string | null;
  locked: boolean;
  /** When set, the tab draws this line instead of the first-and-best card. */
  teaser: string | null;
  feature: LockedFeature;
  route: JourneyRoute;
}

/** The most recent guided scene, first try next to best, or null before any. */
export function thenNowCard(completions: readonly StoredCompletion[], access: Access = featureAccess): ThenNowCard | null {
  const latest = completions
    .filter((c) => validRung(c.rung) && getMission(c.id) !== undefined && Number.isFinite(c.at))
    .sort((a, b) => b.at - a.at)[0];
  if (latest === undefined) return null;
  const mission = getMission(latest.id)!;
  const tries = triesOf(completions, mission.id);
  const first = tries[0]!;
  const best = tries.length > 1 ? bestOf(tries)! : null;
  const locked = isLocked(access, 'thenAndNow');
  return {
    missionId: mission.id,
    scene: mission.title,
    first: { label: firstLabel(tries), help: first.help },
    best: best === null ? null : { label: `Best, ${shortDate(best.at)}`, help: best.help },
    hint: best === null ? TRY_AGAIN_FOR_BEST : null,
    locked,
    teaser: teaserFor(locked, 'thenNow'),
    feature: 'thenAndNow',
    route: { screen: 'ThenNow' },
  };
}

// ───────────────────────────────────────────────────────────── french used

export const USED_HEADING = 'French you’ve used in conversation';
export const USED_SHOWN = 6;

export interface UsedView {
  subtitle: string;
  phrases: readonly string[];
  /** "In practice, you also used 2 of these in a new situation", or null. */
  transferLine: string | null;
  locked: boolean;
  teaser: string | null;
  feature: LockedFeature;
}

/**
 * Phrases that came out of the learner's mouth in conversation (`convoUses`
 * at least one, `ledgerFrom`'s lane), and how many held when the situation
 * changed (`transfers`). Null draws none of it.
 */
export function usedView(input: { deck: readonly ReviewCard[]; tutorName: string; now: number; access?: Access }): UsedView | null {
  const ledger = ledgerFrom({ deck: input.deck, now: input.now });
  if (ledger.featured === null) return null;
  const phrases = [ledger.featured.front, ...ledger.rows.map((row) => row.front)].slice(0, USED_SHOWN);
  // Practice evidence (`transfers`), kept apart from the conversation claim
  // above and counted only over the phrases shown, so "these" is true.
  const shown = new Set(phrases);
  const moved = input.deck.filter((card) => isRetained(card) && shown.has(card.front) && evidenceOf(card).transfers >= 1).length;
  const locked = isLocked(input.access ?? featureAccess, 'fullJourney');
  return {
    subtitle: `Phrases you’ve said to ${input.tutorName}`,
    phrases: locked ? [] : phrases,
    transferLine: locked || moved === 0 ? null : `In practice, you also used ${moved} of these in a new situation`,
    locked,
    teaser: teaserFor(locked, 'used'),
    feature: 'fullJourney',
  };
}

// ───────────────────────────────────────────────────────────── help you needed

export const HELP_HEADING = 'Help you needed';

/** What the help most often was this week, as a sentence. Mostly, or the one time. */
const HELP_SENTENCES: Record<Rung, { mostly: string; once: string }> = {
  1: { mostly: 'This week you mostly said the line after it was given.', once: 'This week you said the line after it was given.' },
  2: { mostly: 'This week you mostly picked from choices.', once: 'This week you picked from choices.' },
  3: { mostly: 'This week a hint was mostly enough.', once: 'This week a hint was enough.' },
  4: { mostly: STORY_INDEPENDENCE, once: 'This week you found the words on your own.' },
};

/** The fallback, from the week story's lessons. */
export const LESSONS_ON_YOUR_OWN = 'In this week’s lessons, you found the words on your own.';

const DAYS_IN_THE_WEEK = 7;

function inLastWeek(at: number, now: number): boolean {
  if (!Number.isFinite(at)) return false;
  const days = localDaysBetween(at, now);
  return days >= 0 && days < DAYS_IN_THE_WEEK;
}

export interface HelpView {
  /** The teaser itself when locked. */
  line: string;
  locked: boolean;
  teaser: string | null;
  feature: LockedFeature;
}

/**
 * The help a learner needed, in words, or null without evidence.
 *
 * The guided scenes of the last seven local days come first: the rung they
 * finished at most often, ties to the higher rung. Without one, the week
 * story's independence (`progress/story.ts`, scripted lessons'
 * `unassistedRate`) when it was earned, said as the lessons'. Never a count.
 */
const helpOf = (line: string, locked: boolean): HelpView => {
  const teaser = teaserFor(locked, 'help');
  return { line: teaser ?? line, locked, teaser, feature: 'fullJourney' };
};

export function helpView(input: { completions: readonly StoredCompletion[]; story: { sentences: readonly string[] }; now: number; access?: Access }): HelpView | null {
  const locked = isLocked(input.access ?? featureAccess, 'fullJourney');
  const week = input.completions.filter((c) => validRung(c.rung) && getMission(c.id) !== undefined && inLastWeek(c.at, input.now));
  if (week.length > 0) {
    const tally = new Map<Rung, number>();
    for (const c of week) tally.set(c.rung as Rung, (tally.get(c.rung as Rung) ?? 0) + 1);
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0];
    return helpOf(week.length === 1 ? HELP_SENTENCES[top].once : HELP_SENTENCES[top].mostly, locked);
  }
  // The story's claim is about scripted lessons (`unassistedRate`), so it is
  // said as theirs, never as the scenes' (B4 learning-science review).
  if (input.story.sentences.includes(STORY_INDEPENDENCE)) return helpOf(LESSONS_ON_YOUR_OWN, locked);
  return null;
}

// ───────────────────────────────────────────────────────────── your sounds

export const SOUNDS_HEADING = 'Your sounds';
export const PRACTISE = 'Practise';
export const SOUND_ROWS = 3;

export interface SoundRow {
  key: string;
  /** The IPA symbol, or null for a check that named no sound. */
  ipa: string | null;
  /** The inventory's first example word, French, or null. */
  example: string | null;
  line: string;
  /** The letter tile's pastel, alternating peach and lavender down the list (B-Journey). */
  tile: 'peach' | 'lavender';
}

export interface SoundsView {
  rows: readonly SoundRow[];
  practise: JourneyRoute;
  locked: boolean;
  teaser: string | null;
  feature: LockedFeature;
}

/**
 * One row per sound a saved check named, newest first, each with
 * `soundLine`'s sentence for that check (never dated). Without a named sound,
 * the newest measured check alone. Null when no saved check backs a line.
 */
export function soundsView(input: { checks: readonly SoundCheckEvidence[]; now: number; hasJourney: boolean; access?: Access }): SoundsView | null {
  const usable = input.checks.filter((c) => Number.isFinite(c.at) && c.at <= input.now).sort((a, b) => b.at - a.at);
  if (usable.length === 0) return null;
  const rows: SoundRow[] = [];
  const seen = new Set<string>();
  for (const check of usable) {
    if (check.phoneme === null || seen.has(check.phoneme)) continue;
    const phoneme = FRENCH_PHONEMES.find((p) => p.ipa === check.phoneme);
    const line = soundLine(check);
    if (phoneme === undefined || line === null) continue;
    seen.add(check.phoneme);
    rows.push({ key: phoneme.ipa, ipa: phoneme.ipa, example: phoneme.examples[0] ?? null, line, tile: rows.length % 2 === 0 ? 'peach' : 'lavender' });
    if (rows.length === SOUND_ROWS) break;
  }
  if (rows.length === 0) {
    const measured = usable.find(isMeasuredCheck);
    const line = measured === undefined ? null : soundLine(measured);
    if (line === null) return null;
    rows.push({ key: 'latest', ipa: null, example: null, line, tile: 'peach' });
  }
  const locked = isLocked(input.access ?? featureAccess, 'sounds');
  return {
    rows: locked ? [] : rows,
    practise: input.hasJourney ? { screen: 'SoundJourney' } : { screen: 'SoundCheck', params: { missionId: usable[0]!.missionId } },
    locked,
    teaser: teaserFor(locked, 'sounds'),
    feature: 'sounds',
  };
}

// ───────────────────────────────────────────────────────────── your week

export const WEEK_HEADING = 'Your week, in words';

export interface WeekRow {
  key: 'improvement' | 'focus' | 'next';
  label: string;
  line: string;
  route: JourneyRoute | null;
  /** The row's 10pt dot (B-Journey): mint went well, sun to focus on, brand where next. */
  dot: 'mint' | 'sun' | 'brand';
}

export interface WeekView {
  rows: readonly WeekRow[];
  locked: boolean;
  teaser: string | null;
  feature: LockedFeature;
}

/** `reflectionFrom`'s three lines, or null when the week has no evidence. */
export function weekView(reflection: Reflection, access: Access = featureAccess): WeekView | null {
  if (!hasReflection(reflection) || (reflection.improvement === null && reflection.focus === null)) return null;
  const rows: WeekRow[] = [];
  if (reflection.improvement !== null) rows.push({ key: 'improvement', label: REFLECTION_COPY.improvement, line: reflection.improvement, route: null, dot: 'mint' });
  if (reflection.focus !== null) rows.push({ key: 'focus', label: REFLECTION_COPY.focus, line: reflection.focus, route: null, dot: 'sun' });
  if (reflection.next !== null) rows.push({ key: 'next', label: REFLECTION_COPY.next, line: reflection.next.title, route: { screen: 'ScenePreview', params: { missionId: reflection.next.missionId } }, dot: 'brand' });
  const locked = isLocked(access, 'fullJourney');
  return { rows: locked ? [] : rows, locked, teaser: teaserFor(locked, 'week'), feature: 'fullJourney' };
}

// ───────────────────────────────────────────────────────────── collections

export interface CollectionTile {
  key: 'postcards' | 'badges';
  title: string;
  line: string;
  /** Postcards have a screen; badges open the page's badge sheet. */
  route: JourneyRoute | { sheet: 'badges' };
}

export function collectionTiles(input: { postcards: number; badges: number }): CollectionTile[] {
  return [
    { key: 'postcards', title: 'Postcards', line: input.postcards === 0 ? 'None yet' : `${input.postcards} collected`, route: { screen: 'Postcards' } },
    { key: 'badges', title: 'Badges', line: input.badges === 0 ? 'None yet' : `${input.badges} earned`, route: { sheet: 'badges' } },
  ];
}

// ───────────────────────────────────────────────────────────── the empty journey

export interface EmptyJourney {
  title: string;
  body: string;
  start: string;
  missionId: MissionId;
}

/** Before the first conversation: the page and the one scene to start. */
export function emptyJourney(progress: readonly MissionProgress[]): EmptyJourney {
  const next = spineFrom(progress).next ?? getMission(SCENE_SPINE[0]!) ?? MISSIONS[0]!;
  return {
    title: 'Your journey starts with one conversation',
    body: 'Abilities, then and now, and your phrases collect here as you talk.',
    start: `Start ${next.title}`,
    missionId: next.id,
  };
}

/**
 * Whether the learner is before their first conversation: nothing earned,
 * kept, measured or said (`isFirstVisit`) and no guided scene finished either,
 * so a scene finished with help never meets "starts with one conversation".
 */
export function isEmptyJourney(firstVisit: boolean, completions: readonly StoredCompletion[]): boolean {
  return firstVisit && completions.length === 0;
}

/** Every line this module can say on its own, for the copy sweeps. */
export const JOURNEY_COPY: readonly string[] = [
  JOURNEY_TITLE,
  STAGE_HEADING,
  STAGE_INTRO,
  YOU_ARE_HERE,
  CAN_DO_HEADING,
  THEN_NOW_HEADING,
  THEN_NOW_SUBTITLE,
  SEE_ALL,
  TRY_AGAIN_FOR_BEST,
  USED_HEADING,
  HELP_HEADING,
  SOUNDS_HEADING,
  PRACTISE,
  WEEK_HEADING,
  LESSONS_ON_YOUR_OWN,
  ...Object.values(HELP_SENTENCES).flatMap((s) => [s.mostly, s.once]),
];
