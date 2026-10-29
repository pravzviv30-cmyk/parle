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
 * on focus; loading, read failure and a plan without access are distinct states.
 * A failed read offers retry without discarding the learner's draft. Only a
 * confirmed plan without access is offered an upgrade, and since whole-app
 * Stage 3A that answer is given in the notice above the situations, before the
 * learner chooses or writes anything.
 *
 * Moments already brought are kept on this phone and offered again below,
 * because the same interview is worth running twice.
 */

import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useLive } from '../app/LiveContext.tsx';
import { useAuth } from '../auth/useAuth.tsx';
import { scopeGeneration } from '../storage/scope.ts';
import { IconAction, Card, Field, GhostButton, Label, OutlineButton, PillButton, TabBar, OptionRow } from '../components.tsx';
import { ScreenHeader, ScrollScreen } from '../layout.tsx';
import { capabilitiesFor } from '../purchases/capabilities.ts';
import { fetchBillingStatus } from '../purchases/client.ts';
import { radius, space, type, HIT } from '../theme.ts';
import { TUTOR_OFFLINE, tutorGate } from './gate.ts';
import { loadMoments, saveMoment, type RealMoment } from './momentsStore.ts';
import {
  DETAIL_LABEL,
  DETAIL_PLACEHOLDER,
  MAX_ONLY_LINE,
  PLAN_CHECKING,
  planIncluded,
  PLAN_READ_FAILED,
  REAL_MOMENTS,
  REAL_MOMENT_SUB,
  REAL_MOMENT_TITLE,
  REHEARSE_ACTION,
  REHEARSE_AGAIN_LABEL,
  SEE_PLANS,
  detailCap,
  kindOf,
  prefillFor,
  seedFor,
  type RealMomentKey,
} from './realMoments.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';

