import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTutorPreview, type PreviewPlayback, type PreviewPlayer } from './tutorPreview.ts';

const running: PreviewPlayback = {
  playing: true, isLoaded: true, isBuffering: false, didJustFinish: false,
  currentTime: 1.5, duration: 6, error: null,
};

function rig(web = true) {
  const events: string[] = [];
  const players: Array<PreviewPlayer & { emit: (status: Partial<PreviewPlayback>) => void }> = [];
  const timers = new Map<number, () => void>();
  let clock = 0;
  let resolveMode = () => {};
  let rejectMode = (_error: Error) => {};
  const ready = new Promise<void>((resolve, reject) => { resolveMode = resolve; rejectMode = reject; });
  const preview = createTutorPreview({
    web, ready: () => ready,
    createPlayer: (voice) => {
      let listener = (_status: PreviewPlayback) => {};
      // Keep the listener after unsubscribe, to exercise an already queued native event.
      const player = {
        load: () => { events.push(`load:${voice}`); },
        play: () => { events.push(`play:${voice}`); },
        pause: () => { events.push(`pause:${voice}`); },
        release: () => { events.push(`release:${voice}`); },
        subscribe: (next: (status: PreviewPlayback) => void) => {
          listener = next;
          return () => { events.push(`unsubscribe:${voice}`); };
        },
        emit: (status: Partial<PreviewPlayback>) => listener({ ...running, ...status }),
      };
      events.push(`create:${voice}`);
      players.push(player);
      return player;
    },
    later: (run) => { const id = ++clock; timers.set(id, run); return () => { timers.delete(id); }; },
  });
  return { preview, events, players, timers, resolveMode, rejectMode };
}

