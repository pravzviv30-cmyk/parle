import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { canResumeSpeaking, createTranscriptScrollController, latestSentMessageId, liveRoomControlsVisible, nearTranscriptEnd, transcriptGrowthAction, tutorFocusOffset } from './c2TranscriptPolicy.ts';

test('incoming messages follow a pinned thread but never pull a reader back down', () => {
  let pinned = nearTranscriptEnd(1000, 400, 600);
  assert.equal(transcriptGrowthAction(pinned, true), 'follow');
  pinned = nearTranscriptEnd(1000, 400, 250);
  assert.equal(transcriptGrowthAction(pinned, true), 'notify');
  assert.equal(transcriptGrowthAction(pinned, false), 'stay');
  pinned = nearTranscriptEnd(1200, 400, 800);
  assert.equal(transcriptGrowthAction(pinned, true), 'follow');
});

test('keyboard focus keeps the last tutor message whole above a shorter viewport', () => {
  const bubble = { y: 620, height: 150 };
  const offset = tutorFocusOffset(bubble, 195, 900);
  assert.ok(bubble.y >= offset);
  assert.ok(bubble.y + bubble.height <= offset + 195);
  assert.equal(tutorFocusOffset(undefined, 195, 900), 705);
  // Oversized accessible text starts at the bubble top and remains scrollable.
  assert.equal(tutorFocusOffset({ y: 400, height: 400 }, 195, 900), 400);
});

test('focus or an open native keyboard hides mode and end controls', () => {
  assert.equal(liveRoomControlsVisible(true, false), false);
  assert.equal(liveRoomControlsVisible(false, true), false);
  assert.equal(liveRoomControlsVisible(false, false), true);
});

test('a cold text grant cannot enable Speaking without a server speech pipeline', () => {
  // F903: a typed start's Speak is live now; it rebuilds the session as voice
  // (live/switchToVoice.ts) rather than opening a mic the grant has no pipeline for.
  assert.equal(canResumeSpeaking(false, true, false), true);
  assert.equal(canResumeSpeaking(true, true, false), true);
  assert.equal(canResumeSpeaking(true, false, false), false);
  assert.equal(canResumeSpeaking(true, true, true), false);
});
test('the compact mode switch exposes its selected state and retains the rounded web input focus ring', () => {
  const room = readFileSync(new URL('./C2LiveRoom.tsx', import.meta.url), 'utf8');
  // 2026-10-21 UI-008, artboards B-Live and B-LiveHelp: the mode switch is the Type (or Speak) side control.
  assert.match(room, /accessibilityLabel="Speak instead"[\s\S]*?disabled=\{speakDisabled\} onPress=\{\(\) => onModeChange\(false\)\}/);
  assert.match(room, /accessibilityLabel="Type instead"[\s\S]*?disabled=\{!ready \|\| modePending\} onPress=\{\(\) => onModeChange\(true\)\}/);
  assert.match(room, /outlineStyle: 'solid' as const, outlineWidth: 0/);
  assert.match(room, /focused && <View \{\.\.\.decorative\} pointerEvents="none" style=\{\[StyleSheet\.absoluteFill, st\.composerFocus\]\}/);
});
test('hidden transcript history stays mounted but is removed from web and native accessibility navigation', () => {
  // UI-014, direction D: the room's notebook is never unmounted; `transcriptVisible = false`
  // is its newest-only mode, so its history and scroll controller survive.
  const room = readFileSync(new URL('./C2LiveRoom.tsx', import.meta.url), 'utf8');
  const notebook = readFileSync(new URL('./NotebookParts.tsx', import.meta.url), 'utf8');
  assert.match(room, /<NotebookSheet turns=\{turns\}[^>]*transcriptVisible=\{transcriptVisible\}/);
  assert.doesNotMatch(room, /transcriptVisible && <NotebookSheet/, 'hiding must retain the notebook and its scroll controller');
  assert.match(notebook, /notebookLines\(turns, partialTranscript, transcriptVisible \? 'all' : 'newest'\)/);
  assert.match(notebook, /createTranscriptScrollController\(/);
  for (const path of ['./LiveErrorView.tsx']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /accessibilityElementsHidden=\{!transcriptVisible\} aria-hidden=\{!transcriptVisible\}/);
    assert.match(source, /importantForAccessibility=\{transcriptVisible \? 'auto' : 'no-hide-descendants'\}/);
    assert.match(source, /aria-expanded=\{transcriptVisible\}/);
    assert.doesNotMatch(source, /transcriptVisible && <Transcript/, 'hiding must retain the thread and its scroll controller');
  }
});

