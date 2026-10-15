import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

const repair = readFileSync(new URL('./OnboardingFlow.tsx', import.meta.url), 'utf8');

test('normal profile repair accepts the linked Terms only on an available Continue and cannot override a known refusal', () => {
  const start = repair.indexOf('  const confirmAge =');
  const end = repair.indexOf('  const ink =', start);
  const handler = stripTypeScriptTypes(repair.slice(start, end));
  for (const condition of [
    { oldEnough: null, loaded: true, locked: false, submitting: false, accepted: true, expected: true },
    { oldEnough: true, loaded: true, locked: false, submitting: false, accepted: true, expected: true },
    { oldEnough: false, loaded: true, locked: false, submitting: false, accepted: true, expected: false },
    { oldEnough: null, loaded: false, locked: false, submitting: false, accepted: true, expected: false },
    { oldEnough: null, loaded: true, locked: true, submitting: false, accepted: true, expected: false },
    { oldEnough: null, loaded: true, locked: false, submitting: true, accepted: true, expected: false },
    { oldEnough: null, loaded: true, locked: false, submitting: false, accepted: false, expected: false },
  ]) {
    const declarations: boolean[] = [];
    const bindings = { oldEnough: condition.oldEnough, loaded: condition.loaded, submission: { current: condition.submitting },
      pageMotion: { locked: { current: condition.locked } }, move: (page: string) => { assert.equal(page, 'name'); return condition.accepted; },
      setOldEnough: (value: boolean) => declarations.push(value) };
    const confirm = new Function(...Object.keys(bindings), handler + '\nreturn confirmAge;')(...Object.values(bindings)) as () => boolean;
    assert.equal(confirm(), condition.expected);
    assert.deepEqual(declarations, condition.expected ? [true] : []);
  }
  assert.match(repair, /page === 'age' && oldEnough !== false && <View/);
  assert.match(repair, /TermsAcceptance context="repair" onTerms=\{\(\) => setLegal\('terms'\)\} onPrivacy=\{\(\) => setLegal\('privacy'\)\}/);
  assert.doesNotMatch(repair, /\{AGE_QUESTION\}|\{AGE_DENY\}|\{AGE_CONFIRM\}|\{VOICE_AI\}/);
});

test('all full-page onboarding branches share the same persistent transition host and consent enters through that seam', () => {
  const source = readFileSync(new URL('./PreAccountOnboarding.tsx', import.meta.url), 'utf8');
  const host = source.indexOf('<Animated.View style={[{ flex: 1, minHeight: 0 }, pageMotion.style]}>');
  const sheet = source.indexOf('<Sheet', host);
  const closing = source.lastIndexOf('</Animated.View>', sheet);
  assert.ok(host > 0 && closing > host);
  for (const family of ['consentVisible ?', '<FirstLivePractice', '<FirstSessionCelebration', '<FirstSessionSummary', 'page={page}']) {
    const location = source.indexOf(family, host);
    assert.ok(location > host && location < closing, `${family} must animate inside the persistent page host`);
  }
  assert.equal((source.match(/pageMotion\.style/g) ?? []).length, 1, 'nesting the same motion would double opacity and movement');
  assert.match(source, /if \(next === 'start'\) pageMotion\.transition\(reveal\)/);
});

test('selected tutor paint does not change the row footprint or couple listening to selection', () => {
  const source = readFileSync(new URL('./TutorSelection.tsx', import.meta.url), 'utf8');
  assert.match(source, /selected && \{ backgroundColor: c\.violet, borderColor: c\.violet \}/);
  const selectedPaint = source.match(/selected && \{ backgroundColor: c\.violet, borderColor: c\.violet \}/)![0];
  assert.doesNotMatch(selectedPaint, /borderWidth|padding|height|width/);
  assert.match(source, /onPress=\{\(\) => onChoose\(voice\.value\)\}/);
  assert.match(source, /onPress=\{\(\) => preview \? preview\.toggle\(voice\.value\) : onHear\?\.\(voice\.value\)\}/);
  assert.doesNotMatch(source, /onChoose\(voice\.value\);\s*(preview|onHear)/);
});

