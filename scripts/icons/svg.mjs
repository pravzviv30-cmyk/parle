/**
 * The icon cleaner: one raw SVG string in, one react-native-svg drawing out.
 *
 * Pure on purpose: no file I/O, no clock and no randomness, so the same source
 * always makes the same component, `build-icons.mjs` can be run twice and leave
 * `git status` clean, and `apps/mobile/src/icons/svg.test.ts` can hold every
 * rule here from Node.
 *
 * The cleanup follows come alive's icon spec (docs/come-alive/icons-layout.md,
 * section 1.2), in order:
 *
 *   1. Drop width, height, xmlns, title, id, clip-path, defs and clipPath.
 *   2. Unwrap a <g> left with nothing to say; keep a transform only when it is
 *      not the identity.
 *   3. kebab-case attributes become camelCase props.
 *   4. Every number is rounded to 3 decimals with trailing zeros stripped,
 *      inside path data, points and transforms too.
 *   5. Colours: white, #292D32 and currentColor become the mark's `{color}`.
 *      An element (or a group) drawn below full opacity is the Bulk second
 *      layer: its paint becomes `{secondary}` at `{SECONDARY_OPACITY}`. A
 *      layer at 0.9 or above is the mark itself. `none` stays "none".
 *   6. Every stroke width becomes `{STROKE}`, the app's one pen.
 *   7. A configured rotate or translate wraps the drawing in one <G>.
 *   8. A configured split names the top-level elements each part draws.
 *
 * Two small additions, both deterministic: an element repeated exactly (some
 * sources draw the same path twice) is drawn once, and an element with a stroke
 * and no fill says `fill="none"` itself, because react-native-svg fills with
 * black by default and the source relied on its root to say otherwise.
 *
 * Hard failures, never a silent guess: an element other than path, circle,
 * rect, line, polyline, polygon or g; a gradient, filter, mask or `url(`; an
 * unknown colour or attribute; a box that is not 24 square with no configured
 * translate; a part index out of range, shared, or left out.
 */

/** The one box every icon is drawn on. */
export const BOX = 24;

/** The token each stroke width becomes. Imported from theme.ts by the generated file. */
export const STROKE_TOKEN = 'STROKE';

/** The token each Bulk second layer's opacity becomes. Exported by icons/drawing.ts. */
export const OPACITY_TOKEN = 'SECONDARY_OPACITY';

/** A cleaner refusal. Its message names the icon and the reason. */
export class IconError extends Error {}

/** @param {string} where @param {string} message @returns {never} */
function fail(where, message) {
  throw new IconError(`${where}: ${message}`);
}

/**
 * @typedef {{ name: string, attrs: [string, string][], children: SvgNode[] }} SvgNode
 * @typedef {'color' | 'secondary'} Role
 * @typedef {{ tag: string, props: [string, string][], children: Drawn[], roles: Set<Role>, stroke: boolean, opacity: boolean }} Drawn
 * @typedef {{ rotate?: number, translate?: [number, number], parts?: Record<string, number[]> }} CleanOptions
 * @typedef {{ elements: Drawn[], parts?: Record<string, Drawn[]> }} Cleaned
 */

// ------------------------------------------------------------------ parsing

const TAG = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[a-zA-Z_:][\w:.-]*\s*=\s*"[^"]*")*)\s*(\/?)>/g;
const ATTR = /([a-zA-Z_:][\w:.-]*)\s*=\s*"([^"]*)"/g;

/**
 * Markup to a tree. Only elements and the whitespace between them: text, a
 * comment, a doctype or an unquoted attribute is markup the cleaner cannot
 * read, so it fails rather than guessing.
 *
 * @param {string} source
 * @param {string} [where]
 * @returns {SvgNode}
 */
