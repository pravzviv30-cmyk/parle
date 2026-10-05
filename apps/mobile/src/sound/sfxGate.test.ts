/**
 * When a sound effect may play (F725, decisions D8 and D9).
 *
 * Original sounds, on by default, obeying the silent switch, silent while a microphone, voice
 * line or live room is open, and playable only once the founder has approved each one by ear.
 * The pipeline runs here through sound/sfxCore.ts with a fake player; the platform files
 * (sfx.native.ts, sfx.web.ts) reach expo-audio and are read as source.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SfxId } from './sfxIds.ts';
import { SFX_APPROVED, SFX_IDS } from './sfxManifest.ts';
import { createSfxCore, type SfxCoreDeps } from './sfxCore.ts';
import { COUNT_TICK_GAP_MS, SFX_PER_SECOND, createSfxThrottle, setSfxAppActive, sfxRefusal, suppressSfx } from './sfxGate.ts';
import { holdLive, holdMic, holdVoice } from './audioFocus.ts';
import { createAudioSession } from './audioSessionCore.ts';
import { SFX_MODE } from './audioModes.ts';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (name: string) => readFileSync(join(SRC, name), 'utf8');
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const ALL_APPROVED = Object.fromEntries(SFX_IDS.map((id) => [id, true])) as Record<SfxId, boolean>;
const NONE_APPROVED = Object.fromEntries(SFX_IDS.map((id) => [id, false])) as Record<SfxId, boolean>;

/** A core with a fake player, every condition but the one under test allowing the sound. */
function rig(overrides: Partial<SfxCoreDeps> = {}) {
  const created: SfxId[] = [];
  const played: SfxId[] = [];
  const paused: SfxId[] = [];
  let entered = 0;
  let clock = 0;
  const core = createSfxCore({
    approved: ALL_APPROVED,
    soundOn: () => true,
    now: () => clock,
    createPlayer: (id) => {
      created.push(id);
      return { play: () => { played.push(id); }, pause: () => { paused.push(id); }, seekTo: async () => {} };
    },
    enterSfx: async () => {
      entered += 1;
      return true;
    },
    currentMode: () => 'sfx',
    ...overrides,
  });
  return {
    core,
    created,
    played,
    paused,
    entered: () => entered,
    advance: (ms: number) => { clock += ms; },
  };
}

const clean = { approved: true, soundOn: true, micLive: false, voiceBusy: false, liveRoom: false, appActive: true, suppressed: false };

