/** Run the native interaction callbacks without importing native animation engines. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const components = readFileSync(new URL('../../components.tsx', import.meta.url), 'utf8');
const sheet = components.slice(components.indexOf('export function Sheet('));
const responderSource = sheet.slice(sheet.indexOf('  const gesture ='), sheet.indexOf('  const focusHeading ='));
const makeResponder = new Function('useRef', 'PanResponder', 'drag', 'close', 'reducedNow', 'Animated', 'Platform',
  `${responderSource}\nreturn gesture;`);
const effectEnd = sheet.indexOf('  }, [reduced, drag]);');
const effectStart = sheet.lastIndexOf('  useEffect(() => {', effectEnd);
const runPreferenceEffect = new Function('reduced', 'drag',
  sheet.slice(effectStart + '  useEffect(() => {'.length, effectEnd));
function sheetHarness() {
  let starts = 0, stops = 0, value = 20, closes = 0, allowClose = true;
  const reducedNow = { current: false };
  const drag = { stopAnimation: () => { stops++; }, setValue: (next: number) => { value = next; } };
  const responder = makeResponder((current: unknown) => ({ current }), { create: (value: unknown) => value }, drag,
    { current: () => { closes++; return allowClose; } }, reducedNow,
    { timing: (_value: unknown, config: { duration: number }) => {
      assert.equal(config.duration, 180); return { start: () => { starts++; } };
    } }, { OS: 'ios' });
  return { responder, reducedNow, drag, stats: () => ({ starts, stops, value, closes }),
    refuseClose: () => { allowClose = false; } };
}

test('sheet short/rejected swipe follows the latest reduced-motion setting', () => {
  const h = sheetHarness();
  h.responder.onPanResponderRelease(null, { dy: 20, vy: 0 });
  assert.equal(h.stats().starts, 1);
  assert.equal(h.stats().closes, 0);
  h.reducedNow.current = true; // persistent responder must read this live value
  h.responder.onPanResponderRelease(null, { dy: 20, vy: 0 });
  assert.equal(h.stats().starts, 1);
  assert.equal(h.stats().value, 0);
  h.refuseClose();
  h.drag.setValue(90);
  h.responder.onPanResponderRelease(null, { dy: 90, vy: 0 });
  assert.equal(h.stats().closes, 1, 'dismissal policy is still consulted');
  assert.equal(h.stats().starts, 1);
  assert.equal(h.stats().value, 0, 'a rejected dismissal also lands immediately');
  assert.match(sheet, /reducedNow\.current = reduced/);
});

test('sheet return motion cancels when the preference changes, a new gesture starts or it unmounts', () => {
  const h = sheetHarness();
  h.responder.onPanResponderRelease(null, { dy: 20, vy: 0 });
  const before = h.stats().stops;
  const cleanup = runPreferenceEffect(true, h.drag);
  assert.equal(h.stats().stops, before + 1);
  assert.equal(h.stats().value, 0);
  h.responder.onPanResponderGrant();
  assert.equal(h.stats().stops, before + 2);
  cleanup(); assert.equal(h.stats().stops, before + 3);
  h.drag.setValue(10);
  h.responder.onPanResponderTerminate();
  assert.equal(h.stats().stops, before + 4);
  assert.equal(h.stats().value, 0);
  const allowed = sheetHarness();
  allowed.responder.onPanResponderRelease(null, { dy: 90, vy: 0 });
  assert.equal(allowed.stats().closes, 1);
  assert.equal(allowed.stats().starts, 0, 'an accepted dismissal does not start a competing return');
});
