import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('nested native screens measure their actual window origin before avoiding the keyboard', () => {
  const frame = read('../layout.tsx');
  assert.match(frame, /keyboardFrame\.current\?\.measureInWindow\(\(_x, y\) =>/);
  assert.match(frame, /Number\.isFinite\(y\)/);
  assert.match(frame, /keyboardVerticalOffset=\{keyboardOffset\}/);
  assert.doesNotMatch(frame, /keyboardVerticalOffset=\{(?:44|64|88)\}/);
});

test('changing a My French view returns to its header without remounting the learning store', () => {
  const library = read('../tabs/MyFrenchLibraryTab.tsx');
  const shared = read('./MainUI.tsx');
  assert.match(library, /scrollRef=\{scroll\}/);
  assert.match(library, /useEffect\(\(\) => \{ scroll\.current\?\.scrollTo\(\{ y: 0, animated: false \}\); \}, \[view\]\)/);
  assert.match(shared, /<ScrollScreen[^>]+scrollRef=\{scrollRef\}/);
  assert.doesNotMatch(library, /<MainScreen key=\{view\}/,
    'a segment change must not remount the practice owner just to move the viewport');
});


test('the multiline rehearsal Done key dismisses editing without starting a conversation', () => {
  const screen = read('../tutor/RealMomentScreen.tsx');
  const field = read('../components.tsx');
  assert.match(screen, /returnKeyType="done"[\s\S]*?submitBehavior="blurAndSubmit"[\s\S]*?onSubmitEditing=\{Keyboard\.dismiss\}/);
  assert.match(field, /submitBehavior\?: React\.ComponentProps<typeof TextInput>\['submitBehavior'\]/);
  assert.match(field, /submitBehavior=\{submitBehavior\}/);
  assert.doesNotMatch(screen, /onSubmitEditing=\{open\}/, 'Done edits the draft; starting a metered room remains an explicit action');
});

test('a light celebration over a dark page explicitly requests dark status glyphs', () => {
  const frame = read('../layout.tsx');
  const body = frame.slice(frame.indexOf('function barStyleFor('), frame.indexOf('export function Screen('));
  assert.match(body, /if \(ground === paper\.ground\) return 'dark'/,
    'a light modal cannot inherit the underlying dark page’s white clock and battery');
  assert.match(body, /LIGHT_BAR_GROUNDS\.includes\(ground\) \? 'light' : 'dark'/,
    'blue, ink and dark-mode surfaces must retain their light glyphs');
});

test('both pre-room offline routes retain the selected canvas and readable recovery controls', () => {
  const nav = read('../nav/RootNavigator.tsx');
  const lesson = nav.slice(nav.indexOf('function LessonRoute()'), nav.indexOf('function ConvoRoute()'));
  const convo = nav.slice(nav.indexOf('function ConvoRoute()'), nav.indexOf('async function markPractisedNode('));
  for (const route of [lesson, convo]) {
    assert.match(route, /const \{ colors, mode \} = useMainAppearance\(\)/);
    assert.match(route, /<ScrollScreen ground=\{colors\.background\} header=/);
    assert.match(route, /ground=\{mode === 'dark' \? 'blue' : 'paper'\} icon="refresh"/);
    assert.match(route, /void recheck\(\)\.catch\(\(\) => false\)\.finally\(\(\) => setChecking\(false\)\)/);
  }
  const offline = convo.slice(convo.indexOf('if (!live)'), convo.indexOf('if (walkMode'));
  assert.match(offline, /color=\{colors\.muted\}/);
  assert.doesNotMatch(offline, /color: paper\.ink(?:Soft)?\b/);
});
