/**
 * Turn what the session loop did into a SessionRecord the session eval can score.
 *
 * Used twice, so a replayed session and a recorded one are built the same way:
 * `npm run chat -- --record` feeds it every input the developer typed, and
 * replayEval.ts feeds it every input it re-runs against a model.
 *
 * Pure. Nothing here reads a clock, a file or the terminal, so it is tested
 * without any of them. Only `writeDevRecord` touches the disk, and it only
 * writes what `toSessionRecord` built.
 *
 * What is recorded is the dev's own practice, source 'dev', and nothing else.
 * sessionRecord.ts refuses any other source.
 *
 * ## How the beat counters work
 *
 * The record needs three facts the engine does not hand back as a number:
 *
 *   rescueIndex  1 for the first silence or aide-moi rescue in a beat, 2 for the
 *                second. It starts again at 0 when the beat changes, and a
 *                spoken turn is not a rescue, so it is 0 there.
 *   attempted    the learner has already spoken in this beat, counting the line
 *                this very turn answers. A silence before any spoken line is not
 *                an attempt.
 *   card         what the learner's support card showed. A 'hint' card shows
 *                only the English intent, so `fr` still carries the line the
 *                tutor must not say, taken from the support material the last
 *                turn left behind.
 *
 * The beat is the one the engine was on when the input arrived
 * (`ConversationState.currentBeat`). When it differs from the previous turn's,
 * the counters start again.
 *
 * `safetyStep` is set when the session loop answered a spoken line with the
 * safety layer's fixed message (safety.ts `safetyDecision`) instead of asking the
 * brain, as the live tutor does before any brain call.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { APERO_FRAME, CAFE_FRAME, MISSION_FRAMES, type LearnerTurnInput, type ScenarioFrame, type SupportView, type TurnView } from '@luvani/brain';

import { SESSION_RECORD_VERSION, type SessionMode, type SessionRecord, type SessionTurn, type SupportCard, type TutorLines } from './sessionRecord.ts';

/** Where `--record` with no path writes, under the playground and out of git. */
export const DEV_SESSIONS_DIR = fileURLToPath(new URL('../../sessions/', import.meta.url));

export interface DevRecorder {
  id: string;
  scene: string;
  mode: SessionMode;
  cefr: string;
  turns: SessionTurn[];
  /** The beat the previous turn was in, or null before the first. */
  beat: string | null;
  /** Rescues so far in `beat`. */
  rescues: number;
  /** The learner has spoken in `beat`. */
  attempted: boolean;
}

export function newRecorder(init: { id: string; scene: string; mode: SessionMode; cefr: string }): DevRecorder {
  return { ...init, turns: [], beat: null, rescues: 0, attempted: false };
}

/** What the loop saw for one input. `tutor` is null when the model turn failed. */
export interface TurnObservation {
  /** `ConversationState.currentBeat` when the input arrived. */
  beat: string;
  input: LearnerTurnInput;
  /** The rung the tutor spoke at: the ladder after any silence or help moved it. */
  rung: 1 | 2 | 3 | 4;
  /** The support view applyNonSpokenInput returned, or null for a spoken input. */
  support: SupportView | null;
  /** The French of the line the card is about: `state.lastSupport.fullLine.fr`. */
  targetFr: string;
  /** `RescueView.rescued`, or false for a spoken input. */
  rescued: boolean;
  tutor: TutorLines | null;
  replyWaitMs?: number;
  /** The tutor answered a safety decision with its fixed message, not the brain. */
  safetyStep?: boolean;
}

/**
 * Is this rescue the quiet one: nothing is said, and no model call is made?
 *
 * Copied from the live tutor, services/tutor-agent/src/convo.ts `rescue()`:
 *
 *   const firstOnThisExchange = this.state.assistanceDepth === 0;   // before the rescue is applied
 *   const shownSomething = support !== null &&
 *     (support.kind === 'hint' ? support.hint.trim().length > 0 : support.kind !== 'none');
 *   if (firstOnThisExchange && shownSomething) return;               // no brain turn
 *
 * PEDAGOGY.md: the first free-conversation rescue is quiet. The record of such a
 * turn has empty tutor lines, the hint card, and no replyWaitMs.
 */
export function isQuietRescue(assistanceDepthBefore: number, support: SupportView): boolean {
  const shownSomething = support.kind === 'hint' ? support.hint.trim().length > 0 : support.kind !== 'none';
  return assistanceDepthBefore === 0 && shownSomething;
}

/** The tutor lines of a quiet rescue: nothing was said. */
export const SILENT_TUTOR: TutorLines = { sceneReply: '', coachLine: null, narration: null };

/** The tutor lines of a safety step: the fixed policy message, in the scene's place. */
export function safetyTutor(message: string): TutorLines {
  return { sceneReply: message, coachLine: null, narration: null };
}

/** SupportView as the record's card. 'none' is no card. */
export function cardFromSupport(support: SupportView | null, targetFr: string): SupportCard | null {
  if (support === null) return null;
  switch (support.kind) {
    case 'none':
      return null;
    case 'hint':
      return { fr: targetFr, en: support.hint, kind: 'hint' };
    case 'full-line':
      return { fr: support.line, en: support.gloss, kind: 'full-line' };
    case 'options':
      // The loop never produces this today. Joined so a tutor line that reads
      // any option out is still caught by the read-back run.
      return { fr: support.options.map((o) => o.text).join(' / '), en: support.options.map((o) => o.en).join(' / '), kind: 'options' };
  }
}

