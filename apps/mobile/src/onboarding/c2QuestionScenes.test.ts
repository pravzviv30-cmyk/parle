import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boldRhythm } from '../palette.ts';
import { c2SvgForInstance } from '../art/flat/c2SvgNamespace.ts';
import { createC2QuestionDrawings, createC2QuestionGestureDrawings, type C2QuestionGesture } from './c2QuestionDrawings.ts';
import { C2_QUESTION_SCENE } from './c2QuestionScenes.ts';
import { c2FloatAmount, c2GestureAmount } from './motion/c2MotionPolicy.ts';

const drawings = createC2QuestionDrawings(boldRhythm);

const NUMBER = '[-+]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:[eE][-+]?\\d+)?';

/**
 * A conservative proof for this drawing vocabulary, not a general SVG renderer.
 * Bézier curves stay inside the convex hull of their control/end points. Adding
 * half a round stroke width therefore encloses every rendered curve, cap and
 * join. Unsupported shapes/commands/transforms fail instead of disappearing
 * from the geometry proof. Actual composition/painting still needs visual QA.
 */
function svgConservativeBounds(xml: string) {
  const points: [number, number][] = [];
  const stack: { name: string; attributes: Record<string, string> }[] = [];
  const ids = new Set();
  let paintedNodes = 0;
  let viewBox: number[] | undefined;
  const tags = [...xml.matchAll(/<([^>]+)>/g)];
  assert.ok(tags.length > 0, 'missing SVG');
  for (const match of tags) {
    const raw = match[1]!;
    assert.ok(!raw.startsWith('!') && !raw.startsWith('?'), 'unsupported XML declaration');
    if (raw.startsWith('/')) {
      assert.equal(stack.pop()?.name, raw.slice(1).trim(), 'unbalanced XML group');
      continue;
    }
    const name = /^([a-zA-Z][\w-]*)/.exec(raw)?.[1];
    assert.ok(name);
    assert.ok(['svg', 'g', 'path', 'circle', 'ellipse'].includes(name), `unsupported ${name}`);
    const attributes = Object.fromEntries([...raw.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1]!, m[2]!]));
    assert.ok(!attributes.transform && !attributes.style && !attributes.filter, 'unsupported geometry/paint transform');
    assert.ok(!Object.keys(attributes).some(key => /^on|^(?:href|xlink:href|src)$/.test(key)), 'external or executable resource');
    if (attributes.id) {
      assert.ok(!ids.has(attributes.id), `duplicate ID ${attributes.id}`);
      ids.add(attributes.id);
    }
    const inherited = stack.at(-1)?.attributes ?? {};
    const a = { ...inherited, ...attributes };
    const number = (key: string) => {
      const value = Number(a[key]);
      assert.ok(a[key] !== undefined && Number.isFinite(value), `invalid ${name}/${key}`);
      return value;
    };
    if (name === 'svg') {
      assert.equal(stack.length, 0, 'nested source SVG');
      viewBox = a.viewBox!.trim().split(/[\s,]+/).map(Number);
      assert.equal(viewBox.length, 4);
      assert.ok(viewBox.every(Number.isFinite));
      assert.ok(viewBox[2]! > 0 && viewBox[3]! > 0);
    }
    if (name === 'svg' || name === 'g') {
      assert.ok(!raw.endsWith('/'), 'empty structural node');
      stack.push({ name, attributes: a });
      continue;
    }
    assert.ok(raw.endsWith('/'), 'expected self-closing paint node');
    const stroked = a.stroke !== undefined && a.stroke !== 'none';
    const radius = stroked ? number('stroke-width') / 2 : 0;
    assert.ok(radius >= 0);
    if (stroked) {
      assert.equal(a['stroke-linecap'], 'round', 'nonround caps need a wider bound');
      assert.equal(a['stroke-linejoin'], 'round', 'miter joins need a wider bound');
    }
    const include = (x: number, y: number) => {
      assert.ok(Number.isFinite(x) && Number.isFinite(y), 'nonfinite path coordinate');
      points.push([x - radius, y - radius], [x + radius, y + radius]);
    };
    if (name === 'path') {
      const d = a.d;
      assert.ok(d !== undefined, 'missing path');
      assert.ok(d.length > 0, 'empty path');
      const tokenExpression = new RegExp(`[A-Za-z]|${NUMBER}`, 'g');
      const tokens = [...d.matchAll(tokenExpression)];
      let cursor = 0;
      for (const token of tokens) {
        assert.match(d.slice(cursor, token.index!), /^[\s,]*$/, 'invalid path content');
        cursor = token.index! + token[0].length;
      }
      assert.match(d.slice(cursor), /^[\s,]*$/, 'invalid path suffix');
      let command: string | undefined;
      for (let i = 0; i < tokens.length;) {
        if (/^[A-Za-z]$/.test(tokens[i]![0])) command = tokens[i++]![0];
        if (command === 'Z') { command = undefined; continue; }
        const counts: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4 };
        const count = command ? counts[command] : undefined;
        assert.ok(count, `unsupported path command ${command}`);
        const values = tokens.slice(i, i + count).map(token => Number(token[0]));
        assert.equal(values.length, count, 'incomplete path command');
        assert.ok(values.every(Number.isFinite), 'bad path command numbers');
        for (let j = 0; j < count; j += 2) include(values[j]!, values[j + 1]!);
        i += count;
      }
    } else {
      const x = number('cx');
      const y = number('cy');
      const rx = number(name === 'circle' ? 'r' : 'rx');
      const ry = number(name === 'circle' ? 'r' : 'ry');
      assert.ok(rx > 0 && ry > 0, 'empty ellipse');
      include(x - rx, y - ry);
      include(x + rx, y + ry);
    }
    paintedNodes++;
  }
  assert.equal(stack.length, 0, 'unclosed SVG');
  assert.ok(points.length > 0, 'no painted geometry');
  assert.ok(viewBox);
  return {
    viewBox, paintedNodes,
    minX: Math.min(...points.map(point => point[0])),
    minY: Math.min(...points.map(point => point[1])),
    maxX: Math.max(...points.map(point => point[0])),
    maxY: Math.max(...points.map(point => point[1])),
  };
}

