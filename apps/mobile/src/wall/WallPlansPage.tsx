import { StyleSheet, Text, View } from 'react-native';

import { Choice, GhostButton, IconAction, Label } from '../components.tsx';
import { Icon, type IconName } from '../icons/Icon.tsx';
import { StaggerIn } from '../motion/StaggerIn.tsx';
import { STAGGER } from '../motion/tokens.ts';
import { INCLUSIONS } from '../purchases/capabilities.ts';
import { decorative, paper, space, type } from '../theme.ts';
import {
  ACCOUNT_LABEL,
  PLANS_BOTH,
  PLANS_PRIVACY,
  PLANS_RENEWAL,
  PLANS_RESTORE,
  PLANS_SUB,
  PLANS_TERMS,
  PLANS_TITLE,
  PLANS_TRUST,
  PLAN_MONTHLY,
  PLAN_YEARLY,
  WALL_LEAVE,
  billedPrice,
  conversationLength,
  goalFitLine,
  minutesAMonth,
  monthlyPrice,
  payDetail,
  perWeekLine,
  yearlyPrice,
} from './wallCopy.ts';
import type { WallAccount } from './wallAccount.ts';
import { CONVERSATION_MINUTES, type WallPlanOffer, type WallPlanRow } from './wallPlans.ts';
import type { TrialNodeKey, TrialTimelineView } from './trialTimeline.ts';

