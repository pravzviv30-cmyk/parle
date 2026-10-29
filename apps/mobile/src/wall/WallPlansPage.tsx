import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useMainAppearance } from '../main/MainAppearance.tsx';
import { Label, Press, Sheet } from '../components.tsx';
import { Illustration } from '../art/flat/Illustration.tsx';
import { useScreenGeometry } from '../layout.tsx';
import { StaggerIn } from '../motion/StaggerIn.tsx';
import { STAGGER } from '../motion/tokens.ts';
import { INCLUSIONS } from '../purchases/capabilities.ts';
import type { Plan, PlanSpec } from '@luvani/core';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { HIT, decorative, space, type } from '../theme.ts';
import { ACCOUNT_LABEL, COMPARE_INTRO, PLAN_YOURS, PLANS_COMPARE, compareNote } from './wallCopy.ts';
import { WallPeriodSwitch } from './WallPeriodSwitch.tsx';
import { BenefitRow, WallCta, WallLinks, WallSkeleton, wallType } from './WallParts.tsx';
import type { WallAccount } from './wallAccount.ts';
import { chosenOffer, type WallPlanOffer, type WallPlanRow } from './wallPlans.ts';
import type { TrialTimelineView } from './trialTimeline.ts';
import { compareCards, compareCta, planLine, timelineRows, windowDays, trialScenePlace, type PaywallOffer, type RouteMark } from './trialPaywall.ts';

/**
 * The trial paywall's body ("P2 · Luvani", 2026-10-19): headline, the billed
 * amount, the period switch, then the timeline (trial) or three benefits
 * (standard), and the plan line with its way into the compare sheet.
 *
 * The trial page carries one of Luvani's own scenes, the cafe counter (F932,
 * founder decision 6): above the headline on a tall screen, else after the
 * plan line, so the charge day is never pushed below the footer. It walks the first week as a route; the standard page
 * keeps no art. Nothing on it moves. The billed amount is the most prominent price: bold in the
 * trial's offer line, and the largest price on a standard page. The choices
 * select rather than buy; the one button lives in the frame's footer, with the
 * disclosure and the links right under it (`WallPlansAtButton`). Nothing is
 * marked as the one to pick, and nothing invents social proof.
 */
