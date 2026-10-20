/**
 * What the direction B Speak tab shows, decided here so the tab file is only
 * layout (B2, 2026-10-20, artboard B-Speak).
 *
 * Every line is read from something that already ships: the scene's authored
 * `goalEn`, `canDoEn` and `earnedEn`, the minutes `home/estimate.ts` gives,
 * the stored completions core's `replayRung` reads, the suggestions
 * `main/learningSuggestions.ts` makes from the learner's own answers, and the
 * plan band `purchases/planStatus.ts` puts in words. Nothing is stored and
 * nothing is guessed: a line with nothing behind it is not drawn.
 *
 * Lock badges come only from `access/featureAccess.ts`, passed in so a test can
 * ask what a locked seam would draw.
 */

import { getMission, type Mission, type MissionProgress, type Rung } from '@luvani/core';

import { featureAccess, type FeatureAccess, type LockedFeature } from '../access/featureAccess.ts';
import { minutesLine } from '../home/estimate.ts';
import { missionReplay } from '../missions/chooserView.ts';
import type { PlanStatusView } from '../purchases/planStatus.ts';
import type { BArtName } from '../art/BArt.tsx';
import type { Pace } from './pace.ts';
import { pathCard, speakPath } from './speakView.ts';

type Access = (feature: LockedFeature) => FeatureAccess;

export const SPEAK_TITLE = 'Speak';

export function speakSubtitle(tutorName: string): string {
  return `Choose what to talk about with ${tutorName}`;
}

/** Help in words only, one per rung of the ladder. */
export const HELP_WORDS: Record<Rung, string> = { 1: 'Line given', 2: 'Choices', 3: 'Hint', 4: 'On your own' };

// ─────────────────────────────────────────────────────────── the recommended card

export const RECOMMENDED = 'Recommended';
export const USES_SPEAKING_TIME = 'Uses speaking time';
/**
 * No estimate exists for the preview itself, so the artboard's "1 min" is not
 * said. The preview's drill lines are free (scenes/scenePreview.ts).
 */
export const PREPARE_FIRST = 'Prepare first, free';
export const START = 'Start';

export interface NextFacts {
  title: string;
  body: string;
  minutes: number | null;
  params: { missionId?: string; seedTopic?: unknown; continuationPackId?: string };
}

export interface Recommended {
  title: string;
  /** The scene's authored goal, led by a verb, or the thread's own line. */
  sentence: string;
  /** "About 6 minutes", or null for a conversation with no scene behind it. */
  minutes: string | null;
  /** The preview, only for a scene. */
  prepare: { screen: 'ScenePreview'; params: { missionId: string } } | null;
}

export function recommended(next: NextFacts): Recommended {
  const id = next.params.missionId;
  const mission: Mission | undefined = id === undefined ? undefined : getMission(id);
  if (mission === undefined) return { title: next.title, sentence: next.body, minutes: null, prepare: null };
  return {
    title: mission.titleEn,
    sentence: mission.goalEn,
    minutes: next.minutes === null ? null : minutesLine(next.minutes),
    prepare: { screen: 'ScenePreview', params: { missionId: mission.id } },
  };
}

/** The Speak/Type choice, as the two radios over `startModes`. */
export const MODE_CHOICES: readonly { key: 'speak' | 'type'; label: string; textMode: boolean }[] = [
  { key: 'speak', label: 'Speak', textMode: false },
  { key: 'type', label: 'Type', textMode: true },
];

export function correctionsChip(strictness: string): string {
  return `Corrections: ${strictness}`;
}

/**
 * The pace preference changes the sentences, never the speed of the voice
 * (tutor/pace.ts), so slow reads "Simpler", which is what it does.
 */
export function paceChip(tutorName: string, pace: Pace): string {
  return `${tutorName}’s pace: ${pace === 'slow' ? 'Simpler' : 'Normal'}`;
}

/** Both chips open the existing preferences screen, which edits both. */
export const PREFERENCES_ROUTE = { screen: 'LearningPreferences' } as const;

// ─────────────────────────────────────────────────────────── the starter scenes

export const EVERY_SCENE = { label: 'Every scene', route: { screen: 'Missions' } } as const;
export const NEXT_CHIP = 'Next';
export const DONE_WITHOUT_HELP = 'Done without help, speak it again';

/**
 * Stage words, never CEFR. Matches `scenes/scenePreview.ts` and Journey's
 * stages (2026-10-20, B4 review: the founder's stage names, Starter for A0).
 */
export function stageWord(level: 'A0' | 'A1'): string {
  return level === 'A0' ? 'Starter' : 'Basics';
}

