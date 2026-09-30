/**
 * The flat art seam, and the watercolours it replaced — F599 (revamp B), from F570.
 *
 * `art/flat/index.ts` cannot be imported here: it imports the drawings, which
 * are react-native-svg components node cannot run, and apps/mobile has no
 * renderer (docs/TESTING.md). So this is the source walk the raster registry
 * was held by, pointed at the vectors: read the generated registry as text,
 * then check each drawing beside it.
 *
 * Two promises, one test each. The first is that a drawing is furniture and
 * the registry is honest about it: every name has a generated file and every
 * generated file has a name, each drawing is silent to a screen reader, still,
 * drawn at the size the catalogue gives it, and coloured only by the palette,
 * so `scripts/illustrations.mjs` stays the one way a picture gets in. The
 * second is that the watercolours are really gone: no PNG in the folder that
 * shipped them, none of the three files that drew them, and nothing in the app
 * that reaches for `Image`, because an unlabelled picture is announced to a
 * screen reader as "image".
 *
 * Which scene draws which place drawing is `flat/scenes.test.ts`, moved from
 * `art/maps.test.ts` when the maps retired. Whether each drawing reaches a
 * screen is J14 in `surfaceContract.test.ts`.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { colour, paper } from '../palette.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SRC = join(HERE, '..');
const APP = join(SRC, '..');
const FLAT = join(HERE, 'flat');

/** The 23 drawings Round 1 converts. The six mouth guides wait for Round 3. */
const ROUND_ONE = [
  'celebrate-confetti',
  'celebrate-first-line',
  'celebrate-wrapped',
  'place-apero',
  'place-cafe-counter',
  'place-cafe-terrace',
  'place-day',
  'place-directions',
  'place-hotel',
  'place-market',
  'postcard-apero',
  'postcard-cafe-counter',
  'postcard-cafe-terrace',
  'postcard-day',
  'postcard-directions',
  'postcard-hotel',
  'postcard-market',
  'state-headphones',
  'state-microphone',
  'state-notebook',
  'state-offline',
  'state-postcard-frame',
  'state-waiting',
];

type Size = readonly [number, number];

/**
 * The sizes ILLUSTRATIONS.md displays each drawing at, copied from its "Display
 * at W by H, or W2 by H2" lines. The catalogue lives outside the repo, so it is
 * written down here: a drawing whose size drifts from the catalogue is one the
 * script parsed wrongly or somebody edited by hand.
 */
function kitSize(name: string): { large: Size; small?: Size } {
  if (name.startsWith('place-')) return { large: [350, 220], small: [262, 165] };
  if (name.startsWith('state-')) return { large: [160, 160], small: [120, 120] };
  if (name.startsWith('postcard-')) return { large: [300, 190], small: [165, 105] };
  if (name === 'celebrate-confetti') return { large: [390, 260] };
  if (name === 'celebrate-wrapped') return { large: [350, 260] };
  if (name === 'celebrate-first-line') return { large: [350, 220] };
  return assert.fail(`${name} is not a drawing ILLUSTRATIONS.md gives a size for`);
}