type Range = [number, number];

function product(a: Range, b: Range): Range {
  const values = [a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]];
  return [Math.min(...values), Math.max(...values)];
}

function sum(a: Range, b: Range): Range { return [a[0] + b[0], a[1] + b[1]]; }
function negative(a: Range): Range { return [-a[1], -a[0]]; }

function trigRange(low: number, high: number, sine: boolean): Range {
  if (high - low >= 2 * Math.PI) return [-1, 1];
  const fn = sine ? Math.sin : Math.cos;
  const values = [fn(low), fn(high)];
  const first = sine ? Math.PI / 2 : 0;
  for (let k = Math.ceil((low - first) / Math.PI); k <= Math.floor((high - first) / Math.PI); k++) {
    values.push(fn(first + k * Math.PI));
  }
  return [Math.min(...values), Math.max(...values)];
}

/**
 * Continuous envelope matching GesturePart's [translateY, rotate, scale] around
 * its source-canvas pivot: scale/rotate first, screen-axis lift last. Offsets
 * use f(wrapped phase + offset) - f(offset), so amount spans [-base, 1-base].
 * Interval arithmetic includes every possible frame (not just sampled phases).
 * Ignoring the correlation between angle, scale and lift only widens the bound.
 * `baseline` must be c2FloatAmount(gesture.phaseOffset ?? 0) from the production
 * pure function. `sceneBob` adds the enclosing whole-scene float's full range.
 */
