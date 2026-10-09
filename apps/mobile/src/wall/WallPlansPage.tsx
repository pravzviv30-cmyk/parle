import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Choice, IconAction, Label, Sheet } from '../components.tsx';
import { Icon, type IconName } from '../icons/Icon.tsx';
import { readingColumn } from '../layout.tsx';
import { StaggerIn } from '../motion/StaggerIn.tsx';
import { STAGGER } from '../motion/tokens.ts';
import { INCLUSIONS } from '../purchases/capabilities.ts';
import { colour, decorative, paper, radius, space, type } from '../theme.ts';
import {
  ACCOUNT_LABEL,
  PLANS_PRIVACY,
  PLANS_BOTH,
  PLANS_COMPARE,
  PLANS_RENEWAL,
  PLANS_RESTORE,
  PLANS_TERMS,
  PLANS_TITLE,
  PLANS_TRUST,
  PLAN_MONTHLY,
  PLAN_WEEKLY,
  PLAN_YEARLY,
  billedPrice,
  minutesAMonth,
  monthlyPrice,
  payDetail,
  yearlyPrice,
} from './wallCopy.ts';
import type { WallAccount } from './wallAccount.ts';
import { chosenOffer, offerForTier, offerMinutes, type WallPlanOffer, type WallPlanRow } from './wallPlans.ts';
import type { TrialNodeKey, TrialTimelineView } from './trialTimeline.ts';

/**
 * The chosen plan's monthly and yearly products, with verified catalogue facts.
 *
 * The other tier stays discoverable through one action. Keeping its price
 * choices on their own view leaves more room for the current billed amount,
 * allowance and eligible trial terms. Account balances appear only after the
 * server supplies them; the store supplies prices and trial eligibility.
 *
 * The choices select rather than buy, and the one primary pill lives in the
 * frame's footer. Choosing a plan and committing to it are two different
 * moments, so the funnel can tell "they compared and left" apart from "they
 * tried to buy and it failed". The renewal terms and the trust line ride in
 * the same footer, right under that pill (`WallPlansAtButton` below).
 *
 * Nothing is marked as the one to pick, and nothing invents social proof.
 */
