import { Text, View } from 'react-native';
import type { TutorVoiceKey } from '@luvani/core';
import { CheckGlyph, IconButton, Press } from '../components.tsx';
import { IconTile } from '../icons/IconTile.tsx';
import { TUTOR_VOICE_OPTIONS } from '../tutor/tutorVoice.ts';
import { useFontScale } from '../layout.tsx';
import { colour, decorative, paper, radius, type } from '../theme.ts';

/** Hearing and choosing are separate targets: a sample never picks a tutor. */
export function TutorSelection({ chosen, playing, onChoose, onHear }: {
  chosen: TutorVoiceKey | null; playing: TutorVoiceKey | null;
  onChoose: (voice: TutorVoiceKey) => void; onHear: (voice: TutorVoiceKey) => void;
}) {
  const large = useFontScale() >= 1.3;
  return <View style={{ gap: 10 }}>
    <Text style={[type.body, { color: paper.card }]}>Pick an AI voice you’ll enjoy practising with.</Text>
    <View accessibilityRole="radiogroup" style={{ gap: 8, flexDirection: large ? 'column' : 'row', flexWrap: 'wrap' }}>
      {TUTOR_VOICE_OPTIONS.map((voice, index) => <View key={voice.value} style={{ width: large ? '100%' : '48%', flexGrow: 1, borderRadius: radius.tile, backgroundColor: chosen === voice.value ? colour.sun : paper.card, padding: 10, gap: 4, flexDirection: 'row', alignItems: 'center' }}>
        <Press haptic="selection" accessibilityRole="radio" accessibilityState={{ checked: chosen === voice.value }}
          aria-checked={chosen === voice.value}
          accessibilityLabel={`${voice.label}, ${voice.gloss}`} onPress={() => onChoose(voice.value)}
          style={{ minHeight: 56, flex: 1, minWidth: 0, justifyContent: 'center', gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><IconTile name="user" size={24} ground={index % 3 === 0 ? 'sun' : index % 3 === 1 ? 'mint' : 'coral'} />
            {chosen === voice.value && <View {...decorative}><CheckGlyph size={14} color={paper.ink} /></View>}
          </View>
          <Text style={[type.label, { color: paper.ink }]}>{voice.label}</Text>
          {large && <Text style={[type.small, { color: paper.ink }]}>{voice.gloss}</Text>}
        </Press>
        <IconButton icon="speaker" label={`${playing === voice.value ? 'Stop' : 'Hear'} ${voice.label}`} onPress={() => onHear(voice.value)} animate="speaker-waves" active={playing === voice.value} />
      </View>)}
    </View>
  </View>;
}