/** Comments out, so a sentence about a retired file is not a use of it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/** The registry read as text: name, component, viewBox and the catalogue's sizes. */
function registered(): { name: string; draw: string; box: Size; large: Size; small?: Size }[] {
  const body = readFileSync(join(FLAT, 'index.ts'), 'utf8');
  const rows = [...body.matchAll(
    /^ {2}'([a-z][a-z0-9-]*)': \{ draw: ([A-Z][A-Za-z]*), box: \[(\d+), (\d+)\], large: \[(\d+), (\d+)\](?:, small: \[(\d+), (\d+)\])? \},$/gm,
  )].map(([, name, draw, bw, bh, lw, lh, sw, sh]) => ({
    name: name as string,
    draw: draw as string,
    box: [Number(bw), Number(bh)] as const,
    large: [Number(lw), Number(lh)] as const,
    ...(sw !== undefined && sh !== undefined ? { small: [Number(sw), Number(sh)] as const } : {}),
  }));
  // Every entry has one `draw:`; a row this pattern skipped would be a drawing
  // nothing here checks.
  assert.equal(
    rows.length,
    (body.match(/: \{ draw: /g) ?? []).length,
    'art/flat/index.ts has an entry this test cannot read, so it is registered and unchecked',
  );
  return rows;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

/** Every source the app bundles: `src/` without its tests, and the root component. */
const SOURCES = [...sourceFiles(SRC), join(APP, 'App.tsx')].map((path) => ({
  path,
  rel: relative(SRC, path),
  body: stripComments(readFileSync(path, 'utf8')),
}));

/** A colour a drawing may carry: nothing, or a palette token the conversion map names. */
function isToken(value: string): boolean {
  if (value === '"none"' || value === '{lilac}') return true;
  const token = /^\{(paper|colour)\.([A-Za-z]+)\}$/.exec(value);
  if (!token) return false;
  const [, group, key] = token;
  return Object.hasOwn(group === 'paper' ? paper : colour, key as string);
}

describe('the flat art seam — F599', () => {
  test('the flat registry names the 23 Round 1 drawings, each generated, decorative, still, at its ILLUSTRATIONS.md sizes, and coloured only by tokens', () => {
    const index = readFileSync(join(FLAT, 'index.ts'), 'utf8');
    assert.ok(
      index.startsWith('// Generated by scripts/illustrations.mjs from ILLUSTRATIONS.md. Do not edit by hand.'),
      'art/flat/index.ts lost its generated header, so it reads as hand-written and the script would leave it stale',
    );

    const art = registered();
    const names = art.map((row) => row.name);
    assert.deepEqual([...names].sort(), ROUND_ONE, 'the registry names a different set of drawings than the 23 Round 1 converts');
    assert.equal(new Set(names).size, names.length, 'the registry names one drawing twice');
    assert.ok(!names.some((name) => name.startsWith('mouth-')), 'a mouth guide shipped before Round 3 asked for it');

    for (const { name, draw, box, large, small } of art) {
      const where = `art/flat/${name}.tsx`;
      const path = join(FLAT, `${name}.tsx`);
      assert.ok(existsSync(path), `${name} is registered but ${where} is not on disk, so the bundle fails to build`);
      const raw = readFileSync(path, 'utf8');
      const body = stripComments(raw);

      // Generated, from the catalogue, by the one script.
      assert.equal(
        raw.split('\n')[0],
        `// Generated by scripts/illustrations.mjs from ILLUSTRATIONS.md (${name}). Do not edit by hand.`,
        `${where} does not open with its generated header, so it was written by hand or for another drawing`,
      );
      assert.match(body, new RegExp(`export function ${draw}\\(`), `${where} does not export ${draw}, the component the registry draws`);
      assert.ok(
        index.includes(`import { ${draw} } from './${name}.tsx';`),
        `the registry draws ${draw} without importing it from ${name}.tsx`,
      );

      // At the catalogue's sizes, in its own box.
      const kit = kitSize(name);
      assert.deepEqual(large, kit.large, `${name} is registered at ${large.join(' by ')}, and ILLUSTRATIONS.md displays it at ${kit.large.join(' by ')}`);
      assert.deepEqual(small, kit.small, `${name} has a second size the catalogue does not give, or lost the one it does`);

      // One picture, hidden from assistive technology.
      const svgs = body.match(/<Svg\b[^>]*>/g) ?? [];
      assert.equal(svgs.length, 1, `${where} draws ${svgs.length} Svg roots, and a drawing is one picture`);
      const svg = svgs[0] as string;
      assert.ok(svg.includes('{...decorative}'), `${where} draws an Svg a screen reader will announce: ${svg}`);
      const view = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
      assert.ok(view, `${where} has no viewBox, so it cannot scale into its box`);
      assert.deepEqual(
        [Number(view[1]), Number(view[2])],
        [...box],
        `${where} draws in a ${view[1]} by ${view[2]} viewBox and the registry says ${box.join(' by ')}`,
      );

      // Still: the motion budget is the orb, the recap count-up and confetti's
      // own screen, never a drawing that animates itself.
      assert.doesNotMatch(body, /\bAnimated\b|\buseEffect\b|\buseIsFocused\b/, `${where} moves, and a drawing is still`);

      // Coloured only by tokens, so palette.ts stays the one file with a raw colour.
      const colours = [...body.matchAll(/\b(?:fill|stroke)=(\{[^}]*\}|"[^"]*")/g)].map(([, value]) => value as string);
      assert.ok(colours.length > 0, `${where} was read with no fill or stroke, so this test is reading nothing`);
      for (const value of colours) {
        assert.ok(isToken(value), `${where} is coloured ${value}, which is not "none" or a palette token`);
      }
      assert.doesNotMatch(body, /#[0-9A-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(|\burl\(/, `${where} spells a colour or a gradient by hand`);

      // And it takes nothing but the drawing kit and the tokens.
      const imports = [...body.matchAll(/\bfrom '([^']+)'/g)].map(([, spec]) => spec);
      assert.ok(imports.length > 0, `${where} was read with no imports, so this test is reading nothing`);
      for (const spec of imports) {
        assert.ok(
          spec === 'react-native-svg' || spec === '../../theme.ts',
          `${where} imports ${spec}; a drawing takes only react-native-svg and ../../theme.ts`,
        );
      }
      assert.doesNotMatch(body, /\brequire\(/, `${where} requires a file, and a drawing is vectors only`);
    }

    // Folder to registry: a generated drawing nobody registered is weight in
    // the download that no screen can name.
    for (const file of readdirSync(FLAT)) {
      if (!file.endsWith('.tsx')) continue;
      if (file === 'Illustration.tsx') continue;
      assert.ok(
        names.includes(file.replace(/\.tsx$/, '')),
        `art/flat/${file} sits beside the registry but no entry names it, so it ships and nothing can draw it`,
      );
    }

    // One renderer, hand-written, and it says the same things about every
    // drawing: hidden from assistive technology, at the catalogue's size.
    const renderer = readFileSync(join(FLAT, 'Illustration.tsx'), 'utf8');
    assert.doesNotMatch(renderer, /^\/\/ Generated by/, 'Illustration.tsx carries the generated header, so the script could overwrite it');
    assert.match(renderer, /\{\.\.\.decorative\}/, 'Illustration.tsx no longer spreads decorative, so every drawing is announced');
    assert.match(renderer, /entry\[fit\] \?\? entry\.large/, 'Illustration.tsx no longer sizes a drawing from the catalogue');
    assert.doesNotMatch(stripComments(renderer), /\bAnimated\b|\buseEffect\b/, 'Illustration.tsx moves a drawing, and a drawing is still');
  });

  test('the watercolours are gone: no PNG under assets/art, no Art, no registry, no maps, and nothing imports Image', () => {
    assert.equal(
      existsSync(join(APP, 'assets', 'art')),
      false,
      'apps/mobile/assets/art is back, so the watercolours ship in the download again',
    );

    const RETIRED = ['Art.tsx', 'registry.ts', 'maps.ts'];
    for (const file of RETIRED) {
      assert.equal(existsSync(join(HERE, file)), false, `art/${file} is back, and the flat drawings replaced it`);
    }
    // The maps' promises moved with them rather than leaving.
    assert.ok(existsSync(join(FLAT, 'scenes.test.ts')), 'art/flat/scenes.test.ts is gone, so no test says which scene draws which place');

    const retiredPaths = new Set(RETIRED.flatMap((file) => [join(HERE, file), join(HERE, file.replace(/\.tsx?$/, ''))]));
    for (const { path, rel, body } of SOURCES) {
      // `ok` over `doesNotMatch`, so a failure names the file rather than printing all of it.
      assert.ok(!/<Art[\s>]/.test(body), `${rel} still draws <Art>, which retired with the watercolours`);
      assert.ok(!/from '\.\.\/art\/(Art|maps|registry)/.test(body), `${rel} still imports a retired art file`);
      assert.ok(!/assets\/art\//.test(body), `${rel} still reaches for a watercolour on disk`);
      for (const [, spec] of body.matchAll(/\bfrom '(\.{1,2}\/[^']+)'/g)) {
        assert.ok(
          !retiredPaths.has(resolve(dirname(path), spec as string)),
          `${rel} imports ${spec}, which retired with the watercolours`,
        );
      }
    }

    // Nothing reaches for Image. The raster renderer was the one file allowed
    // to, and it has gone; a raw <Image> anywhere now would be an unlabelled
    // "image" to a screen reader, the failure J6 closed for the vectors.
    const importers: string[] = [];
    for (const { rel, body } of SOURCES) {
      for (const [, names] of body.matchAll(/import\s*\{([^}]*)\}\s*from\s*'(?:react-native|expo-image)'/g)) {
        const imported = (names as string)
          .split(',')
          .map((name) => name.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]);
        if (imported.includes('Image') || imported.includes('ImageBackground')) importers.push(rel);
      }
      if (/import\s+Image\b[^;]*from\s*'expo-image'/.test(body)) importers.push(rel);
    }
    assert.deepEqual(importers, [], 'something imports Image again, so a picture can reach the screen undecorated');
  });
});