/**
 * The row's tile and its mark, by the path's state (2026-10-20 UI-008, artboard
 * B-Speak): an earned scene on sage with the mint check, the next one on sun
 * with the brand "Next" pill, one ahead on lavender with a chevron. Each is a
 * `useB()` token name, so the same row draws the M3 mapping in dark.
 */
export const STARTER_TILE: Record<StarterRow['state'], { ground: 'sage' | 'sun' | 'lavender'; trailing: 'check' | 'next' | 'chevron' }> = {
  earned: { ground: 'sage', trailing: 'check' },
  here: { ground: 'sun', trailing: 'next' },
  ahead: { ground: 'lavender', trailing: 'chevron' },
};

/**
 * The canvas icon for a scene's place, at the artboard's size: the café cup
 * (30x28) for cafés and the suitcase (24x28) for the hotel, the house and the
 * friends for theirs. A place the canvas draws no icon for (the market and the
 * street) takes the suitcase, the travel mark, rather than a café cup.
 */
export function sceneIcon(place: string): { name: BArtName; width: number; height: number } {
  if (place === 'cafe') return { name: 'icon-cafe', width: 30, height: 28 };
  if (place === 'home') return { name: 'icon-house', width: 28, height: 28 };
  if (place === 'friends') return { name: 'icon-friends', width: 30, height: 28 };
  return { name: 'icon-suitcase', width: 24, height: 28 };
}

export interface StarterRow {
  missionId: string;
  french: string;
  title: string;
  line: string;
  /** The path's own state, for the scene mark. */
  state: 'earned' | 'here' | 'ahead';
  next: boolean;
  tile: { ground: 'sage' | 'sun' | 'lavender'; trailing: 'check' | 'next' | 'chevron' };
  icon: { name: BArtName; width: number; height: number };
  accessibilityLabel: string;
  route: { screen: 'ScenePreview'; params: { missionId: string } };
}

export function starterScenes(progress: readonly MissionProgress[]): { heading: string; rows: StarterRow[] } {
  const card = pathCard(speakPath(progress));
  return {
    // 2026-10-20, B4 review, B-Speak: "Starter scenes".
    heading: `${stageWord(card.level)} scenes`,
    rows: card.rows.map((row) => {
      const mission = getMission(row.missionId)!;
      const mine = progress.find((item) => item.mission.id === row.missionId);
      // "Without help" only when this scene's own best finish was on your own;
      // a scene earned through a bigger one keeps its earned line.
      const own = mine?.independence === 'on-your-own';
      const line = row.state === 'earned' ? (own ? DONE_WITHOUT_HELP : mission.earnedEn) : mission.canDoEn;
      const next = row.state === 'here';
      return {
        missionId: row.missionId,
        french: row.french,
        title: row.title,
        line,
        state: row.state,
        next,
        tile: STARTER_TILE[row.state],
        icon: sceneIcon(mission.place),
        accessibilityLabel: `${row.title}, ${line}${next ? `, ${NEXT_CHIP}` : ''}`,
        route: { screen: 'ScenePreview', params: { missionId: row.missionId } },
      };
    }),
  };
}

// ─────────────────────────────────────────────────────── same scene, less help

export const LESS_HELP_TITLE = 'Same scene, a bit less help';
export const LESS_HELP_LINE = 'A bit less help this time';

export interface LessHelp {
  missionId: string;
  french: string;
  title: string;
  /** "A bit less help this time", the artboard's line. */
  line: string;
  /** The help the replay opens with, in words ("Choices"), for the spoken label. */
  help: string;
  lastRung: Rung;
  startRung: Rung;
  locked: boolean;
  /** What a locked tap opens the Wall for: the same-scene replay is `continueArc`. */
  feature: LockedFeature;
  params: { missionId: string };
}

/**
 * The most recently finished scene that a replay would really open with less
 * help, or null. A scene last finished on your own has no help left to take
 * away (`replayRung` hands back the same rung), so it is not offered: the card
 * would be promising something the room does not do. The room itself opens at
 * `replayRung` for any finished scene (nav/RootNavigator.tsx, `missionReplay`),
 * so the card passes only the scene.
 */
