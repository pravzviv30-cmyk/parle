import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useMainAppearance } from '../main/MainAppearance.tsx';
import { Label, Press, Sheet } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { StaggerIn } from '../motion/StaggerIn.tsx';
import { STAGGER } from '../motion/tokens.ts';
import { INCLUSIONS } from '../purchases/capabilities.ts';
import type { Plan, PlanSpec } from '@luvani/core';
import { HIT, colour, decorative, paper, space, type } from '../theme.ts';
import { ACCOUNT_LABEL, COMPARE_INTRO, PLANS_COMPARE, compareNote } from './wallCopy.ts';
import { WallPeriodSwitch } from './WallPeriodSwitch.tsx';
import { BenefitRow, WallCta, WallLinks, WallSkeleton, wallType } from './WallParts.tsx';
import type { WallAccount } from './wallAccount.ts';
import { chosenOffer, type WallPlanOffer, type WallPlanRow } from './wallPlans.ts';
import type { TrialTimelineView } from './trialTimeline.ts';
import { TIMELINE_GLYPHS, compareCards, compareCta, planLine, timelineRows, windowDays, type PaywallOffer } from './trialPaywall.ts';

/**
 * The trial paywall's body ("P2 · Luvani", 2026-10-19): headline, the billed
 * amount, the period switch, then the timeline (trial) or three benefits
 * (standard), and the plan line with its way into the compare sheet.
 *
 * No hero art. The billed amount is the most prominent price: bold in the
 * trial's offer line, and the largest price on a standard page. The choices
 * select rather than buy; the one button lives in the frame's footer, with the
 * disclosure and the links right under it (`WallPlansAtButton`). Nothing is
 * marked as the one to pick, and nothing invents social proof.
 */
export function WallPlansPage({
  rows,
  catalogue,
  account,
  selected,
  trial,
  offer,
  busy = false,
  loading = false,
  onSelect,
}: {
  rows: readonly WallPlanRow[];
  catalogue: Record<Plan, PlanSpec> | null;
  account: WallAccount | null;
  /** The chosen product id, or null. */
  selected: string | null;
  /** The chosen product's free trial, or null when it carries none this account may take. */
  trial: TrialTimelineView | null;
  /** What the page says for the chosen product, or null until one is chosen. */
  offer: PaywallOffer | null;
  /** A purchase is in flight: the switch and Compare are dimmed and still. */
  busy?: boolean;
  /** The store has not answered yet: skeletons, and no price text at all. */
  loading?: boolean;
  onSelect: (offer: WallPlanOffer) => void;
}) {
  const { colors } = useMainAppearance();
  const [comparing, setComparing] = useState(false);
  const current = chosenOffer(rows, selected);
  const visiblePlan = rows.find(row => row.offers.some(offer => offer.productId === selected))?.plan ?? rows[0]?.plan;
  const visibleRow = rows.find(row => row.plan === visiblePlan);
  return (
    <View style={st.content}>
      {loading ? <PlansLoading /> : offer !== null && <>
        <Text accessibilityRole="header" style={[wallType.headline, { color: colors.text }]}>{offer.headline}</Text>
        {offer.kind === 'trial'
          ? <Text style={[st.offer, { color: colors.text }]}>{offer.lead}<Text style={wallType.bold}>{offer.billed}</Text></Text>
          : <Text style={[wallType.price, st.price, { color: colors.text }]}>{offer.billed}</Text>}
        <Text style={[wallType.detail, st.detail, { color: colors.muted }]}>{offer.detail}</Text>
      </>}
      {visibleRow !== undefined && <View style={st.switch}>
        <WallPeriodSwitch offers={visibleRow.offers} name={visibleRow.name} selected={selected} onSelect={onSelect} disabled={busy} />
      </View>}
      {trial !== null && <View style={st.trialSummary}>
        <TrialTimeline view={trial} />
      </View>}
      {trial === null && offer !== null && <View style={st.benefits}>
        {offer.benefits.map(line => <BenefitRow key={line} line={line} />)}
      </View>}
      {visibleRow !== undefined && <View style={[st.planLine, { opacity: busy ? 0.5 : 1 }]}>
        <Text style={[wallType.line, st.planText, { color: colors.muted }]}>{planLine(visibleRow, current, catalogue)}</Text>
        {rows.length > 1 && <Press haptic="light" accessibilityRole="button" accessibilityLabel={PLANS_COMPARE} disabled={busy} onPress={() => setComparing(true)} style={st.compareLink}>
          <Text style={[wallType.line, { color: colors.link }]}>{PLANS_COMPARE}</Text>
        </Press>}
      </View>}
      <ComparePlans comparing={comparing} rows={rows} current={current} catalogue={catalogue} account={account}
        onClose={() => setComparing(false)} onChoose={(offer) => { onSelect(offer); setComparing(false); }} />
    </View>
  );
}

