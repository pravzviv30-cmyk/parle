/**
 * The device build contract.
 *
 * Luvani ran in a browser for its whole life. `app.json` and `package.json` are the two
 * files that decide whether it can also run on a phone, and neither of them is imported
 * by anything, so nothing fails when they drift. Three things can be lost silently here,
 * and all three cost an afternoon each to rediscover on a device rather than in a test.
 *
 * The first is the dev client. Expo Go cannot load `@livekit/react-native-webrtc`'s
 * native module, so a build without `expo-dev-client` is a build with no live voice —
 * and the symptom is a red screen at import time, far from the cause.
 *
 * The second is the local-development flag. Metro is what inlines `EXPO_PUBLIC_` names
 * into the bundle, so the flag has to sit on the script that starts Metro. A new script
 * added without the prefix produces an app that refuses to boot at all, because
 * `selectTokenServerUrl` throws on a missing token server URL outside local development.
 *
 * The third is the pair of identifiers. `docs/DEVICE_VERIFICATION.md` tells a human to
 * attach a debugger to `com.luvani.app` and to follow a `luvani://` link. If someone
 * changes the bundle identifier to get past a signing error — which is a real and
 * reasonable thing to do — the runbook silently starts describing a different app.
 *
 * Written as a source walk rather than as a mock, in the mould of
 * `services/token-server/src/ciContract.test.ts`: the thing being defended is a file, so
 * a file is what gets read.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const MOBILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const read = (name: string): string => readFileSync(path.join(MOBILE, name), 'utf8');

const manifest = JSON.parse(read('package.json')) as {
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
};

const appConfig = JSON.parse(read('app.json')) as {
  expo: { scheme: string; ios: { bundleIdentifier: string }; android: { package: string } };
};

const runbook = readFileSync(path.join(MOBILE, '..', '..', 'docs', 'DEVICE_VERIFICATION.md'), 'utf8');

/** The flag every script that starts Metro has to carry. */
const LOCAL_DEVELOPMENT = 'EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT=1';

describe('the device build contract', () => {
  test('the app declares the dev client a device build cannot start without', () => {
    assert.ok(
      manifest.dependencies['expo-dev-client'],
      'expo-dev-client is gone, so the only build that can load the native WebRTC module is gone with it',
    );
  });

  test('a start script attaches to the dev client rather than Expo Go', () => {
    const attaching = Object.entries(manifest.scripts).filter(([, body]) => body.includes('--dev-client'));
    assert.ok(
      attaching.length > 0,
      'no script starts Metro for a dev client, so the only way onto a phone is by hand',
    );
  });

  test('every script that starts Metro pins explicit local development', () => {
    // `export:web` deliberately does not, and does not start Metro either — it is the
    // deployed bundle, and `apps/mobile/.env.example` says never to set the flag there.
    for (const [name, body] of Object.entries(manifest.scripts)) {
      if (!body.includes('expo start') && !body.includes('expo run:')) continue;
      assert.ok(
        body.includes(LOCAL_DEVELOPMENT),
        `"${name}" starts the app without ${LOCAL_DEVELOPMENT}, so the bundle it builds has no token server and refuses to boot`,
      );
    }
  });

  test('the identifiers the device runbook names are the identifiers the app is built with', () => {
    const { scheme, ios, android } = appConfig.expo;
    assert.equal(ios.bundleIdentifier, android.package, 'the two platforms have drifted apart');
    for (const named of [ios.bundleIdentifier, scheme]) {
      assert.ok(
        runbook.includes(`\`${named}\``),
        `docs/DEVICE_VERIFICATION.md does not mention "${named}", so the runbook is describing an app that is no longer built`,
      );
    }
  });
});
