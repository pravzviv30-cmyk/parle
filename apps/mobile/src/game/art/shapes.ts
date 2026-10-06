/**
 * The game's drawings, as data (come alive, decision D10).
 *
 * The flame, the medal, the level crest, the freeze mark and the repair mark
 * are flat vectors built in code in the one illustrator's style:
 * flat fills from the palette, no outlines, no gradients, no shadows, no
 * filters, no faces and no words. Each drawing is a list of named parts on a
 * 0 to 100 box, so a point is also a percentage of the drawing's size, and
 * each part names its fill by palette TOKEN (`colour.coral`, `paper.field`),
 * never by value: palette.ts stays the one place a colour is written, and the
 * test beside this file holds every part to it.
 *
 * Pure on purpose. No React, no engine: the components in this folder draw
 * these parts, `game/art/shapes.test.ts` checks them in Node, and
 * `scripts/art/game-art-sheet.mjs` draws the founder's contact sheet from the
 * same data, so what the founder approves is what the app draws.
 *
 * Kept out of the flat illustration registry (`art/flat/`) on purpose: that
 * registry is generated from ILLUSTRATIONS.md and pinned at 29 drawings.
 *
 * A part's `layer` says which parts move together. A still drawing is one
 * layer; the flame's outer, inner and core move as three. Nothing moves a part
 * but a transform or an opacity on its whole layer.
 *
 * On a colour ground that a drawing also uses, that colour and white trade
 * places, so nothing vanishes into the card it sits on: a coral flame on the
 * coral milestone card is drawn white and sun. A drawing that does not use the
 * ground's colour is drawn as it is.
 */

import { accent, colour, paper } from '../../palette.ts';

/** Every drawing sits on this box, 0 to 100 both ways. */
export const ART_VIEWBOX = '0 0 100 100';

/** The token groups a part may name. Nothing outside these three is a drawing colour. */
const GROUPS = { colour, paper, accent } as const;
type Groups = typeof GROUPS;

/** A palette token: a group and a key, spelled the way palette.ts writes them. */
export type ArtToken = {
  [G in keyof Groups]: `${G}.${Extract<keyof Groups[G], string>}`;
}[keyof Groups];

/** The palette value a token names. Throws on a token palette.ts does not export. */
export function colourOf(token: ArtToken): string {
  const dot = token.indexOf('.');
  const group = token.slice(0, dot) as keyof Groups;
  const key = token.slice(dot + 1);
  const table = GROUPS[group] as Readonly<Record<string, string>> | undefined;
  const value = table?.[key];
  if (value === undefined) throw new Error(`${token} is not a palette token`);
  return value;
}

/** The grounds a drawing sits on: paper (the ground and the white card), or one of the four colours. */
export type ArtGround = 'paper' | 'blue' | 'coral' | 'sun' | 'mint';

export const ART_GROUNDS: readonly ArtGround[] = ['paper', 'blue', 'coral', 'sun', 'mint'];

/** The token each ground is painted in. */
export const GROUND_TOKEN: Readonly<Record<ArtGround, ArtToken>> = {
  paper: 'paper.ground',
  blue: 'colour.blue',
  coral: 'colour.coral',
  sun: 'colour.sun',
  mint: 'colour.mint',
};

/**
 * One part's token on a ground. On a colour ground that the drawing also uses
 * (`trade`), that colour and white trade places, so a white star on a disc
 * that has just turned white takes the ground's colour instead of vanishing.
 * A drawing that does not use the ground's colour is drawn as it is: its white
 * stays white rather than turning into a hole the colour of the ground.
 */
export function onGround(token: ArtToken, ground: ArtGround, trade: boolean): ArtToken {
  if (ground === 'paper' || !trade) return token;
  const own = GROUND_TOKEN[ground];
  if (token === own) return 'paper.card';
  if (token === 'paper.card') return own;
  return token;
}

// ------------------------------------------------------------------ geometry

/** A point on the box. */
export type ArtPoint = readonly [number, number];
type Pt = ArtPoint;

/** Two decimals is a hundredth of a point at 100 pt: finer than any screen draws. */
const num = (v: number): string => String(Math.round(v * 100) / 100);
const pt = ([x, y]: Pt): string => `${num(x)} ${num(y)}`;

/** `p` turned `deg` degrees clockwise about `about`. */
function turn([x, y]: Pt, deg: number, about: Pt = [50, 50]): Pt {
  const a = (deg * Math.PI) / 180;
  const dx = x - about[0];
  const dy = y - about[1];
  return [about[0] + dx * Math.cos(a) - dy * Math.sin(a), about[1] + dx * Math.sin(a) + dy * Math.cos(a)];
}

