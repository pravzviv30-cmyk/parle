/**
 * The goal record cannot see, or be seen by, the learning ledgers (Stage 4,
 * 2026-09-25). Contract test 10.
 *
 * A "used outside" report is the learner's word and nothing more. It must
 * never become a review grade, an activity entry, XP, a drill, momentum or
 * practice time, and nothing that computes those may read it. So the scan runs
 * both ways: nothing under `goals/` imports those modules (by path, by a core
 * re-export name, or by a dynamic import), and none of those modules imports
 * `goals/`. `reminders/reminder.test.ts` is the pattern, including the part
 * that matters most: the matcher is run over synthetic offenders in the same
 * suite, so a scan that silently matches nothing fails here.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const APP_SRC = fileURLToPath(new URL('../', import.meta.url));
const CORE_SRC = fileURLToPath(new URL('../../../../packages/core/src', import.meta.url));

/** The modules that hold or compute learning credit, as `src/`-relative paths without the extension. */
const LEDGERS: readonly string[] = [
  'review/store',
  'review/cardView',
  'drill/store',
  'drill/merge',
  'progress/activity',
  'progress/activeTime',
  'progress/activeDays',
  'progress/today',
  'progress/momentum',
  'progress/evidence',
  'progress/store',
  'practice/completion',
  'missions/store',
  'soundcheck/store',
  'topics/store',
];

/**
 * The same knowledge through core's re-exports. `review/store.ts` re-exports
 * the grade and schedule names below from `@luvani/core`, so a path ban alone
 * would be routed round in one line.
 */
const LEDGER_SYMBOLS: readonly string[] = [
  'totalXp',
  'levelFor',
  'mergeDecks',
  'dueCards',
  'applyGrade',
  'mergeCards',
  'newCard',
  'raiseEvidenceTo',
  'staggerNewCards',
  'practiceGrades',
  'buildProgressReport',
];

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function specifiers(source: string): string[] {
  const code = withoutComments(source);
  return [...code.matchAll(/(?:from|import|require)\s*\(?\s*'([^']+)'/g)].map((m) => m[1]!).filter(Boolean);
}

/** Resolve a relative specifier from a file under src/ to a src-relative path without extension. */
function resolved(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const abs = join(fromFile, '..', spec);
  return abs.slice(APP_SRC.length).replace(/\.tsx?$/, '');
}

/** Every way this goals-module source reaches a learning ledger. */
function forbiddenIn(source: string, file = join(HERE, 'probe.ts')): string[] {
  const found: string[] = [];
  for (const spec of specifiers(source)) {
    const target = resolved(file, spec);
    if (target !== null && LEDGERS.includes(target)) found.push(`imports '${spec}'`);
  }
  const code = withoutComments(source);
  for (const symbol of LEDGER_SYMBOLS) {
    if (new RegExp(`\\b${symbol}\\b`).test(code)) found.push(`names ${symbol}`);
  }
  return found;
}

/** Whether a ledger module's source imports anything under goals/. */
function importsGoals(source: string, file: string): string[] {
  return specifiers(source).filter((spec) => {
    const target = resolved(file, spec);
    return target !== null && target.startsWith('goals/');
  });
}

function goalModules(): string[] {
  return readdirSync(HERE).filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name));
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('the goal record and the learning ledgers never meet — contract test 10', () => {
  test('nothing under goals/ reaches review, activity, drills, momentum, XP or practice time', () => {
    const modules = goalModules();
    for (const expected of ['model.ts', 'store.ts', 'next.ts', 'evidence.ts']) {
      assert.ok(modules.includes(expected), `the scan found no goals/${expected}, so it is scanning less than it claims`);
    }
    for (const name of modules) {
      const file = join(HERE, name);
      const found = forbiddenIn(readFileSync(file, 'utf8'), file);
      assert.deepEqual(found, [], `goals/${name} can reach learning credit: it ${found.join(', ')}`);
    }
  });

  test('none of the ledgers imports goals/, so a self-report can never become credit', () => {
    for (const ledger of LEDGERS) {
      const file = join(APP_SRC, `${ledger}.ts`);
      const source = readFileSync(file, 'utf8');
      assert.deepEqual(importsGoals(source, file), [], `${ledger}.ts reads goals/, so a report could reach it`);
    }
    // And nothing under progress/ or review/ at all, beyond the named files.
    for (const dir of ['progress', 'review', 'drill']) {
      for (const file of sourceFiles(join(APP_SRC, dir))) {
        assert.deepEqual(importsGoals(readFileSync(file, 'utf8'), file), [], `${file.slice(APP_SRC.length)} reads goals/`);
      }
    }
  });

  test('only goals/store.ts writes the self-report, and only the goal screen calls it', () => {
    const callers = sourceFiles(APP_SRC)
      .filter((file) => /\brecordUsedOutside\(/.test(withoutComments(readFileSync(file, 'utf8'))))
      .map((file) => file.slice(APP_SRC.length))
      .sort();
    assert.deepEqual(callers, ['goals/GoalStepScreen.tsx', 'goals/store.ts']);
  });

  test('the scan bites: on a path, on a core name, on a dynamic import, and leaves prose and allowed imports alone', () => {
    assert.deepEqual(forbiddenIn("import { loadActivity } from '../progress/activity.ts';\n"), ["imports '../progress/activity.ts'"]);
    assert.deepEqual(forbiddenIn("import { totalXp } from '@luvani/core';\n"), ['names totalXp'], 'core re-exports route round a path ban');
    assert.deepEqual(forbiddenIn("export async function x() { return import('../review/store.ts'); }\n"), ["imports '../review/store.ts'"]);
    assert.deepEqual(forbiddenIn('/** Never touches progress/activity.ts or totalXp. */\nexport const x = 1;\n'), [], 'a comment is not an import');
    assert.deepEqual(forbiddenIn("import { packTargetsOf } from '../practice/history.ts';\n"), [], 'the pure practice reader is permitted');
    assert.deepEqual(forbiddenIn("import { factKey } from '../profile/memory.ts';\n"), []);
    const probe = join(APP_SRC, 'progress', 'probe.ts');
    assert.deepEqual(importsGoals("import { loadGoalSteps } from '../goals/store.ts';\n", probe), ['../goals/store.ts']);
  });

  test('every name the ban carries still exists, so it is a ban on something', () => {
    const sources = [...sourceFiles(APP_SRC), ...sourceFiles(CORE_SRC)]
      .filter((file) => !file.startsWith(HERE))
      .map((file) => readFileSync(file, 'utf8'));
    for (const symbol of LEDGER_SYMBOLS) {
      assert.ok(sources.some((s) => new RegExp(`\\b${symbol}\\b`).test(s)), `the ban names ${symbol}, which no longer exists`);
    }
    for (const ledger of LEDGERS) {
      assert.doesNotThrow(() => readFileSync(join(APP_SRC, `${ledger}.ts`)), `${ledger}.ts no longer exists; the scan is guarding a ghost`);
    }
  });
});
