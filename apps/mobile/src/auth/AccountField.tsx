import { forwardRef, useEffect, useId, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { AlertGlyph } from '../components.tsx';
import { HIT, font, paper, radius, space, type } from '../theme.ts';

/** Auth fields expose native focus without changing the behaviour of unrelated forms. */
export const AccountField = forwardRef<TextInput, TextInputProps & {
  label: string;
  secure?: boolean;
  error?: string | null;
}>(({ label, secure = false, error, onFocus, onBlur, style, ...props }, ref) => {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (error && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(error);
  }, [error]);
  return <View style={st.group}>
    <Text id={`${id}-label`} style={[type.small, st.label]}>{label}</Text>
    <View style={st.inputWrap}>
      <TextInput
        {...props}
        ref={ref}
        aria-label={error ? `${label}, ${error}` : label}
        aria-labelledby={`${id}-label`}
        {...(Platform.OS === 'web' && error ? { 'aria-describedby': `${id}-error`, 'aria-invalid': true } : {})}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={paper.inkFaint}
        secureTextEntry={secure && !revealed}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        style={[st.input, focused && st.focused, secure && st.secure, style]}
      />
      {secure && <Pressable accessibilityRole="button" accessibilityLabel={revealed ? 'Hide password' : 'Show password'} onPress={() => setRevealed((current) => !current)} style={st.show}>
        <Text style={[type.small, { color: paper.inkSoft }]}>{revealed ? 'Hide' : 'Show'}</Text>
      </Pressable>}
    </View>
    {error != null && error !== '' && <View style={st.error}>
      <AlertGlyph size={16} color={paper.ink} />
      <Text id={`${id}-error`} accessibilityLiveRegion="polite" {...(Platform.OS === 'web' ? { role: 'alert' as const } : {})} style={[type.small, { flex: 1, color: paper.ink }]}>{error}</Text>
    </View>}
  </View>;
});
AccountField.displayName = 'AccountField';

const st = StyleSheet.create({
  group: { gap: space(1) },
  label: { color: paper.ink, fontFamily: font.semiBold },
  inputWrap: { justifyContent: 'center' },
  input: { ...type.body, minHeight: 48, paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.field, backgroundColor: paper.card, borderWidth: 1, borderColor: paper.field, color: paper.ink },
  focused: { borderColor: paper.ink },
  secure: { paddingRight: 64 },
  show: { position: 'absolute', right: 0, top: 0, bottom: 0, minWidth: HIT, minHeight: HIT, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  error: { flexDirection: 'row', gap: space(2), alignItems: 'center' },
});
