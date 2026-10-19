/**
 * The plan, in Settings (F540, F541, F576).
 *
 * F377 kept a balance row off this card because the phone could not verify
 * one. The server answers now, so the card draws the plan's name, its period as
 * a distance in words, and how much speaking time is left as one of three
 * bands. Every sentence is `purchases/planStatus.ts`'s; this file draws what it
 * is handed and decides nothing, which is the only way a `.tsx` here can be
 * checked at all.
 *
 * It moved off Profile with revamp A. A plan belongs beside the account and the
 * store rather than beside the learning, and Settings is where the learner
 * already goes for both. It draws no caps label of its own: Settings names the
 * group above it the way it names Account and Subscription.
 *
 * It owns its read, on focus, so a plan bought on the wall is the plan this
 * shows on the walk back. A server that cannot be reached draws one honest
 * line rather than a stale plan, and the way to change the plan is drawn
 * whatever the read said: a learner who cannot see their plan can still get to
 * the wall, and the store answers for itself on the next screen.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { SettingsCard as Card, useSettingsColors } from '../settings/SettingsAppearance.tsx';
import { space, type } from '../theme.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { useAuth } from '../auth/useAuth.tsx';
import { fetchBillingStatus } from '../purchases/client.ts';
import { planStatusFor, type PlanStatusView } from '../purchases/planStatus.ts';
import { SettingsRow } from '../settings/SettingsRow.tsx';

export const CHANGE_PLAN_ROW = 'View plans';
export const CHANGE_PLAN_SUB = 'See what each plan opens.';
/**
 * The second row, which reports a band and never a number.
 *
 * `planStatus.ts` turns whatever the server said into one of three phrases, so
 * nothing here can print minutes the phone did not settle. The row has no press
 * because there is nothing behind it: it is the one place this screen states a
 * fact rather than offering a door.
 */
export const SPEAKING_TIME_ROW = 'Speaking time';

/** Every line this card spells itself, for the copy sweeps. */
export const PLAN_CARD_COPY: readonly string[] = [CHANGE_PLAN_ROW, CHANGE_PLAN_SUB, SPEAKING_TIME_ROW];

export function PlanCard() {
  const colors = useSettingsColors();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { user } = useAuth();
  // Null until the read answers. A card drawn from an unanswered read would
  // say the plan could not be checked to a learner whose plan is on its way.
  const [record, setRecord] = useState<{ owner: number; view: PlanStatusView } | null>(null);
  const view = record?.owner === scopeGeneration() ? record.view : null;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const owner = scopeGeneration();
      setRecord(null);
      if (user === null) return;
      void fetchBillingStatus(user.id)
        .then((status) => {
          if (!cancelled && owner === scopeGeneration()) setRecord({ owner, view: planStatusFor(status, Date.now()) });
        })
        .catch(() => {
          // fetchBillingStatus answers null for every failure, so this is the
          // sign-out landing between focus and answer. Nothing to draw.
        });
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  const known = view !== null && view.known;

  return (
    <Card style={st.card}>
      {view !== null && !view.known && (
        <View style={st.honest}>
          <Text style={[type.body, { color: colors.muted }]}>{view.line}</Text>
        </View>
      )}
      {/* The plan itself, and the way to another one. The name of the plan is
          the row's own label, so the tap reads as "change this" rather than as
          a settings row whose subject is somewhere else on the card. */}
      <SettingsRow
        first
        label={known ? view.planLabel : CHANGE_PLAN_ROW}
        value={known ? view.periodLine : CHANGE_PLAN_SUB}
        onPress={() => nav.navigate('Wall', { entry: 'settings' })}
      />
      {known && <SettingsRow label={SPEAKING_TIME_ROW} value={view.bandLine} />}
    </Card>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(2.5) },
  honest: { marginBottom: space(3) },
});
