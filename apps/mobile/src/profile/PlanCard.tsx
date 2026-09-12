/**
 * The plan, on Profile (F540, F541).
 *
 * F377 kept a balance row off this screen because the phone could not verify
 * one. The server answers now, so the card draws the plan's name, its period
 * as a distance in words, and how much speaking time is left as one of three
 * bands. Every sentence is `purchases/planStatus.ts`'s; this file draws what it
 * is handed and decides nothing, which is the only way a `.tsx` here can be
 * checked at all.
 *
 * It owns its read. Profile allows itself exactly one focus effect and that
 * one belongs to the reminder and the level, so this card reads the status on
 * its own focus, from its own file, and a server that cannot be reached draws
 * one honest line rather than a stale plan. The two rows are drawn whatever
 * the read said: a learner who cannot see their plan can still change it or
 * manage it, and the store answers for itself on the next screen.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { Card, Label } from '../components.tsx';
import { paper, space, type } from '../theme.ts';
import { useAuth } from '../auth/useAuth.tsx';
import { fetchBillingStatus } from '../purchases/client.ts';
import { planStatusFor, type PlanStatusView } from '../purchases/planStatus.ts';
import { SettingsRow } from '../settings/SettingsRow.tsx';

export const PLAN_LABEL = 'Your plan';
export const CHANGE_PLAN_ROW = 'Change plan';
export const CHANGE_PLAN_SUB = 'See what each plan opens.';
export const MANAGE_BILLING_ROW = 'Manage subscription and billing';
export const MANAGE_BILLING_SUB = 'Restore a purchase, or change how you pay.';

/** Every line this card spells itself, for the copy sweeps. */
export const PLAN_CARD_COPY: readonly string[] = [PLAN_LABEL, CHANGE_PLAN_ROW, CHANGE_PLAN_SUB, MANAGE_BILLING_ROW, MANAGE_BILLING_SUB];

export function PlanCard() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { user } = useAuth();
  // Null until the read answers. A card drawn from an unanswered read would
  // say the plan could not be checked to a learner whose plan is on its way.
  const [view, setView] = useState<PlanStatusView | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (user === null) return;
      void fetchBillingStatus(user.id)
        .then((status) => {
          if (!cancelled) setView(planStatusFor(status, Date.now()));
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

  return (
    <Card style={st.card}>
      <Label>{PLAN_LABEL}</Label>
      {view !== null && view.known && (
        <View style={st.status}>
          <Text style={[type.title, { color: paper.ink }]}>{view.planLabel}</Text>
          <Text style={[type.small, { color: paper.inkSoft, marginTop: space(1) }]}>{view.periodLine}</Text>
          <Text style={[type.bodyStrong, { color: paper.ink, marginTop: space(2) }]}>{view.bandLine}</Text>
        </View>
      )}
      {view !== null && !view.known && (
        <View style={st.status}>
          <Text style={[type.body, { color: paper.inkSoft }]}>{view.line}</Text>
        </View>
      )}
      <View style={st.rows}>
        <SettingsRow first label={CHANGE_PLAN_ROW} value={CHANGE_PLAN_SUB} onPress={() => nav.navigate('Wall', { entry: 'settings' })} />
        <SettingsRow label={MANAGE_BILLING_ROW} value={MANAGE_BILLING_SUB} onPress={() => nav.navigate('Settings')} />
      </View>
    </Card>
  );
}

const st = StyleSheet.create({
  card: { marginTop: space(2.5) },
  status: { marginTop: space(2) },
  rows: { marginTop: space(3) },
});
