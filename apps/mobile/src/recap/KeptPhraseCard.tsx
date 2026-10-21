import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Press } from '../components.tsx';
import { Feedback } from '../motion/Feedback.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { BSpeaker, CheckDisc } from '../today/TodayParts.tsx';
import { bType, frenchText } from '../theme.ts';
import { HEAR_IT_SAID } from './afterSessionView.ts';

/**
 * "One phrase kept" (2026-10-21 UI-008, artboard B-Recap): the sun card with
 * the phrase, its English, a 48pt white speaker that plays the tutor's voice,
 * the save line with its tick once the save is durable, and the actions the
 * screen hands in. In dark the card is the M3 hero ground.
 */
export function KeptPhraseCard({ fr, en, saveLine, saved, eventKey, onHear, children }: {
  fr: string; en: string; saveLine: string; saved: boolean; eventKey: string; onHear?: () => void; children?: ReactNode;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.card}>
      <Text style={[bType.chip, { color: t.heroText }]}>One phrase kept</Text>
      <View style={s.row}>
        <View style={s.words}>
          <Text {...frenchText} style={[bType.bold20, { color: t.heroText }]}>{fr}</Text>
          <Text style={[bType.meta, { color: t.heroText }]}>{en}</Text>
        </View>
        {onHear ? (
          <Press haptic="light" accessibilityLabel={`${HEAR_IT_SAID}: ${fr}`} onPress={onHear} style={s.hear}>
            <BSpeaker size={22} color={t.text} />
          </Press>
        ) : null}
      </View>
      <Feedback kind="saved" active={saved} eventKey={eventKey}>
        <View style={s.saved}>
          {saved ? <CheckDisc size={20} fill={t.mint} tick={t.onMint} /> : null}
          <Text accessibilityLiveRegion="polite" style={[bType.semi14, { color: t.heroText }]}>{saveLine}</Text>
        </View>
      </Feedback>
      {children}
    </View>
  );
}

function makeStyles(t: B) {
  return StyleSheet.create({
    card: { backgroundColor: t.heroGround, borderRadius: 24, padding: 16, gap: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    words: { flex: 1, gap: 2 },
    hear: { width: 48, height: 48, borderRadius: 24, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' },
    saved: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 },
  });
}
