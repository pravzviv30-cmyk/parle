import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createProfile } from '@luvani/brain';

import { loadProfile, saveProfile } from './profileStore.ts';

const dir = mkdtempSync(join(tmpdir(), 'luvani-profile-'));
after(() => rmSync(dir, { recursive: true, force: true }));

describe('the profile store', () => {
  test('a missing file means a fresh learner, not a crash', () => {
    const profile = loadProfile(join(dir, 'nope.json'));
    assert.deepEqual(profile, createProfile());
  });

  test('round-trips a profile', () => {
    const path = join(dir, 'profile.json');
    const profile = createProfile();
    profile.stats.sessions = 3;
    saveProfile(profile, path);
    assert.deepEqual(loadProfile(path), profile);
  });

  test('writes atomically — no tmp file left behind', () => {
    const path = join(dir, 'atomic.json');
    saveProfile(createProfile(), path);
    assert.ok(existsSync(path));
    assert.ok(!existsSync(`${path}.tmp`));
  });

  test('a corrupt file steps aside as .bak and a fresh profile takes over', () => {
    const path = join(dir, 'corrupt.json');
    writeFileSync(path, '{ this is not json', 'utf8');
    const profile = loadProfile(path);
    assert.deepEqual(profile, createProfile());
    assert.ok(existsSync(`${path}.bak`), 'the corrupt file must be kept for inspection');
    assert.equal(readFileSync(`${path}.bak`, 'utf8'), '{ this is not json');
  });

  test('an unrecognized version steps aside too', () => {
    const path = join(dir, 'versioned.json');
    writeFileSync(path, JSON.stringify({ version: 99 }), 'utf8');
    assert.deepEqual(loadProfile(path), createProfile());
    assert.ok(existsSync(`${path}.bak`));
  });
});
