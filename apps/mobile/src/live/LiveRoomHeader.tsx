/**
 * The quiet top edge of a metered room.
 *
 * A live conversation only needs two things in its chrome: a transient status
 * in the true centre, and a safe way out. The way out is deliberately an icon
 * button rather than the old floating word "Leave": its 44pt outlined circle
 * is easy to find without competing with the tutor, and its accessible name
 * says exactly what it does. Callers still own the confirmation sheet, so a
 * tap here can never disconnect a room by itself.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { accent, decorative, HAIRLINE, HIT, paper, radius, space, STROKE, type } from '../theme.ts';

function EndSessionGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" {...decorative}>
      <Path
        d="m6.5 6.5 11 11M17.5 6.5l-11 11"
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function LiveRoomHeader({
  onEnd,
  accessibilityLabel,
  status,
}: {
  onEnd: () => void;
  accessibilityLabel: string;
  status?: ReactNode;
}) {
  return (
    <View style={st.row}>
      {/* Equal side slots keep a reconnecting line visually centred. */}
      <View style={st.balance} />
      <View style={st.status}>{status ?? <Text style={[type.label, { color: paper.ink }]}>Luvani · En conversation</Text>}</View>
      <Pressable
        onPress={onEnd}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Opens a confirmation before ending the session"
        hitSlop={6}
        style={({ pressed }) => [st.end, pressed && st.endPressed]}
      >
        {({ pressed }) => <EndSessionGlyph color={pressed ? accent.primary : paper.inkSoft} />}
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  row: {
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: HAIRLINE,
    borderBottomColor: paper.ink,
    paddingBottom: space(3),
    marginBottom: space(3),
  },
  balance: { width: HIT, height: HIT },
  status: {
    flex: 1,
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  end: {
    width: HIT,
    height: HIT,
    borderRadius: radius.control,
    borderWidth: HAIRLINE,
    borderColor: paper.ink,
    backgroundColor: paper.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Colour and fill make the press visible without depending on opacity or an
  // animation, so reduced-motion users receive exactly the same feedback.
  endPressed: {
    borderColor: accent.primary,
    backgroundColor: paper.groundDeep,
  },
});
