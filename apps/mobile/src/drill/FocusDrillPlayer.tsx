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
 *
 * 2026-10-31 drill B v2 (UI-016; drill-b.md "Sound"): it stands in the one
 * drill frame on the speak family's peach stage. The close (named "Leave the
 * sound drill", its title carrying the step) and the progress dots make the header; the stage holds the sound's
 * name, the word with its IPA and gloss, and the pair it is not to be confused
 * with; Hear it again sits under the stage; Next is the lip primary at the
 * foot, with "Finish here" under it.
 */

import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { focusDrillSteps, type Drill } from '@luvani/core';

import { PillButton, GhostButton, EarGlyph, ProgressDots } from '../components.tsx';
import { ScreenHeader } from '../layout.tsx';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { HIT, frenchText, space, type } from '../theme.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { DrillFrame, DrillPrompt } from './DrillFrame.tsx';
import { drillStage } from './drillStage.ts';

export function FocusDrillPlayer({ drill, onDone }: { drill: Drill; onDone: () => void }) {
  const t = useB();
  const st = useThemedStyles(makeSt);
  const stage = drillStage('sound-drill', t.mode);
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

  const last = step === undefined || index + 1 === steps.length;
  const header = (
    <ScreenHeader
      // The centre slot is one element named by the title, so the step position
      // rides in the title or a screen reader never hears it.
      title={step ? `${drill.title}, step ${index + 1} of ${steps.length}` : drill.title}
      // The foot link is also "Finish here"; the close disc gets its own name.
      leave={{ onPress: onDone, label: 'Finish here', accessibilityLabel: 'Leave the sound drill', close: true }}
      centre={step ? <ProgressDots total={steps.length} index={index} ground="paper" track={t.peachTrack} /> : null}
    />
  );

  // Nothing to play. The card should not have offered this, and if it somehow
  // did, going back is better than an empty screen.
  if (!step) {
    return (
      <DrillFrame
        stage={stage}
        header={header}
        eyebrow="Nothing to practise"
        prompt="This sound has no drill written for it yet."
        primary={<PillButton label="Back" onPress={onDone} lip />}
      />
    );
  }

  return (
    <DrillFrame
      stage={stage}
      header={header}
      eyebrow={drill.title}
      prompt={<View style={st.word}>
        <DrillPrompt center><Text {...frenchText} style={type.frenchLg}>{step.word}</Text></DrillPrompt>
        <Text style={[type.notation, { color: t.muted }]}>/{step.ipa}/</Text>
        <Text style={[type.body, { color: t.muted }]}>{step.gloss}</Text>
      </View>}
      stageExtra={step.contrast ? (
        <View style={st.contrast}>
          <Text style={[type.small, { color: t.muted, textAlign: 'center' }]}>Not to be confused with</Text>
          <View style={st.contrastRow}>
            <Text {...frenchText} style={[type.french, { color: t.text }]}>{step.contrast.word}</Text>
            <Text style={[type.small, { color: t.muted }]}>{step.contrast.gloss}</Text>
          </View>
        </View>
      ) : undefined}
      primary={
        <View style={{ gap: space(2) }}>
          <Text style={[type.small, { color: t.muted, textAlign: 'center' }]}>
            Say it out loud if you can. Nothing is listening.
          </Text>
          <PillButton label={last ? 'Done' : 'Next'} onPress={next} lip />
          {!last && <GhostButton label="Finish here" onPress={onDone} />}
        </View>
      }
    >
      <Pressable
        onPress={() => tutorVoice.speak(step.word)}
        accessibilityRole="button"
        accessibilityLabel="Hear it again"
        style={({ pressed }) => [st.hear, pressed && { opacity: 0.7 }]}
      >
        <EarGlyph size={16} color={t.text} />
        <Text style={[type.label, { color: t.text }]}>Hear it again</Text>
      </Pressable>
    </DrillFrame>
  );
}

function makeSt(t: B) {
  return StyleSheet.create({
    word: { alignItems: 'center', gap: space(1), paddingVertical: space(2) },
    contrast: { alignItems: 'center', gap: space(1), paddingTop: space(2) },
    contrastRow: { alignItems: 'center', gap: space(0.5) },
    // The board's chip: the card on a 3pt line lip.
    hear: {
      alignSelf: 'center',
      minHeight: HIT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space(1.5),
      paddingHorizontal: space(4),
      borderRadius: HIT / 2,
      backgroundColor: t.card,
      borderBottomWidth: 3,
      borderBottomColor: t.line,
    },
  });
}
