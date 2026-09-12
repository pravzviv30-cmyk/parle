/**
 * The learner's week, on Profile (F560, F561).
 *
 * Both mockups put "this week" here, and F233 allows `progress/story.ts`
 * exactly one importer in the whole app so that nothing scheduled or notified
 * can carry a learner's week anywhere. This file is that importer now; My
 * French keeps the passport and the shelf.
 *
 * It owns its reads. Profile allows itself exactly one focus effect and that
 * one belongs to the reminder and the level, so this card reads the four
 * things the story is made of on its own focus, from its own file, and hands
 * all four to the module whole. Narrowing to the week is the module's job and
 * its guarantee: the no-delta rule holds because nothing here can see a prior
 * week either.
 *
 * The rhythm beside the sentences is the same rail Home's days card draws,
 * from the same log, so the two can never disagree. It names no number and
 * carries no target; a first week draws seven waiting marks and one start
 * line, worded as an invitation, on the same rule Home's momentum block keeps.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Card, Label, WeekRail } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { loadHistory } from '../progress/store.ts';
import { loadActivity } from '../progress/activity.ts';
import { weekRailFrom } from '../progress/momentum.ts';
import { hasStory, storyFrom, type WeekStory } from '../progress/story.ts';
import { loadConversationPacks } from '../conversationPacks/store.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { WEEK_CAPTION, WEEK_LABEL, WEEK_START } from './frenchLife.ts';


export function FrenchLifeCard() {
  // Null until the reads answer. A card drawn from an unanswered read would
  // show a first week to a learner whose week is on its way.
  const [story, setStory] = useState<WeekStory | null>(null);
  const [rail, setRail] = useState<readonly boolean[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([loadHistory(), loadActivity(), loadConversationPacks(), loadMissionCompletions()])
        .then(([history, activity, packs, completions]) => {
          if (cancelled) return;
          const now = Date.now();
          // Whole, every one of them. Which seven days count is story.ts's
          // decision, and filtering here would walk straight past it.
          setStory(storyFrom({ sessions: history, activity, packs, completions, now }));
          setRail(weekRailFrom(activity, now));
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

  if (story === null || rail === null) return null;

  return (
    <Card style={st.card}>
      <View accessibilityRole="summary">
        <Label>{WEEK_LABEL}</Label>
        <View style={st.lines}>
          {hasStory(story) ? (
            story.sentences.map((sentence) => (
              <Text key={sentence} style={[type.body, { color: paper.ink }]}>
                {sentence}
              </Text>
            ))
          ) : (
            <Text style={[type.body, { color: paper.ink }]}>{WEEK_START}</Text>
          )}
        </View>
        <WeekRail week={rail} />
        <Text style={st.caption}>{WEEK_CAPTION}</Text>
      </View>
    </Card>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(2.5) },
  lines: { marginTop: space(2), gap: space(2) },
  caption: { ...type.small, color: paper.inkSoft, marginTop: space(3) },
});
