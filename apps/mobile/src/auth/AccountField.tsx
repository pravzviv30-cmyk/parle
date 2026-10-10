import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View, type TextInputProps } from 'react-native';
import { AlertGlyph } from '../components.tsx';
import { HIT, font, paper, radius, space, type } from '../theme.ts';

/** Auth fields expose native focus without changing the behaviour of unrelated forms. */
export const AccountField = forwardRef<TextInput, TextInputProps & {
  label: string;
  secure?: boolean;
  error?: string | null;
  labelWeight?: 'medium' | 'semiBold';
}>(({ label, secure = false, error, labelWeight = 'semiBold', onFocus, onBlur, onSelectionChange, style, ...props }, ref) => {
  const id = useId();
  const { fontScale } = useWindowDimensions();
  // Fabric can reuse text measurements after a live reading-size change when
  // no text prop changed. Vary a real typography prop to refresh that revision
  // while keeping the native input mounted. This stays above the current OS
  // scale (also valid for smaller-than-default sizes), so it never caps it.
  const liveFontMultiplier = fontScale + 1;
  const inputRef = useRef<TextInput | null>(null);
  const selection = useRef<{ start: number; end: number } | null>(null);
  const restore = useRef<{ focused: boolean; selection: { start: number; end: number } | null } | null>(null);
  const [focused, setFocused] = useState(false);
  const [toggleFocused, setToggleFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [toggleWidth, setToggleWidth] = useState(64);
  const disabled = props.editable === false || props.readOnly === true;
  const setInputRef = useCallback((input: TextInput | null) => {
    inputRef.current = input;
    if (typeof ref === 'function') ref(input);
    else if (ref) ref.current = input;
  }, [ref]);
  useEffect(() => {
    if (error && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(error);
  }, [error]);
  useLayoutEffect(() => {
    const saved = restore.current;
    const input = inputRef.current;
    restore.current = null;
    if (!saved || !input || disabled) return;
    // secureTextEntry changes the existing input. Never remount or clear its
    // value, and restore selection after the native/DOM property has changed.
    if (saved.focused && !input.isFocused()) input.focus();
    if (saved.selection) {
      const { start, end } = saved.selection;
      if (Platform.OS === 'web') {
        (input as unknown as HTMLInputElement).setSelectionRange(start, end);
      } else {
        input.setSelection(start, end);
      }
      selection.current = saved.selection;
    }
  }, [revealed, disabled]);
  const toggleVisibility = () => {
    if (disabled) return;
    const input = inputRef.current;
    let currentSelection = selection.current;
    if (Platform.OS === 'web' && input) {
      const node = input as unknown as HTMLInputElement;
      if (node.selectionStart !== null && node.selectionEnd !== null) {
        currentSelection = { start: node.selectionStart, end: node.selectionEnd };
      }
    }
    restore.current = { focused: input?.isFocused() === true, selection: currentSelection };
    setRevealed((current) => !current);
  };
  return <View style={st.group}>
    <Text id={`${id}-label`} maxFontSizeMultiplier={liveFontMultiplier} style={[type.small, st.label, labelWeight === 'medium' && { fontFamily: font.medium }]}>{label}</Text>
    <View style={[st.inputWrap, focused && st.focused, disabled && st.disabled]}>
      <TextInput
        {...props}
        ref={setInputRef}
        maxFontSizeMultiplier={props.maxFontSizeMultiplier ?? liveFontMultiplier}
        aria-label={error ? `${label}, ${error}` : label}
        aria-labelledby={`${id}-label`}
        {...(Platform.OS === 'web' && error ? { 'aria-describedby': `${id}-error`, 'aria-invalid': true } : {})}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={paper.inkFaint}
        underlineColorAndroid="transparent"
        smartInsertDelete={secure ? false : props.smartInsertDelete}
        secureTextEntry={secure && !revealed}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        onSelectionChange={(event) => {
          selection.current = event.nativeEvent.selection;
          onSelectionChange?.(event);
        }}
        style={[st.input, secure && { paddingRight: toggleWidth + 12 }, style]}
      />
      {secure && <Pressable
        accessibilityRole="button"
        accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
        accessibilityState={{ disabled }}
        disabled={disabled}
        {...(Platform.OS === 'web' ? {
          // Pointer activation keeps the caret/keyboard in the input; Tab and
          // keyboard activation still reach the control normally.
          onPointerDown: (event: { preventDefault: () => void }) => event.preventDefault(),
        } : {})}
        onFocus={() => setToggleFocused(true)}
        onBlur={() => setToggleFocused(false)}
        onPress={toggleVisibility}
        onLayout={(event) => setToggleWidth(event.nativeEvent.layout.width)}
        style={({ pressed }) => [st.show, (pressed || toggleFocused) && st.showActive]}
      >
        <Text maxFontSizeMultiplier={liveFontMultiplier} style={[type.small, st.showLabel, labelWeight === 'medium' && { fontFamily: font.medium }]}>{revealed ? 'Hide' : 'Show'}</Text>
      </Pressable>}
    </View>
    {error != null && error !== '' && <View style={st.error}>
      <AlertGlyph size={16} color={paper.ink} />
      <Text id={`${id}-error`} maxFontSizeMultiplier={liveFontMultiplier} accessibilityLiveRegion="polite" {...(Platform.OS === 'web' ? { role: 'alert' as const } : {})} style={[type.small, { flex: 1, color: paper.ink }]}>{error}</Text>
    </View>}
  </View>;
});
AccountField.displayName = 'AccountField';

const st = StyleSheet.create({
  group: { gap: space(2) },
  label: { color: paper.ink, fontFamily: font.semiBold },
  inputWrap: { flexDirection: 'row', alignItems: 'center', minHeight: 54, borderRadius: radius.field, backgroundColor: paper.card, borderWidth: 1.5, borderColor: paper.field },
  input: { ...type.body, flex: 1, minWidth: 0, minHeight: 51, paddingVertical: 12, paddingHorizontal: 16, textAlign: 'left', textAlignVertical: 'center', includeFontPadding: false, borderRadius: radius.field, color: paper.ink, ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}) },
  focused: { borderColor: paper.ink },
  disabled: { opacity: 0.65 },
  show: { position: 'absolute', right: 0, top: 0, bottom: 0, minWidth: 64, minHeight: HIT, paddingHorizontal: 12, paddingVertical: 10, margin: 3, borderRadius: radius.field - 4, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  showActive: { borderColor: paper.inkSoft, backgroundColor: paper.ground },
  showLabel: { color: paper.ink, fontFamily: font.semiBold },
  error: { flexDirection: 'row', gap: space(2), alignItems: 'flex-start' },
});
