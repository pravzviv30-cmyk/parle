/**
 * The instructions a newcomer follows, checked against the scripts they name.
 *
 * Both rules here exist because the README drifted away from the repo and the
 * only cost was somebody's afternoon: it named a script that cannot boot on a
 * laptop (F261), and it said nothing about the watcher failure that stops the
 * one documented command (F262). Prose that names a command is code with a
 * slower feedback loop, so it gets the same treatment.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

const ROOT = path.join(import.meta.dirname, '..', '..', '..', '..');
const readme = (): string => readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const tokenServerScripts = (): Record<string, string> =>
  JSON.parse(readFileSync(path.join(ROOT, 'services/token-server/package.json'), 'utf8')).scripts;

describe('the README can actually be followed', () => {
  test('the readme never tells anyone to start the token server in production mode', () => {
    // The rule has a reason, and the reason is checked rather than assumed: if
    // `start` ever stops being the production script this test should stop
    // caring, instead of guarding a spelling nobody depends on any more.
    const scripts = tokenServerScripts();
    assert.match(
      scripts.start ?? '',
      /NODE_ENV=production/,
      'the token server start script is no longer the production one; this rule needs rereading',
    );
    assert.match(scripts.dev ?? '', /LUVANI_LOCAL_DEVELOPMENT=1/);

    assert.doesNotMatch(
      readme(),
      /npm run start --workspace=@luvani\/token-server/,
      'the README tells a newcomer to run the token server in production mode, which exits(1) on any laptop: ' +
        'LIVEKIT_URL is ws:// not wss://, and LUVANI_AGENT_SECRET and LUVANI_ALLOWED_ORIGINS are unset by design locally',
    );
  });

  test('the readme records what to do when the watcher runs out of file descriptors', () => {
    const text = readme();
    // The failure is only worth documenting while the documented path still
    // walks into it — `npm run dev` runs the token server's watch script.
    assert.match(tokenServerScripts().dev ?? '', /--watch/);

    assert.match(text, /EMFILE/, 'the README does not name the error a reader will actually see');
    assert.match(
      text,
      /node --experimental-strip-types src\/server\.ts/,
      'the README names the failure without giving the command that gets past it',
    );
  });
});
