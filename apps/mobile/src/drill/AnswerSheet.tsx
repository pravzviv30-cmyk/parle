/**
 * The answer sheet: what the drill says about one answer, rising into the
 * foot of the sitting (README Part 5.E "Answer sheet"; the words, the sound and
 * the pace are decided in `answerSheet.ts`, and this only draws them).
 *
 * A sheet that moves on by itself can be tapped to move on sooner. One that
 * waits (a miss with a form, or any sheet while a screen reader is on) carries
 * its own Continue, drawn here so the drill's own pill count stays what it is
 * (`DrillScreen.test.ts`). A sheet that moves on by itself is announced as it
 * arrives. One that waits moves a phone's screen reader onto its Continue once
 * the sheet has risen, and Continue's name carries the whole sheet, so it is
 * heard once and the learner is already on the way on (F775). On the web the
 * live region speaks and focus stays where the learner put it.
 *
 * It rises through the motion primitives (`Enter`, and `PopIn` for Cloud),
 * which land on the final frame under reduced motion. It plays nothing itself:
 * the drill fires the sheet's sound and haptic once, through `sheetEffects.ts`,
 * at the moment the answer settles. Hear it is the learner's own tap.
 *
 * 2026-10-31 drill B v2 (UI-016; drill-b.md "Sheet"): one bottom sheet in
 * four tones, all from the theme, radius 26 at the top, padding 20/18/26.
 * - Right: the mint wash, Cloud cheering beside the green headline (the one
 *   place Cloud appears in a sitting), then the exercise's own French, its
 *   English and a Hear it pill.
 * - Nearly: the butter, "Nearly." and the spelling; the field above lights the
 *   letter (`litLetters.ts`).
 * - Miss: the card under a `line` top edge, no mark. The French with a 44pt
 *   Hear it disc, one Notice on the stage's own colour with the reason, the
 *   after-line, then Continue.
 * Cloud, the check and the glyphs are hidden from a screen reader.
 */

import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, Pressable, ScrollView, StyleSheet, Text, View, findNodeHandle } from 'react-native';

import { CheckGlyph, EarGlyph, PillButton } from '../components.tsx';
import { Cloud } from '../art/mascots/Cloud.tsx';
import { PopIn } from '../motion/MascotMotion.tsx';
import { Enter } from '../motion/layout.tsx';
import { DUR } from '../motion/tokens.ts';
import { HIT, bType, decorative, frenchText, space } from '../theme.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import * as tutorVoice from '../speech/tutorVoice.ts';
import { SHEET_COPY, continueName, sheetArrival, spokenSheet, type AnswerSheetModel, type SheetTone } from './answerSheet.ts';
import { drillStage, type StageSurface } from './drillStage.ts';
import { useFootLayout } from './DrillFrame.tsx';
import type { SheetLine } from './sheetLine.ts';

/** How far the sheet rises as it arrives. */
const RISE = space(6);
/** The check disc beside a nearly. */
const MARK = 28;
/** Cloud beside a right headline. */
const CLOUD = 52;
/** The board's sheet padding: 20 top, 18 sides, 26 bottom over the safe area. */
const PAD = { top: 20, side: 18, bottom: 26 } as const;

/** The sheet's ground and words, by tone, in the mode the sheet draws in. */
function groundFor(tone: SheetTone, t: B): { fill: string; head: string; ink: string } {
  if (tone === 'good') return { fill: t.mintWash, head: t.mintWords, ink: t.text };
  if (tone === 'nearly') return { fill: t.butter, head: t.text, ink: t.text };
  return { fill: t.card, head: t.text, ink: t.text };
}