/** The point `r` from `c` at `deg` degrees: 0 points right, 90 down, -90 up. */
function polar(c: Pt, r: number, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
}

/*
 * Every closed shape below is wound clockwise on screen, so where two subpaths
 * of one part overlap (the arms of the freeze crystal over its hub) the
 * nonzero rule fills them as one shape and never punches a hole.
 */

function polygon(points: readonly Pt[]): string {
  return `M${points.map(pt).join('L')}Z`;
}

function circle(c: Pt, r: number): string {
  const left: Pt = [c[0] - r, c[1]];
  const right: Pt = [c[0] + r, c[1]];
  return `M${pt(left)}A${num(r)} ${num(r)} 0 1 1 ${pt(right)}A${num(r)} ${num(r)} 0 1 1 ${pt(left)}Z`;
}

/** A rectangle with round corners, centred on `c`, turned `deg` degrees clockwise. */
function roundRect(c: Pt, w: number, h: number, r: number, deg = 0): string {
  const x0 = c[0] - w / 2;
  const y0 = c[1] - h / 2;
  const x1 = c[0] + w / 2;
  const y1 = c[1] + h / 2;
  const at = (p: Pt) => pt(turn(p, deg, c));
  const arc = (p: Pt) => `A${num(r)} ${num(r)} 0 0 1 ${at(p)}`;
  return (
    `M${at([x0 + r, y0])}L${at([x1 - r, y0])}${arc([x1, y0 + r])}` +
    `L${at([x1, y1 - r])}${arc([x1 - r, y1])}` +
    `L${at([x0 + r, y1])}${arc([x0, y1 - r])}` +
    `L${at([x0, y0 + r])}${arc([x0 + r, y0])}Z`
  );
}

/** A bar with round ends from `a` to `b`, `w` across. */
function capsule(a: Pt, b: Pt, w: number): string {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const h = w / 2;
  const nx = (-(b[1] - a[1]) / len) * h;
  const ny = ((b[0] - a[0]) / len) * h;
  const p1: Pt = [a[0] - nx, a[1] - ny];
  const p2: Pt = [b[0] - nx, b[1] - ny];
  const p3: Pt = [b[0] + nx, b[1] + ny];
  const p4: Pt = [a[0] + nx, a[1] + ny];
  return `M${pt(p1)}L${pt(p2)}A${num(h)} ${num(h)} 0 0 1 ${pt(p3)}L${pt(p4)}A${num(h)} ${num(h)} 0 0 1 ${pt(p1)}Z`;
}

/** A star of `points` points, the first pointing straight up. */
function star(c: Pt, outer: number, inner: number, points = 5): string {
  const corners: Pt[] = [];
  for (let i = 0; i < points * 2; i += 1) corners.push(polar(c, i % 2 === 0 ? outer : inner, -90 + (i * 180) / points));
  return polygon(corners);
}

/** A regular polygon of `sides` sides, a corner pointing straight up. */
function regular(c: Pt, r: number, sides: number): string {
  const corners: Pt[] = [];
  for (let i = 0; i < sides; i += 1) corners.push(polar(c, r, -90 + (i * 360) / sides));
  return polygon(corners);
}

/** A thick arc of a ring, clockwise from `from` degrees to `to` degrees, square at both ends. */
function arcBand(c: Pt, outer: number, inner: number, from: number, to: number): string {
  const span = (((to - from) % 360) + 360) % 360;
  const large = span > 180 ? 1 : 0;
  return (
    `M${pt(polar(c, outer, from))}A${num(outer)} ${num(outer)} 0 ${large} 1 ${pt(polar(c, outer, to))}` +
    `L${pt(polar(c, inner, to))}A${num(inner)} ${num(inner)} 0 ${large} 0 ${pt(polar(c, inner, from))}Z`
  );
}

/**
 * The flame's outline as a start and cubic segments: a round belly, a tall
 * tip leaning right and a small lick on the left. Drawn up the left side and
 * down the right, so clockwise.
 */
const FLAME_START: Pt = [50, 96];
const FLAME_CURVES: readonly (readonly [Pt, Pt, Pt])[] = [
  [[29.6, 96], [17, 81.5], [17, 64.5]],
  [[17, 52], [22.5, 42.5], [29.5, 28]],
  [[32.5, 36.5], [36, 41], [41, 44]],
  [[41.5, 29], [48.5, 15], [60, 4]],
  [[61.5, 19.5], [70, 30], [76.5, 39.5]],
  [[81, 46.5], [83, 54.5], [83, 64.5]],
  [[83, 81.5], [70.4, 96], [50, 96]],
];