function gestureConservativeBounds(bounds: ReturnType<typeof svgConservativeBounds>, gesture: C2QuestionGesture | undefined, baseline = 0, sceneBob = 0) {
  assert.ok(Number.isFinite(sceneBob), 'bad scene float');
  if (!gesture) return {
    ...bounds,
    minY: bounds.minY + Math.min(0, sceneBob),
    maxY: bounds.maxY + Math.max(0, sceneBob),
  };
  assert.ok(gesture.pivot?.length === 2 && gesture.pivot.every(Number.isFinite), 'invalid source pivot');
  const offset = gesture.phaseOffset ?? 0;
  assert.ok(Number.isFinite(offset) && offset >= 0 && offset < 1, 'invalid declared phase offset');
  assert.ok(Number.isFinite(baseline) && baseline >= 0 && baseline <= 1, 'invalid baseline amount');
  const rotate = gesture.rotate ?? 0;
  const scale = gesture.scale ?? 0;
  const lift = gesture.lift ?? 0;
  assert.ok([rotate, scale, lift].every(Number.isFinite), 'nonfinite gesture amplitude');
  const amount: Range = [-baseline, 1 - baseline];
  const angle = product(amount, [rotate * Math.PI / 180, rotate * Math.PI / 180]);
  const scaleRange = sum([1, 1], product(amount, [scale, scale]));
  assert.ok(scaleRange[0] > 0, 'gesture scale collapses or flips the SVG');
  const liftRange = product(amount, [lift, lift]);
  const cos = trigRange(angle[0], angle[1], false);
  const sin = trigRange(angle[0], angle[1], true);
  const [px, py] = gesture.pivot;
  const xRanges: Range[] = [];
  const yRanges: Range[] = [];
  for (const x of [bounds.minX, bounds.maxX]) {
    for (const y of [bounds.minY, bounds.maxY]) {
      const dx: Range = [x - px, x - px];
      const dy: Range = [y - py, y - py];
      const rotatedX = sum(product(dx, cos), negative(product(dy, sin)));
      const rotatedY = sum(product(dx, sin), product(dy, cos));
      xRanges.push(sum([px, px], product(rotatedX, scaleRange)));
      yRanges.push(sum(sum([py, py], product(rotatedY, scaleRange)), liftRange));
    }
  }
  return {
    ...bounds,
    minX: Math.min(...xRanges.map(range => range[0])),
    maxX: Math.max(...xRanges.map(range => range[1])),
    minY: Math.min(...yRanges.map(range => range[0])) + Math.min(0, sceneBob),
    maxY: Math.max(...yRanges.map(range => range[1])) + Math.max(0, sceneBob),
  };
}

test('all six redrafted question drawings fit the reserved canvas through the complete float', () => {
  assert.deepEqual(Object.keys(drawings).sort(), ['confidence', 'focus', 'interests', 'reason', 'start-level', 'time']);
  assert.equal(new Set(Object.values(drawings)).size, 6, 'each topic needs its own drawing');
  assert.equal(C2_QUESTION_SCENE.width / C2_QUESTION_SCENE.height, 280 / 180);
  assert.equal(C2_QUESTION_SCENE.layers.length, 0, 'the redraft cannot silently restore the retired clipart composition');
  for (const [page, xml] of Object.entries(drawings)) {
    assert.doesNotMatch(xml, /<(?:image|script|foreignObject|animate|set)\b|https?:\/\/(?!www\.w3\.org\/2000\/svg)/, page);
    const bounds = svgConservativeBounds(xml);
    assert.deepEqual(bounds.viewBox, [0, 0, C2_QUESTION_SCENE.width, C2_QUESTION_SCENE.height]);
    assert.ok(bounds.minX >= 8 && bounds.maxX <= C2_QUESTION_SCENE.width - 8, page + ' side clearance');
    for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
      const lift = (C2_QUESTION_SCENE.bob ?? 0) * c2FloatAmount(phase);
      assert.ok(bounds.minY + lift >= 2, page + ' clips at the top');
      assert.ok(bounds.maxY + lift <= 172, page + ' crosses the cream edge');
    }
  }
});

test('ordinary rerenders and multiple question instances preserve shapes with isolated SVG IDs', () => {
  const ids = (xml: string) => [...xml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]!);
  const withoutIds = (xml: string) => xml.replace(/\bid="[^"]+"/g, '').replace(/url\(#[^)]*\)/g, 'url(#definition)');
  assert.deepEqual(createC2QuestionDrawings(boldRhythm), drawings, 'drawing creation must be deterministic');
  for (const [page, raw] of Object.entries(drawings)) {
    const first = c2SvgForInstance(raw, ':question:first:');
    const second = c2SvgForInstance(raw, ':question:second:');
    assert.ok(ids(first).length > 0, page + ' lacks a stable drawing identifier');
    assert.equal(new Set(ids(first)).size, ids(first).length, page + ' has duplicate IDs');
    assert.equal(ids(first).filter(id => ids(second).includes(id)).length, 0, page + ' instances conflict');
    assert.equal(withoutIds(first), withoutIds(raw), page + ' shapes or colours changed');
    assert.equal(c2SvgForInstance(raw, ':question:first:'), first, page + ' rerender changed identifiers');
  }
});

