import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { screenGeometry } from '../responsiveLayout.ts';
import { focusedFieldScroll } from './focusedFieldScroll.ts';
import { welcomeLayout } from './welcomeLayout.ts';

test('short sign-in viewports surrender decorative art before the form', () => {
  for (const height of [-100, 0, 320, 599, 599.99]) {
    assert.deepEqual(welcomeLayout(height, 1, false), { compact: true, orbSize: 0, center: false });
  }
  for (const height of [600, 667, 739, 739.99]) {
    assert.deepEqual(welcomeLayout(height, 1, false), { compact: true, orbSize: 64, center: false });
  }
});

test('compact account and recovery focus survives the installed web ScrollView callback', () => {
  const require = createRequire(import.meta.url);
  const vendor = readFileSync(require.resolve('react-native-web/dist/exports/ScrollView/index.js'), 'utf8');
  const from = vendor.indexOf('this._handleScroll = e => {');
  const to = vendor.indexOf('this._setInnerViewRef =', from);
  assert.ok(from >= 0 && to > from, 'inspect the installed ScrollView keyboard behaviour if its handler changes');
  const callback = vendor.slice(from, to);
  type ScrollEvent = { nativeEvent: { contentOffset: { y: number } } };
  const layouts = [
    readFileSync(new URL('../onboarding/OnboardingLayout.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../layout.tsx', import.meta.url), 'utf8'),
  ];
  for (const frame of layouts) {
    const expression = frame.match(/const resolvedKeyboardDismissMode = (.+);/);
    const dragExpression = frame.match(/const webDragDismisses = (.+);/);
    assert.ok(expression && dragExpression);
    assert.match(frame, /keyboardDismissMode=\{resolvedKeyboardDismissMode\}/);
    const resolve = new Function('Platform', 'keyboardDismissMode', `return ${expression[1]};`);
    const drag = new Function('Platform', 'keyboardDismissMode', `return ${dragExpression[1]};`);
    assert.equal(resolve({ OS: 'web' }, 'on-drag'), 'none');
    for (const platform of ['ios', 'android']) {
      for (const requested of [undefined, 'none', 'on-drag', 'interactive']) {
        const expected = requested ?? (frame === layouts[0] ? platform === 'ios' ? 'interactive' : 'on-drag' : undefined);
        assert.equal(resolve({ OS: platform }, requested), expected, 'native form policy must remain unchanged');
        assert.equal(drag({ OS: platform }, requested), false, 'the extra gesture handlers belong only to web');
      }
    }

    let focused = true;
    let observedOffset = 0;
    const owner = { props: { keyboardDismissMode: resolve({ OS: 'web' }, 'on-drag'), scrollEventThrottle: 16 },
      scrollResponderHandleScroll: (event: ScrollEvent) => { observedOffset = event.nativeEvent.contentOffset.y; } };
    const dismiss = () => { focused = false; };
    const scroll = new Function('dismissKeyboard', `${callback}\nreturn this._handleScroll;`).call(owner, dismiss) as (event: ScrollEvent) => void;
    const correction = focusedFieldScroll(0, 154, 200, 400, 48);
    assert.ok(correction > 0, 'the compact focus case must actually require a scroll');
    scroll({ nativeEvent: { contentOffset: { y: correction } } });
    assert.equal(observedOffset, correction, 'the form must receive the programmatic offset');
    assert.equal(focused, true, 'scrolling a field above the typing box must keep the field focused');

    owner.props.keyboardDismissMode = 'on-drag';
    scroll({ nativeEvent: { contentOffset: { y: correction } } });
    assert.equal(focused, false, 'the installed legacy policy must reproduce the original blur');
    focused = true;
    assert.equal(drag({ OS: 'web' }, 'on-drag'), true);
    assert.equal(drag({ OS: 'web' }, 'none'), false, 'explicit none must also retain editing during user scroll');
    assert.match(frame, /webDragDismisses \? \{ onWheel: Keyboard\.dismiss \} : \{\}/);
    assert.match(frame, /onTouchMove=\{webDragDismisses \? Keyboard\.dismiss : undefined\}/);
    const actualWheel = frame.match(/onWheel: (Keyboard\.dismiss)/)?.[1];
    assert.ok(actualWheel);
    new Function('Keyboard', `return ${actualWheel};`)({ dismiss })();
    assert.equal(focused, false, 'real wheel intent must still dismiss a drag-dismiss form');
  }
  const recovery = readFileSync(new URL('./SetNewPasswordScreen.tsx', import.meta.url), 'utf8');
  assert.match(recovery, /<ScrollScreen/);
  assert.match(recovery, /focusedFieldScroll\(/);
  assert.match(recovery, /scroll\.scrollTo\(/);
});

test('roomier sign-in viewports retain the exported orb and center only on tall screens', () => {
  for (const height of [740, 800, 899, 899.99]) {
    assert.deepEqual(welcomeLayout(height, 1, false), { compact: false, orbSize: 104, center: false });
  }
  for (const height of [900, 1024, 1200]) {
    assert.deepEqual(welcomeLayout(height, 1, false), { compact: false, orbSize: 104, center: true });
  }
});

test('narrow phones and larger reading sizes keep room for the account controls', () => {
  assert.equal(welcomeLayout(800, 1.3, false).orbSize, 104);
  for (const height of [600, 740, 900, 1200]) {
    assert.equal(welcomeLayout(height, 1, true).orbSize, 64, 'a narrow phone received the full decoration');
    for (const scale of [1.3001, 1.5, 2, 3]) {
      const layout = welcomeLayout(height, scale, false);
      assert.equal(layout.orbSize, 0, 'decorative art competes with larger text');
      assert.equal(layout.compact, true);
    }
  }
  assert.equal(welcomeLayout(599, 1, true).orbSize, 0, 'compact-phone art overrides the short-screen limit');
  assert.equal(welcomeLayout(1200, 2, true).center, true, 'a tall accessibility layout lost its shared frame centering');
});

test('missing measurements and safe-area subtraction cannot create negative artwork', () => {
  for (const height of [Number.NaN, -100, 0, 1]) {
    const { orbSize } = welcomeLayout(height, 1, false);
    assert.ok(Number.isFinite(orbSize) && orbSize >= 0 && orbSize <= 104);
  }
  const obscured = screenGeometry(320, 80, { top: 59, bottom: 34, left: 0, right: 0 });
  assert.equal(obscured.usableHeight, 0);
  assert.equal(welcomeLayout(obscured.usableHeight, 1, obscured.compact).orbSize, 0);
});

test('sign-in uses shared geometry and compact gaps while keeping scroll available for overflow', () => {
  const screen = readFileSync(new URL('./SignInScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /const geometry = useScreenGeometry\(\);/);
  assert.match(screen, /welcomeLayout\(geometry\.usableHeight, fontScale, geometry\.compact\)/);
  assert.doesNotMatch(screen, /useSafeAreaInsets|Dimensions\.get|scrollEnabled=\{false\}/);
  assert.match(screen, /const Frame = OnboardingLayout;/);
  assert.match(screen, /center=\{false\}/);
  assert.match(screen, /page="signin"\s+hideProgress/);
  assert.match(screen, /layout\.compact && st\.headCompact/);
  assert.match(screen, /layout\.compact && st\.doorsCompact/);

  assert.match(screen, /gap: 12, marginTop: embedded \? 0 : fontScale > 1\.3 \? 32 : 64/);
  assert.match(screen, /boldType\.title/);
  assert.doesNotMatch(screen, /<WelcomeOrb/, 'C keeps the form focused on provider and email actions');
  assert.match(screen, /automaticallyAdjustKeyboardInsets/);
  assert.match(screen, /maxFontSizeMultiplier=\{liveFontMultiplier\}/);
});

test('account focus scrolling preserves web editing while retaining native drag dismissal', () => {
  const frame = readFileSync(new URL('../onboarding/OnboardingLayout.tsx', import.meta.url), 'utf8');
  const expression = frame.match(/const resolvedKeyboardDismissMode = (.+);/);
  assert.ok(expression, 'the shared account frame must resolve its scroll dismissal policy');
  assert.match(frame, /keyboardDismissMode=\{resolvedKeyboardDismissMode\}/, 'the ScrollView must use the resolved policy');
  const resolve = new Function('Platform', 'keyboardDismissMode', `return ${expression[1]};`) as
    (platform: { OS: string }, requested?: 'none' | 'on-drag' | 'interactive') => string;

  // RN web dismisses on every scroll with on-drag, including scrollTo invoked
  // by focused-field visibility. Explicit native callers cannot re-enable it.
  for (const requested of [undefined, 'none', 'on-drag', 'interactive'] as const) {
    assert.equal(resolve({ OS: 'web' }, requested), 'none');
  }
  assert.equal(resolve({ OS: 'ios' }), 'interactive');
  assert.equal(resolve({ OS: 'android' }), 'on-drag');
  for (const platform of ['ios', 'android']) {
    for (const requested of ['none', 'on-drag', 'interactive'] as const) {
      assert.equal(resolve({ OS: platform }, requested), requested, 'native caller policy must remain intact');
    }
  }
  for (const name of ['SignUpScreen', 'SignInScreen']) {
    const screen = readFileSync(new URL(`./${name}.tsx`, import.meta.url), 'utf8');
    assert.match(screen, /OnboardingLayout/);
    assert.match(screen, /focusedFieldScroll\(/);
    assert.match(screen, /scroll\.scrollTo\(/, `${name} must keep its focused-field visibility correction`);
  }
});