/** Skeleton blocks where the headline, price, switch and timeline will go. No price text. */
function PlansLoading() {
  return (
    <View style={st.loading} accessibilityLabel="Loading">
      <WallSkeleton width="80%" height={34} />
      <WallSkeleton width="60%" height={23} />
      <WallSkeleton width={260} height={44} round={22} />
      <WallSkeleton width="100%" height={180} round={20} />
    </View>
  );
}

/**
 * The two tiers side by side, in the period already chosen. A card tap picks
 * within the sheet; the button commits it and closes. Trial lines show only
 * on an offer the store says this account may take.
 */
function ComparePlans({ comparing, rows, current, catalogue, account, onClose, onChoose }: {
  comparing: boolean;
  rows: readonly WallPlanRow[];
  current: WallPlanOffer | null;
  catalogue: Record<Plan, PlanSpec> | null;
  account: WallAccount | null;
  onClose: () => void;
  onChoose: (offer: WallPlanOffer) => void;
}) {
  const { colors } = useMainAppearance();
  const cards = compareCards(rows, current, catalogue);
  const [pick, setPick] = useState<string | null>(null);
  const picked = cards.find(card => card.plan === pick) ?? cards.find(card => card.offer.productId === current?.productId) ?? cards[0];
  const close = () => { setPick(null); onClose(); };
  return (
    <Sheet surface={colors.surface} ink={colors.text} visible={comparing} title={PLANS_COMPARE} onClose={close}
      footer={picked ? <View style={st.sheetFooter}><WallCta label={compareCta(picked)} onPress={() => { const offer = picked.offer; setPick(null); onChoose(offer); }} /></View> : undefined}>
      <Text style={[wallType.line, { color: colors.muted }]}>{COMPARE_INTRO}</Text>
      <View style={st.cards} accessibilityRole="radiogroup">
        {cards.map(card => {
          const checked = card.plan === picked?.plan;
          return (
            <Press key={card.plan} haptic="selection" accessibilityRole="radio" accessibilityState={{ checked }} aria-checked={checked}
              accessibilityLabel={[card.name, card.price, card.allowance, card.trial].filter(Boolean).join(', ')}
              onPress={() => setPick(card.plan)}
              style={[st.card, checked ? { borderWidth: 1.5, borderColor: colour.blue, backgroundColor: colors.background } : { borderWidth: 1, borderColor: colors.border }]}>
              <View style={st.cardHead}>
                <View {...decorative} style={[st.radio, checked ? { backgroundColor: colour.blue } : { borderWidth: 1.5, borderColor: colors.border }]}>
                  {checked && <View style={[st.radioDot, { backgroundColor: paper.onInk }]} />}
                </View>
                <Text style={[wallType.medium, { color: colors.text, flex: 1, minWidth: 0 }]}>{card.name}</Text>
                <Text style={[wallType.medium, { color: colors.text }]}>{card.price}</Text>
              </View>
              {card.allowance !== null && <Text style={[wallType.line, { color: colors.muted }]}>{card.allowance}</Text>}
              {card.plan === 'regular' && <Text style={[wallType.line, { color: colors.muted }]}>{INCLUSIONS.maxCompact}</Text>}
              {card.trial !== null && <Text style={[wallType.detail, st.left, { color: colors.muted }]}>{card.trial}</Text>}
            </Press>
          );
        })}
      </View>
      <Text style={[wallType.detail, { color: colors.muted }]}>{compareNote(windowDays(catalogue, current?.plan ?? 'starter', 'month'))}</Text>
      <Text style={[wallType.detail, { color: colors.muted }]}>{INCLUSIONS.streak}</Text>
      {/* What the learner already holds, only when the server said so. */}
      {account !== null && (
        <View style={st.account}>
          <Label color={colors.muted}>{ACCOUNT_LABEL}</Label>
          <Text style={[wallType.title, { color: colors.text }]}>{account.title}</Text>
          {account.lines.map((line) => <Text key={line} style={[wallType.line, { color: colors.muted }]}>{line}</Text>)}
        </View>
      )}
    </Sheet>
  );
}

