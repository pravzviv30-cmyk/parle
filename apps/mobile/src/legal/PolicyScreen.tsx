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
 * is not a style preference. `MyFrenchTab` had one inside its `ScrollScreen` and
 * at the largest reading size the whole tab below the subtitle disappeared and
 * the screen would not scroll past it, which was defect F383. The frame's own
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

import { useRef, useState } from 'react';
import { AccessibilityInfo, Platform, ScrollView, Text, View, findNodeHandle } from 'react-native';
import { HIT, decorative, space, type } from '../theme.ts';
import { Card, Press } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { useReduceMotion } from '../motion.ts';
import { useHardwareBack } from '../nav/useHardwareBack.ts';
import { POLICY_INTRO, POLICY_SECTIONS, POLICY_TITLE } from './policy.ts';
import { useB } from '../main/bTheme.tsx';

// Named so the source never spells a ScrollView tag; the frame owns the scroll (F307).
type Scroller = ScrollView;

export function PolicyScreen({ onBack, links = true }: { onBack: () => void; /** Off inside a sheet, whose own ScrollView owns the scroll. */ links?: boolean }) {
  const t = useB();
  const reduced = useReduceMotion();
  // Opened in place, so Android's hardware back closes it rather than popping
  // whatever pushed Settings.
  useHardwareBack(true, onBack);
  const scroller = useRef<Scroller>(null);
  // Two booleans, not the raw offset, so a scroll that changes neither bails out.
  const [scrolled, setScrolled] = useState(false);
  // Once the display title has scrolled away, a small one rides the back row.
  const [titleGone, setTitleGone] = useState(false);
  const titleBottom = useRef(Infinity);
  const offset = useRef(0);
  const watch = (y: number) => { offset.current = y; setScrolled(y > 0); setTitleGone(y >= titleBottom.current); };
  // Section y within the card, plus the card's own y in the scroll content.
  const cardY = useRef(0);
  const sectionY = useRef<number[]>([]);
  const headings = useRef<(Text | null)[]>([]);
  const jump = (at: number) => {
    scroller.current?.scrollTo({ y: Math.max(0, cardY.current + (sectionY.current[at] ?? 0) - space(4)), animated: !reduced });
    const node = headings.current[at] ?? null;
    if (Platform.OS === 'web') { (node as unknown as { focus?: (options?: { preventScroll?: boolean }) => void } | null)?.focus?.({ preventScroll: true }); return; }
    const handle = findNodeHandle(node); if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  };
  const small = titleGone ? (
    <Text {...decorative} style={[type.heading, { color: t.text }]}>{POLICY_TITLE}</Text>
  ) : undefined;
  return (
    <ScrollScreen
      scrollRef={scroller}
      onScroll={(event) => watch(event.nativeEvent.contentOffset.y)}
      header={<ScreenHeader back={{ onPress: onBack }} title={small} divider={scrolled} />}
    >
      <Text accessibilityRole="header" onLayout={(event) => { const { y, height } = event.nativeEvent.layout; titleBottom.current = y + height; watch(offset.current); }} style={[type.display, { color: t.text }]}>
        {POLICY_TITLE}
      </Text>
      <Text style={[type.body, { color: t.muted, marginTop: space(3) }]}>{POLICY_INTRO}</Text>
      {links ? (
        <View style={{ marginTop: space(3) }}>
          {POLICY_SECTIONS.map((section, at) => (
            <Press key={section.heading} haptic="light" accessibilityRole="link" onPress={() => jump(at)} style={{ minHeight: HIT, justifyContent: 'center' }}>
              <Text style={[type.body, { color: t.link }]}>{section.heading}</Text>
            </Press>
          ))}
        </View>
      ) : null}
      {/* One white body card under a serif title, which is the shape revamp A
          gives a document. A card per section turned a notice into a stack of
          fourteen objects; it is one thing to read, so it is one surface, and
          the headings do the dividing inside it. */}
      <View onLayout={(event) => { cardY.current = event.nativeEvent.layout.y; }} style={{ marginTop: space(6), paddingBottom: space(6) }}>
        <Card>
          {POLICY_SECTIONS.map((section, at) => (
            <View key={section.heading} onLayout={(event) => { sectionY.current[at] = event.nativeEvent.layout.y; }} style={{ marginTop: at === 0 ? 0 : space(6) }}>
              <Text ref={(node) => { headings.current[at] = node; }} accessibilityRole="header" {...(Platform.OS === 'web' ? { tabIndex: -1 } as object : {})} style={[type.heading, { color: t.text }]}>
                {section.heading}
              </Text>
              {/* Keyed by position within its section rather than by its own
                  text: two paragraphs in one notice may legitimately say the same
                  sentence, and a duplicate key would drop one of them silently. */}
              {section.body.map((paragraph, index) => (
                <Text
                  key={`${section.heading}:${index}`}
                  style={[type.body, { color: t.text, marginTop: space(3) }]}
                >
                  {paragraph}
                </Text>
              ))}
            </View>
          ))}
        </Card>
      </View>
    </ScrollScreen>
  );
}