/** The flame outline scaled by `k` about its foot, then raised `up`. */
function flame(k: number, up: number): string {
  const at = ([x, y]: Pt): Pt => [FLAME_START[0] + (x - FLAME_START[0]) * k, FLAME_START[1] + (y - FLAME_START[1]) * k - up];
  return `M${pt(at(FLAME_START))}${FLAME_CURVES.map((seg) => `C${seg.map((p) => pt(at(p))).join(' ')}`).join('')}Z`;
}

// ------------------------------------------------------------------ drawings

/** One named part: its outline and the layer it moves with. */
export type ArtPart<P extends string = string> = {
  readonly id: P;
  readonly layer: string;
  readonly d: string;
};

/** A part with its fill chosen for one state on one ground. */
export type DrawnPart = ArtPart & { readonly fill: ArtToken };

/**
 * A drawing: its parts in the order they are painted, the fill of every part
 * in every state, and the parts that make its outline (`silhouette`), which
 * must never be painted in the colour of the ground under them.
 */
export type Drawing<S extends string, P extends string> = {
  readonly parts: readonly ArtPart<P>[];
  readonly fills: Readonly<Record<S, Readonly<Record<P, ArtToken>>>>;
  readonly silhouette: readonly P[];
};

/** The inner flame: the outline at this scale, raised this far. */
const FLAME_INNER = { scale: 0.6, up: 4 } as const;

/** Where each layer of the flame stands, the middle of its foot. Its growth and flicker pivot there. */
export const FLAME_FEET: Readonly<Record<'outer' | 'inner' | 'core', ArtPoint>> = {
  outer: FLAME_START,
  inner: [FLAME_START[0], FLAME_START[1] - FLAME_INNER.up],
  core: [50, 90],
};

const FLAME: Drawing<'lit' | 'unlit', 'outer' | 'inner' | 'core'> = {
  parts: [
    { id: 'outer', layer: 'outer', d: flame(1, 0) },
    { id: 'inner', layer: 'inner', d: flame(FLAME_INNER.scale, FLAME_INNER.up) },
    {
      id: 'core',
      layer: 'core',
      d: 'M50 90C43.5 90 40 85.5 40 80C40 73.5 45 69 50 62C55 69 60 73.5 60 80C60 85.5 56.5 90 50 90Z',
    },
  ],
  fills: {
    lit: { outer: 'colour.coral', inner: 'colour.sun', core: 'paper.card' },
    // The same flame in the two paper greys: waiting to be lit, nothing sad.
    unlit: { outer: 'paper.field', inner: 'paper.line', core: 'paper.field' },
  },
  silhouette: ['outer'],
};

const MEDAL_RIBBON = `${polygon([[31, 52], [45, 60], [39, 96], [32.5, 89], [25, 94]])}${polygon([[55, 60], [69, 52], [75, 94], [67.5, 89], [61, 96]])}`;

const MEDAL: Drawing<'sun' | 'mint' | 'blue' | 'next', 'ribbon' | 'rim' | 'disc' | 'star'> = {
  parts: [
    { id: 'ribbon', layer: 'medal', d: MEDAL_RIBBON },
    { id: 'rim', layer: 'medal', d: circle([50, 40], 33) },
    { id: 'disc', layer: 'medal', d: circle([50, 40], 26) },
    { id: 'star', layer: 'medal', d: star([50, 41], 15, 6.6) },
  ],
  fills: {
    sun: { ribbon: 'colour.blue', rim: 'colour.coral', disc: 'colour.sun', star: 'paper.card' },
    mint: { ribbon: 'colour.coral', rim: 'colour.blue', disc: 'colour.mint', star: 'paper.card' },
    blue: { ribbon: 'colour.coral', rim: 'colour.sun', disc: 'colour.blue', star: 'paper.card' },
    // A badge still ahead: the same medal in the paper greys, an outline to aim at.
    // Its outline is the darker grey, so the ribbon still reads on paper and on a white card.
    next: { ribbon: 'paper.field', rim: 'paper.field', disc: 'paper.card', star: 'paper.line' },
  },
  silhouette: ['ribbon', 'rim'],
};

const CREST: Drawing<'level', 'shield' | 'band' | 'star'> = {
  parts: [
    { id: 'shield', layer: 'crest', d: 'M18 12C30 8 40 6 50 6C60 6 70 8 82 12V46C82 69 68 85 50 94C32 85 18 69 18 46Z' },
    { id: 'band', layer: 'crest', d: polygon([[6, 54], [94, 54], [87, 62.5], [94, 71], [6, 71], [13, 62.5]]) },
    { id: 'star', layer: 'crest', d: star([50, 31], 16, 7) },
  ],
  fills: {
    level: { shield: 'colour.sun', band: 'colour.coral', star: 'paper.card' },
  },
  silhouette: ['shield', 'band'],
};

