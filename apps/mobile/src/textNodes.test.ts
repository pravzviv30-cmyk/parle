/**
 * No empty string reaches a view as a text node — F728.
 *
 * `{issue && (<Text>…</Text>)}` reads as "draw the line when there is one",
 * and it is, until `issue` is the empty string it started as. Then `&&` hands
 * React the empty string itself, and a string child of a View is a text node
 * outside a Text: react-native-web logs "Unexpected text node" for every one
 * (`View/index.js:54-59`), 335 of them across one web onboarding run, and a
 * device can refuse to render it. The fix is the shape, not the value:
 * `{issue !== '' ? (…) : null}` hands React a boolean decision and nothing to
 * draw when there is nothing to say.
 *
 * So the walk below finds every string state that starts empty, declared with
 * `useState('')` or `useState<string>('')`, and refuses a `{… name && (` or
 * `{… name && <` in the same file. A negated `!name &&` is a boolean and is
 * allowed. A tripwire, read from the source as the other walks in this
 * package are, because apps/mobile has no renderer.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('.', import.meta.url));

function screens(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...screens(full));
    else if (entry.name.endsWith('.tsx') && !/\.test\.tsx$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Comments may say anything; line numbers are kept. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/** The names a file declares as string state that starts empty. */
function emptyStrings(body: string): string[] {
  return [...body.matchAll(/\bconst\s*\[\s*(\w+)\s*,\s*\w+\s*\]\s*=\s*useState(?:<string>)?\(\s*(['"])\2\s*\)/g)].map((m) => m[1]!);
}

/** Where a JSX child hands `name && …` to React, so an empty `name` is rendered as itself. */
function leaks(body: string, name: string): number[] {
  const pattern = new RegExp(`\\{[^}]*(?<![!.])\\b${name}\\b\\s*&&\\s*[(<]`, 'g');
  return [...body.matchAll(pattern)].map((m) => body.slice(0, m.index).split('\n').length);
}

describe('empty strings stay out of the view tree — F728', () => {
  test('no empty string reaches a view as a text node', () => {
    // The pattern first, on the shapes it has to tell apart, so a walk that
    // finds nothing is a clean tree and not a broken pattern.
    assert.deepEqual(emptyStrings("const [issue, setIssue] = useState('');\nconst [note, setNote] = useState<string>(\"\");"), ['issue', 'note']);
    assert.deepEqual(emptyStrings("const [busy, setBusy] = useState(false);\nconst [x, setX] = useState('a');"), []);
    assert.equal(leaks('{issue && (', 'issue').length, 1, 'the plain shape is not caught');
    assert.equal(leaks("{surface !== 'start' && issue && (", 'issue').length, 1, 'the shape behind another condition is not caught');
    assert.equal(leaks('{hapticTrouble && <TroubleLine message={hapticTrouble} />}', 'hapticTrouble').length, 1, 'the element shape is not caught');
    assert.equal(leaks("{issue !== '' ? (", 'issue').length, 0, 'the fixed shape is refused');
    assert.equal(leaks('{!issue && (', 'issue').length, 0, 'a negated boolean is refused');
    assert.equal(leaks('{reissue && (', 'issue').length, 0, 'a longer name is mistaken for this one');

    const offenders: string[] = [];
    let declared = 0;
    for (const path of screens(SRC)) {
      const body = stripComments(readFileSync(path, 'utf8'));
      const short = relative(SRC, path).split(sep).join('/');
      for (const name of emptyStrings(body)) {
        declared += 1;
        for (const line of leaks(body, name)) offenders.push(`${short}:${line}  {${name} && …}`);
      }
    }
    assert.ok(declared >= 20, `only ${declared} empty-string states were found, so this walk is reading almost nothing`);
    assert.deepEqual(
      offenders,
      [],
      `An empty string is handed to a View as a text node; write {name !== '' ? (…) : null}:\n${offenders.join('\n')}`,
    );
  });
});
