/**
 * The live room's decisions, apart from drawing them. Pure, so every rule
 * here has a test and the room's .tsx keeps only layout.
 *
 *   - the pace under the title: the scene's own, never a countdown;
 *   - the goal states behind the stamps, the cloud mic's face, the portrait
 *     ring's colour and the room menu's rows (UI-014, direction D);
 *   - the help ladder: Hint, Choices, Line given, in words, over the live rung.
 *
 * Presentation only: nothing here changes what the tutor does or how the rung
 * moves. It reads the rung the session already published.
 */

import type { HeldTurnState } from '@luvani/core';
import type { OrbState } from '../tutor/VoiceOrb.tsx';
import type { TurnLine } from './turns.ts';
import { REPORT_COPY } from '../settings/reportMail.ts';

/** "About N min": the scene's own pace (founder, 2026-10-20). No "left", no clock. */
export function paceLabel(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes <= 0) return null;
  return `About ${Math.max(1, Math.round(minutes))} min`;
}

export type GoalState = 'done' | 'current' | 'todo';

export interface GoalChip {
  id: string;
  label: string;
  state: GoalState;
  /** The goal said with its state, for a screen reader: the marks are decoration. */
  spoken: string;
}

/** Done, current (the first goal not yet reached) and to do, in the scene's order. */
export function goalStrip(items: readonly { id: string; goalEn: string; achieved: boolean }[]): GoalChip[] {
  let current = false;
  return items.map((item) => {
    let state: GoalState = 'done';
    if (!item.achieved) {
      state = current ? 'todo' : 'current';
      current = true;
    }
    const spoken = state === 'done' ? `Done: ${item.goalEn}` : state === 'current' ? `Now: ${item.goalEn}` : `Still to do: ${item.goalEn}`;
    return { id: item.id, label: item.goalEn, state, spoken };
  });
}

/** What the support block is showing: the live rung's content kind. */
export type SupportKind = 'none' | 'hint' | 'options' | 'full-line';

export type LadderStepState = 'given' | 'current' | 'ahead';

export interface LadderStep {
  key: 'hint' | 'options' | 'full-line';
  label: 'Hint' | 'Choices' | 'Line given';
  state: LadderStepState;
}

const LADDER: readonly { key: LadderStep['key']; label: LadderStep['label'] }[] = [
  { key: 'hint', label: 'Hint' },
  { key: 'options', label: 'Choices' },
  { key: 'full-line', label: 'Line given' },
];

/**
 * The ladder in words, over the rung the session is on. Steps below the live
 * one are given, the live one is current, the rest are ahead. With nothing
 * given yet, every step is ahead.
 */
export function helpLadder(kind: SupportKind): LadderStep[] {
  const at = LADDER.findIndex((step) => step.key === kind);
  return LADDER.map((step, index) => ({
    ...step,
    state: at < 0 || index > at ? 'ahead' : index === at ? 'current' : 'given',
  }));
}

/** The ladder as one sentence, for the screen reader. */
export function ladderSpoken(steps: readonly LadderStep[]): string {
  const current = steps.find((step) => step.state === 'current');
  return current ? `Help so far: ${current.label}` : 'No help given yet';
}

/** "More help: show the line" is offered until the line has been given. */
export function moreHelpOffered(kind: SupportKind): boolean {
  return kind !== 'full-line';
}

export const HELP_COPY = {
  title: 'A little help',
  more: 'More help: show the line',
  say: 'Say your choice',
  foot: 'Each ask goes one step further. Saying a choice yourself still moves the scene on.',
  close: 'Close help',
} as const;

/**
 * The quiet line under the room's controls while the typing box is open.
 *
 * Two different facts, so two different lines. A session that started typed
 * has no voice at all, and says so. A spoken session with the box open (the
 * Type control, or Listen only from the start) still has the tutor's voice and
 * a closed microphone, and the learner on a train needs to know both: nobody
 * hears them, and the phone will still talk.
 */
export function typingNote(typing: boolean, startedWithSpeech: boolean, tutorName: string): string | null {
  if (!typing) return null;
  if (!startedWithSpeech) return 'This session started in typing mode.';
  return `Your mic is off. ${tutorName} still speaks out loud.`;
}

/** "{tutor} asked", over the tutor's last line in the help sheet. */
export function askedLabel(tutorName: string): string {
  return `${tutorName} asked`;
}

/** The tutor's last line, or null before the tutor has said anything. */
export function lastTutorLine(turns: readonly TurnLine[]): TurnLine | null {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    if (turns[index]!.who === 'tutor') return turns[index]!;
  }
  return null;
}

export const QUIET_VOICE_COPY = {
  label: 'Quiet voice',
  hint: 'Speak softly, close to your phone',
} as const;

