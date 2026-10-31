/**
 * The mascots' faces (UI-014, docs/changes/live-room-d.md). Pure geometry: for
 * each live-room state, the eyes and the mouth of the cloud and of the toast,
 * in each drawing's own viewBox. The bodies never change; only these do.
 *
 * `idle` is the source drawing's own face, copied from
 * assets/b-art/svg/cloud-cheer.svg and friends-cheer.svg. Every other face is
 * built from the same eye centres and mouth so the hand stays the same.
 */

export type MascotExpression = 'paused' | 'listening' | 'tutor' | 'thinking' | 'cheer' | 'idle';

export const MASCOT_EXPRESSIONS: readonly MascotExpression[] = ['paused', 'listening', 'tutor', 'thinking', 'cheer', 'idle'];

/** An open ink eye, or a closed one drawn as a stroked curve. */
export type Eye =
  | { kind: 'open'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'closed'; d: string };

/** A stroked mouth, or a small filled "o". */
export type Mouth =
  | { kind: 'stroke'; d: string }
  | { kind: 'o'; cx: number; cy: number; rx: number; ry: number };

export type MascotFace = { eyes: readonly [Eye, Eye]; mouth: Mouth; strokeWidth: number };

export type ViewBox = { x: number; y: number; width: number; height: number };

type Source = {
  eyes: readonly [{ cx: number; cy: number }, { cx: number; cy: number }];
  rx: number;
  ry: number;
  /** The mouth's two corners' y and x span, from the source smile. */
  mouth: { left: number; right: number; y: number; depth: number };
  idleMouth: string;
  strokeWidth: number;
};

/** Cloud: viewBox of the body without the cheer pose's limbs. */
export const CLOUD_VIEWBOX: ViewBox = { x: -12, y: -14, width: 256, height: 218 };
/** Toast: viewBox of the orange companion's body without its limbs. */
export const TOAST_VIEWBOX: ViewBox = { x: 4, y: -10, width: 112, height: 132 };

const CLOUD: Source = {
  eyes: [{ cx: 89.3601, cy: 90.3563 }, { cx: 124.774, cy: 90.3563 }],
  rx: 3.1988,
  ry: 5.712,
  mouth: { left: 99.6417, right: 120.205, y: 102.923, depth: 9.1385 },
  idleMouth: 'M99.6417 102.923C105.735 115.108 112.589 115.108 120.205 102.923',
  strokeWidth: 3.4272,
};

const TOAST: Source = {
  eyes: [{ cx: 53.0715, cy: 51.813 }, { cx: 73.6635, cy: 51.813 }],
  rx: 2.808,
  ry: 4.68,
  mouth: { left: 55.8795, right: 78.3435, y: 64.917, depth: 9.828 },
  idleMouth: 'M55.8795 64.917C63.3675 78.021 70.8555 78.021 78.3435 64.917',
  strokeWidth: 2.808,
};

const n = (v: number) => Math.round(v * 10000) / 10000;

/** A curve from (x1, y) to (x2, y) whose middle sits `bow` lower (negative bows up). */
const curve = (x1: number, x2: number, y: number, bow: number) =>
  `M${n(x1)} ${n(y)}Q${n((x1 + x2) / 2)} ${n(y + bow * 2)} ${n(x2)} ${n(y)}`;

function face(src: Source, expression: MascotExpression): MascotFace {
  const { rx, ry, strokeWidth } = src;
  const m = src.mouth;
  const mid = (m.left + m.right) / 2;
  const half = (m.right - m.left) / 2;
  const open = (lift: number, grow: number) =>
    src.eyes.map(({ cx, cy }) => ({ kind: 'open' as const, cx, cy: n(cy - ry * lift), rx: n(rx * grow), ry: n(ry * grow) })) as unknown as [Eye, Eye];
  const closed = (bow: number) =>
    src.eyes.map(({ cx, cy }) => ({ kind: 'closed' as const, d: curve(cx - rx * 1.6, cx + rx * 1.6, cy, bow) })) as unknown as [Eye, Eye];

  switch (expression) {
    case 'idle':
      return { eyes: open(0, 1), mouth: { kind: 'stroke', d: src.idleMouth }, strokeWidth };
    case 'paused':
      // Asleep: eyelids as small downward arcs, a flat short mouth.
      return { eyes: closed(ry * 0.45), mouth: { kind: 'stroke', d: `M${n(mid - half * 0.45)} ${n(m.y + 2)}L${n(mid + half * 0.45)} ${n(m.y + 2)}` }, strokeWidth };
    case 'listening':
      // Attentive: wider eyes, raised, a small open "o".
      return { eyes: open(0.35, 1.18), mouth: { kind: 'o', cx: n(mid), cy: n(m.y + m.depth * 0.45), rx: n(half * 0.28), ry: n(m.depth * 0.42) }, strokeWidth };
    case 'tutor':
      // Looking up to the tutor, mouth closed and gentle.
      return { eyes: open(0.6, 1), mouth: { kind: 'stroke', d: curve(mid - half * 0.4, mid + half * 0.4, m.y + 1, m.depth * 0.12) }, strokeWidth };
    case 'thinking':
      // Eyes up, a small smile.
      return { eyes: open(0.6, 1), mouth: { kind: 'stroke', d: curve(mid - half * 0.55, mid + half * 0.55, m.y, m.depth * 0.4) }, strokeWidth };
    case 'cheer':
      // Happy closed arcs "^ ^", a big smile.
      return { eyes: closed(-ry * 0.5), mouth: { kind: 'stroke', d: curve(m.left - half * 0.2, m.right + half * 0.2, m.y - 1, m.depth * 1.6) }, strokeWidth };
  }
}

export const cloudFace = (expression: MascotExpression = 'idle'): MascotFace => face(CLOUD, expression);
export const toastFace = (expression: MascotExpression = 'idle'): MascotFace => face(TOAST, expression);
