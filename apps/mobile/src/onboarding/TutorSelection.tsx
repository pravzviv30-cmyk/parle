import { Text, View, StyleSheet, useWindowDimensions } from 'react-native';
import type { TutorVoiceKey } from '@luvani/core';
import { CheckGlyph, Press } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { AnimatedIcon } from '../icons/AnimatedIcon.tsx';
import { TUTOR_VOICE_OPTIONS } from '../tutor/tutorVoice.ts';
import { useFontScale } from '../layout.tsx';
import { decorative } from '../theme.ts';
import { c, boldType as type } from './boldRhythm.ts';
import { C2TutorPortrait } from './C2Visuals.tsx';
import { MediaProgress } from '../motion/MediaProgress.tsx';
import { Glint } from '../motion/Glint.tsx';
import type { TutorPreviewProgressSource } from '../tutor/tutorPreview.ts';

type Preview = {
  voice: TutorVoiceKey | null;
  phase: 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';
  progress: number;
  error: string | null;
  toggle: (voice: TutorVoiceKey) => void;
  progressSource?: TutorPreviewProgressSource;
};

const tutorGrounds: Record<TutorVoiceKey, string> = {
  alexandre: c.sage, emilie: c.peach, guillaume: c.lavender,
  marie: c.butter, anatole: c.sage, sarah: c.lavender,
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
  const compact = useWindowDimensions().width < 360;
  return <View style={st.list}>
    <Text style={st.intro}>Listen, then choose your tutor.</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Meet your tutor" style={st.cards}>
      {TUTOR_VOICE_OPTIONS.map(voice => {
        const selected = chosen === voice.value;

        const phase = preview?.voice === voice.value ? preview.phase : playing === voice.value ? 'playing' : 'idle';
        const label = phase === 'playing' ? 'Pause' : phase === 'paused' ? 'Resume' : phase === 'loading' ? 'Loading…' : phase === 'error' ? 'Retry' : 'Listen';
        const listenInk = selected ? c.ink : c.white;
        return <View key={voice.value} style={[st.card, { backgroundColor: tutorGrounds[voice.value] }, compact && st.cardCompact, large && st.cardLarge, selected && { backgroundColor: c.violet, borderColor: c.violet }]}>
          <Press haptic="selection" depth="raised" accessibilityRole="radio" accessibilityState={{ checked: selected }}
            aria-checked={selected} accessibilityLabel={voice.label}
            onPress={() => onChoose(voice.value)} frame={large ? { width: '100%' } : { flex: 1, minWidth: 0 }}
            style={[st.identity, compact && { gap: 8 }]}>
            <View style={st.portrait}>
              <C2TutorPortrait voice={voice.value} size={compact ? 44 : 56} />
              {selected && <View {...decorative} style={st.chosenMark}><CheckGlyph size={12} color={c.ink} /></View>}
            </View>
            <Text style={[st.name, compact && type.tutorNameCompact, selected && { color: c.white }]}>{voice.label}</Text>
          </Press>
          <View style={[st.controls, large && { width: '100%' }]}>
            <Press haptic="light" depth="raised" accessibilityLabel={`${label} ${voice.label}’s voice preview`}
              accessibilityState={{ busy: phase === 'loading' }}
              onPress={() => preview ? preview.toggle(voice.value) : onHear?.(voice.value)}
              style={[st.listen, { width: 106 * fontScale }, selected && { backgroundColor: c.sun }, large && { width: '100%', minHeight: 44 * fontScale }]}>
              {phase === 'playing' || phase === 'loading'
                ? <AnimatedIcon kind={phase === 'loading' ? 'refresh-spin' : 'speaker-waves'} size={20} color={listenInk} active />
                : <Icon name={phase === 'error' ? 'refresh' : 'play'} variant={phase === 'error' ? 'linear' : 'bulk'} size={20} color={listenInk} />}
              <Text style={[st.listenLabel, { color: listenInk }]}>{label}</Text>
              <View style={st.playback}>
                <MediaProgress voice={voice.value} colour={listenInk} source={preview?.progressSource}
                  fallback={preview?.voice === voice.value ? preview.progress : 0} />
              </View>
            </Press>
          </View>
          {phase === 'error' && !!preview?.error && <Text accessibilityLiveRegion="polite" style={[st.error, { color: selected ? c.white : c.ink }]}>
            {preview.error} Tap Retry to listen again. You can still choose this tutor.
          </Text>}
          {selected && <Glint when wait={0} radius={24} />}
        </View>;
      })}
    </View>

  </View>;
}

const st = StyleSheet.create({
  list: { gap: 12, width: '100%' },
  intro: { ...type.body, color: c.muted, textAlign: 'center' },
  cards: { gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, minHeight: 84, borderRadius: 24, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden', padding: 12 },
  cardCompact: { gap: 8, padding: 8, minHeight: 76 },
  cardLarge: { flexDirection: 'column', alignItems: 'stretch' },
  identity: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  portrait: { flexShrink: 0 },
  chosenMark: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: c.sun, alignItems: 'center', justifyContent: 'center' },
  name: { ...type.tutorName, color: c.ink, flexShrink: 1 },
  controls: { flexShrink: 0 },
  listen: { minHeight: 48, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 24, backgroundColor: c.violet, overflow: 'hidden' },
  listenLabel: { ...type.tutorListen, flexShrink: 1 },
  playback: { position: 'absolute', left: 14, right: 14, bottom: 5, pointerEvents: 'none' },
  error: { ...type.small, color: c.ink, width: '100%', paddingTop: 8 },
});
