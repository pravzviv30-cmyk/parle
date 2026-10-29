import { Pressable, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { AppleMark, Press } from '../components.tsx';
import { decorative, providerType } from '../theme.ts';
import { providerBrand } from '../palette.ts';
import { GOOGLE } from '../art/flat/googleProvider.ts';
import { c } from '../onboarding/boldRhythm.ts';
/** Official Google artwork, downloaded from gstatic's Firebase UI distribution. */

export type ProviderButtonProps = { provider: 'apple' | 'google'; onPress: () => void; disabled?: boolean; busy?: boolean };
export function ProviderButtonBase({ provider, onPress, disabled = false, busy = false }: ProviderButtonProps) {
  const apple = provider === 'apple';
  return <View style={{ gap: 8 }}><Press haptic="light" accessibilityRole="button" accessibilityLabel={`Sign in with ${apple ? 'Apple' : 'Google'}`}
    accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress}
    style={{ minHeight: 52, borderRadius: 26, borderWidth: apple ? 0 : 1, borderColor: c.field,
      backgroundColor: apple ? providerBrand.black : providerBrand.white, opacity: disabled ? 0.6 : 1,
      paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
    <View {...decorative}>{apple ? <AppleMark color={providerBrand.white} size={20} /> : <SvgXml {...decorative} xml={GOOGLE} width={20} height={20} />}</View>
    <Text style={{ ...providerType, color: apple ? providerBrand.white : providerBrand.googleInk, flexShrink: 1, textAlign: 'center' }}>Sign in with {apple ? 'Apple' : 'Google'}</Text>
  </Press>{busy && <Text accessibilityLiveRegion="polite" style={{ ...providerType, color: c.ink, textAlign: 'center' }}>Connecting to {apple ? 'Apple' : 'Google'}…</Text>}</View>;
}
