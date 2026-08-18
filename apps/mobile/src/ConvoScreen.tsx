/**
 * The free-conversation driver and surface.
 *
 * The convo sibling of LiveSessionScreen: connect on mount, publish the
 * microphone, render whatever the agent says to render. Everything pedagogical —
 * the scene, the coaching, when support appears, when the recap is due — happens
 * in the agent's brain; this screen is deliberately unable to disagree with it.
 *
 * What is deliberately absent compared to the lesson surface: no rung row (a
 * conversation is not a ladder), no numeric position (mid-session copy carries
 * no numbers — the station line alone gives the sense of moving through beats).
 */

import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RecapPayload } from '@parle/core';
import { paper, signal, space, type, radius, HAIRLINE, HIT } from './theme.ts';
import {
  Card,
  Label,
  PillButton,
  GhostButton,
  OptionCard,
  StationLine,
  EarGlyph,
  HelpGlyph,
  fitDisplay,
} from './components.tsx';
import { SupportBlock } from './SessionView.tsx';
import { RecapScreen } from './RecapScreen.tsx';
import { mergeExercises } from './drill/store.ts';
import { useLiveSession } from './live/useLiveSession.ts';
import { LiveErrorView } from './live/LiveErrorView.tsx';
import { VoiceOrb, type OrbState } from './tutor/VoiceOrb.tsx';
import { Transcript } from './tutor/Transcript.tsx';