export function AnswerSheet({
  sheet,
  note = null,
  onContinue,
  kind,
  line = null,
}: {
  sheet: AnswerSheetModel;
  /** The scorer's one calm line, when it arrived in time. */
  note?: string | null;
  onContinue: () => void;
  /** The surface answered, for the stage colour behind a miss's Notice. */
  kind: StageSurface;
  /** A right answer's own French and English (`sheetLine.ts`), or null. */
  line?: SheetLine | null;
}) {
  const t = useB();
  const st = useThemedStyles(makeStyles);
  const foot = useFootLayout();
  const stage = drillStage(kind, t.mode);
  const ground = groundFor(sheet.tone, t);
  const waits = sheet.autoAdvanceMs === null;
  const spoken = spokenSheet(sheet, note);
  // The reason is "French = English": split once, at the first " = ".
  const cut = sheet.reason?.indexOf(' = ') ?? -1;
  const reasonFr = cut < 0 ? sheet.reason : sheet.reason!.slice(0, cut);
  const reasonEn = cut < 0 ? null : sheet.reason!.slice(cut + 3);
  const named = continueName(spoken);
  const arrival = sheetArrival(sheet, Platform.OS === 'web');
  const good = sheet.tone === 'good';
  const right = good ? line : null;

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

  // A right answer's English and its Hear it pill. Kept outside the sheet's
  // own tap target, so Hear it is never a button inside a button; the English
  // beside it still moves on when tapped.
  const hearRow = right !== null ? (
    <View style={st.between}>
      <Pressable onPress={waits ? undefined : onContinue} disabled={waits} accessible={false} style={st.grow}>
        {right.en !== null ? <Text style={[bType.meta, { color: ground.ink }]}>{right.en}</Text> : null}
      </Pressable>
      <Pressable
        onPress={() => tutorVoice.speak(right.fr)}
        accessibilityRole="button"
        accessibilityLabel="Hear it in French"
        style={({ pressed }) => [st.hearPill, { backgroundColor: t.mintWords }, pressed && { opacity: 0.7 }]}
      >
        <EarGlyph size={16} color={t.mintWash} />
        <Text style={[bType.bold14, { color: t.mintWash }]}>Hear it</Text>
      </Pressable>
    </View>
  ) : null;

  const body = (
    <View style={st.words}>
      <View style={st.headRow}>
        {sheet.mark && (
          good ? (
            // Cloud cheers on a right answer only: decorative, and the one
            // place a mascot appears during a sitting.
            <View {...decorative}>
              <PopIn play>
                <Cloud expression="cheer" size={CLOUD} />
              </PopIn>
            </View>
          ) : (
            <View {...decorative} style={st.mark}>
              <CheckGlyph size={18} color={t.onMint} />
            </View>
          )
        )}
        <Text style={[bType.sheet21, st.grow, { color: ground.head }]}>{sheet.headline}</Text>
      </View>
      {sheet.detail !== null && <Text style={[bType.meta, { color: ground.ink }]}>{sheet.detail}</Text>}
      {right !== null && <Text {...frenchText} style={[bType.bold17, { color: ground.ink }]}>{right.fr}</Text>}
      {sheet.french !== null && (
        <View style={st.between}>
          <Text {...frenchText} style={[bType.bold17, st.grow, { color: ground.ink }]}>
            «{sheet.french}»
          </Text>
          <Pressable
            onPress={() => tutorVoice.speak(sheet.french!)}
            accessibilityRole="button"
            accessibilityLabel="Hear it in French"
            style={({ pressed }) => [st.hearDisc, { backgroundColor: t[stage.band] }, pressed && { opacity: 0.7 }]}
          >
            <EarGlyph size={18} color={t.text} />
          </Pressable>
        </View>
      )}
      {sheet.reason !== null && (
        // The Notice, on the stage's own colour. Two siblings, so a screen
        // reader speaks each half of the reason in its own language.
        <View style={[st.notice, { backgroundColor: t[stage.band] }]}>
          <Text style={[bType.eyebrow800, { color: t[stage.eyebrow] }]}>Notice</Text>
          <View style={st.reason}>
            <Text {...frenchText} style={[bType.meta, { color: ground.ink }]}>{reasonFr}</Text>
            {reasonEn !== null && <Text style={[bType.meta, { color: ground.ink }]}>{` = ${reasonEn}`}</Text>}
          </View>
        </View>
      )}
      {sheet.after !== null && <Text style={[bType.meta, { color: t.muted }]}>{sheet.after}</Text>}
      {note !== null && note !== '' && <Text style={[bType.meta, { color: ground.ink }]}>{note}</Text>}
    </View>
  );

  return (
    <Enter from="down" distance={RISE} duration={DUR.fast}>
      <View
        accessibilityLiveRegion="polite"
        style={[st.sheet, { backgroundColor: ground.fill, paddingBottom: PAD.bottom + foot.inset, maxHeight: foot.maxHeight }, sheet.tone === 'calm' && st.calm]}
      >
        {/* The sheet takes its natural height up to the frame's cap; past it
            only this body scrolls, and Continue stays pinned below it, always
            fully on screen (sheetLayout.ts). */}
        <ScrollView style={st.scroll} contentContainerStyle={st.scrollBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
          {waits ? (
            <>
              {body}
              {hearRow}
            </>
          ) : (
            <>
              <Pressable onPress={onContinue} accessibilityRole="button" accessibilityLabel={named} style={st.tap}>
                {body}
              </Pressable>
              {hearRow}
            </>
          )}
        </ScrollView>
        {waits ? <PillButton ref={continueRef} label={SHEET_COPY.continue} accessibilityLabel={named} onPress={onContinue} lip /> : null}
      </View>
    </Enter>
  );
}

function makeStyles(t: B) {
  return StyleSheet.create({
    sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: PAD.top, paddingHorizontal: PAD.side, gap: 12 },
    // The miss is the card under a 2pt line edge at its top, and nothing else.
    calm: { borderTopWidth: 2, borderColor: t.line },
    tap: { minHeight: HIT, justifyContent: 'center' },
    // The body shrinks under the cap and scrolls; it never pushes Continue off.
    scroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
    scrollBody: { gap: 12 },
    words: { gap: 8 },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    grow: { flex: 1, minWidth: 0 },
    between: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    hearPill: { minHeight: HIT, borderRadius: HIT / 2, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
    hearDisc: { width: HIT, height: HIT, borderRadius: HIT / 2, alignItems: 'center', justifyContent: 'center' },
    notice: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
    reason: { flexDirection: 'row', flexWrap: 'wrap' },
    mark: { width: MARK, height: MARK, borderRadius: MARK / 2, backgroundColor: t.mint, alignItems: 'center', justifyContent: 'center' },
  });
}
