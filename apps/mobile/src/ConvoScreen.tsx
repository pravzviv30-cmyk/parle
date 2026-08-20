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

import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { conversationXp, phraseKeyOf, type RecapPayload } from '@parle/core';
import { accent, paper, signal, space, type, radius, HAIRLINE, HIT } from './theme.ts';
import {
  Card,
  Label,
  PillButton,
  GhostButton,
  StationLine,
  EarGlyph,
  HelpGlyph,
  fitDisplay,
} from './components.tsx';
import { SupportBlock } from './SessionView.tsx';
import { RecapScreen } from './RecapScreen.tsx';
import { mergeExercises } from './drill/store.ts';
import { clearJournal } from './live/journal.ts';
import { addPhrases } from './review/store.ts';
import { mergeSessionTopics } from './topics/store.ts';
import { recordActivity } from './progress/activity.ts';
import { useLiveSession } from './live/useLiveSession.ts';
import { LiveErrorView } from './live/LiveErrorView.tsx';
import { VoiceOrb, type OrbState } from './tutor/VoiceOrb.tsx';
import { Transcript } from './tutor/Transcript.tsx';
import { QUIET_DOOR, choosingView } from './tutor/choosingView.ts';
import { enterSubmits, keyPressFrom } from './tutor/enterSubmit.ts';

/**
 * The browser wants a gesture before it will play the tutor.
 *
 * On both surfaces now, not only inside a scene: the choosing moment promises
 * a tutor who asks out loud, and a promise that fails in silence is worse than
 * one that never got made. Sentence case rather than the caps micro-label,
 * because it is a control and DESIGN.md puts buttons in sentence case.
 */
function ListenPlaque({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Tap to listen to your tutor"
      style={({ pressed }) => [st.listen, pressed && { opacity: 0.85 }]}
    >
      <Card style={{ alignItems: 'center' }}>
        <Text style={[type.bodyStrong, { color: paper.ink }]}>Tap to listen</Text>
      </Card>
    </Pressable>
  );
}

