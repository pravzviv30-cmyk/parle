import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, BackHandler, View, Text, StyleSheet, Platform, findNodeHandle } from 'react-native';
import { colour, paper, space, type } from '../theme.ts';
import { Card, PillButton, GhostButton, Field,  } from '../components.tsx';
import { CONSENT_HINT, CONSENT_ROW, CONSENT_SUB } from '../analytics/consent.ts';
import type { StoredProfile } from '../profile/store.ts';
import { SwitchRow } from '../settings/SwitchRow.tsx';
import { tutorPersonaOf } from '../tutor/tutorName.ts';
import { type TutorVoiceKey } from '../tutor/tutorVoice.ts';
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
import { OnboardingArtwork } from './OnboardingMotion.tsx';
import { OnboardingLayout, useOnboardingTransition } from './OnboardingLayout.tsx';
import { onboardingProgress } from './onboardingProgress.ts';
import { loadRepairDraft, saveRepairDraft, clearRepairDraft } from './onboardingDraftStore.ts';
import { TutorSelection } from './TutorSelection.tsx';
import { useTutorPreview } from '../tutor/useTutorPreview.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { AgeRefusal } from './AgeRefusal.tsx';
import { c2Ground } from './c2Presentation.ts';
import {
  nameGreeting,
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

export function OnboardingFlow({
  existing,
  onDone,
  onSignOut,
}: {
  existing: StoredProfile | null;
  onDone: (answers: OnboardingAnswers) => void | Promise<boolean | void>;
  onSignOut: () => void;
}) {
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
   * The usage-data answer, and the one learner this flow does not ask.
   *
   * Null from the start for anybody with a record. They have answered this
   * once, and the answer is theirs to change in Settings; a flow they were sent
   * back through by some unrelated new question would otherwise carry a `false`
   * out with it and quietly withdraw a consent they gave. That is why the state
   * starts as null rather than as false, and why the switch below is drawn only
   * where the answer is null to begin with: the render and the value have to
   * agree, or the screen asks nothing and the answers still say no.
   *
   * False for a brand-new learner, because off is where an opt-in starts.
   */
  const [analyticsConsent, setAnalyticsConsent] = useState<boolean | null>(existing === null ? false : null);

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

  const [loaded, setLoaded] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState('');
  const submission = useRef(false);
  const alive = useRef(true);
  const heading = useRef<Text>(null);
  const pageMotion = useOnboardingTransition();
  const preview = useTutorPreview({ active: loaded && page === 'voice' });
  useEffect(() => {
    alive.current = true;
    void loadRepairDraft().then(saved => {
      if (!alive.current) return;
      if (saved) {
        setPage(saved.page); setName(saved.name); setOldEnough(saved.oldEnough);
        setVoice(saved.voice); setCompletedSteps(saved.completedSteps);
        if (existing === null) setAnalyticsConsent(saved.analyticsConsent ?? false);
      }
      setLoaded(true);
    });
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    void saveRepairDraft({ page, name, oldEnough, voice, analyticsConsent, completedSteps });
  }, [loaded, page, name, oldEnough, voice, analyticsConsent, completedSteps]);
  const move = (next: Page, backward = false) => {
    if (!loaded || submission.current || pageMotion.locked.current) return false;
    preview.stop();
    return pageMotion.transition(() => {
      if (!backward) setCompletedSteps(prior => [...new Set([...prior, page])]);
      setPage(next);
    }, backward);
  };
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      const previous = pageBefore(page);
      if (previous && oldEnough !== false) move(previous, true);
      return true;
    });
    return () => back.remove();
  }, [page, oldEnough]);
  useEffect(() => {
    if (!loaded) return;
    const node = heading.current;
    if (Platform.OS === 'web') (node as unknown as { focus?: () => void })?.focus?.();
    else { const handle = findNodeHandle(node); if (handle) AccessibilityInfo.setAccessibilityFocus(handle); }
  }, [page, loaded]);

  const index = PAGES.indexOf(page);
  const refusal = oldEnough === false ? ageGate(false).refusal : null;

  // `onboarding_completed` used to be sent from here, first thing. It is sent
  // from `App.tsx` now, after the consent below has reached the disk, because
  // `trackProductEvent` reads that answer on every event and one sent from here
  // would race the write. The ones it would drop are exactly the learners who
  // had just said yes, which is the worst possible sample to be missing.
  const complete = async (chosen: TutorVoiceKey | null) => {
    if (submission.current || pageMotion.locked.current || oldEnough !== true) return;
    submission.current = true;
    const owner = scopeGeneration();
    setBusy(true); setIssue(''); preview.stop();
    try {
      const result = await onDone(answersFrom({
        name, ageConfirmed: oldEnough === true, motivation: existing?.motivation ?? null,
        tutorVoice: chosen, analyticsConsent,
      }));
      if (owner !== scopeGeneration()) return;
      if (result === false) throw new Error('save');
      await clearRepairDraft();
    } catch {
      if (alive.current && owner === scopeGeneration()) setIssue('Your choices could not be saved. Please try again.');
    } finally {
      submission.current = false;
      if (alive.current && owner === scopeGeneration()) setBusy(false);
    }
  };

  const confirmAge = () => {
    setOldEnough(true);
    move('name');
  };

  const ink = paper.ink;
  const progress = onboardingProgress({ page, completed: completedSteps, repair: true });

  // The page bodies, hoisted above the return so they are written before the
  // footer in source. See the header note: the first-occurrence source walks
  // depend on body-before-footer.
  if (!loaded) return <View style={{ flex: 1, backgroundColor: paper.ground, justifyContent: 'center', alignItems: 'center' }}><Text style={st.sub}>Loading your choices…</Text></View>;

  const body = (
    <>
      {/* The gate comes first, and deliberately before the name. Asking
          somebody's name and then turning them away takes a personal
          detail from a learner the product has already decided not to
          serve, and no amount of not persisting it makes that the right
          order to ask in. */}
      {page === 'age' && (
        <>
          <Text ref={heading} {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as object) : {})} accessibilityRole="header" style={[st.question, { color: ink }]}>
            {AGE_QUESTION}
          </Text>
          <Text style={[st.sub, { color: ink }]}>{AGE_SUB}</Text>
          {refusal !== null && <AgeRefusal text={refusal} onSignOut={onSignOut} />}
          {/* Gone once they have said they are younger, so the honest refusal
              is not shown with the way to say it again still under it. */}
          {oldEnough !== false && (
            <View style={st.secondary}>
              <GhostButton label={AGE_DENY} onPress={() => setOldEnough(false)} />
            </View>
          )}
        </>
      )}

      {page === 'name' && (
        <>
          <Text ref={heading} {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as object) : {})} accessibilityRole="header" style={[st.question, { color: ink }]}>
            {NAME_QUESTION}
          </Text>
          <Text style={[st.sub, { color: ink }]}>{nameGreeting(voice ?? existing?.tutorVoice)}</Text>
          <Card style={{ marginTop: space(4) }}>
            {/* A visible label rather than a placeholder alone: a
                placeholder disappears the moment somebody types, and it is
                the only thing assistive tech had to go on here. */}
            <Field
              label={NAME_LABEL}
              placeholder="e.g. James"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoFocus={Platform.OS === 'web'}
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={() => move('meet')}
            />
          </Card>
          <Text style={[st.hint, { color: ink }]}>{NAME_SKIP_HINT}</Text>
        </>
      )}

      {page === 'meet' && (
        <>
          <Text ref={heading} {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as object) : {})} accessibilityRole="header" style={[st.question, { color: ink }]}>
            {MEET_TITLE(persona)}
          </Text>
          <View style={st.lines}>
            <Text style={st.line}>{MEET_AI(persona)}</Text>
            <Text style={st.line}>{MEET_PRIVACY(persona)}</Text>
            <Text style={st.line}>{MEET_MIC}</Text>
            <Text style={st.line}>{MEET_TYPING}</Text>
          </View>
          <Text style={[st.hint, { color: ink }]}>{MEET_MORE}</Text>
          {/* Drawn only for a learner with no record at all, which is the whole
              of "asked once". Anyone else has answered this already, on their
              own first run or in Settings, and a screen they were sent back
              through for an unrelated reason has no business taking the answer
              again. `analyticsConsent` starts null for them for the same
              reason, so nothing is written either way. */}
          {existing === null && (
            <>
              <Card style={st.consent}>
                <SwitchRow
                  first
                  title={CONSENT_ROW}
                  sub={CONSENT_SUB}
                  value={analyticsConsent === true}
                  onChange={setAnalyticsConsent}
                  accessibilityLabel={CONSENT_ROW}
                />
              </Card>
              <Text style={st.consentHint}>{CONSENT_HINT}</Text>
            </>
          )}
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
          <Text ref={heading} {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as object) : {})} accessibilityRole="header" style={[st.question, { color: ink }]}>
            {VOICE_TITLE}
          </Text>
          <Text style={[st.hint, { color: ink }]}>{VOICE_AI}</Text>
          <TutorSelection chosen={voice} preview={preview} onChoose={setVoice} />
          <Text style={[st.hint, { color: ink }]}>{VOICE_SKIP_HINT(persona)}</Text>
        </>
      )}
    </>
  );

  return (
    <OnboardingLayout page={page} progress={progress} avoidKeyboard actionInScroll={page === 'name'}
      ground={c2Ground(page)}
      footer={
        // The one action per page. Gone on the gate once they have said they
        // are younger: a refusal with the way through still sitting under it is
        // not a gate, it is a suggestion. Nothing is persisted, so closing the
        // app and coming back offers the question again, which is the escape
        // hatch for a mis-tap and is deliberately not a button.
        <>
          {page === 'age' && oldEnough !== false && <PillButton label={AGE_CONFIRM} onPress={confirmAge} disabled={!loaded} />}
          {page === 'name' && <PillButton label="Continue" onPress={() => move('meet')} disabled={!loaded} />}
          {page === 'meet' && <PillButton label="Continue" onPress={() => move('voice')} disabled={!loaded} />}
          {page === 'voice' && (
            <>
              <PillButton label={MEET_PILL} onPress={() => void complete(voice)} disabled={busy} />
              {/* The way past, and it is a ghost rather than a second pill on
                  purpose: one solid action per screen. It goes to the same place
                  the pill does, carrying nothing, which is what makes skipping an
                  answer instead of a question asked again later. It passes null
                  itself rather than scheduling `setVoice(null)` and completing in
                  the same tick, which a closure over `voice` would never see. */}
              <View style={st.secondary}>
                <GhostButton label={VOICE_SKIP} onPress={() => void complete(null)} disabled={busy} />
              </View>
            </>
          )}
        </>
      }
    >
      <Animated.View style={[st.page, pageMotion.style]}>
        <OnboardingArtwork name={page === 'name' ? 'celebrate-first-line' : page === 'meet' ? 'state-headphones' : 'state-notebook'} response="welcome" event={index} />
        {loaded ? body : <Text style={st.sub}>Loading your choices…</Text>}
        {!!issue && <Text accessibilityRole="alert" style={st.hint}>{issue}</Text>}
      </Animated.View>
    </OnboardingLayout>
  );
}

