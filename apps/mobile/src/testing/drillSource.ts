/**
 * The drill's source text for tests that pin it by regex. The kind views
 * moved out of DrillScreen into `drill/kinds/` (drill-b T1), so a pin that
 * read DrillScreen alone reads the screen and its kinds together, and a count
 * across the drill stays the same count.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The kind files, relative to `src/`, in a stable order. */
export const DRILL_KIND_FILES: readonly string[] = readdirSync(join(SRC, 'drill', 'kinds'))
  .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
  .sort()
  .map((name) => `drill/kinds/${name}`);

/** One file under `src/`, as text. */
export function readSrc(path: string): string {
  return readFileSync(join(SRC, path), 'utf8');
}

/** DrillScreen.tsx followed by every kind file, as one text. */
export function drillSource(): string {
  return ['DrillScreen.tsx', ...DRILL_KIND_FILES].map(readSrc).join('\n');
}
