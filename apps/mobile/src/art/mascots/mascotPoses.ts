/**
 * Cloud's posed bodies (brief 1, the cast): limbs and marks for `listen` (a
 * hand cupped to the ear by the sound arcs) and `cheer` (both arms up, two
 * stars), `hold` (a yellow book held to the chest) and `rest` (asleep,
 * "z z"). Pure geometry in the body's own space, the same as CLOUD_SILHOUETTE.
 * `cloudLayers` is the ordered draw list Cloud.tsx renders.
 */
import { colour, mascot, paper } from '../../palette.ts';
import { CLOUD_VIEWBOX, cloudFace, type MascotExpression, type MascotFace, type ViewBox } from './mascotFaces.ts';
import { CLOUD_CHEEKS, CLOUD_SILHOUETTE, CLOUD_UNDERSIDE } from './mascotPaths.ts';

export type CloudPose = 'listen' | 'cheer' | 'hold' | 'rest';

/** The limb stroke of assets/b-art/svg/cloud-cheer.svg. */
export const LIMB_WIDTH = 3.88;

/** A stroke with a `tone` takes the caller's ink or accent (accent falls back to brand blue); otherwise colours draw as written. */
export type PoseMark = { d: string; fill?: string; stroke?: string; strokeWidth?: number; tone?: 'ink' | 'accent' };
type Shadow = { cx: number; cy: number; rx: number; ry: number };

export const CLOUD_POSES: Record<CloudPose, { viewBox: ViewBox; rear: string[]; front: string[]; marks: PoseMark[]; shadow: Shadow; face: MascotExpression }> = {
  listen: {
    viewBox: { x: -34, y: -30, width: 310, height: 266 },
    shadow: { cx: 120, cy: 212, rx: 90, ry: 7 },
    rear: ['M94 170V206L110 205M144 166V203L160 202M32.24 130.34C20 146 16 160 19 172L34 166'],
    front: ['M198 112C224 110 238 92 234 66M234 66L226 57M234 66L238 53M234 66L247 61'],
    marks: [{ d: 'M254 50Q262 62 254 74M264 40Q278 62 264 84', stroke: colour.blue, strokeWidth: 3.4, tone: 'accent' }],
    face: 'listening',
  },
  cheer: {
    viewBox: { x: -34, y: -34, width: 304, height: 270 },
    shadow: { cx: 118, cy: 226, rx: 78, ry: 6 },
    rear: ['M92 170V200L78 210M146 166C150 184 158 194 172 192M36 100C12 82 4 56 12 30M12 30L2 22M12 30L10 16M12 30L24 22M196 88C220 68 230 46 224 22M224 22L216 12M224 22L228 8M224 22L238 16'],
    front: [],
    marks: [
      { d: 'M-22 -24L-19.6 -18L-13 -15L-19.6 -12.6L-22 -6L-24.4 -12.6L-31 -15L-24.4 -17.4Z', fill: colour.sun },
      { d: 'M250 -30L253.2 -22L262 -18L253.2 -14.8L250 -6L246.8 -14.8L238 -18L246.8 -21.2Z', fill: colour.sun },
    ],
    face: 'cheer',
  },
  hold: {
    viewBox: { x: -34, y: -30, width: 304, height: 266 },
    shadow: { cx: 116, cy: 212, rx: 92, ry: 7 },
    rear: ['M94 170V206L110 205M144 166V203L160 202'],
    front: ['M30 128C40 146 52 154 70 152M200 126C188 144 174 154 152 152'],
    marks: [
      // The board's rect x66 y122 88x64 rx9, as a path.
      { d: 'M75 122H145C149.97 122 154 126.03 154 131V177C154 181.97 149.97 186 145 186H75C70.03 186 66 181.97 66 177V131C66 126.03 70.03 122 75 122Z', fill: colour.sun, stroke: paper.ink, strokeWidth: 3.4, tone: 'ink' },
      { d: 'M82 144H138M82 162H122', stroke: paper.card, strokeWidth: 6 },
    ],
    face: 'idle',
  },
  rest: {
    viewBox: { x: -34, y: -36, width: 300, height: 240 },
    shadow: { cx: 112, cy: 196, rx: 104, ry: 7 },
    rear: ['M86 176L80 191L96 192M140 172L138 189L154 189'],
    front: [],
    marks: [{ d: 'M204 4H220L204 20H220M232 -26H244L232 -14H244', stroke: paper.ink, strokeWidth: 3.4, tone: 'ink' }],
    face: 'paused',
  },
};

/** The shadow's ink opacity. */
export const SHADOW_OPACITY = 0.2;

const toned = ({ tone, ...m }: PoseMark, ink: string, accent?: string): CloudLayer =>
  ({ kind: 'path', ...m, ...(tone === 'ink' ? { stroke: ink } : tone === 'accent' ? { stroke: accent ?? colour.blue } : {}) });

export type CloudLayer =
  | { kind: 'path'; d: string; fill?: string; stroke?: string; strokeWidth?: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string; opacity?: number }
  | { kind: 'face'; face: MascotFace };

export function cloudLayers(pose?: CloudPose, { ink = paper.ink, accent, expression = 'idle' }: { ink?: string; accent?: string; expression?: MascotExpression } = {}): { viewBox: ViewBox; layers: CloudLayer[] } {
  const body: CloudLayer[] = [
    { kind: 'path', d: CLOUD_UNDERSIDE, fill: mascot.cloudUnderside },
    { kind: 'path', d: CLOUD_SILHOUETTE, fill: paper.card },
    ...CLOUD_CHEEKS.map((c) => ({ kind: 'ellipse' as const, cx: c.cx, cy: c.cy, rx: c.rx, ry: c.ry, fill: mascot.cheek })),
  ];
  if (!pose) return { viewBox: CLOUD_VIEWBOX, layers: [...body, { kind: 'face', face: cloudFace(expression) }] };
  const p = CLOUD_POSES[pose];
  const limb = (d: string): CloudLayer => ({ kind: 'path', d, stroke: ink, strokeWidth: LIMB_WIDTH });
  return {
    viewBox: p.viewBox,
    layers: [
      { kind: 'ellipse', ...p.shadow, fill: paper.ink, opacity: SHADOW_OPACITY },
      ...p.rear.map(limb),
      ...body,
      // Marks under the front limbs: hold's arms wrap its book.
      ...p.marks.map((m) => toned(m, ink, accent)),
      ...p.front.map(limb),
      { kind: 'face', face: cloudFace(p.face) },
    ],
  };
}
