/**
 * The device build contract.
 *
 * Luvani ran in a browser for its whole life. `app.json` and `package.json` are the two
 * files that decide whether it can also run on a phone, and neither of them is imported
 * by anything, so nothing fails when they drift. Four things can be lost silently here,
 * and each costs an afternoon to rediscover on a device rather than in a test.
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
 * The fourth is the artwork. Until 2026-09-27 app.json still pointed at Expo's template
 * icon, splash grid and favicon, days after the brand mark had been drawn, and nothing
 * failed. Every slot now reads a raster of an SVG master in `assets/brand/`, and the
 * rules the platforms enforce only at review or on a launcher are held here: no alpha on
 * the store icon, see-through layers on the ground colour, and the adaptive layers inside
 * the circle a round launcher keeps.
 *
 * Written as a source walk rather than as a mock, in the mould of
 * `services/token-server/src/ciContract.test.ts`: the thing being defended is a file, so
 * a file is what gets read.
 */

import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { describe, test } from 'node:test';

const MOBILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const read = (name: string): string => readFileSync(path.join(MOBILE, name), 'utf8');

const manifest = JSON.parse(read('package.json')) as {
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
};

const appConfig = JSON.parse(read('app.json')) as {
  expo: {
    scheme: string;
    icon: string;
    ios: { bundleIdentifier: string };
    android: {
      package: string;
      adaptiveIcon: { foregroundImage: string; monochromeImage: string; backgroundImage?: string };
    };
    web: { favicon: string };
    plugins: ReadonlyArray<string | [string, { image?: string }]>;
  };
};

/** The header of a PNG: size, and whether it has an alpha channel (colour type 6) or not (2). */
function pngHeader(file: string): { bytes: Buffer; width: number; height: number; colourType: number } {
  const bytes = readFileSync(path.join(MOBILE, file));
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', `${file} is not a PNG`);
  return { bytes, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colourType: bytes[25]! };
}

/**
 * How far the farthest visible pixel sits from the centre, as a share of the width.
 * Decodes an 8-bit, non-interlaced RGBA PNG, which is what the brand rasters are.
 */
function reachFromCentre(file: string): number {
  const { bytes, width, height } = pngHeader(file);
  assert.deepEqual([bytes[24], bytes[25], bytes[28]], [8, 6, 0], `${file} is not the 8-bit RGBA this reader decodes`);
  const data: Buffer[] = [];
  for (let at = 8; at < bytes.length; at += 12 + bytes.readUInt32BE(at)) {
    if (bytes.toString('ascii', at + 4, at + 8) === 'IDAT') data.push(bytes.subarray(at + 8, at + 8 + bytes.readUInt32BE(at)));
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * 4;
  let previous = Buffer.alloc(stride);
  let farthest = 0;
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(stride);
    const filter = raw[y * (stride + 1)]!;
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? row[x - 4]! : 0;
      const up = previous[x]!;
      const corner = x >= 4 ? previous[x - 4]! : 0;
      const guess = left + up - corner;
      const paeth =
        Math.abs(guess - left) <= Math.abs(guess - up) && Math.abs(guess - left) <= Math.abs(guess - corner)
          ? left
          : Math.abs(guess - up) <= Math.abs(guess - corner) ? up : corner;
      const predictor = [0, left, up, (left + up) >> 1, paeth][filter]!;
      row[x] = (raw[y * (stride + 1) + 1 + x]! + predictor) & 255;
    }
    for (let x = 0; x < width; x++) {
      if (row[x * 4 + 3]! > 0) farthest = Math.max(farthest, Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2));
    }
    previous = row;
  }
  return farthest / width;
}

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

  test('the app is built with the brand mark rather than the template artwork', () => {
    const { icon, android, web, plugins } = appConfig.expo;
    const splash = plugins.find((entry): entry is [string, { image?: string }] => Array.isArray(entry) && entry[0] === 'expo-splash-screen');
    const slots = {
      icon,
      adaptiveForeground: android.adaptiveIcon.foregroundImage,
      adaptiveMonochrome: android.adaptiveIcon.monochromeImage,
      favicon: web.favicon,
      splash: splash?.[1].image,
    };
    for (const [slot, file] of Object.entries(slots)) {
      assert.ok(file !== undefined && file.startsWith('./assets/brand/'), `${slot} is not drawn from the brand masters in assets/brand: ${file}`);
      assert.ok(existsSync(path.join(MOBILE, file)), `${slot} points at ${file}, which does not exist`);
    }
    // The App Store refuses an icon with an alpha channel, and wants it 1024 square.
    const store = pngHeader(slots.icon);
    assert.deepEqual([store.width, store.height, store.colourType], [1024, 1024, 2], 'the app icon is not a 1024 square without alpha');
    // These sit on the ground colour, so a layer without alpha paints a square over it.
    for (const slot of ['adaptiveForeground', 'adaptiveMonochrome', 'splash'] as const) {
      const layer = pngHeader(slots[slot]!);
      assert.equal(layer.width, layer.height, `${slot} is not square`);
      assert.equal(layer.colourType, 6, `${slot} has no alpha channel`);
    }
    // Android keeps as little as a circle 66dp across out of the 108dp adaptive layer.
    for (const slot of ['adaptiveForeground', 'adaptiveMonochrome'] as const) {
      assert.ok(reachFromCentre(slots[slot]!) <= 33 / 108, `${slot} reaches past the adaptive icon's safe zone, so a round launcher clips the mark`);
    }
    assert.equal(android.adaptiveIcon.backgroundImage, undefined, 'the adaptive icon has a background picture again; its background is the ground colour');
  });
});
