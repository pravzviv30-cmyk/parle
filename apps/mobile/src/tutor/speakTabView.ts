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

export interface StarterRow {
  missionId: string;
  french: string;
  title: string;
  line: string;
  /** The path's own state, for the scene mark. */
  state: 'earned' | 'here' | 'ahead';
  next: boolean;
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
        accessibilityLabel: `${row.title}, ${line}${next ? `, ${NEXT_CHIP}` : ''}`,
        route: { screen: 'ScenePreview', params: { missionId: row.missionId } },
      };
    }),
  };
}

// ─────────────────────────────────────────────────────── same scene, less help

export const LESS_HELP_TITLE = 'Same scene, a bit less help';

export interface LessHelp {
  missionId: string;
  french: string;
  title: string;
  /** "A bit less help this time: Choices". */
  line: string;
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
      line: `A bit less help this time: ${HELP_WORDS[replay.startRung]}`,
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

/**
 * The learner's own suggestions, then their own topic: an open conversation,
 * carrying the free seed their answers make when there is one. No personal
 * topic is invented.
 */
export function talkChips(suggestions: { ideas: readonly { title: string; fr: string; en: string }[]; freeSeed?: { fr: string; en: string } }): TalkChip[] {
  return [
    ...suggestions.ideas.map((idea) => ({ label: idea.title, own: false, params: { seedTopic: { fr: idea.fr, en: idea.en } } })),
    { label: OWN_TOPIC, own: true, params: suggestions.freeSeed === undefined ? {} : { seedTopic: suggestions.freeSeed } },
  ];
}

// ─────────────────────────────────────────────────────────── the tutor and tiles

export const CHANGE_VOICE_ROUTE = { screen: 'Profile', params: { sheet: 'tutorVoice' } } as const;

export interface SpeakTile {
  key: 'sounds' | 'memory' | 'intro';
  title: string;
  ground: 'pastel.peach' | 'pastel.sage' | 'pastel.butter';
  route: { screen: 'SoundJourney' | 'TutorMemory' | 'TutorIntro' };
  locked: boolean;
}

export function speakTiles(tutorName: string, access: Access = featureAccess): SpeakTile[] {
  return [
    { key: 'sounds', title: 'Pronunciation help', ground: 'pastel.peach', route: { screen: 'SoundJourney' }, locked: access('sounds') === 'locked' },
    { key: 'memory', title: `What ${tutorName} remembers`, ground: 'pastel.sage', route: { screen: 'TutorMemory' }, locked: access('tutorMemory') === 'locked' },
    { key: 'intro', title: 'How your tutor works', ground: 'pastel.butter', route: { screen: 'TutorIntro' }, locked: false },
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

export const REVISIT = {
  title: 'Revisit a conversation',
  gloss: 'Read back what you said and pick one up again.',
  route: { screen: 'Conversations' },
} as const;

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
  REVISIT.title,
  REVISIT.gloss,
  SEE_MINUTES.label,
  MINUTES_CHECKING,
  ...Object.values(HELP_WORDS),
];
