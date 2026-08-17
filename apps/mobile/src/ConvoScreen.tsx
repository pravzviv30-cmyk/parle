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
  OutlineButton,
  GhostButton,
  OptionCard,
  SpeakCircle,
  StationLine,
  EarGlyph,
  HelpGlyph,
  fitDisplay,
} from './components.tsx';
import { SupportBlock } from './SessionView.tsx';
import { RecapScreen } from './RecapScreen.tsx';
import { mergeExercises } from './drill/store.ts';
import { useLiveSession } from './live/useLiveSession.ts';

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
    const micDenied = !textMode && /microphone/i.test(live.status.message);
    return (
      <View style={st.center}>
        <Label color={paper.inkFaint}>Connection problem</Label>
        <Text style={[type.body, { color: paper.inkSoft, marginTop: space(3), textAlign: 'center' }]}>
          {live.status.message}
        </Text>
        {micDenied ? (
          // A denied microphone is a situation, not a dead end: the same
          // tutor, the same scene, typed instead of spoken.
          <>
            <View style={st.terminalAction}>
              <PillButton label="Continue by typing" onPress={() => setTextMode(true)} />
            </View>
            <View style={st.terminalSecondary}>
              <GhostButton label="Back" onPress={onExit} />
            </View>
          </>
        ) : (
          <View style={st.terminalAction}>
            <OutlineButton label="Back" onPress={onExit} />
          </View>
        )}
      </View>
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
    return (
      <View style={st.center}>
        <ActivityIndicator color={paper.inkSoft} />
      </View>
    );
  }

  const listening = !live.tutorSpeaking;
  const reply = view.sceneReply;

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
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(2) }]}>{view.beat.goalEn}</Text>
          <View style={{ marginTop: space(2.5) }}>
            <StationLine total={view.beat.total} index={view.beat.position - 1} />
          </View>
        </View>

        {live.notice ? (
          <View style={st.notice}>
            <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>{live.notice}</Text>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
          {view.narration ? (
            // The narrator sets the scene and is not a character in it — the
            // white card marks the different status of what it says.
            <Card>
              <Text style={[type.bodyStrong, { color: paper.ink }]}>{view.narration.en}</Text>
              <Text style={[type.french, { color: paper.inkSoft, marginTop: space(1) }]}>{view.narration.fr}</Text>
            </Card>
          ) : null}

          <View style={st.sceneBlock}>
            <View style={st.sceneHead}>
              <EarGlyph size={19} color={listening ? paper.inkFaint : paper.ink} />
              <Label color={listening ? paper.inkFaint : paper.ink}>{reply.speaker}</Label>
            </View>
            <Text style={[type.french, { color: paper.ink, marginTop: space(1.5) }]}>{reply.fr}</Text>
            <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{reply.en}</Text>
            {reply.frWritten && reply.frWritten !== reply.fr ? (
              <Text style={[type.small, { color: paper.inkFaint, marginTop: space(0.5) }]}>{reply.frWritten}</Text>
            ) : null}
          </View>

          <SupportBlock
            support={view.supportView}
            // Replays come from the agent in the premium voice, and only while
            // the learner holds the floor — a replay must not talk over the
            // tutor. Text mode has no voice to replay.
            onHearLine={listening && !textMode ? live.sendHear : undefined}
          />
        </ScrollView>

        <View style={st.controls}>
          {view.coachNow.length > 0 ? (
            // The recast, visible: what they said, then what a local says. A
            // correction that is only spoken mostly slides past; seeing the
            // better form in the correspondance color is the "change here"
            // signal the design system already owns.
            <View style={{ alignItems: 'center', marginBottom: space(2) }}>
              <Text style={[type.small, { color: paper.inkFaint, textAlign: 'center' }]}>
                «{view.coachNow[0]!.quote}»
              </Text>
              <Text style={[type.french, { color: signal.correspondance, textAlign: 'center', marginTop: space(0.5) }]}>
                {view.coachNow[0]!.better}
                <Text style={[type.small, { color: paper.inkSoft }]}>  ·  {view.coachNow[0]!.betterEn}</Text>
              </Text>
            </View>
          ) : view.coachLine ? (
            <Text style={[type.bodyStrong, { color: paper.ink, textAlign: 'center', marginBottom: space(2) }]}>
              {view.coachLine}
            </Text>
          ) : (
            <View style={{ height: space(2) + 23, marginBottom: space(2) }} />
          )}

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
          ) : (
            <>
              {/* The open microphone, as an indicator: the learner never holds
                  or taps it here, so it stays non-interactive. */}
              <SpeakCircle
                active={listening}
                muted={!listening}
                disabled
                accessibilityLabel={listening ? 'Speak your answer' : 'The tutor is speaking'}
              />
              <Text style={[type.label, { color: listening ? paper.ink : paper.inkFaint, marginTop: space(2) }]}>
                {listening ? 'Speak' : 'Listen'}
              </Text>
            </>
          )}

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
  shell: { flex: 1, backgroundColor: paper.ground },
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(5) },
  center: { flex: 1, backgroundColor: paper.ground, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(8) },
  listen: { minHeight: HIT, paddingHorizontal: space(5), paddingTop: space(3) },
  terminalAction: { marginTop: space(6), alignSelf: 'stretch' },
  terminalSecondary: { marginTop: space(2), alignSelf: 'stretch' },
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
