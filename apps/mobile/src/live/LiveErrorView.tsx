/**
 * The one screen every live-session failure lands on.
 *
 * Shared by the lesson and the conversation so the two paths cannot drift into
 * saying different things about the same fault. Three rules, all of them fixed
 * by what went wrong before this existed:
 *
 *  - Always a door. Every failure renders Back, and a microphone failure also
 *    renders "Continue by typing", because the tutor is the same tutor typed.
 *  - Never a shrug. The sentence comes from the failure taxonomy, not from
 *    whatever string an exception happened to carry.
 *  - The details are there, folded away. "What happened?" is for whoever is
 *    debugging this at eleven at night, and is closed for everyone else.
 *
 * It is the whole window, pushed under `headerShown: false`, so nothing above
 * it pays the safe-area inset. It sits on the still frame for that: the diagnostics
 * panel is thirteen rows tall and used to open straight under the Dynamic Island.
 * The frame pays the notch and the home indicator once, which is why nothing here
 * reads the window for itself.
 */

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { paper, space, type, HIT } from '../theme.ts';
import { Screen } from '../layout.tsx';
import { Card, Label, PillButton, OutlineButton, GhostButton } from '../components.tsx';
import { failureCopy, type LiveFailure } from './failure.ts';
import type { LiveDiagnostics } from './useLiveSession.ts';

function Row({ name, value }: { name: string; value: string }) {
  return (
    <View style={st.row}>
      <Text style={[type.small, { color: paper.inkSoft }]}>{name}</Text>
      <Text style={[type.small, { color: paper.inkSoft, flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

function show(value: string | number | boolean | null): string {
  if (value === null) return 'not reached';
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return String(value);
}

export function LiveErrorView({
  failure,
  message,
  diagnostics,
  onBack,
  onType,
}: {
  failure: LiveFailure;
  message: string;
  diagnostics: LiveDiagnostics | null;
  /**
   * Leave. Both live screens hand this their own `leaveNow`, because a blocking
   * failure that keeps a typed door open also keeps the ROOM open for it, and
   * walking away from an open room leaves a meter running behind a dead screen.
   */
  onBack: () => void;
  /**
   * The typed door, or null where this failure has none.
   *
   * Required and explicitly nullable rather than optional, and that is the
   * whole point of the type. Four failures say in their own sentence that the
   * learner can keep going by typing, and the button under them is drawn only
   * when this is a function — so a screen that simply forgot the prop rendered
   * the promise with nothing to press and nothing anywhere could tell. Both
   * callers compute it from `typedDoorFor`, which is the one rule about when
   * the offer is real.
   */
  onType: (() => void) | null;
}) {
  const [open, setOpen] = useState(false);
  const copy = failureCopy(failure);
  const canType = copy.canType && onType !== null;

  return (
    <Screen padded={false}>
      <View style={st.center}>
        <Label color={paper.inkSoft}>{copy.label}</Label>
        {/* The sentence is the point of this screen, so it reads at body size in
            full ink rather than in the soft grey a caption gets. Words clear
            4.5 against the ground, and a line somebody is meant to act on is
            not a caption (F330). */}
        <Text style={[type.body, { color: paper.ink, marginTop: space(3), textAlign: 'center' }]}>{message}</Text>

        {canType ? (
          <>
            <View style={st.action}>
              <PillButton label="Continue by typing" onPress={onType} />
            </View>
            <View style={st.secondary}>
              <GhostButton label="Back" onPress={onBack} />
            </View>
          </>
        ) : (
          <View style={st.action}>
            <OutlineButton label="Back" onPress={onBack} />
          </View>
        )}

        {diagnostics ? (
          <View style={st.diagnostics}>
            <Pressable
              onPress={() => setOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={open ? 'Hide the details' : 'Show what happened'}
              accessibilityState={{ expanded: open }}
              style={({ pressed }) => [st.disclosure, pressed && { opacity: 0.6 }]}
            >
              <Text style={[type.small, { color: paper.inkSoft }]}>{open ? 'Hide details' : 'What happened?'}</Text>
            </Pressable>
            {open ? (
              <Card style={st.panel}>
                <Row name="Cause" value={failure} />
                <Row name="Token server" value={diagnostics.tokenServer} />
                <Row name="Token reply" value={show(diagnostics.tokenStatus)} />
                <Row name="Auth headers" value={diagnostics.authMs === null ? 'not reached' : `${diagnostics.authMs} ms`} />
                <Row name="Session token" value={diagnostics.tokenMs === null ? 'not reached' : `${diagnostics.tokenMs} ms`} />
                <Row name="Server phases" value={show(diagnostics.tokenServerTiming)} />
                <Row name="Room service" value={show(diagnostics.livekitUrl)} />
                <Row name="Connected in" value={diagnostics.connectMs === null ? 'not reached' : `${diagnostics.connectMs} ms`} />
                <Row name="Microphone published" value={show(diagnostics.micPublished)} />
                <Row name="Tutor joined the room" value={show(diagnostics.agentJoined)} />
                <Row name="Tutor audio arrived" value={show(diagnostics.audioTrackSubscribed)} />
                <Row name="Tutor sent anything" value={show(diagnostics.firstServerMessage)} />
                <Row name="Session actually opened" value={show(diagnostics.sessionOpened)} />
              </Card>
            ) : null}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(8) },
  action: { marginTop: space(6), alignSelf: 'stretch' },
  secondary: { marginTop: space(2), alignSelf: 'stretch' },
  diagnostics: { marginTop: space(7), alignSelf: 'stretch' },
  disclosure: { minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
  // The shared card: same white, same corners, same one whisper. It was a hand
  // rolled copy of Card's own rule, which is how two cards in one app end up a
  // point apart.
  panel: { paddingHorizontal: space(4), paddingVertical: space(3), gap: space(2) },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space(4) },
});