/**
 * One moment the learner could bring, as a white cell on the page.
 *
 * Two columns, because eight of these read as a grid to choose from rather than
 * a list to read down, and that is what the mockup draws. Since the notebook
 * redesign (Phase 4, 2026-09-27) every cell is the same white: the place tints
 * retired, and the title is what tells one moment from another.
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
function MomentCard({ title, gloss, selected, onPress }: {
  momentKey: RealMomentKey; title: string; gloss: string;
  selected: boolean; onPress: () => void;
}) {
  return <OptionRow title={title} detail={gloss} selected={selected} onPress={onPress} />;
}

export function RealMomentScreen({
  onBack,
  onStart,
  onSeePlans,
  initialTextMode = false,
  initialDetail,
}: {
  onBack: () => void;
  /** The seed the conversation opens on. The navigator carries it to the route. */
  onStart: (seedTopic: { fr: string; en: string }, textMode: boolean) => void;
  onSeePlans: () => void;
  initialTextMode?: boolean;
  /** Words typed on Explore's "Prepare for something real" (B1), shown in the field. */
  initialDetail?: string;
}) {
  const t = useB();
  const st = useThemedStyles(makeSt);
  const { recheck } = useLive();
  const { user } = useAuth();
  const [prefill] = useState(() => prefillFor(initialDetail));
  const [key, setKey] = useState<RealMomentKey | null>(prefill.key);
  const [detail, setDetail] = useState(prefill.detail);
  const [mode, setMode] = useState<'speak' | 'type'>(initialTextMode ? 'type' : 'speak');
  const starting = useRef(false);
  const [planError, setPlanError] = useState(false);
  const [planAttempt, setPlanAttempt] = useState(0);
  const [moments, setMoments] = useState<readonly RealMoment[]>([]);
  const [momentsRead, setMomentsRead] = useState<'loading' | 'ready' | 'unread'>('loading');
  const [momentsOwner, setMomentsOwner] = useState<{ generation: number; userId: string | null } | null>(null);
  const [momentsAttempt, setMomentsAttempt] = useState(0);
  // Null until the plan answers: the action slot draws nothing rather than a
  // plan line a paying learner would see for a frame.
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  /** The start that did not happen, so the retry is the same start. */
  const [heldBack, setHeldBack] = useState<{ textMode?: boolean } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const generation = scopeGeneration();
      const userId = user?.id ?? null;
      setMomentsRead('loading');
      setAllowed(null);
      setPlanError(false);
      void loadMoments().then((stored) => {
        if (!cancelled && scopeGeneration() === generation) {
          setMoments(stored);
          setMomentsOwner({ generation, userId });
          setMomentsRead('ready');
        }
      }).catch(() => {
        if (!cancelled && scopeGeneration() === generation) {
          setMomentsOwner({ generation, userId });
          setMomentsRead('unread');
        }
      });
      if (user === null) { setPlanError(true); return () => { cancelled = true; }; }
      void fetchBillingStatus(user.id).then((status) => {
        if (cancelled) return;
        setPlanError(status === null);
        setAllowed(status === null ? null : capabilitiesFor(status.plan, status.lapsed).customRehearsal);
      }).catch(() => { if (!cancelled) setPlanError(true); });
      return () => {
        cancelled = true;
      };
    }, [user, planAttempt, momentsAttempt]),
  );

  const momentsStatus = momentsOwner?.generation === scopeGeneration() && momentsOwner.userId === (user?.id ?? null)
    ? momentsRead : 'loading';
  const visibleMoments = momentsStatus === 'ready' ? moments : [];
  const kind = key === null ? null : kindOf(key);

  const open = () => {
    // A second tap while the connection check runs cannot open a second room.
    if (checking) return;
    if (starting.current || allowed !== true) return;
    if (kind === null || (key === 'other' && detail.trim().length === 0)) return;
    starting.current = true;
    setChecking(true);
    void recheck().then((answered) => {
      setChecking(false);
      starting.current = false;
      const decision = tutorGate(answered, mode === 'type');
      if (!decision.go) {
        setHeldBack(decision.heldBack);
        return;
      }
      setHeldBack(null);
      const seed = seedFor(kind, detail);
      // Kept for next time, and not waited on: the conversation is the point.
      void saveMoment(kind.key, detail.trim().slice(0, detailCap(kind)), Date.now()).catch(() => {});
      onStart(seed, mode === 'type');
    }).catch(() => {
      // At the end of the chain rather than beside the handler, so a throw from
      // the navigation above is caught too. The start is kept, so the retry is
      // the same start rather than a guess at what they were doing.
      setChecking(false);
      starting.current = false;
      setHeldBack({ textMode: mode === 'type' });
    });
  };

  return (
    <ScrollScreen avoidKeyboard header={<ScreenHeader back={{ onPress: onBack }} />}>
      <Text accessibilityRole="header" style={[type.title, { color: t.text }]}>{REAL_MOMENT_TITLE}</Text>
      <Text style={[type.body, { color: t.muted, marginTop: space(2) }]}>{REAL_MOMENT_SUB}</Text>

      {/* The plan, said before anything is filled in (Stage 3A). One notice,
          four answers: checking, could not check (a retry, the draft kept),
          not included (the one door to plans), or included. A failed read is
          never offered an upgrade. */}
      <Card tone="journal" style={st.detail}>
        <Label>Included with Max</Label>
        <Text style={[type.small, { color: t.muted, marginTop: space(2) }]}>Choose your situation and practise with your tutor before it happens.</Text>
        {allowed === null && <Text accessibilityLiveRegion="polite" style={st.planLine}>{planError ? PLAN_READ_FAILED : PLAN_CHECKING}</Text>}
        {planError && <IconAction layout="inline" icon="refresh" label="Check my plan again" onPress={() => setPlanAttempt((attempt) => attempt + 1)} />}
        {allowed === false && (
          <View style={st.gate}>
            <Text style={st.gateLine}>{MAX_ONLY_LINE}</Text>
            <OutlineButton label={SEE_PLANS} onPress={onSeePlans} />
            <GhostButton label="Not now" onPress={onBack} />
          </View>
        )}
        {allowed === true && <Text style={st.planLine}>{planIncluded(allowed)}</Text>}
      </Card>

      <View style={st.detail}>
        <Label>Choose a situation</Label>
      </View>

      <View style={st.kinds}>
        {REAL_MOMENTS.map((option) => (
          <MomentCard
            key={option.key}
            momentKey={option.key}
            title={option.en}
            gloss={option.gloss}
            selected={key === option.key}
            onPress={() => { setKey(option.key); setDetail((text) => text.slice(0, detailCap(option))); }}
          />
        ))}
      </View>

      {kind !== null && (
        <View style={st.detail}>
          <Field
            label={key === 'other' ? 'What would you like to rehearse?' : DETAIL_LABEL}
            value={detail}
            onChangeText={setDetail}
            placeholder={DETAIL_PLACEHOLDER}
            maxLength={detailCap(kind)}
            autoCapitalize="sentences"
            returnKeyType="done"
            multiline
          />
          <Text style={[type.small, { color: t.muted, marginTop: space(2) }]}>{detail.length}/{detailCap(kind)} characters. Include who you will speak to and what you need to say.</Text>
        </View>
      )}

      <View style={st.detail}>
        <TabBar tabs={[{ key: 'speak', label: 'Speak' }, { key: 'type', label: 'Type' }]} active={mode} onChange={setMode} accessibilityLabel="Rehearsal mode" />
      </View>

      {allowed === true && (
        <View style={st.action}>
          <PillButton label={checking ? 'Connecting…' : REHEARSE_ACTION} disabled={checking || kind === null || (key === 'other' && detail.trim().length === 0)} onPress={open} />
          {kind === null && <Text style={st.checking}>Choose a situation to begin.</Text>}
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

      {momentsStatus === 'unread' && (
        <View style={st.again}>
          <Text style={st.planLine}>We couldn’t load your saved moments.</Text>
          <IconAction layout="inline" icon="refresh" label="Try loading saved moments again" onPress={() => setMomentsAttempt((n) => n + 1)} />
        </View>
      )}
      {visibleMoments.length > 0 && (
        <View style={st.again}>
          <Label>{REHEARSE_AGAIN_LABEL}</Label>
          <View style={st.kinds}>
            {visibleMoments.map((moment) => {
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

function makeSt(t: B) {
  return StyleSheet.create({
  kinds: { marginTop: space(4), gap: space(2) },
  cell: { flexGrow: 1, flexBasis: 150, minHeight: HIT },
  moment: {
    backgroundColor: t.card,
    borderRadius: radius.row,
    padding: space(4),
    minHeight: HIT,
    // The ring is drawn whatever the state, so a chosen card does not grow by
    // two points and shove its neighbour down the grid.
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chosen: { borderColor: t.text },
  detail: { marginTop: space(5) },
  action: { marginTop: space(6), gap: space(3) },
  gate: { marginTop: space(3), gap: space(3) },
  gateLine: { ...type.body, color: t.text },
  planLine: { ...type.small, color: t.text, marginTop: space(2) },
  checking: { ...type.small, color: t.muted, textAlign: 'center', marginTop: space(2) },
  offline: { marginTop: space(3), gap: space(3) },
  offlineBody: { ...type.body, color: t.text },
  again: { marginTop: space(7) },
});
}
