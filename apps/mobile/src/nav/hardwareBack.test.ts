import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { describe, test } from 'node:test';

const source = readFileSync(new URL('./useHardwareBack.ts', import.meta.url), 'utf8');
const javascript = stripTypeScriptTypes(source.replace(/^import .*;\n/gm, '').replace('export function', 'function'));
type Listener = () => void;
type Navigation = {
  isFocused: () => boolean;
  addListener: (event: 'focus' | 'blur', listener: Listener) => () => void;
};

function route(initialFocus: boolean) {
  let focused = initialFocus;
  const listeners = { focus: new Set<Listener>(), blur: new Set<Listener>() };
  const navigation: Navigation = {
    isFocused: () => focused,
    addListener: (event, listener) => {
      listeners[event].add(listener);
      return () => { listeners[event].delete(listener); };
    },
  };
  return {
    navigation,
    listeners,
    setFocused: (value: boolean) => { focused = value; },
    emit: (event: 'focus' | 'blur') => { for (const listener of [...listeners[event]]) listener(); },
  };
}

/**
 * Executes the actual hook and its effects with injected platform APIs. This
 * does not render a component or prove native event priority. It proves its
 * listener lifecycle, including the missing navigation context from auth.
 */
function mountHook(platform: string, initialNavigation?: Navigation) {
  let navigation = initialNavigation;
  const context = {};
  const references: { current: unknown }[] = [];
  let referenceIndex = 0;
  let effectDependencies: readonly unknown[] | undefined;
  let cleanup: (() => void) | undefined;
  let pendingEffect: (() => void | (() => void)) | undefined;
  const hardwareListeners = new Set<() => boolean>();
  let registrations = 0;
  let removals = 0;
  const hook = new Function(
    'useContext', 'useEffect', 'useRef', 'BackHandler', 'Platform', 'NavigationContext',
    `${javascript}\nreturn useHardwareBack;`,
  )(
    (value: unknown) => { assert.equal(value, context); return navigation; },
    (effect: () => void | (() => void), dependencies: readonly unknown[]) => {
      const changed = effectDependencies === undefined || dependencies.length !== effectDependencies.length
        || dependencies.some((dependency, index) => !Object.is(dependency, effectDependencies![index]));
      if (changed) {
        pendingEffect = effect;
        effectDependencies = [...dependencies];
      }
    },
    (initial: unknown) => {
      const index = referenceIndex++;
      references[index] ??= { current: initial };
      return references[index];
    },
    {
      addEventListener: (event: string, listener: () => boolean) => {
        assert.equal(event, 'hardwareBackPress');
        registrations += 1;
        hardwareListeners.add(listener);
        let removed = false;
        return { remove: () => {
          assert.equal(removed, false, 'a hardware subscription must only be removed once');
          removed = true;
          removals += 1;
          hardwareListeners.delete(listener);
        } };
      },
    },
    { OS: platform }, context,
  ) as (active: boolean, onBack: () => void) => void;

  return {
    render: (active: boolean, onBack: () => void) => {
      referenceIndex = 0;
      hook(active, onBack);
      if (pendingEffect !== undefined) {
        cleanup?.();
        cleanup = pendingEffect() ?? undefined;
        pendingEffect = undefined;
      }
    },
    setNavigation: (value?: Navigation) => { navigation = value; },
    press: () => [...hardwareListeners].map((listener) => listener()),
    listeners: () => hardwareListeners.size,
    registrations: () => registrations,
    removals: () => removals,
    unmount: () => {
      cleanup?.();
      cleanup = undefined;
    },
  };
}