export function WallPlansPage({
  rows,
  account,
  selected,
  trial,
  onSelect,
  onRestore,
  onOpenPolicy,
  onOpenTerms,
}: {
  rows: readonly WallPlanRow[];
  account: WallAccount | null;
  /** The chosen product id, or null. */
  selected: string | null;
  /** The chosen product's free trial, or null when it carries none this account may take. */
  trial: TrialTimelineView | null;
  onSelect: (offer: WallPlanOffer) => void;
  onRestore: () => void;
  onOpenPolicy: () => void;
  onOpenTerms: () => void;
  onLeave: () => void;
}) {
  const [comparing, setComparing] = useState(false);
  const [trialDetails, setTrialDetails] = useState(false);
  const current = chosenOffer(rows, selected);
  const visiblePlan = rows.find(row => row.offers.some(offer => offer.productId === selected))?.plan ?? rows[0]?.plan;
  return (
    <View style={readingColumn}>
      <Text accessibilityRole="header" style={st.title}>{PLANS_TITLE}</Text>


      <View accessibilityRole="radiogroup" style={st.plans}>
        {rows.filter(row => row.plan === visiblePlan).map((row) => (
          <View key={row.plan} style={st.plan}>
            <View style={st.planHeading}>
              <Text accessibilityRole="header" style={st.name}>{row.name}</Text>
              {rows.length > 1 && <IconAction layout="inline" icon="chat" label={PLANS_COMPARE} onPress={() => setComparing(true)} />}
            </View>
            {/* The minutes are absent rather than guessed when
                the server has not sent a catalogue. A count invented on the
                phone is the one number here that could disagree with the meter. */}
            {offerMinutes(row, current) !== null && <View style={st.allowance}><Text style={st.stat}>{offerMinutes(row, current)}</Text><Text style={st.minutes}>{current?.period === 'week' ? 'AI tutor minutes every 7 days' : 'AI tutor minutes per month'}</Text></View>}
            <View style={st.offers}>
              {row.offers.map((offer) => {
                const period = offer.period === 'week' ? PLAN_WEEKLY : offer.period === 'year' ? PLAN_YEARLY : PLAN_MONTHLY;
                const price = offer.period === 'week' ? billedPrice(offer.price, offer.period) : offer.period === 'year' ? yearlyPrice(offer.price, offer.perMonth) : monthlyPrice(offer.price);
                // The billed amount is the choice's title, so it is the most
                // prominent price on the row; how often, and the store's
                // monthly figure for a yearly product, sit under it, smaller
                // (Apple Guideline 3.1.2).
                const billed = billedPrice(offer.price, offer.period);
                return (
                  <Choice
                    key={offer.productId}
                    role="radio"
                    compact
                    outlined
                    title={`${period} · ${offer.price}`}
                    detail={`${offer.period === 'week' ? 'Every 7 days' : offer.period === 'year' ? 'Billed yearly' : 'Billed monthly'} · ${offerMinutes(row, offer) ?? 'Live'} minutes${offer.period === 'year' ? ' / month' : ''}`}
                    selected={offer.productId === selected}
                    onPress={() => onSelect(offer)}
                    // The plan's name rides with the period and the price, so a
                    // screen reader that lands on a choice hears whose it is.
                    accessibilityLabel={[row.name, period, price].join(', ')}
                  />
                );
              })}
            </View>
          </View>
        ))}
      </View>

      <Text style={st.saved}>Saved French stays yours. Minutes don’t roll over.</Text>
      {visiblePlan === 'regular' && <Text style={st.perkLine}>{INCLUSIONS.maxCompact}</Text>}
      {trial !== null && <View style={st.trialSummary}>
        {trial.nodes.filter(node => node.key === 'during').map(node => <Text key={node.key} style={st.nodeLine}>{node.line}</Text>)}
        <IconAction layout="inline" icon="calendar" label={trial.title} onPress={() => setTrialDetails(true)} />
      </View>}

      {/* The documents and the restore Apple asks for, one wrapping row. */}
      <View style={st.links}>
        <IconAction layout="inline" icon="privacy" label={PLANS_PRIVACY} onPress={onOpenPolicy} />
        <IconAction layout="inline" icon="document" label={PLANS_TERMS} onPress={onOpenTerms} />
        <IconAction layout="inline" icon="refresh" label={PLANS_RESTORE} onPress={onRestore} />
      </View>
      <Sheet visible={comparing} title={PLANS_COMPARE} onClose={() => setComparing(false)}>
      {/* What the learner already holds, only when the server said so. A still
          line read once, never a count that ticks. */}
      {account !== null && (
        <View style={st.account}>
          <Label>{ACCOUNT_LABEL}</Label>
          <Text style={st.accountTitle}>{account.title}</Text>
          {account.lines.map((line) => (
            <Text key={line} style={st.accountLine}>{line}</Text>
          ))}
        </View>
      )}

        <Text style={st.shared}>{PLANS_BOTH}</Text>
        <Text style={st.perkLine}>{INCLUSIONS.streak}</Text>
        <View style={st.comparison} accessibilityRole="radiogroup">
          {rows.map(row => {
            const offer = offerForTier(row, current);
            if (offer === null) return null;
            const details = [
              row.minutes === null ? null : minutesAMonth(row.minutes),
              billedPrice(offer.price, offer.period),
              ...(row.plan === 'regular' ? [INCLUSIONS.rehearsal, INCLUSIONS.arcs] : []),
            ].filter((line): line is string => line !== null).join('\n');
            return <Choice key={row.plan} role="radio" title={row.name} detail={details}
              selected={row.plan === visiblePlan} onPress={() => { onSelect(offer); setComparing(false); }} />;
          })}
        </View>
      </Sheet>
      <Sheet visible={trialDetails && trial !== null} title={trial?.title ?? ''} onClose={() => setTrialDetails(false)}>
        {trial !== null && <TrialTimeline view={trial} />}
      </Sheet>
    </View>
  );
}

const NODE_ICONS: Record<TrialNodeKey, IconName> = {
  today: 'unlock',
  during: 'chat',
  remind: 'bell',
  cancel: 'calendar',
  then: 'card',
};

/**
 * The store free trial, day by day: today, what it holds, the day to cancel
 * by, the day it becomes the plan. Drawn only with a real eligible offer; the
 * lines are `trialTimeline.ts`'s. The rows arrive one after another once, and
 * land at rest under Reduce Motion.
 */
