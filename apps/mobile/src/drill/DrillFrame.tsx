/**
 * The one frame every drill kind stands in (drill B v2, UI-016; drill-b.md,
 * "Screens and states" 1). Presentation only: it decides nothing.
 *
 * Top to bottom:
 * - the header row on the stage band: the screen's own `ScreenHeader` (the
 *   44pt close disc, then `SittingBar`, decorative, no digits, then any
 *   trailing words), so the drill keeps the one shared way out;
 * - the stage band on the family colour (`drillStage`), 28 bottom radius: the
 *   eyebrow, the prompt and an optional English line, then any stage extras
 *   such as Hear it;
 * - the answer area on the `ground`, padding 18;
 * - the footer, pinned by `ScrollScreen`, which already owns the safe area and
 *   the keyboard.
 *
 * The header row stays put while the stage band scrolls with the answer, so a
 * long prompt at large text never pushes the answer off a small phone.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ScrollScreen, TopInset } from '../layout.tsx';
import { bType } from '../theme.ts';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import type { DrillStage } from './drillStage.ts';

/** What the drill screen hands every kind: the parts of the frame that are not the kind's own. */
export interface DrillShell {
  /**
   * The screen's one shared header (`ScreenHeader` with `leave.close`): the
   * 44pt close disc, `SittingBar` in its centre, and any trailing words. The
   * screen builds it, so its way out stays the shared header (F309, F318).
   */
  header: ReactNode;
  /** Drawn at the top of the answer area, before the kind's controls (the moment card). */
  lead?: ReactNode;
  footer?: ReactNode;
  /** Lift the footer over the keyboard. */
  avoidKeyboard?: boolean;
}

export interface DrillFrameProps extends DrillShell {
  stage: DrillStage;
  eyebrow: string;
  /** The prompt. A string is drawn at 23/29 extra bold; a node is drawn as given (use `DrillPrompt`). */
  prompt?: ReactNode;
  /** Read the prompt as a header, as the kinds that had one did. */
  promptIsHeader?: boolean;
  /** The muted English line under the prompt. */
  english?: string;
  /** Anything else that belongs on the stage: Hear it, the IPA, help. */
  stageExtra?: ReactNode;
  /** The answer area. */
  children?: ReactNode;
}

/** The stage prompt's type, for a kind that composes its own prompt node. */
export function DrillPrompt({ children, header = false, center = false }: { children: ReactNode; header?: boolean; center?: boolean }) {
  const t = useB();
  return (
    <Text accessibilityRole={header ? 'header' : undefined} style={[fr.prompt, { color: t.text }, center && { textAlign: 'center' }]}>
      {children}
    </Text>
  );
}

export function DrillFrame({
  stage,
  header,
  lead,
  footer,
  avoidKeyboard = true,
  eyebrow,
  prompt,
  promptIsHeader = false,
  english,
  stageExtra,
  children,
}: DrillFrameProps) {
  const t = useB();
  const s = useThemedStyles(make);
  const band = t[stage.band];
  const top = (
    <View style={[s.top, { backgroundColor: band }]}>
      <TopInset />
      {header}
    </View>
  );
  return (
    <ScrollScreen avoidKeyboard={avoidKeyboard} ground={t.ground} padded={false} bleedTop header={top} footer={footer != null ? <View style={s.foot}>{footer}</View> : undefined}>
      <View style={[s.stage, { backgroundColor: band }]}>
        <Text style={[s.eyebrow, { color: t[stage.eyebrow] }]}>{eyebrow}</Text>
        {typeof prompt === 'string' ? <DrillPrompt header={promptIsHeader}>{prompt}</DrillPrompt> : prompt}
        {english !== undefined ? <Text style={[bType.line15, { color: t.muted }]}>{english}</Text> : null}
        {stageExtra}
      </View>
      <View style={s.area}>
        {lead}
        {children}
      </View>
    </ScrollScreen>
  );
}

/** The board's stage gutter. */
const GUTTER = 18;

const fr = StyleSheet.create({
  prompt: bType.prompt23,
});

function make(_t: B) {
  return StyleSheet.create({
    top: { paddingHorizontal: GUTTER, paddingTop: 14 },
    stage: { paddingHorizontal: GUTTER, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, gap: 8 },
    eyebrow: bType.eyebrow800,
    area: { padding: GUTTER, gap: 16 },
    foot: { paddingHorizontal: GUTTER },
  });
}
