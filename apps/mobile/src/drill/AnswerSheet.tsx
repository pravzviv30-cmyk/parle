/**
 * The answer sheet: what the drill says about one answer, sliding up into the
 * foot of the sitting (README Part 5.E "Answer sheet"; the words, the sound and
 * the pace are decided in `answerSheet.ts`, and this only draws them).
 *
 * Mint for a pass, sun for a typo the drill accepted, white paper under a
 * hairline for a miss. A check sits beside a pass and a typo and never beside a
 * miss: a drawing scolds louder than a word. The French, when there is some to
 * read, sits on its own line in guillemets, marked as French for a screen
 * reader.
 *
 * A sheet that moves on by itself can be tapped to move on sooner. One that
 * waits (the second miss, or any sheet while a screen reader is on) carries its
 * own Continue, drawn here so the drill's own pill count stays what it is
 * (`DrillScreen.test.ts`). The sheet is announced as it arrives.
 *
 * It slides up and its mark pops in through the motion primitives (`Enter`),
 * which land on the final frame under reduced motion, watched live. It plays
 * nothing itself: the drill fires the sheet's sound and haptic once, through
 * `sheetEffects.ts`, at the moment the answer settles.
 */

import { useEffect } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckGlyph, PillButton } from '../components.tsx';
import { Enter } from '../motion/layout.tsx';
import { DUR } from '../motion/tokens.ts';
import { HAIRLINE, HIT, colour, decorative, frenchText, onColour, paper, radius, space, textOn, type } from '../theme.ts';
import { SHEET_COPY, type AnswerSheetModel, type SheetTone } from './answerSheet.ts';

/** How far the sheet rises as it arrives. */
const RISE = space(6);
/** The check disc. */
const MARK = 28;

const GROUND: Readonly<Record<SheetTone, { fill: string; ink: string; soft: string }>> = {
  good: { fill: colour.mint, ink: textOn.mint, soft: onColour.mint },
  nearly: { fill: colour.sun, ink: textOn.sun, soft: onColour.sun },
  calm: { fill: paper.card, ink: paper.ink, soft: paper.inkSoft },
};

/** Everything the sheet says, in reading order, as one sentence for a screen reader. */
export function spokenSheet(sheet: AnswerSheetModel, note: string | null): string {
  return [sheet.headline, sheet.detail, sheet.french, sheet.after, note].filter((part): part is string => part !== null && part !== '').join(' ');
}

export function AnswerSheet({
  sheet,
  note = null,
  onContinue,
}: {
  sheet: AnswerSheetModel;
  /** The scorer's one calm line, when it arrived in time. */
  note?: string | null;
  onContinue: () => void;
}) {
  const ground = GROUND[sheet.tone];
  const waits = sheet.autoAdvanceMs === null;
  const spoken = spokenSheet(sheet, note);

  // Said once as it arrives, and again if the scorer's line joins it.
  useEffect(() => {
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(spoken);
  }, [spoken]);

  const body = (
    <View style={st.row}>
      {sheet.mark && (
        <Enter from="none" scaleFrom={0.6} delay={DUR.micro} duration={DUR.fast}>
          <View {...decorative} style={st.mark}>
            <CheckGlyph size={18} color={paper.ink} />
          </View>
        </Enter>
      )}
      <View style={st.words}>
        <Text style={[type.bodyStrong, { color: ground.ink }]}>{sheet.headline}</Text>
        {sheet.detail !== null && <Text style={[type.body, { color: ground.ink }]}>{sheet.detail}</Text>}
        {sheet.french !== null && (
          <Text {...frenchText} style={[type.french, { color: ground.ink }]}>
            «{sheet.french}»
          </Text>
        )}
        {sheet.after !== null && <Text style={[type.small, { color: ground.soft }]}>{sheet.after}</Text>}
        {note !== null && note !== '' && <Text style={[type.small, { color: ground.soft }]}>{note}</Text>}
      </View>
    </View>
  );

  return (
    <Enter from="down" distance={RISE} duration={DUR.fast}>
      <View
        accessibilityLiveRegion="polite"
        style={[st.sheet, { backgroundColor: ground.fill }, sheet.tone === 'calm' && st.calm]}
      >
        {waits ? (
          <>
            {body}
            <PillButton label={SHEET_COPY.continue} onPress={onContinue} />
          </>
        ) : (
          <Pressable onPress={onContinue} accessibilityRole="button" accessibilityLabel={`${spoken} ${SHEET_COPY.continue}`} style={st.tap}>
            {body}
          </Pressable>
        )}
      </View>
    </Enter>
  );
}

const st = StyleSheet.create({
  sheet: { borderRadius: radius.card, padding: space(4), gap: space(3) },
  calm: { borderWidth: HAIRLINE, borderColor: paper.line },
  tap: { minHeight: HIT, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  words: { flex: 1, minWidth: 0, gap: space(1) },
  mark: { width: MARK, height: MARK, borderRadius: MARK / 2, backgroundColor: paper.card, alignItems: 'center', justifyContent: 'center' },
});
