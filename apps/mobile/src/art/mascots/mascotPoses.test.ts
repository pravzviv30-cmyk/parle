import { test } from 'node:test';
import assert from 'node:assert/strict';
import { b, colour, highlight, mascot, paper } from '../../palette.ts';
import { MARK, contrast } from '../../testing/contrast.ts';
import { CLOUD_VIEWBOX, MASCOT_EXPRESSIONS, cloudFace, faceLids, type ViewBox } from './mascotFaces.ts';
import { CLOUD_CHEEKS, CLOUD_SILHOUETTE, CLOUD_UNDERSIDE } from './mascotPaths.ts';
import { CLOUD_POSES, cloudLayers, type CloudPose } from './mascotPoses.ts';

const POSES = Object.keys(CLOUD_POSES) as CloudPose[];
/** Points along a path of M L H V Q C Z commands (absolute), curves sampled. */
const pts = (d: string): [number, number][] => {
  const out: [number, number][] = [];
  let x = 0, y = 0;
  for (const [, cmd, args] of d.matchAll(/([MLHVQCZ])([^MLHVQCZ]*)/g)) {
    const a = (args!.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const at = (t: number, ...v: number[]) => {
      const k = v.length - 1;
      let r = 0;
      v.forEach((p, i) => { r += p * (k === 2 ? [1, 2, 1][i]! : [1, 3, 3, 1][i]!) * (1 - t) ** (k - i) * t ** i; });
      return r;
    };
    const curve = (xs: number[], ys: number[]) => { for (let t = 0; t <= 1; t += 0.05) out.push([at(t, ...xs), at(t, ...ys)]); };
    if (cmd === 'M' || cmd === 'L') { x = a[0]!; y = a[1]!; }
    else if (cmd === 'H') x = a[0]!;
    else if (cmd === 'V') y = a[0]!;
    else if (cmd === 'Q') { curve([x, a[0]!, a[2]!], [y, a[1]!, a[3]!]); x = a[2]!; y = a[3]!; }
    else if (cmd === 'C') { curve([x, a[0]!, a[2]!, a[4]!], [y, a[1]!, a[3]!, a[5]!]); x = a[4]!; y = a[5]!; }
    out.push([x, y]);
  }
  return out;
};
const inside = (vb: ViewBox, [x, y]: [number, number]) => x >= vb.x && x <= vb.x + vb.width && y >= vb.y && y <= vb.y + vb.height;
const tokens = new Set<string>([...Object.values(paper), ...Object.values(colour), ...Object.values(mascot)]);

test('both poses exist and differ', () => {
  assert.deepEqual(POSES.sort(), ['cheer', 'listen']);
  assert.notDeepEqual(CLOUD_POSES.listen, CLOUD_POSES.cheer);
});

for (const p of POSES) {
  const pose = CLOUD_POSES[p];
  test(`${p}: limbs and marks sit inside the viewBox, which holds the body`, () => {
    for (const d of [...pose.rear, ...pose.front, ...pose.marks.map((m) => m.d)]) {
      for (const pt of pts(d)) assert.ok(inside(pose.viewBox, pt), `${p} reaches ${pt}`);
    }
    const vb = pose.viewBox;
    assert.ok(inside(vb, [CLOUD_VIEWBOX.x, CLOUD_VIEWBOX.y]) && inside(vb, [CLOUD_VIEWBOX.x + CLOUD_VIEWBOX.width, CLOUD_VIEWBOX.y + CLOUD_VIEWBOX.height]));
  });
  test(`${p}: marks use palette tokens, never the highlighter, and the face is known`, () => {
    for (const m of pose.marks) {
      const c = m.fill ?? m.stroke;
      assert.ok(c && tokens.has(c), `${p} mark colour ${c}`);
      assert.notEqual(c, highlight);
    }
    assert.ok(MASCOT_EXPRESSIONS.includes(pose.face));
  });
}

test('without a pose the cloud is drawn exactly as today', () => {
  assert.deepEqual(cloudLayers(), {
    viewBox: CLOUD_VIEWBOX,
    layers: [
      { kind: 'path', d: CLOUD_UNDERSIDE, fill: mascot.cloudUnderside },
      { kind: 'path', d: CLOUD_SILHOUETTE, fill: paper.card },
      ...CLOUD_CHEEKS.map((c) => ({ kind: 'ellipse', cx: c.cx, cy: c.cy, rx: c.rx, ry: c.ry, fill: mascot.cheek })),
      { kind: 'face', face: cloudFace('idle') },
    ],
  });
});

test('a pose draws rear limbs behind the body and front limbs over it', () => {
  const { viewBox, layers } = cloudLayers('listen', { ink: '#000' });
  assert.deepEqual(viewBox, CLOUD_POSES.listen.viewBox);
  const body = layers.findIndex((l) => l.kind === 'path' && l.d === CLOUD_SILHOUETTE);
  const rear = layers.findIndex((l) => l.kind === 'path' && l.d === CLOUD_POSES.listen.rear[0]);
  const front = layers.findIndex((l) => l.kind === 'path' && l.d === CLOUD_POSES.listen.front[0]);
  assert.ok(rear >= 0 && rear < body && front > body);
  assert.equal((layers[rear] as { stroke?: string }).stroke, '#000');
  assert.deepEqual(layers.at(-1), { kind: 'face', face: cloudFace('listening') });
});

test('stroked pose marks take the caller\'s accent; filled marks keep their colour', () => {
  const arcs = cloudLayers('listen', { accent: '#123456' }).layers.filter((l) => l.kind === 'path' && l.d === CLOUD_POSES.listen.marks[0]!.d);
  assert.equal(arcs.length, 1);
  assert.equal((arcs[0] as { stroke?: string }).stroke, '#123456');
  const stars = cloudLayers('cheer', { accent: '#123456' }).layers.filter((l) => CLOUD_POSES.cheer.marks.some((m) => l.kind === 'path' && l.d === m.d));
  assert.equal(stars.length, 2);
  for (const s of stars) assert.equal((s as { fill?: string; stroke?: string }).fill, colour.sun);
  for (const s of stars) assert.equal((s as { stroke?: string }).stroke, undefined);
});

test('the listen arcs in the link accent clear the 3:1 mark floor on both grounds', () => {
  for (const mode of ['light', 'dark'] as const) {
    const arc = cloudLayers('listen', { accent: b[mode].link }).layers.find((l) => l.kind === 'path' && l.d === CLOUD_POSES.listen.marks[0]!.d) as { stroke: string };
    const c = contrast(arc.stroke, b[mode].ground);
    assert.ok(c >= MARK, `${mode}: the listen arcs are ${c.toFixed(2)} on the ground, under ${MARK}`);
  }
  assert.equal(b.light.link, colour.blue, 'light mode arcs are no longer the brand blue');
});

test('an unposed cloud wears the expression it is given', () => {
  assert.deepEqual(cloudLayers(undefined, { expression: 'cheer' }).layers.at(-1), { kind: 'face', face: cloudFace('cheer') });
});

test('the lids cover the listening eyes', () => {
  const face = cloudFace('listening');
  const lids = faceLids(face);
  assert.equal(lids.covers.length, 2);
  assert.equal(lids.closed.length, 2);
  face.eyes.forEach((eye, i) => {
    assert.equal(eye.kind, 'open');
    if (eye.kind !== 'open') return;
    const c = lids.covers[i]!;
    assert.equal(c.fill, paper.card);
    assert.ok(c.cx === eye.cx && c.cy === eye.cy && c.rx > eye.rx && c.ry > eye.ry);
  });
});

test('every posed Cloud in the app passes its limbs an ink, so they show in dark mode', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.tsx') && !name.endsWith('.test.tsx')) files.push(path);
    }
  };
  walk(root);
  let posed = 0;
  for (const file of files) {
    for (const [tag] of readFileSync(file, 'utf8').matchAll(/<Cloud\b[^>]*>/g)) {
      if (!/\bpose=/.test(tag)) continue;
      posed += 1;
      assert.match(tag, /\bink=/, `${file}: ${tag} has no ink`);
    }
  }
  assert.ok(posed > 0, 'no posed Cloud found, so this test checks nothing');
});
