import { StyleSheet, Text, View } from 'react-native';

import { ArrowRight, BadgeGlyph, Card, Label, TintPanel } from '../components.tsx';
import { SpeakBubbles } from '../illustrations.tsx';
import type { OutOfMinutesCode } from '../live/useLiveSession.ts';
import { accent, paper, signal, space, type } from '../theme.ts';
import {
  LIMIT_BODY,
  LIMIT_FREE,
  LIMIT_LABEL,
  LIMIT_LAPSED,
  LIMIT_LOW,
  LIMIT_PLAN,
  LIMIT_READY,
  LIMIT_TITLE,
  LIMIT_TRIAL,
} from './wallCopy.ts';

function titleFor(code: OutOfMinutesCode): string {
  if (code === 'subscription-lapsed') return LIMIT_LAPSED;
  if (code === 'insufficient-for-session') return LIMIT_LOW;
  if (code === 'trial already claimed') return LIMIT_TRIAL;
  return LIMIT_TITLE;
}

/** A warm hand-off between a refused conversation and the value story. */
export function WallLimitPage({ code, canBuy }: { code: OutOfMinutesCode; canBuy: boolean }) {
  return (
    <View>
      <TintPanel tint="rose" style={st.hero}>
        <View style={st.art}>
          <SpeakBubbles width={144} />
        </View>
        <Label color={accent.primary}>{LIMIT_LABEL}</Label>
        <Text accessibilityRole="header" style={st.title}>{titleFor(code)}</Text>
        <Text style={st.body}>{LIMIT_BODY}</Text>
      </TintPanel>

      <Card style={st.proof}>
        <View style={st.row}>
          <BadgeGlyph size={20} color={signal.good} />
          <Text style={st.line}>{LIMIT_READY}</Text>
        </View>
        <View style={st.row}>
          <ArrowRight size={20} color={accent.primary} />
          <Text style={st.line}>{canBuy ? LIMIT_PLAN : LIMIT_FREE}</Text>
        </View>
      </Card>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { padding: space(5), overflow: 'hidden' },
  art: { height: 118, alignItems: 'center', justifyContent: 'center', marginBottom: space(2) },
  title: { ...type.display, color: paper.ink, marginTop: space(2) },
  body: { ...type.body, color: paper.inkSoft, marginTop: space(2) },
  proof: { marginTop: space(4), paddingVertical: space(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2.5) },
  line: { ...type.bodyStrong, color: paper.ink, flex: 1, minWidth: 0 },
});
