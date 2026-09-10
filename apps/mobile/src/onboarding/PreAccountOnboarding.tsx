/**
 * Five calm screens before account creation.
 *
 * This is intentionally separate from `OnboardingFlow`: that flow remains the
 * recovery route for older accounts that have never answered the age gate.
 * New learners choose a tutor before they create an account, and this component
 * carries only that compact draft across the auth boundary.
 */

import { useCallback, useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { tutorSampleLine, tutorVoice, type TutorVoiceKey } from '@luvani/core';
import { paper, space, type } from '../theme.ts';
import { Card, GhostButton, OptionCard, PillButton, ProgressDots } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { HeroCafe, OnboardWave, SpeakBubbles } from '../illustrations.tsx';
import { nextSample, TUTOR_VOICE_OPTIONS } from '../tutor/tutorVoice.ts';
import { voiceSample } from '../tutor/voiceSamples.ts';
import { CONSENT_HINT, CONSENT_ROW, CONSENT_SUB } from '../analytics/consent.ts';
import { SwitchRow } from '../settings/SwitchRow.tsx';
import { WELCOME_SUBLINE } from './disclosure.ts';
import {
  freshPreAccountDraft,
  type PreAccountOnboardingDraft,
} from './preAccountDraft.ts';

export const PRE_ACCOUNT_PAGES = ['welcome', 'situations', 'life', 'voice', 'ready'] as const;
type Page = (typeof PRE_ACCOUNT_PAGES)[number];

const pageBefore = (page: Page): Page | null => {
  const index = PRE_ACCOUNT_PAGES.indexOf(page);
  return index > 0 ? PRE_ACCOUNT_PAGES[index - 1] ?? null : null;
};

export function PreAccountOnboarding({
  initialDraft,
  onDraftChange,
  onCreateAccount,
  onSignIn,
}: {
  initialDraft: PreAccountOnboardingDraft | null;
  onDraftChange: (draft: PreAccountOnboardingDraft) => void;
  onCreateAccount: (draft: PreAccountOnboardingDraft) => void;
  onSignIn: () => void;
}) {
  const [page, setPage] = useState<Page>('welcome');
  const [draft, setDraft] = useState<PreAccountOnboardingDraft>(() => initialDraft ?? freshPreAccountDraft());
  const [underAge, setUnderAge] = useState(false);
  const [playing, setPlaying] = useState<TutorVoiceKey | null>(null);
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const selected = draft.tutorVoice;
  const persona = tutorVoice(selected).persona;
  const previous = pageBefore(page);

  // An interrupted pre-account flow can be resumed with the voice already
  // chosen. Do not replace a choice with the catalogue default on remount.
  useEffect(() => {
    if (initialDraft !== null) setDraft(initialDraft);
  }, [initialDraft]);

  useEffect(() => {
    if (status.didJustFinish) setPlaying(null);
  }, [status.didJustFinish]);

  useEffect(() => {
    if (page !== 'voice') player.pause();
  }, [page, player]);

  const chooseVoice = (voice: TutorVoiceKey) => {
    const next: PreAccountOnboardingDraft = { ...draft, tutorVoice: voice };
    setDraft(next);
    onDraftChange(next);
    // The bundled sample is deliberately the tutor's real bilingual
    // introduction, which `tutorSampleLine` owns. Quoting the words here was how
    // the caption below came to disagree with the audio for a week, so this
    // comment names the function and never the sentence. Playing it on selection
    // makes the choice feel like meeting a person, while the ear remains
    // available to replay or stop it deliberately.
    setPlaying(voice);
    player.replace(voiceSample(voice));
    player.play();
  };

  /**
   * The usage-data answer, taken on the last page before an account exists.
   *
   * It goes through `onDraftChange` like the voice, so it survives the app
   * being closed between the tap and account creation, and so the one place
   * that knows how to write it durably is the one that has a key to write it
   * under. The draft is a hand-off across the auth boundary and never a second
   * authority: `analytics/consentStore.ts` holds the answer once there is an
   * account, and this copy is cleared with the rest of the draft.
   */
  const setConsent = (allowed: boolean) => {
    const next: PreAccountOnboardingDraft = { ...draft, analyticsConsent: allowed };
    setDraft(next);
    onDraftChange(next);
  };

  const hearVoice = useCallback((voice: TutorVoiceKey) => {
    const next = nextSample(playing, voice);
    setPlaying(next);
    if (next === null) {
      player.pause();
      return;
    }
    player.replace(voiceSample(next));
    player.play();
  }, [playing, player]);

  const index = PRE_ACCOUNT_PAGES.indexOf(page);
  const next = (to: Page) => {
    setUnderAge(false);
    setPage(to);
  };

  const body = (
    <>
      {page === 'welcome' && (
        <View style={st.centered}>
          <HeroCafe width={225} />
          <Text accessibilityRole="header" style={st.title}>Find your voice in French</Text>
          <Text style={st.body}>{WELCOME_SUBLINE(persona)}</Text>
        </View>
      )}

      {page === 'situations' && (
        <View style={st.centered}>
          <SpeakBubbles width={165} />
          <Text accessibilityRole="header" style={st.title}>Speak in real situations</Text>
          <Text style={st.body}>Order lunch, make plans, or ask for help. Your conversation becomes phrases to return to later.</Text>
          <Card style={st.exchange}>
            <Text style={st.french}>Bonjour, je voudrais une baguette, s’il vous plaît.</Text>
            <Text style={st.english}>Hello, I’d like a baguette, please.</Text>
            <Text style={st.reply}>Your tutor helps you find the next thing to say.</Text>
          </Card>
        </View>
      )}

      {page === 'life' && (
        <View style={st.centered}>
          <OnboardWave width={175} />
          <Text accessibilityRole="header" style={st.title}>Life happens. Your progress stays.</Text>
          <Text style={st.body}>There are no streaks to protect. Come back when you can and pick up from a conversation you already made yours.</Text>
        </View>
      )}

      {page === 'voice' && (
        <>
          <Text accessibilityRole="header" style={st.title}>{`Meet ${persona.name}`}</Text>
          <Text style={st.body}>Choose the AI tutor voice you would like to hear. When you choose one, they introduce themselves in French and then in English.</Text>
          <View style={st.voices}>
            {TUTOR_VOICE_OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                text={option.label}
                gloss={option.gloss}
                selected={selected === option.value}
                playing={playing === option.value}
                onPress={() => chooseVoice(option.value)}
                onHear={() => hearVoice(option.value)}
              />
            ))}
          </View>
          {/* Read from the catalogue, never typed here: the clip and this line
              have to be the same words, and a hand-typed copy is what drifted. */}
          <Text style={st.sampleLine}>{`“${tutorSampleLine(selected)}”`}</Text>
        </>
      )}

      {page === 'ready' && (
        <View style={st.centered}>
          <HeroCafe width={190} />
          <Text accessibilityRole="header" style={st.title}>Ready when you are</Text>
          {underAge ? (
            <Text style={st.body}>Luvani is for learners thirteen and up. Please come back when it is the right time.</Text>
          ) : (
            <>
              <Text style={st.body}>Make an account to save your progress and keep talking with {persona.name}.</Text>
              <Text style={st.privacy}>Your tutor is AI. We ask for microphone permission only when you start a scene, and you can type instead. Learning history does not include raw audio by default.</Text>
              {/* Asked once, here, under the line that already says what the
                  app keeps, rather than on a page of its own. A whole screen
                  for a switch that starts off would be one more thing between
                  a learner and their first French sentence, and the answer is
                  no unless they move it either way. */}
              <Card style={st.consent}>
                <SwitchRow
                  first
                  title={CONSENT_ROW}
                  sub={CONSENT_SUB}
                  value={draft.analyticsConsent}
                  onChange={setConsent}
                  accessibilityLabel={CONSENT_ROW}
                />
              </Card>
              <Text style={st.consentHint}>{CONSENT_HINT}</Text>
            </>
          )}
        </View>
      )}
    </>
  );

  return (
    <ScrollScreen
      center
      header={<ScreenHeader back={previous === null ? undefined : { onPress: () => setPage(previous) }} title={<ProgressDots total={PRE_ACCOUNT_PAGES.length} index={index} />} />}
      footer={
        <>
          {page === 'welcome' && <PillButton label="See how it works" onPress={() => next('situations')} />}
          {page === 'situations' && <PillButton label="Continue" onPress={() => next('life')} />}
          {page === 'life' && <PillButton label="Choose your Tutor" onPress={() => next('voice')} />}
          {page === 'voice' && <PillButton label="Continue" onPress={() => next('ready')} />}
          {page === 'ready' && !underAge && (
            <>
              <PillButton label="I am 13 or older · Create account" onPress={() => onCreateAccount(draft)} />
              <View style={st.secondary}>
                <GhostButton label="I already have an account" color={paper.ink} onPress={onSignIn} />
                <GhostButton label="I am younger than that" color={paper.inkSoft} onPress={() => setUnderAge(true)} />
              </View>
            </>
          )}
        </>
      }
    >
      {body}
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  centered: { alignItems: 'center' },
  title: { ...type.display, color: paper.ink, textAlign: 'center' },
  body: { ...type.body, color: paper.inkSoft, textAlign: 'center', marginTop: space(3) },
  privacy: { ...type.small, color: paper.inkSoft, textAlign: 'center', marginTop: space(4) },
  // Stretched rather than centred, because the row inside it is a control with
  // a title on the left and a switch on the right, and a card that shrinks to
  // its text would put the switch somewhere different on every phone.
  consent: { alignSelf: 'stretch', marginTop: space(4) },
  // Left, under the row it belongs to. The sentences above it are centred
  // because they are addressed to the reader; this one labels a control.
  consentHint: { ...type.small, color: paper.inkSoft, textAlign: 'left', alignSelf: 'stretch', marginTop: space(2) },
  exchange: { alignSelf: 'stretch', marginTop: space(6), gap: space(1.5) },
  french: { ...type.bodyStrong, color: paper.ink },
  english: { ...type.small, color: paper.inkSoft },
  reply: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  voices: { gap: space(3), marginTop: space(6) },
  sampleLine: { ...type.small, color: paper.inkSoft, textAlign: 'center', marginTop: space(4) },
  secondary: { marginTop: space(4), gap: space(2) },
});
