/**
 * The privacy notice, read inside the app.
 *
 * Apple asks for the policy to be reachable in the app as well as at a URL in
 * the store listing (Guideline 5.1.1(i)), and the app carried neither: only a
 * paragraph in a footer. This is the screen half of that. Every word comes from
 * `legal/policy.ts`, which is assembled from `docs/PRIVACY_AND_SAFETY.md` and
 * rendered by `scripts/legal-html.mjs` into the hosted page as well, so what is
 * read here, what is read at the URL and what the code actually does cannot
 * drift apart.
 *
 * The same shape as `Acknowledgements.tsx`: it opens in place from Settings
 * rather than as a stack route, so it answers Android's hardware back itself and
 * takes its frame from the shared `ScrollScreen`. Settings stands its own hook
 * down while this is up, which is F319's rule.
 *
 * ## This is the longest thing in the app, so nothing may clip it
 *
 * A privacy notice that cannot be read to the end is a privacy notice that has
 * not been given. So there is no `numberOfLines` anywhere on this screen, no
 * `maxWidth`, no `adjustsFontSizeToFit` and no `maxFontSizeMultiplier`: every
 * line wraps and the column grows.
 *
 * There is also deliberately no `flexGrow: 1` wrapper around the sections. That
 * is not a style preference. `MyFrenchTab` has one inside its `ScrollScreen` and
 * at the largest reading size the whole tab below the subtitle disappears and
 * the screen will not scroll past it, which is open defect F383. The frame's own
 * ScrollView already carries the `flexGrow` that keeps a short page filling the
 * column; a second one inside it is the bug. This screen puts its sections
 * straight into the scroll body with nothing between.
 *
 * ## Headings are text, not labels
 *
 * `Label` is the caps style, and caps at 11.5pt is right for two words above a
 * card and wrong for a heading somebody is scanning a document by. These are set
 * in `type.heading` in full ink, which is the size and weight a section title
 * gets everywhere else in this app.
 */

import { View, Text } from 'react-native';
import { paper, space, type } from '../theme.ts';
import { Card } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { POLICY_INTRO, POLICY_SECTIONS, POLICY_TITLE } from './policy.ts';

export function PolicyScreen({ onBack }: { onBack: () => void }) {
  // Opened in place, so Android's hardware back closes it rather than popping
  // whatever pushed Settings.
  useHardwareBack(true, onBack);
  return (
    <ScrollScreen header={<ScreenHeader back={{ onPress: onBack }} />}>
      <Text accessibilityRole="header" style={[type.display, { color: paper.ink }]}>
        {POLICY_TITLE}
      </Text>
      <Text style={[type.body, { color: paper.inkSoft, marginTop: space(3) }]}>{POLICY_INTRO}</Text>
      <View style={{ marginTop: space(6), gap: space(3), paddingBottom: space(6) }}>
        {POLICY_SECTIONS.map((section) => (
          <Card key={section.heading}>
            <Text accessibilityRole="header" style={[type.heading, { color: paper.ink }]}>
              {section.heading}
            </Text>
            {/* Keyed by position within its section rather than by its own
                text: two paragraphs in one notice may legitimately say the same
                sentence, and a duplicate key would drop one of them silently. */}
            {section.body.map((paragraph, index) => (
              <Text
                key={`${section.heading}:${index}`}
                style={[type.body, { color: paper.inkSoft, marginTop: space(3) }]}
              >
                {paragraph}
              </Text>
            ))}
          </Card>
        ))}
      </View>
    </ScrollScreen>
  );
}
