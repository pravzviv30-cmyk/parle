/**
 * Onboarding — four quiet steps on one screen.
 *
 * Why they came, what they want, one spoken hello, then the plan: a single calm
 * plaque naming their first line. One question at a time, because the moment a
 * new learner sees three things at once they are back in the app they left.
 *
 * The warm-up is a first taste, not a test. The tutor says bonjour, the learner
 * says it back out loud, and nothing is scored or judged — the point is that
 * their mouth has made a French sound before any lesson begins.
 */

import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CAFE_LESSON } from '@parle/core';
import { enamel, signal, space, type, radius, HIT } from '../theme.ts';
import { Plaque, LabeledTag, DirectionPlaque, MicGlyph, EarGlyph, ArrowRight } from '../components.tsx';
import * as tutorVoice from '../speech/tutorVoice.ts';

/** The one line of the warm-up. Short enough that saying it back is a given. */
const WARMUP_LINE = 'Bonjour !';

const MOTIVATIONS = [
  { tag: 'trip', fr: 'Un voyage', en: 'A trip coming up' },
  { tag: 'someone', fr: "Quelqu'un que j'aime", en: 'Someone I love' },
  { tag: 'work', fr: 'Le travail', en: 'For work' },
  { tag: 'want', fr: "L'envie", en: 'Because I want to' },
] as const;

const GOALS = [
  { tag: 'conversation', fr: 'Tenir une vraie conversation', en: 'Hold a real conversation' },
  { tag: 'travel', fr: 'Me débrouiller en voyage', en: 'Order and get by' },
  { tag: 'understand', fr: 'Comprendre autour de moi', en: 'Understand French around me' },
] as const;

type Step = 'why' | 'goal' | 'warmup' | 'plan';

