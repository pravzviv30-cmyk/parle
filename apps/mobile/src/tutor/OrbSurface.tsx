/** Native cloud surface inspired by Orb UI's cloud theme (MIT).
 * Four soft SVG cloud fields use the renderer already shipped with the app.
 * Transform and opacity animate on the native driver; no extra audio session,
 * canvas, per-frame React update or downloaded image is needed.
 */
import { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, FeGaussianBlur, Filter, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { cloudOrb } from '../palette.ts';
import { decorative, paper } from '../theme.ts';

export const CLOUD_FIELDS = [
  'M-12 66 C7 39 25 46 44 57 C61 69 70 41 89 48 C106 53 130 39 134 68 L136 134 L-14 134Z',
  'M-15 90 C11 68 23 74 44 78 C65 85 73 63 95 74 C111 81 132 68 137 94 L138 135 L-15 135Z',
  'M13 13 C30 2 53 12 51 35 C47 53 33 56 29 79 C17 68 8 51 13 13Z',
  'M68 3 C87 13 74 29 85 44 C94 57 113 48 121 68 C99 73 83 62 70 50 C54 35 61 14 68 3Z',
] as const;

export function OrbSurface({ color, size }: { color: string; size: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ref = (key: string) => `url(#${id}${key})`;
  return <Svg width={size} height={size} viewBox="0 0 120 120" {...decorative}>
    <Defs>
      <ClipPath id={`${id}clip`}><Circle cx="60" cy="60" r="58" /></ClipPath>
      <LinearGradient id={`${id}base`} x1="28%" y1="0%" x2="65%" y2="100%">
        <Stop offset="0" stopColor={cloudOrb.deep} /><Stop offset="0.38" stopColor={cloudOrb.upper} /><Stop offset="1" stopColor={cloudOrb.lower} />
      </LinearGradient>
      <LinearGradient id={`${id}mist`} x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0" stopColor={cloudOrb.milk} stopOpacity="0.66" /><Stop offset="0.6" stopColor={cloudOrb.lower} stopOpacity="0.75" /><Stop offset="1" stopColor={cloudOrb.lower} />
      </LinearGradient>
      <RadialGradient id={`${id}haze`} cx="50%" cy="50%" r="55%">
        <Stop offset="0" stopColor={cloudOrb.milk} stopOpacity="0.78" /><Stop offset="1" stopColor={cloudOrb.milk} stopOpacity="0" />
      </RadialGradient>
      <Filter id={`${id}blur`} x="-30%" y="-30%" width="160%" height="160%"><FeGaussianBlur stdDeviation="4.5" /></Filter>
    </Defs>
    <Circle cx="60" cy="60" r="58" fill={ref('base')} />
    <G clipPath={ref('clip')}>
      <G filter={ref('blur')}>
        <Path d={CLOUD_FIELDS[0]} fill={ref('mist')} />
        <Path d={CLOUD_FIELDS[1]} fill={cloudOrb.lower} opacity="0.65" />
        <Path d={CLOUD_FIELDS[2]} fill={cloudOrb.deep} opacity="0.28" />
        <Path d={CLOUD_FIELDS[3]} fill={cloudOrb.milk} opacity="0.12" />
        <Circle cx="34" cy="65" r="31" fill={ref('haze')} opacity="0.6" />
      </G>
    </G>
    <Circle cx="60" cy="60" r="58" fill="none" stroke={paper.card} strokeOpacity="0.3" strokeWidth="0.65" />
    <Circle cx="60" cy="60" r="59" fill="none" stroke={color} strokeOpacity="0.1" strokeWidth="0.6" />
  </Svg>;
}