/** The tutor's words out of the view the brain returned. */
export function tutorLinesFromView(view: TurnView): TutorLines {
  return { sceneReply: view.sceneReply.fr, coachLine: view.coachLine, narration: view.narration?.fr ?? null };
}

/**
 * Fold one input into the recorder. A failed model turn (`tutor` null) moves the
 * beat counters, because the learner really did go quiet or ask for help, but
 * adds no turn: there is no tutor line to score.
 */
export function recordTurn(recorder: DevRecorder, observation: TurnObservation): DevRecorder {
  const sameBeat = recorder.beat === observation.beat;
  const rescuesBefore = sameBeat ? recorder.rescues : 0;
  const attemptedBefore = sameBeat ? recorder.attempted : false;

  const spoke = observation.input.type === 'spoke';
  const rescued = !spoke && observation.rescued;
  const rescues = rescued ? rescuesBefore + 1 : rescuesBefore;
  // A line the safety layer answered was not an attempt at the scene.
  const attempted = attemptedBefore || (spoke && observation.safetyStep !== true);

  const next: DevRecorder = { ...recorder, beat: observation.beat, rescues, attempted };
  if (observation.tutor === null) return next;

  const turn: SessionTurn = {
    n: recorder.turns.length + 1,
    input: observation.input,
    rung: observation.rung,
    card: cardFromSupport(observation.support, observation.targetFr),
    rescued,
    rescueIndex: rescued ? rescues : 0,
    attempted,
    tutor: observation.tutor,
    ...(observation.safetyStep === true ? { safetyStep: true } : {}),
    ...(observation.replyWaitMs === undefined ? {} : { replyWaitMs: Math.max(0, Math.round(observation.replyWaitMs)) }),
  };
  return { ...next, turns: [...recorder.turns, turn] };
}

/** The finished record. Needs at least one recorded turn, as the parser does. */
export function toSessionRecord(recorder: DevRecorder): SessionRecord {
  if (recorder.turns.length === 0) throw new Error('nothing to record: the session has no tutor turns');
  return {
    version: SESSION_RECORD_VERSION,
    id: recorder.id,
    source: 'dev',
    mode: recorder.mode,
    scene: recorder.scene,
    cefr: recorder.cefr,
    turns: recorder.turns,
  };
}

/**
 * The scene id a frame is recorded under, and the same ids replayEval.ts maps
 * back to a frame: the two hand-written frames, a mission frame by its mission
 * id, and otherwise a slug of the title (which a replay does not know, and says so).
 */
export function sceneIdFor(frame: ScenarioFrame): string {
  if (frame === CAFE_FRAME) return 'cafe-order';
  if (frame === APERO_FRAME) return 'apero-friends';
  const mission = Object.entries(MISSION_FRAMES).find(([, candidate]) => candidate === frame);
  if (mission !== undefined) return mission[0];
  const slug = frame.titleEn
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'built-scene' : slug;
}

/**
 * The mode a frame is recorded under: `mission` for a mission frame, else
 * `conversation`. Same order as sceneIdFor: MISSION_FRAMES reuses CAFE_FRAME
 * (mission:cafe) and APERO_FRAME (mission:amis), but those two are recorded as
 * the hand-written scenes cafe-order and apero-friends, so they are conversations.
 *
 * The playground has no lesson path, so chat never writes `lesson`; a lesson
 * record is written by hand or by a future lesson recorder.
 */
export function modeFor(frame: ScenarioFrame): SessionMode {
  if (frame === CAFE_FRAME || frame === APERO_FRAME) return 'conversation';
  return Object.values(MISSION_FRAMES).some((candidate) => candidate === frame) ? 'mission' : 'conversation';
}

/** `2026-10-23T14:05:09.123Z` as `20261023-140509`, safe in a file name. */
export function timestampSlug(now: Date): string {
  return now.toISOString().replace(/\.\d+Z$/, '').replace(/[-:]/g, '').replace('T', '-');
}

/**
 * Where a session's record goes. `requested` is the `--record` value: a path, or
 * null for the default folder. The first session in a run uses it as given; a
 * later one (a scene reset inside the same run) gets `-2`, `-3` before the
 * extension, so a run never overwrites its own earlier record.
 */
export function recordPathFor(requested: string | null, now: Date, ordinal: number): string {
  const base = requested ?? path.join(DEV_SESSIONS_DIR, `dev-${timestampSlug(now)}.json`);
  if (ordinal <= 1) return base;
  const ext = path.extname(base);
  return `${base.slice(0, base.length - ext.length)}-${ordinal}${ext}`;
}

/** The `--record` flag. `undefined` means not recording, null means the default path. */
export function parseRecordFlag(args: readonly string[]): string | null | undefined {
  const at = args.indexOf('--record');
  if (at === -1) return undefined;
  const value = args[at + 1];
  return value === undefined || value.startsWith('--') ? null : value;
}

export function writeDevRecord(file: string, record: SessionRecord): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
}