export function WallPlansPage({
  rows,
  catalogue,
  account,
  standing = null,
  brief = null,
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
  /** The server's answer for this learner, or null unread: marks their own plan and drops trial lines (F912). */
  standing?: Pick<BillingStatus, 'plan' | 'lapsed'> | null;
  /** The locked feature's brief (F910), shown first, or null. */
  brief?: { title: string; line: string } | null;
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
  const { usableHeight } = useScreenGeometry();
  const { fontScale } = useWindowDimensions();
  const scene = offer?.kind === 'trial' && !loading ? trialScenePlace(usableHeight, fontScale) : null;
  const periodSwitch = visibleRow !== undefined && <View style={st.switch}>
    <WallPeriodSwitch offers={visibleRow.offers} name={visibleRow.name} selected={selected} onSelect={onSelect} disabled={busy} />
  </View>;
  return (
    <View style={st.content}>
      {brief !== null && !loading && <View style={st.brief}>
        <Text accessibilityRole="header" style={[wallType.medium, { color: colors.text }]}>{brief.title}</Text>
        <Text style={[wallType.line, { color: colors.muted }]}>{brief.line}</Text>
      </View>}
      {loading ? <PlansLoading /> : offer !== null && <>
        {scene === 'top' && <TrialScene />}
        <Text accessibilityRole="header" style={[wallType.headline, { color: colors.text }]}>{offer.headline}</Text>
        {offer.kind === 'trial'
          ? <Text style={[st.offer, { color: colors.text }]}>{offer.lead}<Text style={wallType.bold}>{offer.billed}</Text></Text>
          : <Text style={[wallType.price, st.price, { color: colors.text }]}>{offer.billed}</Text>}
        <Text style={[wallType.detail, st.detail, { color: colors.muted }]}>{offer.detail}</Text>
      </>}
      {/* F932: on a trial the route comes first, so the charge day stays above the footer; the switch follows it. */}
      {trial === null && periodSwitch}
      {trial !== null && <View style={st.trialSummary}>
        <TrialTimeline view={trial} />
      </View>}
      {trial !== null && periodSwitch}
      {trial === null && offer !== null && <View style={st.benefits}>
        {offer.benefits.map(line => <BenefitRow key={line} line={line} />)}
      </View>}
      {visibleRow !== undefined && <View style={[st.planLine, { opacity: busy ? 0.5 : 1 }]}>
        <Text style={[wallType.line, st.planText, { color: colors.muted }]}>{planLine(visibleRow, current, catalogue)}</Text>
        {rows.length > 1 && <Press haptic="light" accessibilityRole="button" accessibilityLabel={PLANS_COMPARE} disabled={busy} onPress={() => setComparing(true)} style={st.compareLink}>
          <Text style={[wallType.line, { color: colors.link }]}>{PLANS_COMPARE}</Text>
        </Press>}
      </View>}
      {scene === 'end' && <TrialScene />}
      <ComparePlans comparing={comparing} rows={rows} current={current} catalogue={catalogue} account={account} standing={standing}
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
function ComparePlans({ comparing, rows, current, catalogue, account, standing, onClose, onChoose }: {
  comparing: boolean;
  rows: readonly WallPlanRow[];
  current: WallPlanOffer | null;
  catalogue: Record<Plan, PlanSpec> | null;
  account: WallAccount | null;
  standing: Pick<BillingStatus, 'plan' | 'lapsed'> | null;
  onClose: () => void;
  onChoose: (offer: WallPlanOffer) => void;
}) {
  const { colors, b } = useMainAppearance();
  const cards = compareCards(rows, current, catalogue, standing);
  const [pick, setPick] = useState<string | null>(null);
  // The learner's own plan is never picked: it is marked, and not offered (F912).
  const open = cards.filter(card => !card.yours);
  const picked = open.find(card => card.plan === pick) ?? open.find(card => card.offer.productId === current?.productId) ?? open[0];
  const close = () => { setPick(null); onClose(); };
  return (
    <Sheet reading surface={colors.surface} ink={colors.text} visible={comparing} title={PLANS_COMPARE} onClose={close}
      footer={picked ? <View style={st.sheetFooter}><WallCta label={compareCta(picked)} onPress={() => { const offer = picked.offer; setPick(null); onChoose(offer); }} /></View> : undefined}>
      <Text style={[wallType.line, { color: colors.muted }]}>{COMPARE_INTRO}</Text>
      <View style={st.cards} accessibilityRole="radiogroup">
        {cards.map(card => {
          const checked = card.plan === picked?.plan;
          return (
            <Press key={card.plan} haptic="selection" accessibilityRole="radio" accessibilityState={{ checked, disabled: card.yours }} aria-checked={checked} disabled={card.yours}
              accessibilityLabel={[card.name, card.yours ? PLAN_YOURS : null, card.price, card.allowance, card.trial].filter(Boolean).join(', ')}
              onPress={() => setPick(card.plan)}
              style={[st.card, checked ? { borderWidth: 1.5, borderColor: b.mark, backgroundColor: colors.background } : { borderWidth: 1, borderColor: b.field }]}>
              <View style={st.cardHead}>
                <View {...decorative} style={[st.radio, checked ? { backgroundColor: b.mark } : { borderWidth: 1.5, borderColor: b.field }]}>
                  {checked && <View style={[st.radioDot, { backgroundColor: b.onMark }]} />}
                </View>
                <Text style={[wallType.medium, { color: colors.text, flex: 1, minWidth: 0 }]}>{card.name}</Text>
                <Text style={[wallType.medium, { color: colors.text }]}>{card.price}</Text>
              </View>
              {card.yours && <Text style={[wallType.detail, st.left, { color: colors.text }]}>{PLAN_YOURS}</Text>}
              {card.allowance !== null && <Text style={[wallType.line, { color: colors.muted }]}>{card.allowance}</Text>}
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

/** Luvani's cafe counter at the component's own small size; callers never set its width. */
function TrialScene() {
  return <View {...decorative} style={st.art}><Illustration name="place-cafe-counter" fit="small" /></View>;
}

/**
 * The store free trial as a route through its first week (F932): today, the
 * week's scenes, the reminder or the day to cancel by, the charge day. Dots on
 * one line in theme colours, Luvani's map motif; no glyphs. Drawn only with a
 * real eligible offer; the lines are `trialTimeline.ts`'s, walked by
 * `timelineRows`. Every word here is set no larger than the billed amount.
 */
function TrialTimeline({ view }: { view: TrialTimelineView }) {
  const { colors, b } = useMainAppearance();
  const rows = timelineRows(view);
  const dot = (mark: RouteMark) => mark === 'start'
    ? { backgroundColor: b.sun, borderColor: b.sun }
    : mark === 'end' ? { backgroundColor: b.brand, borderColor: b.brand } : { backgroundColor: colors.background, borderColor: b.brand };
  return (
    <StaggerIn step={STAGGER.base}>
      {rows.map((node, index) => (
        <View key={node.key} style={st.node}>
          <View style={st.rail} {...decorative}>
            <View style={[node.title === null ? st.waypoint : st.stop, dot(node.mark)]} />
            {index < rows.length - 1 && <View style={[st.route, { backgroundColor: b.brand }]} />}
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

const STOP = 16;
const WAYPOINT = 10;

const st = StyleSheet.create({
  // Rhythm tightened 2026-10-19 so headline through plan line fit above the
  // pinned footer on 390x844 at default text size (wallLayout.test.ts budget).
  content: { paddingHorizontal: space(2), paddingTop: space(1) },
  brief: { gap: space(1), marginBottom: space(3) },
  offer: { ...wallType.body, textAlign: 'center', marginTop: space(2.5) },
  price: { marginTop: space(2.5) },
  detail: { marginTop: space(1) },
  switch: { marginTop: space(3) },
  loading: { gap: space(3) },
  trialSummary: { marginTop: space(3) },
  benefits: { marginTop: space(6), gap: space(3.5) },
  planLine: { marginTop: space(2), minHeight: HIT, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: space(2) },
  planText: { flexShrink: 1 },
  compareLink: { minHeight: HIT, justifyContent: 'center' },
  art: { alignItems: 'center', marginVertical: space(1) },
  node: { flexDirection: 'row', gap: 14 },
  rail: { alignItems: 'center', width: STOP, paddingTop: 5 },
  stop: { width: STOP, height: STOP, borderRadius: STOP / 2, borderWidth: 2.5 },
  waypoint: { width: WAYPOINT, height: WAYPOINT, borderRadius: WAYPOINT / 2, borderWidth: 2 },
  route: { flex: 1, width: 2, marginTop: space(0.5), opacity: 0.35 },
  nodeWords: { flex: 1, minWidth: 0, gap: 2 },
  nodeGap: { paddingBottom: space(3) },
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