const st = StyleSheet.create({
  // Notebook Phase 4 (2026-09-27): each page sits on the paper itself. The
  // feature panel, its ink outline and the three retired rasters (the cake,
  // the wave, the welcome bubbles) are gone; the words and the order are not.
  page: { paddingTop: space(3), marginBottom: space(4), gap: space(3) },
  question: { ...type.display, color: paper.ink, textAlign: 'center' },
  sub: { ...type.body, color: paper.inkSoft, marginTop: space(2), textAlign: 'center' },
  hint: { ...type.small, color: paper.inkSoft, textAlign: 'center', marginTop: space(3) },
  lines: { gap: space(3), marginTop: space(4) },
  voices: { gap: space(3), marginTop: space(5), alignSelf: 'stretch' },
  // Left, not centred: four multi-sentence lines set centred read as a plaque
  // of fine print. Under the centred title and art, left-set they read as
  // reassurance. F359.
  line: { ...type.body, color: paper.inkSoft, textAlign: 'left' },
  // Stretched, like the voice cards. The row inside carries a title on one edge
  // and a switch on the other, so a card sized to its own text would move the
  // control about from phone to phone.
  consent: { alignSelf: 'stretch', marginTop: space(5) },
  // Left and under the row it belongs to, because it labels a control rather
  // than addressing the reader the way the centred hints above it do.
  consentHint: { ...type.small, color: paper.inkSoft, textAlign: 'left', alignSelf: 'stretch', marginTop: space(2) },
  secondary: { marginTop: space(5) },
});
