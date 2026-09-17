/**
 * Bring a real moment (F548, F549, F565).
 *
 * A learner with something coming up, an interview, a call, a dinner, picks
 * the kind of moment and writes one line about it if they like. The kind
 * carries authored French for the tutor to open on; the learner's own words
 * ride the English half of the seed, cut to what the server will carry. The
 * conversation then opens on that seed the way a saved situation's does.
 *
 * The start is the gate's, in the F154 shape every probing tap keeps: one
 * probe in flight at a time, the learner told it is running, a refusal
 * answered here with the same start offered again.
 *
 * The door is the Max plan's (`purchases/capabilities.ts`). The plan is read
 * on focus; until it answers the action slot draws nothing, so a paying
 * learner never sees the plan line flash. A plan without the door, or one
 * nobody could read, meets one honest line and the way to the plans.
 *
 * Moments already brought are kept on this phone and offered again below,
 * because the same interview is worth running twice.
 */

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useLive } from '../app/LiveContext.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { Field, Label, OutlineButton, PillButton, TintPanel } from '../components.tsx';
import { ScreenHeader, ScrollScreen } from '../layout.tsx';
import { capabilitiesFor } from '../purchases/capabilities.ts';
import { fetchBillingStatus } from '../purchases/client.ts';
import { paper, radius, space, type, HIT } from '../theme.ts';
import { momentTint } from './momentTint.ts';
import { TUTOR_OFFLINE, tutorGate } from './gate.ts';
import { loadMoments, saveMoment, type RealMoment } from './momentsStore.ts';
import {
  DETAIL_LABEL,
  DETAIL_PLACEHOLDER,
  MAX_ONLY_LINE,
  REAL_MOMENTS,
  REAL_MOMENT_SUB,
  REAL_MOMENT_TITLE,
  REHEARSE_ACTION,
  REHEARSE_AGAIN_LABEL,
  SEE_PLANS,
  detailCap,
  kindOf,
  seedFor,
  type RealMomentKey,
} from './realMoments.ts';

/**
 * One moment the learner could bring, as a card on its own paper.
 *
 * Two columns, because eight of these read as a grid to choose from rather than
 * a list to read down, and that is what the mockup draws. Each one sits on the
 * tint `momentTint.ts` gives it, which tells them apart and claims nothing: a
 * job interview is not a warmer or a harder thing than a family dinner.
 *
 * Chosen is an ink ring, not a fill and never a second tint. `OptionCard` and
 * `TabBar` already say "this one" that way, and a filled card here would read
 * as a state rather than a choice. The state is said twice, once per platform:
 * `accessibilityState` is what VoiceOver and TalkBack read, and `aria-selected`
 * is the only one react-native-web puts in the accessibility tree (F522).
 *
 * It grows rather than clips: `flexBasis` with `flexGrow`, so at the largest
 * reading size the two columns fall to one and every title wraps whole.
 */
