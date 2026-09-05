/**
 * The word of the day.
 *
 * One French word, what it means, how it is actually used, and one sentence
 * somebody would really say. The word itself comes from `dailyPick(DAILY_WORDS,
 * now)` in Home's focus effect, so this card decides nothing: it is handed the
 * day's entry and sets it. Which word Tuesday gets is a pure function of the
 * day in `packages/core/src/daily/pick.ts`, which is the only place that
 * question is answered.
 *
 * The drawing is today's, one of twenty. Which one is `dailyPick(WORD_SCENES,
 * now)` on Home's single clock reading, and the key becomes a drawing in
 * `home/WordScene.tsx`; this card is handed the key and hands it on, exactly
 * as it is handed the word. It is decorative in the strict sense: every word
 * on this card is on the card in text, so a learner who never sees the picture
 * loses nothing at all. Each scene owns its own reduce-motion branch and takes
 * `paused` from the tab, because a bottom tab stays mounted after its first
 * visit and a loop left running here would move a picture nobody is looking at
 * for the rest of the session.
 *
 * The words take the rest of the row at `flex: 1, minWidth: 0`, so at the
 * largest reading size they wrap rather than push the scene off the card.
 */

import { StyleSheet, Text, View } from 'react-native';
import type { DailyWord } from '@luvani/core';

import { Card, Label } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { WordScene } from './WordScene.tsx';
import type { WordSceneKey } from './wordScenes.ts';

export function WordOfDayCard({
  word,
  scene,
  paused,
}: {
  word: DailyWord;
  scene: WordSceneKey;
  paused: boolean;
}) {
  return (
    <Card style={st.card}>
      <View style={st.head}>
        <WordScene scene={scene} width={108} paused={paused} />
        <View style={st.words}>
          <Label>Word of the day</Label>
          <Text style={st.word}>{word.fr}</Text>
          <Text style={st.meaning}>{word.en}</Text>
        </View>
      </View>
      <Text style={st.note}>{word.note}</Text>
      <Text style={st.example}>{word.exampleFr}</Text>
      <Text style={st.exampleEn}>{word.exampleEn}</Text>
    </Card>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(5) },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  // The words take what is left of the row and may shrink to nothing before
  // the scene does, which is what stops a long word squeezing the card sideways.
  words: { flex: 1, minWidth: 0 },
  // The serif carries every French line the learner reads, and this is one.
  word: { ...type.frenchLg, color: paper.ink, marginTop: space(1.5) },
  meaning: { ...type.body, color: paper.inkSoft, marginTop: space(0.5) },
  note: { ...type.body, color: paper.ink, marginTop: space(3) },
  example: { ...type.french, color: paper.ink, marginTop: space(3) },
  exampleEn: { ...type.small, color: paper.inkSoft, marginTop: space(1) },
});
