/**
 * The first win, shown (come alive, README Part 5.C row 8; the decisions are
 * `winModel.ts`).
 *
 * "You said" and the learner's own line, exactly as it was checked, then "A
 * natural way to say it" and the task's natural line with a way to hear it.
 * When the two are the same, one row says so instead. After an echo the
 * feedback line already holds the model (D20), so it is not shown twice. When
 * the reply was not accepted, the natural line is the highlighted one to try.
 *
 * `WinArt` is the moment in place around the page's drawing: a held bloom of
 * flat sun discs behind it, the drawing rising into place, and one burst of
 * confetti, only for a celebrated reply and only when it has just arrived from
 * a real submit. Reduced motion: the bloom at rest, the drawing in place and no
 * confetti (each primitive watches the setting live).
 */

import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckGlyph, Highlight, IconButton, ROW_WORDS } from '../../components.tsx';
import { Burst } from '../../motion/Burst.tsx';
import { DiscBloom } from '../../motion/DiscBloom.tsx';
import { Enter } from '../../motion/layout.tsx';
import { BLOOM, DUR } from '../../motion/tokens.ts';
import { colour, decorative, frenchText, paper, radius, space, type } from '../../theme.ts';
import { FIRST_RUN_COPY } from './copy.ts';
import { WIN_BURST, type WinView } from './winModel.ts';

/** How far the drawing rises into place, and the scale it grows from. */
const ART_RISE = 30;
const ART_FROM = 0.9;
/** The art rises a beat after the bloom opens. */
const ART_WAIT = 150;

export function WinArt({ celebrate, moment, children }: { celebrate: boolean; moment: string | null; children: ReactNode }) {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  if (!celebrate) return <>{children}</>;
  const bloom = box === null ? 0 : Math.min(box.width, box.height) / 2;
  const size = 2 * bloom * BLOOM.discs[BLOOM.discs.length - 1]!.size;
  return (
    <View
      style={st.art}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) setBox({ width, height });
      }}
    >
      {box !== null ? (
        <DiscBloom color={colour.sun} radius={bloom} hold style={[st.layer, { left: (box.width - size) / 2, top: (box.height - size) / 2 }]} />
      ) : null}
      <Enter key={moment ?? 'still'} play={moment !== null} distance={ART_RISE} scaleFrom={ART_FROM} duration={DUR.reveal} delay={ART_WAIT}>
        {children}
      </Enter>
      {moment !== null && box !== null ? (
        <Burst seed={moment} origin={{ x: box.width / 2, y: box.height / 2 }} count={WIN_BURST} ground="coral" />
      ) : null}
    </View>
  );
}

export function WinCard({
  view,
  feedback,
  onHear,
  playing = false,
}: {
  view: WinView;
  /** The feedback line the check returned. */
  feedback: string;
  /** Hear the natural line, when a recording of it exists. */
  onHear?: () => void;
  playing?: boolean;
}) {
  return (
    <View style={st.card}>
      <View style={st.block}>
        <Text style={[type.small, { color: paper.inkSoft }]}>{FIRST_RUN_COPY.youSaid}</Text>
        <Text {...frenchText} style={[type.frenchLg, { color: paper.ink }]}>
          {view.said}
        </Text>
      </View>
      {view.identical ? (
        <View style={st.same}>
          <View {...decorative} style={st.tick}>
            <CheckGlyph size={18} color={paper.ink} />
          </View>
          <Text style={[type.bodyStrong, st.words]}>{FIRST_RUN_COPY.exactlyNatural}</Text>
        </View>
      ) : null}
      {view.showModel ? (
        <View style={[st.block, st.divided]}>
          <Text style={[type.small, { color: paper.inkSoft }]}>{view.modelLabel}</Text>
          <View style={st.modelRow}>
            <View style={st.words}>
              {view.celebrate ? (
                <Text {...frenchText} style={[type.frenchLg, { color: paper.ink }]}>
                  {view.model}
                </Text>
              ) : (
                <Highlight text={view.model} />
              )}
            </View>
            {onHear != null ? (
              <IconButton icon="speaker" label={playing ? 'Stop' : 'Hear'} accessibilityLabel={playing ? 'Stop' : 'Hear the natural line'} onPress={onHear} animate="speaker-waves" active={playing} tone="ink" />
            ) : null}
          </View>
        </View>
      ) : null}
      <Text style={[type.body, { color: paper.ink }]}>{feedback}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  art: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  layer: { position: 'absolute' },
  card: { backgroundColor: paper.card, borderRadius: radius.card, padding: space(5), gap: space(4) },
  block: { gap: space(1) },
  divided: { borderTopWidth: 1, borderTopColor: paper.line, paddingTop: space(4) },
  same: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  tick: { height: space(7), aspectRatio: 1, borderRadius: radius.pill, backgroundColor: colour.mint, alignItems: 'center', justifyContent: 'center' },
  modelRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  words: { ...ROW_WORDS },
});
