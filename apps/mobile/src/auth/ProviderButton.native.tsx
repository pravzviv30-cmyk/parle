import { Platform, Text, View } from 'react-native';
import { AppleAuthenticationButton, AppleAuthenticationButtonStyle, AppleAuthenticationButtonType } from 'expo-apple-authentication';
import { providerType, paper } from '../theme.ts';
import { ProviderButtonBase, type ProviderButtonProps } from './ProviderButtonBase.tsx';
export function ProviderButton(props: ProviderButtonProps) {
  if (props.provider !== 'apple' || Platform.OS !== 'ios') return <ProviderButtonBase {...props} />;
  return <View pointerEvents={props.disabled ? 'none' : 'auto'} accessibilityState={{ disabled: props.disabled, busy: props.busy }} style={{ opacity: props.disabled ? 0.6 : 1 }}>
    <AppleAuthenticationButton buttonType={AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthenticationButtonStyle.BLACK} cornerRadius={12}
      onPress={props.onPress} style={{ width: '100%', height: 56 }} />
    {props.busy && <Text accessibilityLiveRegion="polite" style={{ ...providerType, color: paper.ink, textAlign: 'center', marginTop: 8 }}>Waiting for Apple…</Text>}
  </View>;
}