export function OnboardingScreen({ onDone }: { onDone: (motivation: string, goal: string) => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('why');
  const [motivation, setMotivation] = useState<string>('want');
  const [goal, setGoal] = useState<string>('conversation');

  // The tutor says hello the moment the warm-up appears. Keyless: this is the
  // device synthesizer, the same voice the demo lesson uses.
  useEffect(() => {
    if (step !== 'warmup') return;
    void tutorVoice.available().then((ok) => {
      if (ok) tutorVoice.speak(WARMUP_LINE);
    });
    return () => tutorVoice.stop();
  }, [step]);

  // Never leave a voice speaking past the screen that started it.
  useEffect(() => () => tutorVoice.stop(), []);

  const lesson = CAFE_LESSON;

  return (
    <View style={[st.root, { paddingTop: insets.top + space(6), paddingBottom: insets.bottom + space(6) }]}>
      {step === 'why' && (
        <>
          <View>
            <LabeledTag fr="POURQUOI" en="Why French" />
            <Text style={[type.heading, { color: enamel.white, marginTop: space(3) }]}>What brings you here?</Text>
          </View>
          <View style={st.options}>
            {MOTIVATIONS.map((m) => (
              <DirectionPlaque
                key={m.tag}
                text={m.fr}
                gloss={m.en}
                onPress={() => {
                  setMotivation(m.tag);
                  setStep('goal');
                }}
              />
            ))}
          </View>
          <View style={st.footer} />
        </>
      )}

      {step === 'goal' && (
        <>
          <View>
            <LabeledTag fr="OBJECTIF" en="Your goal" />
            <Text style={[type.heading, { color: enamel.white, marginTop: space(3) }]}>Where should this take you?</Text>
          </View>
          <View style={st.options}>
            {GOALS.map((g) => (
              <DirectionPlaque
                key={g.tag}
                text={g.fr}
                gloss={g.en}
                onPress={() => {
                  setGoal(g.tag);
                  setStep('warmup');
                }}
              />
            ))}
          </View>
          <View style={st.footer} />
        </>
      )}

      {step === 'warmup' && (
        <>
          <View>
            <LabeledTag fr="ÉCHAUFFEMENT" en="Warm-up" />
            <Text style={[type.heading, { color: enamel.white, marginTop: space(3) }]}>Your tutor says hello.</Text>
            <Text style={[type.body, { color: enamel.whiteMuted, marginTop: space(2) }]}>Say it back, out loud. That is the whole exercise.</Text>
          </View>

          <View style={st.centerFill}>
            <Plaque raised>
              <Text style={[type.plaque, { color: enamel.white, textAlign: 'center' }]}>BONJOUR</Text>
              <Text style={[type.body, { color: enamel.whiteMuted, textAlign: 'center', marginTop: space(2) }]}>hello</Text>
              <Text style={[type.notation, { color: enamel.whiteFaint, textAlign: 'center', marginTop: space(1.5) }]}>/bɔ̃ʒuʁ/</Text>
              <Pressable
                onPress={() => tutorVoice.speak(WARMUP_LINE)}
                accessibilityRole="button"
                accessibilityLabel="Hear it again"
                style={({ pressed }) => [st.hear, pressed && { opacity: 0.6 }]}
              >
                <EarGlyph size={15} color={enamel.whiteMuted} />
                <Text style={[type.small, { color: enamel.whiteMuted }]}>écouter · hear it</Text>
              </Pressable>
            </Plaque>
          </View>

          <View style={st.controls}>
            <Pressable
              onPress={() => {
                tutorVoice.stop();
                setStep('plan');
              }}
              accessibilityRole="button"
              accessibilityLabel="Say it back"
              style={({ pressed }) => [st.speak, pressed && st.speakPressed]}
            >
              <MicGlyph size={28} color={enamel.white} />
              <Text style={[type.tag, { color: enamel.white, marginTop: space(1) }]}>PARLEZ</Text>
            </Pressable>
            <Text style={[type.small, { color: enamel.whiteMuted, marginTop: space(2) }]}>say it back</Text>
            <Pressable
              onPress={() => {
                tutorVoice.stop();
                setStep('plan');
              }}
              accessibilityRole="button"
              accessibilityLabel="Skip the warm-up"
              style={({ pressed }) => [st.skip, pressed && { opacity: 0.6 }]}
            >
              <Text style={[type.small, { color: enamel.whiteFaint }]}>passer · skip</Text>
            </Pressable>
          </View>
        </>
      )}

      {step === 'plan' && (
        <>
          <View>
            <LabeledTag fr="VOTRE PREMIÈRE LIGNE" en="Your first line" />
            <Text style={[type.body, { color: enamel.whiteMuted, marginTop: space(3) }]}>One short scene. You speak on every stop.</Text>
          </View>

          <View style={st.centerFill}>
            <Plaque raised>
              <LabeledTag fr={`LIGNE ${lesson.cefr}`} en="Where the line begins" color={enamel.whiteFaint} />
              <Text style={[type.plaqueSmall, { color: enamel.white, marginTop: space(3) }]}>{lesson.title.toUpperCase()}</Text>
              <Text style={[type.body, { color: enamel.whiteMuted, marginTop: space(1.5) }]}>{lesson.titleEn}</Text>
              <View style={st.soundRow}>
                {lesson.targetPhonemes.map((p) => (
                  <View key={p} style={st.sound}>
                    <Text style={[type.notation, { color: enamel.white }]}>/{p}/</Text>
                  </View>
                ))}
              </View>
            </Plaque>
          </View>

          <Pressable
            onPress={() => onDone(motivation, goal)}
            accessibilityRole="button"
            style={({ pressed }) => [st.begin, pressed && { opacity: 0.85 }]}
          >
            <Text style={[type.tag, { color: enamel.field }]}>C'EST PARTI · LET'S GO</Text>
            <ArrowRight size={16} color={enamel.field} />
          </Pressable>
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: enamel.ground, paddingHorizontal: space(5), justifyContent: 'space-between', gap: space(6) },
  options: { gap: space(2.5) },
  /** Keeps the question block sitting high on the choice steps. */
  footer: { minHeight: space(10) },
  centerFill: { flex: 1, justifyContent: 'center' },
  hear: {
    marginTop: space(3),
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
  },
  controls: { alignItems: 'center' },
  // The same red speak control the session uses — the warm-up is a rehearsal of
  // the exact gesture the lesson will ask for.
  speak: {
    width: 108,
    height: 108,
    borderRadius: radius.bullet,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    backgroundColor: signal.live,
    borderColor: enamel.white,
    shadowColor: signal.live,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  speakPressed: { transform: [{ scale: 0.96 }] },
  skip: { marginTop: space(2), minHeight: HIT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(4) },
  soundRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(3.5) },
  sound: {
    borderWidth: 1,
    borderColor: 'rgba(242,239,228,0.3)',
    borderRadius: 3,
    paddingVertical: space(1.5),
    paddingHorizontal: space(2.5),
  },
  begin: {
    minHeight: HIT + 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    backgroundColor: enamel.white,
    borderRadius: radius.plaque,
  },
});
