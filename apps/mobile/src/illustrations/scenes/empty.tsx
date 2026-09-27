/** Static empty-state marks. Their words carry every piece of information. */
import { Path, Circle } from 'react-native-svg';
import { paper } from '../../theme.ts';
import { Frame, Stipple, type SceneProps } from '../pen.tsx';

/** A cafe noticeboard with one pin and one blank card. */
export function NobodyYet({ width = 200 }: SceneProps) {
  return (
    <Frame width={width}>
      <Path d="M34 26h132v98H34z" transform="rotate(-1 100 75)" />
      <Path d="M28 20h144v10H28z" transform="rotate(-1 100 25)" />
      <Path d="M50 48h34v26H50z" transform="rotate(3 67 61)" />
      <Path d="M56 56h22M56 64h16" transform="rotate(3 67 61)" />
      <Path d="M120 92h34v22h-34z" transform="rotate(-4 137 103)" />
      <Path d="M126 100h22" transform="rotate(-4 137 103)" />
      <Stipple points={[[44, 130], [52, 134], [148, 128], [156, 132]]} />
      <Path d="M104 42h36v30h-36z" transform="rotate(4 122 57)" />
      <Circle cx={122} cy={44} r={2.8} fill={paper.ink} stroke="none" />
    </Frame>
  );
}

