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

import { IconAction, ColourCard, GhostButton, Label, Ledger, LedgerRow, PillButton } from '../components.tsx';
import { DocumentGlyph } from '../glyphs.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { accent, onColour, paper, space, type } from '../theme.ts';
import { useProfile } from '../app/ProfileContext.tsx';
import { useAuth } from '../auth/useAuth.tsx';
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
  const { user } = useAuth();
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
  const [readScope, setReadScope] = useState<{ generation: number; userId: string | null } | null>(null);
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
      const userId = user?.id ?? null;
      const sameAccount = (): boolean => !cancelled && scopeGeneration() === scope;
      setStatus('loading');
      setReadScope(null);
      void Promise.all([loadGoalSteps(), loadConversationPacks(), loadPracticeHistory()]).then(
        ([storedSteps, storedPacks, events]) => {
          if (!sameAccount()) return;
          setSteps(storedSteps);
          setPacks(storedPacks);
          setHistory(events);
          setReadScope({ generation: scope, userId });
          setStatus('loaded');
        },
        () => {
          if (sameAccount()) {
            setReadScope({ generation: scope, userId });
            setStatus('unread');
          }
        },
      );
      return () => {
        cancelled = true;
      };
    }, [attempt, user]),
  );

  const leave = () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Tabs'));
  const next = nextTaskForGoal(current ?? '', { missions: MISSIONS });
  const mission = next === null ? null : missionOfTask(goalTaskOf(next.task));
  const trail = goalEvidence(goalKey, steps, packs, history, profile.learnerGoals);
  const visibleStatus = readScope?.generation === scopeGeneration() && readScope.userId === (user?.id ?? null)
    ? status : 'loading';

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
        if (scopeGeneration() === scope) {
          setReadScope({ generation: scope, userId: user?.id ?? null });
          setStatus('unread');
          setRefused(row.stepId);
        }
      })
      .finally(() => setReporting(null));
  };

  return (
    <ScrollScreen header={<ScreenHeader back={{ onPress: leave }} title={current ?? GOAL_LABEL} />}>

      {current === null && (
        <View style={st.block}>
          <Text style={st.soft}>{GOAL_GONE}</Text>
          <IconAction layout="inline" icon="edit" label={GOAL_GONE_OPEN}  onPress={() => nav.navigate('TutorMemory')} />
        </View>
      )}

      {current !== null && (
        <>

          {next !== null && mission !== null && (
            <ColourCard ground="blue" style={st.block}>
              <Label color={paper.onInk}>{GOAL_NEXT_LABEL}</Label>
              <Text style={st.next}>{nextLine(mission, next.fit)}</Text>
              <Text style={st.cost}>This is a scene from the current beginner catalogue. Your AI tutor can use your goal for context; it is not a tailored course or a promise of real-world ability.</Text>
              <ListeningPreview selection={{ kind: 'mission', mission }} showContext ground="blue" />
              <View style={st.primary}>
                <PillButton
                  tone="white"
                  label={GOAL_START}
                  onPress={() => nav.navigate('Convo', { missionId: mission.id, goalRef: routeKey, goalTask: goalTaskOf(next.task) })}
                />
              </View>
              <Text style={st.cost}>{NEEDS_CONNECTION_AND_MINUTES}</Text>
            </ColourCard>
          )}

          <View style={st.block}>
            <Label>{GOAL_TRAIL_LABEL}</Label>
            <Text style={st.soft}>You can change or remove this goal in tutor memory. The French you have saved and practised stays with you.</Text>
            <IconAction layout="inline" icon="edit" label="Edit this goal" onPress={() => nav.navigate('TutorMemory')} />

            {visibleStatus === 'loading' && <Text accessibilityLiveRegion="polite" style={st.soft}>{GOAL_LOADING}</Text>}

            {visibleStatus === 'unread' && (
              <View style={st.rows}>
                <Text style={st.soft}>{GOAL_UNREAD}</Text>
                <IconAction layout="inline" icon="refresh"
                  label={GOAL_RETRY}

                  onPress={() => {
                    setStatus('loading');
                    setAttempt((n) => n + 1);
                  }}
                />
              </View>
            )}

            {visibleStatus === 'loaded' && trail.length === 0 && <Text style={st.soft}>{GOAL_TRAIL_EMPTY}</Text>}

            {visibleStatus === 'loaded' && trail.length > 0 && (
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
                        <IconAction layout="inline" icon="tick-circle"
                          label={USED_OUTSIDE_CONTROL}

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
  next: { ...type.bodyStrong, color: paper.onInk },
  soft: { ...type.body, color: paper.inkSoft },
  said: { ...type.small, color: paper.ink },
  cost: { ...type.small, color: onColour.blue, textAlign: 'center' },
  block: { marginTop: space(5), gap: space(3) },
  primary: { marginTop: space(2) },
  rows: { gap: space(4) },
  row: { gap: space(2) },
});
