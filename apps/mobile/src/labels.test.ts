/**
 * The micro-label, held to doing a job.
 *
 * `type.label` is the only `textTransform: 'uppercase'` in the app, which makes
 * it the loudest thing a screen can say. It had drifted into decoration: a caps
 * kicker sitting above a sentence that said the same thing in words, so the eye
 * read "NOTHING WAITING" and then "Nothing waiting." That is a screen shouting
 * its own subtitle, and the founder's word for it was cheap.
 *
 * A label that names something the sentence beneath it does not say is doing
 * work and stays. This walks the source the way copy.test.ts does and pins the
 * retirement, because a deleted string is exactly the kind of thing that comes
 * back one careless paste later.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('.', import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    // This file names every retired string, so walking itself would fail it.
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

/** Every `<Label>...</Label>` in the app, with the file it came from. */
function labelsInSource(): { file: string; text: string }[] {
  const found: { file: string; text: string }[] = [];
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/<Label[^>]*>([\s\S]*?)<\/Label>/g)) {
      found.push({ file, text: (match[1] ?? '').trim() });
    }
  }
  return found;
}

/**
 * Each of these repeated, word for word, the sentence directly beneath it. The
 * heading ones were a screen title in caps above a card that already carried
 * the title.
 */
const RETIRED = [
  'Free talk',
  'End of conversation',
  'End of session',
  'No sound check today',
  'Nothing to work on',
  'Review',
  'Nothing waiting',
  'Nothing due right now',
  'Session done',
  '{heading}',
  'Not ready yet',
  'No friends here yet',
  'Not yet',
  'While you wait',
  'Not a sample',
  'While you talk',
  'The rest of this path',
];

/**
 * A sample of the labels that earn their place: each one names something no
 * sentence on its screen says. If a future sweep takes one of these, it has
 * taken information rather than decoration.
 */
const KEPT = [
  'Say this',
  'Tell them this, in French',
  'The waiter',
  'What the tutor heard',
  'Your level',
  'What you have',
  'What moved today',
  'Since you started',
  'Your notebook',
  'Your wins',
  'Small fixes',
  'New phrases',
  'Next step',
  'The sound to work on',
  'You',
];

describe('the caps micro-label — what it is allowed to be used for', () => {
  test('the retired kickers stay retired', () => {
    const labels = labelsInSource();
    assert.ok(labels.length > 0, 'the walk found no labels at all, so it is checking nothing');

    const offenders: string[] = [];
    for (const { file, text } of labels) {
      if (RETIRED.includes(text)) offenders.push(`${file}  <Label>${text}</Label>`);
    }
    assert.deepEqual(
      offenders,
      [],
      `A caps kicker is back above a sentence that already says it:\n${offenders.join('\n')}`,
    );
  });

  test('the browser gesture affordance is a sentence, not a shout', () => {
    // "Tap to listen" is load-bearing: on the web it is the only thing standing
    // between a learner and a tutor they cannot hear. It was restyled rather
    // than deleted, into sentence case, because DESIGN.md puts buttons there.
    const asLabel = labelsInSource().filter((l) => l.text === 'Tap to listen');
    assert.deepEqual(asLabel.map((l) => l.file), [], 'the way to hear the tutor is a control, and controls are sentence case');

    const shown = sourceFiles(SRC).filter((f) => readFileSync(f, 'utf8').includes('Tap to listen'));
    assert.ok(shown.length >= 2, 'both live surfaces have to offer the gesture, or one of them fails in silence');
  });

  test('a header row that lost its title does not let the way out slide left', () => {
    // The one mechanical trap in the sweep. These rows were space-between with
    // exactly two children, and deleting the caps title on the left flushes the
    // remaining control across the screen unless the row is told otherwise.
    for (const name of ['ConvoScreen.tsx', 'ReviewScreen.tsx', 'DrillScreen.tsx']) {
      const source = readFileSync(join(SRC, name), 'utf8');
      const row = /headerRow: \{[^}]*\}/.exec(source);
      assert.ok(row !== null, `${name} lost its headerRow style entirely`);
      assert.ok(
        !row[0].includes('space-between'),
        `${name} still spreads a header row that now holds one thing, so the way out sits under the wrong thumb`,
      );
    }
  });

  test('every label that names something the screen does not otherwise say is still there', () => {
    const texts = new Set(labelsInSource().map((l) => l.text));
    for (const kept of KEPT) {
      assert.ok(texts.has(kept), `"${kept}" is a label that carries information, and the sweep was not for those`);
    }
  });

  test('no label left in the app repeats the sentence directly under it', () => {
    // A guard against the next one arriving rather than the last one returning:
    // a label whose words are the opening of the very next line is decoration.
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/<Label[^>]*>([\s\S]*?)<\/Label>([\s\S]{0,400})/g)) {
        const text = (match[1] ?? '').trim();
        // Interpolated labels carry a value, not a phrase, so there is nothing
        // to compare and no way to repeat a sentence.
        if (text.length === 0 || text.includes('{')) continue;
        const after = match[2] ?? '';
        if (after.includes(`>${text}.<`) || after.includes(`>${text}<`)) {
          offenders.push(`${file}  <Label>${text}</Label>`);
        }
      }
    }
    assert.deepEqual(offenders, [], `These labels say their own next line:\n${offenders.join('\n')}`);
  });
});
