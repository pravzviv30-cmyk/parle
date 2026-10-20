/**
 * Then and now (2026-10-20, B4, artboard B-ThenNow). Each guided scene's first
 * try we still have next to its best, in the ladder's help words, and a way
 * back into the scene through its preview.
 *
 * Every decision is `journey/thenNowView.ts`'s; this file is layout. It reads
 * one store, the mission completions, fenced to the account that asked. It
 * reads no plan: the lock badge comes only from the access seam, through the
 * view model.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { missionStates } from '@luvani/core';

import { Card, Chip, LockBadge, PillButton } from '../components.tsx';
import { ScrollScreen, ScreenHeader } from '../layout.tsx';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import type { RootStackParamList } from '../nav/types.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { useFeatureAccess } from '../access/useFeatureAccess.ts';
import { HIT, colour, frenchText, paper, radius, space, type } from '../theme.ts';
import type { StoredCompletion } from './journeyView.ts';
import { LEGEND, LEGEND_LABEL, STATUS, THEN_NOW_FOOTER, THEN_NOW_INTRO, THEN_NOW_TITLE, TRY_IT_AGAIN, thenNowView } from './thenNowView.ts';

export { THEN_NOW_TITLE };

export function ThenNowScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // The lock seam, so the badge follows a standing change while the screen is open.
  const locks = useFeatureAccess();
  const [completions, setCompletions] = useState<readonly StoredCompletion[] | null>(null);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const scope = scopeGeneration();
      setCompletions(null);
      setFailed(false);
      void loadMissionCompletions().then(
        (stored) => { if (!cancelled && scopeGeneration() === scope) setCompletions(stored); },
        () => { if (!cancelled && scopeGeneration() === scope) setFailed(true); },
      );
      return () => { cancelled = true; };
    }, []),
  );

  const view = completions === null ? null : thenNowView({ progress: missionStates(missionCompletionsFrom(completions), [], Date.now()), completions, access: locks.access });

  return (
    <ScrollScreen
      header={
        <ScreenHeader
          back={{ onPress: () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Tabs')) }}
          title={THEN_NOW_TITLE}
          trailing={view?.locked ? <LockBadge /> : undefined}
        />
      }
    >
      <View style={st.page}>
        <Text style={[type.body, { color: paper.inkSoft }]}>{THEN_NOW_INTRO}</Text>

        <View style={st.small}>
          <Text accessibilityRole="header" style={[type.label, { color: paper.ink }]}>{LEGEND_LABEL}</Text>
          <View style={st.chips}>
            {LEGEND.map((word) => <Chip key={word} variant="meta" tone="lavender" label={word} />)}
          </View>
        </View>

        {failed && <Text style={[type.body, { color: paper.inkSoft }]}>Your scenes could not be read just now. Come back to this page to try again.</Text>}

        {view?.rows.map((row) => (
          <Card key={row.missionId} style={st.stack}>
            <View style={st.titleRow} accessible accessibilityLabel={row.accessibilityLabel}>
              <Text {...frenchText} style={[type.bodyStrong, st.grow, { color: paper.ink }]}>{row.scene}</Text>
              <Chip variant="meta" tone={row.status === STATUS.earned ? 'ink' : 'card'} label={row.status} />
            </View>
            {row.note !== null && (
              <Text style={[type.small, { color: colour.mintWords }]} importantForAccessibility="no" accessibilityElementsHidden>
                {row.note.map((s, i) => s.fr ? <Text key={i} {...frenchText}>{s.text}</Text> : s.text)}
              </Text>
            )}
            {row.first !== null && (
              <View style={st.cells} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <View style={[st.cell, { backgroundColor: paper.ground }]}>
                  <Text style={[type.small, { color: paper.inkSoft }]}>{row.first.label}</Text>
                  <Text style={[type.bodyStrong, { color: paper.ink }]}>{row.first.help}</Text>
                </View>
                {row.best !== null ? (
                  <View style={[st.cell, { backgroundColor: colour.mintWash }]}>
                    <Text style={[type.small, { color: colour.mintWords }]}>{row.best.label}</Text>
                    <Text style={[type.bodyStrong, { color: paper.ink }]}>{row.best.help}</Text>
                  </View>
                ) : (
                  <View style={[st.cell, { borderWidth: 1, borderColor: paper.line }]}>
                    <Text style={[type.small, { color: paper.inkSoft }]}>{row.hint}</Text>
                  </View>
                )}
              </View>
            )}
            {row.route !== null && (
              <PillButton variant="secondary" compact label={TRY_IT_AGAIN} accessibilityLabel={`${TRY_IT_AGAIN}, ${row.scene}`}
                onPress={() => nav.navigate('ScenePreview', { missionId: row.missionId })} />
            )}
          </Card>
        ))}

        <Text style={[type.small, { color: paper.inkSoft }]}>{THEN_NOW_FOOTER}</Text>
      </View>
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  page: { gap: space(6) },
  stack: { gap: space(3) },
  small: { gap: space(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space(2), minHeight: HIT },
  grow: { flex: 1, minWidth: 0 },
  cells: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  cell: { flex: 1, minWidth: space(30), borderRadius: radius.field, padding: space(3), gap: space(1) },
});
