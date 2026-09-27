/**
 * Six pages before account creation (notebook Phase 5).
 *
 * Hear it: a real recorded exchange, captioned. First line: the learner taps
 * the reply, hears it in the tutor's recording, and it is marked with the
 * highlighter, the first chartreuse they see. Then two one-tap answers, a plan
 * they can see those answers shape, and the page that saves it with an account.
 *
 * Nothing on these pages reaches an AI service or the network: the audio is
 * bundled, the answers ride the local pre-account draft, and the only way out
 * that creates anything is the save page's pill, which hands over to sign-up.
 * `disclosure.test.ts` walks this file's imports to hold that.
 *
 * This is intentionally separate from `OnboardingFlow`: that flow remains the
 * recovery route for older accounts that have never answered the age gate.
 */

import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { tutorVoice, type TutorVoiceKey } from '@luvani/core';

import { HAIRLINE, HIT, decorative, paper, radius, space, type } from '../theme.ts';
import {
  Card,
  EarGlyph,
  Field,
  GhostButton,
  Highlight,
  Label,
  Ledger,
  LedgerRow,
  PillButton,
  ProgressDots,
  TabBar,
  TutorCard,
} from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { Art } from '../art/Art.tsx';
import { HERO_ART } from '../art/maps.ts';
import { TUTOR_VOICE_OPTIONS } from '../tutor/tutorVoice.ts';
import { voiceSample } from '../tutor/voiceSamples.ts';
import { TutorMark } from '../tutor/TutorMark.tsx';
import { CHANGE_VOICE, tutorCardFacts } from '../tutor/speakView.ts';
import { CONSENT_HINT, CONSENT_ROW, CONSENT_SUB } from '../analytics/consent.ts';
import { SwitchRow } from '../settings/SwitchRow.tsx';
import { GOALS } from '../profile/dailyGoal.ts';
import { REMINDER_TIMES } from '../reminders/reminder.ts';
import { useReduceMotion } from '../motion.ts';
import { tapSettled } from '../motion/haptics.ts';
import { asSentences } from '../copy/spoken.ts';
import { SAVE_PRIVACY, WELCOME_SUBLINE } from './disclosure.ts';
import { TUTOR_LINES_VOICE } from './tutorLines.ts';
import { clipFor } from './exchangeAudio.ts';
import {
  ALREADY_HAVE_ACCOUNT,
  ANSWER_HINT,
  CHOSEN,
  CONTINUE,
  FIRST_LINE,
  FIRST_LINE_PROMPT,
  FIRST_LINE_TITLE,
  FIRST_NAME_HINT,
  FIRST_NAME_LABEL,
  FIRST_NAME_PLACEHOLDER,
  HAVE_ACCOUNT,
  HEAR_AGAIN,
  HEAR_IT_EXCHANGE,
  HEAR_NOTE,
  HEAR_TITLE,
  HIGHLIGHT_MEANS,
  LEARNER_LABEL,
  LEVEL_TITLE,
  REASON_SKIP,
  REASON_TITLE,
  SAVE_TITLE,
  STUCK,
  STUCK_HINT,
  TAP_TO_CONTINUE,
  TRY_A_LINE,
  UNDER_AGE,
  YOUNGER,
  type ExchangeLine,
} from './firstRun.ts';
import {
  GOAL_LABEL,
  GOAL_NOTE,
  METHOD_LABEL,
  METHOD_STEPS,
  MINUTES_LABEL,
  NO_STREAKS,
  PLAN_SCENES_LABEL,
  PLAN_TITLE,
  REASONS,
  REMINDER_LABEL,
  SAVE_PLAN,
  START_LEVELS,
  TRIAL_LINE,
  levelOf,
  planFor,
  planPlaces,
} from './plan.ts';
import {
  MAX_FIRST_NAME_CHARS,
  PRE_ACCOUNT_PAGES,
  firstNameFrom,
  freshPreAccountDraft,
  type PreAccountOnboardingDraft,
  type PreAccountPage,
  type Reason,
  type StartLevel,
} from './preAccountDraft.ts';

