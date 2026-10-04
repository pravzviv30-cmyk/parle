import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colour, decorative, paper } from '../theme.ts';
/** Small native vector spots, deliberately brighter than form-field chrome. */
export function ChoiceArt({
  kind,
}: {
  kind: 'drink' | 'food' | 'family' | 'trip' | 'moving' | 'work' | 'time' | 'days' | 'ability';
}) {
  const color =
    kind === 'family' || kind === 'time'
      ? colour.coral
      : kind === 'trip' || kind === 'work'
        ? colour.blue
        : colour.mint;
  return (
    <Svg width={40} height={40} viewBox="0 0 40 40" {...decorative}>
      <Rect
        x={0}
        y={0}
        width={40}
        height={40}
        rx={12}
        fill={kind === 'drink' || kind === 'days' ? colour.sun : color}
      />
      {kind === 'drink' || kind === 'food' ? (
        <>
          <Path
            d="M10 14h16v10a7 7 0 0 1-14 0V14 M26 15h3a4 4 0 0 1 0 8h-3 M9 31h21"
            stroke={paper.ink}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
          <Path d="M16 10V7m6 3V7" stroke={paper.ink} strokeWidth={2} strokeLinecap="round" />
        </>
      ) : kind === 'family' ? (
        <Path d="M20 30L10 21C1 12 14 6 20 14C26 6 39 12 30 21Z" fill={paper.card} />
      ) : kind === 'moving' ? (
        <>
          <Path d="M8 19L20 9L32 19V31H8Z" fill={paper.ink} />
          <Rect x={17} y={23} width={6} height={8} fill={paper.card} />
        </>
      ) : kind === 'work' ? (
        <>
          <Rect x={8} y={15} width={24} height={17} rx={3} fill={paper.card} />
          <Path d="M15 15V10H25V15M8 21H32" stroke={paper.card} strokeWidth={2} fill="none" />
        </>
      ) : kind === 'trip' ? (
        <>
          <Path d="M9 10L31 20L21 23L17 32Z" fill={paper.card} />
          <Path d="M15 17L25 21" stroke={color} strokeWidth={2} />
        </>
      ) : kind === 'time' ? (
        <>
          <Circle cx={20} cy={20} r={12} fill={paper.card} />
          <Path
            d="M20 12V20L26 24"
            stroke={paper.ink}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : kind === 'days' ? (
        <>
          <Rect x={9} y={10} width={22} height={22} rx={3} fill={paper.card} />
          <Path
            d="M9 17H31M15 8V13M25 8V13M14 24L18 28L26 21"
            stroke={paper.ink}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <Path d="M10 10H30V26H22L16 32V26H10Z" fill={paper.ink} />
          <Circle cx={15} cy={18} r={2} fill={paper.card} />
          <Circle cx={21} cy={18} r={2} fill={paper.card} />
          <Circle cx={27} cy={18} r={2} fill={paper.card} />
        </>
      )}
    </Svg>
  );
}
