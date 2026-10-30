import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { parseArgs, planShots, viewSize } from './capture.mjs';
import { chromiumRevisions } from './browserPath.mjs';

describe('capture arguments', () => {
  test('defaults to phone and small, light and dark, in the shots folder', () => {
    const o = parseArgs(['--url', 'http://localhost:8093', '--name', 'today'], {});
    assert.deepEqual(o.views, ['phone', 'small']);
    assert.deepEqual(o.schemes, ['light', 'dark']);
    assert.equal(o.motion, 'no-preference');
    assert.equal(o.waitText, undefined);
    assert.equal(o.out, resolve(join(tmpdir(), 'luvani-shots', 'shots')));
  });

  test('LUVANI_SHOTS_DIR moves the default output and --out beats it', () => {
    const base = ['--url', 'u', '--name', 'n'];
    assert.equal(parseArgs(base, { LUVANI_SHOTS_DIR: '/x/shots-root' }).out, resolve('/x/shots-root', 'shots'));
    assert.equal(parseArgs([...base, '--out', '/y/here'], { LUVANI_SHOTS_DIR: '/x' }).out, resolve('/y/here'));
  });

  test('reads lists, motion and wait text', () => {
    const o = parseArgs(['--url', 'u', '--name', 'n', '--views', 'phone, 390x844', '--schemes', 'dark', '--motion', 'reduce', '--wait-text', 'Bonjour'], {});
    assert.deepEqual(o.views, ['phone', '390x844']);
    assert.deepEqual(o.schemes, ['dark']);
    assert.equal(o.motion, 'reduce');
    assert.equal(o.waitText, 'Bonjour');
  });

  test('refuses missing, unknown and malformed input', () => {
    assert.throws(() => parseArgs(['--name', 'n'], {}), /--url is required/);
    assert.throws(() => parseArgs(['--url', 'u'], {}), /--name is required/);
    assert.throws(() => parseArgs(['--url', 'u', '--name', 'a/b'], {}), /--name may only use/);
    assert.throws(() => parseArgs(['--url', 'u', '--name', 'n', '--views', 'tablet'], {}), /unknown view "tablet"/);
    assert.throws(() => parseArgs(['--url', 'u', '--name', 'n', '--schemes', 'sepia'], {}), /unknown scheme "sepia"/);
    assert.throws(() => parseArgs(['--url', 'u', '--name', 'n', '--motion', 'fast'], {}), /--motion must be/);
    assert.throws(() => parseArgs(['--url', 'u', '--name', 'n', '--bogus', '1'], {}), /unknown option --bogus/);
    assert.throws(() => parseArgs(['--url', 'u', '--name'], {}), /--name needs a value/);
  });
});

describe('capture matrix', () => {
  test('viewSize knows the presets and WxH', () => {
    assert.deepEqual(viewSize('phone'), [375, 812]);
    assert.deepEqual(viewSize('small'), [320, 640]);
    assert.deepEqual(viewSize('desktop'), [1280, 800]);
    assert.deepEqual(viewSize('390x844'), [390, 844]);
  });

  test('plans one shot per view and scheme, views outer, named name-view-scheme.png', () => {
    const plan = planShots({ name: 'today', views: ['phone', 'small'], schemes: ['light', 'dark'], out: '/o' });
    assert.deepEqual(plan.map((p) => p.file), [
      '/o/today-phone-light.png', '/o/today-phone-dark.png', '/o/today-small-light.png', '/o/today-small-dark.png',
    ]);
    assert.deepEqual([plan[0].width, plan[0].height, plan[3].width, plan[3].height], [375, 812, 320, 640]);
    assert.deepEqual(plan.map((p) => p.scheme), ['light', 'dark', 'light', 'dark']);
  });
});

describe('browser fallback', () => {
  test('lists cached chromium revisions newest first and skips headless shells', () => {
    assert.deepEqual(
      chromiumRevisions(['ffmpeg-1011', 'chromium_headless_shell-1300', 'chromium-1223', 'chromium-1248', 'chromium-99']),
      ['chromium-1248', 'chromium-1223', 'chromium-99'],
    );
  });
});