export function ConvoScreen({
  userId,
  snapshot,
  onRecap,
  onExit,
  startInTextMode = false,
  seedTopic,
}: {
  userId: string;
  /** The stored learner model, passed through to the agent opaquely. */
  snapshot: unknown;
  /** The conversation ended: here is the end card and the updated model. */
  onRecap: (recap: RecapPayload, profileBlob: unknown) => void;
  onExit: () => void;
  /** "Can't speak right now": the same tutor, typed. */
  startInTextMode?: boolean;
  /**
   * What the learner asked to talk about again, from a topic card. It rides the
   * start body into the join token, the same channel mode and the snapshot use.
   * A session with no seed opens exactly as it always has.
   */
  seedTopic?: { fr: string; en: string };
}) {
  const insets = useSafeAreaInsets();
  // Text mode is a session property, not a toggle: switching rebuilds the
  // session (the agent must open voiceless). It flips exactly once, from the
  // denied-microphone screen.
  const [textMode, setTextMode] = useState(startInTextMode);
  const [draft, setDraft] = useState('');
  // Which text input holds the caret, for the ink focus border. Visual only.
  const [focusedInput, setFocusedInput] = useState<'topic' | 'reply' | null>(null);
  const live = useLiveSession(userId, 'convo-01', undefined, {
    mode: textMode ? 'convo-text' : 'convo',
    snapshot,
    seedTopic,
  });

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

  // Typing is presence. The hook throttles, so this can be handed every letter.
  const changeDraft = (text: string) => {
    setDraft(text);
    live.sendTyping();
  };

  /**
   * The return key, on the one platform where the props are not enough.
   *
   * react-native-web 0.21 has never heard of `submitBehavior`, and it runs its
   * own Enter branch from inside the very handler it calls this one from. So
   * this goes first and calls preventDefault, which makes that branch stand
   * down: exactly one send, and the caret stays where the learner left it.
   * See tutor/enterSubmit.ts for what the platform actually does.
   */
  const keyDraft = (event: { preventDefault: () => void }) => {
    if (!enterSubmits(Platform.OS, keyPressFrom(event), draft)) return;
    event.preventDefault();
    sendDraft();
  };

  // The recap renders here, not on a separate screen: the room must outlive
  // the end card, because the agent's background work — the enriched profile
  // and tonight's generated drills — arrives seconds AFTER the recap, and a
  // torn-down room would lose both. onRecap persists; it no longer navigates.
  const bankedRef = useRef(false);
  useEffect(() => {
    if (!live.recap) return;
    onRecap(live.recap.recap, live.recap.profile);
    // The recap arrives twice — once as itself, then again enriched with the
    // learner model — so this is banked exactly once per conversation.
    if (!bankedRef.current) {
      bankedRef.current = true;
      const { phrases, stats } = live.recap.recap;
      void recordActivity('convo', conversationXp({ phraseCount: phrases.length, unassistedRate: stats.unassistedRate }));
    }
  }, [live.recap, onRecap]);

  useEffect(() => {
    if (live.drills) void mergeExercises(live.drills);
  }, [live.drills]);

  // The session's practice leave-behind, banked exactly once: topic cards in
  // the topic store, the curated phrases into the review deck, staggered so
  // tomorrow is not a wall. RecapScreen shows all twelve phrases; only these
  // few become cards — that is curation doing its job.
  const practiceBankedRef = useRef(false);
  useEffect(() => {
    if (!live.practice || practiceBankedRef.current) return;
    practiceBankedRef.current = true;
    void mergeSessionTopics(
      live.practice.map((t) => ({
        title: { fr: t.titleFr, en: t.titleEn },
        phraseKeys: t.phrases.map((p) => phraseKeyOf(p.fr)),
      })),
    );
    void addPhrases(live.practice.flatMap((t) => t.phrases), { stagger: true }).then(clearJournal);
  }, [live.practice]);

  const leaveNow = () => {
    // Leaving before the practice message landed: bank a minimal version from
    // the recap (its first few phrases under the session's own topic) so an
    // early exit never loses what the learner said. The only remaining loss
    // window is killing the app, same as the drills.
    if (!practiceBankedRef.current && live.recap) {
      practiceBankedRef.current = true;
      const phrases = live.recap.recap.phrases.slice(0, 5);
      const home = live.recap.recap.topics[0];
      if (phrases.length > 0 && home !== undefined) {
        void mergeSessionTopics([{ title: home, phraseKeys: phrases.map((p) => phraseKeyOf(p.fr)) }]);
        void addPhrases(phrases, { stagger: true }).then(clearJournal);
      }
    }
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

  // The opening moment: the tutor has asked, out loud and in English, what to
  // talk about. No menu — the circle listens, and whatever the learner says
  // (or types) becomes the scene. The first scene view replaces all of this.
  if (!view && live.opening) {
    const choosing = choosingView({
      textMode,
      micOpen: live.micOpen,
      thinking: live.thinking,
      tutorSpeaking: live.tutorSpeaking,
      turns: live.turns,
    });
    return (
      <View style={st.shell}>
        {live.audioBlocked ? <ListenPlaque onPress={live.resumeAudio} /> : null}

        <View style={[st.root, { paddingTop: insets.top + space(2), paddingBottom: insets.bottom + space(2) }]}>
          <View style={st.headerRow}>
            <Pressable
              onPress={leaveNow}
              accessibilityRole="button"
              accessibilityLabel="Leave the conversation"
              style={({ pressed }) => [st.leave, pressed && { opacity: 0.6 }]}
            >
              <Text style={[type.bodyStrong, { color: paper.inkSoft }]}>Leave</Text>
            </Pressable>
          </View>

          <ScrollView
            style={choosing.showTranscript ? st.chooseHeadShrink : st.chooseHeadGrow}
            contentContainerStyle={choosing.showTranscript ? st.chooseTop : st.chooseScroll}
            showsVerticalScrollIndicator={false}
            // Every other input screen in this app sets this. Without it the
            // keyboard closing eats the first tap, which is why Send worked in
            // the scene and did nothing here.
            keyboardShouldPersistTaps="handled"
          >
            {choosing.showQuestion ? (
              <>
                <Text style={[fitDisplay(live.opening.prompt.en), { color: paper.ink, textAlign: 'center' }]}>
                  {live.opening.prompt.en}
                </Text>
                <Text style={[type.french, { color: paper.inkSoft, textAlign: 'center', marginTop: space(1.5) }]}>
                  {live.opening.prompt.fr}
                </Text>
              </>
            ) : null}

            {/* The circle is the primary action here until it is tapped: the
                tutor asks out loud, and this is where the learner agrees to be
                heard. One label on one control, so the orb's own is silenced. */}
            <View style={choosing.showQuestion ? st.chooseOrb : st.chooseOrbTight}>
              {choosing.orbIsButton ? (
                <Pressable
                  onPress={live.openMic}
                  accessibilityRole="button"
                  accessibilityLabel={choosing.orbLabel}
                  style={({ pressed }) => [st.orbTap, pressed && { opacity: 0.7 }]}
                >
                  <VoiceOrb state={choosing.orb} announce={false} />
                </Pressable>
              ) : (
                <View style={st.orbTap} accessibilityRole="image" accessibilityLabel={choosing.orbLabel}>
                  <VoiceOrb state={choosing.orb} announce={false} />
                </View>
              )}
            </View>

            {choosing.helper ? (
              <Text style={[type.small, { color: paper.inkFaint, textAlign: 'center', marginTop: space(4) }]}>
                {choosing.helper}
              </Text>
            ) : null}
          </ScrollView>

          {/* Everything said so far, arriving with the app's one settle. This
              is what makes a sent topic land on screen at once instead of
              three to ten seconds later. */}
          {choosing.showTranscript ? <Transcript turns={live.turns} /> : null}

          {live.notice ? (
            <View style={st.notice}>
              <Text style={[type.small, { color: paper.inkSoft, textAlign: 'center' }]}>{live.notice}</Text>
            </View>
          ) : null}

          {choosing.showInput ? (
            <View style={st.typeRow}>
              <TextInput
                value={draft}
                onChangeText={changeDraft}
                onSubmitEditing={sendDraft}
                onKeyPress={keyDraft}
                placeholder="Type what you want to talk about"
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
          ) : choosing.showQuietDoor ? (
            // The quiet twin, offered where a learner finds out they need it:
            // on a train, mid-question, not two screens back. Flipping rebuilds
            // the session voiceless and the tutor asks again.
            <View style={st.quietDoor}>
              <GhostButton label={QUIET_DOOR} onPress={() => setTextMode(true)} />
            </View>
          ) : null}
        </View>
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
      {/* One calm white notice, gone the moment it is tapped. */}
      {live.audioBlocked ? <ListenPlaque onPress={live.resumeAudio} /> : null}

      <View style={[st.root, { paddingTop: insets.top + space(2), paddingBottom: insets.bottom + space(2) }]}>
        <View style={st.header}>
          <View style={st.headerRow}>
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
                onChangeText={changeDraft}
                onSubmitEditing={sendDraft}
                onKeyPress={keyDraft}
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
  // flex-end, not space-between: the caps "Free talk" label that used to hold
  // the left of this row is gone, and without this Leave slides over to fill
  // the space it left.
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start' },
  leave: { minHeight: HIT, justifyContent: 'center', paddingLeft: space(3) },
  notice: { paddingBottom: space(2) },
  scroll: { paddingTop: space(3), paddingBottom: space(5), gap: space(5), flexGrow: 1, justifyContent: 'center' },
  // Nothing but the question and the circle yet: they sit in the middle of the
  // screen, exactly as they always have.
  chooseHeadGrow: { flex: 1 },
  chooseScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: space(6) },
  // Once the thread opens it takes the room, and the head above it gives way
  // rather than pushing anything off the bottom.
  chooseHeadShrink: { flexGrow: 0, flexShrink: 1 },
  chooseTop: { alignItems: 'center', paddingTop: space(2), paddingBottom: space(4) },
  chooseOrb: { alignItems: 'center', marginTop: space(7), marginBottom: space(8) },
  chooseOrbTight: { alignItems: 'center', marginTop: space(2), marginBottom: space(8) },
  // The circle is well past the touch floor already; the floor is here so it
  // stays past it if the circle ever shrinks.
  orbTap: { minWidth: HIT, minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
  quietDoor: { alignItems: 'center', paddingTop: space(2) },
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
    backgroundColor: accent.primary,
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
