/**
 * The game art keeps the house style — F746 (come alive D10).
 *
 * The flame, chest, medal, crest, freeze and repair marks are data in
 * `shapes.ts`, read here directly: every part of every drawing, in every state
 * and on every ground, is held to the palette. The components that draw them
 * load Reanimated and react-native-svg, which a Node suite cannot, so they are
 * read as text (motion.test.ts, rule 7), the tripwire idiom of motion.test.ts
 * and primitives.test.ts.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { accent, colour, highlight, lilac, paper } from '../../palette.ts';
import { CHEST_MOTION, FLAME_MOTION } from './artMotion.ts';
import { ART, ART_GROUNDS, ART_NAMES, GROUND_TOKEN, colourOf, drawn, statesOf, type ArtName } from './shapes.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const read = (name: string): string => readFileSync(`${HERE}${name}`, 'utf8');

/** The source without comments, which may say anything. */
const code = (name: string): string =>
  read(name)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);

/** The six drawings' own files, each exported by index.ts. */
const COMPONENTS: Record<string, string> = {
  'Flame.tsx': 'Flame',
  'Chest.tsx': 'Chest',
  'Medal.tsx': 'Medal',
  'Crest.tsx': 'Crest',
  'FreezeMark.tsx': 'FreezeMark',
  'RepairMark.tsx': 'RepairMark',
};

/** The two that move. The rest are still. */
const MOVING = ['Flame.tsx', 'Chest.tsx'];

/** Every source in this folder but the tests. */
const SOURCES = readdirSync(HERE).filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name));

/** Every drawing, in every state, on every ground. */
function* everyDrawn() {
  for (const name of ART_NAMES) {
    for (const state of statesOf(name)) {
      for (const ground of ART_GROUNDS) yield { name, state, ground, parts: drawn(name, state as never, ground) };
    }
  }
}

const GROUPS: Record<string, Readonly<Record<string, string>>> = { colour, paper, accent };

/**
 * The box an outline really covers, `[left, top, right, bottom]`, found by
 * walking it: every line end, 33 points along each curve, and 65 along each
 * arc, whose centre is worked out from its ends (SVG 1.1, appendix F.6.5).
 * Reads the absolute commands shapes.ts writes, and refuses anything else.
 */
function boundsOf(d: string): [number, number, number, number] {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  const add = (x: number, y: number) => {
    box[0] = Math.min(box[0], x);
    box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x);
    box[3] = Math.max(box[3], y);
  };
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  const n = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const at = i;
    if (/[A-Za-z]/.test(tokens[i]!)) cmd = tokens[i++]!;
    if (cmd === 'M' || cmd === 'L') {
      x = n();
      y = n();
      if (cmd === 'M') [startX, startY] = [x, y];
    } else if (cmd === 'H') x = n();
    else if (cmd === 'V') y = n();
    else if (cmd === 'C') {
      const [x1, y1, x2, y2, x3, y3] = [n(), n(), n(), n(), n(), n()];
      for (let k = 0; k <= 32; k += 1) {
        const t = k / 32;
        const u = 1 - t;
        add(u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3);
      }
      [x, y] = [x3, y3];
    } else if (cmd === 'A') {
      let [rx, ry] = [n(), n()];
      const turn = n();
      const [large, sweep, x2, y2] = [n(), n(), n(), n()];
      assert.equal(turn, 0, `an arc in ${d.slice(0, 40)} is turned, which this walk does not read`);
      const hx = (x - x2) / 2;
      const hy = (y - y2) / 2;
      const grow = (hx * hx) / (rx * rx) + (hy * hy) / (ry * ry);
      if (grow > 1) [rx, ry] = [rx * Math.sqrt(grow), ry * Math.sqrt(grow)];
      const num = rx * rx * ry * ry - rx * rx * hy * hy - ry * ry * hx * hx;
      const den = rx * rx * hy * hy + ry * ry * hx * hx;
      const k = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
      const cx = (k * rx * hy) / ry + (x + x2) / 2;
      const cy = (-k * ry * hx) / rx + (y + y2) / 2;
      const from = Math.atan2((y - cy) / ry, (x - cx) / rx);
      let span = Math.atan2((y2 - cy) / ry, (x2 - cx) / rx) - from;
      if (sweep === 1 && span < 0) span += 2 * Math.PI;
      if (sweep === 0 && span > 0) span -= 2 * Math.PI;
      for (let s = 0; s <= 64; s += 1) {
        const a = from + (span * s) / 64;
        add(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
      }
      [x, y] = [x2, y2];
    } else if (cmd === 'Z') [x, y] = [startX, startY];
    else assert.fail(`${cmd} in ${d.slice(0, 40)} is a command this walk does not read`);
    if (i === at) assert.fail(`${d.slice(0, 40)} has a number where a command should be`);
    add(x, y);
  }
  return box;
}

