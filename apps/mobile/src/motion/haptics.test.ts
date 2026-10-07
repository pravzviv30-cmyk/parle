/**
 * Haptics stay optional on the web and become real on a device.
 *
 * Node loads the web-safe half below; Metro swaps in haptics.native.ts on a
 * phone through the platform resolver held by F382.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { arrived, cancelHaptics, celebrate, pressed, soft, tapSettled, thump, tick } from './haptics.ts';
import { CELEBRATE_BEATS, TICK_GAP_MS, createBeats, createThrottle, type Beat } from './hapticBeats.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('haptics are a seam', () => {
  test('a press is a light impact, a choice is a selection tick, a hint is soft, and the web half stays silent', () => {
    // STYLE section 11: a selection tick on toggles and option taps, a light
    // impact on a press, success on something earned, soft on a hint, none on
    // an error. The web half answers every one with nothing.
    assert.equal(tapSettled(), undefined);
    assert.equal(arrived(), undefined);
    assert.equal(pressed(), undefined);
    assert.equal(soft(), undefined);
    const web = read('./haptics.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.doesNotMatch(web, /expo-haptics|require\(|import /, 'the web-safe half reaches for a native module');
    const native = read('./haptics.native.ts');
    assert.match(native, /from 'expo-haptics'/, 'the native half never reaches the device haptics engine');
    assert.match(native, /selectionAsync\(\)/, 'a settled tap uses no selection response');
    assert.match(native, /NotificationFeedbackType\.Success/, 'an earned arrival uses no success response');
    assert.match(native, /ImpactFeedbackStyle\.Light/, 'a press is not a light impact');
    assert.match(native, /ImpactFeedbackStyle\.Soft/, 'a hint is not a soft impact');
    // Come alive (F722) adds tick, thump and the three beats of celebrate, so
    // four answers became nine native calls, and each still swallows its own.
    assert.equal(
      (native.match(/\.catch\(\(\) => \{\}\)/g) ?? []).length,
      9,
      'a haptic failure can escape into the learning flow: every one of the nine native calls must swallow its own refusal',
    );
    // The closure card is arriving somewhere earned; a finished drill is a tap that settled.
    assert.match(read('../conversationPacks/ConversationPackCard.tsx'), /arrived\(\)/, 'the closure card no longer marks the arrival');
    assert.match(read('../DrillScreen.tsx'), /tapSettled\(\)/, 'a finished drill no longer settles');
    // Every press goes through `Press`, and `Press` is what answers it: a light
    // impact for a press, a selection tick for a choice.
    const components = read('../components.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const at = components.indexOf('export function Press(');
    assert.notEqual(at, -1, 'components.tsx has no Press, so nothing answers a press');
    const next = components.indexOf('\nexport ', at + 1);
    const press = components.slice(at, next === -1 ? undefined : next);
    assert.match(press, /pressed\(\)/, 'a press gives no light impact');
    assert.match(press, /tapSettled\(\)/, 'a choice gives no selection tick');
  });

  test('celebration haptics are cancellable beats that respect the haptic switch', () => {
    // F722. A celebration is the one pattern: success at 0, a medium impact at
    // 140 ms, a light one at 280 ms. Each beat asks the haptic switch again as
    // it fires, so the switch turned off or a microphone opening (the switch
    // reads both) silences the beats still to come, and cancelling drops them.
    assert.deepEqual(
      CELEBRATE_BEATS.map(({ at, beat }) => [at, beat]),
      [[0, 'success'], [140, 'medium'], [280, 'light']],
      'the celebration is not success, then medium at 140, then light at 280',
    );

    // A stepped clock, so the test decides when time passes.
    let now = 0;
    let queue: { at: number; run: () => void; id: number }[] = [];
    let ids = 0;
    const clock = {
      setTimeout: (run: () => void, ms: number) => { const id = ++ids; queue.push({ at: now + ms, run, id }); return id; },
      clearTimeout: (handle: unknown) => { queue = queue.filter((t) => t.id !== handle); },
      now: () => now,
    };
    const advance = (to: number): void => {
      now = to;
      for (const due of queue.filter((t) => t.at <= to).sort((a, b) => a.at - b.at)) {
        queue = queue.filter((t) => t !== due);
        due.run();
      }
    };

    let on = true;
    const fired: [number, Beat][] = [];
    // A copy, so an assertion narrows the copy rather than the log itself.
    const seen = (): [number, Beat][] => [...fired];
    const beats = createBeats(() => on, clock);
    beats.play(CELEBRATE_BEATS, (beat) => fired.push([now, beat]));
    assert.deepEqual(seen(), [[0, 'success']], 'the success does not land at once');
    assert.equal(beats.pending(), 2, 'the medium and the light are not waiting');
    advance(140);
    assert.deepEqual(seen(), [[0, 'success'], [140, 'medium']], 'the medium does not land at 140');
    on = false; // the switch goes off, or a microphone opens, mid-pattern
    advance(280);
    assert.deepEqual(seen(), [[0, 'success'], [140, 'medium']], 'a beat fired after the switch went off');
    assert.equal(beats.pending(), 0);

    // Switched off before it starts: nothing at all.
    fired.length = 0;
    beats.play(CELEBRATE_BEATS, (beat) => fired.push([now, beat]));
    advance(1000);
    assert.deepEqual(seen(), [], 'a celebration played with haptics off');

    // Cancelled mid-pattern: what had not fired never does.
    on = true;
    now = 2000;
    beats.play(CELEBRATE_BEATS, (beat) => fired.push([now, beat]));
    advance(2100);
    beats.cancel();
    assert.equal(beats.pending(), 0, 'cancelling left beats waiting');
    advance(5000);
    assert.deepEqual(seen(), [[2000, 'success']], 'a cancelled beat still fired');

    // A new celebration replaces one still sounding rather than doubling it.
    fired.length = 0;
    beats.play(CELEBRATE_BEATS, (beat) => fired.push([now, beat]));
    advance(5100);
    beats.play(CELEBRATE_BEATS, (beat) => fired.push([now, beat]));
    advance(6000);
    assert.deepEqual(
      seen().map(([, beat]) => beat),
      ['success', 'success', 'medium', 'light'],
      'two celebrations overlapped instead of the second replacing the first',
    );

    // A tick is never closer than 60 ms to the last one.
    assert.equal(TICK_GAP_MS, 60);
    let t = 0;
    const gate = createThrottle(TICK_GAP_MS, { now: () => t });
    const ticks: number[] = [];
    for (t = 0; t <= 200; t += 20) if (gate()) ticks.push(t);
    assert.deepEqual(ticks, [0, 60, 120, 180], 'ticks ran closer together than 60 ms');

    // The web half answers all four with nothing.
    assert.equal(tick(), undefined);
    assert.equal(thump(), undefined);
    assert.equal(celebrate(), undefined);
    assert.equal(cancelHaptics(), undefined);

    // The device half wires the same player to the real switch and the real engine.
    const native = read('./haptics.native.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const body = (name: string): string => {
      const at = native.indexOf(`export function ${name}(`);
      assert.notEqual(at, -1, `haptics.native.ts has no ${name}`);
      const next = native.indexOf('\nexport ', at + 1);
      return native.slice(at, next === -1 ? undefined : next);
    };
    assert.match(native, /const beats = createBeats\(hapticsEnabled\);/, 'the celebration does not ask the haptic switch on every beat');
    assert.match(body('celebrate'), /beats\.play\(CELEBRATE_BEATS,/, 'the celebration does not play the one pattern');
    assert.match(body('celebrate'), /NotificationFeedbackType\.Success/, 'the celebration does not open on a success');
    assert.match(body('celebrate'), /ImpactFeedbackStyle\.Medium/, 'the celebration has no medium beat');
    assert.match(body('celebrate'), /ImpactFeedbackStyle\.Light/, 'the celebration has no light beat');
    assert.match(body('cancelHaptics'), /beats\.cancel\(\)/, 'cancelHaptics does not drop the waiting beats');
    assert.match(body('tick'), /if \(!hapticsEnabled\(\) \|\| !tickGate\(\)\) return;/, 'a tick ignores the switch or the 60 ms gap');
    assert.match(native, /const tickGate = createThrottle\(TICK_GAP_MS\);/, 'the tick gap is not the 60 ms gate');
    assert.match(body('tick'), /selectionAsync\(\)/, 'a tick is not a selection response');
    assert.match(body('thump'), /if \(!hapticsEnabled\(\)\) return;/, 'a thump ignores the switch');
    assert.match(body('thump'), /ImpactFeedbackStyle\.Medium/, 'a thump is not a medium impact');
    // The pure half stays loadable by this suite.
    assert.doesNotMatch(read('./hapticBeats.ts'), /^\s*import\b/m, 'hapticBeats.ts imports something, so this suite may fail to load it');
  });
});
