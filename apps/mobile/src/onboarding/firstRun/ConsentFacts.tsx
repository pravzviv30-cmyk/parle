/**
 * What happens before anything is processed, as three facts with a mark each
 * (come alive, README Part 5.C row 6): the tutor is AI, speech goes to Deepgram
 * for transcription, and the practice is kept on this phone.
 *
 * The words are the disclosure module's own (`onboarding/disclosure.ts`),
 * handed in by the start sheet so the order a test reads there is the order a
 * learner reads here: AI, then processing, then local storage, all before the
 * age question and the opt-ins. Full text, never collapsed. The facts arrive by
 * opacity alone, one after another; legal words are never offset or hidden,
 * and under reduced motion they are simply there.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ROW_WORDS } from '../../components.tsx';
import { Icon } from '../../icons/Icon.tsx';
import { StaggerIn } from '../../motion/StaggerIn.tsx';
import { STAGGER } from '../../motion/tokens.ts';
import { OrbGlyph } from '../../tutor/OrbGlyph.tsx';
import { decorative, paper, radius, space, type } from '../../theme.ts';

function Mark({ children }: { children: ReactNode }) {
  return (
    <View {...decorative} style={st.mark}>
      {children}
    </View>
  );
}

export function ConsentFacts({ ai, processing, local }: { ai: string; processing: string; local: string }) {
  return (
    <View style={st.facts}>
      <StaggerIn from="none" step={STAGGER.loose}>
        <View style={st.row}>
          <Mark>
            <OrbGlyph color={paper.ink} size={22} />
          </Mark>
          <Text style={[type.body, st.words]}>{ai}</Text>
        </View>
        <View style={st.row}>
          <Mark>
            <Icon name="microphone" size={22} color={paper.ink} />
          </Mark>
          <Text style={[type.body, st.words]}>{processing}</Text>
        </View>
        <View style={st.row}>
          <Mark>
            <Icon name="mobile" size={22} color={paper.ink} />
          </Mark>
          <Text style={[type.body, st.words]}>{local}</Text>
        </View>
      </StaggerIn>
    </View>
  );
}

const st = StyleSheet.create({
  facts: { gap: space(3) },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  mark: {
    minWidth: space(10),
    minHeight: space(10),
    borderRadius: radius.control,
    backgroundColor: paper.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { ...ROW_WORDS, color: paper.ink },
});