describe('the game art is flat, palette-only and decorative — F746', () => {
  test('every game drawing uses palette colours only and hides from assistive technology', () => {
    assert.deepEqual(
      [...ART_NAMES].sort(),
      ['chest', 'crest', 'flame', 'freeze', 'medal', 'repair'],
      'a game drawing is missing, or one was added without being held here',
    );
    let checked = 0;
    for (const { name, state, ground, parts } of everyDrawn()) {
      assert.ok(parts.length > 0, `${name} ${state} draws nothing`);
      for (const part of parts) {
        const where = `${name} ${state} on ${ground}, ${part.id}`;
        // The fill is a token, never a value: a group palette.ts exports and a key in it.
        const [group, key, ...rest] = part.fill.split('.');
        assert.equal(rest.length, 0, `${where} names ${part.fill}, which is not group.key`);
        const table = GROUPS[group ?? ''];
        assert.ok(table, `${where} paints from ${group}, which is not colour, paper or accent`);
        assert.ok(key !== undefined && Object.hasOwn(table, key), `${where} names ${part.fill}, which palette.ts does not export`);
        const hex = colourOf(part.fill);
        assert.equal(hex, table[key!], `${where} resolves ${part.fill} to something palette.ts does not say`);
        assert.notEqual(hex.toUpperCase(), highlight.toUpperCase(), `${where} is painted with the highlighter, a pen and never a fill`);
        assert.notEqual(hex.toUpperCase(), lilac.toUpperCase(), `${where} is painted lilac, which belongs to the flat illustrations alone`);
        // Flat: an outline of plain path commands. No gradient, pattern or filter reference, no colour.
        assert.doesNotMatch(part.d, /url\(|#/i, `${where} refers to a paint server or writes a colour in its outline`);
        assert.match(part.d, /^[MLHVCSQTAZ][MLHVCSQTAZ0-9.,\s-]*$/i, `${where} is not a plain outline: ${part.d.slice(0, 60)}`);
        assert.equal(Object.keys(part).sort().join(','), 'd,fill,id,layer', `${where} carries more than an outline and a fill: a stroke, an opacity or a gradient`);
        checked += 1;
      }
    }
    assert.ok(checked >= 200, `only ${checked} parts were checked, so this walk reads almost nothing`);

    // The files that draw them: each drawing has its own file, exported by
    // the folder, and every Svg in the folder is hidden from assistive tech.
    const index = code('index.ts');
    for (const [file, name] of Object.entries(COMPONENTS)) {
      assert.ok(existsSync(`${HERE}${file}`), `game/art/${file} is missing`);
      assert.match(code(file), new RegExp(`export function ${name}\\(`), `game/art/${file} does not export ${name}`);
      assert.match(index, new RegExp(`export \\{ ${name}\\b[^}]*\\} from '\\./${file.replace('.', '\\.')}'`), `index.ts does not export ${name}`);
      const svgs = code(file).match(/<Svg\b[^>]*>/g) ?? [];
      assert.equal(svgs.length, 1, `game/art/${file} should draw through its one Svg, and draws ${svgs.length}`);
    }
    for (const file of SOURCES) {
      const body = code(file);
      for (const tag of body.match(/<Svg\b[^>]*>/g) ?? []) {
        assert.ok(tag.includes('{...decorative}'), `game/art/${file} draws an Svg that assistive technology will read: ${tag}`);
      }
      // Colours come from palette.ts through the tokens in shapes.ts, and nothing else paints.
      assert.doesNotMatch(body, /#[0-9a-fA-F]{3,8}\b/, `game/art/${file} writes a raw colour`);
      assert.doesNotMatch(
        body,
        /\b(?:LinearGradient|RadialGradient|Defs|Mask|Pattern|ClipPath|Filter|FeGaussianBlur|Text|TSpan|Image|ForeignObject)\b/,
        `game/art/${file} draws a gradient, a mask, a filter, a picture or words`,
      );
      assert.doesNotMatch(body, /shadow\w*\s*:|elevation\s*:|opacity=|fillOpacity/i, `game/art/${file} casts a shadow or tints a part`);
      for (const m of body.matchAll(/strokeWidth=\{([^}]*)\}/g)) {
        assert.equal(m[1]?.trim(), 'STROKE', `game/art/${file} draws an outline heavier or lighter than the one pen`);
      }
      for (const m of body.matchAll(/\bfill=\{([^}]*)\}/g)) {
        assert.match(m[1] ?? '', /^colourOf\(/, `game/art/${file} paints a fill that is not a palette token: fill={${m[1]}}`);
      }
      if (file !== 'shapes.ts') {
        for (const m of body.matchAll(/^import\s+\{([^}]*)\}\s+from\s+'[./]*(?:theme|palette)\.ts';/gm)) {
          const names = (m[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
          assert.deepEqual(names.filter((n) => n !== 'decorative' && n !== 'STROKE'), [], `game/art/${file} takes a colour from the theme instead of a token`);
        }
      }
    }
    // A moving drawing hides its whole stack, not only each layer.
    for (const file of MOVING) {
      assert.match(code(file), /return \(\s*<(?:Reanimated\.)?View \{\.\.\.decorative\}/, `game/art/${file} does not hide the view that holds its layers`);
    }
    // Kept out of the flat registry, whose 29 drawings are pinned by F599.
    const flat = readFileSync(fileURLToPath(new URL('../../art/flat/index.ts', import.meta.url)), 'utf8');
    assert.doesNotMatch(flat, /game\/art/, 'a game drawing was added to the flat illustration registry');
  });

  test('a game drawing never vanishes into the ground it sits on', () => {
    for (const { name, state, ground, parts } of everyDrawn()) {
      const outline = new Set<string>(ART[name as ArtName].silhouette);
      const under = ground === 'paper' ? [paper.ground, paper.card] : [colourOf(GROUND_TOKEN[ground])];
      for (const part of parts) {
        if (!outline.has(part.id)) continue;
        assert.ok(!under.includes(colourOf(part.fill)), `${name} ${state}'s ${part.id} is painted the colour of the ${ground} ground under it`);
      }
    }
    // The milestone card is coral: the flame there is white and sun (motion section 5.4).
    const coral = Object.fromEntries(drawn('flame', 'lit', 'coral').map((p) => [p.id, p.fill]));
    assert.deepEqual(coral, { outer: 'paper.card', inner: 'colour.sun', core: 'colour.coral' });
    // A drawing that does not use the ground's colour keeps its white: no hole the colour of the ground.
    assert.equal(drawn('flame', 'lit', 'blue').find((p) => p.id === 'core')?.fill, 'paper.card');
    // A white star on a disc that turned white takes the ground's colour instead of vanishing.
    const medal = Object.fromEntries(drawn('medal', 'blue', 'blue').map((p) => [p.id, p.fill]));
    assert.equal(medal.disc, 'paper.card');
    assert.equal(medal.star, 'colour.blue');
  });

  test('every game drawing stays inside its box', () => {
    // A part that leaves the 100 box is cut off where the Svg ends, at every
    // size. Only the open chest's lid rises above it, as a pose of its layer.
    for (const name of ART_NAMES) {
      for (const part of drawn(name, statesOf(name)[0] as never)) {
        const box = boundsOf(part.d);
        const where = `${name} ${part.id} reaches ${box.map((v) => Math.round(v * 10) / 10).join(', ')}`;
        assert.ok(box[0] >= -0.01 && box[1] >= -0.01 && box[2] <= 100.01 && box[3] <= 100.01, `${where}, outside the 0 to 100 box`);
      }
    }
    // The sampler reads what it is given: a circle of radius 33 about (50, 40) reaches 7 and 73.
    const rim = boundsOf(drawn('medal', 'sun').find((p) => p.id === 'rim')!.d);
    assert.deepEqual(rim.map((v) => Math.round(v)), [17, 7, 83, 73]);
  });

  test('the waiting states are the same drawings in the paper greys', () => {
    // An unlit flame is the lit one waiting, not a sad one: the same outline, two greys.
    const lit = drawn('flame', 'lit');
    const unlit = drawn('flame', 'unlit');
    assert.deepEqual(unlit.map((p) => p.d), lit.map((p) => p.d), 'the unlit flame is a different shape');
    for (const ground of ART_GROUNDS) {
      for (const part of drawn('flame', 'unlit', ground)) {
        assert.ok(['paper.field', 'paper.line'].includes(part.fill), `the unlit flame's ${part.id} is ${part.fill} on ${ground}`);
      }
    }
    for (const part of drawn('medal', 'next')) {
      assert.ok(['paper.field', 'paper.line', 'paper.card'].includes(part.fill), `the next medal's ${part.id} is ${part.fill}`);
    }
    assert.equal(drawn('freeze', 'used').find((p) => p.id === 'crystal')?.fill, 'paper.field');
    // Open or shut, the chest is the same chest: opening it is the lid's pose.
    assert.deepEqual(drawn('chest', 'open'), drawn('chest', 'closed'));
    assert.deepEqual(new Set(drawn('chest', 'closed').map((p) => p.layer)), new Set(['body', 'lid']));
  });

  test('the game art moves whole parts only, a few times, and lands when it leaves', () => {
    for (const file of MOVING) {
      const body = code(file);
      assert.match(body, /import \{[^}]*\buseReduceMotion\b[^}]*\} from '\.\.\/\.\.\/motion\.ts';/, `game/art/${file} does not read reduced motion from motion.ts`);
      assert.match(body, /useAnswered\(useReduceMotion\(true\)\)/, `game/art/${file} does not wait for the OS to say whether movement is reduced`);
      assert.match(body, /useLandOnLeave\(land\)/, `game/art/${file} does not land when the app leaves or it unmounts`);
      assert.match(body, /if \((?:[^)]*\|\| )?answered\) \{\s*land\(\);\s*return;\s*\}/, `game/art/${file} does not land on the final frame under Reduce Motion`);
      assert.doesNotMatch(body, /\buseAnimatedProps\b|\bcreateAnimatedComponent\b/, `game/art/${file} animates an SVG attribute`);
      assert.doesNotMatch(body, /\bwith(?:Timing|Spring|Delay|Sequence|Repeat|Decay)\(/, `game/art/${file} reaches the engine around motion/drive.ts`);
      const styles = [...body.matchAll(/useAnimatedStyle\(\(\) => \(\{([\s\S]*?)\}\)\);/g)];
      assert.equal(styles.length, (body.match(/\buseAnimatedStyle\(/g) ?? []).length, `game/art/${file} has an animated style this walk cannot read`);
      assert.ok(styles.length > 0, `game/art/${file} moves nothing, so this walk reads nothing`);
      for (const m of styles) {
        for (const key of (m[1] ?? '').matchAll(/(\w+)\s*:/g)) {
          assert.ok(['opacity', 'transform', 'rotate', 'scale', 'scaleY', 'translateY'].includes(key[1]!), `game/art/${file} animates ${key[1]}`);
        }
      }
      for (const m of body.matchAll(/(?<![.\w])repeat\(/g)) {
        assert.match(body.slice(m.index), /^repeat\(once\([^)]*\), M\.flickers, false, reduced\)/, `game/art/${file} repeats something other than the counted flicker`);
      }
      assert.doesNotMatch(body, /expo-audio|expo-haptics|\bsfx\b|haptics/, `game/art/${file} plays a sound or a haptic of its own`);
    }
    // Reduce Motion is watched live: turned on mid-lighting, the flame lands although its key is spent.
    assert.match(
      code('Flame.tsx'),
      /if \(answered\) \{\s*land\(\);\s*return;\s*\}\s*if \(!fresh\) return;/,
      'the flame goes on lighting after Reduce Motion is turned on',
    );
    // The flicker runs only while it is asked for, in the foreground, with movement allowed.
    assert.match(code('Flame.tsx'), /if \(!lit \|\| !flicker \|\| !awake \|\| answered !== false\) \{\s*rest\(\);\s*return;\s*\}/, 'the flicker runs when it was not asked for');
    assert.match(code('Flame.tsx'), /return rest;/, 'the flicker is not stopped when it is no longer asked for or the flame unmounts');
    assert.ok(Number.isInteger(FLAME_MOTION.flickers) && FLAME_MOTION.flickers >= 1 && FLAME_MOTION.flickers <= 3, 'the flame flickers for good, or too long');
    assert.ok(FLAME_MOTION.ember > 0 && FLAME_MOTION.ember < 1, 'the flame does not grow as it lights');
    assert.ok(FLAME_MOTION.stretch > 1 && FLAME_MOTION.stretch <= 1.1, 'the flicker stretches the flame out of shape');
    assert.ok(CHEST_MOTION.bump > 1 && CHEST_MOTION.bump <= 1.1, 'the chest bumps out of shape');
    // The still drawings never move themselves; a celebration moves a wrapper around them.
    for (const file of Object.keys(COMPONENTS).filter((f) => !MOVING.includes(f))) {
      assert.doesNotMatch(code(file), /react-native-reanimated|react-native-worklets|\buse[A-Z]\w*\(/, `game/art/${file} moves or holds state`);
    }
  });
});
