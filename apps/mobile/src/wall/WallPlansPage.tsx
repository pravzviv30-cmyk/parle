import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, GhostButton, Label } from '../components.tsx';
import { HAIRLINE, HIT, paper, radius, space, type } from '../theme.ts';
import type { PaidPlan } from '../purchases/adapter.ts';
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
  WALL_LEAVE,
  conversationLength,
  minutesAMonth,
  perWeekLine,
} from './wallCopy.ts';
import type { WallAccount } from './wallAccount.ts';
import { CONVERSATION_MINUTES, type WallPlanRow } from './wallPlans.ts';

/**
 * Page two of two. The plans, priced in conversations, and every number off the wire.
 *
 * 2026-09-27, notebook Phase 6-E. One card of ruled rows, one per plan: its
 * name, about how many ten-minute conversations a week it buys, its minutes a
 * month, and the store's own price. The chosen row is said in ink, with a filled
 * mark, rather than in the chartreuse, which is for French. The account's own
 * minutes sit above the card when the server has said them.
 *
 * The rows select rather than buy, and the one primary pill lives in the
 * frame's footer. Choosing a tier and committing to it are two different
 * moments, so the funnel can tell "they compared and left" apart from "they
 * tried to buy and it failed". The renewal terms and the trust line ride in
 * the same footer, right under that pill (`WallPlansAtButton` below).
 *
 * Nothing is marked recommended, best value or most popular. The founder ruled
 * out invented social proof, and with two tiers that both open every situation
 * the only honest difference is the speaking time, which each row states.
 */
export function WallPlansPage({
  rows,
  account,
  selected,
  onSelect,
  onRestore,
  onOpenPolicy,
  onOpenTerms,
  onLeave,
}: {
  rows: readonly WallPlanRow[];
  account: WallAccount | null;
  selected: PaidPlan | null;
  onSelect: (plan: PaidPlan) => void;
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

      <Card padded={false} style={st.card}>
        {rows.map((row, index) => {
          const chosen = row.plan === selected;
          return (
            <Pressable
              key={row.plan}
              onPress={() => onSelect(row.plan)}
              // `button` with a `selected` state, which is what OptionCard and
              // TabBar already use for a chosen thing. `radio` with `checked` was
              // a parallel invention and, worse, React Native Web does not map it:
              // both cards reported no state at all, so a screen reader could not
              // tell which plan was picked.
              accessibilityRole="button"
              accessibilityState={{ selected: chosen }}
              // Said twice, once per platform, and the two are not
              // interchangeable. `accessibilityState` is what VoiceOver and
              // TalkBack read; `aria-selected` is the only one react-native-web
              // puts in the accessibility tree, and without it a learner in a
              // browser heard two identical buttons and could not tell which
              // plan was picked (F522, closed by F586).
              aria-selected={chosen}
              accessibilityLabel={row.name}
              style={({ pressed }) => [st.row, index > 0 && st.divided, pressed && st.pressed]}
            >
              <View style={[st.mark, chosen && st.markChosen]} {...decorative}>
                {chosen && <View style={st.markDot} />}
              </View>
              <View style={st.words}>
                <Text style={st.name}>{row.name}</Text>
                {/* The conversations and the minutes are absent rather than
                    guessed when the server has not sent a catalogue. A count
                    invented on the phone is the one number on this page that
                    could disagree with the meter. */}
                {row.perWeek !== null && <Text style={st.perWeek}>{perWeekLine(row.perWeek)}</Text>}
                {row.minutes !== null && <Text style={st.minutes}>{minutesAMonth(row.minutes)}</Text>}
              </View>
              <Text style={st.price}>{row.price}</Text>
            </Pressable>
          );
        })}
      </Card>

      <Text style={st.note}>{conversationLength(CONVERSATION_MINUTES)}</Text>
      <Text style={st.note}>{PLANS_BOTH}</Text>

      {/* The way out, said rather than implied. The wall never blocks and the
          chevron goes back, but a chevron in the corner reads as navigation
          rather than as a choice. */}
      <View style={st.decline}>
        <GhostButton label={WALL_LEAVE} onPress={onLeave} />
      </View>

      <View style={st.links}>
        <GhostButton label={PLANS_PRIVACY} onPress={onOpenPolicy} />
        <GhostButton label={PLANS_TERMS} onPress={onOpenTerms} />
        <GhostButton label={PLANS_RESTORE} onPress={onRestore} />
      </View>
    </View>
  );
}

/**
 * The two lines a buyer is owed, drawn right under the frame's one pill.
 *
 * Apple asks for the length and the renewal on the purchase screen itself, and
 * the trust line is the other true thing worth saying at the moment of paying:
 * no adverts, and stopping costs nothing made. Both used to sit at the foot of
 * the scrolling page, a long way below the button they were about.
 */
export function WallPlansAtButton() {
  return (
    <View style={st.atButton}>
      <Text style={st.small}>{PLANS_RENEWAL}</Text>
      <Text style={st.small}>{PLANS_TRUST}</Text>
    </View>
  );
}

/** The mark is a picture of the selected state the row already announces. */
const decorative = { accessible: false, importantForAccessibility: 'no-hide-descendants' } as const;

const MARK = 22;

const st = StyleSheet.create({
  title: { ...type.display, color: paper.ink },
  sub: { ...type.body, color: paper.inkSoft, marginTop: space(2) },
  account: { marginTop: space(5) },
  accountTitle: { ...type.heading, color: paper.ink, marginTop: space(1) },
  accountLine: { ...type.body, color: paper.ink, marginTop: space(1) },
  card: { marginTop: space(5) },
  // Ledger rows: a hairline between them, 56pt at least, growing with the text.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingHorizontal: space(4),
    paddingVertical: space(4),
    minHeight: Math.max(HIT, 56),
  },
  divided: { borderTopWidth: HAIRLINE, borderTopColor: paper.lineOnCard },
  pressed: { backgroundColor: paper.groundDeep },
  mark: {
    width: MARK,
    height: MARK,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: paper.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markChosen: { borderColor: paper.ink, backgroundColor: paper.ink },
  markDot: { width: MARK / 3, height: MARK / 3, borderRadius: radius.pill, backgroundColor: paper.card },
  words: { flex: 1, minWidth: 0 },
  name: { ...type.heading, color: paper.ink },
  perWeek: { ...type.body, color: paper.ink, marginTop: space(1) },
  minutes: { ...type.small, color: paper.inkSoft, marginTop: space(0.5) },
  price: { ...type.heading, color: paper.ink, textAlign: 'right' },
  note: { ...type.small, color: paper.inkSoft, marginTop: space(3) },
  decline: { marginTop: space(4), alignItems: 'center' },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space(3), marginTop: space(4) },
  atButton: { marginTop: space(2), gap: space(1) },
  small: { ...type.small, color: paper.inkSoft, textAlign: 'center' },
});
