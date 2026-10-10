import { useAssets } from 'expo-asset';
import { SvgUri } from 'react-native-svg';
import { View } from 'react-native';
import { decorative } from '../theme.ts';

const welcomeOrb = require('../../assets/brand/welcome-orb.svg');

/** The original Figma vector ships as a local asset at its exported size. */
export function WelcomeOrb() {
  const [assets] = useAssets(welcomeOrb);
  const asset = assets?.[0];
  return <View {...decorative} style={{ width: 104, height: 104 }}>
    {asset && <SvgUri {...decorative} uri={asset.localUri ?? asset.uri} />}
  </View>;
}
