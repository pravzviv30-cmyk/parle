'use strict';
/**
 * The one rule metro.config.js adds to Metro's resolver.
 *
 * Every import in this app names its file, `./apple.ts` rather than `./apple`, because the
 * tests run under `node --test --experimental-strip-types`, which resolves nothing it is not
 * told. Metro, though, tries `apple.ios.ts`, `apple.native.ts` and only then `apple.ts` for an
 * extensionless request, and takes a request that already ends in `.ts` as that exact file.
 * Left alone, the phone was bundled with the web stand-in of every `.native.ts` module: no
 * LiveKit globals, no Apple sheet, no store (F382, found on the first native run).
 *
 * So a relative source request loses its extension here, and Metro's own resolver chooses the
 * platform file the way it would for an extensionless import. Packages, assets and JSON are
 * left exactly as written.
 */

const SOURCE_EXT = /\.tsx?$/;

/** `./apple.ts` becomes `./apple`; `react-native` and `./art.json` stay themselves. */
function platformAwareRequest(moduleName) {
  if (!moduleName.startsWith('.')) return moduleName;
  return SOURCE_EXT.test(moduleName) ? moduleName.replace(SOURCE_EXT, '') : moduleName;
}

module.exports = { platformAwareRequest };
