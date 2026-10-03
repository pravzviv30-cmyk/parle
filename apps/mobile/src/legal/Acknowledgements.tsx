/**
 * Acknowledgements — the licences other people's work is used under.
 *
 * This used to be the only legal screen the app could honestly draw, because
 * terms and a privacy policy were content nobody had written. Both exist now
 * and both are drawn from data: `legal/policy.ts` carries the privacy notice,
 * assembled from docs/PRIVACY_AND_SAFETY.md, and `legal/terms.ts` names Apple's
 * standard licence rather than reproducing a document that is theirs. Neither
 * has been read by a lawyer, and both keep saying so.
 *
 * What is left here is the thing those two do not cover: real font and library
 * licences that genuinely have to be reproduced, so those are reproduced.
 *
 * The licence text is committed alongside the fonts. It is repeated here as a
 * short attribution plus the licence name rather than the full body, which is
 * what OFL section requires for an application that redistributes the fonts
 * embedded — the full text ships in the bundle at assets/fonts/.
 *
 * It opens in place from Profile rather than as a stack route, so it answers
 * the hardware back itself and takes its frame from the shared `ScrollScreen`.
 */

import { View, Text } from 'react-native';
import { paper, space, type } from '../theme.ts';
import { Card, Label } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';

interface Notice {
  name: string;
  by: string;
  licence: string;
  note: string;
}

const NOTICES: readonly Notice[] = [
  { name: 'toqr', by: 'Phil Pluckthun', licence: 'MIT License', note: 'Creates invitation QR codes on your device.' },
  {
    name: 'Outfit',
    by: 'The Outfit Project Authors',
    licence: 'SIL Open Font License 1.1',
    note: 'Every word on the screen, French and English alike.',
  },
  {
    name: 'LiveKit',
    by: 'LiveKit, Inc.',
    licence: 'Apache License 2.0',
    note: 'Carries your voice to the tutor and back.',
  },
  {
    name: 'Expo and React Native',
    by: '650 Industries and Meta Platforms, Inc.',
    licence: 'MIT License',
    note: 'The app itself is built on them.',
  },
];

export function Acknowledgements({ onBack }: { onBack: () => void }) {
  // Opened in place, so Android's hardware back closes it rather than popping
  // whatever pushed Profile.
  useHardwareBack(true, onBack);
  return (
    <ScrollScreen header={<ScreenHeader back={{ onPress: onBack }} />}>
      <Text accessibilityRole="header" style={[type.display, { color: paper.ink }]}>Acknowledgements</Text>
      <Text style={[type.body, { color: paper.inkSoft, marginTop: space(3) }]}>
        Luvani is built on other people's work. The full licence text for each of these ships inside the app.
      </Text>
      <Text style={[type.body, { color: paper.inkSoft, marginTop: space(3) }]}>
        Daily tutor recordings are synthetic speech generated with ElevenLabs Flash v2.5. The included recordings match your selected tutor and play from the app without a speech API call.
      </Text>
      <View style={{ marginTop: space(6), gap: space(3), paddingBottom: space(6) }}>
        {NOTICES.map((n) => (
          <Card key={n.name}>
            <Label>{n.licence}</Label>
            <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(2) }]}>{n.name}</Text>
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{n.by}</Text>
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{n.note}</Text>
          </Card>
        ))}
      </View>
    </ScrollScreen>
  );
}
