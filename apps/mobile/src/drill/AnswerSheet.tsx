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
 * (`DrillScreen.test.ts`). A sheet that moves on by itself is announced as it
 * arrives. One that waits moves a phone's screen reader onto its Continue once
 * the sheet has risen, and Continue's name carries the whole sheet, so it is
 * heard once and the learner is already on the way on (F775). On the web the
 * live region speaks and focus stays where the learner put it.
 *
 * It slides up and its mark pops in through the motion primitives (`Enter`),
 * which land on the final frame under reduced motion, watched live. It plays
 * nothing itself: the drill fires the sheet's sound and haptic once, through
 * `sheetEffects.ts`, at the moment the answer settles.
 *
 * 2026-10-21 UI-008, artboard B-Drill: the sheet is the feedback panel (radius
 * 20, padding 12/16) with the 28 mint check disc, the 17 bold headline and 14
 * lines, and a waiting sheet's Continue sits under the panel rather than in
 * it. Pass is the mint wash with green words, nearly the butter, a miss the
 * card under a hairline; all from the theme, so the panel follows dark.
 */

import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View, findNodeHandle } from 'react-native';

import { CheckGlyph, PillButton } from '../components.tsx';
import { Enter } from '../motion/layout.tsx';
import { DUR } from '../motion/tokens.ts';
import { HAIRLINE, HIT, bType, decorative, frenchText, space } from '../theme.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { SHEET_COPY, continueName, sheetArrival, spokenSheet, type AnswerSheetModel, type SheetTone } from './answerSheet.ts';

/** How far the sheet rises as it arrives. */
const RISE = space(6);
/** The check disc. */
const MARK = 28;

/** The panel's ground and words, by tone, in the mode the sheet draws in. */
function groundFor(tone: SheetTone, t: B): { fill: string; head: string; ink: string } {
  if (tone === 'good') return { fill: t.mintWash, head: t.mintWords, ink: t.secondary };
  if (tone === 'nearly') return { fill: t.butter, head: t.text, ink: t.secondary };
  return { fill: t.card, head: t.text, ink: t.secondary };
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
  const t = useB();
  const st = useThemedStyles(makeStyles);
  const ground = groundFor(sheet.tone, t);
  const waits = sheet.autoAdvanceMs === null;
  const spoken = spokenSheet(sheet, note);
  // The reason is "French = English": split once, at the first " = ".
  const cut = sheet.reason?.indexOf(' = ') ?? -1;
  const reasonFr = cut < 0 ? sheet.reason : sheet.reason!.slice(0, cut);
  const reasonEn = cut < 0 ? null : sheet.reason!.slice(cut + 3);
  const named = continueName(spoken);
  const arrival = sheetArrival(sheet, Platform.OS === 'web');

  const continueRef = useRef<View>(null);
  // True once a screen reader has been moved onto Continue for this sheet.
  const placed = useRef(false);
  // A sheet that waits moves the reader onto its Continue once, after it has
  // risen, so there is something there to land on; if it cannot, the sheet is
  // announced instead. One that moves on by itself is announced as it arrives.
  // Either is said again if the scorer's line joins it.
  useEffect(() => {
    if (arrival === 'live-region') return undefined;
    if (arrival === 'focus-continue' && !placed.current) {
      const timer = setTimeout(() => {
        placed.current = true;
        const handle = findNodeHandle(continueRef.current);
        if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
        else AccessibilityInfo.announceForAccessibility(spoken);
      }, DUR.fast);
      return () => clearTimeout(timer);
    }
    AccessibilityInfo.announceForAccessibility(spoken);
    return undefined;
  }, [spoken, arrival]);

  const body = (
    <View style={[st.panel, { backgroundColor: ground.fill }, sheet.tone === 'calm' && st.calm]}>
      {sheet.mark && (
        <Enter from="none" scaleFrom={0.6} delay={DUR.micro} duration={DUR.fast}>
          <View {...decorative} style={st.mark}>
            <CheckGlyph size={18} color={t.onMint} />
          </View>
        </Enter>
      )}
      <View style={st.words}>
        <Text style={[bType.bold17, { color: ground.head }]}>{sheet.headline}</Text>
        {sheet.detail !== null && <Text style={[bType.meta, { color: ground.ink }]}>{sheet.detail}</Text>}
        {sheet.french !== null && (
          <Text {...frenchText} style={[bType.meta, { color: ground.ink }]}>
            «{sheet.french}»
          </Text>
        )}
        {sheet.reason !== null && (
          // Two siblings, so a screen reader speaks each half in its own language.
          <View style={st.reason}>
            <Text {...frenchText} style={[bType.meta, { color: ground.ink }]}>{reasonFr}</Text>
            {reasonEn !== null && <Text style={[bType.meta, { color: ground.ink }]}>{` = ${reasonEn}`}</Text>}
          </View>
        )}
        {sheet.after !== null && <Text style={[bType.meta, { color: ground.ink }]}>{sheet.after}</Text>}
        {note !== null && note !== '' && <Text style={[bType.meta, { color: ground.ink }]}>{note}</Text>}
      </View>
    </View>
  );

  return (
    <Enter from="down" distance={RISE} duration={DUR.fast}>
      <View accessibilityLiveRegion="polite" style={st.sheet}>
        {waits ? (
          <>
            {body}
            <PillButton ref={continueRef} label={SHEET_COPY.continue} accessibilityLabel={named} onPress={onContinue} lip />
          </>
        ) : (
          <Pressable onPress={onContinue} accessibilityRole="button" accessibilityLabel={named} style={st.tap}>
            {body}
          </Pressable>
        )}
      </View>
    </Enter>
  );
}

function makeStyles(t: B) {
  return StyleSheet.create({
    sheet: { gap: 10 },
    panel: { borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    calm: { borderWidth: HAIRLINE, borderColor: t.line },
    tap: { minHeight: HIT, justifyContent: 'center' },
    words: { flex: 1, minWidth: 0, gap: space(0.5) },
    reason: { flexDirection: 'row', flexWrap: 'wrap' },
    mark: { width: MARK, height: MARK, borderRadius: MARK / 2, backgroundColor: t.mint, alignItems: 'center', justifyContent: 'center' },
  });
}
