/**
 * The picture of a switch, for a row that is itself the switch.
 *
 * A row whose whole surface toggles (SwitchRow, the live room menu) is the one
 * accessible switch: it carries the role, the label, the hint and the checked
 * state. React Native's `<Switch>` inside it rendered on the web as a focusable
 * checkbox in a hidden subtree, an invisible and unnamed tab stop after every
 * row. This draws the same state from plain views instead, so there is nothing
 * to focus, press or announce. On: the track in `on` with the thumb at the
 * trailing end. Off: the track in `off` with the thumb at the leading end.
 * Sized like the platform switch. Themed by default with `mark` on, which
 * clears 3:1 on the ground in both themes (brand is 2.3:1 on the dark ground).
 */

import { StyleSheet, View } from 'react-native';
import { useB } from '../main/bTheme.tsx';
import { decorative } from '../theme.ts';

const TRACK = { width: 51, height: 31 } as const;
const THUMB = 27;

export function SwitchKnob({ value, disabled = false, on, off, thumb }: {
  value: boolean;
  disabled?: boolean;
  /** The colours, when the caller is not themed by `useB()` (SwitchRow's palette). */
  on?: string;
  off?: string;
  thumb?: string;
}) {
  const t = useB();
  return (
    <View {...decorative} pointerEvents="none"
      style={[st.track, { backgroundColor: value ? on ?? t.mark : off ?? t.field, alignItems: value ? 'flex-end' : 'flex-start' }, disabled && st.disabled]}>
      <View style={[st.thumb, { backgroundColor: thumb ?? t.card }]} />
    </View>
  );
}

const st = StyleSheet.create({
  track: { width: TRACK.width, height: TRACK.height, borderRadius: TRACK.height / 2, padding: (TRACK.height - THUMB) / 2, justifyContent: 'center' },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB / 2 },
  disabled: { opacity: 0.55 },
});
