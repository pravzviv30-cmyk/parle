import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('..', import.meta.url));
const retired = ['home/AbilitiesCard.tsx', 'myfrench/LedgerLane.tsx'];

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? sources(full) : /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') ? [full] : [];
  });
}

test('retired Home and phrase-lane components stay absent while current evidence and phrase routes remain', () => {
  for (const file of retired) assert.equal(existsSync(join(src, file)), false, `${file} is an unused second UI`);
  for (const file of sources(src)) {
    const body = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(body, /(?:from\s*|import\s*\(|require\s*\()["'][^"']*(?:AbilitiesCard|LedgerLane)(?:\.tsx)?["']/, file);
    assert.doesNotMatch(body, /<(?:AbilitiesCard|LedgerLane)\b/, file);
  }
  const tab = readFileSync(join(src, 'tabs/MyFrenchTab.tsx'), 'utf8');
  assert.match(tab, /<LevelXpCard\b/);
  const library = readFileSync(join(src, 'tabs/MyFrenchLibraryTab.tsx'), 'utf8');
  assert.match(library, /open\('Phrasebook'\)/);
  const nav = readFileSync(join(src, 'nav/RootNavigator.tsx'), 'utf8');
  assert.match(nav, /<Stack\.Screen name="Phrasebook"/);
});
