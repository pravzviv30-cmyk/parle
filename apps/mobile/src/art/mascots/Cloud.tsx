import Svg, { Ellipse, Path } from 'react-native-svg';
import { mascot, paper } from '../../palette.ts';
import { decorative } from '../../theme.ts';
import { CLOUD_VIEWBOX, cloudFace, type MascotExpression } from './mascotFaces.ts';
import { CLOUD_CHEEKS, CLOUD_SILHOUETTE, CLOUD_UNDERSIDE } from './mascotPaths.ts';
import { FaceMarks } from './FaceMarks.tsx';

/** Outline width in points, whatever size the cloud is drawn at. */
const OUTLINE_PT = 2.5;

/**
 * The cloud mascot (UI-014), from cloud-cheer.svg without the cheer pose's limbs.
 * Static: only the face changes with `expression`; motion lives in wrappers.
 * `outline` adds a 2.5pt ink edge so the white cloud reads as a control on cream.
 */
export function Cloud({ expression = 'idle', size, outline = false }: { expression?: MascotExpression; size: number; outline?: boolean }) {
  const vb = CLOUD_VIEWBOX;
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
      <Path d={CLOUD_UNDERSIDE} fill={mascot.cloudUnderside} />
      <Path d={CLOUD_SILHOUETTE} fill={paper.card} />
      {CLOUD_CHEEKS.map((c, i) => (
        <Ellipse key={i} cx={c.cx} cy={c.cy} rx={c.rx} ry={c.ry} fill={mascot.cheek} />
      ))}
      <FaceMarks face={cloudFace(expression)} />
    </Svg>
  );
}
