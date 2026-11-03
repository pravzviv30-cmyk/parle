import Svg, { Ellipse, Path } from 'react-native-svg';
import { paper } from '../../palette.ts';
import { decorative } from '../../theme.ts';
import { cloudFace, faceLids, type MascotExpression, type ViewBox } from './mascotFaces.ts';
import { CLOUD_SILHOUETTE, CLOUD_UNDERSIDE } from './mascotPaths.ts';
import { CLOUD_POSES, cloudLayers, type CloudPose } from './mascotPoses.ts';
import { FaceMarks } from './FaceMarks.tsx';

/** Outline width in points, whatever size the cloud is drawn at. */
const OUTLINE_PT = 2.5;

/**
 * The cloud mascot (UI-014), from cloud-cheer.svg without the cheer pose's limbs.
 * Static: only the face changes with `expression`; motion lives in wrappers.
 * `pose` adds limbs and marks (mascotPoses.ts), in that pose's own box, with
 * the pose's face; `size` is then the width of that box. Limbs draw in `ink`.
 * `outline` adds a 2.5pt ink edge so the white cloud reads as a control on cream.
 */
export function Cloud({ expression = 'idle', size, outline = false, pose, ink = paper.ink }: { expression?: MascotExpression; size: number; outline?: boolean; pose?: CloudPose; ink?: string }) {
  const { viewBox: vb, layers } = cloudLayers(pose, ink);
  const height = (size * vb.height) / vb.width;
  // Stroked under the fills at twice the width, so only the outer half shows.
  const edge = (OUTLINE_PT * 2 * vb.width) / size;
  return (
    <Svg width={size} height={height} viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`} pointerEvents="none" {...decorative}>
      {outline ? (
        <>
          <Path d={CLOUD_UNDERSIDE} fill={paper.ink} stroke={paper.ink} strokeWidth={edge} strokeLinejoin="round" />
          <Path d={CLOUD_SILHOUETTE} fill={paper.ink} stroke={paper.ink} strokeWidth={edge} strokeLinejoin="round" />
        </>
      ) : null}
      {layers.map((l, i) =>
        l.kind === 'face' ? (
          <FaceMarks key={i} face={pose ? l.face : cloudFace(expression)} />
        ) : l.kind === 'ellipse' ? (
          <Ellipse key={i} cx={l.cx} cy={l.cy} rx={l.rx} ry={l.ry} fill={l.fill} opacity={l.opacity} />
        ) : (
          <Path key={i} d={l.d} fill={l.fill ?? 'none'} stroke={l.stroke} strokeWidth={l.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        ),
      )}
    </Svg>
  );
}

/** The blink's lids for `pose`'s face, in the same box as `<Cloud pose size>`. Static; Blink fades it. */
export function CloudLids({ pose, size }: { pose: CloudPose; size: number }) {
  const vb: ViewBox = CLOUD_POSES[pose].viewBox;
  const face = cloudFace(CLOUD_POSES[pose].face);
  const lids = faceLids(face);
  return (
    <Svg width={size} height={(size * vb.height) / vb.width} viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`} pointerEvents="none" {...decorative}>
      {lids.covers.map((c, i) => <Ellipse key={`c${i}`} cx={c.cx} cy={c.cy} rx={c.rx} ry={c.ry} fill={c.fill} />)}
      {lids.closed.map((d, i) => <Path key={`l${i}`} d={d} stroke={paper.ink} strokeWidth={face.strokeWidth} strokeLinecap="round" fill="none" />)}
    </Svg>
  );
}
