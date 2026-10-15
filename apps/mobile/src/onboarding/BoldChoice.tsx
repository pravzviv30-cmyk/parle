import { Glint } from '../motion/Glint.tsx';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckGlyph, Press } from '../components.tsx';
import { decorative } from '../theme.ts';
import { c, boldType as type } from './boldRhythm.ts';
export function BoldChoice({ title, detail, selected, onPress, multiple = false, art, tone }: {
  title: string; detail?: string; selected: boolean; onPress: () => void; multiple?: boolean; art?: ReactNode;
  tone?: 'sage' | 'peach' | 'lavender' | 'butter';
}) {
  const colourful = tone !== undefined;
  const fill = tone ? (selected ? c.violet : c[tone]) : selected ? c.lavender : c.paper;
  const ink = colourful && selected ? c.white : c.ink;
  const corner = colourful ? 24 : 16;
  return <Press haptic="selection" depth="raised" selected={selected} glowRadius={corner} accessibilityRole={multiple ? 'checkbox' : 'radio'}
    accessibilityState={{ checked: selected }} aria-checked={selected}
    accessibilityLabel={detail ? `${title}. ${detail}` : title} onPress={onPress}
    frame={{ borderRadius: corner }}
    style={[colourful ? st.answer : st.quiet, { borderColor: selected ? c.violet : colourful ? 'transparent' : c.line, backgroundColor: fill }]}>
    {art != null && <View {...decorative} style={{ width: 48, height: 48, overflow: 'hidden', borderRadius: 12 }}>{art}</View>}
    <View style={{ gap: colourful ? 3 : 2, flex: 1, minWidth: 0 }}><Text style={[colourful ? type.choiceTitle : type.label, { color: ink }]}>{title}</Text>
      {!!detail && <Text style={[type.small, { color: colourful ? ink : c.muted }]}>{detail}</Text>}
    </View>
    <View {...decorative} style={[st.mark, colourful && st.answerMark, colourful && { borderRadius: multiple ? 7 : 12, borderWidth: selected ? 0 : 2, borderColor: c.violet, backgroundColor: selected ? c.sun : c.white }]}>
      {selected ? <CheckGlyph size={colourful ? 14 : 18} color={colourful ? c.ink : c.violet} /> : !colourful && <View style={{ width: 17, height: 17, borderWidth: 1, borderColor: c.muted, borderRadius: 9 }} />}
    </View>
    {selected && <Glint when wait={0} radius={corner} />}
    {selected && !colourful && <View {...decorative} style={st.quietStroke} />}
  </Press>;
}

const st = StyleSheet.create({
  answer: { minHeight: 72, borderRadius: 24, borderWidth: 2, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  quiet: { minHeight: 64, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 12 },
  mark: { width: 20, height: 20, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  answerMark: { width: 24, height: 24 },
  quietStroke: { position: 'absolute', inset: -1, borderRadius: 16, borderWidth: 2, borderColor: c.violet, pointerEvents: 'none' },
});
