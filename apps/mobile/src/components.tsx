/**
 * The enamel component vocabulary.
 *
 * Everything here is built from one physical object: a vitreous enamel plaque
 * struck with a raised white rim, a green gap, and a thin inner keyline. Getting
 * that anatomy right is what separates this from a rounded card with a border.
 */

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { enamel, radius, space, type, HIT, rungColor } from './theme.ts';
import type { Rung } from '@parle/core';

// ─────────────────────────────────────────────────────────────── drawn icons
// Authored SVG in one consistent stroke weight. No glyph or emoji substitutes.

export function ArrowRight({ size = 18, color = enamel.white }: { size?: number; color?: string }) {
  // The RATP directional arrow: a solid equilateral head on a short thick shaft.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 10.4h11.2V6.2L21.5 12l-7.3 5.8v-4.2H3z" fill={color} />
    </Svg>
  );
}

export function MicGlyph({ size = 30, color = enamel.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill="none" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 3.2a2.9 2.9 0 0 1 2.9 2.9v5.6a2.9 2.9 0 0 1-5.8 0V6.1A2.9 2.9 0 0 1 12 3.2Z" />
        <Path d="M5.9 11.2a6.1 6.1 0 0 0 12.2 0M12 17.3v3.5" />
      </G>
    </Svg>
  );
}

export function EarGlyph({ size = 26, color = enamel.white }: { size?: number; color?: string }) {
  // Shown while the tutor is speaking: sound arriving, not being captured.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill="none" stroke={color} strokeWidth={2.1} strokeLinecap="round">
        <Path d="M4 9.5v5h3.4L12 18.6V5.4L7.4 9.5z" strokeLinejoin="round" />
        <Path d="M15.4 8.6a4.6 4.6 0 0 1 0 6.8M18.2 5.9a8.4 8.4 0 0 1 0 12.2" />
      </G>
    </Svg>
  );
}

export function HelpGlyph({ size = 16, color = enamel.whiteMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9.2} fill="none" stroke={color} strokeWidth={2} />
      <Path
        d="M9.3 9.2a2.8 2.8 0 0 1 5.5.7c0 1.9-2.7 2.2-2.7 4"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={12.1} cy={17.2} r={1.25} fill={color} />
    </Svg>
  );
}

// ────────────────────────────────────────────────────────────────── the plaque

/**
 * A struck enamel plaque.
 *
 * Anatomy, outside in: raised white rim with a bevel, green gap, thin white
 * keyline, then the content. The bevel is a real offset shadow plus a lighter top
 * edge — not a flat outline and not a coloured halo.
 */
export function Plaque({
  children,
  style,
  raised = false,
  tone = 'field',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  raised?: boolean;
  tone?: 'field' | 'white';
}) {
  const isWhite = tone === 'white';
  return (
    <View
      style={[
        s.plaqueOuter,
        {
          backgroundColor: isWhite ? enamel.white : raised ? enamel.fieldRaised : enamel.field,
          borderColor: isWhite ? enamel.field : enamel.white,
        },
        raised && s.plaqueRaised,
        style,
      ]}
    >
      <View style={[s.plaqueKeyline, { borderColor: isWhite ? 'rgba(15,59,44,0.35)' : 'rgba(242,239,228,0.42)' }]}>{children}</View>
    </View>
  );
}

/** A small caps tag, the lettering stencilled above a plaque. */
export function Tag({ children, color = enamel.whiteMuted }: { children: React.ReactNode; color?: string }) {
  return <Text style={[type.tag, { color }]}>{children}</Text>;
}

/**
 * A French label with its plain English meaning underneath.
 *
 * The French chrome is part of the app's identity, but a beginner should never
 * have to guess what a heading means. Every French label in the interface goes
 * through this so the pairing stays consistent.
 */
export function LabeledTag({ fr, en, color = enamel.whiteMuted }: { fr: string; en: string; color?: string }) {
  return (
    <View accessibilityLabel={en}>
      <Text style={[type.tag, { color }]}>{fr}</Text>
      <Text style={[type.small, { color: enamel.whiteFaint, marginTop: 2 }]}>{en}</Text>
    </View>
  );
}

