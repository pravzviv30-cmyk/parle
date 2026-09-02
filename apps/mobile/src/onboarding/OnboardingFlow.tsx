/**
 * Onboarding, one page at a time: age, name, who is answering, and which voice
 * answers.
 *
 * Four pages, progress dots, a back chevron, and nothing to fail. The name
 * page's Continue is always live, because a name is encouraged and never
 * required. A learner migrated from the pre-account era arrives with `existing`
 * set and their old answers pre-filled, so they are asked only what is new.
 *
 * What used to be here and is not any more: a typed date of birth, the daily
 * goal, and the reason they are learning French. The date became one
 * confirmation, because the only thing the product needs to know is that the
 * learner is thirteen; the goal moved to a Profile row, because nothing on the
 * way to a first conversation should be a preference; and the why page went
 * because nothing ever read the answer. All three are the same idea: ask less
 * before the value, and never ask a question the product does not use.
 *
 * The Meet page is not a question — it is the app saying, before the first
 * scene rather than after it, that the tutor is AI, that no person hears you,
 * that the microphone is about to be asked for, and that typing is there for
 * anyone who cannot speak out loud. Every word of it comes from
 * `onboarding/disclosure.ts`, which is also where the welcome and TutorIntro
 * get theirs, so the four cannot drift apart.
 *
 * Every page that names the tutor names `persona`, and `persona` is
 * `tutorPersonaOf(existing)` rather than the default. On a first-ever run there
 * is no record and it resolves to the default, which is the right answer and is
 * why these pages were allowed to name it at all. On a second pass there is a
 * record: a migrated learner, or one sent back through by a newly required
 * answer. That learner used to be told to meet Luc and then introduced to
 * Céline by TutorIntro two screens later, which is F300 and is the same
 * mismatch F281 and F294 exist to prevent.
 *
 * The voice page is the last one, and it is the only place a learner is ever
 * shown the eight voices before they have gone looking in Profile for them.
 * It is a question that costs nothing to decline: the pill leaves with whatever
 * is selected, the ghost under it leaves with nothing selected, and both of
 * those end up talking to somebody with a name. Its rules — what it offers,
 * what a skip means, and which door the answer is written through — are in
 * `voiceStep.ts`, because a rule inside a `.tsx` is a rule nothing can check.
 *
 * Every rule this file used to hold now lives in `answers.ts`, where a test can
 * reach it. What is left here is layout.
 */

import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { paper, space, type, HIT } from '../theme.ts';
import { PillButton, GhostButton, Field, ProgressDots, ChevronLeft, OptionCard } from '../components.tsx';
import { OnboardWave, OnboardCake, SpeakBubbles } from '../illustrations.tsx';
import type { StoredProfile } from '../profile/store.ts';
import { tutorPersonaOf } from '../tutor/tutorName.ts';
import { nextSample, type TutorVoiceKey } from '../tutor/tutorVoice.ts';
import { voiceSample } from '../tutor/voiceSamples.ts';
import { VOICE_STEP_OPTIONS } from './voiceStep.ts';
import {
  AGE_CONFIRM,
  AGE_DENY,
  AGE_QUESTION,
  AGE_SUB,
  NAME_LABEL,
  NAME_QUESTION,
  NAME_SKIP_HINT,
  PAGES,
  ageGate,
  answersFrom,
  pageBefore,
  type OnboardingAnswers,
  type Page,
} from './answers.ts';
import {
  MEET_AI,
  MEET_MIC,
  MEET_MORE,
  MEET_PILL,
  MEET_PRIVACY,
  MEET_TITLE,
  MEET_TYPING,
  VOICE_AI,
  VOICE_BODY,
  VOICE_SKIP,
  VOICE_SKIP_HINT,
  VOICE_TITLE,
} from './disclosure.ts';
import { trackProductEvent } from '../analytics/track.ts';

