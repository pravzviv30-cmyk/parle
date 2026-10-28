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
import { ProgressSection, YourFrenchSection } from '../journey/JourneyParts.tsx';
import { progressRowsView, yourFrenchView } from '../journey/journeyView.ts';
import { progressFixture, type ProgressState } from '../journey/progressFixtures.ts';
import { yourFrenchFixture, type YourFrenchState } from '../journey/yourFrenchFixtures.ts';
import { HIT, bType, space } from '../theme.ts';

const CAPTIONS: Record<YourFrenchState, string> = {
  full: 'Phrases, sounds and scenes, all open',
  sounds: 'Only a sound that came back clear',
  scenes: 'Only scenes earned on your own',
  forward: 'Practised, with nothing to show yet',
  free: 'Free plan: phrases and sounds locked',
};

const PROGRESS_CAPTIONS: Record<ProgressState, string> = {
  both: 'Getting better at and Needs another go',
  better: 'Only Getting better at',
  again: 'Only Needs another go',
  free: 'Free plan: the section locked',
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

/**
 * "How it’s going" on a fixed learner (2026-10-28, LEARN-013), drawn by the
 * real `ProgressSection` from the real `progressRowsView`, in the same frame.
 */
export function HowItsGoingPreview({ state, mode, onBack }: { state: ProgressState; mode: MainMode; onBack?: () => void }) {
  return (
    <ModeScope mode={mode}>
      <Body progress={state} onBack={onBack} />
    </ModeScope>
  );
}

function Body({ state, progress, onBack }: { state?: YourFrenchState; progress?: ProgressState; onBack?: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const [note, setNote] = useState(false);
  const view = state === undefined ? null : yourFrenchView(yourFrenchFixture(state));
  const going = progress === undefined ? null : progressRowsView(progressFixture(progress));
  const caption = state !== undefined ? `Your French preview. ${CAPTIONS[state]}.` : `How it’s going preview. ${PROGRESS_CAPTIONS[progress!]}.`;
  return (
    <ScrollScreen padded={false}>
      <View style={s.body}>
        <Text style={[bType.meta, { color: t.muted }]}>{caption}</Text>
        <Columns>
          <View style={s.page}>
            {view !== null && <YourFrenchSection view={view} onOpen={() => setNote(true)} onTeaser={() => setNote(true)} />}
            {going !== null && <ProgressSection view={going} onOpen={() => setNote(true)} onTeaser={() => setNote(true)} />}
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
