/** View-only policies for the same live room in speaking and typing modes. */
import type { SessionPrompt } from '@luvani/core';
import type { TurnLine } from './turns.ts';
export const TRANSCRIPT_PIN_DISTANCE = 64;

export function nearTranscriptEnd(contentHeight: number, viewportHeight: number, offset: number): boolean {
  return Math.max(0, contentHeight - viewportHeight - offset) <= TRANSCRIPT_PIN_DISTANCE;
}

/** A confirmed learner message takes focus priority; narration and unsent text do not. */
export function latestSentMessageId(turns: readonly Pick<TurnLine, 'id' | 'who'>[]): string | undefined {
  let tutor: string | undefined;
  for (let index = turns.length - 1; index >= 0; index--) {
    const turn = turns[index]!;
    if (turn.who === 'learner') return turn.id;
    if (tutor === undefined && turn.who === 'tutor') tutor = turn.id;
  }
  return tutor;
}

/** Keep the whole selected bubble above the composer where it can fit. */
export function tutorFocusOffset(tutor: { y: number; height: number } | undefined, viewportHeight: number, contentHeight: number): number {
  const end = Math.max(0, contentHeight - viewportHeight);
  if (!tutor) return end;
  if (tutor.height > viewportHeight) return Math.max(0, Math.min(tutor.y, end));
  return Math.max(0, Math.min(tutor.y + tutor.height - viewportHeight, end));
}

export function transcriptGrowthAction(pinned: boolean, changed: boolean): 'follow' | 'notify' | 'stay' {
  return !changed ? 'stay' : pinned ? 'follow' : 'notify';
}

export function liveRoomControlsVisible(focused: boolean, keyboardOpen: boolean): boolean {
  return !focused && !keyboardOpen;
}

/**
 * Whether Speak is live. A text-only grant has no speech pipeline and opening a
 * mic cannot create one, so in a typed start Speak rebuilds the session as
 * voice after asking (F903, live/switchToVoice.ts); it is live in both.
 */
export function canResumeSpeaking(_startedWithSpeech: boolean, ready: boolean, pending: boolean): boolean {
  return ready && !pending;
}

/** Republished authored prompts retain identity; changed rescue speech does not. */
export function scriptedPromptIdentity(prompt: SessionPrompt): string {
  return `lesson-prompt:${JSON.stringify([prompt.position, prompt.turn.id, prompt.directive.rung,
    prompt.directive.rescued, prompt.turn.tutor, prompt.turn.tutorEn])}`;
}

type ScrollEvent = { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } };

/** Actual ScrollView callbacks, kept independent of native modules for lifecycle QA. */
export function createTranscriptScrollController(edges: {
  scrollTo: (options: { y: number; animated: boolean }) => void;
  scrollToEnd: (options: { animated: boolean }) => void;
  showNewLines: (visible: boolean) => void;
  reduced: () => boolean;
  dismissKeyboard: () => void;
  now?: () => number;
}) {
  let viewport = 0, content = 0, lastOffset = 0, programmaticUntil = 0;
  let pinned = true;
  let pendingWebIntent = false;
  let anchor: { messageId?: string } | null = null;
  let lastFocusRevision: number | undefined;
  let tailId: string | undefined;
  const layouts = new Map<string, { y: number; height: number }>();
  const now = edges.now ?? Date.now;
  const reveal = () => {
    if (anchor === null || viewport <= 0) return;
    const target = tutorFocusOffset(anchor.messageId ? layouts.get(anchor.messageId) : undefined, viewport, content);
    pinned = true; edges.showNewLines(false); lastOffset = target;
    programmaticUntil = now() + 400;
    edges.scrollTo({ y: target, animated: false });
  };
  const follow = (animated: boolean) => {
    programmaticUntil = now() + 400;
    edges.scrollToEnd({ animated });
  };
  return {
    focus(messageId?: string, revision?: number) {
      // Native keyboard signals can repeat after the reader has scrolled up.
      // Only a new composer focus may take the thread back from the reader.
      if (revision !== undefined && revision === lastFocusRevision) return;
      lastFocusRevision = revision;
      pendingWebIntent = false; anchor = { messageId }; reveal();
    },
    cancelFocus() { anchor = null; },
    receivedTurn(id?: string) { if (tailId !== id) { anchor = null; pendingWebIntent = false; } tailId = id; },
    onBubbleLayout(id: string, layout: { y: number; height: number }) {
      layouts.set(id, layout);
      if (anchor?.messageId === id) reveal();
    },
    onLayout(event: { nativeEvent: { layout: { height: number } } }) {
      viewport = event.nativeEvent.layout.height;
      // A keyboard animation can lay out several times. Keep the explicit
      // selected bubble until dismissal, a received turn, or the reader takes over.
      if (anchor !== null) reveal();
      else if (pinned && !pendingWebIntent) follow(false);
    },
    onContentSizeChange(_: number, height: number) {
      const changed = content !== height;
      content = height;
      if (anchor !== null) { reveal(); return; }
      // Dismissing the composer changes the viewport and content geometry
      // before the wheel's actual position arrives. Let the reader's event
      // establish that position; a received new turn ends the pending intent.
      if (pendingWebIntent) return;
      const action = transcriptGrowthAction(pinned, changed);
      if (action === 'follow') follow(!edges.reduced());
      else if (action === 'notify') edges.showNewLines(true);
    },
    onScroll(event: ScrollEvent) {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const readingOlder = contentOffset.y < lastOffset - 1;
      lastOffset = contentOffset.y;
      pendingWebIntent = false;
      if (now() < programmaticUntil && !readingOlder) return;
      if (readingOlder) { programmaticUntil = 0; anchor = null; }
      pinned = nearTranscriptEnd(contentSize.height, layoutMeasurement.height, contentOffset.y);
      if (pinned) edges.showNewLines(false);
    },
    onScrollBeginDrag() { programmaticUntil = 0; anchor = null; pendingWebIntent = false; pinned = false; edges.dismissKeyboard(); },
    // Wheel/touch intent can occur against the end stop without moving the
    // thread. Only the ensuing scroll position decides whether to unpin.
    onWebScrollIntent() { programmaticUntil = 0; anchor = null; pendingWebIntent = true; edges.dismissKeyboard(); },
    jumpLatest() { anchor = null; pendingWebIntent = false; pinned = true; edges.showNewLines(false); follow(!edges.reduced()); },
  };
}
