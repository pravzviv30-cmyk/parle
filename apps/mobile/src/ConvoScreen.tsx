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
import { enamel, signal, space, type, radius, HIT } from './theme.ts';
import { Plaque, Tag, LabeledTag, StationLine, MicGlyph, EarGlyph, HelpGlyph, DirectionPlaque } from './components.tsx';
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
        <ActivityIndicator color={enamel.whiteMuted} />
        <Text style={[type.small, { color: enamel.whiteMuted, marginTop: space(3) }]}>Connexion au serveur…</Text>
        <Text style={[type.small, { color: enamel.whiteFaint, marginTop: space(0.5) }]}>Reaching the server</Text>
      </View>
    );
  }

  if (live.status.phase === 'out-of-minutes') {
    return (
      <View style={st.center}>
        <LabeledTag fr="TERMINUS" en="You are out of minutes" color={enamel.whiteFaint} />
        <Text style={[type.plaqueSmall, { color: enamel.white, marginTop: space(3), textAlign: 'center' }]}>
          {live.status.message}
        </Text>
        <Pressable onPress={onExit} accessibilityRole="button" style={({ pressed }) => [st.exit, pressed && { opacity: 0.8 }]}>
          <Text style={[type.tag, { color: enamel.white }]}>RETOUR · BACK</Text>
        </Pressable>
      </View>
    );
  }

  if (live.status.phase === 'error') {
    const micDenied = !textMode && /microphone/i.test(live.status.message);
    return (
      <View style={st.center}>
        <LabeledTag fr="PERTURBATION" en="Connection problem" color={enamel.whiteFaint} />
        <Text style={[type.body, { color: enamel.whiteMuted, marginTop: space(3), textAlign: 'center' }]}>
          {live.status.message}
        </Text>
        {micDenied ? (
          // A denied microphone is a situation, not a dead end: the same
          // tutor, the same scene, typed instead of spoken.
          <Pressable
            onPress={() => setTextMode(true)}
            accessibilityRole="button"
            style={({ pressed }) => [st.exit, pressed && { opacity: 0.8 }]}
          >
            <Text style={[type.tag, { color: enamel.white }]}>SANS MICRO · CONTINUE BY TYPING</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onExit} accessibilityRole="button" style={({ pressed }) => [st.exit, pressed && { opacity: 0.8 }]}>
          <Text style={[type.tag, { color: enamel.white }]}>RETOUR · BACK</Text>
        </Pressable>
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
          <LabeledTag fr="CONVERSATION" en="Free talk" />
          <Pressable
            onPress={leaveNow}
            accessibilityRole="button"
            accessibilityLabel="Leave the conversation"
            style={({ pressed }) => [st.leave, pressed && { opacity: 0.6 }]}
          >
            <Text style={[type.tag, { color: enamel.whiteMuted }]}>SORTIE · LEAVE</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={st.chooseScroll} showsVerticalScrollIndicator={false}>
          <Text style={[type.plaqueSmall, { color: enamel.white, textAlign: 'center' }]}>{live.topics.prompt.fr}</Text>
          <Text style={[type.small, { color: enamel.whiteMuted, textAlign: 'center', marginTop: space(1) }]}>
            {live.topics.prompt.en}
          </Text>
          <View style={{ marginTop: space(5), gap: space(2.5), alignSelf: 'stretch' }}>
            {live.topics.chips.map((chip) => (
              <DirectionPlaque key={chip.value} text={chip.label} gloss={chip.en} onPress={() => live.sendTopic(chip.value)} />
            ))}
          </View>
          {textMode ? (
            <View style={[st.typeRow, { marginTop: space(4) }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={sendDraft}
                placeholder="Ou écrivez-le · or type it"
                placeholderTextColor={enamel.whiteFaint}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                submitBehavior="submit"
                accessibilityLabel="Type what you want to talk about"
                style={st.typeInput}
              />
              <Pressable
                onPress={sendDraft}
                accessibilityRole="button"
                accessibilityLabel="Send your topic"
                style={({ pressed }) => [st.typeSend, pressed && { opacity: 0.8 }]}
              >
                <Text style={[type.tag, { color: enamel.white }]}>ENVOYER</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[type.small, { color: enamel.whiteFaint, textAlign: 'center', marginTop: space(4) }]}>
              ou dites-le, simplement · or just say it out loud
            </Text>
          )}
        </ScrollView>
      </View>
    );
  }

  if (!view) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={enamel.whiteMuted} />
      </View>
    );
  }

  const listening = !live.tutorSpeaking;
  const reply = view.sceneReply;

  return (
    <View style={{ flex: 1 }}>
      {live.audioBlocked && (
        // The browser wants a gesture before it will play the tutor. One calm
        // white notice, gone the moment it is tapped.
        <Pressable
          onPress={live.resumeAudio}
          accessibilityRole="button"
          style={({ pressed }) => [st.listen, pressed && { opacity: 0.85 }]}
        >
          <Plaque tone="white">
            <LabeledTag fr="TOUCHEZ POUR ÉCOUTER" en="Tap to hear your tutor" color="rgba(15,59,44,0.6)" />
          </Plaque>
        </Pressable>
      )}

      <View style={[st.root, { paddingTop: insets.top + space(2), paddingBottom: insets.bottom + space(2) }]}>
        <View style={st.header}>
          <View style={st.headerRow}>
            <LabeledTag fr="CONVERSATION" en="Free talk" />
            {/* Metered minutes must always have a door. Leaving ends the scene
                early and still delivers the recap the session has earned. */}
            <Pressable
              onPress={leaveNow}
              accessibilityRole="button"
              accessibilityLabel="Leave the conversation"
              style={({ pressed }) => [st.leave, pressed && { opacity: 0.6 }]}
            >
              <Text style={[type.tag, { color: enamel.whiteMuted }]}>SORTIE · LEAVE</Text>
            </Pressable>
          </View>
          <Text style={[type.small, { color: enamel.whiteMuted, marginTop: space(2) }]}>{view.beat.goalEn}</Text>
          <View style={{ marginTop: space(2.5) }}>
            <StationLine total={view.beat.total} index={view.beat.position - 1} />
          </View>
        </View>

        {live.notice ? (
          <View style={st.notice}>
            <Text style={[type.small, { color: enamel.whiteMuted, textAlign: 'center' }]}>{live.notice}</Text>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
          {view.narration ? (
            // The narrator sets the scene and is not a character in it — the
            // white notice tone marks the different status of what it says.
            <Plaque tone="white">
              <Text style={[type.bodyStrong, { color: 'rgba(15,59,44,0.92)' }]}>{view.narration.en}</Text>
              <Text style={[type.small, { color: 'rgba(15,59,44,0.6)', marginTop: space(1) }]}>{view.narration.fr}</Text>
            </Plaque>
          ) : null}

          <View style={st.sceneBlock}>
            <View style={st.sceneHead}>
              <EarGlyph size={19} color={listening ? enamel.whiteFaint : enamel.white} />
              <Tag color={listening ? enamel.whiteFaint : enamel.white}>{reply.speaker.toUpperCase()}</Tag>
            </View>
            <Text style={[type.bodyStrong, { color: enamel.white, marginTop: space(1.5) }]}>{reply.fr}</Text>
            <Text style={[type.small, { color: enamel.whiteMuted, marginTop: space(0.5) }]}>{reply.en}</Text>
            {reply.frWritten && reply.frWritten !== reply.fr ? (
              <Text style={[type.small, { color: enamel.whiteFaint, marginTop: space(0.5) }]}>{reply.frWritten}</Text>
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
              <Text style={[type.small, { color: enamel.whiteFaint, textAlign: 'center' }]}>
                «{view.coachNow[0]!.quote}»
              </Text>
              <Text style={[type.bodyStrong, { color: signal.correspondance, textAlign: 'center', marginTop: space(0.5) }]}>
                {view.coachNow[0]!.better}
                <Text style={[type.small, { color: enamel.whiteMuted }]}>  ·  {view.coachNow[0]!.betterEn}</Text>
              </Text>
            </View>
          ) : view.coachLine ? (
            <Text style={[type.bodyStrong, { color: enamel.white, textAlign: 'center', marginBottom: space(2) }]}>
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
                placeholder="Écrivez votre réponse · type your reply"
                placeholderTextColor={enamel.whiteFaint}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                submitBehavior="submit"
                accessibilityLabel="Type your reply"
                style={st.typeInput}
              />
              <Pressable
                onPress={sendDraft}
                accessibilityRole="button"
                accessibilityLabel="Send your reply"
                style={({ pressed }) => [st.typeSend, pressed && { opacity: 0.8 }]}
              >
                <Text style={[type.tag, { color: enamel.white }]}>ENVOYER</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              disabled
              accessibilityRole="button"
              accessibilityLabel={listening ? 'Speak your answer' : 'The tutor is speaking'}
              accessibilityState={{ disabled: true }}
              style={[st.speak, listening ? st.speakLive : st.speakIdle]}
            >
              <MicGlyph size={28} color={listening ? enamel.white : enamel.whiteFaint} />
              <Text style={[type.tag, { color: listening ? enamel.white : enamel.whiteFaint, marginTop: space(1) }]}>
                {listening ? 'PARLEZ · SPEAK' : 'ÉCOUTEZ · LISTEN'}
              </Text>
            </Pressable>
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
              <Text style={[type.small, { color: enamel.whiteMuted }]}>aide-moi · help me out</Text>
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
                  <Text style={[type.small, { color: enamel.whiteMuted }]}>plus lent · slower</Text>
                </Pressable>
                <Pressable
                  onPress={live.sendEnglish}
                  disabled={!listening}
                  accessibilityRole="button"
                  accessibilityLabel="Ask for it in English"
                  style={({ pressed }) => [st.helpItem, pressed && { opacity: 0.6 }]}
                >
                  <Text style={[type.small, { color: enamel.whiteMuted }]}>en anglais · in English</Text>
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
  root: { flex: 1, backgroundColor: enamel.ground, paddingHorizontal: space(5) },
  center: { flex: 1, backgroundColor: enamel.ground, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(8) },
  listen: { minHeight: HIT, paddingHorizontal: space(5), paddingTop: space(3) },
  exit: {
    marginTop: space(6),
    minHeight: HIT,
    paddingHorizontal: space(6),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: enamel.white,
    borderRadius: radius.plaque,
  },
  header: { paddingBottom: space(3) },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  leave: { minHeight: HIT, justifyContent: 'center', paddingLeft: space(3) },
  notice: { paddingBottom: space(2) },
  scroll: { paddingTop: space(3), paddingBottom: space(5), gap: space(5), flexGrow: 1, justifyContent: 'center' },
  chooseScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: space(6) },
  sceneBlock: { borderLeftWidth: 1, borderLeftColor: 'rgba(242,239,228,0.28)', paddingLeft: space(3.5) },
  sceneHead: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  controls: { alignItems: 'center', paddingTop: space(1) },
  speak: { width: 108, height: 108, borderRadius: radius.bullet, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  speakLive: {
    backgroundColor: signal.live,
    borderColor: enamel.white,
    shadowColor: signal.live,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  speakIdle: { backgroundColor: 'transparent', borderColor: 'rgba(242,239,228,0.22)' },
  typeRow: { flexDirection: 'row', alignSelf: 'stretch', gap: space(2), alignItems: 'center' },
  typeInput: {
    flex: 1,
    minHeight: HIT,
    backgroundColor: enamel.field,
    borderWidth: 1,
    borderColor: 'rgba(242,239,228,0.28)',
    borderRadius: radius.plaque,
    paddingHorizontal: space(3),
    color: enamel.white,
    ...type.body,
  },
  typeSend: {
    minHeight: HIT,
    paddingHorizontal: space(4),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: enamel.white,
    borderRadius: radius.plaque,
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