function MomentCard({
  momentKey,
  title,
  gloss,
  selected,
  onPress,
}: {
  momentKey: RealMomentKey;
  title: string;
  gloss: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${gloss}`}
      accessibilityState={{ selected }}
      aria-selected={selected}
      style={st.cell}
    >
      <TintPanel tint={momentTint(momentKey)} style={[st.moment, selected && st.chosen]}>
        <Text style={[type.heading, { color: paper.ink }]}>{title}</Text>
        <Text style={[type.small, { color: paper.inkSoft, marginTop: space(0.5) }]}>{gloss}</Text>
      </TintPanel>
    </Pressable>
  );
}

export function RealMomentScreen({
  onBack,
  onStart,
  onSeePlans,
}: {
  onBack: () => void;
  /** The seed the conversation opens on. The navigator carries it to the route. */
  onStart: (seedTopic: { fr: string; en: string }) => void;
  onSeePlans: () => void;
}) {
  const { recheck } = useLive();
  const { user } = useAuth();
  const [key, setKey] = useState<RealMomentKey | null>(null);
  const [detail, setDetail] = useState('');
  const [moments, setMoments] = useState<readonly RealMoment[]>([]);
  // Null until the plan answers: the action slot draws nothing rather than a
  // plan line a paying learner would see for a frame.
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  /** The start that did not happen, so the retry is the same start. */
  const [heldBack, setHeldBack] = useState<{ textMode: boolean } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadMoments().then((stored) => {
        if (!cancelled) setMoments(stored);
      });
      if (user === null) return () => { cancelled = true; };
      void fetchBillingStatus(user.id).then((status) => {
        if (cancelled) return;
        // A plan nobody could read is the trial, never a yes.
        setAllowed(capabilitiesFor(status === null ? 'unknown' : status.plan, status?.lapsed ?? false).customRehearsal);
      });
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  const kind = key === null ? null : kindOf(key);

  const open = () => {
    // A second tap while the connection check runs cannot open a second room.
    if (checking) return;
    if (kind === null) return;
    setChecking(true);
    void recheck().then((answered) => {
      setChecking(false);
      const decision = tutorGate(answered, false);
      if (!decision.go) {
        setHeldBack(decision.heldBack);
        return;
      }
      setHeldBack(null);
      const seed = seedFor(kind, detail);
      // Kept for next time, and not waited on: the conversation is the point.
      void saveMoment(kind.key, detail.trim().slice(0, detailCap(kind)), Date.now()).catch(() => {});
      onStart(seed);
    }).catch(() => {
      // At the end of the chain rather than beside the handler, so a throw from
      // the navigation above is caught too. The start is kept, so the retry is
      // the same start rather than a guess at what they were doing.
      setChecking(false);
      setHeldBack({ textMode: false });
    });
  };

  return (
    <ScrollScreen avoidKeyboard header={<ScreenHeader back={{ onPress: onBack }} />}>
      <Text accessibilityRole="header" style={[type.display, { color: paper.ink }]}>{REAL_MOMENT_TITLE}</Text>
      <Text style={[type.body, { color: paper.inkSoft, marginTop: space(2) }]}>{REAL_MOMENT_SUB}</Text>

      <View style={st.kinds}>
        {REAL_MOMENTS.map((option) => (
          <MomentCard
            key={option.key}
            momentKey={option.key}
            title={option.en}
            gloss={option.gloss}
            selected={key === option.key}
            onPress={() => setKey(option.key)}
          />
        ))}
      </View>

      {kind !== null && (
        <View style={st.detail}>
          <Field
            label={DETAIL_LABEL}
            value={detail}
            onChangeText={setDetail}
            placeholder={DETAIL_PLACEHOLDER}
            maxLength={detailCap(kind)}
            autoCapitalize="sentences"
            returnKeyType="done"
          />
        </View>
      )}

      {allowed === true && (
        <View style={st.action}>
          <PillButton label={REHEARSE_ACTION} disabled={checking || kind === null} onPress={open} />
        </View>
      )}
      {allowed === false && (
        <View style={st.action}>
          <Text style={st.gateLine}>{MAX_ONLY_LINE}</Text>
          <OutlineButton label={SEE_PLANS} onPress={onSeePlans} />
        </View>
      )}

      {checking && (
        <Text accessibilityLiveRegion="polite" style={st.checking}>
          {TUTOR_OFFLINE.checking}
        </Text>
      )}

      {/* Held back, not broken. The learner asked, the answer is in, and the
          way forward is the same start again rather than a smaller one. */}
      {heldBack !== null && (
        <View style={st.offline}>
          <Text style={st.offlineBody}>{TUTOR_OFFLINE.body}</Text>
          <OutlineButton
            label={checking ? TUTOR_OFFLINE.checking : TUTOR_OFFLINE.retry}
            disabled={checking}
            onPress={open}
          />
        </View>
      )}

      {moments.length > 0 && (
        <View style={st.again}>
          <Label>{REHEARSE_AGAIN_LABEL}</Label>
          <View style={st.kinds}>
            {moments.map((moment) => {
              const brought = kindOf(moment.kind);
              if (brought === null) return null;
              return (
                <MomentCard
                  key={moment.id}
                  momentKey={moment.kind}
                  title={brought.en}
                  gloss={moment.detail.length > 0 ? moment.detail : brought.gloss}
                  selected={key === moment.kind && detail === moment.detail}
                  onPress={() => {
                    setKey(moment.kind);
                    setDetail(moment.detail);
                  }}
                />
              );
            })}
          </View>
        </View>
      )}
    </ScrollScreen>
  );
}

const st = StyleSheet.create({
  kinds: { marginTop: space(4), flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  cell: { flexGrow: 1, flexBasis: 150, minHeight: HIT },
  moment: {
    borderRadius: radius.row,
    padding: space(4),
    minHeight: HIT,
    // The ring is drawn whatever the state, so a chosen card does not grow by
    // two points and shove its neighbour down the grid.
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chosen: { borderColor: paper.ink },
  detail: { marginTop: space(5) },
  action: { marginTop: space(6), gap: space(3) },
  gateLine: { ...type.body, color: paper.ink },
  checking: { ...type.small, color: paper.inkSoft, textAlign: 'center', marginTop: space(2) },
  offline: { marginTop: space(3), gap: space(3) },
  offlineBody: { ...type.body, color: paper.ink },
  again: { marginTop: space(7) },
});
