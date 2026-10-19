import { Text, View, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { TutorVoiceKey } from '@luvani/core';
import { CheckGlyph, Press } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { TUTOR_VOICE_OPTIONS } from '../tutor/tutorVoice.ts';
import { useFontScale } from '../layout.tsx';
import { colour, decorative, paper, radius, type } from '../theme.ts';
import { VOICE_BODY } from './disclosure.ts';
import { C2 } from './c2Presentation.ts';
import smallArt from '../../assets/onboarding-art/small.json';

const C2_PORTRAITS = {
  alexandre: smallArt['61-648-imgPortraitHairFaceAndClothing.svg'],
  emilie: smallArt['61-648-imgPortraitHairFaceAndClothing1.svg'],
  guillaume: smallArt['61-648-imgPortraitHairFaceAndClothing2.svg'],
  marie: smallArt['61-648-imgPortraitHairFaceAndClothing3.svg'],
  anatole: smallArt['61-648-imgPortraitHairFaceAndClothing4.svg'],
  sarah: smallArt['61-648-imgPortraitHairFaceAndClothing5.svg'],
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
  const current = TUTOR_VOICE_OPTIONS.find(v => v.value === preview?.voice);
  return <View style={st.list}>
    <Text style={st.intro}>{VOICE_BODY}</Text>
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
            <View {...decorative} style={st.portrait}><SvgXml {...decorative} xml={C2_PORTRAITS[voice.value]} width={50} height={50} /></View>
            <View style={[st.words, large && { flex: 0, width: '100%' }]}>
              <Text style={st.name}>{voice.label}</Text>
            </View>
            <View {...decorative} style={[st.radio, selected && st.radioChosen]}>
              {selected && <CheckGlyph size={13} color={C2.violet} />}
            </View>
          </Press>
          <View style={[st.controls, large && { flexDirection: 'column', alignItems: 'stretch' }]}>
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
    {current && <View style={st.transcript} accessibilityLiveRegion="polite">
      <Text style={st.sampleLabel}>{current.label}’s preview</Text>
      <Text style={st.sample}>{current.sample}</Text>
      {preview?.error ? <Text style={st.error}>{preview.error} Tap Retry to listen again. You can still choose this tutor.</Text> : null}
    </View>}
    <Text style={st.hint}>You can change your tutor anytime in Profile.</Text>
  </View>;
}

const st = StyleSheet.create({
  list: { gap: 20, width: '100%' },
  intro: { ...type.body, color: paper.inkSoft, textAlign: 'center', maxWidth: 360, alignSelf: 'center' },
  cards: { gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: C2.line, backgroundColor: C2.reading, overflow: 'hidden' },
  selected: { borderColor: C2.violet, backgroundColor: C2.reflection },
  identity: { minHeight: 68, flexDirection: 'row', alignItems: 'center', padding: 8, gap: 10 },
  portrait: { width: 50, height: 50 },
  words: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...type.label, color: C2.ink },
  description: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
  radio: { width: 16, height: 22, alignItems: 'center', justifyContent: 'center' },
  radioChosen: { backgroundColor: 'transparent' },
  controls: { justifyContent: 'center', alignItems: 'center', paddingRight: 8, paddingVertical: 8 },
  language: { ...type.small, color: paper.inkSoft, flex: 1 },
  listen: { minHeight: 48, minWidth: 70, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, paddingHorizontal: 10, backgroundColor: C2.white, borderRadius: 16 },
  listenLabel: { ...type.small, color: C2.violet, flexShrink: 1, textAlign: 'center' },
  playbackTrack: { height: 2, position: 'absolute', left: 14, right: 14, bottom: 0, backgroundColor: 'transparent' },
  transcript: { gap: 6, minHeight: 88, justifyContent: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: paper.line, paddingVertical: 12 },
  sampleLabel: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
  sample: { ...type.body, color: paper.ink, textAlign: 'center' },
  error: { ...type.small, color: paper.ink, textAlign: 'center' },
  hint: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
});
