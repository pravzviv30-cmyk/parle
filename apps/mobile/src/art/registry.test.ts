/**
 * The raster art seam — F570.
 *
 * `registry.ts` cannot be imported here: `require` of a PNG is a Metro thing and
 * node has no idea what to do with it, and apps/mobile has no renderer
 * (docs/TESTING.md). So this is the source walk `tutorVoice.test.ts` uses for
 * the bundled voice clips, pointed at the pictures: read the registry as text,
 * then check the folder beside it on disk.
 *
 * Two promises, one test each. The first is that a picture is furniture: silent
 * to a screen reader, drawn through one component, and small enough that the
 * app still installs on a café's wifi. The second is that the registry and the
 * folder agree in both directions, because a name with no file is a crash on a
 * device and a file with no name is dead weight in the download that nobody
 * notices until the bundle is measured.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SRC = join(HERE, '..');
const ART_DIR = join(SRC, '..', 'assets', 'art');

/** 350 KB a file, 4 MB the folder. Art is the one thing here that can triple a download. */
const FILE_BUDGET = 350 * 1024;
const FOLDER_BUDGET = 4 * 1024 * 1024;

/** The registry read as text: key, filename and the point size it is drawn at. */
function registered(): { key: string; file: string; width: number; height: number }[] {
  const body = readFileSync(join(HERE, 'registry.ts'), 'utf8');
  const entries = [...body.matchAll(
    /^ {2}'?([a-z][a-z-]*)'?: \{ source: require\('\.\.\/\.\.\/assets\/art\/([a-z][a-z-]*)\.png'\), width: (\d+), height: (\d+) \},$/gm,
  )];
  return entries.map(([, key, file, width, height]) => ({
    key: key as string,
    file: file as string,
    width: Number(width),
    height: Number(height),
  }));
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

const SOURCES = sourceFiles(SRC).map((path) => ({
  path: relative(SRC, path),
  body: readFileSync(path, 'utf8'),
}));

describe('the raster art seam — F570', () => {
  test('every raster scene is decorative and every asset the registry names exists on disk under budget', () => {
    const art = registered();
    assert.equal(art.length, 13, 'the registry no longer reads as one entry a line; this walk is stale');

    let folder = 0;
    for (const { key, file, width, height } of art) {
      assert.equal(key, file, `${key} is registered against ${file}.png, so the two names have drifted apart`);
      assert.ok(width > 0 && height > 0, `${key} is registered without a size, so every screen would pick its own`);
      for (const density of ['@2x', '@3x']) {
        const path = join(ART_DIR, `${file}${density}.png`);
        let bytes = 0;
        try {
          bytes = statSync(path).size;
        } catch {
          assert.fail(`${file}${density}.png is registered but not on disk, which is a blank corner on a device`);
        }
        assert.ok(
          bytes <= FILE_BUDGET,
          `${file}${density}.png is ${Math.round(bytes / 1024)} KB, over the ${FILE_BUDGET / 1024} KB budget for one scene`,
        );
        folder += bytes;
      }
    }
    assert.ok(
      folder <= FOLDER_BUDGET,
      `the art folder is ${Math.round(folder / 1024)} KB, over the ${FOLDER_BUDGET / 1024} KB the download can carry`,
    );

    // One renderer, and it says the same three things about every picture: the
    // scene carries nothing the words do not, so assistive technology walks
    // past it, and the wash is never cropped or stretched.
    const renderer = readFileSync(join(HERE, 'Art.tsx'), 'utf8');
    for (const promise of ['accessible={false}', '{...decorative}', 'resizeMode="contain"']) {
      assert.ok(renderer.includes(promise), `art/Art.tsx no longer draws with ${promise}`);
    }

    // And it is the only renderer. A raw <Image> anywhere else reaches a screen
    // reader as an unlabelled "image", which is the failure J6 closed for the
    // vector scenes.
    for (const { path, body } of SOURCES) {
      if (path === join('art', 'Art.tsx')) continue;
      for (const [, names] of body.matchAll(/import\s*\{([^}]*)\}\s*from\s*'react-native'/g)) {
        const imported = (names as string)
          .split(',')
          .map((name) => name.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]);
        assert.ok(
          !imported.includes('Image'),
          `${path} imports Image from react-native; only art/Art.tsx may, so that every picture is drawn decorative`,
        );
      }
    }
  });

  test('every art key the registry names is drawn somewhere and nothing in the folder is unregistered', () => {
    const art = registered();
    const keys = art.map((entry) => entry.key);

    // Folder to registry: a PNG nobody registered is weight in the download.
    for (const name of readdirSync(ART_DIR)) {
      if (!name.endsWith('.png')) continue;
      const match = /^([a-z][a-z-]*)@([23])x\.png$/.exec(name);
      assert.ok(match, `${name} is not named <key>@2x.png or <key>@3x.png, so Metro cannot pick a density for it`);
      assert.ok(
        keys.includes(match[1] as string),
        `${name} sits in the art folder but no registry entry names it, so it ships and nothing draws it`,
      );
    }
    for (const key of keys) {
      for (const density of ['@2x', '@3x']) {
        assert.ok(
          readdirSync(ART_DIR).includes(`${key}${density}.png`),
          `${key} is missing its ${density} file, so one class of device gets a resized blur`,
        );
      }
    }

    // Registry to screens: the maps name a picture for a place, a tab or a
    // screen, and a screen may also name one inline. A key that neither reaches
    // is a picture the founder paid for and nobody sees.
    const maps = readFileSync(join(HERE, 'maps.ts'), 'utf8');
    const mapped = new Set([...maps.matchAll(/:\s*'([a-z][a-z-]*)'/g)].map(([, value]) => value));
    for (const key of keys) {
      if (mapped.has(key)) continue;
      const drawn = SOURCES.some(
        ({ path, body }) =>
          path !== join('art', 'registry.ts') &&
          new RegExp(`<(Art|HeaderArt) name=(?:"${key}"|\\{'${key}'\\})`).test(body),
      );
      assert.ok(drawn, `no map names ${key} and no screen draws it, so it is registered and invisible`);
    }
  });
});