export function lessHelp(stored: readonly { id: string; at: number; rung: number }[], access: Access = featureAccess): LessHelp | null {
  const latestFirst = [...stored].sort((a, b) => b.at - a.at);
  const seen = new Set<string>();
  for (const done of latestFirst) {
    if (seen.has(done.id)) continue;
    seen.add(done.id);
    const replay = missionReplay(done.id, stored);
    const mission = getMission(done.id);
    if (replay === null || mission === undefined || replay.startRung <= replay.lastRung) continue;
    return {
      missionId: mission.id,
      french: mission.title,
      title: mission.titleEn,
      // 2026-10-20 UI-008, artboard B-Speak: the line is the artboard's; the
      // help word rides the card's spoken label.
      line: LESS_HELP_LINE,
      help: HELP_WORDS[replay.startRung],
      lastRung: replay.lastRung,
      startRung: replay.startRung,
      locked: access('continueArc') === 'locked',
      feature: 'continueArc',
      params: { missionId: mission.id },
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────── talk about anything

export const TALK_TITLE = 'Talk about anything';
export const TALK_SUB = 'Start your own conversation.';
export const OWN_TOPIC = 'Your own topic';

export interface TalkChip {
  label: string;
  own: boolean;
  params: { seedTopic?: { fr: string; en: string } };
}

/** Personal topics shown at most, before "Your own topic" (the artboard's three). */
export const MAX_MEMORY_TOPICS = 3;

/** A remembered fact, as the brain keeps it (`profile.brain.memory.facts`). */
export interface TopicFact {
  kind: string;
  fr: string | null;
  en: string;
  notedAt: string;
}

/**
 * The chips (founder decision, 2026-10-20 UI-008, artboard B-Speak): the
 * learner's remembered interests and life events, newest first, up to three;
 * with none, the suggestions their own answers make. "Your own topic" always
 * ends the row, an open conversation carrying the free seed when there is one.
 *
 * The caller passes the visible facts (forgotten ones already gone) and
 * whether memory is paused; a paused memory offers no remembered topic. No
 * personal topic is invented.
 */
export function talkChips(
  suggestions: { ideas: readonly { title: string; fr: string; en: string }[]; freeSeed?: { fr: string; en: string } },
  memory: { facts: readonly TopicFact[]; paused: boolean } = { facts: [], paused: true },
): TalkChip[] {
  const remembered = memory.paused ? [] : memoryTopics(memory.facts);
  const lead = remembered.length > 0
    ? remembered
    : suggestions.ideas.map((idea) => ({ label: idea.title, own: false, params: { seedTopic: { fr: idea.fr, en: idea.en } } }));
  return [
    ...lead,
    { label: OWN_TOPIC, own: true, params: suggestions.freeSeed === undefined ? {} : { seedTopic: suggestions.freeSeed } },
  ];
}

function memoryTopics(facts: readonly TopicFact[]): TalkChip[] {
  const seen = new Set<string>();
  const chips: TalkChip[] = [];
  const newest = [...facts]
    .filter((fact) => (fact.kind === 'interest' || fact.kind === 'life-event') && fact.en.trim() !== '')
    .sort((a, b) => (Date.parse(b.notedAt) || 0) - (Date.parse(a.notedAt) || 0));
  for (const fact of newest) {
    const label = fact.en.trim();
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const fr = fact.fr?.trim() ?? '';
    chips.push({ label, own: false, params: { seedTopic: { fr: fr === '' ? label : fr, en: `Talk with me about this: ${label}` } } });
    if (chips.length === MAX_MEMORY_TOPICS) break;
  }
  return chips;
}

// ─────────────────────────────────────────────────────────── the tutor and tiles

export const CHANGE_VOICE_ROUTE = { screen: 'Profile', params: { sheet: 'tutorVoice' } } as const;

/**
 * The tutor's sample, readable while it is heard: the signature line shows
 * under the name only while the sample plays (everything spoken is also on
 * screen), and the card at rest is the artboard's.
 */
export function sampleCaption(playing: boolean, signature: string): string | null {
  return playing ? signature : null;
}

export interface SpeakTile {
  key: 'sounds' | 'memory' | 'intro';
  title: string;
  /** A `useB()` token (2026-10-20 UI-008, artboard B-Speak). */
  ground: 'peach' | 'sage' | 'butter';
  art: { name: BArtName; width: number; height: number };
  route: { screen: 'SoundJourney' | 'TutorMemory' | 'TutorIntro' };
  locked: boolean;
}

export function speakTiles(tutorName: string, access: Access = featureAccess): SpeakTile[] {
  return [
    { key: 'sounds', title: 'Pronunciation help', ground: 'peach', art: { name: 'voice-chat', width: 60, height: 55 }, route: { screen: 'SoundJourney' }, locked: access('sounds') === 'locked' },
    { key: 'memory', title: `What ${tutorName} remembers`, ground: 'sage', art: { name: 'star-jar', width: 60, height: 55 }, route: { screen: 'TutorMemory' }, locked: access('tutorMemory') === 'locked' },
    { key: 'intro', title: 'How your tutor works', ground: 'butter', art: { name: 'compass', width: 55, height: 55 }, route: { screen: 'TutorIntro' }, locked: false },
  ];
}

/**
 * How many tiles share a row (2026-10-20, sim nits): "Pronunciation help" broke
 * mid-word at 375pt in three columns. A word never breaks, so the row takes
 * three columns only when the longest word fits a tile, then two (the third
 * tile spanning the next row), then one. The width of a word is estimated from
 * its letters at a generous average glyph width, scaled by the reading size.
 */
export const TILE_GLYPH_EM = 0.6;

export function tileColumns(input: {
  contentWidth: number;
  fontScale: number;
  titleSize: number;
  gap: number;
  padding: number;
  titles: readonly string[];
}): 1 | 2 | 3 {
  const { contentWidth, fontScale, titleSize, gap, padding, titles } = input;
  if (contentWidth < 310 || fontScale >= 1.5) return 1;
  const longest = Math.max(0, ...titles.flatMap((title) => title.split(/\s+/)).map((word) => Array.from(word).length));
  const word = longest * titleSize * fontScale * TILE_GLYPH_EM;
  for (const n of [3, 2] as const) {
    if ((contentWidth - gap * (n - 1)) / n - padding * 2 >= word) return n;
  }
  return 1;
}

/**
 * Outfit Bold advance widths in em, by letter class (2026-10-20 UI-008, sim
 * check at 402pt): narrow strokes, wide letters, capitals, and the rest. Used
 * only for the artboard's three-column row, where the flat 0.6em of
 * `tileColumns` is too cautious and dropped the row to two at 390pt.
 */
export const OUTFIT_BOLD_EM = { narrow: 0.3, wide: 0.86, capital: 0.66, other: 0.58 } as const;

/** A word's drawn width in em, from its letters' classes. */
export function wordEm(word: string): number {
  let em = 0;
  for (const ch of Array.from(word)) {
    if (/[iljtrf'.,:;!]/.test(ch)) em += OUTFIT_BOLD_EM.narrow;
    else if (/[mwMW]/.test(ch)) em += OUTFIT_BOLD_EM.wide;
    else if (/[A-ZÀ-Ý]/.test(ch)) em += OUTFIT_BOLD_EM.capital;
    else em += OUTFIT_BOLD_EM.other;
  }
  return em;
}

/** The three-column row holds from this content width (a 375pt phone less its gutters) up to this reading size. */
export const THREE_UP_MIN_CONTENT = 335;
export const THREE_UP_MAX_SCALE = 1.15;
/** The tile's own padding, then the tighter one tried before giving up a column. */
export const TILE_PADDINGS = [12, 10] as const;

/**
 * The tile row's columns and padding. At a phone's width and ordinary reading
 * sizes the row is the artboard's three: the label wraps between words only,
 * so the test is the longest single word against the column, first at the
 * 12pt padding, then at 10. A word that fits neither falls back to
 * `tileColumns` (two, then one), as does large text.
 */
export function tileLayout(input: {
  contentWidth: number;
  fontScale: number;
  titleSize: number;
  gap: number;
  titles: readonly string[];
}): { columns: 1 | 2 | 3; padding: number } {
  const { contentWidth, fontScale, titleSize, gap, titles } = input;
  if (contentWidth >= THREE_UP_MIN_CONTENT && fontScale <= THREE_UP_MAX_SCALE) {
    const longest = Math.max(0, ...titles.flatMap((title) => title.split(/\s+/)).map(wordEm)) * titleSize * fontScale;
    for (const padding of TILE_PADDINGS) {
      if ((contentWidth - gap * 2) / 3 - padding * 2 >= longest) return { columns: 3, padding };
    }
  }
  const padding = TILE_PADDINGS[0];
  return { columns: tileColumns({ contentWidth, fontScale, titleSize, gap, padding, titles }), padding };
}

// ─────────────────────────────────────────────────────────── the minutes footer

export const SEE_MINUTES = { label: 'See your minutes', route: { screen: 'Subscription' } } as const;
export const MINUTES_CHECKING = 'Checking your speaking time.';

/**
 * The plan's band in words (F377, F541): plenty, a little or none, never a
 * count of minutes or seconds and never a date.
 */
export function minutesBand(view: PlanStatusView | null): string {
  if (view === null) return MINUTES_CHECKING;
  if (!view.known) return view.line;
  return view.bandLine;
}

/** Every fixed line this module can put on Speak, for the copy sweeps. */
export const SPEAK_TAB_COPY: readonly string[] = [
  SPEAK_TITLE,
  RECOMMENDED,
  USES_SPEAKING_TIME,
  PREPARE_FIRST,
  START,
  ...MODE_CHOICES.map((m) => m.label),
  EVERY_SCENE.label,
  NEXT_CHIP,
  DONE_WITHOUT_HELP,
  LESS_HELP_TITLE,
  TALK_TITLE,
  TALK_SUB,
  OWN_TOPIC,
  LESS_HELP_LINE,
  SEE_MINUTES.label,
  MINUTES_CHECKING,
  ...Object.values(HELP_WORDS),
];
