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
 *   scene preview say them (`scenes/scenePreview.ts` `stageOf`). The first four stages are
 *   real (A0, A1, A2 and B1 from `spineFrom`, 2026-10-22 mission spine B1);
 *   Confident is a future step that claims nothing.
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
  nextScene,
  evidenceStateOf,
  phraseKeyOf,
  type LearnerGoal,
  type Mission,
  type MissionId,
  type MissionProgress,
  type ReviewCard,
  type Rung,
  type XpLevel,
  type MissionLevel,
} from '@luvani/core';

import { IMPROVING_AFTER_SESSIONS, improvingPatterns, type LearnerProfile } from '@luvani/brain/profile';

import { featureAccess, type FeatureAccess, type LockedFeature } from '../access/featureAccess.ts';
import { SO_FAR_WITH_HELP } from '../home/abilities.ts';
import { goalPickLine } from '../onboarding/goalLine.ts';
import { placementStage, type Placement } from '../onboarding/placement.ts';
import { MY_FRENCH_TITLE } from '../myfrench/copy.ts';
import { COMPLETIONS_PER_MISSION } from '../missions/store.ts';
import { ledgerFrom } from '../myfrench/ledger.ts';
import { isMeasuredCheck, soundLine } from '../myfrench/sounds.ts';
import { soundJourney } from '../soundcheck/journey.ts';
import { isRetained } from '../progress/momentum.ts';
import { REFLECTION_COPY, hasReflection, type Reflection } from '../progress/reflection.ts';
import { STORY_INDEPENDENCE } from '../progress/story.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { HELP_WORDS } from '../tutor/speakTabView.ts';
import { MISSION_LEVELS } from '../scenes/scenePreview.ts';
import { PATTERN_COPY } from '../practice/practiceTabView.ts';

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
  progress: 'See what’s getting easier, and what to practise next',
} as const;

/** The teaser a section shows, or null when it is open. */
const teaserFor = (locked: boolean, section: keyof typeof JOURNEY_TEASERS): string | null => (locked ? JOURNEY_TEASERS[section] : null);

/** Every door on the page, as a route the tab hands to `navigate`. */
export type JourneyRoute =
  | { screen: 'ThenNow' }
  | { screen: 'ScenePreview'; params: { missionId: string } }
  | { screen: 'SoundCheck'; params: { missionId?: string } }
  | { screen: 'SoundJourney' }
  | { screen: 'Phrasebook' }
  | { screen: 'Postcards' }
  | { screen: 'Review' };

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

/** The five stages, in order. Confident is never "here". */
export const STAGES = ['Starter', 'Basics', 'Everyday', 'Chatting', 'Confident'] as const;
export type StageWord = (typeof STAGES)[number];

export const STAGE_HEADING = 'Where you are';
export const STAGE_INTRO = 'Five stages, from first words to confident French';
export const YOU_ARE_HERE = 'You’re here';