function scrollHarness() {
  const calls: ({ y: number; animated: boolean } | { end: true; animated: boolean })[] = [];
  const notifications: boolean[] = [];
  let dismissed = 0;
  const callbacks = createTranscriptScrollController({
    scrollTo: options => calls.push(options),
    scrollToEnd: options => calls.push({ end: true, ...options }),
    showNewLines: visible => notifications.push(visible),
    reduced: () => false,
    dismissKeyboard: () => { dismissed++; },
    now: () => 1000,
  });
  const layout = (height: number) => callbacks.onLayout({ nativeEvent: { layout: { height } } });
  return { callbacks, calls, notifications, layout, dismissed: () => dismissed };
}

test('production callbacks retain the tutor anchor through every native keyboard layout', () => {
  const { callbacks, calls, layout } = scrollHarness();
  callbacks.receivedTurn('learner-after-tutor');
  callbacks.onContentSizeChange(342, 1000);
  callbacks.onBubbleLayout('tutor-last', { y: 600, height: 150 });
  layout(400);
  calls.length = 0;
  callbacks.focus('tutor-last');
  layout(300);
  layout(200);
  assert.deepEqual(calls, [
    { y: 350, animated: false },
    { y: 450, animated: false },
    { y: 550, animated: false },
  ]);
  const final = calls.at(-1)!;
  assert.ok('y' in final && final.y <= 600 && final.y + 200 >= 750,
    'the complete last tutor message remains above the composer even when a learner turn follows it');
});

test('dragging cancels the focus anchor before keyboard dismissal can resize the thread', () => {
  const { callbacks, calls, notifications, layout, dismissed } = scrollHarness();
  callbacks.onContentSizeChange(342, 1000);
  callbacks.onBubbleLayout('tutor', { y: 600, height: 150 });
  layout(400); callbacks.focus('tutor'); calls.length = 0;
  callbacks.onScrollBeginDrag();
  layout(300);
  callbacks.onScroll({ nativeEvent: { contentOffset: { y: 100 }, contentSize: { height: 1000 }, layoutMeasurement: { height: 300 } } });
  callbacks.onContentSizeChange(342, 1100);
  assert.equal(dismissed(), 1);
  assert.deepEqual(calls, [], 'a reader is never pulled down during the keyboard resize');
  assert.equal(notifications.at(-1), true);
});

test('a web wheel against the latest-message end stop retains auto-follow until the thread actually moves', () => {
  const { callbacks, calls, notifications, layout, dismissed } = scrollHarness();
  callbacks.onContentSizeChange(342, 1000);
  layout(400);
  callbacks.onScroll({ nativeEvent: { contentOffset: { y: 600 }, contentSize: { height: 1000 }, layoutMeasurement: { height: 400 } } });
  calls.length = 0;
  callbacks.onWebScrollIntent();
  // A downward wheel at the physical end produces no scroll event.
  layout(300);
  assert.deepEqual(calls, [], 'keyboard/control relayout must not race a pending reader gesture');
  callbacks.receivedTurn('new-message');
  callbacks.onContentSizeChange(342, 1100);
  assert.equal(dismissed(), 1);
  assert.deepEqual(calls, [{ end: true, animated: true }]);
  assert.notEqual(notifications.at(-1), true, 'an unmoved reader should not get a new-message jump control');
});

test('a web wheel that actually scrolls to older messages stops following and only notifies', () => {
  const { callbacks, calls, notifications, layout } = scrollHarness();
  callbacks.onContentSizeChange(342, 1000);
  layout(400);
  callbacks.onScroll({ nativeEvent: { contentOffset: { y: 600 }, contentSize: { height: 1000 }, layoutMeasurement: { height: 400 } } });
  calls.length = 0;
  callbacks.onWebScrollIntent();
  layout(300);
  callbacks.onContentSizeChange(342, 1020);
  assert.deepEqual(calls, [], 'focus dismissal geometry must not pull the reader before their actual scroll arrives');
  callbacks.onScroll({ nativeEvent: { contentOffset: { y: 250 }, contentSize: { height: 1000 }, layoutMeasurement: { height: 400 } } });
  callbacks.receivedTurn('new-message');
  callbacks.onContentSizeChange(342, 1100);
  assert.deepEqual(calls, []);
  assert.equal(notifications.at(-1), true);
});

test('dismiss/send and received new turns release the keyboard anchor for ordinary following', () => {
  const { callbacks, calls, layout } = scrollHarness();
  callbacks.receivedTurn('old');
  callbacks.onContentSizeChange(342, 1000);
  callbacks.onBubbleLayout('tutor', { y: 600, height: 150 });
  layout(400); callbacks.focus('tutor'); calls.length = 0;
  callbacks.cancelFocus();
  layout(300);
  assert.deepEqual(calls, [{ end: true, animated: false }]);
  callbacks.focus('tutor'); calls.length = 0;
  callbacks.receivedTurn('new');
  callbacks.onContentSizeChange(342, 1100);
  assert.deepEqual(calls, [{ end: true, animated: true }]);
});

