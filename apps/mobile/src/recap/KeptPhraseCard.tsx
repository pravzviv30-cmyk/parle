import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Highlight, LipTile, Press } from '../components.tsx';
import { Feedback } from '../motion/Feedback.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { BSpeaker, CheckDisc } from '../today/TodayParts.tsx';
import { bType, radius } from '../theme.ts';
import { HEAR_IT_SAID } from './afterSessionView.ts';

/**
 * "One phrase kept" (UI-020, the one-scroll recap): a lip card on the page's
 * card ground with the French on the shared highlighter (the screen's only
 * chartreuse), its English, a 48pt speaker that plays the tutor's voice, the
 * save line with its tick on a line of its own once the save is durable, and
 * whatever the screen hands in (only "Try saving again" when the save failed).
 */
export function KeptPhraseCard({ fr, en, saveLine, saved, eventKey, onHear, children }: {
  fr: string; en: string; saveLine: string; saved: boolean; eventKey: string; onHear?: () => void; children?: ReactNode;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <LipTile style={s.card}>
      <Text style={[bType.chip, { color: t.link }]}>One phrase kept</Text>
      <View style={s.row}>
        <View style={s.words}>
          <Highlight text={fr} />
          <Text style={[bType.meta, { color: t.muted }]}>{en}</Text>
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
          <Text accessibilityLiveRegion="polite" style={[bType.semi14, s.grow, { color: t.text }]}>{saveLine}</Text>
        </View>
      </Feedback>
      {children}
    </LipTile>
  );
}

function makeStyles(t: B) {
  return StyleSheet.create({
    card: { padding: 16, gap: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    words: { flex: 1, gap: 4 },
    grow: { flex: 1, minWidth: 0 },
    hear: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: t.lavender, alignItems: 'center', justifyContent: 'center' },
    saved: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 },
  });
}
