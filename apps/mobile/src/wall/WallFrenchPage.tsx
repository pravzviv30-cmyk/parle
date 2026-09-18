import { StyleSheet, Text, View } from 'react-native';

import { Card, FlameGlyph, GhostButton, MicGlyph, WeekRail } from '../components.tsx';
import { HAIRLINE, paper, radius, signal, space, type } from '../theme.ts';
import {
  FRENCH_DAYS,
  FRENCH_OPEN_BANK,
  FRENCH_START,
  FRENCH_SUB,
  FRENCH_TITLE,
  FRENCH_WEEK,
} from './wallCopy.ts';
import type { WallFrench } from './wallFrench.ts';

const WELL = 36;

/**
 * Page two. The learner's own French, and that it is adding up.
 *
 * Null gates and a stylesheet, the same bargain page one strikes. Every count
 * and every label came from `progress/momentum.ts` by way of `wallFrench.ts`,
 * so Home and this page cannot disagree about how many phrases somebody has.
 *
 * The page is drawn whether or not there is evidence. A learner at the very
 * start reads what will collect here, which is true and is an invitation; the
 * alternative is a nought, and a nought on a purchase surface is the app opening
 * with the worst thing it knows about you.
 *
 * The way out lives here rather than anywhere else in the wall, because this is
 * the page that makes the promise. "You can keep practising what you learned for
 * free" is only believable on a screen that hands you the door.
 */
export function WallFrenchPage({ french, onOpenBank }: { french: WallFrench; onOpenBank: () => void }) {
  return (
    <View>
      <Text accessibilityRole="header" style={st.title}>{FRENCH_TITLE}</Text>
      <Text style={st.sub}>{french.hasEvidence ? FRENCH_SUB : FRENCH_START}</Text>

      {french.hasEvidence && (
        <Card tone="feature" style={st.hero}>
          <View style={st.head}>
            <View style={st.well}>
              <MicGlyph size={18} color={signal.good} />
            </View>
            <View style={st.words}>
              <View style={st.count}>
                {french.count !== null && <Text style={st.number}>{french.count}</Text>}
                {french.weekLine !== null && (
                  <View style={st.pill}>
                    <Text style={st.gain}>{french.weekLine}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {french.chips.length > 0 && (
            <View style={st.chips}>
              {french.chips.map((chip) => (
                <View key={chip} style={st.chip}>
                  <Text style={st.chipWord}>{chip}</Text>
                </View>
              ))}
            </View>
          )}
          {french.moreLine !== null && <Text style={st.more}>{french.moreLine}</Text>}
        </Card>
      )}

      <Card style={st.tile}>
        <View style={st.head}>
          <FlameGlyph />
          <Text style={st.label}>{FRENCH_DAYS}</Text>
          {french.days !== null && <Text style={st.number}>{french.days}</Text>}
        </View>
        <Text style={st.week}>{FRENCH_WEEK}</Text>
        {/* A picture of the last seven days and never a target: the count above
            already says it, so the row itself is decorative. It is the shared
            rail since revamp A, so the week looks the same on Home, on Profile
            and here, in the one violet the calendar record wears. */}
        <WeekRail week={french.week} />
      </Card>

      <View style={st.out}>
        <View style={st.rule} />
        <GhostButton label={FRENCH_OPEN_BANK} onPress={onOpenBank} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  title: { ...type.display, color: paper.ink },
  sub: { ...type.body, color: paper.inkSoft, marginTop: space(2) },
  hero: { marginTop: space(6), padding: space(4) },
  tile: { marginTop: space(3), padding: space(4) },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  well: {
    width: WELL,
    height: WELL,
    borderRadius: radius.chip,
    backgroundColor: paper.groundDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { flex: 1, minWidth: 0 },
  label: { ...type.small, color: paper.inkSoft, flex: 1, minWidth: 0 },
  count: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: space(2) },
  number: { ...type.title, color: paper.ink },
  // `paper.ground` rather than `paper.groundDeep`: green words measure 4.96 on
  // the first and 4.32 on the second, and words clear 4.5 or they are not words.
  pill: {
    borderRadius: radius.pill,
    backgroundColor: paper.ground,
    paddingVertical: space(1),
    paddingHorizontal: space(2.5),
    flexShrink: 1,
    minWidth: 0,
  },
  gain: { ...type.small, color: signal.good },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(4) },
  chip: {
    flexShrink: 1,
    minWidth: 0,
    backgroundColor: paper.groundDeep,
    borderRadius: radius.chip,
    paddingVertical: space(1),
    paddingHorizontal: space(2.5),
  },
  chipWord: { ...type.frenchSm, color: paper.ink },
  more: { ...type.small, color: paper.inkSoft, marginTop: space(2) },
  week: { ...type.small, color: paper.inkSoft, marginTop: space(3) },
  out: { marginTop: space(5) },
  rule: { height: HAIRLINE, backgroundColor: paper.line, marginBottom: space(2) },
});
