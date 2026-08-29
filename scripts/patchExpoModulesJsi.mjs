#!/usr/bin/env node
/**
 * Keep ExpoModulesJSI's intermediate XCFramework unsigned.
 *
 * On macOS File Provider folders, metadata can be attached to the generated
 * framework and make the nested codesign step fail. The outer app build still
 * performs its normal signing. Remove this patch when Expo fixes the affected
 * package version.
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
const AFFECTED_VERSION = '57.0.6';
const NEEDLE = '    SWIFT_COMPILATION_MODE=wholemodule \\\n  )';
const REPLACEMENT = '    SWIFT_COMPILATION_MODE=wholemodule \\\n    CODE_SIGNING_ALLOWED=NO \\\n  )';

if (!existsSync(PACKAGE_JSON) || !existsSync(BUILD_SCRIPT)) {
  process.exit(0);
}

const { version } = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
if (version !== AFFECTED_VERSION) {
  console.log(`expo-modules-jsi: ${version} is not the patched ${AFFECTED_VERSION}; leaving it unchanged`);
  process.exit(0);
}

const source = readFileSync(BUILD_SCRIPT, 'utf8');
if (source.includes('    CODE_SIGNING_ALLOWED=NO \\\n')) {
  console.log('expo-modules-jsi: iOS signing workaround already applied');
  process.exit(0);
}

if (!source.includes(NEEDLE)) {
  throw new Error('expo-modules-jsi build script changed; the iOS signing workaround needs review');
}

writeFileSync(BUILD_SCRIPT, source.replace(NEEDLE, REPLACEMENT));
console.log('expo-modules-jsi: applied iOS signing workaround');
