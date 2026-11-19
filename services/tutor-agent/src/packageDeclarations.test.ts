import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { builtinModules } from 'node:module';

// B3a-9: a package that resolves only by hoisting from another workspace breaks the
// day that workspace drops it. Node built-ins and @luvani/* workspaces need no line.
test('every bare package a tutor-agent source imports is declared in its package.json', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const declared = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
  const src = new URL('./', import.meta.url);
  const undeclared: string[] = [];
  for (const file of readdirSync(src, { recursive: true }).map(String).filter(name => name.endsWith('.ts'))) {
    const code = readFileSync(new URL(file, src), 'utf8');
    const specifiers = /^\s*(?:import|export)\b[^'";]*?\bfrom\s*['"]([^'"\s]+)['"]|^\s*import\s*['"]([^'"\s]+)['"]|\bimport\(\s*['"]([^'"\s]+)['"]\s*\)|\bcreateRequire\([^)]*\)\(\s*['"]([^'"\s]+)['"]\s*\)/gm;
    for (const match of code.matchAll(specifiers)) {
      const spec = match.slice(1).find(Boolean)!;
      if (spec.startsWith('.') || spec.startsWith('node:') || builtinModules.includes(spec)) continue;
      const name = spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/');
      if (!name.startsWith('@luvani/') && !declared.has(name)) undeclared.push(`${name} in src/${file}`);
    }
  }
  assert.deepEqual(undeclared, []);
});
