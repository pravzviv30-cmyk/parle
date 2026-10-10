import { useAssets } from 'expo-asset';
import { SvgUri } from 'react-native-svg';
import { View } from 'react-native';
import { decorative } from '../theme.ts';

const welcomeOrb = require('../../assets/brand/welcome-orb.svg');

/** The original Figma vector ships as a local asset at its exported size. */
export function WelcomeOrb({ size = 104 }: { size?: number }) {
  const [assets] = useAssets(welcomeOrb);
  const asset = assets?.[0];
  return <View {...decorative} style={{ width: size, height: size }}>
    <View style={{ width: 104, height: 104, position: 'absolute', top: (size - 104) / 2, left: (size - 104) / 2, transform: [{ scale: size / 104 }] }}>
    {asset && <SvgUri {...decorative} uri={asset.localUri ?? asset.uri} />}
    </View>
  </View>;
}