test('the painted-bounds proof refuses unsupported geometry instead of omitting it', () => {
  const raw = drawings.time;
  assert.throws(() => svgConservativeBounds(raw.replace('<g ', '<g transform="translate(100 0)" ')), /unsupported geometry/);
  assert.throws(() => svgConservativeBounds(raw.replace(/<path d="[^"]+"/, '<path d="M0 0A10 10 0 0 0 20 20"')), /unsupported path command A/);
  assert.throws(() => svgConservativeBounds(raw.replace(/<path d="[^"]+"/, '<path d="M0 NaN"')), /bad path command numbers|unsupported path command|incomplete path command/);
  assert.throws(() => svgConservativeBounds(raw.replace('</svg>', '<image href="https://example.com/art.png"/></svg>')), /unsupported image/);
});


test('every semantic gesture stays inside the canvas for all possible poses', () => {
  for (const [page, parts] of Object.entries(createC2QuestionGestureDrawings(boldRhythm))) {
    assert.ok(parts.some(part => part.gesture), page + ' has no character gesture');
    assert.equal(new Set(parts.map(part => part.id)).size, parts.length, page + ' has duplicate layer keys');
    for (const part of parts) {
      const bounds = svgConservativeBounds(part.xml);
      assert.deepEqual(bounds.viewBox, [0, 0, 280, 180]);
      const envelope = gestureConservativeBounds(bounds, part.gesture,
        c2FloatAmount(part.gesture?.phaseOffset ?? 0), C2_QUESTION_SCENE.bob);
      assert.ok(envelope.minX >= 8 && envelope.maxX <= 272, page + '/' + part.id + ' continuous side clearance');
      assert.ok(envelope.minY >= 2 && envelope.maxY <= 172, page + '/' + part.id + ' continuous vertical clearance');
    }
  }
});

test('semantic layers preserve Rest painting order and keep held props on the same joint', () => {
  const parts = createC2QuestionGestureDrawings(boldRhythm);
  assert.deepEqual(createC2QuestionGestureDrawings(boldRhythm), parts, 'answer rerenders must keep a deterministic registry');
  const paint = (xml: string) => [...xml.matchAll(/<(?:path|circle|ellipse)\b[^>]*\/>/g)].map(match => match[0]);
  for (const [page, layers] of Object.entries(parts)) {
    assert.deepEqual(layers.flatMap(layer => paint(layer.xml)), paint(drawings[page as keyof typeof drawings]), page + ' changes paint order');
    for (const layer of layers) {
      assert.equal(c2GestureAmount(0, layer.gesture?.phaseOffset), 0, 'reduced motion must retain the Rest pose');
      assert.equal(c2GestureAmount(1, layer.gesture?.phaseOffset), 0, 'a completed loop must return to Rest');
    }
  }
  for (const [page, first, second] of [
    ['reason', 'compass-arm', 'compass'],
    ['start-level', 'watering-arm', 'watering-can'],
    ['confidence', 'left-open-arm', 'left-open-hand'],
    ['confidence', 'right-open-arm', 'right-open-hand'],
  ] as const) {
    const arm = parts[page].find(part => part.id === first)?.gesture;
    const held = parts[page].find(part => part.id === second)?.gesture;
    assert.ok(arm && held, page + ' lacks its authored joint');
    assert.deepEqual(held, arm, page + ' separates a held prop from its arm');
  }
  const cup = parts.time.find(part => part.id === 'cup-arm')?.gesture;
  const steam = parts.time.find(part => part.id === 'cup-steam')?.gesture;
  assert.ok(cup && steam);
  assert.deepEqual(steam.pivot, cup.pivot);
  assert.equal(steam.rotate, cup.rotate, 'steam must follow the cup tilt');
});

test('continuous envelope includes interior rotation extrema and refuses invalid gesture geometry', () => {
  const bounds = svgConservativeBounds(drawings.time);
  assert.throws(() => gestureConservativeBounds(bounds, { pivot: [NaN, 90], rotate: 2 }), /invalid source pivot/);
  assert.throws(() => gestureConservativeBounds(bounds, { pivot: [140, 90], scale: -1 }), /collapses or flips/);
  assert.throws(() => gestureConservativeBounds(bounds, { pivot: [140, 90], phaseOffset: 1 }), /invalid declared phase/);
  const envelope = gestureConservativeBounds({ ...bounds, minX: 100, maxX: 100, minY: 0, maxY: 0 }, { pivot: [0, 0], rotate: 180 });
  assert.ok(envelope.minX <= -100 && envelope.maxX >= 100);
  assert.ok(envelope.maxY >= 100, 'mid-cycle 90-degree extremum must be covered');
});