test('auth focus rings retain fixed geometry and password recovery hides its actions while the keyboard is shown', () => {
  const field = readFileSync(new URL('../auth/AccountField.tsx', import.meta.url), 'utf8');
  assert.match(field, /inputWrap: \{[^\n]*minHeight: 48[^\n]*borderWidth: 1/);
  assert.match(field, /focused: \{ borderColor: c\.violet \}/);
  assert.match(field, /focused && <View[^\n]*pointerEvents="none"[^\n]*StyleSheet\.absoluteFill, st\.focusRing/);
  assert.match(field, /outlineStyle: 'solid' as const, outlineWidth: 0/);
  const reset = readFileSync(new URL('../auth/SetNewPasswordScreen.tsx', import.meta.url), 'utf8');
  assert.match(reset, /visible: keyboardVisible, keyboardTop \} = useFormKeyboard\(keepFocusedVisible\)/);
  assert.match(reset, /footer=\{!keyboardVisible \?/);
  assert.match(reset, /automaticallyAdjustKeyboardInsets/);
  assert.match(reset, /visibleFormHeight\(viewportTop, viewportHeight, keyboardTop\.current\)/);
  assert.match(reset, /focusedFieldScroll\(scrollOffset\.current, viewportTop, height, groupTop, groupHeight\)/);
  assert.match(reset, /onPress=\{\(\) => void cancel\(\)\}/);
  assert.match(reset, /await adapter\.signOut\(\)/);
});

test('plan artwork pauses under edit sheets without replacing its mounted scene', () => {
  const source = readFileSync(new URL('./PreAccountOnboarding.tsx', import.meta.url), 'utf8');
  const plan = source.split('\n').find(line => line.includes('<PersonalPlan '));
  assert.ok(plan);
  assert.match(plan, /active=\{active && surface === null\}/, 'a visible sheet must pause the same mounted plan art');
  assert.doesNotMatch(plan, /\bkey=/, 'closing an edit sheet must not replace the plan clock');
});

test('remembered learning reflects committed draft and ignores incoming-transition taps', () => {
  const source = readFileSync(new URL('./PreAccountOnboarding.tsx', import.meta.url), 'utf8');
  const handler = source.match(/const toggleRemember = \(\) => \{[\s\S]*?\n  \};/)?.[0];
  assert.ok(handler, 'memory must have one guarded update path');
  for (const blocked of ['transition', 'operation', 'busy', 'none'] as const) {
    const writes: boolean[] = [];
    const draftRef = { current: { rememberLearning: false } };
    const bindings = { busy: blocked === 'busy', operation: { current: blocked === 'operation' },
      pageMotion: { locked: { current: blocked === 'transition' } }, draftRef,
      choose: (change: { rememberLearning: boolean }) => { draftRef.current = change; writes.push(change.rememberLearning); } };
    const toggle = new Function(...Object.keys(bindings), handler + '\nreturn toggleRemember;')(...Object.values(bindings)) as () => void;
    toggle(); toggle();
    assert.deepEqual(writes, blocked === 'none' ? [true, false] : [], blocked + ' changed committed memory');
  }
  assert.match(source, /title="Remember my learning"[^>]*selected=\{draft\.rememberLearning === true\}/);
  assert.doesNotMatch(source, /\bsetRemember\b/, 'a separate local check can disagree with the committed draft');
});

test('unanswered question guidance stays inside the reserved Next button footprint', () => {
  const source = readFileSync(new URL('./PreAccountOnboarding.tsx', import.meta.url), 'utf8');
  const next = readFileSync(new URL('./NextButton.tsx', import.meta.url), 'utf8');
  assert.match(source, /disabledHint="Choose one to continue\."/);
  assert.doesNotMatch(source, /choiceNudge\.page === page && answer == null && <Text/, 'a new footer row moves the action');
  assert.match(next, /showDisabledHint \? disabledHint : label/);
  assert.match(next, /face\(NEXT_OFF\.words, disabledHint\)/, 'reserve the instruction text before it is shown');
  assert.match(next, /aria-hidden=\{true\}[^\n]*opacity: 0/, 'measurement text must stay out of accessibility navigation');
  assert.match(next, /StyleSheet\.absoluteFill[^\n]*paddingHorizontal/);
  assert.match(next, /accessibilityLiveRegion="polite"/);
});
