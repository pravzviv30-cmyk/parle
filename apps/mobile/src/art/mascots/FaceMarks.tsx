import { Ellipse, G, Path } from 'react-native-svg';
import { paper } from '../../palette.ts';
import type { MascotFace } from './mascotFaces.ts';

/** Draws one face's eyes and mouth in ink. Shared by Cloud and Toast. */
export function FaceMarks({ face }: { face: MascotFace }) {
  const stroke = { stroke: paper.ink, strokeWidth: face.strokeWidth, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <G>
      {face.eyes.map((eye, i) =>
        eye.kind === 'open' ? (
          <Ellipse key={i} cx={eye.cx} cy={eye.cy} rx={eye.rx} ry={eye.ry} fill={paper.ink} />
        ) : (
          <Path key={i} d={eye.d} {...stroke} />
        ),
      )}
      {face.mouth.kind === 'o' ? (
        <Ellipse cx={face.mouth.cx} cy={face.mouth.cy} rx={face.mouth.rx} ry={face.mouth.ry} fill={paper.ink} />
      ) : (
        <Path d={face.mouth.d} {...stroke} />
      )}
    </G>
  );
}
