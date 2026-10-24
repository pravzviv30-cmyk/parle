/**
 * A recorded tutor session, turn by turn, in the shape the session eval scores.
 *
 * Versioned so a later recorder can add fields without old records silently
 * meaning something else. Only two sources exist, and the parser refuses any
 * third: `synthetic` (written by hand for the eval) and `dev` (a developer's
 * own practice). No learner has consented to their transcript being kept or
 * scored, so a `beta` or `prod` record is refused at the door rather than
 * trusted to be filtered later.
 */

import type { LearnerTurnInput } from '@luvani/brain';

export const SESSION_RECORD_VERSION = 2;
export const SESSION_SOURCES = ['synthetic', 'dev'] as const;
export type SessionSource = (typeof SESSION_SOURCES)[number];

/**
 * Which rule book a session is judged by. A scripted `lesson` rescue shows the
 * known target line and the tutor says it for the learner to repeat
 * (services/tutor-agent/src/scriptedSpeech.ts). A `mission` is free
 * conversation (docs/LIVE_VOICE.md "A mission (free conversation)") and so is
 * `conversation`: the first rescue is a quiet English hint, nothing said.
 */
export const SESSION_MODES = ['lesson', 'mission', 'conversation'] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export const CHECK_IDS = ['rescue', 'no-read-back', 'gentle', 'level-fit', 'safety'] as const;
export type CheckId = (typeof CHECK_IDS)[number];

/**
 * What the learner's support card showed. `kind` mirrors SupportView in
 * packages/brain/src/contract/types.ts ('none' is a null card here). `fr` is the
 * learner's target line even when the card hides it: a 'hint' card shows only
 * `en`, the English intent, and `fr` is what the tutor must still not say.
 */
export interface SupportCard {
  fr: string;
  en?: string;
  kind: 'hint' | 'full-line' | 'options';
}

export interface TutorLines {
  sceneReply: string;
  coachLine?: string | null;
  narration?: string | null;
}

export interface SessionTurn {
  n: number;
  input: LearnerTurnInput;
  rung: 1 | 2 | 3 | 4;
  card: SupportCard | null;
  rescued: boolean;
  /** 0 is not a rescue, 1 the first rescue in this beat, 2 the second, and so on. */
  rescueIndex: number;
  /** The learner had already spoken in this beat before this tutor line. */
  attempted: boolean;
  tutor: TutorLines;
  /** The tutor stepped out of the scene to answer a safety decision. */
  safetyStep?: boolean;
  replyWaitMs?: number;
  /** Hand labels, synthetic records only. An n/a check is left out. */
  expect?: Partial<Record<CheckId, 'pass' | 'fail'>>;
}

