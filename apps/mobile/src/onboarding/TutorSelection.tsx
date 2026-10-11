import { Text, View, StyleSheet } from 'react-native';
import type { TutorVoiceKey } from '@luvani/core';
import { CheckGlyph, Press } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { TUTOR_VOICE_OPTIONS } from '../tutor/tutorVoice.ts';
import { useFontScale } from '../layout.tsx';
import { colour, decorative, paper, space } from '../theme.ts';
import { c, boldType as type } from './boldRhythm.ts';
import { VOICE_BODY } from './disclosure.ts';
import { Glint } from '../motion/Glint.tsx';

const TUTOR_COLOURS = {
  alexandre: { fill: c.violet, ink: c.white, ring: c.sun },
  emilie: { fill: c.sun, ink: c.ink, ring: c.violet },
  guillaume: { fill: c.lavender, ink: c.ink, ring: c.violet },
  marie: { fill: c.peach, ink: c.ink, ring: c.violet },
  anatole: { fill: c.sage, ink: c.ink, ring: c.violet },
  sarah: { fill: c.coral, ink: c.white, ring: c.sun },
} as const;

type Preview = {
  voice: TutorVoiceKey | null;
  phase: 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';
  progress: number;
  error: string | null;
  toggle: (voice: TutorVoiceKey) => void;
};

/** Sibling touch targets keep listening independent from the selected voice. */
export function TutorSelection({ chosen, preview, playing = null, onChoose, onHear }: {
  chosen: TutorVoiceKey | null;
  preview?: Preview;
  playing?: TutorVoiceKey | null;
  onChoose: (voice: TutorVoiceKey) => void;
  onHear?: (voice: TutorVoiceKey) => void;
}) {
  const fontScale = useFontScale();
  const large = fontScale >= 1.3;
  return <View style={st.list}>
    <Text style={st.intro}>{VOICE_BODY}</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Choose your tutor" style={st.cards}>
      {TUTOR_VOICE_OPTIONS.map(voice => {
        const selected = chosen === voice.value;
        const colours = TUTOR_COLOURS[voice.value];
        const phase = preview?.voice === voice.value ? preview.phase : playing === voice.value ? 'playing' : 'idle';
        const label = phase === 'playing' ? 'Pause' : phase === 'paused' ? 'Resume' : phase === 'loading' ? 'Loading…' : phase === 'error' ? 'Retry' : 'Listen';
        return <View key={voice.value} style={[st.card, { flexBasis: large ? '100%' : '45%', flexGrow: 1, minWidth: 0, backgroundColor: colours.fill, borderColor: selected ? colours.ring : colours.fill }]}>
          <Press haptic="selection" depth="raised" accessibilityRole="radio" accessibilityState={{ checked: selected }}
            aria-checked={selected} accessibilityLabel={`${voice.label}. ${voice.gloss} AI tutor.`}
            onPress={() => onChoose(voice.value)} frame={{ flex: 1 }}
            style={[st.identity, large && { flexDirection: 'column' }]}>

            <View style={[st.words, large && { flex: 0, width: '100%' }]}>
              <Text style={[st.name, { color: colours.ink }]}>{voice.label}</Text>
              <Text style={[st.description, { color: colours.ink }]}>{voice.label === 'Émilie' ? 'Paris' : ['Anatole', 'Sarah'].includes(voice.label) ? 'France, young voice' : 'France'}</Text>
            </View>
            <View {...decorative} style={[st.radio, selected && { backgroundColor: colours.ring }]}>
              {selected && <CheckGlyph size={13} color={colours.ring === c.sun ? c.ink : c.white} />}
            </View>
          </Press>
          <View style={[st.controls, large && { flexDirection: 'column', alignItems: 'stretch' }]}>

            <Press haptic="light" depth="raised" accessibilityLabel={`${label} ${voice.label}’s voice preview`}
              accessibilityState={{ busy: phase === 'loading' }}
              onPress={() => preview ? preview.toggle(voice.value) : onHear?.(voice.value)}
              style={[st.listen, large && { minHeight: 44 * fontScale }]}>
              <Icon name={phase === 'playing' ? 'pause' : 'speaker'} size={17} color={colour.blue} />
              <Text style={st.listenLabel}>{label}</Text>
            </Press>
          </View>
          {phase === 'error' && !!preview?.error && <Text accessibilityLiveRegion="polite" style={[st.error, { color: colours.ink }]}>
            {preview.error} Tap Retry to listen again. You can still choose this tutor.
          </Text>}
          <View {...decorative} style={st.playbackTrack}>
            <View style={{ height: 2, width: `${Math.max(0, Math.min(1, preview?.voice === voice.value ? preview.progress : 0)) * 100}%`, backgroundColor: colours.ink }} />
          </View>
          {selected && <Glint when wait={0} radius={12} />}
        </View>;
      })}
    </View>
    <Text style={st.hint}>You can change your tutor anytime in Profile.</Text>
  </View>;
}

const st = StyleSheet.create({
  list: { gap: 20, width: '100%' },
  intro: { ...type.body, color: paper.inkSoft, textAlign: 'center', maxWidth: 360, alignSelf: 'center' },
  cards: { gap: 12, flexDirection: 'row', flexWrap: 'wrap' },
  card: { borderRadius: 12, borderWidth: 2, borderColor: c.white, backgroundColor: c.white, overflow: 'hidden', padding: 10 },
  identity: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 4 },
  words: { flex: 1, minWidth: 0, gap: 4 },
  name: { ...type.label, color: c.ink },
  description: { ...type.small, color: c.muted },
  radio: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  controls: { marginTop: 8 },
  listen: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 8, borderRadius: 12, backgroundColor: c.paper },
  listenLabel: { ...type.label, color: c.ink, flexShrink: 1 },
  playbackTrack: { height: 2, marginTop: space(0.5), backgroundColor: 'transparent' },
  error: { ...type.small, color: paper.ink, textAlign: 'center' },
  hint: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
});