describe('in-place policy pages answer back with or without a navigator', () => {
  test('Terms and Privacy can mount outside navigation on web and iOS without registering Android back', () => {
    for (const platform of ['web', 'ios']) {
      const page = mountHook(platform);
      assert.doesNotThrow(() => page.render(true, () => assert.fail('off-platform back ran')),
        'a direct auth policy page must not need a navigation object just to render');
      assert.equal(page.listeners(), 0);
      assert.equal(page.registrations(), 0);
      page.unmount();
    }
  });

  test('a direct Android policy page consumes back only while its active view is mounted', () => {
    const page = mountHook('android');
    let closed = 0;
    page.render(true, () => { closed += 1; });
    assert.equal(page.listeners(), 1);
    assert.deepEqual(page.press(), [true], 'the in-place policy must consume back instead of leaving auth');
    assert.equal(closed, 1);
    page.unmount();
    assert.equal(page.listeners(), 0);
    assert.equal(page.removals(), 1);
    assert.deepEqual(page.press(), []);
    assert.equal(closed, 1, 'a removed policy page must not answer a later back press');
  });

  test('an inactive direct view leaves default Android back available and removes its listener when closed', () => {
    const page = mountHook('android');
    let closed = 0;
    const close = () => { closed += 1; };
    page.render(false, close);
    assert.equal(page.registrations(), 0);
    page.render(true, close);
    assert.equal(page.listeners(), 1);
    page.render(false, close);
    assert.equal(page.listeners(), 0);
    assert.equal(page.removals(), 1);
    assert.deepEqual(page.press(), []);
    assert.equal(closed, 0);
    page.unmount();
    assert.equal(page.removals(), 1, 'closing followed by unmount must not remove the subscription twice');
  });

  test('routed views ignore back while blurred and follow focus events without duplicate registrations', () => {
    const screen = route(false);
    const page = mountHook('android', screen.navigation);
    let closed = 0;
    page.render(true, () => { closed += 1; });
    assert.equal(page.listeners(), 0, 'a mounted route below the top must not capture back');
    assert.equal(screen.listeners.focus.size, 1);
    assert.equal(screen.listeners.blur.size, 1);

    // React Navigation's focus event can precede its isFocused() snapshot.
    screen.emit('focus');
    screen.emit('focus');
    assert.equal(page.listeners(), 1);
    assert.equal(page.registrations(), 1, 'duplicate focus events must not multiply hardware handlers');
    assert.deepEqual(page.press(), [true]);
    assert.equal(closed, 1);

    screen.emit('blur');
    screen.emit('blur');
    assert.equal(page.listeners(), 0);
    assert.equal(page.removals(), 1);
    assert.deepEqual(page.press(), []);
    screen.emit('focus');
    assert.equal(page.listeners(), 1);
    assert.equal(page.registrations(), 2);
    assert.deepEqual(page.press(), [true]);
    assert.equal(closed, 2);
    page.unmount();
    assert.equal(page.listeners(), 0);
    assert.equal(screen.listeners.focus.size, 0);
    assert.equal(screen.listeners.blur.size, 0);
    screen.emit('focus');
    assert.equal(page.listeners(), 0, 'a removed route must not resubscribe to hardware back');
  });

  test('callback replacement answers the current view without re-registering its focused hardware listener', () => {
    const screen = route(true);
    const page = mountHook('android', screen.navigation);
    const closed: string[] = [];
    page.render(true, () => { closed.push('old'); });
    screen.emit('focus');
    page.render(true, () => { closed.push('current'); });
    assert.equal(page.registrations(), 1, 'a normal callback render must not reset listener priority');
    assert.equal(page.removals(), 0);
    assert.deepEqual(page.press(), [true]);
    assert.deepEqual(closed, ['current'], 'back must use the current closure rather than a stale policy action');
    page.unmount();
  });

  test('changing navigation ownership removes every old focus and hardware subscription', () => {
    const first = route(true);
    const next = route(false);
    const page = mountHook('android', first.navigation);
    let closed = 0;
    const close = () => { closed += 1; };
    page.render(true, close);
    page.setNavigation(next.navigation);
    page.render(true, close);
    assert.equal(page.listeners(), 0);
    assert.equal(first.listeners.focus.size, 0);
    assert.equal(first.listeners.blur.size, 0);
    first.emit('focus');
    assert.equal(page.listeners(), 0, 'the previous route must not register another listener');
    next.emit('focus');
    assert.deepEqual(page.press(), [true]);
    assert.equal(closed, 1);
    page.setNavigation(undefined);
    page.render(true, close);
    assert.equal(next.listeners.focus.size, 0);
    assert.equal(next.listeners.blur.size, 0);
    assert.equal(page.listeners(), 1, 'a direct mounted page must continue answering back after leaving the route owner');
    page.unmount();
    assert.equal(page.registrations(), page.removals(), 'all hardware subscriptions must be released');
  });
});
