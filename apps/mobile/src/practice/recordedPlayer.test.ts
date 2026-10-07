import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createPlaybackGate, playWhenCurrent } from './playbackGate.ts';
import { claimDailyPlayback, releaseDailyPlayback, ownsDailyPlayback } from '../daily/playback.ts';

// Execute the production hook with native audio and React lifecycle ports.
// No vendor, microphone, account storage or actual sound is involved.
function harness() {
  const cells: any[] = [];
  let cursor = 0;
  let focused = true;
  let state = 'active';
  let listener: ((state: string) => void) | undefined;
  const effects: (() => void)[] = [];
  const pending: (() => void)[] = [];
  const resets = new Set<() => void>();
  const played: number[] = [];
  let asset = 0;
  const player = { pause: () => {}, replace: (value: number) => { asset = value; }, play: () => { played.push(asset); } };
  const same = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const bindings = {
    useRef: (value: unknown) => cells[cursor++] ??= { current: value },
    useState: (value: unknown) => {
      const index = cursor++;
      const cell = cells[index] ??= { value };
      return [cell.value, (next: unknown) => { cell.value = next; }];
    },
    useCallback: (fn: unknown, deps: unknown[]) => {
      const index = cursor++;
      if (!cells[index] || !same(cells[index].deps, deps)) cells[index] = { fn, deps };
      return cells[index].fn;
    },
    useEffect: (effect: () => (() => void) | void, deps: unknown[]) => {
      const index = cursor++;
      const previous = cells[index];
      if (!previous || !same(previous.deps, deps)) {
        effects.push(() => { previous?.cleanup?.(); cells[index] = { deps, cleanup: effect() }; });
      }
    },
    AppState: { get currentState() { return state; }, addEventListener: (_event: string, fn: (value: string) => void) => { listener = fn; return { remove: () => { listener = undefined; } }; } },
    useIsFocused: () => focused,
    useAudioPlayer: () => player,
    useAudioPlayerStatus: () => ({ didJustFinish: false }),
    setAudioModeAsync: () => new Promise<void>(resolve => { pending.push(resolve); }),
    // The hook prepares through the audio session now (F723); it is held open the same way.
    enterVoicePlayback: () => new Promise<void>(resolve => { pending.push(resolve); }),
    useVoiceHold: () => {},
    createPlaybackGate, playWhenCurrent, claimDailyPlayback, releaseDailyPlayback, ownsDailyPlayback,
    onUserScopeReset: (hook: () => void) => { resets.add(hook); return () => resets.delete(hook); },
  };
  const source = readFileSync(new URL('./recordedPlayer.ts', import.meta.url), 'utf8');
  const production = source.slice(source.indexOf('export function useRecordedLine')).replace('export ', '');
  const hook = new Function(...Object.keys(bindings), stripTypeScriptTypes(production) + '\nreturn useRecordedLine;')(...Object.values(bindings));
  return {
    played, pending, player,
    render: (isCurrent = () => true) => { cursor = 0; const result = hook({ isCurrent }); effects.splice(0).forEach(fn => fn()); return result; },
    background: () => { state = 'background'; listener?.(state); },
    blur: () => { focused = false; },
    unmount: () => { cells.forEach(cell => cell?.cleanup?.()); },
    reset: () => { resets.forEach(hook => hook()); },
    settle: async () => { pending.splice(0).forEach(resolve => resolve()); for (let i = 0; i < 4; i++) await Promise.resolve(); },
  };
}

test('the actual recorded hook refuses a stale account or voice after audio preparation', async () => {
  for (const reason of ['account', 'voice']) {
    const h = harness();
    let current = true;
    h.render(() => current).play(7);
    current = false;
    await h.settle();
    assert.deepEqual(h.played, [], reason);
    assert.equal(h.render().playing, null);
    h.unmount();
  }
});

test('blur, background and unmount cancel held audio; a background tap starts no preparation', async () => {
  for (const leave of ['blur', 'background', 'unmount'] as const) {
    const h = harness();
    const line = h.render();
    line.play(7);
    h[leave]();
    if (leave === 'blur') h.render();
    if (leave === 'background') { line.play(8); assert.equal(h.pending.length, 1); }
    await h.settle();
    assert.deepEqual(h.played, [], leave);
    h.unmount();
  }
});

test('another screen taking the shared audio claim cannot be interrupted by an older held load', async () => {
  const h = harness();
  h.render().play(7);
  const next = { pause: () => {} };
  claimDailyPlayback(next);
  await h.settle();
  assert.deepEqual(h.played, []);
  assert.equal(h.render().playing, null);
  h.unmount();
  assert.equal(ownsDailyPlayback(next), true);
  releaseDailyPlayback(next);
});

test('explicit replay of the same asset plays again while its toggle still stops it', async () => {
  const h = harness();
  h.render().play(7); await h.settle();
  h.render().play(7); await h.settle();
  assert.deepEqual(h.played, [7, 7]);
  h.render().toggle(7);
  assert.equal(h.render().playing, null);
  assert.equal(h.pending.length, 0);
  h.unmount();
});
test('private tutor audio uses only local URIs and account reset stops held preparation immediately',async()=>{
 const h=harness();h.render().playUri('https://untrusted.invalid/audio.wav');assert.equal(h.pending.length,0);
 h.render().playUri('file:///private/cache/hashed.wav');h.reset();await h.settle();assert.deepEqual(h.played,[]);assert.equal(h.render().playingUri,null);h.unmount();
});