/**
 * The Quiet voice switch in the room menu. It is about the learner's
 * own voice, so it shows only while they are speaking to the tutor: never in
 * Type, and not in Listen only until they switch to Speak.
 */
export function quietVoiceControl(typing: boolean, on: boolean): { label: string; hint: string; checked: boolean } | null {
  if (typing) return null;
  return { label: QUIET_VOICE_COPY.label, hint: QUIET_VOICE_COPY.hint, checked: on };
}

/** What carries in Quiet voice: a soft voice, not a whisper (docs/live-latency-evidence/2026-10-23-quiet-speech.md). */
export function quietVoiceNote(tutorName: string): string {
  return `Speak softly, close to your phone. ${tutorName} can hear a soft voice, but not a whisper.`;
}

export const TAP_TO_SEND_COPY = {
  label: 'Tap to send',
  hint: 'Your turn ends when you tap Send, not when you pause',
  send: 'Send',
  sendSpoken: 'Send what you said',
  /** The Settings row under the same title (settings/SettingsScreen.tsx). */
  settingsSub: 'Take all the time you need. Your turn ends when you tap Send, not when you pause.',
} as const;

/**
 * The Tap to send switch under Quiet voice in the room menu. It changes how a spoken turn
 * ends, so like Quiet voice it shows only while the learner is speaking.
 */
export function tapToSendControl(typing: boolean, on: boolean): { label: string; hint: string; checked: boolean } | null {
  if (typing) return null;
  return { label: TAP_TO_SEND_COPY.label, hint: TAP_TO_SEND_COPY.hint, checked: on };
}

/**
 * The Send button by the mic while Tap to send is on. Held back while the
 * tutor speaks, since there is no turn of the learner's to end, and once the
 * held turn has gone, so a second tap cannot send an empty one.
 */
export function sendButton(heldTurn: HeldTurnState | null, tutorSpeaking: boolean): { label: string; accessibilityLabel: string; disabled: boolean } {
  return { label: TAP_TO_SEND_COPY.send, accessibilityLabel: TAP_TO_SEND_COPY.sendSpoken, disabled: tutorSpeaking || heldTurn === 'sent' };
}

/**
 * What Tap to send says under the controls. Never a count: 'closing' is the
 * agent's ten second note before its cap, and the line says only that the turn
 * is about to go, so a learner who is still finding a word is not hurried.
 */
export function tapToSendNote(heldTurn: HeldTurnState | null): string {
  if (heldTurn === 'closing') return "Sending what you've said in a moment.";
  if (heldTurn === 'open') return "Tap Send when you're done.";
  return "Speak, then tap Send when you're done.";
}

/** About a minute before the cap, echoing the tutor. Words only: no number, no "left". */
export function wrapUpNote(tutorName: string): string {
  return `Nearly time to finish. ${tutorName} will wrap up after this.`;
}

/**
 * The one line under the controls, and only one. In order:
 *   1. the wrap-up note, because it is about the whole session and holds in
 *      Speak and Type alike; every other line is about the next turn;
 *   2. the typing note, while the box is open (Tap to send and Quiet voice
 *      are hidden there, so it never competes with them in practice);
 *   3. the Tap to send line, because it says how this turn ends, and a learner
 *      who does not know to tap Send is left waiting;
 *   4. the Quiet voice line, which is advice and can wait.
 */
export function roomNote(typing: boolean, startedWithSpeech: boolean, tutorName: string, quietVoice: boolean,
  live: { wrappingUp?: boolean; tapToSend?: boolean; heldTurn?: HeldTurnState | null } = {}): string | null {
  if (live.wrappingUp) return wrapUpNote(tutorName);
  const typed = typingNote(typing, startedWithSpeech, tutorName);
  if (typed !== null) return typed;
  if (live.tapToSend) return tapToSendNote(live.heldTurn ?? null);
  return quietVoice ? quietVoiceNote(tutorName) : null;
}

export interface GoalStamp {
  id: string;
  /** The goal's number in the scene, from 1. */
  n: number;
  state: GoalState;
}

/**
 * The goal stamps under the title (UI-014). The marks are numbers; the label
 * beside them is the current goal's short label, else its full sentence. The
 * whole row is one accessible element, and it says the FULL goal, since the
 * short label is for the eye.
 */
