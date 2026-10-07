/**
 * "Your French plan": the card the learner's answers land in (come alive,
 * README Part 5.C rows 1 to 5; first run section 4).
 *
 * One slot per question, each a dashed pill until that answer is given, then a
 * white token with the answer's icon and a short name. It holds only answers
 * the learner gave; nothing is filled in for them.
 *
 * The flight starts here (README Part 6, "Flight"): the screen hands over where
 * the answer was chosen (`flyFrom`, a view or a box measured before the page
 * changed) and this card launches the token through `motion/TokenFlight.tsx`
 * into its slot. The slot shows the real token when it lands, and says so to a
 * screen reader. With reduced motion, no flight layer or a failed measure, the
 * token is simply in its slot at once (TokenFlight never strands its caller).
 *
 * On the question pages it is the sun card under the Back row. On the plan
 * page it is expanded, white on the sun, with room for the edit action beside
 * its label. Decorative tokens; the card speaks as one line.
 */

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../icons/Icon.tsx';
import { GoalDial } from '../../icons/GoalDial.tsx';
import { useTokenFlight } from '../../motion/TokenFlight.tsx';
import type { Box } from '../../motion/flights.ts';
import { colour, decorative, paper, radius, space, type } from '../../theme.ts';
import type { PreAccountOnboardingDraft } from '../preAccountDraft.ts';
import { FIRST_RUN_COPY } from './copy.ts';
import { planCardLabel, planSlots, planToken, type PlanSlot, type PlanToken } from './planModel.ts';

/** Where an answer was chosen: a view still on screen, or a box measured before the page moved on. */
export type FlyFrom = {
  readonly slot: PlanSlot;
  readonly from: RefObject<View | null> | Box;
  /** A new id is a new flight. */
  readonly id: number;
};

/** A box as a view that measures to it, so a source already gone can still be flown from. */
function measuredAt(box: Box): RefObject<View | null> {
  const stand = {
    measureInWindow: (answer: (x: number, y: number, width: number, height: number) => void) =>
      answer(box.x, box.y, box.width, box.height),
  };
  return { current: stand as unknown as View };
}

function isBox(from: FlyFrom['from']): from is Box {
  return typeof (from as Box).x === 'number';
}

/** One answer as a token: its icon or dial and its short name. White on the sun card, paper on the white one. */
export function TokenPill({ token, onWhite = false }: { token: PlanToken; onWhite?: boolean }) {
  return (
    <View {...decorative} style={[st.token, onWhite && st.tokenOnWhite]}>
      {token.dial !== undefined ? (
        <GoalDial quarters={token.dial} size={16} color={paper.ink} />
      ) : token.icon !== undefined ? (
        <Icon name={token.icon} variant="bulk" size={16} color={paper.ink} secondaryColor={colour.blue} />
      ) : null}
      <Text style={[type.small, { color: paper.ink }]}>{token.label}</Text>
    </View>
  );
}

export function PlanCard({
  draft,
  five = false,
  flyFrom = null,
  expanded = false,
  trailing,
}: {
  draft: PreAccountOnboardingDraft;
  five?: boolean;
  flyFrom?: FlyFrom | null;
  /** The plan page: white on the sun, with the edit action beside the label. */
  expanded?: boolean;
  trailing?: ReactNode;
}) {
  const flight = useTokenFlight();
  const slots = planSlots(five);
  const targets = useRef<Partial<Record<PlanSlot, View | null>>>({});
  const [inAir, setInAir] = useState<PlanSlot | null>(null);
  const flown = useRef<number | null>(null);
  const latest = useRef(draft);
  latest.current = draft;

  useEffect(() => {
    if (flyFrom === null || flown.current === flyFrom.id) return;
    flown.current = flyFrom.id;
    const token = planToken(latest.current, flyFrom.slot);
    if (token === null) return;
    const id = flyFrom.id;
    setInAir(flyFrom.slot);
    flight.launch({
      from: isBox(flyFrom.from) ? measuredAt(flyFrom.from) : flyFrom.from,
      to: { current: targets.current[flyFrom.slot] ?? null },
      token: <TokenPill token={token} />,
      onLand: () => {
        if (flown.current === id) setInAir(null);
        AccessibilityInfo.announceForAccessibility(`Added to your plan: ${token.label}`);
      },
    });
  }, [flyFrom, flight]);

  return (
    <View style={[st.card, { backgroundColor: expanded ? paper.card : colour.sun }]}>
      <View style={st.head}>
        <Text style={[type.small, st.label]}>{FIRST_RUN_COPY.planLabel}</Text>
        {trailing}
      </View>
      <View accessible accessibilityLabel={planCardLabel(draft, five)} style={st.slots}>
        {slots.map((slot) => {
          const token = planToken(draft, slot);
          return (
            <View
              key={slot}
              collapsable={false}
              ref={(node) => {
                targets.current[slot] = node;
              }}
            >
              {token !== null && inAir !== slot ? <TokenPill token={token} onWhite={expanded} /> : <View {...decorative} style={st.empty} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: radius.tile, paddingVertical: space(3), paddingHorizontal: space(3.5), gap: space(2) },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) },
  label: { color: paper.ink, flex: 1 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  token: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1.5),
    paddingHorizontal: space(3),
    paddingVertical: space(1),
    borderRadius: radius.pill,
    backgroundColor: paper.card,
  },
  tokenOnWhite: { backgroundColor: paper.ground },
  empty: {
    minHeight: 32,
    minWidth: space(16),
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: paper.field,
  },
});