/**
 * Page two of two. The plans, priced in conversations, and every number off the wire.
 *
 * 2026-09-27, notebook Phase 6-E: each plan says its minutes a month, about how
 * many ten-minute conversations a week they buy, and the store's own price. The
 * account's own minutes sit above the plans when the server has said them.
 *
 * Come alive (founder decision D16, README Part 5.G): each plan is paid yearly
 * or monthly, each its own store product, and the ways to pay are one set of
 * radio choices (`Choice`, which says checked on a device and on the web). A
 * yearly price says the store's own monthly figure beside it, never a saving.
 * With a daily goal each plan says whether its minutes cover it. The yearly
 * product of the plan that covers the goal arrives chosen; the screen that
 * chooses it records nothing, so the funnel still means "the learner chose".
 * The streak line is said once, for every plan on the page. A store free trial
 * draws its timeline only when the chosen product really carries one this
 * account may take.
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
  goal,
  trial,
  onSelect,
  onRestore,
  onOpenPolicy,
  onOpenTerms,
  onLeave,
}: {
  rows: readonly WallPlanRow[];
  account: WallAccount | null;
  /** The chosen product id, or null. */
  selected: string | null;
  /** The learner's daily goal in minutes, or null when they have none or it is still loading. */
  goal: number | null;
  /** The chosen product's free trial, or null when it carries none this account may take. */
  trial: TrialTimelineView | null;
  onSelect: (offer: WallPlanOffer) => void;
  onRestore: () => void;
  onOpenPolicy: () => void;
  onOpenTerms: () => void;
  onLeave: () => void;
}) {
  return (
    <View>
      <Text accessibilityRole="header" style={st.title}>{PLANS_TITLE}</Text>
      <Text style={st.sub}>{PLANS_SUB}</Text>

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

      <View accessibilityRole="radiogroup" style={st.plans}>
        {rows.map((row) => (
          <View key={row.plan} style={st.plan}>
            <Text accessibilityRole="header" style={st.name}>{row.name}</Text>
            {/* The minutes and conversations are absent rather than guessed when
                the server has not sent a catalogue. A count invented on the
                phone is the one number here that could disagree with the meter. */}
            {row.minutes !== null && <Text style={st.minutes}>{minutesAMonth(row.minutes)}</Text>}
            {row.perWeek !== null && <Text style={st.perWeek}>{perWeekLine(row.perWeek)}</Text>}
            {goal !== null && row.daily !== null && <Text style={st.fit}>{goalFitLine(goal, row.daily)}</Text>}
            <View style={st.offers}>
              {row.offers.map((offer) => {
                const period = offer.period === 'year' ? PLAN_YEARLY : PLAN_MONTHLY;
                const price = offer.period === 'year' ? yearlyPrice(offer.price, offer.perMonth) : monthlyPrice(offer.price);
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
                    title={billed}
                    detail={payDetail(offer.period, offer.perMonth)}
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

      {/* One line for every plan on the page (F734, D4): both paid plans hold
          streak freezes and the repair, monthly or yearly, trial or not. */}
      <View style={st.perk}>
        <View {...decorative}>
          <Icon name="freeze" size={20} color={paper.ink} />
        </View>
        <Text style={st.perkLine}>{INCLUSIONS.streak}</Text>
      </View>

      <Text style={st.note}>{conversationLength(CONVERSATION_MINUTES)}</Text>
      <Text style={st.note}>{PLANS_BOTH}</Text>

      {trial !== null && <TrialTimeline view={trial} />}

      {/* The way out, said rather than implied. The wall never blocks and the
          chevron goes back, but a chevron in the corner reads as navigation
          rather than as a choice. */}
      <View style={st.decline}>
        <GhostButton label={WALL_LEAVE} onPress={onLeave} />
      </View>

      {/* The documents and the restore Apple asks for, one wrapping row. */}
      <View style={st.links}>
        <IconAction layout="inline" icon="privacy" label={PLANS_PRIVACY} onPress={onOpenPolicy} />
        <IconAction layout="inline" icon="document" label={PLANS_TERMS} onPress={onOpenTerms} />
        <IconAction layout="inline" icon="refresh" label={PLANS_RESTORE} onPress={onRestore} />
      </View>
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
      <Text accessibilityRole="header" style={st.trialTitle}>{view.title}</Text>
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
export function WallPlansAtButton({ trialTerms = null }: { trialTerms?: string | null }) {
  return (
    <View style={st.atButton}>
      {trialTerms !== null && <Text style={st.terms}>{trialTerms}</Text>}
      <Text style={st.small}>{PLANS_RENEWAL}</Text>
      <Text style={st.small}>{PLANS_TRUST}</Text>
    </View>
  );
}

const DISC = space(9);

const st = StyleSheet.create({
  title: { ...type.display, color: paper.ink },
  sub: { ...type.body, color: paper.inkSoft, marginTop: space(2) },
  account: { marginTop: space(5) },
  accountTitle: { ...type.heading, color: paper.ink, marginTop: space(1) },
  accountLine: { ...type.body, color: paper.ink, marginTop: space(1) },
  plans: { marginTop: space(5), gap: space(6) },
  plan: { gap: space(1) },
  name: { ...type.heading, color: paper.ink },
  minutes: { ...type.bodyStrong, color: paper.inkSoft },
  perWeek: { ...type.small, color: paper.ink },
  fit: { ...type.small, color: paper.ink },
  offers: { marginTop: space(2), gap: space(2) },
  perk: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(5) },
  perkLine: { ...type.body, color: paper.ink, flex: 1, minWidth: 0 },
  note: { ...type.small, color: paper.inkSoft, marginTop: space(3) },
  trial: { marginTop: space(6) },
  // Every word of the trial is drawn no larger than its terms at the button,
  // which carry the billed amount (Apple Guideline 3.1.2).
  trialTitle: { ...type.bodyStrong, color: paper.ink, marginBottom: space(3) },
  node: { flexDirection: 'row', gap: space(3) },
  rail: { alignItems: 'center' },
  disc: { width: DISC, height: DISC, borderRadius: DISC / 2, backgroundColor: paper.card, alignItems: 'center', justifyContent: 'center' },
  connector: { flex: 1, minHeight: space(3), borderLeftWidth: 2, borderLeftColor: paper.field },
  nodeWords: { flex: 1, minWidth: 0, paddingBottom: space(4), gap: space(0.5) },
  nodeTitle: { ...type.bodyStrong, color: paper.ink },
  nodeLine: { ...type.body, color: paper.ink },
  decline: { marginTop: space(4), alignItems: 'center' },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space(1), marginTop: space(4) },
  atButton: { marginTop: space(2), gap: space(1) },
  small: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
  terms: { ...type.bodyStrong, color: paper.ink, textAlign: 'center' },
});
