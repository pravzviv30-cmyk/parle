/**
 * F382: the phone must get the native file, not the web stand-in.
 *
 * The bundle Metro served to the first native run carried auth/apple.ts, live/globals.ts,
 * purchases/adapter.ts and every other web twin, because each import names its file and
 * Metro applies `.native.ts` only to extensionless requests. These tests hold the resolver
 * rule that repairs it, and the file layout it depends on.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(APP, 'src');

const { platformAwareRequest } = require(path.join(APP, 'metro.platform.cjs')) as {
  platformAwareRequest: (moduleName: string) => string;
};

function nativeVariants(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) nativeVariants(full, out);
    else if (/\.(ios|android|native)\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe('the phone gets the native file, not the web stand-in — F382', () => {
  test('a relative source request loses its extension so Metro can choose the platform file — F382', () => {
    assert.equal(platformAwareRequest('./apple.ts'), './apple');
    assert.equal(platformAwareRequest('../progress/saveFile.ts'), '../progress/saveFile');
    assert.equal(platformAwareRequest('./components.tsx'), './components');
    // Packages and non-source files are not this rule's business.
    assert.equal(platformAwareRequest('react-native'), 'react-native');
    assert.equal(platformAwareRequest('expo-apple-authentication'), 'expo-apple-authentication');
    assert.equal(platformAwareRequest('@luvani/core'), '@luvani/core');
    assert.equal(platformAwareRequest('./art.json'), './art.json');
    assert.equal(platformAwareRequest('../assets/voices/luc.m4a'), '../assets/voices/luc.m4a');
  });

  test('metro.config.js routes every request through it — F382', () => {
    const config = require(path.join(APP, 'metro.config.js')) as {
      resolver: { resolveRequest: (context: unknown, moduleName: string, platform: string | null) => unknown };
    };
    const seen: Array<[string, string | null]> = [];
    const context = {
      resolveRequest: (_context: unknown, moduleName: string, platform: string | null) => {
        seen.push([moduleName, platform]);
        return { type: 'sourceFile', filePath: moduleName };
      },
    };
    config.resolver.resolveRequest(context, './auth/apple.ts', 'ios');
    config.resolver.resolveRequest(context, 'react-native', 'ios');
    assert.deepEqual(seen, [
      ['./auth/apple', 'ios'],
      ['react-native', 'ios'],
    ]);
  });

  test('every native variant has the web file its extensionless request falls back to — F382', () => {
    const variants = nativeVariants(SRC);
    assert.ok(variants.length >= 8, `expected the app's native variants, found ${variants.length}`);
    for (const variant of variants) {
      const twin = variant.replace(/\.(ios|android|native)(\.tsx?)$/, '$2');
      assert.ok(existsSync(twin), `${path.relative(APP, variant)} has no web twin at ${path.relative(APP, twin)}`);
    }
  });
});
