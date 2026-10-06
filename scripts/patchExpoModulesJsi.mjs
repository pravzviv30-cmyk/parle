#!/usr/bin/env node
/**
 * Keep ExpoModulesJSI's intermediate XCFramework unsigned.
 *
 * On macOS File Provider folders, metadata can be attached to the generated
 * framework and make the nested codesign step fail. The outer app build still
 * performs its normal signing. Remove this patch when Expo fixes the affected
 * package version.
 *
 * 57.1.1, which arrived with Expo 57.0.27, still signs the intermediate
 * framework: its only change to the nested build is two coverage settings after
 * the anchor below. A version not listed here is left alone, and
 * `apps/mobile/src/app/deviceBuildContract.test.ts` fails the gate until someone
 * has read the new build script and either listed it or deleted this patch.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_JSON = path.join(ROOT, 'node_modules/expo-modules-jsi/package.json');
const BUILD_SCRIPT = path.join(
  ROOT,
  'node_modules/expo-modules-jsi/apple/scripts/build-xcframework.sh',
);
const AFFECTED_VERSIONS = ['57.0.6', '57.1.1'];
// The setting the signing switch goes straight after. In 57.0.6 it closes the
// nested xcodebuild call; in 57.1.1 two coverage settings follow it.
const ANCHOR = '    SWIFT_COMPILATION_MODE=wholemodule \\\n';
const SIGNING = '    CODE_SIGNING_ALLOWED=NO \\\n';

if (!existsSync(PACKAGE_JSON) || !existsSync(BUILD_SCRIPT)) {
  process.exit(0);
}

const { version } = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
if (!AFFECTED_VERSIONS.includes(version)) {
  console.log(`expo-modules-jsi: ${version} is not a patched version (${AFFECTED_VERSIONS.join(', ')}); leaving it unchanged`);
  process.exit(0);
}

const source = readFileSync(BUILD_SCRIPT, 'utf8');
if (source.includes(SIGNING)) {
  console.log('expo-modules-jsi: iOS signing workaround already applied');
  process.exit(0);
}

if (source.split(ANCHOR).length !== 2) {
  throw new Error('expo-modules-jsi build script changed; the iOS signing workaround needs review');
}

writeFileSync(BUILD_SCRIPT, source.replace(ANCHOR, ANCHOR + SIGNING));
console.log(`expo-modules-jsi: applied iOS signing workaround to ${version}`);
