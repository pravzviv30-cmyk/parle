/**
 * The live room's decisions, apart from drawing them (2026-10-21 UI-008,
 * artboards B-Live and B-LiveHelp). Pure, so every rule here has a test and
 * the room's .tsx keeps only layout.
 *
 *   - the top pill: the scene's own pace, never the allowance, never a countdown;
 *   - the goals strip: done, current (the first goal not yet reached), to do;
 *   - the help ladder: Hint, Choices, Line given, in words, over the live rung;
 *   - the two bubbles: the tutor's last line and what the learner is saying.
 *
 * Presentation only: nothing here changes what the tutor does or how the rung
 * moves. It reads the rung the session already published.
 */

import type { TurnLine } from './turns.ts';

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

/**
 * The two bubbles under the orb: the tutor's last line, and the learner's
 * words since then (the live partial first, else their last line after it).
 */
export function liveBubbles(turns: readonly TurnLine[], partial: string | null | undefined): { tutor: TurnLine | null; you: string | null } {
  const tutor = lastTutorLine(turns);
  const heard = partial?.trim() ? partial.trim() : null;
  if (heard !== null) return { tutor, you: heard };
  const after = tutor === null ? turns : turns.slice(turns.indexOf(tutor) + 1);
  const learner = [...after].reverse().find((turn) => turn.who === 'learner') ?? null;
  return { tutor, you: learner?.fr ?? null };
}

export const QUIET_VOICE_COPY = {
  label: 'Quiet voice',
  hint: 'Speak softly, close to your phone',
} as const;

/**
 * The Quiet voice switch beside "Show transcript". It is about the learner's
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

/**
 * The one line under the controls. The typing note speaks while the box is
 * open; Quiet voice only while the learner is speaking, so the two never
 * compete, and the typing note wins if they ever would.
 */
export function roomNote(typing: boolean, startedWithSpeech: boolean, tutorName: string, quietVoice: boolean): string | null {
  const typed = typingNote(typing, startedWithSpeech, tutorName);
  if (typed !== null) return typed;
  return quietVoice ? quietVoiceNote(tutorName) : null;
}
