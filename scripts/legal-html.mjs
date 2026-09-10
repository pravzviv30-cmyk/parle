/**
 * Render the legal documents to static pages: `npm run legal:html`.
 *
 * App Store Connect needs a privacy policy at a URL and a support URL. The app
 * needs the same words on a screen. This writes the second one from the first
 * one's source, so the hosted page and the screen cannot say different things.
 *
 * A root goes up with them, `index.html`, which Cloudflare serves at `/`. It is
 * a signpost rather than a page: it is generated from the same modules as the
 * two it links to, so it cannot name a page this script did not write, and the
 * bare address answers with the company rather than with a 404 (F487).
 *
 * The rendering itself lives in `apps/mobile/src/legal/html.ts`, where the
 * mobile test runner can reach it: `html.test.ts` regenerates both files and
 * fails when what is committed no longer matches the module. That is why the
 * drift check is a test rather than a new step in `scripts/gate.mjs` — it rides
 * `npm test`, which the gate already runs.
 *
 * The output is committed. It has to be, because the founder uploads it by hand
 * to Cloudflare Pages (`docs/LEGAL_HOSTING.md`), and a file that only exists
 * after somebody remembers to run a script is a file that goes up stale.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { legalPages } from '../apps/mobile/src/legal/html.ts';

/** Where the pages land. The whole folder is what gets dropped on Cloudflare. */
export const DIST = fileURLToPath(new URL('../apps/mobile/src/legal/dist/', import.meta.url));

/** Write every page, and say which ones were written. */
export function writeLegalPages(into = DIST) {
  mkdirSync(into, { recursive: true });
  const written = [];
  for (const { file, html } of legalPages()) {
    writeFileSync(join(into, file), html, 'utf8');
    written.push(file);
  }
  return written;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const file of writeLegalPages()) console.log(`legal: wrote ${file}`);
}
