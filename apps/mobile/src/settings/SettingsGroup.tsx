/**
 * One grouped list: a quiet header, a clipped surface holding rows, and an
 * optional footer (P2 · Luvani, 2026-10-19).
 *
 * Profile, Learning preferences, Settings and Subscription all draw their rows
 * inside this, so the header size, the 20pt corner, the 16pt insets and the
 * 28pt between groups are written once. Rows draw their own inset separator
 * with `RowDivider`, because only a row knows whether it is the first.
 *
 * Layout only. What a group holds, and whether it is drawn at all, is decided
 * by the screen from plain modules.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { HAIRLINE, HIT, radius, space, type } from '../theme.ts';
import { useSettingsColors } from './SettingsAppearance.tsx';

/**
 * Whether a row is drawn inside a group. Rows outside one (the memory screen,
 * social settings, onboarding and the auth notices still draw them on a padded
 * card) keep the card shape they were built for: a top hairline and no
 * horizontal padding of their own.
 */
const InGroup = createContext(false);

export function SettingsGroup({
  title,
  footer,
  first = false,
  style,
  children,
}: {
  /** The quiet header above the list. Omitted for a list that needs no name. */
  title?: string;
  /** A sentence under the list, in the same muted ink as the header. */
  footer?: ReactNode;
  /** The first group on a screen takes no air above it. */
  first?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const colors = useSettingsColors();
  return (
    <View style={[!first && st.spaced, style]}>
      {title !== undefined ? (
        <Text accessibilityRole="header" style={[type.small, st.header, { color: colors.muted }]}>{title}</Text>
      ) : null}
      <View style={[st.list, { backgroundColor: colors.surface }]}><InGroup.Provider value>{children}</InGroup.Provider></View>
      {footer !== undefined && footer !== null ? (
        typeof footer === 'string' ? <Text style={[type.small, st.footer, { color: colors.muted }]}>{footer}</Text> : <View style={st.footer}>{footer}</View>
      ) : null}
    </View>
  );
}

/** The separator above every row but the first: inset from the left in a group, full width on a card. */
export function RowDivider() {
  const colors = useSettingsColors();
  const grouped = useContext(InGroup);
  return <View style={[st.divider, grouped ? st.dividerInset : st.dividerCard, { backgroundColor: colors.border }]} />;
}

/** Whether this is drawn inside a group's list. */
export function useInGroup() {
  return useContext(InGroup);
}

/** The padding and floor a row takes: the grouped list's, or the older card's. */
export function useRowFrame() {
  const grouped = useContext(InGroup);
  return grouped ? ROW_GROUPED : ROW_CARD;
}

const ROW_GROUPED = { paddingHorizontal: space(4), paddingVertical: space(3.25), minHeight: 52 } as const;
const ROW_CARD = { paddingVertical: space(2.5), minHeight: HIT } as const;

const st = StyleSheet.create({
  spaced: { marginTop: space(7) },
  header: { paddingHorizontal: space(4), marginBottom: space(1.5) },
  list: { borderRadius: radius.tile, overflow: 'hidden' },
  footer: { paddingHorizontal: space(4), marginTop: space(1.5) },
  divider: { position: 'absolute', top: 0, right: 0, height: HAIRLINE },
  dividerInset: { left: space(4), opacity: 0.7 },
  dividerCard: { left: 0 },
});
