import Svg, { Path } from 'react-native-svg';
import { mascot } from '../../palette.ts';
import { decorative } from '../../theme.ts';
import { TOAST_VIEWBOX, toastFace, type MascotExpression } from './mascotFaces.ts';
import { TOAST_CRUST, TOAST_FACE } from './mascotPaths.ts';
import { FaceMarks } from './FaceMarks.tsx';

/**
 * The toast mascot (UI-014), the orange companion from friends-cheer.svg
 * without its limbs. Static: only the face changes with `expression`.
 */
export function Toast({ expression = 'idle', size }: { expression?: MascotExpression; size: number }) {
  const vb = TOAST_VIEWBOX;
  return (
    <Svg width={size} height={(size * vb.height) / vb.width} viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`} pointerEvents="none" {...decorative}>
      <Path d={TOAST_CRUST} fill={mascot.toastCrust} />
      <Path d={TOAST_FACE} fill={mascot.toastFace} />
      <FaceMarks face={toastFace(expression)} />
    </Svg>
  );
}
