import { readFileSync } from 'node:fs';
/** Source wiring complements executable rules; it does not prove native hardware behavior. */
export function evidence(path: string): string {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ');
}