export function parseSvg(source, where = 'svg') {
  /** @type {SvgNode} */
  const root = { name: '#root', attrs: [], children: [] };
  const stack = [root];
  let at = 0;
  for (const m of source.matchAll(TAG)) {
    const between = source.slice(at, m.index);
    if (between.trim() !== '') fail(where, `text or markup the cleaner cannot read: ${between.trim().slice(0, 60)}`);
    at = (m.index ?? 0) + m[0].length;
    const [, closing, name, attrText, self] = m;
    if (closing) {
      const open = stack.pop();
      if (open === undefined || open.name !== name) fail(where, `</${name}> closes nothing it opened`);
      continue;
    }
    /** @type {[string, string][]} */
    const attrs = [...(attrText ?? '').matchAll(ATTR)].map((a) => [a[1] ?? '', a[2] ?? '']);
    const names = attrs.map(([n]) => n);
    if (new Set(names).size !== names.length) fail(where, `<${name}> repeats an attribute`);
    /** @type {SvgNode} */
    const node = { name: name ?? '', attrs, children: [] };
    stack[stack.length - 1]?.children.push(node);
    if (!self) stack.push(node);
  }
  if (source.slice(at).trim() !== '') fail(where, `text or markup the cleaner cannot read: ${source.slice(at).trim().slice(0, 60)}`);
  if (stack.length !== 1) fail(where, `<${stack[stack.length - 1]?.name}> is never closed`);
  const svg = root.children[0];
  if (root.children.length !== 1 || svg === undefined || svg.name !== 'svg') fail(where, 'the markup is not one <svg>');
  return svg;
}

// ------------------------------------------------------------------ numbers

/** One number, rounded to 3 decimals, trailing zeros stripped, never "-0". */
export function formatNumber(n) {
  if (!Number.isFinite(n)) throw new IconError(`not a finite number: ${n}`);
  const rounded = Number(n.toFixed(3));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/** @param {string} where @param {string} name @param {string} value */
function number(where, name, value) {
  const n = Number(value);
  if (value.trim() === '' || !Number.isFinite(n)) fail(where, `${name}="${value}" is not a number`);
  return formatNumber(n);
}

/** How many arguments each path command takes per segment. */
const ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/**
 * Path data, re-written with every number rounded and one space between
 * arguments. Arc flags are read as the single digits they are, so `a1 1 0 011 1`
 * reads as flags 0 and 1, then 1 and 1, the way an SVG renderer reads it.
 *
 * @param {string} where
 * @param {string} d
 */
export function cleanPath(where, d) {
  const out = [];
  let i = 0;
  const skip = () => {
    while (i < d.length && /[\s,]/.test(d[i] ?? '')) i += 1;
  };
  const NUM = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/;
  const readNumber = () => {
    skip();
    const m = NUM.exec(d.slice(i));
    if (!m) fail(where, `path data has no number at "${d.slice(i, i + 12)}"`);
    i += m[0].length;
    return Number(m[0]);
  };
  const readFlag = () => {
    skip();
    const c = d[i];
    if (c !== '0' && c !== '1') fail(where, `an arc flag is not 0 or 1 at "${d.slice(i, i + 12)}"`);
    i += 1;
    return Number(c);
  };
  skip();
  while (i < d.length) {
    const cmd = d[i] ?? '';
    const upper = cmd.toUpperCase();
    if (!(upper in ARITY)) fail(where, `path data has a command the cleaner cannot read: "${d.slice(i, i + 12)}"`);
    i += 1;
    const arity = ARITY[/** @type {keyof typeof ARITY} */ (upper)];
    /** @type {number[]} */
    const args = [];
    if (arity === 0) {
      out.push(cmd);
      skip();
      continue;
    }
    do {
      for (let k = 0; k < arity; k += 1) args.push(upper === 'A' && (k === 3 || k === 4) ? readFlag() : readNumber());
      skip();
    } while (i < d.length && !/[a-zA-Z]/.test(d[i] ?? ''));
    out.push(`${cmd}${args.map(formatNumber).join(' ')}`);
  }
  if (out.length === 0) fail(where, 'empty path data');
  return out.join('');
}

/** @param {string} where @param {string} value */
function cleanNumberList(where, value) {
  const parts = value.trim().split(/[\s,]+/).filter((p) => p !== '');
  if (parts.length === 0) fail(where, `"${value}" lists no numbers`);
  return parts.map((p) => number(where, 'list', p)).join(' ');
}

/**
 * A transform list with its numbers rounded, or null when it is the identity.
 * @param {string} where @param {string} value
 */
function cleanTransform(where, value) {
  const items = [...value.matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)];
  const rest = value.replace(/([a-zA-Z]+)\s*\(([^)]*)\)/g, '').trim();
  if (rest !== '' || items.length === 0) fail(where, `a transform the cleaner cannot read: ${value}`);
  const kept = [];
  for (const [, fn, argText] of items) {
    if (!['translate', 'rotate', 'scale', 'matrix'].includes(fn ?? '')) fail(where, `a transform the cleaner does not keep: ${fn}`);
    const args = (argText ?? '').trim().split(/[\s,]+/).filter((a) => a !== '').map((a) => Number(number(where, fn ?? '', a)));
    const identity =
      (fn === 'translate' && args.every((a) => a === 0)) ||
      (fn === 'rotate' && args[0] === 0) ||
      (fn === 'scale' && args.every((a) => a === 1)) ||
      (fn === 'matrix' && args.join(' ') === '1 0 0 1 0 0');
    if (!identity) kept.push(`${fn}(${args.map(formatNumber).join(' ')})`);
  }
  return kept.length === 0 ? null : kept.join(' ');
}