/** Where the learner's first line stands: not yet said, sounding, said. */
type LineStage = 'ask' | 'saying' | 'said';

/**
 * How long a tapped reply may take to report that it finished before the page
 * moves on anyway. A clip that never reports (a muted web tab, a decoder that
 * stalls) must not leave the learner stuck on a line they already said.
 */
const SAYING_FALLBACK_MS = 6000;

/** Native plays on arrival; a browser plays only after the page has been touched. */
const AUTOPLAYS = Platform.OS !== 'web';

const pageBefore = (page: PreAccountPage): PreAccountPage | null => {
  const index = PRE_ACCOUNT_PAGES.indexOf(page);
  return index > 0 ? (PRE_ACCOUNT_PAGES[index - 1] ?? null) : null;
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
  const [page, setPage] = useState<PreAccountPage>(() => initialDraft?.page ?? 'hear-it');
  const [draft, setDraft] = useState<PreAccountOnboardingDraft>(() => initialDraft ?? freshPreAccountDraft());
  const draftRef = useRef(draft);
  const [underAge, setUnderAge] = useState(false);
  const [lit, setLit] = useState<number | null>(null);
  const [stage, setStage] = useState<LineStage>('ask');
  const [stuck, setStuck] = useState(false);
  const [playing, setPlaying] = useState<'sample' | null>(null);
  const [voicesOpen, setVoicesOpen] = useState(false);
  const [nameText, setNameText] = useState(() => initialDraft?.firstName ?? '');
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const reduced = useReduceMotion();
  /** What to do when the clip now sounding finishes. One at a time, by construction. */
  const onFinish = useRef<(() => void) | null>(null);
  /** A browser allows sound once the page has been touched. */
  const touched = useRef(false);

  // The recorded tutor on the first two pages is Alexandre whichever voice the
  // learner later picks, so the disclosure there names him. The plan and the
  // save page speak about the learner's own choice.
  const persona = tutorVoice(TUTOR_LINES_VOICE).persona;
  const selected = draft.tutorVoice;
  const chosenPersona = tutorVoice(selected).persona;
  const card = tutorCardFacts(selected);
  const view = planFor(draft);
  const level = levelOf(draft);
  const previous = pageBefore(page);
  const dim = (index: number) => !reduced && lit !== null && lit !== index;

  /** The one door every answer goes through, so leaving and coming back finds it. */
  const keep = (patch: Partial<PreAccountOnboardingDraft>) => {
    const next: PreAccountOnboardingDraft = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    onDraftChange(next);
  };

  /** Usage data, answered once on the save page and carried across sign-up. */
  const setConsent = (allowed: boolean) => keep({ analyticsConsent: allowed });

  const finish = () => {
    const then = onFinish.current;
    onFinish.current = null;
    then?.();
  };

  /** Play one bundled clip, then do `then`. A missing clip moves straight on. */
  const play = (clip: number | undefined, then: (() => void) | null) => {
    onFinish.current = then;
    player.pause();
    if (clip === undefined) {
      finish();
      return;
    }
    player.replace(clip);
    player.play();
  };

  const playExchange = (index: number): void => {
    const line: ExchangeLine | undefined = HEAR_IT_EXCHANGE[index];
    if (line === undefined) {
      setLit(null);
      return;
    }
    setLit(index);
    play(clipFor(line), () => playExchange(index + 1));
  };

  const stop = () => {
    onFinish.current = null;
    player.pause();
    setLit(null);
    setPlaying(null);
  };

  useEffect(() => {
    if (status.didJustFinish) {
      setPlaying(null);
      finish();
    }
    // `finish` reads a ref; the effect only needs the edge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish]);

  // Each page starts its own sound, and leaving a page stops it.
  useEffect(() => {
    const allowed = AUTOPLAYS || touched.current;
    if (page === 'hear-it' && allowed) playExchange(0);
    else if (page === 'first-line' && allowed && stage === 'ask') play(clipFor(FIRST_LINE.question), null);
    else stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // A reply that never reports finishing still gets its highlight.
  useEffect(() => {
    if (stage !== 'saying') return;
    const timer = setTimeout(finish, SAYING_FALLBACK_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const go = (to: PreAccountPage) => {
    touched.current = true;
    setUnderAge(false);
    setPage(to);
    keep({ page: to });
  };

  const sayReply = () => {
    tapSettled();
    touched.current = true;
    setStage('saying');
    play(clipFor(FIRST_LINE.reply), () => {
      setStage('said');
      play(clipFor(FIRST_LINE.close), null);
    });
  };

  const answerLevel = (key: StartLevel) => {
    keep({ startLevel: key });
    go('reason');
  };

  const answerReason = (key: Reason | null) => {
    keep({ reason: key });
    go('plan');
  };

  const chooseVoice = (voice: TutorVoiceKey) => {
    keep({ tutorVoice: voice });
    // Choosing plays the tutor's bundled bilingual introduction, which
    // `tutorSampleLine` owns, so the choice feels like meeting a person.
    onFinish.current = null;
    player.pause();
    setPlaying('sample');
    player.replace(voiceSample(voice));
    player.play();
  };

  const hearVoice = (voice: TutorVoiceKey) => {
    touched.current = true;
    onFinish.current = null;
    player.pause();
    if (playing === 'sample') {
      setPlaying(null);
      return;
    }
    setPlaying('sample');
    player.replace(voiceSample(voice));
    player.play();
  };

  const setName = (value: string) => {
    setNameText(value);
    keep({ firstName: firstNameFrom(value) });
  };

  const index = PRE_ACCOUNT_PAGES.indexOf(page);

  const body = (
    <>
      {page === 'hear-it' && (
        <View style={st.page}>
          <Text accessibilityRole="header" style={st.title}>{HEAR_TITLE}</Text>
          <Text style={st.body}>{WELCOME_SUBLINE(persona)}</Text>
          <View style={st.exchange}>
            {HEAR_IT_EXCHANGE.map((line, at) => (
              <View key={line.id} style={[st.line, line.speaker === 'learner' && st.learnerLine]}>
                <Text style={st.speaker}>{line.speaker === 'tutor' ? persona.name : LEARNER_LABEL}</Text>
                <Text style={[st.french, dim(at) && st.dim]}>{line.fr}</Text>
                <Text style={st.english}>{line.en}</Text>
              </View>
            ))}
          </View>
          <Text style={st.note}>{HEAR_NOTE}</Text>
          <View style={st.quiet}>
            <GhostButton
              label={HEAR_AGAIN}
              color={paper.ink}
              onPress={() => {
                touched.current = true;
                playExchange(0);
              }}
            />
          </View>
        </View>
      )}

      {page === 'first-line' && (
        <View style={st.page}>
          <Text accessibilityRole="header" style={st.title}>{FIRST_LINE_TITLE}</Text>
          <View style={st.tutorRow}>
            <TutorMark />
            <View style={st.words}>
              <Text style={st.speaker}>{persona.name}</Text>
              <Text style={st.french}>{FIRST_LINE.question.fr}</Text>
              <Text style={st.english}>{FIRST_LINE.question.en}</Text>
            </View>
          </View>

          {stage === 'ask' && (
            <>
              <Text style={st.body}>{FIRST_LINE_PROMPT}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Reply: ${asSentences([FIRST_LINE.reply.fr, FIRST_LINE.reply.en])}`}
                accessibilityHint="Plays the line in the tutor's voice"
                onPress={sayReply}
                style={({ pressed }) => [st.reply, pressed && st.replyPressed]}
              >
                <View style={st.words}>
                  <Text style={st.french}>{FIRST_LINE.reply.fr}</Text>
                  <Text style={st.english}>{FIRST_LINE.reply.en}</Text>
                </View>
                <EarGlyph size={22} color={paper.ink} />
              </Pressable>
              {stuck ? (
                <View style={st.tutorRow}>
                  <TutorMark />
                  <View style={st.words}>
                    <Text style={st.speaker}>{persona.name}</Text>
                    <Text style={st.french}>{STUCK_HINT}</Text>
                  </View>
                </View>
              ) : (
                <View style={st.quiet}>
                  <GhostButton label={STUCK} color={paper.inkSoft} onPress={() => setStuck(true)} />
                </View>
              )}
            </>
          )}

          {stage === 'saying' && (
            <View style={st.said}>
              <Text style={st.french}>{FIRST_LINE.reply.fr}</Text>
              <Text style={st.english}>{FIRST_LINE.reply.en}</Text>
            </View>
          )}

          {stage === 'said' && (
            <View accessibilityLiveRegion="polite" style={st.said}>
              <Highlight text={FIRST_LINE.reply.fr} accessibilityLabel={`${FIRST_LINE.reply.fr} ${HIGHLIGHT_MEANS}`} />
              <Text style={st.english}>{FIRST_LINE.reply.en}</Text>
              <Text style={st.note}>{HIGHLIGHT_MEANS}</Text>
              <View style={st.tutorRow}>
                <TutorMark />
                <View style={st.words}>
                  <Text style={st.speaker}>{persona.name}</Text>
                  <Text style={st.french}>{FIRST_LINE.close.fr}</Text>
                  <Text style={st.english}>{FIRST_LINE.close.en}</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {page === 'start-level' && (
        <View style={st.page}>
          <Text accessibilityRole="header" style={st.title}>{LEVEL_TITLE}</Text>
          <Text style={st.body}>{ANSWER_HINT}</Text>
          <Ledger style={st.options}>
            {START_LEVELS.map((option) => (
              <LedgerRow
                key={option.key}
                title={option.title}
                gloss={option.gloss}
                accessibilityLabel={`${option.title}, ${option.gloss}${level === option.key ? `, ${CHOSEN}` : ''}`}
                trailing={level === option.key ? <Text style={st.chosen}>{CHOSEN}</Text> : undefined}
                onPress={() => answerLevel(option.key)}
              />
            ))}
          </Ledger>
        </View>
      )}

      {page === 'reason' && (
        <View style={st.page}>
          <Text accessibilityRole="header" style={st.title}>{REASON_TITLE}</Text>
          <Text style={st.body}>{ANSWER_HINT}</Text>
          <Ledger style={st.options}>
            {REASONS.map((option) => (
              <LedgerRow
                key={option.key}
                title={option.title}
                accessibilityLabel={draft.reason === option.key ? `${option.title}, ${CHOSEN}` : option.title}
                trailing={draft.reason === option.key ? <Text style={st.chosen}>{CHOSEN}</Text> : undefined}
                onPress={() => answerReason(option.key)}
              />
            ))}
          </Ledger>
        </View>
      )}

      {page === 'plan' && (
        <View style={st.page}>
          <Text accessibilityRole="header" style={st.title}>{PLAN_TITLE}</Text>
          {/* One watercolour per place the plan's scenes happen in, each once,
              decorative and hidden from assistive tech. */}
          <View style={st.artStage} {...decorative}>
            {planPlaces(view).map((place) => (
              <Art key={place} name={HERO_ART[place]} style={st.art} />
            ))}
          </View>

          <View style={st.block}>
            <Label>{PLAN_SCENES_LABEL}</Label>
            {view.scenes.map((scene) => (
              <View key={scene.id} style={st.sceneRow} accessible accessibilityLabel={`${scene.titleEn}. ${scene.canDoEn}`}>
                <Text style={st.sceneTitle}>{scene.titleEn}</Text>
                <Text style={st.english}>{scene.canDoEn}</Text>
              </View>
            ))}
          </View>

          <View style={st.block}>
            <Label>{MINUTES_LABEL}</Label>
            <TabBar
              tabs={GOALS.map((goal) => ({ key: goal.key, label: goal.label }))}
              active={GOALS.find((goal) => goal.minutes === view.minutes)?.key ?? null}
              onChange={(key) => keep({ minutes: GOALS.find((goal) => goal.key === key)?.minutes ?? view.minutes })}
              accessibilityLabel={MINUTES_LABEL}
            />
          </View>

          <View style={st.block}>
            <TutorCard
              name={card.name}
              voice={card.voice}
              signature={card.signature}
              onHear={() => hearVoice(selected)}
              playing={playing === 'sample'}
              onChange={() => setVoicesOpen((open) => !open)}
              changeLabel={CHANGE_VOICE}
            />
            {voicesOpen && (
              <Ledger>
                {TUTOR_VOICE_OPTIONS.map((option) => (
                  <LedgerRow
                    key={option.value}
                    title={option.label}
                    gloss={option.gloss}
                    accessibilityLabel={selected === option.value ? `${option.label}, ${option.gloss}, ${CHOSEN}` : `${option.label}, ${option.gloss}`}
                    trailing={selected === option.value ? <Text style={st.chosen}>{CHOSEN}</Text> : undefined}
                    onPress={() => chooseVoice(option.value)}
                  />
                ))}
              </Ledger>
            )}
          </View>

          {view.goal !== null && (
            <View style={st.block}>
              <Label>{GOAL_LABEL}</Label>
              <Text style={st.bodyInk}>{view.goal}</Text>
              <Text style={st.english}>{GOAL_NOTE}</Text>
            </View>
          )}

          <View style={st.block}>
            <Label>{METHOD_LABEL}</Label>
            {METHOD_STEPS.map((step) => (
              <Text key={step} style={st.bodyInk}>{step}</Text>
            ))}
            <Text style={st.bodyInk}>{NO_STREAKS}</Text>
          </View>

          <View style={st.block}>
            <Label>{REMINDER_LABEL}</Label>
            <TabBar
              tabs={REMINDER_TIMES.map((time) => ({ key: time.value, label: time.gloss }))}
              active={view.reminder.time}
              onChange={(key) => keep({ reminderTime: key })}
              accessibilityLabel={REMINDER_LABEL}
            />
            <Text style={st.english}>{view.reminder.note}</Text>
          </View>
        </View>
      )}

      {page === 'save' && (
        <View style={st.page}>
          <Text accessibilityRole="header" style={st.title}>{SAVE_TITLE}</Text>
          {underAge ? (
            <Text style={st.body}>{UNDER_AGE}</Text>
          ) : (
            <>
              <Text style={st.body}>Make an account to keep your plan and talk with {chosenPersona.name}.</Text>
              <View style={st.block}>
                <Field
                  label={FIRST_NAME_LABEL}
                  value={nameText}
                  onChangeText={setName}
                  placeholder={FIRST_NAME_PLACEHOLDER}
                  autoCapitalize="words"
                  autoComplete="given-name"
                  maxLength={MAX_FIRST_NAME_CHARS}
                  returnKeyType="done"
                />
                <Text style={st.english}>{FIRST_NAME_HINT}</Text>
              </View>
              <Card style={st.trust}>
                <View style={st.trustBlock}>
                  <Text style={st.trustTitle}>Your tutor is AI</Text>
                  <Text style={st.trustBody}>{SAVE_PRIVACY(chosenPersona)}</Text>
                </View>
                <View style={st.trustDivider} />
                <View style={st.trustBlock}>
                  <Text style={st.trustTitle}>Speak when you choose</Text>
                  <Text style={st.trustBody}>We ask for microphone permission only when you start a scene. You can type instead.</Text>
                </View>
                <View style={st.trustDivider} />
                <View style={st.trustBlock}>
                  <Text style={st.trustTitle}>Raw audio stays out of your learning history</Text>
                  <Text style={st.trustBody}>Learning history does not include raw audio by default.</Text>
                </View>
                {/* Asked once, here, under the lines that say what the app
                    keeps. The answer is no unless the learner moves it. */}
                <View style={st.trustDivider} />
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
              <Text style={st.trial}>{TRIAL_LINE}</Text>
            </>
          )}
        </View>
      )}
    </>
  );

  return (
    <ScrollScreen
      avoidKeyboard={page === 'save'}
      header={
        <ScreenHeader
          divider={false}
          back={
            previous === null
              ? undefined
              : {
                  onPress: () => go(previous),
                }
          }
          title={<ProgressDots total={PRE_ACCOUNT_PAGES.length} index={index} />}
        />
      }
      footer={
        <>
          {page === 'hear-it' && (
            <>
              <PillButton label={TRY_A_LINE} onPress={() => go('first-line')} />
              <View style={st.secondary}>
                <GhostButton label={HAVE_ACCOUNT} color={paper.ink} onPress={onSignIn} />
              </View>
            </>
          )}
          {page === 'first-line' && stage === 'said' && <PillButton label={CONTINUE} onPress={() => go('start-level')} />}
          {page === 'first-line' && stage !== 'said' && <Text style={st.footerHint}>{TAP_TO_CONTINUE}</Text>}
          {page === 'start-level' && <PillButton label={CONTINUE} onPress={() => answerLevel(level)} />}
          {page === 'reason' && (
            <>
              {draft.reason !== null && <PillButton label={CONTINUE} onPress={() => go('plan')} />}
              <View style={st.secondary}>
                <GhostButton label={REASON_SKIP} color={paper.inkSoft} onPress={() => answerReason(null)} />
              </View>
            </>
          )}
          {page === 'plan' && <PillButton label={SAVE_PLAN} onPress={() => go('save')} />}
          {page === 'save' && !underAge && (
            <>
              <PillButton label="I am 13 or older · Create account" onPress={() => onCreateAccount(draft)} />
              <View style={st.secondary}>
                <GhostButton label={ALREADY_HAVE_ACCOUNT} color={paper.ink} onPress={onSignIn} />
                <GhostButton label={YOUNGER} color={paper.inkSoft} onPress={() => setUnderAge(true)} />
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
  page: { alignItems: 'stretch', gap: space(3), paddingBottom: space(6) },
  title: { ...type.display, color: paper.ink },
  body: { ...type.body, color: paper.inkSoft },
  bodyInk: { ...type.body, color: paper.ink },
  note: { ...type.small, color: paper.inkSoft },
  quiet: { alignItems: 'flex-start' },
  exchange: { gap: space(3), marginTop: space(2) },
  line: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    borderRadius: radius.card,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
    gap: space(1),
  },
  learnerLine: { alignSelf: 'flex-end', backgroundColor: paper.ground },
  speaker: { ...type.label, color: paper.inkSoft },
  french: { ...type.french, color: paper.ink },
  dim: { color: paper.inkSoft },
  english: { ...type.small, color: paper.inkSoft },
  tutorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3), marginTop: space(2) },
  words: { flex: 1, flexShrink: 1, gap: space(1) },
  reply: {
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: paper.card,
    borderWidth: HAIRLINE,
    borderColor: paper.ink,
    borderRadius: radius.row,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
  },
  replyPressed: { backgroundColor: paper.groundDeep },
  said: { gap: space(2), marginTop: space(2) },
  options: { marginTop: space(2) },
  chosen: { ...type.small, color: paper.ink },
  artStage: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space(2), overflow: 'hidden', borderRadius: radius.row },
  // The picture's size is the registry's; this is placement only.
  art: { alignSelf: 'center' },
  block: { gap: space(2), marginTop: space(3) },
  sceneRow: { paddingVertical: space(2), borderBottomWidth: HAIRLINE, borderBottomColor: paper.line, gap: space(0.5) },
  sceneTitle: { ...type.heading, color: paper.ink },
  trust: { alignSelf: 'stretch', marginTop: space(4), gap: space(3) },
  trustBlock: { gap: space(1) },
  trustTitle: { ...type.bodyStrong, color: paper.ink },
  trustBody: { ...type.small, color: paper.inkSoft },
  trustDivider: { height: HAIRLINE, backgroundColor: paper.lineOnCard },
  consentHint: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  trial: { ...type.bodyStrong, color: paper.ink, marginTop: space(3) },
  footerHint: { ...type.small, color: paper.inkSoft, textAlign: 'center', minHeight: HIT, textAlignVertical: 'center' },
  secondary: { marginTop: space(3), gap: space(2) },
});