/** Six arms with a pair of branches each, on a six-sided hub. */
function crystal(): string {
  const c: Pt = [50, 50];
  let d = regular(c, 13, 6);
  for (let k = 0; k < 6; k += 1) {
    const deg = -90 + k * 60;
    d += capsule(c, polar(c, 42, deg), 8);
    const fork = polar(c, 26, deg);
    d += capsule(fork, polar(fork, 13, deg - 45), 7);
    d += capsule(fork, polar(fork, 13, deg + 45), 7);
  }
  return d;
}

const FREEZE: Drawing<'ready' | 'used', 'crystal' | 'centre'> = {
  parts: [
    { id: 'crystal', layer: 'freeze', d: crystal() },
    { id: 'centre', layer: 'freeze', d: regular([50, 50], 5.5, 6) },
  ],
  fills: {
    ready: { crystal: 'colour.blue', centre: 'paper.card' },
    // A freeze already spent this week: the same crystal in the paper grey.
    used: { crystal: 'paper.field', centre: 'paper.card' },
  },
  silhouette: ['crystal'],
};

/**
 * The ring is broken at the top right, about -45 degrees, and a patch is sewn
 * over the break. The ring sits a little down and left of the middle, so the
 * ring and the patch together are centred on the box.
 */
const REPAIR_AT = -45;
const REPAIR_RING: Pt = [46, 54];
const REPAIR_PATCH: Pt = polar(REPAIR_RING, 30, REPAIR_AT);

/** Three stitches across the patch, each running over the mend from the inside of the ring to the outside. */
function stitches(): string {
  let d = '';
  for (const along of [-11, 0, 11]) {
    const mid = polar(REPAIR_PATCH, along, REPAIR_AT + 90);
    d += capsule(polar(mid, -6, REPAIR_AT), polar(mid, 6, REPAIR_AT), 3.6);
  }
  return d;
}

const REPAIR: Drawing<'mended', 'ring' | 'patch' | 'stitches'> = {
  parts: [
    { id: 'ring', layer: 'repair', d: arcBand(REPAIR_RING, 36, 24, REPAIR_AT + 25, REPAIR_AT - 25) },
    { id: 'patch', layer: 'repair', d: roundRect(REPAIR_PATCH, 42, 22, 6, REPAIR_AT + 90) },
    { id: 'stitches', layer: 'repair', d: stitches() },
  ],
  fills: {
    mended: { ring: 'colour.coral', patch: 'colour.sun', stitches: 'paper.ink' },
  },
  silhouette: ['ring', 'patch'],
};

/** Every game drawing, by name. */
export const ART = {
  flame: FLAME,
  medal: MEDAL,
  crest: CREST,
  freeze: FREEZE,
  repair: REPAIR,
} as const;

export type ArtName = keyof typeof ART;

/** The states a drawing is drawn in. */
export type StateOf<N extends ArtName> = Extract<keyof (typeof ART)[N]['fills'], string>;

export type FlameState = StateOf<'flame'>;
export type MedalState = StateOf<'medal'>;
export type FreezeState = StateOf<'freeze'>;

export const ART_NAMES = Object.keys(ART) as ArtName[];

/** The states of one drawing, in the order they are written. */
export function statesOf<N extends ArtName>(name: N): StateOf<N>[] {
  return Object.keys(ART[name].fills) as StateOf<N>[];
}

const cache = new Map<string, readonly DrawnPart[]>();

/** A drawing's parts, in paint order, filled for `state` on `ground`. */
export function drawn<N extends ArtName>(name: N, state: StateOf<N>, ground: ArtGround = 'paper'): readonly DrawnPart[] {
  const key = `${name}|${state}|${ground}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const drawing = ART[name] as Drawing<string, string>;
  const fills = drawing.fills[state];
  if (fills === undefined) throw new Error(`${name} has no state ${state}`);
  const trade = Object.values(fills).includes(GROUND_TOKEN[ground]);
  const parts = drawing.parts.map((part) => {
    const fill = fills[part.id];
    if (fill === undefined) throw new Error(`${name} ${state} gives ${part.id} no fill`);
    return { ...part, fill: onGround(fill, ground, trade) };
  });
  cache.set(key, parts);
  return parts;
}

/** The parts of one layer, in paint order. */
export function layer(parts: readonly DrawnPart[], name: string): readonly DrawnPart[] {
  return parts.filter((part) => part.layer === name);
}

/** A point on the box as the percentages a transform origin is written in. */
export function originOf([x, y]: Pt): string {
  return `${num(x)}% ${num(y)}%`;
}
