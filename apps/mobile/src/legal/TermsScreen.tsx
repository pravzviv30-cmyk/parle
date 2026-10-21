/**
 * Luvani's eligibility declaration, followed by Apple's standard app licence.
 *
 * Apple requires terms of use for an app selling an auto renewing subscription
 * (Guideline 3.1.2(c)) and offers its own standard licence for apps that have
 * not written their own. This screen adds Luvani's minimum-age declaration
 * and offers the full licence at the address Apple publishes it at.
 *
 * Nothing of Apple's document is copied in. It is theirs, it is long, and a copy
 * inside the app is a copy that goes stale the first time they revise it, which
 * is the same drift `scripts/legal-html.mjs` exists to prevent on our own words.
 *
 * ## The one outward link in the app
 *
 * `settings/links.ts` opens it, in an in-app browser sheet rather than by
 * handing the phone to Safari, so a learner reading terms can close the sheet
 * and still be where they were. The URL is a constant in `legal/terms.ts`, never
 * built here and never taken from anything a server sent.
 *
 * A phone that will not open it says so and the row can be tapped again, because
 * a control that silently does nothing is the dead switch F239 refused.
 *
 * Same frame and same in-place opening as `Acknowledgements.tsx` and
 * `PolicyScreen.tsx`: it answers Android's hardware back itself, and Settings
 * stands its own hook down while this is up (F319). Nothing here caps a reading
 * size or clips a line.
 */

import { useState } from 'react';
import { View, Text } from 'react-native';
import { paper, space, type } from '../theme.ts';
import { Card, OutlineButton } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { openLink } from '../settings/links.ts';
import { LINK_TROUBLE } from '../settings/sections.ts';
import { APPLE_EULA_URL, TERMS_BODY, TERMS_LINK_LABEL, TERMS_TITLE } from './terms.ts';
import { c, boldType } from '../onboarding/boldRhythm.ts';
import { useB } from '../main/bTheme.tsx';

export function TermsScreen({ onBack }: { onBack: () => void }) {
  const t = useB();
  const [trouble, setTrouble] = useState<string | null>(null);
  useHardwareBack(true, onBack);
  return (
    <ScrollScreen ground={c.paper} header={<ScreenHeader back={{ onPress: onBack }} />}>
      <Text accessibilityRole="header" style={[boldType.title, { color: t.text }]}>
        {TERMS_TITLE}
      </Text>
      <View style={{ marginTop: space(6), paddingBottom: space(6) }}>
        <Card style={{ backgroundColor: t.lavender, borderRadius: 24 }}>
          {TERMS_BODY.map((paragraph, index) => (
            <Text
              key={`terms:${index}`}
              style={[boldType.body, { color: t.text, marginTop: index === 0 ? 0 : space(3) }]}
            >
              {paragraph}
            </Text>
          ))}
        </Card>
        {trouble === null ? null : (
          <Text
            accessibilityLiveRegion="polite"
            style={[type.small, { color: t.text, marginTop: space(4) }]}
          >
            {trouble}
          </Text>
        )}
        <View style={{ marginTop: space(6) }}>
          <OutlineButton
            label={TERMS_LINK_LABEL}
            onPress={() => {
              setTrouble(null);
              void openLink(APPLE_EULA_URL).then((outcome) => {
                if (outcome === 'failed') setTrouble(LINK_TROUBLE);
              });
            }}
          />
        </View>
      </View>
    </ScrollScreen>
  );
}