// ------------------------------------------------------------------ cleaning

/** The elements a mark may draw, and the react-native-svg component each is. */
export const ELEMENTS = { path: 'Path', circle: 'Circle', rect: 'Rect', line: 'Line', polyline: 'Polyline', polygon: 'Polygon', g: 'G' };

/** Each element's geometry, written as numbers unless named in STRING_GEOMETRY. */
const GEOMETRY = {
  path: ['d'],
  circle: ['cx', 'cy', 'r'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
  g: [],
};

/** The paint a mark may carry, in the order a generated prop list writes it. */
const PAINT = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'fill-rule',
  'clip-rule',
  'opacity',
  'transform',
];

/** Attributes that say nothing once the drawing is a component. */
const DROPPED = new Set(['id', 'clip-path', 'xmlns', 'data-name']);

/** Elements dropped with everything inside them, once checked. */
const DROPPED_TREES = new Set(['defs', 'title', 'desc']);

/** Anything a mark may never contain. */
const REFUSED = new Set(['linearGradient', 'radialGradient', 'filter', 'mask', 'pattern', 'image', 'text', 'use', 'symbol', 'style', 'script', 'foreignObject']);

const ENUMS = {
  'stroke-linecap': ['round', 'butt', 'square'],
  'stroke-linejoin': ['round', 'miter', 'bevel'],
  'fill-rule': ['evenodd', 'nonzero'],
  'clip-rule': ['evenodd', 'nonzero'],
};

/** The colours a source may use for its mark. Each becomes the caller's colour. */
const MARK_COLOURS = new Set(['white', '#ffffff', '#fff', '#292d32', 'currentcolor']);

const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** Whether an opacity is the mark (true), the Bulk second layer (false), or neither (a failure). */
function isMarkOpacity(where, value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) fail(where, `opacity="${value}" is not between 0 and 1`);
  if (n >= 0.9) return true;
  if (n <= 0.7) return false;
  return fail(where, `opacity="${value}" is neither the mark (0.9 and above) nor its second layer (0.7 and below)`);
}

/**
 * One source element to its drawn form, or null when it is dropped.
 *
 * @param {string} where
 * @param {SvgNode} node
 * @param {boolean} secondary inside a group drawn as the second layer
 * @returns {Drawn[]}
 */