describe('sound effects ship only heard and play only when nothing else needs the ears', () => {
  test('an unapproved sound never plays', async () => {
    assert.equal(sfxRefusal({ ...clean, approved: false }), 'unapproved');

    // The real approvals: every sound the founder has not approved in its current form is silent,
    // and never even reaches a player or the audio session.
    const real = rig({ approved: SFX_APPROVED });
    for (const id of SFX_IDS) {
      const played = await real.core.play(id);
      real.advance(1000);
      assert.equal(played, SFX_APPROVED[id], `${id} ${played ? 'played' : 'stayed silent'} against its approval`);
    }
    const unapproved = SFX_IDS.filter((id) => !SFX_APPROVED[id]);
    assert.deepEqual(real.created.filter((id) => unapproved.includes(id)), [], 'a player was made for a sound nobody approved');
    real.core.warm(SFX_IDS);
    assert.deepEqual(real.created.filter((id) => unapproved.includes(id)), [], 'warming made a player for a sound nobody approved');

    // None approved: nothing is made, entered or played.
    const none = rig({ approved: NONE_APPROVED });
    for (const id of SFX_IDS) assert.equal(await none.core.play(id), false);
    none.core.warm(SFX_IDS);
    assert.deepEqual([none.created, none.played, none.entered()], [[], [], 0]);

    // The same rig plays an approved sound, so the silence above is the approval and not the rig.
    const one = rig({ approved: { ...NONE_APPROVED, correct: true } });
    assert.equal(await one.core.play('correct'), true);
    assert.deepEqual(one.played, ['correct']);
    assert.equal(await one.core.play('tap'), false);

    // Both platform halves pass the generated approvals in, and only they reach the files.
    for (const name of ['sound/sfx.native.ts', 'sound/sfx.web.ts']) {
      const code = stripComments(read(name));
      assert.match(code, /^import \{ SFX_APPROVED \} from '\.\/sfxManifest\.ts';$/m, `${name} does not read the approvals`);
      assert.match(code, /createSfxCore\(\{\s*approved: SFX_APPROVED,/, `${name} plays without the approval gate`);
    }
    const node = stripComments(read('sound/sfx.ts'));
    assert.doesNotMatch(node, /^import (?!type )/m, 'the node half reaches for something that could play');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) files.push(full);
      }
    };
    walk(SRC);
    const reachers = files
      .filter((path) => /from '[./]*(sound\/)?sfxSources\.ts'|assets\/sfx\//.test(stripComments(readFileSync(path, 'utf8'))))
      .map((path) => relative(SRC, path))
      .sort();
    assert.deepEqual(reachers, ['sound/sfx.native.ts', 'sound/sfx.web.ts', 'sound/sfxSources.ts'], 'something reaches the sound files around the gate');
    // The web half never preloads: that path makes a blob: URL the preview's policy refuses.
    assert.doesNotMatch(stripComments(read('sound/sfx.web.ts')), /preload|downloadFirst: true/);
  });

  test('sound effects stay silent while a microphone, voice line or live room is open', async () => {
    assert.equal(sfxRefusal({ ...clean, micLive: true }), 'microphone');
    assert.equal(sfxRefusal({ ...clean, voiceBusy: true }), 'voice');
    assert.equal(sfxRefusal({ ...clean, liveRoom: true }), 'live-room');

    for (const [label, hold] of [['microphone', holdMic], ['voice line', holdVoice], ['live room', holdLive]] as const) {
      const r = rig();
      const release = hold();
      assert.equal(await r.core.play('complete'), false, `a sound played while a ${label} was open`);
      assert.equal(r.entered(), 0, `the session was asked for the sound-effect mode while a ${label} was open`);
      release();
      r.advance(1000);
      assert.equal(await r.core.play('complete'), true, `a released ${label} still silences sound effects`);

      // A hold that appears while the mode is changing still wins: the gate is asked again.
      let open: () => void = () => {};
      const late = rig({ enterSfx: () => new Promise<boolean>((resolve) => { open = () => resolve(true); }) });
      const playing = late.core.play('save');
      const again = hold();
      open();
      assert.equal(await playing, false, `a sound played over a ${label} that opened during the mode change`);
      assert.deepEqual(late.played, []);
      again();
    }

    // The session behind it: under any hold, the mode is never switched to the one that obeys the
    // silent switch, so no recorder is stopped and no voice line is cut.
    const modes: unknown[] = [];
    const session = createAudioSession({ setMode: async (mode) => { modes.push(mode); }, holdVoice: () => () => {}, later: () => {} });
    for (const hold of [holdMic, holdVoice, holdLive]) {
      const release = hold();
      assert.equal(await session.enterSfx(), false);
      release();
    }
    assert.deepEqual(modes, []);
    assert.equal(await session.enterSfx(), true);
    assert.deepEqual(modes, [SFX_MODE]);

    // A voice line pauses a sound effect that is already playing before the mode changes
    // (review finding 5): the sound must not end during the line and close the session under it.
    const r = rig();
    session.setSfxPause(r.core.pauseAll);
    assert.equal(await r.core.play('correct'), true);
    await session.enterVoicePlayback();
    assert.deepEqual(r.paused, ['correct', 'correct']);

    // The live room is held for as long as LiveKit owns the session (globals.native.ts).
    const live = stripComments(read('live/globals.native.ts'));
    assert.match(live, /const release = holdLive\(\);\s*try \{\s*await AudioSession\.startAudioSession\(\);/);
  });

  test('the switch, the background and a safety stop each keep a sound quiet', async () => {
    assert.equal(sfxRefusal({ ...clean, soundOn: false }), 'sound-off');
    assert.equal(sfxRefusal({ ...clean, appActive: false }), 'background');
    assert.equal(sfxRefusal({ ...clean, suppressed: true }), 'suppressed');
    assert.equal(sfxRefusal(clean), null);

    let on = false;
    const r = rig({ soundOn: () => on });
    assert.equal(await r.core.play('select'), false);
    on = true;
    assert.equal(await r.core.play('select'), true);

    r.advance(1000);
    setSfxAppActive(false);
    assert.equal(await r.core.play('select'), false);
    setSfxAppActive(true);

    const release = suppressSfx();
    assert.equal(await r.core.play('select'), false);
    release();
    release();
    assert.equal(await r.core.play('select'), true, 'a released suppression still silences, or a double release went negative');

    // A session that ended up in another mode (a voice line won the race) plays nothing.
    const other = rig({ currentMode: () => 'voice' });
    assert.equal(await other.core.play('select'), false);
    // A player that throws is swallowed: a sound is a courtesy.
    const broken = rig({ createPlayer: () => ({ play: () => { throw new Error('released'); }, pause: () => {}, seekTo: () => undefined }) });
    assert.equal(await broken.core.play('select'), false);
    const refused = rig({ enterSfx: async () => { throw new Error('session refused'); } });
    assert.equal(await refused.core.play('select'), false);
  });

  test('at most four sounds a second, and count ticks at least 90 ms apart on their own clock', async () => {
    assert.equal(SFX_PER_SECOND, 4);
    assert.equal(COUNT_TICK_GAP_MS, 90);
    const throttle = createSfxThrottle();
    const admitted = [0, 10, 20, 30, 40].map((at) => throttle.admit('tap', at));
    assert.deepEqual(admitted, [true, true, true, true, false]);
    assert.equal(throttle.admit('select', 999), false);
    assert.equal(throttle.admit('select', 1000), true, 'the window does not move on');
    // Ticks: ten of them every 90 ms all play, one 89 ms after the last does not, and none of
    // them uses up the four a second the other sounds share.
    const ticks = Array.from({ length: 10 }, (_, i) => throttle.admit('count-tick', 2000 + i * 90));
    assert.deepEqual(ticks, Array(10).fill(true));
    assert.equal(throttle.admit('count-tick', 2000 + 9 * 90 + 89), false);
    assert.equal(throttle.admit('complete', 2100), true);

    // The pipeline applies it before it ever asks for the session.
    const r = rig();
    const results = [];
    for (let i = 0; i < 6; i += 1) results.push(await r.core.play('tap'));
    assert.deepEqual(results, [true, true, true, true, false, false]);
    assert.equal(r.entered(), 4);
    // One player per sound, made once, sent back to the start before each play.
    assert.deepEqual(r.created, ['tap']);
  });

  test('the native half keeps the session active after a sound, and pauses everything in the background', () => {
    const native = stripComments(read('sound/sfx.native.ts'));
    assert.match(native, /createAudioPlayer\(SFX_SOURCES\[id\], \{ keepAudioSessionActive: true \}\)/);
    assert.match(native, /setSfxPause\(core\.pauseAll\);/, 'a voice line cannot pause the sound effects');
    assert.match(native, /if \(state !== 'active'\) core\.pauseAll\(\);/);
    assert.match(native, /enterSfx,\s*currentMode: currentAudioMode,/);
    const web = stripComments(read('sound/sfx.web.ts'));
    assert.match(web, /userActivation/, 'the web half plays outside a gesture and meets the autoplay policy');
    assert.match(web, /addEventListener\('unhandledrejection', dropOurRefusal\)/);
    assert.match(web, /reason\.name !== 'NotAllowedError'/, 'the refusal listener swallows more than an autoplay refusal');
    // The three halves offer the same calls, so a screen that plays a sound loads anywhere.
    const exportsOf = (name: string) => [...stripComments(read(name)).matchAll(/^export function (\w+)/gm)].map((m) => m[1]).sort();
    assert.deepEqual(exportsOf('sound/sfx.native.ts'), exportsOf('sound/sfx.ts'));
    assert.deepEqual(exportsOf('sound/sfx.web.ts'), exportsOf('sound/sfx.ts'));
  });
});
