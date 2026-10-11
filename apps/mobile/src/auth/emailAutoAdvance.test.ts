import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

const source = readFileSync(new URL('./useEmailAutoAdvance.ts', import.meta.url), 'utf8');

function form() {
  const slots: any[] = [];
  let cursor = 0;
  const same = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    useRef(value: unknown) { const i = cursor++; return slots[i] ??= { current: value }; },
    useCallback(callback: unknown, deps: unknown[]) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { callback, deps };
      return slots[i].callback;
    },
    useEffect(effect: () => void | (() => void), deps: unknown[]) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) {
        slots[i]?.cleanup?.();
        slots[i] = { deps, cleanup: effect() };
      }
    },
  };
  const code = stripTypeScriptTypes(source.replace(/^import .*;\n/gm, '').replace(/^export /gm, ''));
  const make = new Function(...Object.keys(hooks), `${code}\nreturn { useEmailAutoAdvance, emailReadyForAdvance };`)(...Object.values(hooks));
  let focused = true;
  let advances = 0;
  const email = { current: { isFocused: () => focused } };
  const password = { current: { focus: () => { advances++; focused = false; } } };
  const requestRunning = { current: false };
  const render = (busy = false) => { cursor = 0; return make.useEmailAutoAdvance(email, password, busy, requestRunning); };
  return { render, requestRunning, ready: make.emailReadyForAdvance, get advances() { return advances; },
    focus: () => { focused = true; }, blur: () => { focused = false; },
    unmount: () => { for (const slot of slots) slot.cleanup?.(); } };
}

test('email progression waits for a complete domain and a pause after the last keystroke', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const page = form(); const advance = page.render();
  for (const value of ['', 'camille', 'camille@', 'camille@example', 'camille@example.', 'camille@example.c', 'c@@example.com', 'c @example.com']) {
    advance.queue(value); t.mock.timers.tick(1000); assert.equal(page.advances, 0, value);
  }
  advance.queue('camille@example.co'); t.mock.timers.tick(200);
  advance.queue('camille@example.com'); t.mock.timers.tick(299);
  assert.equal(page.advances, 0);
  t.mock.timers.tick(1); assert.equal(page.advances, 1);
});

test('pasted email advances without changing either field value or submitting the form', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const page = form();
  page.render().queue(' camille+practice@example.co.uk ');
  t.mock.timers.tick(300); assert.equal(page.advances, 1);
});

test('clearing or leaving email cancels progression, including a quick return to edit it', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const page = form(); const advance = page.render();
  advance.queue('camille@example.com'); advance.queue('');
  t.mock.timers.tick(1000); assert.equal(page.advances, 0);
  advance.queue('camille@example.com'); page.blur(); advance.cancel(); page.focus();
  t.mock.timers.tick(1000); assert.equal(page.advances, 0);
});

test('restoring a form and mounting or rerendering never moves focus by itself', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const page = form(); page.render(); page.render();
  t.mock.timers.tick(1000); assert.equal(page.advances, 0);
});

test('auth work, moving to another input and unmounting prevent a queued focus change', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const stop of ['lock', 'busy', 'blur', 'unmount']) {
    const page = form(); page.render().queue('camille@example.com');
    if (stop === 'lock') page.requestRunning.current = true;
    if (stop === 'busy') page.render(true);
    if (stop === 'blur') page.blur();
    if (stop === 'unmount') page.unmount();
    t.mock.timers.tick(1000); assert.equal(page.advances, 0, stop);
  }
});

for (const name of ['SignInScreen.tsx', 'SignUpScreen.tsx']) {
  test(`${name} advances email only on explicit Next to the native password input and hides its action during keyboard use`, () => {
    const screen = readFileSync(new URL(name, import.meta.url), 'utf8');
    assert.doesNotMatch(screen, /useEmailAutoAdvance|emailAdvance/, 'Typing must never steal focus');
    assert.match(screen, /ref=\{emailRef\}/);
    assert.match(screen, /returnKeyType="next"/);
    assert.match(screen, /ref=\{passwordRef\}/);
    assert.match(screen, /submitBehavior="submit"/);
    assert.match(screen, /passwordRef\.current\?\.focus\(\)/);
    assert.match(screen, /\{!keyboardVisible && <View style=\{st\.action\}>/);
    assert.doesNotMatch(screen, /footer=/);
    assert.match(screen, /automaticallyAdjustKeyboardInsets/);
  });
}