function cleanNode(where, node, secondary) {
  if (REFUSED.has(node.name)) fail(where, `<${node.name}> is a gradient, filter, mask or other effect, and a mark is flat`);
  if (DROPPED_TREES.has(node.name)) {
    if (node.name === 'defs') checkDefs(where, node);
    return [];
  }
  if (node.name === 'clipPath') return checkDefs(where, { name: 'defs', attrs: [], children: [node] }), [];
  const kind = /** @type {keyof typeof GEOMETRY} */ (node.name);
  if (!(kind in ELEMENTS)) fail(where, `<${node.name}> is an element a mark may not draw`);

  /** @type {Map<string, string>} */
  const attrs = new Map();
  for (const [name, value] of node.attrs) {
    if (/url\(/i.test(value) && name !== 'clip-path') fail(where, `${name}="${value}" reaches for a url(), which a mark may not`);
    if (DROPPED.has(name)) {
      if (name === 'clip-path' && !/^url\(#[\w-]+\)$/.test(value)) fail(where, `clip-path="${value}" is not a plain clip reference`);
      continue;
    }
    if (!GEOMETRY[kind].includes(name) && !PAINT.includes(name)) fail(where, `<${node.name}> carries an attribute the cleaner does not know: ${name}="${value}"`);
    attrs.set(name, value);
  }

  let layerIsSecondary = secondary;
  if (attrs.has('opacity')) {
    const mark = isMarkOpacity(where, attrs.get('opacity') ?? '');
    if (!mark && secondary) fail(where, 'a second layer inside a second layer');
    if (!mark) layerIsSecondary = true;
  }
  const ownOpacity = attrs.has('opacity') && !isMarkOpacity(where, attrs.get('opacity') ?? '');

  /** @type {[string, string][]} */
  const props = [];
  /** @type {Set<Role>} */
  const roles = new Set();
  let stroke = false;

  for (const name of GEOMETRY[kind]) {
    const value = attrs.get(name);
    if (value === undefined) continue;
    if (name === 'd') props.push(['d', `"${cleanPath(where, value)}"`]);
    else if (name === 'points') props.push(['points', `"${cleanNumberList(where, value)}"`]);
    else props.push([camel(name), `{${number(where, name, value)}}`]);
  }

  const paint = (name) => {
    const value = (attrs.get(name) ?? '').trim();
    if (value.toLowerCase() === 'none') return '"none"';
    if (!MARK_COLOURS.has(value.toLowerCase())) fail(where, `${name}="${value}" is a colour the cleaner does not know`);
    const role = layerIsSecondary ? 'secondary' : 'color';
    roles.add(role);
    return `{${role}}`;
  };

  if (kind === 'g') {
    if (attrs.has('fill')) props.push(['fill', paint('fill')]);
    if (attrs.has('stroke')) props.push(['stroke', paint('stroke')]);
  } else {
    const hasStroke = attrs.has('stroke') && attrs.get('stroke')?.trim().toLowerCase() !== 'none';
    const hasFill = attrs.has('fill') && attrs.get('fill')?.trim().toLowerCase() !== 'none';
    if (!hasStroke && !hasFill) fail(where, `<${node.name}> has neither a fill nor a stroke, so it draws nothing`);
    props.push(['fill', attrs.has('fill') ? paint('fill') : '"none"']);
    if (attrs.has('stroke')) props.push(['stroke', paint('stroke')]);
    if (hasStroke) {
      stroke = true;
      props.push(['strokeWidth', `{${STROKE_TOKEN}}`]);
    }
  }
  if (attrs.has('stroke-width') && kind === 'g') fail(where, 'a group sets a stroke width; each mark says its own');

  for (const name of ['stroke-linecap', 'stroke-linejoin']) {
    const value = attrs.get(name);
    if (value === undefined) continue;
    if (!ENUMS[name].includes(value)) fail(where, `${name}="${value}" is not a value the cleaner knows`);
    if (stroke) props.push([camel(name), `"${value}"`]);
  }
  if (attrs.has('stroke-miterlimit') && stroke) props.push(['strokeMiterlimit', `{${number(where, 'stroke-miterlimit', attrs.get('stroke-miterlimit') ?? '')}}`]);
  if (attrs.has('stroke-dasharray')) props.push(['strokeDasharray', `"${cleanNumberList(where, attrs.get('stroke-dasharray') ?? '')}"`]);
  for (const name of ['fill-rule', 'clip-rule']) {
    const value = attrs.get(name);
    if (value === undefined) continue;
    if (!ENUMS[name].includes(value)) fail(where, `${name}="${value}" is not a value the cleaner knows`);
    props.push([camel(name), `"${value}"`]);
  }
  if (ownOpacity) props.push(['opacity', `{${OPACITY_TOKEN}}`]);
  const transform = attrs.has('transform') ? cleanTransform(where, attrs.get('transform') ?? '') : null;
  if (transform !== null) props.push(['transform', `"${transform}"`]);

  const children = node.children.flatMap((child) => cleanNode(where, child, layerIsSecondary));
  if (kind !== 'g' && children.length > 0) fail(where, `<${node.name}> has children; only a <g> may group`);
  if (kind === 'g') {
    // A group with nothing left to say is unwrapped into its parent.
    if (props.length === 0) return children;
    if (children.length === 0) return [];
  }
  /** @type {Drawn} */
  const drawn = { tag: ELEMENTS[kind], props, children, roles, stroke, opacity: ownOpacity };
  for (const child of children) {
    for (const role of child.roles) roles.add(role);
    if (child.stroke) drawn.stroke = true;
    if (child.opacity) drawn.opacity = true;
  }
  return [drawn];
}

/** A clip definition is dropped, but only once it is shown to hold nothing but a clip. */
function checkDefs(where, defs) {
  for (const child of defs.children) {
    if (child.name !== 'clipPath') fail(where, `<defs> holds <${child.name}>, and only a clip may be dropped`);
    for (const shape of child.children) {
      if (!['rect', 'path', 'circle'].includes(shape.name)) fail(where, `a clip holds <${shape.name}>`);
    }
  }
}

/** The one-line JSX an element serialises to, which is also how two copies are recognised. */
export function serialise(drawn) {
  const open = [drawn.tag, ...drawn.props.map(([name, value]) => `${name}=${value}`)].join(' ');
  if (drawn.children.length === 0) return `<${open} />`;
  return `<${open}>${drawn.children.map(serialise).join('')}</${drawn.tag}>`;
}

/** @param {Drawn[]} elements */
function dedupe(elements) {
  const seen = new Set();
  return elements.filter((e) => {
    const key = serialise(e);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** @param {Drawn[]} elements @param {string | null} transform */
function wrap(elements, transform) {
  if (transform === null) return elements;
  /** @type {Set<Role>} */
  const roles = new Set();
  for (const e of elements) for (const r of e.roles) roles.add(r);
  return [{ tag: 'G', props: [['transform', `"${transform}"`]], children: elements, roles, stroke: elements.some((e) => e.stroke), opacity: elements.some((e) => e.opacity) }];
}

/**
 * A parsed <svg> to the elements it draws.
 *
 * @param {SvgNode} svg
 * @param {string} where
 * @param {CleanOptions} [options]
 * @returns {Cleaned}
 */
export function clean(svg, where, options = {}) {
  if (svg.name !== 'svg') fail(where, 'the drawing is not an <svg>');
  let viewBox = null;
  for (const [name, value] of svg.attrs) {
    if (name === 'width' || name === 'height' || name === 'xmlns') continue;
    if (name === 'viewBox') viewBox = value;
    else if (name === 'fill') {
      if (value !== 'none') fail(where, `the <svg> fill is "${value}", not "none"`);
    } else fail(where, `the <svg> carries an attribute the cleaner does not know: ${name}`);
  }
  const box = /^0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)$/.exec(viewBox ?? '');
  if (!box) fail(where, `the viewBox "${viewBox}" does not start at 0 0`);
  const square = Number(box[1]) === BOX && Number(box[2]) === BOX;
  if (!square && options.translate === undefined) {
    fail(where, `drawn on a ${box[1]} by ${box[2]} box; give it a translate onto the ${BOX} box or pick another icon`);
  }
  if (Number(box[1]) > BOX || Number(box[2]) > BOX) fail(where, `drawn on a box larger than ${BOX}`);

  const elements = dedupe(svg.children.flatMap((child) => cleanNode(where, child, false)));
  if (elements.length === 0) fail(where, 'the drawing draws nothing');

  const transforms = [];
  if (options.translate !== undefined) {
    const [x, y] = options.translate;
    transforms.push(`translate(${formatNumber(x)} ${formatNumber(y)})`);
  }
  if (options.rotate !== undefined) transforms.push(`rotate(${formatNumber(options.rotate)} ${BOX / 2} ${BOX / 2})`);
  const transform = transforms.length === 0 ? null : transforms.join(' ');

  /** @type {Cleaned} */
  const out = { elements: wrap(elements, transform) };
  if (options.parts !== undefined) {
    const used = new Map();
    /** @type {Record<string, Drawn[]>} */
    const parts = {};
    for (const [part, indices] of Object.entries(options.parts)) {
      if (!/^[a-z][a-zA-Z0-9]*$/.test(part)) fail(where, `the part name "${part}" is not a plain identifier`);
      if (indices.length === 0) fail(where, `the part "${part}" draws nothing`);
      for (const index of indices) {
        if (!Number.isInteger(index) || index < 0 || index >= elements.length) {
          fail(where, `the part "${part}" names element ${index}, and the drawing has ${elements.length}`);
        }
        if (used.has(index)) fail(where, `element ${index} is in both "${used.get(index)}" and "${part}"`);
        used.set(index, part);
      }
      parts[part] = wrap(indices.map((index) => /** @type {Drawn} */ (elements[index])), transform);
    }
    if (used.size !== elements.length) {
      const missing = elements.map((_, i) => i).filter((i) => !used.has(i));
      fail(where, `the parts leave out element ${missing.join(', ')}, so stacking them would not draw the whole icon`);
    }
    out.parts = parts;
  }
  return out;
}

// ------------------------------------------------------------------ output

/** `bell-ring` to `BellRing`. */
export const pascal = (name) =>
  name
    .split('-')
    .map((part) => (part[0] ?? '').toUpperCase() + part.slice(1))
    .join('');

/** @param {Drawn[]} elements @param {string} indent @param {string[]} lines */
function emit(elements, indent, lines) {
  for (const e of elements) {
    const open = [e.tag, ...e.props.map(([name, value]) => `${name}=${value}`)].join(' ');
    if (e.children.length === 0) {
      lines.push(`${indent}<${open} />`);
      continue;
    }
    lines.push(`${indent}<${open}>`);
    emit(e.children, `${indent}  `, lines);
    lines.push(`${indent}</${e.tag}>`);
  }
}

/** @param {Drawn[]} elements @param {Set<string>} into */
function collectTags(elements, into) {
  for (const e of elements) {
    into.add(e.tag);
    collectTags(e.children, into);
  }
}

/** One drawing as an arrow function returning a decorative <Svg>. */
function drawingLines(elements, indent) {
  /** @type {Set<Role>} */
  const roles = new Set();
  for (const e of elements) for (const r of e.roles) roles.add(r);
  const params = ['size', ...['color', 'secondary'].filter((r) => roles.has(/** @type {Role} */ (r)))];
  const lines = [`({ ${params.join(', ')} }) => (`, `${indent}  <Svg width={size} height={size} viewBox="0 0 ${BOX} ${BOX}" {...decorative}>`];
  emit(elements, `${indent}    `, lines);
  lines.push(`${indent}  </Svg>`, `${indent})`);
  return lines;
}

/**
 * A generated icon file.
 *
 * @param {{ name: string, header: string, drawings: Record<string, Cleaned> }} icon
 *   `drawings` maps each variant (`linear`, `bulk`) to its cleaned drawing.
 * @returns {string}
 */
export function toTsx({ name, header, drawings }) {
  const component = pascal(name);
  const tags = new Set();
  let stroke = false;
  let opacity = false;
  const all = [];
  for (const cleaned of Object.values(drawings)) {
    all.push(...cleaned.elements);
    for (const part of Object.values(cleaned.parts ?? {})) all.push(...part);
  }
  collectTags(all, tags);
  for (const e of all) {
    if (e.stroke) stroke = true;
    if (e.opacity) opacity = true;
  }
  const svgImports = [...tags].sort();
  const themeImports = ['decorative', ...(stroke ? [STROKE_TOKEN] : [])];
  const drawingImport = opacity
    ? `import { ${OPACITY_TOKEN}, type IconDrawings } from './drawing.ts';`
    : "import type { IconDrawings } from './drawing.ts';";

  const lines = [
    header,
    `import Svg, { ${svgImports.join(', ')} } from 'react-native-svg';`,
    `import { ${themeImports.join(', ')} } from '../theme.ts';`,
    drawingImport,
    '',
    `export const ${component}: IconDrawings = {`,
  ];
  const variants = Object.keys(drawings);
  for (const variant of variants) {
    const fn = drawingLines(/** @type {Cleaned} */ (drawings[variant]).elements, '  ');
    lines.push(`  ${variant}: ${fn[0]}`, ...fn.slice(1, -1), `${fn[fn.length - 1]},`);
  }
  const withParts = variants.filter((v) => drawings[v]?.parts !== undefined);
  if (withParts.length > 0) {
    lines.push('  parts: {');
    for (const variant of withParts) {
      lines.push(`    ${variant}: {`);
      for (const [part, elements] of Object.entries(/** @type {Record<string, Drawn[]>} */ (drawings[variant]?.parts))) {
        const fn = drawingLines(elements, '      ');
        lines.push(`      ${part}: ${fn[0]}`, ...fn.slice(1, -1), `${fn[fn.length - 1]},`);
      }
      lines.push('    },');
    }
    lines.push('  },');
  }
  lines.push('};', '');
  return lines.join('\n');
}