/** A Métro line bullet. Used for the ladder rungs. */
export function LineBullet({ rung, active, size = 26 }: { rung: Rung; active: boolean; size?: number }) {
  const color = rungColor[rung];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.bullet,
        backgroundColor: active ? color : 'transparent',
        borderWidth: 2,
        borderColor: active ? color : 'rgba(242,239,228,0.22)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          ...type.tag,
          fontSize: size * 0.44,
          letterSpacing: 0,
          // On a light bullet the numeral must go dark, or it vanishes.
          color: active ? (rung === 1 || rung === 4 ? enamel.field : enamel.white) : 'rgba(242,239,228,0.34)',
        }}
      >
        {rung}
      </Text>
    </View>
  );
}

/**
 * The lesson as a Métro line: one stop per turn, the current one struck.
 * Reading your position off a line is the same gesture as reading it off a map.
 */
export function StationLine({ total, index }: { total: number; index: number }) {
  return (
    <View style={s.stationRow} accessibilityLabel={`Stop ${index + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const done = i < index;
        const here = i === index;
        return (
          <View key={i} style={s.stationCell}>
            {i > 0 && <View style={[s.stationRail, { backgroundColor: done || here ? enamel.white : 'rgba(242,239,228,0.18)' }]} />}
            <View
              style={[
                s.stationDot,
                here && s.stationDotHere,
                { backgroundColor: done ? enamel.white : here ? enamel.white : 'rgba(242,239,228,0.22)' },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

/** A directional plaque — an option the learner can say, with a RATP arrow. */
export function DirectionPlaque({
  text,
  gloss,
  onPress,
  onHear,
}: {
  text: string;
  gloss: string;
  onPress: () => void;
  /** Replay this option aloud without choosing it. */
  onHear?: () => void;
}) {
  // The hear control is a sibling of the main press target, not a child — a
  // button nested inside a button is invalid HTML on web. Pressed feedback is
  // lifted to the container so the whole plaque still flashes as one object.
  const [pressed, setPressed] = useState(false);
  return (
    <View style={[s.direction, pressed && s.directionPressed]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={`${text} — ${gloss}`}
        style={s.directionMain}
      >
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: enamel.white }]}>{text}</Text>
          <Text style={[type.small, { color: enamel.whiteMuted, marginTop: space(0.5) }]}>{gloss}</Text>
        </View>
      </Pressable>
      {onHear && (
        <Pressable
          onPress={onHear}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Hear ${text}`}
          style={({ pressed: hearPressed }) => [{ padding: space(2) }, hearPressed && { opacity: 0.6 }]}
        >
          <EarGlyph size={18} color={enamel.whiteMuted} />
        </Pressable>
      )}
      <ArrowRight size={20} color={enamel.white} />
    </View>
  );
}

const s = StyleSheet.create({
  plaqueOuter: {
    borderWidth: 3,
    borderRadius: radius.plaque,
    padding: space(1.5),
    // A real bevel: offset down, softly blurred. Not a zero-offset halo.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  plaqueRaised: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.42,
    shadowRadius: 22,
    elevation: 10,
  },
  plaqueKeyline: {
    borderWidth: 1,
    borderRadius: 2,
    paddingVertical: space(4),
    paddingHorizontal: space(3.5),
  },
  stationRow: { flexDirection: 'row', alignItems: 'center' },
  stationCell: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stationRail: { height: 2, flex: 1 },
  stationDot: { width: 7, height: 7, borderRadius: radius.bullet },
  stationDotHere: {
    width: 13,
    height: 13,
    borderWidth: 3,
    borderColor: enamel.ground,
  },
  direction: {
    minHeight: HIT + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: enamel.fieldRaised,
    borderWidth: 2,
    borderColor: 'rgba(242,239,228,0.55)',
    borderRadius: radius.plaque,
    paddingVertical: space(2.5),
    paddingHorizontal: space(3.5),
  },
  directionMain: { flex: 1, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  directionPressed: { backgroundColor: '#1B5742', borderColor: enamel.white },
});
