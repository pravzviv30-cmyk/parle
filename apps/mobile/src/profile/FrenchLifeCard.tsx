/**
 * The learner's speaking rhythm, on Profile (F560, F561, F576, F577).
 *
 * It used to be the week story and the rail together, under "Your French
 * life". The three sentences went to the Progress screen, where there is room
 * to say what a week contained, and what is left here is the picture a learner
 * came to this tab for: Monday to Sunday, one mark per day, the days named.
 *
 * The file kept its name because every test that reads it reads it by name.
 *
 * It owns its read. Profile keeps no focus effect of its own now, so this card
 * reads the activity log on its own focus and hands it whole to
 * `calendarWeekFrom`. Which seven days count and which of them are done is the
 * module's decision, and there is no second opinion here.
 *
 * ## Violet, and hidden, and said in words
 *
 * The marks are the identity violet: the founder chose it for the calendar
 * record, and `components.tsx` writes down why a diary of days is not a state
 * report. The rail itself is hidden from assistive technology, because seven
 * letters read aloud are not a week, so the panel carries `rhythmSentence` as
 * its own label and a screen reader hears one plain sentence instead.
 *
 * It names no number and carries no target. A first week draws seven waiting
 * marks and says so in words, on the same rule the rest of `momentum.ts` keeps.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { TintPanel, WeekRail } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { loadActivity } from '../progress/activity.ts';
import { WEEKDAY_LABELS, calendarWeekFrom, rhythmSentence, type WeekDay } from '../progress/momentum.ts';
import { RHYTHM_TINT } from './rhythmTint.ts';
import { WEEK_CAPTION } from './frenchLife.ts';

export function FrenchLifeCard() {
  // Null until the read answers. A week drawn from an unanswered read would
  // show an empty one to a learner whose week is on its way.
  const [week, setWeek] = useState<readonly WeekDay[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadActivity()
        .then((activity) => {
          if (cancelled) return;
          setWeek(calendarWeekFrom(activity, Date.now()));
        })
        .catch(() => {
          // Nobody signed in between focus and read, or storage unavailable.
          // Nothing to draw and nothing to say: the week can wait.
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (week === null) return null;

  return (
    // The label sits on a wrapper rather than on `TintPanel`, which takes a
    // tint, children and a style and nothing else. One accessible node either
    // way: the rail inside is hidden and the caption is read after the week.
    <View accessible accessibilityLabel={rhythmSentence(week)}>
      <TintPanel tint={RHYTHM_TINT} style={st.panel}>
        <WeekRail week={week.map((day) => day.state === 'done')} labels={WEEKDAY_LABELS} />
        <Text style={st.caption}>{WEEK_CAPTION}</Text>
      </TintPanel>
    </View>
  );
}

const st = StyleSheet.create({
  panel: { marginTop: space(2.5), paddingHorizontal: space(4), paddingBottom: space(4) },
  caption: { ...type.small, color: paper.inkSoft, marginTop: space(3), textAlign: 'center' },
});
