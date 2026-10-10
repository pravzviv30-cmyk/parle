import { Text, View, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { TutorVoiceKey } from '@luvani/core';
import { CheckGlyph, Press } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { TUTOR_VOICE_OPTIONS } from '../tutor/tutorVoice.ts';
import { useFontScale } from '../layout.tsx';
import { colour, decorative, paper, radius, type } from '../theme.ts';
import { tutorPortraitSvg } from './tutorPortraits.ts';
import { VOICE_BODY } from './disclosure.ts';

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
  const current = TUTOR_VOICE_OPTIONS.find(v => v.value === preview?.voice);
  return <View style={st.list}>
    <Text style={st.intro}>{VOICE_BODY}</Text>
    <View style={st.transcript} accessibilityLiveRegion="polite">
      <Text style={st.sampleLabel}>{current ? `${current.label}’s preview` : 'Voice preview'}</Text>
      <Text style={st.sample}>{current?.sample ?? 'Tap Listen to hear a short introduction.'}</Text>
      {preview?.error ? <Text style={st.error}>{preview.error} Tap Retry to listen again. You can still choose this tutor.</Text> : null}
    </View>
    <View accessibilityRole="radiogroup" accessibilityLabel="Choose your tutor" style={st.cards}>
      {TUTOR_VOICE_OPTIONS.map(voice => {
        const selected = chosen === voice.value;
        const phase = preview?.voice === voice.value ? preview.phase : playing === voice.value ? 'playing' : 'idle';
        const label = phase === 'playing' ? 'Pause' : phase === 'paused' ? 'Resume' : phase === 'loading' ? 'Loading…' : phase === 'error' ? 'Retry' : 'Listen';
        return <View key={voice.value} style={[st.card, selected && st.selected]}>
          <Press haptic="selection" accessibilityRole="radio" accessibilityState={{ checked: selected }}
            aria-checked={selected} accessibilityLabel={`${voice.label}. ${voice.gloss} AI tutor.`}
            onPress={() => onChoose(voice.value)} frame={{ flex: 1 }}
            style={[st.identity, large && { flexDirection: 'column' }]}>
            <View {...decorative} style={st.portrait}><SvgXml {...decorative} xml={tutorPortraitSvg(voice.value)} width={52} height={52} /></View>
            <View style={[st.words, large && { flex: 0, width: '100%' }]}>
              <Text style={st.name}>{voice.label}</Text>
              <Text style={st.description}>{voice.gloss}</Text>
            </View>
            <View {...decorative} style={[st.radio, selected && st.radioChosen]}>
              {selected && <CheckGlyph size={13} color={paper.card} />}
            </View>
          </Press>
          <View style={[st.controls, large && { flexDirection: 'column', alignItems: 'stretch' }]}>
            <Text style={[st.language, large && { flex: 0, textAlign: 'center' }]}>French, AI voice</Text>
            <Press haptic="light" accessibilityLabel={`${label} ${voice.label}’s voice preview`}
              accessibilityState={{ busy: phase === 'loading' }}
              onPress={() => preview ? preview.toggle(voice.value) : onHear?.(voice.value)}
              style={[st.listen, large && { minHeight: 44 * fontScale }]}>
              <Icon name={phase === 'playing' ? 'pause' : 'speaker'} size={17} color={colour.blue} />
              <Text style={st.listenLabel}>{label}</Text>
            </Press>
          </View>
          <View {...decorative} style={st.playbackTrack}>
            <View style={{ height: 2, width: `${Math.max(0, Math.min(1, preview?.voice === voice.value ? preview.progress : 0)) * 100}%`, backgroundColor: colour.blue }} />
          </View>
        </View>;
      })}
    </View>
    <Text style={st.hint}>You can change your tutor anytime in Profile.</Text>
  </View>;
}

const st = StyleSheet.create({
  list: { gap: 20, width: '100%' },
  intro: { ...type.body, color: paper.inkSoft, textAlign: 'center', maxWidth: 360, alignSelf: 'center' },
  cards: { gap: 10 },
  card: { borderRadius: radius.tile, borderWidth: 1.5, borderColor: paper.line, backgroundColor: paper.card, overflow: 'hidden', boxShadow: `0px 3px 12px ${paper.ink}06` },
  selected: { borderColor: colour.blue, backgroundColor: `${colour.blue}0D` },
  identity: { minHeight: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, gap: 10 },
  portrait: { width: 52, height: 52 },
  words: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
  name: { ...type.heading, color: paper.ink, textAlign: 'center' },
  description: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: paper.field, alignItems: 'center', justifyContent: 'center' },
  radioChosen: { borderColor: colour.blue, backgroundColor: colour.blue },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingLeft: 14, paddingRight: 10 },
  language: { ...type.small, color: paper.inkSoft, flex: 1 },
  listen: { minHeight: 44, minWidth: 100, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, paddingHorizontal: 10 },
  listenLabel: { ...type.small, color: colour.blue, flexShrink: 1, textAlign: 'center' },
  playbackTrack: { height: 2, marginHorizontal: 14, backgroundColor: 'transparent' },
  transcript: { gap: 6, minHeight: 88, justifyContent: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: paper.line, paddingVertical: 12 },
  sampleLabel: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
  sample: { ...type.body, color: paper.ink, textAlign: 'center' },
  error: { ...type.small, color: paper.ink, textAlign: 'center' },
  hint: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
});
