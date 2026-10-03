/**
 * The learner's speaking rhythm, on Profile (F560, F561, F576, F577).
 *
 * It used to be the week story and the rail together, under "Your French
 * life". The three sentences went to the Progress screen, where there is room
 * to say what a week contained. Then the seven-dot rail left too (notebook
 * Phase 4, 2026-09-27): a row of marks is a picture that has to be read, and
 * the design contract turns the week into a sentence on Home and Profile alike.
 * What is left is one plain sentence on one white card.
 *
 * The file kept its name because every test that reads it reads it by name.
 *
 * It owns its read. Profile keeps no focus effect of its own now, so this card
 * reads the activity log on its own focus and hands it whole to
 * `calendarWeekFrom`. Which seven days count and which of them are done is the
 * module's decision, and the sentence is `rhythmSentence`'s: it names no
 * number, carries no target, never names a day as skipped, and says a first
 * week in words on the same rule the rest of `momentum.ts` keeps.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Card } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { loadActivity } from '../progress/activity.ts';
import { calendarWeekFrom, rhythmSentence, type WeekDay } from '../progress/momentum.ts';

export function FrenchLifeCard() {
  // Null until the read answers. A week said from an unanswered read would
  // tell a learner whose week is on its way that it was empty.
  const [week, setWeek] = useState<readonly WeekDay[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadActivity({ strict: true })
        .then((activity) => {
          if (cancelled) return;
          setWeek(calendarWeekFrom(activity, Date.now()));
        })
        .catch(() => {
          // Nobody signed in between focus and read, or storage unavailable.
          // Nothing to say: the week can wait.
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (week === null) return null;

  return (
    <Card style={st.card}>
      <Text style={st.sentence}>{rhythmSentence(week)}</Text>
    </Card>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(2.5) },
  sentence: { ...type.body, color: paper.ink },
});