export interface StageStep {
  number: number;
  label: StageWord;
  /** 'skipped' is below the learner's chosen starting point: never earned, still open to visit. */
  state: 'done' | 'skipped' | 'here' | 'ahead';
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
  /** "Earn all 3 Starter abilities to move up to Basics.", or null at Basics with no placement. */
  moveUp: string | null;
  /** "Starter skipped, still open to visit.", or null when nothing was skipped. */
  skippedLine: string | null;
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
 * The stage a spine level stands at: A0 Starter, A1 Basics, A2 Everyday, B1
 * Chatting. Read
 * only from `spineFrom`'s level, so nothing past the earned level is reached.
 */
export function stageIndexOf(level: MissionLevel): number {
  return Math.max(0, MISSION_LEVELS.indexOf(level));
}

export const SKIPPED_WORDS = 'Skipped, still open to visit';

/**
 * The stages, from earned scenes and the learner's chosen starting point
 * (F917). The honesty rule: a placement moves where "You're here" starts and
 * what the move-up line counts, never what is done. Stages below the
 * placement that the learner has not earned read as skipped, never done, and
 * a stage above it is reached only by earning every one of its scenes. With no
 * placement, or once earning has caught up with it, this is exactly the
 * earned-only view.
 */
export function stagesFrom(progress: readonly MissionProgress[], placement: Placement | null = null): StagesView {
  const earnedAt = stageIndexOf(spineFrom(progress).level);
  const placed = placementStage(placement);
  let here = earnedAt;
  if (placed > earnedAt) {
    const earned = earnedMissionIds(progress);
    here = placed;
    // Climb from the placement only by earning a whole stage's scenes.
    while (here < MISSION_LEVELS.length - 1 && SCENE_SPINE.filter((id) => getMission(id)?.cefr === MISSION_LEVELS[here]).every((id) => earned.has(id))) here += 1;
  }
  const skipped = (i: number) => i >= earnedAt && i < placed;
  const steps = STAGES.map((label, i): StageStep => {
    const state = skipped(i) ? 'skipped' : i < here ? 'done' : i === here ? 'here' : 'ahead';
    const where = state === 'here' ? YOU_ARE_HERE : state === 'skipped' ? SKIPPED_WORDS : state;
    return { number: i + 1, label, state, accessibilityLabel: `Stage ${i + 1}, ${label}, ${where}` };
  });
  const countAt = (i: number) => SCENE_SPINE.filter((id) => getMission(id)?.cefr === MISSION_LEVELS[i]).length;
  const names = STAGES.filter((_, i) => skipped(i));
  return {
    eyebrow: `${STAGES[here]!} stage`,
    steps,
    hereLine: `${YOU_ARE_HERE}: ${STAGES[here]!}`,
    moveUp: here === 0 || (placed > 0 && here < MISSION_LEVELS.length - 1)
      ? `Earn all ${countAt(here)} ${STAGES[here]} abilities to move up to ${STAGES[here + 1]}.` : null,
    skippedLine: names.length === 0 ? null : `${names.join(' and ')} skipped, still open to visit.`,
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

// ───────────────────────────────────────────────────────────── your french

/**
 * "Your French" (2026-10-22): the learner's own French, first on the page.
 * Three parts, each drawn only when a saved record backs it, and every number
 * a count of those records: never a percent, a score, an "of n" or a ladder
 * word. Phrases are `ledgerFrom`'s lane (`isRetained`, so `convoUses` at least
 * one) and how many of those also held when the situation changed
 * (`transfers`); sounds are only `soundJourney`'s per-line `laterClear`, never
 * per sound; scenes are `earnedMissionIds`, best-ever, so the count never goes
 * down. It replaces "French you've used in conversation", so phrases are drawn
 * once.
 */
export const YOUR_FRENCH_HEADING = 'Your French';
export const YOUR_FRENCH_FORWARD = 'Phrases you use in conversation, sounds that come back clear and scenes you earn collect here.';
/** The forward line when the sounds part is locked: it promises nothing the plan does not show. */
export const YOUR_FRENCH_FORWARD_NO_SOUNDS = 'Phrases you use in conversation and scenes you earn collect here.';
export const HELD_TAG = 'new situation';
export const YOUR_FRENCH_CHIPS = 5;
/** Where each part's row opens, said after its line. */
export const OPENS = { phrases: 'Opens your phrasebook', sounds: 'Opens your focus sound', scenes: 'Opens your postcards' } as const;
export const YOUR_FRENCH_SCENES = 3;

export const phrasesUsedLine = (n: number): string => `${n} ${n === 1 ? 'phrase' : 'phrases'} used in conversation`;
export const phrasesHeldLine = (n: number): string => `${n} held up when the situation changed`;
/** The phrases the row does not draw, so the count matches what is shown. */
export const phrasesMoreLine = (n: number): string => `and ${n} more in your phrasebook`;
export const scenesEarnedLine = (n: number): string => `${n} ${n === 1 ? 'scene' : 'scenes'} earned on your own`;

/** One line that came back clear, or how many and the newest's scene. */
export function clearLine(count: number, scene: string): Segment[] {
  return count === 1
    ? [{ text: 'A line from ' }, { text: scene, fr: true }, { text: ' that was called out came back clear.' }]
    : [{ text: `${count} lines that were called out came back clear, most recently in ` }, { text: scene, fr: true }, { text: '.' }];
}

export interface YourPhrase {
  front: string;
  /** It also held when the situation changed (`transfers` at least one). Said in words, never a colour. */
  held: boolean;
}

export interface YourPhrasesPart {
  /** Null when locked: the count is part of what the trial shows. */
  usedLine: string | null;
  /** Present only when at least one used phrase also held. */
  heldLine: string | null;
  /** The one highlighted phrase: the ledger's featured, the same one Phrasebook and Home feature. */
  featured: YourPhrase | null;
  /** The ledger's rows in ledger order, up to {@link YOUR_FRENCH_CHIPS}. */
  chips: readonly YourPhrase[];
  /** "and n more in your phrasebook" when the lane holds more than is drawn, else null. */
  moreLine: string | null;
  route: JourneyRoute;
  /** The row's whole sentence for a screen reader, and where it opens. */
  accessibilityLabel: string;
  locked: boolean;
  teaser: string | null;
  feature: LockedFeature;
}

export interface YourSoundsPart {
  /** Null when locked. */
  line: readonly Segment[] | null;
  route: JourneyRoute;
  accessibilityLabel: string;
  locked: boolean;
  teaser: string | null;
  feature: LockedFeature;
}

export interface YourScenesPart {
  line: string;
  /** French titles, newest earned first. */
  titles: readonly string[];
  route: JourneyRoute;
  accessibilityLabel: string;
}

export interface YourFrenchView {
  heading: string;
  phrases: YourPhrasesPart | null;
  sounds: YourSoundsPart | null;
  scenes: YourScenesPart | null;
  /** The parts drawn in the card, in order: present and not locked. A locked part draws its teaser instead. */
  open: readonly ('phrases' | 'sounds' | 'scenes')[];
  /** The no-numeral line when no part has evidence yet, else null. */
  forward: string | null;
}

function phrasesPart(deck: readonly ReviewCard[], now: number, access: Access): YourPhrasesPart | null {
  const lane = deck.filter(isRetained);
  const ledger = ledgerFrom({ deck, now });
  if (lane.length === 0 || ledger.featured === null) return null;
  const heldIds = new Set(lane.filter((card) => evidenceOf(card).transfers >= 1).map((card) => card.id));
  const head = { front: ledger.featured.front, held: heldIds.has(ledger.featured.id) };
  const chips = ledger.rows.slice(0, YOUR_FRENCH_CHIPS).map((row) => ({ front: row.front, held: heldIds.has(row.id) }));
  const hidden = lane.length - 1 - chips.length;
  const locked = isLocked(access, 'fullJourney');
  const usedLine = phrasesUsedLine(lane.length);
  const heldLine = heldIds.size === 0 ? null : phrasesHeldLine(heldIds.size);
  const moreLine = hidden > 0 ? phrasesMoreLine(hidden) : null;
  const said = [usedLine, heldLine, moreLine, OPENS.phrases].filter((x): x is string => x !== null).join('. ');
  return {
    accessibilityLabel: locked ? JOURNEY_TEASERS.used : said,
    usedLine: locked ? null : usedLine,
    heldLine: locked ? null : heldLine,
    featured: locked ? null : head,
    chips: locked ? [] : chips,
    moreLine: locked ? null : moreLine,
    route: { screen: 'Phrasebook' },
    locked,
    teaser: teaserFor(locked, 'used'),
    feature: 'fullJourney',
  };
}

function soundsPart(checks: readonly SoundCheckEvidence[], now: number, access: Access): YourSoundsPart | null {
  const clear = soundJourney(checks, now)?.laterClear ?? [];
  const newest = [...clear].sort((a, b) => b.at - a.at)[0];
  const mission = newest === undefined ? undefined : getMission(newest.missionId);
  if (mission === undefined) return null;
  const locked = isLocked(access, 'sounds');
  const line = clearLine(clear.length, mission.title);
  return { line: locked ? null : line, accessibilityLabel: locked ? JOURNEY_TEASERS.sounds : `${segmentsText(line)} ${OPENS.sounds}`, route: { screen: 'SoundJourney' }, locked, teaser: teaserFor(locked, 'sounds'), feature: 'sounds' };
}

function scenesPart(progress: readonly MissionProgress[], completions: readonly StoredCompletion[]): YourScenesPart | null {
  const earned = earnedMissionIds(progress);
  if (earned.size === 0) return null;
  const ownAt = (id: string): number | null => {
    const times = completions.filter((c) => c.id === id && c.rung === 4 && Number.isFinite(c.at)).map((c) => c.at);
    return times.length === 0 ? null : Math.max(...times);
  };
  const earnedAt = (id: MissionId): number | null => {
    const bigger = SUBSUMED_BY[id];
    return ownAt(id) ?? (bigger !== undefined ? ownAt(bigger) : null);
  };
  const spineIndex = (id: MissionId): number => {
    const i = SCENE_SPINE.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const ids = [...earned].sort((a, b) => {
    const ta = earnedAt(a);
    const tb = earnedAt(b);
    if (ta !== null && tb !== null && ta !== tb) return tb - ta;
    if (ta !== null && tb === null) return -1;
    if (ta === null && tb !== null) return 1;
    return spineIndex(a) - spineIndex(b);
  });
  const titles = ids.flatMap((id) => {
    const mission = getMission(id);
    return mission === undefined ? [] : [mission.title];
  });
  const shown = titles.slice(0, YOUR_FRENCH_SCENES);
  const line = scenesEarnedLine(earned.size);
  return { line, titles: shown, route: { screen: 'Postcards' }, accessibilityLabel: `${line}. ${shown.join(', ')}. ${OPENS.scenes}` };
}

/**
 * The learner's own French, from saved evidence only. The tab draws it on a
 * practised journey; the empty journey card covers the rest.
 */
export function yourFrenchView(input: {
  deck: readonly ReviewCard[];
  checks: readonly SoundCheckEvidence[];
  progress: readonly MissionProgress[];
  completions?: readonly StoredCompletion[];
  now: number;
  access?: Access;
}): YourFrenchView {
  const access = input.access ?? featureAccess;
  const phrases = phrasesPart(input.deck, input.now, access);
  const sounds = soundsPart(input.checks, input.now, access);
  const scenes = scenesPart(input.progress, input.completions ?? []);
  const none = phrases === null && sounds === null && scenes === null;
  const open = (['phrases', 'sounds', 'scenes'] as const).filter((key) => {
    const part = { phrases, sounds, scenes }[key];
    return part !== null && !('locked' in part && part.locked);
  });
  const forward = !none ? null : isLocked(access, 'sounds') ? YOUR_FRENCH_FORWARD_NO_SOUNDS : YOUR_FRENCH_FORWARD;
  return { heading: YOUR_FRENCH_HEADING, phrases, sounds, scenes, open, forward };
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

// ───────────────────────────────────────────────────────────── how it's going

/**
 * "How it’s going" (2026-10-28, LEARN-013): two rows, each drawn only when
 * stored evidence backs it, never a percent, score, count or "n of m".
 *
 * - Getting better at: brain's `improvingPatterns` (recurring, then quiet for
 *   `IMPROVING_AFTER_SESSIONS` conversations), kept to tags `PATTERN_COPY`
 *   names, so a raw tag never reaches the learner. It claims a quiet pattern,
 *   never mastery.
 * - Needs another go: due `phrase:` deck cards not yet transferred that were
 *   missed once (`lapses > 0`) or used only with help. Lapses decide
 *   membership only: the order is oldest due first and nothing shows, ranks
 *   or colours by them (`core/review/scheduler.ts`, `lapses`). It opens
 *   Review, which plays the whole due deck these cards are in: Drill's node
 *   path plays only phrases the drill bank holds an exercise for.
 */
export const PROGRESS_HEADING = 'How it’s going';
export const GETTING_BETTER = 'Getting better at';
export const NEEDS_ANOTHER_GO = 'Needs another go';
export const QUIET_LINE = `It hasn’t come up in your last ${IMPROVING_AFTER_SESSIONS} conversations.`;
export const READY_AGAIN = 'Ready for another go';
export const OPENS_REVIEW = 'Opens your review';
export const IMPROVING_ROWS = 2;
export const ANOTHER_GO_CHIPS = 3;

export interface ProgressRow {
  key: 'better' | 'again';
  label: string;
  /** The row's dot, as Your week's: mint for what went well, sun for what to try. */
  dot: 'mint' | 'sun';
  /** One sentence per pattern, or the "Ready for another go" line. */
  lines: readonly string[];
  /** French fronts, oldest due first. Empty for Getting better at. */
  chips: readonly string[];
  route: JourneyRoute | null;
  accessibilityLabel: string;
}

export interface ProgressView {
  heading: string;
  /** Empty when locked: the teaser stands in. */
  rows: readonly ProgressRow[];
  locked: boolean;
  teaser: string | null;
  feature: LockedFeature;
}

type PhraseRecord = Pick<LearnerProfile['phrases'][string], 'fr' | 'frWritten' | 'timesAssisted' | 'timesUsedWell'>;

/** Phrase keys the brain saw used only with help, built as `core/tutorBrief.ts` builds them. */
function helpedKeys(phrases: Readonly<Record<string, PhraseRecord>>): Set<string> {
  const helped = new Set<string>();
  for (const p of Object.values(phrases)) {
    if (!(p.timesAssisted > 0 && p.timesUsedWell === 0)) continue;
    if (typeof p.fr === 'string' && p.fr.trim()) helped.add(phraseKeyOf(p.fr));
    if (typeof p.frWritten === 'string' && p.frWritten.trim()) helped.add(phraseKeyOf(p.frWritten));
  }
  return helped;
}

/** The deck phrases that need another go, oldest due first. Lapses pick, never order. */
export function needsAnotherGo(deck: readonly ReviewCard[], phrases: Readonly<Record<string, PhraseRecord>>, now: number): ReviewCard[] {
  const helped = helpedKeys(phrases);
  return deck
    .filter((card) => card.id.startsWith('phrase:') && card.front.trim() !== '' && card.due <= now)
    .filter((card) => evidenceStateOf(card) !== 'transferred')
    .filter((card) => card.lapses > 0 || helped.has(card.id))
    .sort((a, b) => a.due - b.due || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, ANOTHER_GO_CHIPS);
}

/** "How it’s going", or null when neither row has evidence behind it. */
export function progressRowsView(input: {
  brain: Pick<LearnerProfile, 'errorPatterns' | 'stats' | 'phrases'>;
  deck: readonly ReviewCard[];
  now: number;
  access?: Access;
}): ProgressView | null {
  const rows: ProgressRow[] = [];
  const titles = improvingPatterns(input.brain)
    .filter((p) => Object.hasOwn(PATTERN_COPY, p.tag))
    .slice(0, IMPROVING_ROWS)
    .map((p) => PATTERN_COPY[p.tag]!.title);
  if (titles.length > 0) {
    const lines = titles.map((title) => `${title}. ${QUIET_LINE}`);
    rows.push({ key: 'better', label: GETTING_BETTER, dot: 'mint', lines, chips: [], route: null, accessibilityLabel: `${GETTING_BETTER}. ${lines.join(' ')}` });
  }
  const again = needsAnotherGo(input.deck, input.brain.phrases, input.now).map((card) => card.front.trim());
  if (again.length > 0) {
    rows.push({ key: 'again', label: NEEDS_ANOTHER_GO, dot: 'sun', lines: [READY_AGAIN], chips: again, route: { screen: 'Review' }, accessibilityLabel: `${NEEDS_ANOTHER_GO}. ${again.join(', ')}. ${READY_AGAIN}. ${OPENS_REVIEW}` });
  }
  if (rows.length === 0) return null;
  const locked = isLocked(input.access ?? featureAccess, 'fullJourney');
  return { heading: PROGRESS_HEADING, rows: locked ? [] : rows, locked, teaser: teaserFor(locked, 'progress'), feature: 'fullJourney' };
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
  /** "Picked for your move" when the learner's goal chose the scene, else null. */
  picked: string | null;
}

/**
 * Before the first conversation: the page and the one scene to start, from
 * core's `nextScene`, the same scene Today and Speak offer.
 */
export function emptyJourney(progress: readonly MissionProgress[], goal: LearnerGoal | null = null): EmptyJourney {
  const ahead = nextScene(progress, goal);
  const next = ahead?.mission ?? getMission(SCENE_SPINE[0]!) ?? MISSIONS[0]!;
  return {
    picked: ahead?.picked === 'goal' ? goalPickLine(goal) : null,
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
  YOUR_FRENCH_HEADING,
  YOUR_FRENCH_FORWARD,
  YOUR_FRENCH_FORWARD_NO_SOUNDS,
  phrasesMoreLine(1),
  phrasesMoreLine(2),
  HELD_TAG,
  ...Object.values(OPENS),
  HELP_HEADING,
  SOUNDS_HEADING,
  PRACTISE,
  WEEK_HEADING,
  PROGRESS_HEADING,
  GETTING_BETTER,
  NEEDS_ANOTHER_GO,
  QUIET_LINE,
  READY_AGAIN,
  OPENS_REVIEW,
  LESSONS_ON_YOUR_OWN,
  ...Object.values(HELP_SENTENCES).flatMap((s) => [s.mostly, s.once]),
];
