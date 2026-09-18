import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GhostButton, Label } from '../components.tsx';
import { accent, shadow, HAIRLINE, HIT, paper, radius, space, type } from '../theme.ts';
import type { PaidPlan } from '../purchases/adapter.ts';
import {
  PLANS_BOTH,
  PLANS_PRIVACY,
  PLANS_RENEWAL,
  PLANS_RESTORE,
  PLANS_SUB,
  PLANS_TERMS,
  PLANS_TIME,
  PLANS_TITLE,
  PLANS_TRUST,
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
      <Text accessibilityRole="header" style={st.title}>{PLANS_TITLE}</Text>
      <Text style={st.sub}>{PLANS_SUB}</Text>

      <View style={st.cards}>
        {rows.map((row) => {
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
              style={({ pressed }) => [st.card, chosen && st.chosen, pressed && st.pressed]}
            >
              <View style={st.cardHead}>
                <Text style={st.name}>{row.name}</Text>
                <Text style={st.price}>{row.price}</Text>
              </View>
              {/* The allowance is absent rather than guessed when the server has
                  not sent a catalogue. A minute count invented on the phone is
                  the one number on this page that could disagree with the meter. */}
              {row.minutes !== null && (
                <View style={st.time}>
                  <Text style={st.minutes}>{row.minutes}</Text>
                  <Label>{PLANS_TIME}</Label>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={st.both}>{PLANS_BOTH}</Text>
      <Text style={st.trust}>{PLANS_TRUST}</Text>

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
  title: { ...type.display, color: paper.ink },
  sub: { ...type.body, color: paper.inkSoft, marginTop: space(2) },
  cards: { marginTop: space(6), gap: space(3) },
  // Two white cards with the app's one whisper under them. The unselected one
  // is the plain card rule; the chosen one is ringed in the identity violet,
  // which is what the founder circled on the frame and is the one place a ring
  // rather than a fill says "this one" on a purchase surface. The ring is drawn
  // at the same width either way, so choosing a plan does not move its
  // neighbour down the page by two points.
  card: {
    backgroundColor: paper.card,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: paper.line,
    padding: space(4),
    minHeight: HIT,
    ...shadow.whisper,
  },
  chosen: { borderColor: accent.primary, backgroundColor: accent.feature },
  pressed: { backgroundColor: paper.groundDeep },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: space(3) },
  name: { ...type.heading, color: paper.ink, flex: 1, minWidth: 0 },
  price: { ...type.title, color: paper.ink, textAlign: 'right' },
  time: { flexDirection: 'row', alignItems: 'baseline', gap: space(2), marginTop: space(2) },
  minutes: { ...type.bodyStrong, color: paper.ink },
  both: { ...type.small, color: paper.inkSoft, marginTop: space(4) },
  trust: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  decline: { marginTop: space(4), alignItems: 'center' },
  smallPrint: { marginTop: space(6) },
  rule: { height: HAIRLINE, backgroundColor: paper.line, marginBottom: space(3) },
  renewal: { ...type.small, color: paper.inkSoft },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3), marginTop: space(1) },
});