export function OnboardingFlow({
  existing,
  onDone,
}: {
  existing: StoredProfile | null;
  onDone: (answers: OnboardingAnswers) => void;
}) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<Page>('age');
  const [name, setName] = useState(existing?.name ?? '');
  // What the learner said about their age on this pass. Null until they answer
  // either way, so the refusal only appears once it has been earned.
  const [oldEnough, setOldEnough] = useState<boolean | null>(
    existing?.ageConfirmed === true ? true : null,
  );
  // Who they tapped on the voice step. Null is a skip and stays a skip all the
  // way to the profile: `withChosenVoice` writes nothing for it, so the field
  // still reads "never chosen" and both the app and the agent resolve it to the
  // catalogue default. Pre-filled for a learner running the flow a second time
  // so the step shows what they already have rather than presenting their own
  // choice back to them as unmade.
  const [voice, setVoice] = useState<TutorVoiceKey | null>(existing?.tutorVoice ?? null);

  /**
   * Who this learner is already talking to, which is who these pages name.
   *
   * Read off the record rather than from the state above on purpose. `voice`
   * is what they are picking on the last page and it moves under their thumb;
   * this is who they had when they walked in, and it is what the skip hint has
   * to be honest about, because a skip writes nothing and leaves them exactly
   * here. Null record, or a stored key the catalogue no longer has, resolves to
   * the default, so a first-ever run reads word for word as it always did.
   */
  const persona = tutorPersonaOf(existing);

  /**
   * Which sample is sounding, and the one player that sounds it.
   *
   * Lifted from the Profile sheet unchanged, down to `nextSample` deciding the
   * key: one player rather than one per row is what makes "one at a time" a
   * property of the shape instead of a discipline. A learner comparing two
   * voices taps the second while the first is still going, and with eight
   * players would hear both at once and learn nothing about either.
   *
   * Declared at the top of the component rather than beside the page that uses
   * it, because the pages are branches and a hook behind a branch is a hook
   * that changes order.
   */
  const [playing, setPlaying] = useState<TutorVoiceKey | null>(null);
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const hearVoice = useCallback(
    (key: TutorVoiceKey) => {
      const next = nextSample(playing, key);
      setPlaying(next);
      if (next === null) {
        player.pause();
        return;
      }
      // Loaded before it is told to play, or the player sounds whatever it was
      // last handed. `replace` builds a fresh media element, so the new clip
      // starts at nought and a tap on the one that just finished replays it.
      player.replace(voiceSample(next));
      player.play();
    },
    [playing, player],
  );

  // A clip that ends on its own leaves `playing` pointing at it, and then
  // `nextSample` reads the next tap on that same voice as "stop" and stops
  // nothing — a dead ear until a third tap. Clearing it the instant the sound
  // finishes makes the next tap a fresh play. F305.
  useEffect(() => {
    if (playerStatus.didJustFinish) setPlaying(null);
  }, [playerStatus.didJustFinish]);

  // The sound does not follow the learner off the voice step. `complete` pauses
  // on the way out the front, but the back chevron only moves the page, so a
  // sample auditioned here would otherwise play on over the screen behind it.
  // F304.
  useEffect(() => {
    if (page !== 'voice') player.pause();
  }, [page, player]);

  const index = PAGES.indexOf(page);
  const previous = pageBefore(page);
  const refusal = oldEnough === false ? ageGate(false).refusal : null;

  const complete = (chosen: TutorVoiceKey | null) => {
    void trackProductEvent({
      name: 'onboarding_completed',
      properties: { personalisedGreeting: name.trim().length > 0 },
    });
    // The sound does not follow them into the chooser. Leaving a clip playing
    // over the next screen is the kind of thing that makes somebody put the
    // phone down in a quiet room.
    player.pause();
    onDone(
      answersFrom({
        name,
        ageConfirmed: oldEnough === true,
        motivation: existing?.motivation ?? null,
        // The pill leaves with the selection, the skip with null — passed in by
        // the caller, never read from `voice` here. The skip sets `voice` to null
        // and completes in the same tick, and a closure reading `voice` would
        // still see the old selection and save a voice the learner walked past.
        // A null skip leaves an existing learner's stored voice untouched:
        // `completeProfile` carries it through and `withChosenVoice(_, null)`
        // writes nothing. F303.
        tutorVoice: chosen,
      }),
    );
  };

  const confirmAge = () => {
    setOldEnough(true);
    setPage('name');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      enabled={Platform.OS !== 'web'}
    >
      <View style={[st.root, { paddingTop: insets.top + space(3), paddingBottom: insets.bottom + space(6) }]}>
        <View style={st.topRow}>
          {previous !== null ? (
            <Pressable
              onPress={() => setPage(previous)}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={st.back}
            >
              <ChevronLeft />
            </Pressable>
          ) : (
            <View style={st.back} />
          )}
          <ProgressDots total={PAGES.length} index={index} />
          <View style={st.back} />
        </View>

        <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* The gate comes first, and deliberately before the name. Asking
              somebody's name and then turning them away takes a personal
              detail from a learner the product has already decided not to
              serve, and no amount of not persisting it makes that the right
              order to ask in. */}
          {page === 'age' && (
            <>
              <View style={st.art}>
                <OnboardCake width={170} />
              </View>
              <Text accessibilityRole="header" style={st.question}>
                {AGE_QUESTION}
              </Text>
              <Text style={st.sub}>{AGE_SUB}</Text>
              {refusal !== null && <Text style={st.refusal}>{refusal}</Text>}
              <View style={st.secondary}>
                <GhostButton label={AGE_DENY} onPress={() => setOldEnough(false)} />
              </View>
            </>
          )}

          {page === 'name' && (
            <>
              <View style={st.art}>
                <OnboardWave width={170} />
              </View>
              <Text accessibilityRole="header" style={st.question}>
                {NAME_QUESTION}
              </Text>
              <Text style={st.sub}>{`${persona.name} greets you by name.`}</Text>
              <View style={{ marginTop: space(6) }}>
                {/* A visible label rather than a placeholder alone: a
                    placeholder disappears the moment somebody types, and it is
                    the only thing assistive tech had to go on here. */}
                <Field
                  label={NAME_LABEL}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoFocus={Platform.OS === 'web'}
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={() => setPage('meet')}
                />
              </View>
              <Text style={st.hint}>{NAME_SKIP_HINT}</Text>
            </>
          )}

          {page === 'meet' && (
            <>
              <View style={st.art}>
                <SpeakBubbles width={150} />
              </View>
              <Text accessibilityRole="header" style={st.question}>
                {MEET_TITLE(persona)}
              </Text>
              <View style={st.lines}>
                <Text style={st.line}>{MEET_AI(persona)}</Text>
                <Text style={st.line}>{MEET_PRIVACY(persona)}</Text>
                <Text style={st.line}>{MEET_MIC}</Text>
                <Text style={st.line}>{MEET_TYPING}</Text>
              </View>
              <Text style={st.hint}>{MEET_MORE}</Text>
            </>
          )}

          {/* The voice step. It comes after the page that says the tutor is AI,
              never before it: eight named people introduced first and the
              disclosure afterwards is the exact order this flow exists to
              prevent. Nothing here is required. The pill at the bottom leaves
              with whatever is selected, the skip under it leaves with nothing
              selected, and both of those are a real person with a name. */}
          {page === 'voice' && (
            <>
              <Text accessibilityRole="header" style={st.question}>
                {VOICE_TITLE}
              </Text>
              <Text style={st.sub}>{VOICE_BODY}</Text>
              <Text style={st.hint}>{VOICE_AI}</Text>
              <View style={st.voices}>
                {VOICE_STEP_OPTIONS.map((option) => (
                  <OptionCard
                    key={option.value}
                    text={option.label}
                    gloss={option.gloss}
                    selected={voice === option.value}
                    onPress={() => setVoice(option.value)}
                    onHear={() => hearVoice(option.value)}
                  />
                ))}
              </View>
              <Text style={st.hint}>{VOICE_SKIP_HINT(persona)}</Text>
            </>
          )}
        </ScrollView>

        {/* Gone once they have said they are younger. A refusal with the way
            through still sitting under it is not a gate, it is a suggestion:
            the previous shape showed the honest refusal text and left this pill
            rendered and enabled directly beneath it, one tap from walking
            straight past. Nothing is persisted, so closing the app and coming
            back offers the question again, which is the escape hatch for a
            mis-tap and is deliberately not a button. */}
        {page === 'age' && oldEnough !== false && <PillButton label={AGE_CONFIRM} onPress={confirmAge} />}
        {page === 'name' && <PillButton label="Continue" onPress={() => setPage('meet')} />}
        {page === 'meet' && <PillButton label="Continue" onPress={() => setPage('voice')} />}
        {page === 'voice' && (
          <>
            <PillButton label={MEET_PILL} onPress={() => complete(voice)} />
            {/* The way past, and it is a ghost rather than a second pill on
                purpose: one solid action per screen. It goes to the same place
                the pill does, carrying nothing, which is what makes skipping an
                answer instead of a question asked again later. It passes null
                itself rather than scheduling `setVoice(null)` and completing in
                the same tick, which a closure over `voice` would never see. */}
            <View style={st.secondary}>
              <GhostButton label={VOICE_SKIP} onPress={() => complete(null)} />
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper.ground, paddingHorizontal: space(6) },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(2) },
  back: { minHeight: HIT, minWidth: HIT, alignItems: 'flex-start', justifyContent: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: space(4) },
  art: { alignItems: 'center', marginBottom: space(5) },
  question: { ...type.display, color: paper.ink, textAlign: 'center' },
  sub: { ...type.body, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
  hint: { ...type.small, color: paper.inkFaint, textAlign: 'center', marginTop: space(3) },
  refusal: { ...type.bodyStrong, color: paper.ink, textAlign: 'center', marginTop: space(5) },
  lines: { gap: space(3), marginTop: space(4) },
  voices: { gap: space(3), marginTop: space(5), alignSelf: 'stretch' },
  line: { ...type.body, color: paper.inkSoft, textAlign: 'center' },
  secondary: { marginTop: space(5) },
});
