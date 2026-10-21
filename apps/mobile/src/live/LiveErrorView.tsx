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
 *  - The details are there, folded away. "Support details" is for whoever is
 *    helping at eleven at night, is closed by default, and comes after every
 *    way forward, so a learner meets recovery before any network wording.
 *
 * It is the whole window, pushed under `headerShown: false`, so nothing above
 * it pays the safe-area inset. It sits on the still frame for that: the diagnostics
 * panel is thirteen rows tall and used to open straight under the Dynamic Island.
 * The frame pays the notch and the home indicator once, which is why nothing here
 * reads the window for itself.
 */

import { BoldVoiceOrb } from '../onboarding/BoldVoiceOrb.tsx';
import { Transcript } from '../tutor/Transcript.tsx';
import type { TurnLine } from './turns.ts';
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { openPhoneSettings } from '../settings/phoneSettings.ts';
import { space, boldType as type, HIT } from '../theme.ts';
import { useB } from '../main/bTheme.tsx';
import { Screen } from '../layout.tsx';
import { IconAction, Card, Label, PillButton, OutlineButton, Press } from '../components.tsx';
import { failureCopy, type LiveFailure } from './failure.ts';
import type { LiveDiagnostics } from './useLiveSession.ts';

function Row({ name, value }: { name: string; value: string }) {
  const t = useB();
  return (
    <View style={st.row}>
      <Text style={[type.small, { color: t.muted }]}>{name}</Text>
      <Text style={[type.small, { color: t.muted, flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
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
  settlementMessage,
  retryBlocked = false,
  restartAsText = false,
  typedRestartLabel = 'Start a typed conversation',
  onBack,
  onType,
  turns = [],
  tutorName = 'Your tutor',
  transcriptVisible = true,
  onTranscriptVisibility,
}: {
  failure: LiveFailure;
  message: string;
  diagnostics: LiveDiagnostics | null;
  settlementMessage?: string | null;
  retryBlocked?: boolean;
  restartAsText?: boolean;
  typedRestartLabel?: 'Start a typed conversation' | 'Start a typed lesson';
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
  turns?: readonly TurnLine[];
  tutorName?: string;
  transcriptVisible?: boolean;
  onTranscriptVisibility?: (visible: boolean) => void;
}) {
  const t = useB();
  const [open, setOpen] = useState(false);
  const [settingsHelp, setSettingsHelp] = useState(false);
  const copy = failureCopy(failure);
  const canType = copy.canType && onType !== null;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={st.center} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={[type.heading, { color: t.text, textAlign: 'center', marginBottom: 8 }]}>{tutorName === 'Your tutor' ? tutorName : `${tutorName}, your tutor`}</Text>
        <BoldVoiceOrb state="error" size={112} />
        <Text accessibilityLiveRegion="polite" style={[type.small, { color: t.muted, marginTop: 8 }]}>{copy.label}</Text>
        {/* The sentence is the point of this screen, so it reads at body size in
            full ink rather than in the soft grey a caption gets. Words clear
            4.5 against the ground, and a line somebody is meant to act on is
            not a caption (F330). */}
        <Text style={[type.body, { color: t.text, marginTop: space(3), textAlign: 'center' }]}>{message}</Text>
        {turns.length > 0 && <>
          {onTranscriptVisibility && <Press accessibilityRole="button" accessibilityLabel={transcriptVisible ? 'Hide transcript' : 'Show transcript'}
            accessibilityState={{ expanded: transcriptVisible }} aria-expanded={transcriptVisible} onPress={() => onTranscriptVisibility(!transcriptVisible)}
            style={{ minHeight: HIT, justifyContent: 'center', alignItems: 'center' }}><Text style={[type.label, { color: t.link }]}>{transcriptVisible ? 'Hide transcript' : 'Show transcript'}</Text></Press>}
          <View style={{ height: transcriptVisible ? 230 : 0, overflow: 'hidden', opacity: transcriptVisible ? 1 : 0, alignSelf: 'stretch', marginTop: 16 }}
            accessibilityElementsHidden={!transcriptVisible} aria-hidden={!transcriptVisible} importantForAccessibility={transcriptVisible ? 'auto' : 'no-hide-descendants'}>
          <Transcript turns={turns} tutorName={tutorName} tutorSpeaking={false} />
          </View>
        </>}
        {settlementMessage ? <Text accessibilityLiveRegion="polite" style={[type.body, { color: t.text, marginTop: space(3), textAlign: 'center' }]}>{settlementMessage}</Text> : null}

        {canType ? (
          <>
            <View style={st.action}>
              {restartAsText ? <PillButton label={typedRestartLabel} onPress={onType} disabled={retryBlocked} />
                : <PillButton label="Continue by typing" onPress={onType} disabled={retryBlocked} />}
            </View>
            <View style={st.secondary}>
              <IconAction layout="inline" icon="back" label="Back" onPress={onBack} />
            </View>
          </>
        ) : (
          <View style={st.action}>
            <PillButton label="Back" onPress={onBack} />
          </View>
        )}

        {failure.startsWith('mic-') && <View style={st.secondary}>
          <IconAction layout="inline" icon="settings" label="Check microphone settings" onPress={() => {
            setSettingsHelp(true);
            void openPhoneSettings();
          }} />
          {settingsHelp && <Text accessibilityLiveRegion="polite" style={[type.small, { color: t.muted, textAlign: 'center' }]}>{Platform.OS === 'web' ? 'Open this site’s permissions beside the address bar and allow the microphone. Close other apps using it, then return and start a spoken conversation.' : 'Allow microphone access for Luvani in Settings, then return and start a spoken conversation.'}</Text>}
        </View>}

        {/* Support details: the technical rows are for whoever is helping, so
            they are folded away, closed by default, and drawn after every way
            forward (whole-app Stage 3A). */}
        {diagnostics ? (
          <View style={st.diagnostics}>
            <Pressable
              onPress={() => setOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={open ? 'Hide support details' : 'Show support details'}
              accessibilityState={{ expanded: open }}
              style={({ pressed }) => [st.disclosure, pressed && { opacity: 0.6 }]}
            >
              <Text style={[type.small, { color: t.muted }]}>{open ? 'Hide support details' : 'Support details'}</Text>
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
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  center: { flexGrow: 1, width: '100%', alignItems: 'center', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 20 },
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
