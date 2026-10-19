import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import { MainIllustration } from '../illustrations/MainIllustration.tsx';
import { useMainAppearance } from '../main/MainAppearance.tsx';
import { mainArtColours } from '../palette.ts';
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
  billedPrice,
  minutesAMonth,
  trialIntroLine,
} from './wallCopy.ts';
import { WallPeriodSwitch } from './WallPeriodSwitch.tsx';
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
  const { colors, mode } = useMainAppearance(); const st = usePlanStyles();
  const focused = useIsFocused(); const { width, fontScale } = useWindowDimensions();
  const tablet = width >= 768;
  const artWidth = tablet ? 300 : width < 390 || fontScale >= 1.5 ? 220 : 240;
  const [comparing, setComparing] = useState(false);
  const current = chosenOffer(rows, selected);
  const visiblePlan = rows.find(row => row.offers.some(offer => offer.productId === selected))?.plan ?? rows[0]?.plan;
  const visibleRow = rows.find(row => row.plan === visiblePlan);
  return (
    <View style={readingColumn}>
      <View style={st.hero}>
        <View style={st.art}><MainIllustration motif="plans" theme={mode} width={artWidth} active={focused}/></View>
        <Text accessibilityRole="header" style={[st.title, !tablet && st.phoneTitle]}>{trial?.title ?? PLANS_TITLE}</Text>
        {trial !== null && current !== null && <Text style={st.terms}>{trialIntroLine(trial.days, current.price, current.period)}</Text>}
        {trial === null && current !== null && <Text style={st.terms}>{billedPrice(current.price, current.period)}</Text>}
      </View>
      {visibleRow !== undefined && <View style={st.plans}>
        <WallPeriodSwitch offers={visibleRow.offers} name={visibleRow.name} selected={selected} onSelect={onSelect}/>
        {current?.period === 'year' && current.perMonth !== null && <Text style={st.equivalent}>About {current.perMonth} a month. Billed yearly.</Text>}
        {current?.annualSavingsPercent != null && <Text style={st.saving}>Save {current.annualSavingsPercent}% compared with monthly</Text>}
        <View style={st.planHeading}><Text style={st.name}>{visibleRow.name}</Text>
          {rows.length > 1 && <IconAction layout="inline" ground={mode === 'dark' ? 'blue' : 'paper'} icon="chat" label={PLANS_COMPARE} onPress={() => setComparing(true)} />}
        </View>
      </View>}
      {trial !== null && <View style={st.trialSummary}>
        <TrialTimeline view={trial} />
      </View>}
      {visibleRow !== undefined && <View style={st.included}>
        {offerMinutes(visibleRow, current) !== null && <Text style={st.allowance}>{offerMinutes(visibleRow, current)} {current?.period === 'week' ? 'tutor minutes every 7 days' : 'tutor minutes per month'}. Full conversation collections included.</Text>}
        {visiblePlan === 'regular' && <Text style={st.perkLine}>{INCLUSIONS.maxCompact}</Text>}
        <Text style={st.saved}>Saved French stays yours. Minutes don’t roll over.</Text>
      </View>}
      {/* The documents and the restore Apple asks for, one wrapping row. */}
      <View style={st.links}>
        <IconAction layout="inline" ground={mode === 'dark' ? 'blue' : 'paper'} icon="privacy" label={PLANS_PRIVACY} onPress={onOpenPolicy} />
        <IconAction layout="inline" ground={mode === 'dark' ? 'blue' : 'paper'} icon="document" label={PLANS_TERMS} onPress={onOpenTerms} />
        <IconAction layout="inline" ground={mode === 'dark' ? 'blue' : 'paper'} icon="refresh" label={PLANS_RESTORE} onPress={onRestore} />
      </View>
      <Sheet surface={colors.surface} ink={colors.text} visible={comparing} title={PLANS_COMPARE} onClose={() => setComparing(false)}>
      {/* What the learner already holds, only when the server said so. A still
          line read once, never a count that ticks. */}
      {account !== null && (
        <View style={st.account}>
          <Label color={colors.muted}>{ACCOUNT_LABEL}</Label>
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
function trialTimelineRows(view: TrialTimelineView) {
  const during = view.nodes.find(node => node.key === 'during');
  return view.nodes.filter(node => node.key !== 'during').map(node =>
    node.key === 'today' && during ? { ...node, line: `${node.line} ${during.line}` } : node);
}

function TrialTimeline({ view }: { view: TrialTimelineView }) {
  const { colors } = useMainAppearance(); const st = usePlanStyles();
  const rows = trialTimelineRows(view);
  return (
    <View style={st.trial}>
      <StaggerIn step={STAGGER.base}>
        {rows.map((node, index) => (
          <View key={node.key} style={st.node}>
            <View style={st.rail} {...decorative}>
              <View style={st.disc}>
                <Icon name={NODE_ICONS[node.key]} size={22} color={paper.ink} />
              </View>
              {index < rows.length - 1 && <View style={st.connector} />}
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
  const st = usePlanStyles();
  return (
    <View style={st.atButton}>
      {trialTerms !== null && <Text style={st.terms}>{trialTerms} {PLANS_RENEWAL}</Text>}
      {trialTerms === null && priceTerms !== null && <Text style={st.terms}>{priceTerms}. {PLANS_RENEWAL}</Text>}
      <Text style={st.small}>{PLANS_TRUST}</Text>
    </View>
  );
}

const DISC = space(11);

const st = StyleSheet.create({
  hero: { alignItems: 'center', gap: space(3) },
  art: { alignSelf: 'stretch', alignItems: 'center', backgroundColor: colour.sun, borderRadius: radius.feature, paddingVertical: space(1), marginBottom: space(2) },
  title: { ...type.mainDisplay, color: paper.ink, textAlign: 'center' },
  phoneTitle: { ...type.title, color: paper.ink, textAlign: 'center' },
  allowance: { ...type.body, color: paper.ink, marginTop: space(2) },
  equivalent: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
  stat: { ...type.stat, color: paper.ink },
  saved: { ...type.small, color: paper.ink, marginTop: space(2) },
  shared: { ...type.body, color: paper.ink, marginTop: space(2) },
  comparison: { gap: space(3), marginTop: space(4) },
  planHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: space(2), marginTop: space(3) },
  trialSummary: { marginTop: space(8) },
  included: { gap: space(2), marginTop: space(5) },
  account: { marginTop: space(5) },
  accountTitle: { ...type.heading, color: paper.ink, marginTop: space(1) },
  accountLine: { ...type.body, color: paper.ink, marginTop: space(1) },
  plans: { marginTop: space(5), gap: space(2) },
  plan: { gap: space(1) },
  name: { ...type.label, color: paper.ink },
  minutes: { ...type.label, color: paper.ink },
  offers: { marginTop: space(2), gap: space(2), flexDirection: 'row' },
  offersStack: { flexDirection: 'column' },
  offerChoice: { flex: 1, minWidth: 0, gap: space(2) },
  saving: { ...type.label, color: paper.ink, textAlign: 'center' },
  perk: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(3) },
  perkLine: { ...type.body, color: paper.ink, flex: 1, minWidth: 0 },
  trial: { marginTop: space(1) },
  // Every word of the trial is drawn no larger than its terms at the button,
  // which carry the billed amount (Apple Guideline 3.1.2).
  node: { flexDirection: 'row', gap: space(5) },
  rail: { alignItems: 'center' },
  disc: { width: DISC, height: DISC, borderRadius: DISC / 2, backgroundColor: colour.sun, alignItems: 'center', justifyContent: 'center' },
  connector: { flex: 1, minHeight: space(7), borderLeftWidth: 3, borderLeftColor: paper.field },
  nodeWords: { flex: 1, minWidth: 0, paddingTop: space(2), paddingBottom: space(6), gap: space(1) },
  nodeTitle: { ...type.bodyStrong, color: paper.ink },
  nodeLine: { ...type.small, color: paper.ink },
  decline: { marginTop: space(2), alignItems: 'center' },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space(1), marginTop: space(1) },
  atButton: { marginTop: space(2), gap: space(1) },
  small: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
  terms: { ...type.bodyStrong, color: paper.ink, textAlign: 'center' },
});

/** The same hierarchy in M2/M3, without altering store or entitlement facts. */
function usePlanStyles() {
  const { colors, mode } = useMainAppearance();
  return useMemo(() => Object.fromEntries(Object.entries(st).map(([key, style]) => [key, {
    ...style,
    ...('color' in style ? { color: style.color === paper.inkSoft ? colors.muted : colors.text } : {}),
    ...('backgroundColor' in style ? { backgroundColor: style.backgroundColor === colour.sun ? key === 'disc' ? mainArtColours[mode].gold : colors.ochre : colors.surface } : {}),
    ...('borderLeftColor' in style ? { borderLeftColor: colors.border } : {}),
  }])) as typeof st, [colors, mode]);
}
