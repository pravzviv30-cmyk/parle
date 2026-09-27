/**
 * One goal, one thing to try, and what came of it (Stage 4, item 1).
 *
 * A pushed screen reached from a goal row on My French. It shows the goal in
 * the learner's own words, one mission `next.ts` chose for it (worded as a
 * match only when the table matched, and as a starting point otherwise), the
 * authored listening preview for that mission, and one pill that opens the
 * conversation carrying the goal step. The step is recorded by ConvoScreen,
 * once the room is real; nothing here writes it.
 *
 * Under that, the trail: `goalEvidence` joins each step to its saved
 * conversation by id, to that conversation's own practice outcome, and to the
 * learner's own "used outside" report. Nothing is attributed by time. The
 * report is a quiet control on the row and writes ids only; it touches no
 * review card, activity entry, XP, drill, momentum or practice time.
 *
 * Every read is bound to the account before it starts. Loading, a read that
 * failed and a goal with nothing on its trail yet are three different things
 * on screen. The only digits are a date.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { MISSIONS, type ConversationPack } from '@luvani/core';

import { GhostButton, Label, Ledger, LedgerRow, PillButton } from '../components.tsx';
import { DocumentGlyph } from '../glyphs.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { accent, paper, space, type } from '../theme.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { NEEDS_CONNECTION_AND_MINUTES } from '../copy/access.ts';
import { ListeningPreview } from '../missions/ListeningPreview.tsx';
import { loadConversationPacks } from '../conversationPacks/store.ts';
import { loadPracticeHistory } from '../practice/historyStore.ts';
import type { PracticeEvent } from '../practice/history.ts';
import { factKey } from '../profile/memory.ts';
import { scopeGeneration } from '../storage/scope.ts';
import type { RootStackParamList } from '../nav/types.ts';
import type { GoalStepEvent } from './model.ts';
import { loadGoalSteps, recordUsedOutside } from './store.ts';
import { goalTaskOf, missionOfTask, nextLine, nextTaskForGoal } from './next.ts';
import { goalRouteKey } from './rows.ts';
import { goalEvidence, type GoalTrailRow } from './evidence.ts';
import {
  GOAL_GONE,
  GOAL_GONE_OPEN,
  GOAL_LABEL,
  GOAL_LOADING,
  GOAL_NEXT_LABEL,
  GOAL_PRACTICE_LINE,
  GOAL_RETRY,
  GOAL_START,
  GOAL_TRAIL_EMPTY,
  GOAL_TRAIL_LABEL,
  GOAL_UNREAD,
  USED_OUTSIDE_CONTROL,
  USED_OUTSIDE_REFUSED,
  USED_OUTSIDE_SAID,
  rehearsedOn,
} from './copy.ts';

export function GoalStepScreen() {
  const nav = useNavigation<{
    goBack: () => void;
    canGoBack: () => boolean;
    navigate: (screen: string, params?: object) => void;
  }>();
  const route = useRoute<RouteProp<RootStackParamList, 'GoalStep'>>();
  const { profile } = useProfile();
  // The route carries an opaque key, never the goal's words: on the web a
  // route's params are the address bar. A cold link with no key, or a goal
  // since removed, finds nothing and reads as a goal that is gone.
  const routeKey = route.params?.key ?? '';
  // The goal as the profile holds it now, in the learner's words, or null.
  const current = profile.learnerGoals.find((held) => goalRouteKey(held) === routeKey) ?? null;
  const goalKey = current === null ? '' : factKey(current);

  const [steps, setSteps] = useState<readonly GoalStepEvent[]>([]);
  const [packs, setPacks] = useState<readonly ConversationPack[]>([]);
  const [history, setHistory] = useState<readonly PracticeEvent[]>([]);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'unread'>('loading');
  const [attempt, setAttempt] = useState(0);
  // The step whose report is being written, so a second tap cannot queue a second write.
  const [reporting, setReporting] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // Bound to the account before any read, so a result from the previous
      // account is dropped rather than drawn for this one.
      const scope = scopeGeneration();
      const sameAccount = (): boolean => !cancelled && scopeGeneration() === scope;
      void Promise.all([loadGoalSteps(), loadConversationPacks(), loadPracticeHistory()]).then(
        ([storedSteps, storedPacks, events]) => {
          if (!sameAccount()) return;
          setSteps(storedSteps);
          setPacks(storedPacks);
          setHistory(events);
          setStatus('loaded');
        },
        () => {
          if (sameAccount()) setStatus((current) => (current === 'loaded' ? 'loaded' : 'unread'));
        },
      );
      return () => {
        cancelled = true;
      };
    }, [attempt]),
  );

  const leave = () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Tabs'));
  const next = nextTaskForGoal(current ?? '', { missions: MISSIONS });
  const mission = next === null ? null : missionOfTask(goalTaskOf(next.task));
  const trail = goalEvidence(goalKey, steps, packs, history, profile.learnerGoals);

  const report = (row: GoalTrailRow) => {
    if (reporting !== null) return;
    setReporting(row.stepId);
    setRefused(null);
    const scope = scopeGeneration();
    void recordUsedOutside({ stepId: row.stepId, goalKey, at: Date.now() })
      .then(async (ack) => {
        if (scopeGeneration() !== scope) return;
        if (ack !== 'durable') {
          setRefused(row.stepId);
          return;
        }
        // Read back, so what is drawn is what is on the disk.
        const stored = await loadGoalSteps();
        if (scopeGeneration() === scope) setSteps(stored);
      })
      .catch(() => {
        if (scopeGeneration() === scope) setRefused(row.stepId);
      })
      .finally(() => setReporting(null));
  };

  return (
    <ScrollScreen header={<ScreenHeader back={{ onPress: leave }} />}>
      <Label>{GOAL_LABEL}</Label>

      {current === null && (
        <View style={st.block}>
          <Text style={st.soft}>{GOAL_GONE}</Text>
          <GhostButton label={GOAL_GONE_OPEN} color={paper.ink} onPress={() => nav.navigate('TutorMemory')} />
        </View>
      )}

      {current !== null && (
        <>
          <Text accessibilityRole="header" style={st.goal}>{current}</Text>

          {next !== null && mission !== null && (
            <View style={st.block}>
              <Label>{GOAL_NEXT_LABEL}</Label>
              <Text style={st.next}>{nextLine(mission, next.fit)}</Text>
              <ListeningPreview selection={{ kind: 'mission', mission }} showContext />
              <View style={st.primary}>
                <PillButton
                  label={GOAL_START}
                  onPress={() => nav.navigate('Convo', { missionId: mission.id, goalRef: routeKey, goalTask: goalTaskOf(next.task) })}
                />
              </View>
              <Text style={st.cost}>{NEEDS_CONNECTION_AND_MINUTES}</Text>
            </View>
          )}

          <View style={st.block}>
            <Label>{GOAL_TRAIL_LABEL}</Label>

            {status === 'loading' && <Text accessibilityLiveRegion="polite" style={st.soft}>{GOAL_LOADING}</Text>}

            {status === 'unread' && (
              <View style={st.rows}>
                <Text style={st.soft}>{GOAL_UNREAD}</Text>
                <GhostButton
                  label={GOAL_RETRY}
                  color={paper.ink}
                  onPress={() => {
                    setStatus('loading');
                    setAttempt((n) => n + 1);
                  }}
                />
              </View>
            )}

            {status === 'loaded' && trail.length === 0 && <Text style={st.soft}>{GOAL_TRAIL_EMPTY}</Text>}

            {status === 'loaded' && trail.length > 0 && (
              <View style={st.rows}>
                {trail.map((row) => {
                  const practice = row.practice !== null ? GOAL_PRACTICE_LINE[row.practice] : null;
                  return (
                    <View key={row.stepId} style={st.row}>
                      <Ledger>
                        <LedgerRow
                          glyph={<DocumentGlyph color={accent.primary} />}
                          title={row.pack.title.en}
                          gloss={rehearsedOn(row.at)}
                          note={practice}
                          accessibilityLabel={[row.pack.title.en, rehearsedOn(row.at), practice].filter(Boolean).join(' ')}
                          onPress={() => nav.navigate('Conversations', { packId: row.pack.id })}
                        />
                      </Ledger>
                      {row.usedOutside ? (
                        <Text style={st.said}>{USED_OUTSIDE_SAID}</Text>
                      ) : (
                        <GhostButton
                          label={USED_OUTSIDE_CONTROL}
                          color={paper.ink}
                          disabled={reporting !== null}
                          onPress={() => report(row)}
                        />
                      )}
                      {refused === row.stepId && <Text style={st.soft}>{USED_OUTSIDE_REFUSED}</Text>}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  goal: { ...type.cardTitle, color: paper.ink, marginTop: space(2) },
  next: { ...type.bodyStrong, color: paper.ink },
  soft: { ...type.body, color: paper.inkSoft },
  said: { ...type.small, color: paper.ink },
  cost: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
  block: { marginTop: space(5), gap: space(3) },
  primary: { marginTop: space(2) },
  rows: { gap: space(4) },
  row: { gap: space(2) },
});
