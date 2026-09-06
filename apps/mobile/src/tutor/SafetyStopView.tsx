/**
 * The two surfaces a safety decision can take.
 *
 * `SafetyStopView` is the whole screen and the end of the session.
 * `SafetyBanner` is a line that stays until the learner puts it away.
 *
 * Shared by the lesson and the conversation, the way `live/LiveErrorView.tsx`
 * is, so the two paths cannot drift into handling the same decision two
 * different ways. What each one says comes from `safetyView.ts`; this file is
 * layout and nothing else.
 *
 * Nothing here carries a signal colour. Green, amber and red are the voice
 * circle's three words and they mean "your turn", "thinking" and "the tutor is
 * speaking"; a fourth meaning on any of them would make the whole grammar
 * unreliable. The four rung colours are out for the same reason. So this is the
 * app's ordinary calm: house paper, ink words, one violet pill. A stop is
 * serious because of what it says, not because of what colour it is.
 */

import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { paper, space, type, radius, HAIRLINE } from '../theme.ts';
import { ScrollScreen } from '../layout.tsx';
import { GhostButton, PillButton } from '../components.tsx';
import type { SafetySurface } from './safetyView.ts';

/**
 * Read the surface out to a screen reader when it appears.
 *
 * `accessibilityLiveRegion` is Android and web only, so the one thing that must
 * never be missed cannot rely on it alone. This is the same pattern
 * `ReviewScreen` uses for the answer that appears without focus moving.
 */
function useAnnounced(announce: string | null, politeness: 'polite' | 'assertive'): void {
  useEffect(() => {
    if (announce === null) return;
    AccessibilityInfo.announceForAccessibility(announce);
    // The politeness is in the deps so a surface that changes urgency is said
    // again, which only happens if a redirect is followed by a stop.
  }, [announce, politeness]);
}

/**
 * The session is over, and this is the entire screen.
 *
 * It is returned before the connecting spinner, before the error view and
 * before the recap on both live screens. That ordering is the feature: a stop
 * is usually followed by the agent leaving the room, which the hook reads as a
 * dropped connection, and an error screen replacing this one would take the
 * emergency number off the screen a second after it arrived.
 *
 * One primary action, and it is the way out. There is deliberately nothing here
 * to carry on with.
 *
 * It is the whole window on a route with no system chrome, so it sits on the
 * shared frame: the notch and the home indicator are paid once, in `layout.tsx`,
 * rather than measured again here.
 */
export function SafetyStopView({
  surface,
  onClose,
}: {
  surface: Extract<SafetySurface, { kind: 'stop' }>;
  onClose: () => void;
}) {
  useAnnounced(surface.announce, surface.politeness);

  // The scrolling frame, because this is the one screen in the app whose words a
  // learner must be able to read at any reading size, and the message is the
  // longest sentence the tutor ever sends. `center` pins a short stop to the
  // middle the way this screen always drew it, and the frame pays the notch and
  // the home indicator, which nothing above a pushed route does. Its own pad
  // stays at space(8) horizontal: the frame's space(5) is the tab measure, and a
  // crisis sentence wants the narrower column.
  return (
    <ScrollScreen padded={false} center>
      <View style={st.body}>
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion={surface.politeness}
          accessibilityLabel={surface.announce}
        >
          <Text style={[type.title, { color: paper.ink, textAlign: 'center' }]}>{surface.message}</Text>
          <Text style={[type.body, { color: paper.inkSoft, textAlign: 'center', marginTop: space(4) }]}>
            {surface.ended}
          </Text>
        </View>

        <View style={st.action}>
          <PillButton label={surface.buttonLabel} onPress={onClose} />
        </View>
      </View>
    </ScrollScreen>
  );
}

/**
 * The tutor steered away, and said why.
 *
 * It stays until it is dismissed. No timer: the eight-second notice belongs to
 * a voice outage, and a learner reading a second language is exactly the
 * learner a self-clearing sentence fails.
 *
 * A card rather than a full screen, because a redirect does not end anything.
 * The scene is still underneath it and the learner still has the floor.
 */
export function SafetyBanner({
  surface,
  onDismiss,
}: {
  surface: Extract<SafetySurface, { kind: 'redirect' }>;
  onDismiss: () => void;
}) {
  useAnnounced(surface.announce, surface.politeness);

  return (
    <View style={st.banner}>
      {/* The words and the way past them are siblings, not nested. A container
          that carries the label and the button together reads as one object on
          the web, and the button a learner has to find goes with it. */}
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion={surface.politeness}
        accessibilityLabel={surface.announce}
      >
        <Text style={[type.body, { color: paper.ink }]}>{surface.message}</Text>
      </View>
      <View style={st.bannerAction}>
        <GhostButton label={surface.buttonLabel} onPress={onDismiss} color={paper.ink} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  body: { paddingHorizontal: space(8), paddingVertical: space(4) },
  action: { marginTop: space(8), alignSelf: 'stretch' },
  banner: {
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.card,
    paddingHorizontal: space(4),
    paddingTop: space(3),
    paddingBottom: space(1),
    marginBottom: space(3),
  },
  bannerAction: { alignSelf: 'flex-end' },
});
