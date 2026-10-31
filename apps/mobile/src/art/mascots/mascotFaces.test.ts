import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLOUD_VIEWBOX, MASCOT_EXPRESSIONS, TOAST_VIEWBOX, cloudFace, toastFace, type MascotFace, type ViewBox } from './mascotFaces.ts';

const mascots = [
  { name: 'cloud', face: cloudFace, vb: CLOUD_VIEWBOX, idle: {
    eyes: [[89.3601, 90.3563, 3.1988, 5.712], [124.774, 90.3563, 3.1988, 5.712]],
    mouth: 'M99.6417 102.923C105.735 115.108 112.589 115.108 120.205 102.923' } },
  { name: 'toast', face: toastFace, vb: TOAST_VIEWBOX, idle: {
    eyes: [[53.0715, 51.813, 2.808, 4.68], [73.6635, 51.813, 2.808, 4.68]],
    mouth: 'M55.8795 64.917C63.3675 78.021 70.8555 78.021 78.3435 64.917' } },
] as const;

/** Every point a face touches: path coordinates and ellipse extents. */
function points(face: MascotFace): [number, number][] {
  const out: [number, number][] = [];
  const fromPath = (d: string) => {
    const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i]!, nums[i + 1]!]);
  };
  const fromEllipse = (e: { cx: number; cy: number; rx: number; ry: number }) => {
    out.push([e.cx - e.rx, e.cy - e.ry], [e.cx + e.rx, e.cy + e.ry]);
  };
  for (const eye of face.eyes) (eye.kind === 'open' ? fromEllipse(eye) : fromPath(eye.d));
  if (face.mouth.kind === 'o') fromEllipse(face.mouth);
  else fromPath(face.mouth.d);
  return out;
}

const inside = (vb: ViewBox, [x, y]: [number, number]) => x >= vb.x && x <= vb.x + vb.width && y >= vb.y && y <= vb.y + vb.height;

for (const m of mascots) {
  test(`${m.name}: every expression has two eyes and a mouth`, () => {
    for (const e of MASCOT_EXPRESSIONS) {
      const f = m.face(e);
      assert.equal(f.eyes.length, 2, `${m.name} ${e}`);
      assert.ok(f.mouth, `${m.name} ${e} has no mouth`);
      assert.ok(f.strokeWidth > 0);
    }
  });

  test(`${m.name}: idle is the source drawing's own face, and the default`, () => {
    const f = m.face('idle');
    assert.deepEqual(m.face(), f);
    f.eyes.forEach((eye, i) => {
      assert.equal(eye.kind, 'open');
      if (eye.kind !== 'open') return;
      assert.deepEqual([eye.cx, eye.cy, eye.rx, eye.ry], m.idle.eyes[i]);
    });
    assert.deepEqual(f.mouth, { kind: 'stroke', d: m.idle.mouth });
  });

  test(`${m.name}: no two expressions share a face`, () => {
    const seen = new Map<string, string>();
    for (const e of MASCOT_EXPRESSIONS) {
      const key = JSON.stringify(m.face(e));
      assert.ok(!seen.has(key), `${m.name} ${e} looks the same as ${seen.get(key)}`);
      seen.set(key, e);
    }
  });

  test(`${m.name}: every face stays inside the viewBox`, () => {
    for (const e of MASCOT_EXPRESSIONS) {
      for (const p of points(m.face(e))) assert.ok(inside(m.vb, p), `${m.name} ${e} reaches ${p} outside the viewBox`);
    }
  });
}
