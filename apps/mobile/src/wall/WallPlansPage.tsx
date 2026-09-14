import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BadgeGlyph, Card, GhostButton, Label } from '../components.tsx';
import { SpeakBubbles } from '../illustrations.tsx';
import { accent, HAIRLINE, HIT, paper, radius, signal, space, type } from '../theme.ts';
import type { PaidPlan } from '../purchases/adapter.ts';
import {
  PLANS_BOTH,
  PLANS_LABEL,
  PLANS_PRIVACY,
  PLANS_RENEWAL,
  PLANS_RESTORE,
  PLANS_SUB,
  PLANS_TERMS,
  PLANS_TIME,
  PLANS_TITLE,
  PLANS_TRUST,
  PLAN_MAX_NOTE,
  PLAN_SELECTED,
  PLAN_STARTER_NOTE,
  WALL_LEAVE,
} from './wallCopy.ts';
import type { WallPlanRow } from './wallPlans.ts';

/**
 * Page four. Two plans, and every number on it came off the wire.
 *
 * The cards select rather than buy, and the one primary pill lives in the
 * frame's footer. That is the app's "one primary per door" rule, and here it
 * also buys something worth having: choosing a tier and committing to it are two
 * different moments, so the funnel can tell "they compared and left" apart from
 * "they tried to buy and it failed". Two buy buttons would have collapsed both
 * into one event and made the page argue with itself about which tier is the
 * real one.
 *
 * Nothing is marked recommended, best value or most popular. The founder ruled
 * out invented social proof, and with two tiers that both open every situation
 * the only honest difference is the speaking time, which each card states.
 */
export function WallPlansPage({
  rows,
  selected,
  onSelect,
  onRestore,
  onOpenPolicy,
  onOpenTerms,
  onLeave,
}: {
  rows: readonly WallPlanRow[];
  selected: PaidPlan | null;
  onSelect: (plan: PaidPlan) => void;
  onRestore: () => void;
  onOpenPolicy: () => void;
  onOpenTerms: () => void;
  onLeave: () => void;
}) {
  return (
    <View>
      <Card style={st.hero}>
        <View style={st.heroArt}>
          <SpeakBubbles width={136} />
        </View>
        <Label>{PLANS_LABEL}</Label>
        <Text accessibilityRole="header" style={st.title}>{PLANS_TITLE}</Text>
        <Text style={st.sub}>{PLANS_SUB}</Text>
      </Card>

      <View style={st.cards}>
        {rows.map((row) => {
          const chosen = row.plan === selected;
          const foreground = chosen ? paper.onInk : paper.ink;
          const secondary = chosen ? paper.onInk : paper.inkSoft;
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
              accessibilityLabel={row.name}
              style={({ pressed }) => [st.card, chosen && st.chosen, pressed && st.pressed]}
            >
              <View style={st.cardHead}>
                <View style={st.planName}>
                  <Text style={[st.name, { color: foreground }]}>{row.name}</Text>
                  {chosen && (
                    <View style={st.selected}>
                      <BadgeGlyph size={15} color={paper.onInk} />
                      <Text style={st.selectedText}>{PLAN_SELECTED}</Text>
                    </View>
                  )}
                </View>
                <Text style={[st.price, { color: foreground }]}>{row.price}</Text>
              </View>
              {/* The allowance is absent rather than guessed when the server has
                  not sent a catalogue. A minute count invented on the phone is
                  the one number on this page that could disagree with the meter. */}
              {row.minutes !== null && (
                <View style={st.time}>
                  <Text style={[st.minutes, { color: foreground }]}>{row.minutes}</Text>
                  <Label color={secondary}>{PLANS_TIME}</Label>
                </View>
              )}
              <Text style={[st.note, { color: secondary }]}>
                {row.plan === 'starter' ? PLAN_STARTER_NOTE : PLAN_MAX_NOTE}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={st.trustCard}>
        <BadgeGlyph size={22} color={signal.good} />
        <View style={st.trustWords}>
          <Text style={st.both}>{PLANS_BOTH}</Text>
          <Text style={st.trust}>{PLANS_TRUST}</Text>
        </View>
      </Card>

      {/* The way out, said rather than implied.
          The wall has always been soft: it never blocks, the chevron goes back,
          and page three promises everything stays. But the only visible way to
          decline was a chevron in the corner, which reads as navigation rather
          than as a choice. The third video's point about commitment is the one it
          is most right about, and this is the whole of the fix. */}
      <View style={st.decline}>
        <GhostButton label={WALL_LEAVE} onPress={onLeave} />
      </View>

      <View style={st.smallPrint}>
        <View style={st.rule} />
        <Text style={st.renewal}>{PLANS_RENEWAL}</Text>
        <View style={st.links}>
          <GhostButton label={PLANS_PRIVACY} onPress={onOpenPolicy} />
          <GhostButton label={PLANS_TERMS} onPress={onOpenTerms} />
        </View>
        <GhostButton label={PLANS_RESTORE} onPress={onRestore} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { backgroundColor: paper.groundDeep, padding: space(5) },
  heroArt: { height: 104, alignItems: 'center', justifyContent: 'center', marginBottom: space(2) },
  title: { ...type.display, color: paper.ink, marginTop: space(2) },
  sub: { ...type.body, color: paper.inkSoft, marginTop: space(2) },
  cards: { marginTop: space(4), gap: space(3) },
  // The unselected card is the plain card rule; the selected one takes the
  // heavier ink rule OptionCard uses, which is the app's existing way of saying
  // "this one" without colouring it.
  card: {
    backgroundColor: paper.card,
    borderRadius: radius.card,
    borderWidth: HAIRLINE,
    borderColor: paper.line,
    padding: space(4),
    minHeight: HIT,
  },
  chosen: { borderWidth: 1.5, borderColor: accent.primary, backgroundColor: accent.primary },
  pressed: { backgroundColor: paper.groundDeep },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: space(3) },
  planName: { flex: 1, minWidth: 0, gap: space(1.5) },
  name: { ...type.heading },
  selected: { flexDirection: 'row', alignItems: 'center', gap: space(1), alignSelf: 'flex-start' },
  selectedText: { ...type.small, color: paper.onInk },
  price: { ...type.title, textAlign: 'right' },
  time: { flexDirection: 'row', alignItems: 'baseline', gap: space(2), marginTop: space(3) },
  minutes: { ...type.display },
  note: { ...type.small, marginTop: space(2) },
  trustCard: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3), marginTop: space(4) },
  trustWords: { flex: 1, minWidth: 0 },
  both: { ...type.bodyStrong, color: paper.ink },
  trust: { ...type.small, color: paper.inkSoft, marginTop: space(1) },
  decline: { marginTop: space(4), alignItems: 'center' },
  smallPrint: { marginTop: space(6) },
  rule: { height: HAIRLINE, backgroundColor: paper.line, marginBottom: space(3) },
  renewal: { ...type.small, color: paper.inkSoft },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3), marginTop: space(1) },
});