export interface SessionRecord {
  version: 2;
  id: string;
  source: SessionSource;
  mode: SessionMode;
  scene: string;
  cefr: string;
  turns: SessionTurn[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function fail(where: string, why: string): never {
  throw new Error(`session record ${where}: ${why}`);
}

function parseInput(where: string, value: unknown): LearnerTurnInput {
  if (!isObject(value)) fail(where, 'input must be an object');
  if (value.type === 'spoke' && typeof value.text === 'string') return { type: 'spoke', text: value.text };
  if (value.type === 'silence' && typeof value.durationMs === 'number') return { type: 'silence', durationMs: value.durationMs };
  if (value.type === 'help') return { type: 'help' };
  return fail(where, 'input must be spoke{text}, silence{durationMs} or help');
}

function parseCard(where: string, value: unknown): SupportCard | null {
  if (value === null) return null;
  if (!isObject(value) || typeof value.fr !== 'string') fail(where, 'card must be null or have a string fr');
  if (value.kind !== 'hint' && value.kind !== 'full-line' && value.kind !== 'options') {
    fail(where, `card kind must be hint, full-line or options, got ${JSON.stringify(value.kind)}`);
  }
  if (value.en !== undefined && typeof value.en !== 'string') fail(where, 'card en must be a string');
  return { fr: value.fr, kind: value.kind, ...(typeof value.en === 'string' ? { en: value.en } : {}) };
}

const optionalLine = (value: unknown): value is string | null | undefined =>
  value === undefined || value === null || typeof value === 'string';

function parseTurn(id: string, value: unknown, index: number): SessionTurn {
  const where = `${id} turn ${index + 1}`;
  if (!isObject(value)) fail(where, 'turn must be an object');
  if (typeof value.n !== 'number') fail(where, 'n must be a number');
  if (value.rung !== 1 && value.rung !== 2 && value.rung !== 3 && value.rung !== 4) fail(where, 'rung must be 1 to 4');
  if (typeof value.rescued !== 'boolean') fail(where, 'rescued must be a boolean');
  if (typeof value.rescueIndex !== 'number' || value.rescueIndex < 0) fail(where, 'rescueIndex must be 0 or more');
  if (typeof value.attempted !== 'boolean') fail(where, 'attempted must be a boolean');
  const tutor = value.tutor;
  if (!isObject(tutor) || typeof tutor.sceneReply !== 'string') fail(where, 'tutor.sceneReply must be a string');
  if (!optionalLine(tutor.coachLine) || !optionalLine(tutor.narration)) fail(where, 'tutor lines must be strings or null');
  if (value.safetyStep !== undefined && typeof value.safetyStep !== 'boolean') fail(where, 'safetyStep must be a boolean');
  if (value.replyWaitMs !== undefined && typeof value.replyWaitMs !== 'number') fail(where, 'replyWaitMs must be a number');
  let expect: SessionTurn['expect'];
  if (value.expect !== undefined) {
    if (!isObject(value.expect)) fail(where, 'expect must be an object');
    expect = {};
    for (const [check, label] of Object.entries(value.expect)) {
      if (!(CHECK_IDS as readonly string[]).includes(check)) fail(where, `unknown check in expect: ${check}`);
      if (label !== 'pass' && label !== 'fail') fail(where, `expect.${check} must be pass or fail`);
      expect[check as CheckId] = label;
    }
  }
  return {
    n: value.n,
    input: parseInput(where, value.input),
    rung: value.rung,
    card: parseCard(where, value.card),
    rescued: value.rescued,
    rescueIndex: value.rescueIndex,
    attempted: value.attempted,
    tutor: {
      sceneReply: tutor.sceneReply,
      coachLine: (tutor.coachLine as string | null | undefined) ?? null,
      narration: (tutor.narration as string | null | undefined) ?? null,
    },
    ...(value.safetyStep === undefined ? {} : { safetyStep: value.safetyStep }),
    ...(value.replyWaitMs === undefined ? {} : { replyWaitMs: value.replyWaitMs }),
    ...(expect === undefined ? {} : { expect }),
  };
}

/**
 * Parse one record, refusing unknown versions and any source but synthetic or dev.
 *
 * A version 2 record must name its mode. A version 1 record has none and is read
 * as `conversation`, returned as a version 2 record: every v1 record came from
 * `chat --record` (conversation and mission frames only, both of which take the
 * conversation rescue rule) or was written by hand for conversation scenes.
 */
export function parseSessionRecord(json: unknown): SessionRecord {
  if (!isObject(json)) fail('(unnamed)', 'must be a JSON object');
  const id = typeof json.id === 'string' && json.id !== '' ? json.id : fail('(unnamed)', 'id must be a non-empty string');
  if (json.version !== SESSION_RECORD_VERSION && json.version !== 1) {
    fail(id, `unknown version ${JSON.stringify(json.version)}, this eval reads versions 1 and ${SESSION_RECORD_VERSION}`);
  }
  let mode: SessionMode = 'conversation';
  if (json.version === SESSION_RECORD_VERSION) {
    if (!(SESSION_MODES as readonly unknown[]).includes(json.mode)) {
      fail(id, `mode ${JSON.stringify(json.mode)} is not one of ${SESSION_MODES.join(', ')}`);
    }
    mode = json.mode as SessionMode;
  }
  if (!(SESSION_SOURCES as readonly unknown[]).includes(json.source)) {
    fail(
      id,
      `source ${JSON.stringify(json.source)} is refused. Only synthetic or dev records may be scored, because no learner has consented to a transcript being kept.`,
    );
  }
  if (typeof json.scene !== 'string' || typeof json.cefr !== 'string') fail(id, 'scene and cefr must be strings');
  if (!Array.isArray(json.turns) || json.turns.length === 0) fail(id, 'turns must be a non-empty array');
  return {
    version: SESSION_RECORD_VERSION,
    id,
    source: json.source as SessionSource,
    mode,
    scene: json.scene,
    cefr: json.cefr,
    turns: json.turns.map((turn, index) => parseTurn(id, turn, index)),
  };
}
