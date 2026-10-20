/**
 * What the scene preview says, by id (B1, 2026-10-20, artboard B-ScenePreview).
 *
 * The id is a guided mission's or a daily scene's; both resolve here and an id
 * this build does not know answers null, so the screen can fall back calmly.
 *
 * Every line is authored content that already ships. The one tutor line, "The
 * barista might say", appears only where an authored opener is bundled on
 * the device (the premier café exchange in `onboarding/tutorLines.ts`). Every
 * other scene says "You could start with" over the learner's own authored
 * opening line, so no tutor line is ever invented.
 *
 * Pure: it plays nothing and reads no store. It decides which line has a
 * bundled clip and which falls back to the device voice, with the same labels
 * `missions/preview.ts` uses.
 */

import { DAILY_SCENARIOS, MISSIONS, phraseKeyOf, type DailyScenario, type Mission } from '@luvani/core';
import { estimateMinutes, missionMinutes } from '../home/estimate.ts';
import { tutorAudioFor } from '../daily/tutorAudio.ts';
import { dailyItem, DAILY_ITEMS } from '../daily/catalogue.ts';
import { DEVICE_VOICE, RECORDED_AUDIO, TEXT_ONLY } from '../copy/access.ts';
import { missionTopic, scenarioTopic } from '../main/exploreCatalogue.ts';
import { TUTOR_LINES, TUTOR_LINES_VOICE } from '../onboarding/tutorLines.ts';
import type { AudioEnv } from '../main/exploreView.ts';
import { sceneArt } from '../main/exploreArt.ts';
import type { BArtName } from '../art/BArt.tsx';

/** Where a line's sound comes from. `clip` is a bundled daily recording id. */
export type LineSound = { kind: 'clip'; id: string } | { kind: 'opener'; id: string } | { kind: 'device' };

export interface PreviewLine {
  fr: string;
  /** Null where core authors no English for the line. */
  en: string | null;
  sound: LineSound;
}

export interface ScenePreviewModel {
  kind: 'mission' | 'scenario';
  id: string;
  /** "Food and cafés, Starter": the artboard's middot is a comma (copy/punctuation.test.ts). */
  eyebrow: string;
  titleEn: string;
  titleFr: string;
  minutes: number;
  /**
   * The band's canvas drawing (2026-10-20 UI-008, artboard B-ScenePreview):
   * the scene's topic drawing where the canvas has one, else the café table.
   */
  art: BArtName;
  /** What you'll practise. */
  practise: string;
  /** Null when nothing authored can fill it: the section hides rather than invent a line. */
  opener: { heading: string; line: PreviewLine } | null;
  lines: PreviewLine[];
  /**
   * The free practice door, or null rather than open an empty sitting. Both
   * targets are local practice that uses no speaking time. `label` says how
   * much it covers, and `covers` is the French of the lines it practises.
   */
  practice: ({ screen: 'DailyPractice'; params: { id: string } } | { screen: 'Drill'; params: { node: { id: string; title: string; phraseKeys: string[] } } }) & { label: string; covers: string[] } | null;
}

export const PREVIEW_COPY = {
  practiseHeading: 'What you’ll practise',
  youCould: 'You could start with',
  /** A mission has no authored opening of its own; its first reference line is offered as a line, not as the start. */
  oneLine: 'One line you could use',
  linesHeading: 'Lines you’ll likely need',
  linesSub: 'Hear each one, then practise them below.',
  liveChip: 'Live with your tutor',
  practiseFirst: 'Practise these lines first, free',
  practiseFirstLine: 'Practise the first line, free',
  footnote: 'The live conversation uses speaking time. Practising the lines does not.',
  missingTitle: 'This scene is not here',
  missingBody: 'This version of Luvani does not have that scene. You can pick another one in Explore.',
  missingAction: 'Back to Explore',
} as const;

export const startLabel = (tutorName: string): string => `Start with ${tutorName}`;

/**
 * The authored openers bundled on the device, by mission id. Only these may
 * fill the tutor's line. The premier café's barista (core's tutorRole: Karim,
 * the barista) asks the onboarding exchange's first question. The live scene
 * picks its opening among three variants server-side (brain's
 * MISSION_OPENING_DECKS), so the heading says "might say", never "will start
 * with" (B1 learning-science review, 2026-10-20).
 */
const AUTHORED_OPENERS: Readonly<Record<string, { who: string; line: { id: string; fr: string; en: string } }>> = {
  'mission:premier-cafe': { who: 'The barista', line: TUTOR_LINES.question },
};

export function hasAuthoredOpener(id: string): boolean {
  return Object.hasOwn(AUTHORED_OPENERS, id);
}

/** Stage words, never CEFR. A daily tier is a pitch, said as a stage. */
export function stageOf(source: { kind: 'mission'; cefr: 'A0' | 'A1' } | { kind: 'scenario'; tier: 1 | 2 | 3 }): string {
  // 2026-10-20, B4 review: a mission names its stage (Starter, Basics, as on
  // Journey and Speak). A daily scene's tier 1 keeps Explore's difficulty
  // label, "Starting out", which is a pitch and not a stage.
  // 2026-10-21, learning-science review: a daily tier says a stage word too
  // (Starter, Everyday, Chatting); "Starting out" belongs only to Explore's filter.
  if (source.kind === 'mission') return source.cefr === 'A0' ? 'Starter' : 'Basics';
  return source.tier === 1 ? 'Starter' : source.tier === 2 ? 'Everyday' : 'Chatting';
}

