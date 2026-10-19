import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { focusedFieldScroll } from '../auth/focusedFieldScroll.ts';
import { visibleFormHeight } from '../auth/signupForm.ts';

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

test('an input that fits still reveals its following Check control on a compact keyboard viewport', () => {
  const height = visibleFormHeight(197, 600, 530);
  assert.equal(focusedFieldScroll(0, 197, height, 444, 52), 0);
  assert.equal(focusedFieldScroll(0, 197, height, 444, 114), 36);
  // After the one reveal, another keyboard/layout event keeps the same place.
  assert.equal(focusedFieldScroll(36, 197, height, 408, 114), 36);
});

test('a custom moment field below long options reveals its label, input and counter together', () => {
  const height = visibleFormHeight(190, 610, 530);
  const target = focusedFieldScroll(800, 190, height, 700, 164);
  assert.equal(target, 1142);
  assert.equal(focusedFieldScroll(target, 190, height, 358, 164), target);
  // Reading sizes taller than the viewport prioritise the start, without a loop.
  assert.equal(focusedFieldScroll(0, 190, 220, 300, 340), 102);
  assert.equal(focusedFieldScroll(102, 190, 220, 198, 340), 102);
});

test('focused scroll measures owned groups and releases stale work on blur, replacement and unmount', () => {
  const owner = read('./focusedFieldGroup.tsx');
  assert.match(owner, /return \(\) => owner\.blur\(mounted\)/);
  assert.match(owner, /if \(group\.current === target\)/,
    'old group teardown must not release a more recently focused group');
  assert.match(owner, /ticket !== measurement\.current \|\| target !== group\.current \|\| scroll !== scrollRef\.current/);
  assert.match(owner, /cancelAnimationFrame\(frame\.current\)/);
  assert.match(owner, /alive\.current = false; group\.current = null; cancel\(\)/);
  assert.match(owner, /\[visible, keyboardTop, onSettled\]/,
    'keyboard hide must clear its previous occlusion even while an input stays focused');
  const layout = read('../layout.tsx');
  assert.match(layout, /focus\.focused && <FocusedKeyboardObserver/,
    'inactive mounted tabs must not each install another keyboard animation observer');
  assert.match(layout, /onViewportLayout\?\.\(event\);\s+focus\.refresh\(\)/);
});

test('recall and real-moment fields register the complete actionable group in the existing scroll owner', () => {
  const drill = read('../DrillScreen.tsx');
  const typed = drill.slice(drill.indexOf('function TypedAnswer('), drill.indexOf('function FillBlankView('));
  assert.match(typed, /<FocusedFieldGroup[\s\S]*<TextInput[\s\S]*onFocus=\{focus\.onFocus\}[\s\S]*<PillButton label="Check"[\s\S]*<\/FocusedFieldGroup>/);
  const moment = read('../tutor/RealMomentScreen.tsx');
  assert.match(moment, /<FocusedFieldGroup>[\s\S]*<Field[\s\S]*onFocus=\{focus\.onFocus\}[\s\S]*detail\.length[\s\S]*<\/FocusedFieldGroup>/);
  const field = read('../components.tsx');
  assert.match(field, /onFocus=\{\(event\) => \{ setFocused\(true\); onFocus\?\.\(event\); \}\}/);
  assert.match(field, /onBlur=\{\(event\) => \{ setFocused\(false\); onBlur\?\.\(event\); \}\}/);
});

test('compact editing keeps the question and help while reclaiming only an empty feedback reservation', () => {
  const drill = read('../DrillScreen.tsx');
  const translation = drill.slice(drill.indexOf('function TranslationView('), drill.indexOf('function RepeatThisView('));
  assert.match(translation, /<Text[^>]+>[\s\S]*?\{prompt\}/,
    'the question cannot disappear when typing begins');
  assert.match(translation, /canHelp && !help\.shown[\s\S]*?<IconAction[^>]+help\.onShow/,
    'help remains available in compact keyboard presentation');
  assert.match(drill, /minHeight: keyboardEditing \? 0 : 220/);
  assert.match(drill, /minHeight: keyboardEditing \? 0 : 260/);
  assert.match(drill, /if \(keyboardEditing && !hasFeedback\) return null/);
  assert.match(drill, /<DrillFeedbackArea hasFeedback=\{sheet !== null\}>[\s\S]*?<AnswerSheet/,
    'real answer feedback must still be shown even if the keyboard has not yet closed');
  assert.equal(focusedFieldScroll(0, 273, 230, 376, 114), 0,
    'a compact question above a complete input/action group fits without scrolling the question away');
});
