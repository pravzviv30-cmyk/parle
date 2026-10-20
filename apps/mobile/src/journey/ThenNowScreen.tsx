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

import { LockBadge } from '../components.tsx';
import { ScrollScreen } from '../layout.tsx';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import type { RootStackParamList } from '../nav/types.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { useFeatureAccess } from '../access/useFeatureAccess.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { BButton } from '../today/TodayParts.tsx';
import { bType, space } from '../theme.ts';
import type { StoredCompletion } from './journeyView.ts';
import { BackButton, DashedCell, HelpLegend, SceneCard, SceneHead, TryCell, TwoUp, Words } from './JourneyParts.tsx';
import { LEGEND_BARS, LEGEND_LABEL, STATUS, THEN_NOW_FOOTER, THEN_NOW_INTRO, THEN_NOW_TITLE, TRY_IT_AGAIN, thenNowView } from './thenNowView.ts';

export { THEN_NOW_TITLE };

export function ThenNowScreen() {
  const t = useB();
  const st = useThemedStyles(makeStyles);
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

  // 2026-10-20 UI-008, artboard B-ThenNow: padding 58 22 40, gap 18; the
  // back button and the 26/800 title share one row.
  return (
    <ScrollScreen bottom="inset" padded={false} topGap={space(3)}>
      <View style={st.page}>
        <View style={st.header}>
          <BackButton onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate('Tabs'))} />
          <View style={st.titleWrap}>
            <Text accessibilityRole="header" style={[bType.title26, { color: t.text }]}>{THEN_NOW_TITLE}</Text>
            {view?.locked ? <LockBadge /> : null}
          </View>
        </View>

        <Text style={[bType.para15, { color: t.secondary }]}>{THEN_NOW_INTRO}</Text>

        <HelpLegend label={LEGEND_LABEL} bars={LEGEND_BARS} />

        {failed && <Text style={[bType.line15, { color: t.muted }]}>Your scenes could not be read just now. Come back to this page to try again.</Text>}

        {view?.rows.map((row) => row.first === null && row.note === null ? (
          <SceneCard key={row.missionId} row accessibilityLabel={row.accessibilityLabel}>
            <SceneHead scene={row.scene} status={row.status} earned={false} ground={row.tile.ground} icon={row.tile.icon} />
          </SceneCard>
        ) : (
          <SceneCard key={row.missionId}>
            <View accessible accessibilityLabel={row.accessibilityLabel}>
              <SceneHead scene={row.scene} status={row.status} earned={row.status === STATUS.earned} ground={row.tile.ground} icon={row.tile.icon} />
            </View>
            {row.note !== null && (
              <Text style={[bType.semi13, { color: t.mintWords }]} importantForAccessibility="no" accessibilityElementsHidden>
                <Words segments={row.note} />
              </Text>
            )}
            {row.first !== null && (
              <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <TwoUp>
                  <TryCell tone="first" size="scene" label={row.first.label} help={row.first.help} bar={t[row.first.bar]} />
                  {row.best !== null
                    ? <TryCell tone="best" size="scene" label={row.best.label} help={row.best.help} bar={t[row.best.bar]} />
                    : row.hint !== null ? <DashedCell line={row.hint} /> : null}
                </TwoUp>
              </View>
            )}
            {row.route !== null && row.best === null && (
              <BButton label={TRY_IT_AGAIN} accessibilityLabel={`${TRY_IT_AGAIN}, ${row.scene}`} height={44} ground={t.primary} ink={t.onPrimary} text={bType.bold15}
                onPress={() => nav.navigate('ScenePreview', { missionId: row.missionId })} />
            )}
          </SceneCard>
        ))}

        <Text style={[bType.note, { color: t.muted }]}>{THEN_NOW_FOOTER}</Text>
      </View>
    </ScrollScreen>
  );
}

const makeStyles = (_t: B) =>
  StyleSheet.create({
    page: { paddingHorizontal: 22, paddingBottom: space(10), gap: 18 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    titleWrap: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 },
  });
