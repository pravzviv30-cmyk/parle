/**
 * The focus drill, played one word at a time.
 *
 * This is the other half of the product's headline promise. The end card has
 * always named exactly one sound and attached exactly one drill to it; the pill
 * underneath was an empty handler, so the promise stopped at the naming and the
 * screen's one solid action did nothing at all.
 *
 * Three rules from PEDAGOGY.md shape everything here, and none of them are
 * negotiable for a drill that sits at the end of a session a learner may already
 * feel shaky about:
 *
 * - It never records and never scores. A pronunciation number is never invented,
 *   and there is no scorer in this path, so the honest thing is to teach the
 *   contrast and say nothing about how it went.
 * - It never requires speaking aloud. Next is the quiet twin of saying the word,
 *   and it is the same button either way, so nothing is withheld from someone on
 *   a train.
 * - It cannot be failed. There is no wrong answer to collect, so there is no
 *   wrong answer to react to.
 *
 * It renders in place rather than on a route, which is the pattern ConvoScreen
 * already uses for its recap: a drill is a state the end card is in, not a
 * different place the learner has gone to.
 */

import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { focusDrillSteps, type Drill } from '@luvani/core';

import { Card, Label, PillButton, GhostButton, EarGlyph, ProgressDots } from '../components.tsx';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { HAIRLINE, radius, space, type } from '../theme.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';

export function FocusDrillPlayer({ drill, onDone }: { drill: Drill; onDone: () => void }) {
  const t = useB();
  const st = useThemedStyles(makeSt);
  const insets = useSafeAreaInsets();
  const steps = focusDrillSteps(drill);
  const [index, setIndex] = useState(0);
  const step = steps[index];

  // Say each word as it arrives. The learner came here to hear the difference,
  // and making them press for it first would put a tap between them and the
  // only thing this screen is for.
  useEffect(() => {
    if (step) tutorVoice.speak(step.word);
    return () => tutorVoice.stop();
  }, [step?.word]);

  const next = useCallback(() => {
    if (index + 1 >= steps.length) {
      tutorVoice.stop();
      onDone();
      return;
    }
    setIndex((i) => i + 1);
  }, [index, steps.length, onDone]);

  // Nothing to play. The card should not have offered this, and if it somehow
  // did, going back is better than an empty screen.
  if (!step) {
    return (
      <View style={[st.root, { paddingTop: insets.top + space(6) }]}>
        <Card>
          <Label color={t.muted}>Nothing to practise</Label>
          <Text style={[type.body, { color: t.muted, marginTop: space(2) }]}>
            This sound has no drill written for it yet.
          </Text>
        </Card>
        <View style={{ marginTop: space(4) }}>
          <PillButton label="Back" onPress={onDone} />
        </View>
      </View>
    );
  }

  const last = index + 1 === steps.length;

  return (
    <View style={[st.root, { paddingTop: insets.top + space(4), paddingBottom: insets.bottom + space(6) }]}>
      <View style={st.head}>
        <Label color={t.text}>{drill.title}</Label>
        <ProgressDots total={steps.length} index={index} />
      </View>

      <View style={st.stage}>
        <Text style={[type.frenchLg, { color: t.text, textAlign: 'center' }]}>{step.word}</Text>
        <Text style={[type.notation, { color: t.muted, marginTop: space(1.5) }]}>/{step.ipa}/</Text>
        <Text style={[type.body, { color: t.muted, marginTop: space(2) }]}>{step.gloss}</Text>

        {step.contrast && (
          <View style={st.contrast}>
            <Text style={[type.small, { color: t.muted, textAlign: 'center' }]}>Not to be confused with</Text>
            <View style={st.contrastRow}>
              <Text style={[type.french, { color: t.muted }]}>{step.contrast.word}</Text>
              <Text style={[type.small, { color: t.muted }]}>{step.contrast.gloss}</Text>
            </View>
          </View>
        )}

        <Pressable
          onPress={() => tutorVoice.speak(step.word)}
          accessibilityRole="button"
          accessibilityLabel="Hear it again"
          style={({ pressed }) => [st.hear, pressed && { opacity: 0.6 }]}
        >
          <EarGlyph size={15} color={t.muted} />
          <Text style={[type.small, { color: t.muted }]}>Hear it again</Text>
        </Pressable>
      </View>

      <View style={{ gap: space(2) }}>
        <Text style={[type.small, { color: t.muted, textAlign: 'center' }]}>
          Say it out loud if you can. Nothing is listening.
        </Text>
        <PillButton label={last ? 'Done' : 'Next'} onPress={next} />
        {!last && <GhostButton label="Finish here" onPress={onDone} />}
      </View>
    </View>
  );
}

function makeSt(t: B) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: t.ground, paddingHorizontal: space(5), gap: space(4) },
  head: { gap: space(3) },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space(0) },
  contrast: {
    marginTop: space(5),
    alignItems: 'center',
    gap: space(1),
    borderTopWidth: HAIRLINE,
    borderTopColor: t.line,
    paddingTop: space(4),
    alignSelf: 'stretch',
  },
  contrastRow: { alignItems: 'center', gap: space(0.5) },
  hear: {
    marginTop: space(6),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1.5),
    paddingVertical: space(2),
    paddingHorizontal: space(3.5),
    borderRadius: radius.pill,
    borderWidth: HAIRLINE,
    borderColor: t.field,
  },
});
}