test('composer focus reveals the latest sent learner message through every keyboard layout', () => {
  const transcript = readFileSync(new URL('../tutor/Transcript.tsx', import.meta.url), 'utf8');
  const from = transcript.indexOf('  useLayoutEffect(() => {\n    if (!focusActive)');
  const end = transcript.indexOf('\n  }, [scroll, focusRevision, focusActive]);', from);
  assert.ok(from > 0 && end > from, 'exercise the production transcript focus effect');
  const effect = transcript.slice(from + '  useLayoutEffect(() => {'.length, end);
  const { callbacks, calls, layout } = scrollHarness();
  callbacks.receivedTurn('tutor-after-user');
  callbacks.onContentSizeChange(342, 1200);
  callbacks.onBubbleLayout('user-latest', { y: 650, height: 140 });
  callbacks.onBubbleLayout('tutor-after-user', { y: 850, height: 180 });
  layout(400); calls.length = 0;
  new Function('scroll', 'focusActive', 'focusRevision', 'focusMessageId', 'lastTutorId', effect)(callbacks, true, 1, 'user-latest', 'tutor-after-user');
  layout(300); layout(200);
  assert.deepEqual(calls, [{ y: 390, animated: false }, { y: 490, animated: false }, { y: 590, animated: false }]);
});

test('focus chooses the latest sent learner message and falls back to a tutor only before the learner has sent one', () => {
  const turns = [
    { id: 'tutor-opening', who: 'tutor' as const },
    { id: 'user-older', who: 'learner' as const },
    { id: 'user-latest', who: 'learner' as const },
    { id: 'narration', who: 'narration' as const },
    { id: 'tutor-after-user', who: 'tutor' as const },
  ];
  assert.equal(latestSentMessageId(turns), 'user-latest');
  assert.equal(latestSentMessageId(turns.filter(turn => turn.who !== 'learner')), 'tutor-after-user');
  assert.equal(latestSentMessageId([{ id: 'narration', who: 'narration' }]), undefined);
  assert.equal(latestSentMessageId([]), undefined);
  const transcript = readFileSync(new URL('../tutor/Transcript.tsx', import.meta.url), 'utf8');
  const selection = transcript.match(/const focusMessageId = ([^;]+);/)?.[1];
  assert.ok(selection, 'the actual transcript must select from sent turns, independently of tutor replay');
  assert.equal(new Function('latestSentMessageId', 'turns', `return ${selection};`)(latestSentMessageId, turns), 'user-latest');
});

test('a late measured sent bubble and oversized learner text retain their keyboard focus target', () => {
  const { callbacks, calls, layout } = scrollHarness();
  callbacks.onContentSizeChange(342, 1200); layout(300);
  callbacks.focus('user-latest', 1); calls.length = 0;
  callbacks.onBubbleLayout('user-latest', { y: 650, height: 140 });
  layout(200);
  assert.deepEqual(calls, [{ y: 490, animated: false }, { y: 590, animated: false }]);
  calls.length = 0;
  callbacks.onBubbleLayout('user-latest', { y: 650, height: 320 });
  layout(180);
  assert.deepEqual(calls, [{ y: 650, animated: false }, { y: 650, animated: false }], 'large text starts at the sent bubble top and remains scrollable');
});

test('repeated keyboard focus signals cannot pull an older-history reader back down', () => {
  const { callbacks, calls, notifications, layout } = scrollHarness();
  callbacks.onContentSizeChange(342, 1200);
  callbacks.onBubbleLayout('user-latest', { y: 650, height: 140 });
  layout(400); callbacks.focus('user-latest', 1); calls.length = 0;
  callbacks.onScrollBeginDrag();
  callbacks.onScroll({ nativeEvent: { contentOffset: { y: 100 }, contentSize: { height: 1200 }, layoutMeasurement: { height: 400 } } });
  callbacks.focus('user-latest', 1); layout(200);
  assert.deepEqual(calls, [], 'one composer focus may anchor only once after reader takeover');
  callbacks.receivedTurn('new-tutor'); callbacks.onContentSizeChange(342, 1300);
  assert.deepEqual(calls, []); assert.equal(notifications.at(-1), true);
  callbacks.focus('user-latest', 2);
  assert.deepEqual(calls, [{ y: 590, animated: false }], 'a new deliberate composer focus may reveal the latest sent message again');
});
