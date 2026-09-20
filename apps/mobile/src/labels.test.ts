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
 *
 * These are the ones still written as words in the JSX that draws them, which
 * is all `labelsInSource` can see: it reads literals.
 */
const KEPT = [
  'Your turn',
  'Tell them this, in French',
  'The waiter',
  // 'Your level' and 'What you have' left with F399: the level card and the
  // four-stat rail are My French's alone now, and Home opens on what there is
  // to do today. Both labels still exist where they are drawn; neither is a
  // label Home says any more.
  'Your practice today',
  'Since you started',
  'Your notebook',
  'Your wins',
  'Small fixes',
  'New phrases',
  'Next step',
  'One sound to practise next',
  'You',
];

/**
 * The labels revamp A added, which are words in a `.ts` rather than in the JSX.
 *
 * Eight new caps labels arrived with the revamp and not one of them is a
 * literal a source walk can see: the screen writes `<Label>{RHYTHM_LABEL}</Label>`
 * or hands `label={SHELF_LABEL}` to a primitive that draws one. That is the
 * right shape — the words belong in a module a test can import — but it means
 * `labelsInSource` reads `{RHYTHM_LABEL}` and would have said the sweep was
 * clean while eight labels it had never read sat on five tabs.
 *
 * So each one names its words, the module that owns them, and the constant. The
 * check is the same check: the words still exist, and something still draws
 * them as a caps label.
 */
const KEPT_IN_A_MODULE: readonly { words: string; from: string; name: string }[] = [
  { words: 'Real progress', from: 'home/abilities.ts', name: 'REAL_PROGRESS_LABEL' },
  { words: 'Practice together', from: 'tutor/gate.ts', name: 'ENTRY_MODES_LABEL' },
  { words: 'Your next practice', from: 'practice/copy.ts', name: 'NEXT_PRACTICE_LABEL' },
  { words: 'You can now...', from: 'myfrench/situations.ts', name: 'YOU_CAN_NOW' },
  { words: 'Your phrase shelf', from: 'myfrench/copy.ts', name: 'SHELF_LABEL' },
  { words: 'Your tutor', from: 'profile/frenchLife.ts', name: 'TUTOR_LABEL' },
  { words: 'Your speaking rhythm', from: 'profile/frenchLife.ts', name: 'RHYTHM_LABEL' },
  { words: 'Your learning', from: 'profile/frenchLife.ts', name: 'LEARNING_LABEL' },
];

/**
 * The three primitives that draw a caps label out of a `label` prop.
 *
 * Named here and proved below, because `label=` is also what every button in
 * the app takes, and a button word is not a caps label. These three are the
 * only components that turn the prop into `<Label>`.
 */
const LABEL_PRIMITIVES = ['surface/HeroCard.tsx', 'surface/IconRowCard.tsx', 'surface/PhraseCard.tsx'];

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
    // exactly two children, and deleting the caps title on the left flushed the
    // remaining control across the screen. The concern moved into the shared
    // header (layout.tsx) when these three adopted it, and it is flushed right
    // there, once, rather than by each screen's own row. F334 rebuilt that header
    // as three equal slots: the `flex: 1` centre expands to push the right slot
    // to the edge, and the leave word sits `alignItems: 'flex-end'` within it. So
    // the guarantee is unchanged and still checked at its home, by the mechanism
    // that replaced the old `marginLeft: 'auto'`, and the three screens are held
    // to routing their way out through a shared header rather than a hand-rolled row.
    const header = readFileSync(join(SRC, 'layout.tsx'), 'utf8');
    assert.match(
      header,
      /flex: 1, alignItems: 'center'/,
      'the shared header centre no longer expands, so it cannot push the leave word to the edge',
    );
    assert.match(
      header,
      /minWidth: HIT, minHeight: HIT, alignItems: 'flex-end'/,
      'the shared header no longer flushes the leave word to the right, so it can sit under the wrong thumb',
    );
    for (const name of ['ReviewScreen.tsx', 'DrillScreen.tsx']) {
      const source = readFileSync(join(SRC, name), 'utf8');
      assert.match(
        source,
        /<ScreenHeader\s+leave=/,
        `${name} hand-rolls its way out instead of the shared header that positions it once`,
      );
    }
    const convo = readFileSync(join(SRC, 'ConvoScreen.tsx'), 'utf8');
    assert.match(
      convo,
      /<LiveRoomHeader\s+/,
      'ConvoScreen no longer routes its compact end control through the shared live-room header',
    );
  });

  test('the transcript label still says whose hearing it was', () => {
    // It left KEPT because it carries the tutor's name now and so is
    // interpolated, and labelsInSource only reads literals. The guarantee is
    // unchanged and is the honest half of the label: this is what the tutor
    // HEARD, which is not always what the learner said.
    const source = readFileSync(join(SRC, 'SessionView.tsx'), 'utf8');
    // Re-pointed by F293: the name is per learner now, so what is interpolated
    // is the chosen persona's name rather than the one constant. The guarantee
    // is unchanged, and is the honest half of the label.
    assert.match(source, /<Label[^>]*>\{`What \$\{tutorName\} heard`\}<\/Label>/, 'the transcript lost its label');
  });

  test('every label that names something the screen does not otherwise say is still there', () => {
    const texts = new Set(labelsInSource().map((l) => l.text));
    for (const kept of KEPT) {
      assert.ok(texts.has(kept), `"${kept}" is a label that carries information, and the sweep was not for those`);
    }
  });

  test('a label whose words live in a module is still drawn as a label', () => {
    // First the three primitives really do turn `label` into a caps label, so
    // `label={SHELF_LABEL}` below is a caps label and not a button word.
    for (const where of LABEL_PRIMITIVES) {
      const source = readFileSync(join(SRC, where), 'utf8');
      assert.match(
        source,
        /<Label>\{label\}<\/Label>/,
        `${where} no longer draws its label prop as a caps Label, so the call sites below prove nothing`,
      );
    }

    const all = sourceFiles(SRC).map((file) => ({ file, body: readFileSync(file, 'utf8') }));
    for (const { words, from, name } of KEPT_IN_A_MODULE) {
      const owner = all.find((f) => f.file.endsWith(from));
      assert.ok(owner, `${from} is gone, and it is where "${words}" was written`);

      // The words, exactly, in the module that claims them. A constant renamed
      // is fine; a sentence quietly reworded is what this catches.
      const direct = new RegExp(`export const ${name}(?::[^=]*)? = '${words.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}';`);
      const inObject = new RegExp(`export const ${name} = \\{[\\s\\S]*?label: '${words.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}',`);
      assert.ok(
        direct.test(owner!.body) || inObject.test(owner!.body),
        `${from} no longer says "${words}" as ${name}, so the label a learner reads has been reworded without a decision`,
      );

      // And something still draws it as a caps label: inside `<Label>`, or
      // handed to one of the three primitives as `label`, or set as the `label`
      // of a view model one of them is given.
      const drawn = all.some(({ body }) =>
        new RegExp(`<Label[^>]*>\\{${name}[^}]*\\}</Label>`).test(body) ||
        new RegExp(`label=\\{${name}\\b[^}]*\\}`).test(body) ||
        new RegExp(`label: ${name}\\b`).test(body),
      );
      assert.ok(drawn, `"${words}" is still written down and nothing draws it, so the label left the screen quietly`);
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