function TrialTimeline({ view }: { view: TrialTimelineView }) {
  return (
    <View style={st.trial}>
      <StaggerIn step={STAGGER.base}>
        {view.nodes.map((node, index) => (
          <View key={node.key} style={st.node}>
            <View style={st.rail} {...decorative}>
              <View style={st.disc}>
                <Icon name={NODE_ICONS[node.key]} size={20} color={paper.ink} />
              </View>
              {index < view.nodes.length - 1 && <View style={st.connector} />}
            </View>
            <View style={st.nodeWords}>
              {node.title !== null && <Text style={st.nodeTitle}>{node.title}</Text>}
              <Text style={st.nodeLine}>{node.line}</Text>
            </View>
          </View>
        ))}
      </StaggerIn>
    </View>
  );
}

/**
 * The lines a buyer is owed, drawn right under the frame's one pill.
 *
 * Apple asks for the length and the renewal on the purchase screen itself, and
 * the trust line is the other true thing worth saying at the moment of paying:
 * no adverts, and stopping costs nothing made. With a free trial chosen its
 * terms come first, because they are what the pill is about to start, and
 * they carry the billed amount, so they are drawn in the ink and weight of a
 * line that matters: no word of the trial on this page is larger than they
 * are (Apple Guideline 3.1.2, held by `trialTimeline.test.ts`).
 */
export function WallPlansAtButton({ trialTerms = null, priceTerms = null }: { trialTerms?: string | null; priceTerms?: string | null }) {
  return (
    <View style={st.atButton}>
      {trialTerms !== null && <Text style={st.terms}>{trialTerms} {PLANS_RENEWAL}</Text>}
      {trialTerms === null && priceTerms !== null && <Text style={st.terms}>{priceTerms}. {PLANS_RENEWAL}</Text>}
      <Text style={st.small}>{PLANS_TRUST}</Text>
    </View>
  );
}

const DISC = space(7);

const st = StyleSheet.create({
  title: { ...type.title, color: paper.ink },
  allowance: { padding: space(4), borderRadius: radius.feature, backgroundColor: colour.sun, gap: space(1), marginTop: space(2) },
  stat: { ...type.stat, color: paper.ink },
  saved: { ...type.small, color: paper.ink, marginTop: space(2) },
  shared: { ...type.body, color: paper.ink, marginTop: space(2) },
  comparison: { gap: space(3), marginTop: space(4) },
  planHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space(2) },
  trialSummary: { gap: space(1), marginTop: space(3) },
  account: { marginTop: space(5) },
  accountTitle: { ...type.heading, color: paper.ink, marginTop: space(1) },
  accountLine: { ...type.body, color: paper.ink, marginTop: space(1) },
  plans: { marginTop: space(3), gap: space(3) },
  plan: { gap: space(1) },
  name: { ...type.label, color: paper.ink },
  minutes: { ...type.label, color: paper.ink },
  offers: { marginTop: space(2), gap: space(2) },
  perk: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(3) },
  perkLine: { ...type.body, color: paper.ink, flex: 1, minWidth: 0 },
  trial: { marginTop: space(3) },
  // Every word of the trial is drawn no larger than its terms at the button,
  // which carry the billed amount (Apple Guideline 3.1.2).
  node: { flexDirection: 'row', gap: space(3) },
  rail: { alignItems: 'center' },
  disc: { width: space(7), height: space(7), borderRadius: DISC / 2, backgroundColor: paper.card, alignItems: 'center', justifyContent: 'center' },
  connector: { flex: 1, minHeight: space(3), borderLeftWidth: 2, borderLeftColor: paper.field },
  nodeWords: { flex: 1, minWidth: 0, paddingBottom: space(2), gap: space(0.5) },
  nodeTitle: { ...type.bodyStrong, color: paper.ink },
  nodeLine: { ...type.small, color: paper.ink },
  decline: { marginTop: space(2), alignItems: 'center' },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space(1), marginTop: space(1) },
  atButton: { marginTop: space(2), gap: space(1) },
  small: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
  terms: { ...type.bodyStrong, color: paper.ink, textAlign: 'center' },
});
