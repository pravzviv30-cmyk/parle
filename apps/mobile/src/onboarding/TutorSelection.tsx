/**
 * The six voices, to the B-OB-Tutor artboard (DECISIONS.md UI-008,
 * 2026-10-21): a white row per voice (min-height 68, radius 20) with the
 * canvas orb (never a face), the name and a 44 speaker; the chosen row fills
 * with the brand and its speaker turns white. Sibling touch targets keep
 * listening independent from choosing.
 */
import { Text, View, StyleSheet } from 'react-native';
import type { TutorVoiceKey } from '@luvani/core';
import { Press } from '../components.tsx';
import { AnimatedIcon } from '../icons/AnimatedIcon.tsx';
import { TUTOR_VOICE_OPTIONS } from '../tutor/tutorVoice.ts';
import { HIT, bType, decorative } from '../theme.ts';
import { c } from './boldRhythm.ts';
import { BArt } from '../art/BArt.tsx';
import { BSpeaker } from '../today/TodayParts.tsx';
import { BTick } from './BOnboardingParts.tsx';
import { useB } from '../main/bTheme.tsx';
import { MediaProgress } from '../motion/MediaProgress.tsx';
import type { TutorPreviewProgressSource } from '../tutor/tutorPreview.ts';

type Preview = {
  voice: TutorVoiceKey | null;
  phase: 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';
  progress: number;
  error: string | null;
  toggle: (voice: TutorVoiceKey) => void;
  progressSource?: TutorPreviewProgressSource;
};

export function TutorSelection({ chosen, preview, playing = null, onChoose, onHear }: {
  chosen: TutorVoiceKey | null;
  preview?: Preview;
  playing?: TutorVoiceKey | null;
  onChoose: (voice: TutorVoiceKey) => void;
  onHear?: (voice: TutorVoiceKey) => void;
}) {
  const t = useB();
  return <View accessibilityRole="radiogroup" accessibilityLabel="Meet your tutor" style={st.cards}>
    {TUTOR_VOICE_OPTIONS.map(voice => {
      const selected = chosen === voice.value;
      const phase = preview?.voice === voice.value ? preview.phase : playing === voice.value ? 'playing' : 'idle';
      const label = phase === 'playing' ? 'Pause' : phase === 'paused' ? 'Resume' : phase === 'loading' ? 'Loading…' : phase === 'error' ? 'Retry' : 'Listen';
      const ink = selected ? t.onBrand : t.text;
      return <View key={voice.value} style={[st.card, { backgroundColor: t.card }, selected && { backgroundColor: c.violet, borderColor: c.violet }]}>
        <Press haptic="selection" accessibilityRole="radio" accessibilityState={{ checked: selected }}
          aria-checked={selected} accessibilityLabel={voice.label}
          onPress={() => onChoose(voice.value)} frame={{ flex: 1, minWidth: 0 }} style={st.identity}>
          <View {...decorative} style={st.avatar}>
            <View style={st.orb}><BArt name="tutor-orb" width={44} height={44} /></View>
            {selected && <View style={[st.chosenMark, { backgroundColor: t.sun }]}><BTick size={10} color={t.text} /></View>}
          </View>
          <Text style={[bType.title17, st.name, { color: ink }]}>{voice.label}</Text>
        </Press>
        <Press haptic="light" accessibilityLabel={`${label} ${voice.label}’s voice preview`}
          accessibilityState={{ busy: phase === 'loading' }}
          onPress={() => preview ? preview.toggle(voice.value) : onHear?.(voice.value)}
          style={[st.listen, { backgroundColor: selected ? t.card : t.lavender }]}>
          {phase === 'playing' || phase === 'loading'
            ? <AnimatedIcon kind={phase === 'loading' ? 'refresh-spin' : 'speaker-waves'} size={18} color={t.brand} active />
            : <BSpeaker size={18} color={selected ? t.brand : t.text} />}
          <View style={st.playback}>
            <MediaProgress voice={voice.value} colour={t.brand} source={preview?.progressSource}
              fallback={preview?.voice === voice.value ? preview.progress : 0} />
          </View>
        </Press>
        {phase === 'error' && !!preview?.error && <Text accessibilityLiveRegion="polite" style={[bType.note, st.error, { color: ink }]}>
          {preview.error} Tap Retry to listen again. You can still choose this tutor.
        </Text>}
      </View>;
    })}
  </View>;
}

const st = StyleSheet.create({
  cards: { gap: 8, width: '100%' },
  card: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, minHeight: 68, borderRadius: 20, borderWidth: 0, borderColor: 'transparent', overflow: 'hidden', paddingVertical: 8, paddingLeft: 12, paddingRight: 10 },
  identity: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44 },
  orb: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  chosenMark: { position: 'absolute', right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  name: { flexShrink: 1 },
  listen: { width: HIT, height: HIT, borderRadius: HIT / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  playback: { position: 'absolute', left: 8, right: 8, bottom: 4, pointerEvents: 'none' },
  error: { width: '100%', paddingTop: 4 },
});
