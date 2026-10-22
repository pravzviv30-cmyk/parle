/**
 * The Your French section on a fixed learner, for screenshots (2026-10-22).
 * Developer-only: reached through OnboardingPreview behind the reviewed
 * screen-preview guard. It draws the real `YourFrenchSection` from the real
 * `yourFrenchView`, on the Journey page ground in the asked mode, with the
 * tab's body padding and column, so the card sits as it does on the tab.
 * No account, no storage, and no door opens.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Press } from '../components.tsx';
import { Columns, ScrollScreen } from '../layout.tsx';
import { ModeScope, useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import type { MainMode } from '../main/appearanceModel.ts';
import { YourFrenchSection } from '../journey/JourneyParts.tsx';
import { yourFrenchView } from '../journey/journeyView.ts';
import { yourFrenchFixture, type YourFrenchState } from '../journey/yourFrenchFixtures.ts';
import { HIT, bType, space } from '../theme.ts';

const CAPTIONS: Record<YourFrenchState, string> = {
  full: 'Phrases, sounds and scenes, all open',
  sounds: 'Only a sound that came back clear',
  scenes: 'Only scenes earned on your own',
  forward: 'Practised, with nothing to show yet',
  free: 'Free plan: phrases and sounds locked',
};

const NOTE = 'Preview only. Nothing opens.';

/** `onBack`, when the preview controls are on, returns to the screen list. */
export function YourFrenchPreview({ state, mode, onBack }: { state: YourFrenchState; mode: MainMode; onBack?: () => void }) {
  return (
    <ModeScope mode={mode}>
      <Body state={state} onBack={onBack} />
    </ModeScope>
  );
}

function Body({ state, onBack }: { state: YourFrenchState; onBack?: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const [note, setNote] = useState(false);
  const view = yourFrenchView(yourFrenchFixture(state));
  return (
    <ScrollScreen padded={false}>
      <View style={s.body}>
        <Text style={[bType.meta, { color: t.muted }]}>{`Your French preview. ${CAPTIONS[state]}.`}</Text>
        <Columns>
          <View style={s.page}>
            <YourFrenchSection view={view} onOpen={() => setNote(true)} onTeaser={() => setNote(true)} />
          </View>
          <View style={s.page} />
        </Columns>
        {note && <Text accessibilityLiveRegion="polite" style={[bType.meta, { color: t.muted }]}>{NOTE}</Text>}
        {onBack !== undefined && (
          <Press haptic="light" accessibilityRole="button" accessibilityLabel="Back to the screen preview list" onPress={onBack} style={s.back}>
            <Text style={[bType.bold15, { color: t.link }]}>Back to screen preview</Text>
          </Press>
        )}
      </View>
    </ScrollScreen>
  );
}

// The tab's body (MyFrenchTab makeStyles): padding 24 22, and the page gap.
const makeStyles = (_t: B) =>
  StyleSheet.create({
    body: { paddingTop: space(6), paddingHorizontal: 22, paddingBottom: space(8), gap: space(4) },
    page: { gap: space(7) },
    back: { minHeight: HIT, justifyContent: 'center', alignSelf: 'flex-start' },
  });