export function ConvoScreen({
  userId,
  snapshot,
  onRecap,
  onExit,
  startInTextMode = false,
}: {
  userId: string;
  /** The stored learner model, passed through to the agent opaquely. */
  snapshot: unknown;
  /** The conversation ended: here is the end card and the updated model. */
  onRecap: (recap: RecapPayload, profileBlob: unknown) => void;
  onExit: () => void;
  /** "Can't speak right now": the same tutor, typed. */
  startInTextMode?: boolean;
}) {
  const insets = useSafeAreaInsets();
  // Text mode is a session property, not a toggle: switching rebuilds the
  // session (the agent must open voiceless). It flips exactly once, from the
  // denied-microphone screen.
  const [textMode, setTextMode] = useState(startInTextMode);
  const [draft, setDraft] = useState('');
  // Which text input holds the caret, for the ink focus border. Visual only.
  const [focusedInput, setFocusedInput] = useState<'topic' | 'reply' | null>(null);
  const live = useLiveSession(userId, 'convo-01', undefined, { mode: textMode ? 'convo-text' : 'convo', snapshot });

  // Connect on mount, and again when the learner switches to text mode after
  // a denied microphone. The hook tears the room down on unmount.
  useEffect(() => {
    void live.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textMode]);

  const sendDraft = () => {
    const text = draft.trim();
    if (text.length === 0) return;
    setDraft('');
    live.sendSay(text);
  };

  // The recap renders here, not on a separate screen: the room must outlive
  // the end card, because the agent's background work — the enriched profile
  // and tonight's generated drills — arrives seconds AFTER the recap, and a
  // torn-down room would lose both. onRecap persists; it no longer navigates.
  useEffect(() => {
    if (live.recap) onRecap(live.recap.recap, live.recap.profile);
  }, [live.recap, onRecap]);

  useEffect(() => {
    if (live.drills) void mergeExercises(live.drills);
  }, [live.drills]);

  const leaveNow = () => {
    void live.leave().finally(onExit);
  };

  if (live.recap) {
    return <RecapScreen recap={live.recap.recap} onDone={leaveNow} />;
  }

  if (live.status.phase === 'connecting' || live.status.phase === 'idle') {
    return (
      <View style={st.center}>
        <ActivityIndicator color={paper.inkSoft} />
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(3) }]}>Reaching the server…</Text>
      </View>
    );
  }

  if (live.status.phase === 'out-of-minutes') {
    return (
      <View style={st.center}>
        <Label color={paper.inkFaint}>You are out of minutes</Label>
        <Text style={[type.title, { color: paper.ink, marginTop: space(3), textAlign: 'center' }]}>
          {live.status.message}
        </Text>
        <View style={st.terminalAction}>
          <PillButton label="Back" onPress={onExit} />
        </View>
      </View>
    );
  }

  if (live.status.phase === 'error') {
    // A microphone problem is a situation, not a dead end: the same tutor, the
    // same scene, typed instead of spoken. Which failures those are is the
    // taxonomy's business now, rather than a regex over the rendered sentence.
    // Already typing means typing is no longer an offer worth making.
    return (
      <LiveErrorView
        failure={live.status.failure}
        message={live.status.message}
        diagnostics={live.diagnostics}
        onBack={onExit}
        onType={textMode ? undefined : () => setTextMode(true)}
      />
    );
  }

  const view = live.convo;

  // The choosing moment: the tutor has asked what to talk about and these
  // chips are the answers a learner with no words yet can still give. Speaking
  // works identically; the first scene view replaces all of this.
  if (!view && live.topics) {
    return (
      <View style={[st.root, { paddingTop: insets.top + space(2), paddingBottom: insets.bottom + space(2) }]}>
        <View style={st.headerRow}>
          <Label>Free talk</Label>
          <Pressable
            onPress={leaveNow}
            accessibilityRole="button"
            accessibilityLabel="Leave the conversation"
            style={({ pressed }) => [st.leave, pressed && { opacity: 0.6 }]}
          >
            <Text style={[type.bodyStrong, { color: paper.inkSoft }]}>Leave</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={st.chooseScroll} showsVerticalScrollIndicator={false}>
          <Text style={[fitDisplay(live.topics.prompt.fr), { color: paper.ink, textAlign: 'center' }]}>
            {live.topics.prompt.fr}
          </Text>
          <Text style={[type.body, { color: paper.inkSoft, textAlign: 'center', marginTop: space(1.5) }]}>
            {live.topics.prompt.en}
          </Text>
          <View style={{ marginTop: space(5), gap: space(2.5), alignSelf: 'stretch' }}>
            {live.topics.chips.map((chip) => (
              <OptionCard key={chip.value} text={chip.label} gloss={chip.en} onPress={() => live.sendTopic(chip.value)} />
            ))}
          </View>
          {textMode ? (
            <View style={[st.typeRow, { marginTop: space(4) }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={sendDraft}
                placeholder="Or type your own"
                placeholderTextColor={paper.inkFaint}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                submitBehavior="submit"
                accessibilityLabel="Type what you want to talk about"
                onFocus={() => setFocusedInput('topic')}
                onBlur={() => setFocusedInput(null)}
                style={[st.typeInput, focusedInput === 'topic' && st.typeInputFocused]}
              />
              <Pressable
                onPress={sendDraft}
                accessibilityRole="button"
                accessibilityLabel="Send your topic"
                style={({ pressed }) => [st.typeSend, pressed && { opacity: 0.88 }]}
              >
                <Text style={[type.button, { color: paper.onInk }]}>Send</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[type.small, { color: paper.inkFaint, textAlign: 'center', marginTop: space(4) }]}>
              Or just say it out loud.
            </Text>
          )}
        </ScrollView>
      </View>
    );
  }

  if (!view) {
    // An open room and a silent tutor. The hook's watchdog ends this state one
    // way or the other; until it does there are words and a door, which is
    // exactly what a down agent used to look like without either.
    return (
      <View style={st.center}>
        <ActivityIndicator color={paper.inkSoft} />
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(3) }]}>
          {live.waitingForTutor ? 'Waiting for your tutor…' : 'One moment…'}
        </Text>
        <View style={st.terminalAction}>
          <GhostButton label="Leave" onPress={leaveNow} />
        </View>
      </View>
    );
  }

  const listening = !live.tutorSpeaking;
  // The orb says one thing at a time, and thinking outranks everything: the
  // learner has just spoken and nothing has come back yet.
  const orbState: OrbState = live.thinking
    ? 'thinking'
    : live.tutorSpeaking
      ? 'speaking'
      : textMode
        ? 'idle'
        : 'listening';

  return (
    <View style={st.shell}>
      {live.audioBlocked && (
        // The browser wants a gesture before it will play the tutor. One calm
        // white notice, gone the moment it is tapped.
        <Pressable
          onPress={live.resumeAudio}
          accessibilityRole="button"
          style={({ pressed }) => [st.listen, pressed && { opacity: 0.85 }]}
        >
          <Card style={{ alignItems: 'center' }}>
            <Label color={paper.ink}>Tap to listen</Label>
          </Card>
        </Pressable>
      )}

      <View style={[st.root, { paddingTop: insets.top + space(2), paddingBottom: insets.bottom + space(2) }]}>
        <View style={st.header}>
          <View style={st.headerRow}>
            <Label>Free talk</Label>
            {/* Metered minutes must always have a door. Leaving ends the scene
                early and still delivers the recap the session has earned. */}
            <Pressable
              onPress={leaveNow}
              accessibilityRole="button"
              accessibilityLabel="Leave the conversation"
              style={({ pressed }) => [st.leave, pressed && { opacity: 0.6 }]}
            >
              <Text style={[type.bodyStrong, { color: paper.inkSoft }]}>Leave</Text>
            </Pressable>
          </View>
          <View style={{ marginTop: space(2) }}>
            <StationLine total={view.beat.total} index={view.beat.position - 1} />
          </View>
        </View>

        {/* The tutor, as an object. Toward the top, and the only thing on the
            screen that moves. */}
        <View style={st.orbBlock}>
          <VoiceOrb state={orbState} />
        </View>

        {live.notice ? (
          <View style={st.notice}>
            <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>{live.notice}</Text>
          </View>
        ) : null}

        {/* The conversation so far. Takes what is left and no more — the
            current turn's support and controls below it are what the learner
            is acting on. */}
        <Transcript turns={live.turns} />

        <View style={st.support}>
          <SupportBlock
            support={view.supportView}
            // Replays come from the agent in the premium voice, and only while
            // the learner holds the floor — a replay must not talk over the
            // tutor. Text mode has no voice to replay.
            onHearLine={listening && !textMode ? live.sendHear : undefined}
          />
        </View>

        <View style={st.controls}>
          {/* The recast now renders in the thread, attached to the line it
              corrects, so only the spoken coaching line belongs here. */}
          {view.coachLine ? (
            <Text style={[type.bodyStrong, { color: paper.ink, textAlign: 'center', marginBottom: space(2) }]}>
              {view.coachLine}
            </Text>
          ) : null}

          {textMode ? (
            <View style={st.typeRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={sendDraft}
                placeholder="Type your reply"
                placeholderTextColor={paper.inkFaint}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                submitBehavior="submit"
                accessibilityLabel="Type your reply"
                onFocus={() => setFocusedInput('reply')}
                onBlur={() => setFocusedInput(null)}
                style={[st.typeInput, focusedInput === 'reply' && st.typeInputFocused]}
              />
              <Pressable
                onPress={sendDraft}
                accessibilityRole="button"
                accessibilityLabel="Send your reply"
                style={({ pressed }) => [st.typeSend, pressed && { opacity: 0.88 }]}
              >
                <Text style={[type.button, { color: paper.onInk }]}>Send</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={st.helpRow}>
            <Pressable
              onPress={live.sendHelp}
              disabled={!listening}
              accessibilityRole="button"
              accessibilityLabel="Ask for help with this line"
              style={({ pressed }) => [st.helpItem, pressed && { opacity: 0.6 }]}
            >
              <HelpGlyph size={15} />
              <Text style={[type.small, { color: paper.inkSoft }]}>Help me out</Text>
            </Pressable>
            {!textMode ? (
              <>
                <Pressable
                  onPress={live.sendSlower}
                  disabled={!listening}
                  accessibilityRole="button"
                  accessibilityLabel="Ask the tutor to slow down"
                  style={({ pressed }) => [st.helpItem, pressed && { opacity: 0.6 }]}
                >
                  <Text style={[type.small, { color: paper.inkSoft }]}>Slower</Text>
                </Pressable>
                <Pressable
                  onPress={live.sendEnglish}
                  disabled={!listening}
                  accessibilityRole="button"
                  accessibilityLabel="Ask for it in English"
                  style={({ pressed }) => [st.helpItem, pressed && { opacity: 0.6 }]}
                >
                  <Text style={[type.small, { color: paper.inkSoft }]}>In English</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  orbBlock: { alignItems: 'center', paddingTop: space(4), paddingBottom: space(7) },
  support: { paddingBottom: space(2) },
  shell: { flex: 1, backgroundColor: paper.ground },
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  center: { flex: 1, backgroundColor: paper.ground, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(8) },
  listen: { minHeight: HIT, paddingHorizontal: space(5), paddingTop: space(3) },
  terminalAction: { marginTop: space(6), alignSelf: 'stretch' },
  header: { paddingBottom: space(3) },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  leave: { minHeight: HIT, justifyContent: 'center', paddingLeft: space(3) },
  notice: { paddingBottom: space(2) },
  scroll: { paddingTop: space(3), paddingBottom: space(5), gap: space(5), flexGrow: 1, justifyContent: 'center' },
  chooseScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: space(6) },
  sceneBlock: { borderLeftWidth: HAIRLINE + 1, borderLeftColor: paper.line, paddingLeft: space(3.5) },
  sceneHead: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  controls: { alignItems: 'center', paddingTop: space(1) },
  typeRow: { flexDirection: 'row', alignSelf: 'stretch', gap: space(2), alignItems: 'center' },
  typeInput: {
    flex: 1,
    minHeight: HIT + 6,
    backgroundColor: paper.card,
    borderWidth: 1.5,
    borderColor: paper.line,
    borderRadius: radius.input,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    ...type.body,
    color: paper.ink,
  },
  typeInputFocused: { borderColor: paper.ink },
  typeSend: {
    minHeight: HIT,
    paddingHorizontal: space(4),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paper.ink,
    borderRadius: radius.pill,
  },
  helpRow: {
    marginTop: space(3),
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space(1),
  },
  helpItem: {
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(1.5),
    paddingHorizontal: space(2.5),
  },
});