describe('tutor previews — listening without choosing', () => {
  test('nothing plays on entry and playback progress comes from the clip', () => {
    const { preview, events, players } = rig();
    assert.equal(preview.getSnapshot().voice, null);
    assert.equal(events.length, 0);
    preview.toggle('emilie');
    assert.equal(preview.getSnapshot().phase, 'loading', 'a request is not proof the clip is playing');
    players[0]!.emit({ currentTime: 2, duration: 8 });
    assert.equal(preview.getSnapshot().phase, 'playing');
    assert.equal(preview.getSnapshot().progress, 0.25);
    preview.stop();
  });

  test('pausing preserves the clip and resuming keeps its actual position', () => {
    const { preview, events, players } = rig();
    preview.toggle('emilie');
    players[0]!.emit({});
    preview.toggle('emilie');
    assert.equal(preview.getSnapshot().phase, 'paused');
    players[0]!.emit({ playing: false });
    assert.equal(preview.getSnapshot().currentTime, 1.5);
    preview.toggle('emilie');
    assert.equal(players.length, 1, 'resuming must use the paused source');
    assert.equal(events.filter((event) => event === 'play:emilie').length, 2);
    players[0]!.emit({ currentTime: 2 });
    assert.equal(preview.getSnapshot().phase, 'playing');
    preview.stop();
  });

  test('switching stops and releases the old voice before constructing the next one', () => {
    const { preview, events, players } = rig();
    preview.toggle('alexandre');
    players[0]!.emit({});
    preview.toggle('sarah');
    assert.ok(events.indexOf('pause:alexandre') < events.indexOf('create:sarah'));
    assert.ok(events.indexOf('release:alexandre') < events.indexOf('create:sarah'));
    players[0]!.emit({ didJustFinish: true, playing: false });
    assert.equal(preview.getSnapshot().voice, 'sarah', 'a queued old completion must not finish the new voice');
    assert.equal(preview.getSnapshot().phase, 'loading');
    preview.stop();
  });

  test('a queued pause after rapid pause and resume cannot cancel the new play request', () => {
    const { preview, players } = rig();
    preview.toggle('emilie');
    players[0]!.emit({});
    preview.toggle('emilie');
    preview.toggle('emilie');
    players[0]!.emit({ playing: false });
    assert.equal(preview.getSnapshot().phase, 'loading', 'the previous pause is not a new route interruption');
    players[0]!.emit({ currentTime: 2 });
    assert.equal(preview.getSnapshot().phase, 'playing');
    preview.stop();
  });

  test('web onplay at zero followed by loadeddata is loading until media time advances', () => {
    const { preview, players } = rig();
    preview.toggle('emilie');
    players[0]!.emit({ playing: true, currentTime: 0 });
    players[0]!.emit({ playing: false, isLoaded: true, currentTime: 0 });
    assert.equal(preview.getSnapshot().phase, 'loading', 'Expo web marks loadeddata paused while media time is still zero');
    players[0]!.emit({ playing: true, currentTime: 0.2 });
    assert.equal(preview.getSnapshot().phase, 'playing');
    assert.ok(preview.getSnapshot().progress > 0);
    preview.stop();
  });

  test('a finished sample returns to replay from its beginning on the next tap', () => {
    const { preview, events, players } = rig();
    preview.toggle('marie');
    players[0]!.emit({ playing: false, didJustFinish: true, currentTime: 6 });
    assert.equal(preview.getSnapshot().phase, 'ended');
    preview.toggle('marie');
    assert.equal(preview.getSnapshot().currentTime, 0);
    assert.equal(players.length, 2, 'a fresh source starts at zero without an asynchronous web seek');
    assert.equal(events.filter((event) => event === 'play:marie').length, 2);
    preview.stop();
  });

  test('a playback error is actionable and retry builds a fresh source', () => {
    const { preview, players } = rig();
    preview.toggle('anatole');
    players[0]!.emit({ playing: false, error: 'source unavailable' });
    assert.equal(preview.getSnapshot().phase, 'error');
    assert.match(preview.getSnapshot().error!, /try again/i);
    assert.equal(preview.getSnapshot().voice, 'anatole', 'failure has no effect on the independently chosen tutor');
    preview.toggle('anatole');
    assert.equal(preview.getSnapshot().error, null);
    assert.equal(players.length, 2);
    players[1]!.emit({});
    assert.equal(preview.getSnapshot().phase, 'playing');
    preview.stop();
  });

  test('a load that never starts offers retry instead of spinning indefinitely', () => {
    const { preview, timers, players } = rig();
    preview.toggle('guillaume');
    [...timers.values()][0]!();
    assert.equal(preview.getSnapshot().phase, 'error');
    players[0]!.emit({});
    assert.equal(preview.getSnapshot().phase, 'error', 'late success after a failed request cannot start audio');
    preview.stop();
  });

  test('an interrupted or disconnected route stays paused until an explicit new tap', () => {
    const { preview, events, players } = rig();
    preview.toggle('sarah');
    players[0]!.emit({});
    players[0]!.emit({ playing: false });
    assert.equal(preview.getSnapshot().phase, 'paused');
    players[0]!.emit({ playing: true });
    assert.equal(preview.getSnapshot().phase, 'paused');
    assert.equal(events.at(-1), 'pause:sarah', 'automatic recovery cannot surprise the learner with audio');
    preview.stop();
  });

  test('media services recovery stops playback instead of resuming an interrupted preview', () => {
    const { preview, players } = rig();
    preview.toggle('sarah');
    players[0]!.emit({});
    players[0]!.emit({ mediaServicesDidReset: true });
    assert.equal(preview.getSnapshot().phase, 'paused');
    preview.stop();
  });

  test('rapid native taps invalidate pending mode work before it can start the wrong voice', async () => {
    const { preview, events, resolveMode, players } = rig(false);
    preview.toggle('alexandre');
    preview.toggle('emilie');
    resolveMode();
    await Promise.resolve();
    assert.deepEqual(events.slice(0, 3), ['create:emilie', 'load:emilie', 'play:emilie']);
    assert.equal(players.length, 1);
    preview.stop();
  });

  test('a second tap cancels a loading native preview and leaving invalidates a later resume', async () => {
    const { preview, events, resolveMode } = rig(false);
    preview.toggle('alexandre');
    preview.toggle('alexandre');
    assert.equal(preview.getSnapshot().phase, 'paused');
    resolveMode();
    await Promise.resolve();
    assert.equal(events.length, 0);
    preview.toggle('alexandre');
    preview.stop();
    await Promise.resolve();
    assert.equal(events.length, 0);
    assert.equal(preview.getSnapshot().phase, 'idle');
  });

  test('a native session failure is recoverable without playing in the wrong mode', async () => {
    const { preview, events, rejectMode } = rig(false);
    preview.toggle('marie');
    rejectMode(new Error('audio session unavailable'));
    await Promise.resolve();
    assert.equal(preview.getSnapshot().phase, 'error');
    assert.equal(events.length, 0);
    preview.stop();
  });

  test('web playback starts in the gesture and stopping discards all queued native status', () => {
    const { preview, players, events } = rig();
    preview.toggle('marie');
    assert.ok(events.includes('play:marie'), 'the web play call must be synchronous with the tap');
    preview.stop();
    players[0]!.emit({});
    assert.equal(preview.getSnapshot().phase, 'idle');
    assert.equal(preview.getSnapshot().progress, 0);
  });
});