/** The label a hear control says, as `missions/preview.ts` labels sources. */
export function soundLabel(sound: LineSound, recorded: boolean, deviceFrench: boolean): string {
  if (sound.kind !== 'device' && recorded) return RECORDED_AUDIO;
  return deviceFrench ? DEVICE_VOICE : TEXT_ONLY;
}

const key = (fr: string) => fr.normalize('NFC').toLocaleLowerCase('fr').replace(/[.!?\s]+$/g, '').trim();

function scenarioModel(s: DailyScenario, env: AudioEnv): ScenePreviewModel {
  const lines = s.lines.slice(0, 3).map((line, index): PreviewLine => {
    const id = `phrase:${s.id}:${index}`;
    return { fr: line.fr, en: line.en, sound: tutorAudioFor(env.audio, id, env.voice) !== undefined ? { kind: 'clip', id } : { kind: 'device' } };
  });
  // DailyPractice plays one item. Only the first line is offered, and the
  // label says so: a scene's later lines are rarely daily items of their own.
  const firstId = `phrase:${s.id}:0`;
  const practice = dailyItem(firstId) !== undefined && s.lines[0] !== undefined
    ? { screen: 'DailyPractice' as const, params: { id: firstId }, label: PREVIEW_COPY.practiseFirstLine, covers: [s.lines[0].fr] }
    : null;
  return {
    kind: 'scenario',
    id: s.id,
    eyebrow: `${scenarioTopic(s).title}, ${stageOf({ kind: 'scenario', tier: s.tier })}`,
    titleEn: s.titleEn,
    titleFr: s.titleFr,
    minutes: estimateMinutes({ kind: 'scenario', lines: s.lines.length }),
    art: sceneArt(scenarioTopic(s)?.key),
    practise: s.bodyEn,
    opener: { heading: PREVIEW_COPY.youCould, line: { fr: s.openingFr, en: s.openingEn, sound: { kind: 'device' } } },
    lines,
    practice,
  };
}

function missionModel(m: Mission, env: AudioEnv): ScenePreviewModel {
  const authored = AUTHORED_OPENERS[m.id];
  // A reference phrase may be the same French as a voiced daily phrase (the
  // premier café's three lines are the first-coffee scene's); then its clip is
  // that recording, matched on the exact words, never on a topic.
  const voiced = (fr: string) => DAILY_ITEMS.find((item) => key(item.fr) === key(fr) && tutorAudioFor(env.audio, item.id, env.voice) !== undefined);
  const lines = m.referencePhrases.slice(0, 3).map((fr): PreviewLine => {
    const item = voiced(fr);
    return { fr, en: item?.en ?? null, sound: item ? { kind: 'clip', id: item.id } : { kind: 'device' } };
  });
  // The drill plays exactly the shown lines, from the mission's own phrase
  // keys: local practice with no speaking time.
  const shown = m.referencePhrases.slice(0, 3).filter((fr) => m.phraseKeys.includes(phraseKeyOf(fr)));
  const opener = authored
    ? { heading: `${authored.who} might say`, line: { fr: authored.line.fr, en: authored.line.en, sound: env.voice === TUTOR_LINES_VOICE ? { kind: 'opener', id: authored.line.id } as const : { kind: 'device' } as const } }
    : lines[0] !== undefined ? { heading: PREVIEW_COPY.oneLine, line: lines[0] } : null;
  return {
    kind: 'mission',
    id: m.id,
    eyebrow: [missionTopic(m)?.title, stageOf({ kind: 'mission', cefr: m.cefr })].filter(Boolean).join(', '),
    titleEn: m.titleEn,
    titleFr: m.title,
    minutes: missionMinutes(m),
    art: sceneArt(missionTopic(m)?.key),
    practise: `Practise how to ${m.canDoEn.length ? m.canDoEn[0]!.toLocaleLowerCase('en') + m.canDoEn.slice(1) : m.goalEn}`,
    opener,
    lines,
    practice: shown.length > 0
      ? {
          screen: 'Drill',
          params: { node: { id: m.id, title: m.titleEn, phraseKeys: shown.map(phraseKeyOf) } },
          label: shown.length === lines.length ? PREVIEW_COPY.practiseFirst : PREVIEW_COPY.practiseFirstLine,
          covers: shown,
        }
      : null,
  };
}

/** The preview for a mission or daily scene id, or null for an id this build does not know. */
export function scenePreview(id: unknown, env: AudioEnv): ScenePreviewModel | null {
  if (typeof id !== 'string') return null;
  const mission = MISSIONS.find((m) => m.id === id);
  if (mission) return missionModel(mission, env);
  const scenario = DAILY_SCENARIOS.find((s) => s.id === id);
  return scenario ? scenarioModel(scenario, env) : null;
}