/**
 * The store free trial, day by day: today, the reminder or the day to cancel
 * by, the day it becomes the plan. Drawn only with a real eligible offer; the
 * lines are `trialTimeline.ts`'s, folded by `timelineRows`. Every word here is
 * set no larger than the billed amount it leads to.
 */
function TrialTimeline({ view }: { view: TrialTimelineView }) {
  const { colors } = useMainAppearance();
  const rows = timelineRows(view);
  return (
    <StaggerIn step={STAGGER.base}>
      {rows.map((node, index) => (
        <View key={node.key} style={st.node}>
          <View style={st.rail} {...decorative}>
            <View style={st.disc}>
              <Icon name={TIMELINE_GLYPHS[node.key]} size={18} color={paper.ink} />
            </View>
            {index < rows.length - 1 && <View style={st.connector} />}
          </View>
          <View style={[st.nodeWords, index < rows.length - 1 && st.nodeGap]}>
            {node.title !== null && <Text style={[st.nodeTitle, { color: colors.text }]}>{node.title}</Text>}
            <Text style={[st.nodeLine, { color: colors.muted }]}>{node.line}</Text>
          </View>
        </View>
      ))}
    </StaggerIn>
  );
}

/**
 * Right under the frame's one button: the disclosure Apple asks for (the
 * trial length, the billed amount and the renewal, built from store data),
 * then Restore purchases, Terms and Privacy.
 */
export function WallPlansAtButton({ disclosure, onRestore, onOpenTerms, onOpenPolicy, busy = false }: {
  disclosure: string | null;
  onRestore: () => void;
  onOpenTerms: () => void;
  onOpenPolicy: () => void;
  busy?: boolean;
}) {
  const { colors } = useMainAppearance();
  return (
    <View style={st.atButton}>
      {disclosure !== null && <Text style={[wallType.detail, { color: colors.muted }]}>{disclosure}</Text>}
      <WallLinks onRestore={onRestore} restoreDisabled={busy} onTerms={onOpenTerms} onPrivacy={onOpenPolicy} />
    </View>
  );
}

const DISC = 28;

const st = StyleSheet.create({
  // Rhythm tightened 2026-10-19 so headline through plan line fit above the
  // pinned footer on 390x844 at default text size (wallLayout.test.ts budget).
  content: { paddingHorizontal: space(2), paddingTop: space(1) },
  offer: { ...wallType.body, textAlign: 'center', marginTop: space(2.5) },
  price: { marginTop: space(2.5) },
  detail: { marginTop: space(1) },
  switch: { marginTop: space(5) },
  loading: { gap: space(3) },
  trialSummary: { marginTop: space(6) },
  benefits: { marginTop: space(6), gap: space(3.5) },
  planLine: { marginTop: space(3), minHeight: HIT, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: space(2) },
  planText: { flexShrink: 1 },
  compareLink: { minHeight: HIT, justifyContent: 'center' },
  node: { flexDirection: 'row', gap: 14 },
  rail: { alignItems: 'center', width: DISC },
  disc: { width: DISC, height: DISC, borderRadius: DISC / 2, backgroundColor: colour.sun, alignItems: 'center', justifyContent: 'center' },
  connector: { flex: 1, width: 3, backgroundColor: colour.sun, opacity: 0.45 },
  nodeWords: { flex: 1, minWidth: 0, paddingTop: 3, gap: 2 },
  nodeGap: { paddingBottom: space(4) },
  nodeTitle: { ...type.bodyStrong },
  nodeLine: { ...type.small },
  cards: { gap: space(3) },
  card: { borderRadius: 22, padding: space(4), gap: space(1) },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  radio: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  left: { textAlign: 'left' },
  account: { gap: space(1) },
  sheetFooter: { paddingTop: space(3) },
  atButton: { marginTop: space(2.5), gap: space(1) },
});
