import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createTranscriptScrollController } from './c2TranscriptPolicy.ts';

const transcript = readFileSync(new URL('../tutor/Transcript.tsx', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const webScrollSource = readFileSync(require.resolve('react-native-web/dist/exports/ScrollView/index.js'), 'utf8');
type ScrollEvent = Parameters<ReturnType<typeof createTranscriptScrollController>['onScroll']>[0];

/** Run the installed web ScrollView's real callback, not a reimplementation. */
function installedWebScrollHandler(mode: string, onScroll: (event: ScrollEvent) => void, dismiss: () => void) {
  const from = webScrollSource.indexOf('this._handleScroll = e => {');
  const to = webScrollSource.indexOf('this._setInnerViewRef =', from);
  assert.ok(from >= 0 && to > from, 'the installed web ScrollView handler changed; inspect its keyboard behavior');
  const owner = { props: { keyboardDismissMode: mode, onScroll, scrollEventThrottle: 32 }, scrollResponderHandleScroll: onScroll };
  return new Function('dismissKeyboard', `${webScrollSource.slice(from, to)}\nreturn this._handleScroll;`).call(owner, dismiss) as (event: ScrollEvent) => void;
}

test('compact composer focus survives the installed web ScrollView programmatic anchor scroll', () => {
  const modeExpression = transcript.match(/keyboardDismissMode=\{([^}\n]+)\}/)?.[1];
  assert.ok(modeExpression, 'the transcript must explicitly choose its platform keyboard behavior');
  const mode = new Function('Platform', `return ${modeExpression};`)({ OS: 'web' });
  const nativeMode = new Function('Platform', `return ${modeExpression};`)({ OS: 'ios' });
  assert.equal(nativeMode, 'on-drag', 'native scrolling must retain its keyboard dismissal');

  let focused = true;
  let scrollHandler: (event: ScrollEvent) => void;
  const offsets: number[] = [];
  const scroll = createTranscriptScrollController({
    scrollTo: ({ y }) => { offsets.push(y); scrollHandler({ nativeEvent: {
      contentOffset: { y }, contentSize: { height: 1000 }, layoutMeasurement: { height: 200 },
    } }); },
    scrollToEnd: () => {}, showNewLines: () => {}, reduced: () => false,
    dismissKeyboard: () => { focused = false; }, now: () => 1000,
  });
  scrollHandler = installedWebScrollHandler(mode, scroll.onScroll, () => { focused = false; });
  scroll.receivedTurn('learner-after-tutor');
  scroll.onContentSizeChange(272, 1000);
  scroll.onBubbleLayout('tutor-last', { y: 600, height: 150 });
  scroll.onLayout({ nativeEvent: { layout: { height: 200 } } });
  scroll.focus('tutor-last');
  assert.deepEqual(offsets, [550]);
  assert.equal(focused, true, 'the focus anchor must not blur the composer at compact widths');
  let legacyBlurred = false;
  installedWebScrollHandler('on-drag', () => {}, () => { legacyBlurred = true; })({ nativeEvent: {
    contentOffset: { y: 550 }, contentSize: { height: 1000 }, layoutMeasurement: { height: 200 },
  } });
  assert.equal(legacyBlurred, true, 'the regression must reproduce the installed on-drag behavior that caused the bug');

  // The actual JSX wheel handler still gives the reader the thread and closes
  // the keyboard; a real gesture is distinct from a programmatic scroll.
  const wheelHandler = transcript.match(/onWheel: ([\w.]+)/)?.[1];
  assert.ok(wheelHandler, 'web wheel intent must retain keyboard dismissal');
  new Function('scroll', `return ${wheelHandler};`)(scroll)();
  assert.equal(focused, false, 'a real user scroll still dismisses the keyboard');
  const touchHandler = transcript.match(/onTouchMove=\{Platform.OS === 'web' \? ([\w.]+) : undefined\}/)?.[1];
  assert.equal(touchHandler, wheelHandler,
    'touch scrolling must retain the same actual gesture intent on web');
});

test('keyboard show events retain one deliberate composer focus revision', () => {
  const room = readFileSync(new URL('./C2LiveRoom.tsx', import.meta.url), 'utf8');
  const start = room.indexOf('    const show = Keyboard.addListener(');
  const end = room.indexOf('    const hide = Keyboard.addListener(', start);
  assert.ok(start > 0 && end > start, 'exercise the actual native keyboard show listener');
  let show: (() => void) | undefined, revision = 0, keyboardOpen = false;
  new Function('Keyboard', 'Platform', 'setKeyboardOpen', 'setFocusRevision', room.slice(start, end))({
    addListener: (_event: string, callback: () => void) => { show = callback; return { remove() {} }; },
  }, { OS: 'ios' }, (value: boolean) => { keyboardOpen = value; }, (change: (value: number) => number) => { revision = change(revision); });
  const focus = room.match(/onFocus=\{\(\) => \{([^}]+)\}\}/)?.[1];
  assert.ok(focus, 'the actual composer focus event owns a new reveal request');
  new Function('setFocused', 'setHelpOpen', 'setFocusRevision', focus)(() => {}, () => {}, (change: (value: number) => number) => { revision = change(revision); });
  assert.equal(revision, 1);
  assert.ok(show); show(); show();
  assert.equal(keyboardOpen, true, 'keyboard appearance still hides the mode/end controls');
  assert.equal(revision, 1, 'repeated keyboard signals must not override the reader after one focus gesture');
});
