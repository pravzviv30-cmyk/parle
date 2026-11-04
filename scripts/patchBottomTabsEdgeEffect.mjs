#!/usr/bin/env node
/**
 * Hide the iOS scroll edge effect at the top of every tab.
 *
 * On iOS 26 and later a white fade sits over the top of the first scroll view under
 * a native screen. The Tabs screen in `apps/mobile/src/nav/RootNavigator.tsx` turns it
 * off, but JS bottom-tabs wraps each tab in a react-native-screens `Screen` of its own
 * (`MaybeScreen` in `ScreenFallback`), which leaves every edge `automatic`, and the
 * inner screen wins. This gives that Screen `{ top: 'hidden' }`; the other edges stay
 * `automatic`. Remove this patch when bottom-tabs lets a tab set the option itself.
 *
 * A version not listed here is left alone, and
 * `apps/mobile/src/app/deviceBuildContract.test.ts` fails the gate until someone has
 * read the new ScreenFallback and either listed it or deleted this patch.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE = path.join(ROOT, 'node_modules/@react-navigation/bottom-tabs');
const PACKAGE_JSON = path.join(PACKAGE, 'package.json');
const AFFECTED_VERSIONS = ['7.18.16'];
// Each file, the text the option goes with, and the text once it is there.
const FILES = [
  {
    file: path.join(PACKAGE, 'lib/module/views/ScreenFallback.js'),
    anchor: '      activityState: active,\n',
    patched: "      activityState: active,\n      scrollEdgeEffects: { top: 'hidden' },\n",
  },
  {
    file: path.join(PACKAGE, 'src/views/ScreenFallback.tsx'),
    anchor: '<Screens.Screen enabled={enabled} activityState={active} {...rest} />',
    patched: "<Screens.Screen enabled={enabled} activityState={active} scrollEdgeEffects={{ top: 'hidden' }} {...rest} />",
  },
];

if (!existsSync(PACKAGE_JSON) || FILES.some(({ file }) => !existsSync(file))) {
  process.exit(0);
}

const { version } = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
if (!AFFECTED_VERSIONS.includes(version)) {
  console.log(`@react-navigation/bottom-tabs: ${version} is not a patched version (${AFFECTED_VERSIONS.join(', ')}); leaving it unchanged`);
  process.exit(0);
}

let applied = false;
for (const { file, anchor, patched } of FILES) {
  const source = readFileSync(file, 'utf8');
  if (source.includes(patched)) continue;
  if (source.split(anchor).length !== 2) {
    throw new Error(`@react-navigation/bottom-tabs ${path.basename(file)} changed; the tab edge patch needs review`);
  }
  writeFileSync(file, source.replace(anchor, patched));
  applied = true;
}
console.log(
  applied
    ? `@react-navigation/bottom-tabs: hid the top scroll edge effect on each tab in ${version}`
    : '@react-navigation/bottom-tabs: tab edge patch already applied',
);
