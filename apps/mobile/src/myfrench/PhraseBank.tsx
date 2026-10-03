/**
 * The phrase bank on My French: the newest kept phrases, each with audio that
 * says whose voice it is (notebook Phase 3, 2026-09-27).
 *
 * Hairline rows rather than cards, the French in the French face above its
 * meaning, and one quiet Hear per row. A recorded line plays the bundled
 * recording through the shared recorded player; any other line is the phone's
 * voice, and the row says so under it (`myfrench/notebook.ts` chose which).
 * Playback only: nothing here records or scores.
 *
 * A voice started here stops when the learner leaves (F470): when the page
 * unmounts, when the tab loses focus (tabs stay mounted, so unmounting alone
 * never happened on a tab switch) and when the app goes to the background.
 * The recorded player lets go of its own recording on the same three. The
 * phone's voice is stopped only if this bank started it, so a blur never
 * silences whatever the next screen has begun to say.
 */

import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import { GhostButton, Ledger } from '../components.tsx';
import { HAIRLINE, paper, space, type } from '../theme.ts';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { useRecordedLine } from '../practice/recordedPlayer.ts';
import { NOTEBOOK, phraseControlLabel, type PhraseBankRow } from './notebook.ts';

export function PhraseBank({ rows }: { rows: readonly PhraseBankRow[] }) {
  const recorded = useRecordedLine();
  // The row the phone's voice is saying, so its control offers Stop.
  const [speaking, setSpeaking] = useState<string | null>(null);
  // The same, for the leave handlers, which must not read a stale render.
  const speakingRef = useRef<string | null>(null);
  speakingRef.current = speaking;
  const focused = useIsFocused();

  useEffect(() => () => tutorVoice.stop(), []);

  const leave = () => {
    if (speakingRef.current !== null) { tutorVoice.stop(); setSpeaking(null); }
    recorded.stop();
  };
  const leaveRef = useRef(leave);
  leaveRef.current = leave;

  useEffect(() => {
    if (!focused) leaveRef.current();
  }, [focused]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') leaveRef.current(); });
    return () => subscription.remove();
  }, []);

  const play = (row: PhraseBankRow) => {
    tutorVoice.stop();
    setSpeaking(null);
    if (row.audio.kind === 'recorded') {
      recorded.toggle(row.audio.asset);
      return;
    }
    recorded.stop();
    if (speaking === row.id) return;
    setSpeaking(row.id);
    tutorVoice.speak(row.fr, { onDone: () => setSpeaking(null) });
  };

  const isPlaying = (row: PhraseBankRow): boolean =>
    row.audio.kind === 'recorded' ? recorded.playing === row.audio.asset : speaking === row.id;

  return (
    <Ledger>
      {rows.map((row) => (
        <View key={row.id} style={st.row}>
          <View style={st.words}>
            <Text style={st.french}>{row.fr}</Text>
            <Text style={st.gloss}>{row.en}</Text>
            <Text style={st.gloss}>{row.audio.label}</Text>
          </View>
          <GhostButton
            label={isPlaying(row) ? NOTEBOOK.stop : NOTEBOOK.hear}
            color={paper.ink}
            accessibilityLabel={phraseControlLabel(row.fr, row.audio.label, isPlaying(row))}
            onPress={() => play(row)}
          />
        </View>
      ))}
    </Ledger>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(3),
    borderBottomWidth: HAIRLINE,
    borderBottomColor: paper.line,
  },
  words: { flex: 1, minWidth: 0, gap: space(0.5) },
  french: { ...type.frenchSm, color: paper.ink },
  gloss: { ...type.small, color: paper.inkSoft },
});