export function goalStamps(goals: readonly { id: string; goalEn: string; achieved: boolean; goalShortEn?: string }[]): {
  stamps: GoalStamp[]; currentLabel: string | null; spoken: string;
} {
  if (goals.length === 0) return { stamps: [], currentLabel: null, spoken: '' };
  const chips = goalStrip(goals);
  const stamps = chips.map((chip, index) => ({ id: chip.id, n: index + 1, state: chip.state }));
  const at = chips.findIndex((chip) => chip.state === 'current');
  const done = chips.filter((chip) => chip.state === 'done').length;
  const total = goals.length;
  const noun = total === 1 ? 'goal' : 'goals';
  if (at < 0) return { stamps, currentLabel: null, spoken: `All ${total} ${noun} done.` };
  const current = goals[at]!;
  const sentence = current.goalEn.trim().replace(/[.!?]+$/u, '');
  const said = sentence.charAt(0).toLowerCase() + sentence.slice(1);
  return { stamps, currentLabel: current.goalShortEn ?? current.goalEn, spoken: `${done} of ${total} ${noun} done. Now: ${said}.` };
}

export type CloudExpression = 'paused' | 'listening' | 'tutor' | 'thinking' | 'cheer';

/**
 * The cloud mic's face. Null while typing: the cloud is not drawn then. A goal
 * just reached wins over everything else for its one cheer; then whoever is
 * talking; then the open mic; else it rests. `modePending` dims the cloud but
 * never changes its face.
 */
export function cloudExpression(input: { micOpen: boolean; tutorSpeaking: boolean; thinking: boolean; typing: boolean; goalJustReached: boolean; modePending?: boolean }): CloudExpression | null {
  if (input.typing) return null;
  if (input.goalJustReached) return 'cheer';
  if (input.tutorSpeaking) return 'tutor';
  if (input.thinking) return 'thinking';
  if (input.micOpen) return 'listening';
  return 'paused';
}

export type RingMode = 'tutor' | 'learner' | 'thinking' | 'idle';

/**
 * Who the portrait ring says is talking: sun for the tutor (and while the
 * tutor thinks), mint for the learner's open turn. The session's state decides
 * it. Whether the levels are measured (`inputLive`, `outputLive`) only decides
 * whether the level rings can move, never the colour, and reduced motion is not
 * an input at all, so the colour still says who is talking with motion off.
 */
export function ringMode(input: { state: OrbState; inputLive: boolean; outputLive: boolean }): RingMode {
  switch (input.state) {
    case 'speaking': return 'tutor';
    case 'thinking': return 'thinking';
    case 'listening': return 'learner';
    default: return 'idle';
  }
}

export interface RoomMenuRow {
  kind: 'transcript' | 'quietVoice' | 'tapToSend' | 'report';
  label: string;
  hint?: string;
  checked?: boolean;
  role: 'switch' | 'button';
}

export const ROOM_MENU_COPY = {
  transcript: 'Show every line',
  report: REPORT_COPY.control,
} as const;

/**
 * The room menu (`…`), in order: every line, Quiet voice, Tap to send, report.
 * Quiet voice and Tap to send keep their own rules for when they show (never
 * while typing). Report shows only when the room can take one.
 */
export function roomMenuRows(input: { typing: boolean; transcriptVisible: boolean; quietVoice?: boolean; tapToSend?: boolean; reportable: boolean; reportPending?: boolean }): RoomMenuRow[] {
  const rows: RoomMenuRow[] = [{ kind: 'transcript', label: ROOM_MENU_COPY.transcript, checked: input.transcriptVisible, role: 'switch' }];
  if (input.quietVoice !== undefined) {
    const quiet = quietVoiceControl(input.typing, input.quietVoice);
    if (quiet) rows.push({ kind: 'quietVoice', ...quiet, role: 'switch' });
  }
  if (input.tapToSend !== undefined) {
    const tap = tapToSendControl(input.typing, input.tapToSend);
    if (tap) rows.push({ kind: 'tapToSend', ...tap, role: 'switch' });
  }
  // A saved report says so, in the words the old report disc used.
  if (input.reportable) rows.push({ kind: 'report', label: input.reportPending ? REPORT_COPY.pendingControl : ROOM_MENU_COPY.report, role: 'button' });
  return rows;
}

/**
 * The goals reached since the room first looked (UI-014). Goals already done at
 * first sight are never news, so a rejoined scene does not cheer or announce
 * its history. `firstLook` null means this is the first look: it is taken and
 * nothing is fresh. One rule for the stamp's pop, the once-only announcement
 * and the cloud's cheer, so they can never disagree.
 */
export function freshGoals(firstLook: ReadonlySet<string> | null, goals: readonly { id: string; achieved: boolean }[]): { firstLook: ReadonlySet<string>; fresh: string[] } {
  const done = goals.filter((goal) => goal.achieved).map((goal) => goal.id);
  if (firstLook === null) return { firstLook: new Set(done), fresh: [] };
  return { firstLook, fresh: done.filter((id) => !firstLook.has(id)) };
}

/** How long the cloud keeps its cheering face after a goal: two hops, inside CELEBRATION_MAX_MS. */
export const CHEER_MS = 1600;
