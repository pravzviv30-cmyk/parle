/**
 * The notebook sheet of the live room, direction D (UI-014): one notebook in
 * place of the bubbles and the separate transcript.
 *
 * The sheet sits on the theme's ground and grows upward as lines arrive, up to
 * the room's cap, then scrolls inside, pinned to the newest line by the same
 * scroll controller the transcript uses (`c2TranscriptPolicy.ts`). Which lines
 * show, and how large, is `notebookLines()` (notebookView.ts). A recast is a
 * margin note under the line it corrects, brought by the toast; its words are
 * `recastView()`'s, the same the transcript says.
 *
 * Narration carries English in its `fr` field, as the transcript's does, so it
 * is never marked French. Nothing here makes a sound or a haptic.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Toast } from '../art/mascots/Toast.tsx';
import { Press, fitDisplay } from '../components.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { BubbleIn } from '../motion/BubbleIn.tsx';
import { useReduceMotion } from '../motion.ts';
import { HIT, bType, decorative, frenchText, type } from '../theme.ts';
import { BSpeaker } from '../today/TodayParts.tsx';
import { recastView } from '../tutor/recastLabel.ts';
import { replayEar } from '../tutor/replayEar.ts';
import { replyAnnouncement, transcriptTail } from '../tutor/transcriptTail.ts';
import { createTranscriptScrollController, latestSentMessageId } from './c2TranscriptPolicy.ts';
import { notebookLines, type NotebookItem } from './notebookView.ts';
import type { TurnLine } from './turns.ts';

type Recast = NotebookItem['recasts'][number];

/** The margin note: the better French in bold, its English, and the reason behind "Why?". */
export function MarginFix({ recast, latest }: { recast: Recast; latest: boolean }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const [expanded, setExpanded] = useState(false);
  const view = recastView(recast, { latest });
  return (
    <View style={s.fixRow}>
      <View style={s.fix}>
        <View accessible accessibilityLabel={`${view.label}: ${view.better}. ${view.betterEn}`}>
          <Text style={[bType.bold12, { color: t.text }]}>{view.label}</Text>
          <Text {...frenchText} style={[bType.bold15, { color: t.text }]}>{view.better}</Text>
          <Text style={[bType.note, { color: t.text }]}>{view.betterEn}</Text>
        </View>
        {view.reason !== null ? <>
          <Press haptic="none" accessibilityRole="button" accessibilityLabel="Why this form?" accessibilityState={{ expanded }} aria-expanded={expanded}
            onPress={() => setExpanded((value) => !value)} style={s.why}>
            <Text style={[bType.semi13, s.underline, { color: t.text }]}>Why?</Text>
          </Press>
          {expanded ? <Text style={[bType.note, { color: t.text }]}>{view.reason}</Text> : null}
        </> : null}
      </View>
      <View {...decorative} style={s.toast}><Toast size={34} /></View>
    </View>
  );
}

/** One line of the notebook, drawn by its kind and emphasis. */
export function NotebookLine({ item, tutorName, latestCorrection, onReplay, tutorSpeaking, announce }: {
  item: NotebookItem;
  tutorName: string;
  /** This line carries the scene's latest correction. */
  latestCorrection: boolean;
  /** Given only on the newest tutor line. */
  onReplay?: () => void;
  tutorSpeaking: boolean;
  /** Typing: the newest tutor line is a polite live region. */
  announce: boolean;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  if (item.kind === 'narration') {
    return <Text style={[bType.meta, s.narration, { color: t.muted }]}>{item.fr}</Text>;
  }
  if (item.kind === 'tutor') {
    if (item.emphasis === 'older') {
      return <Text {...frenchText} accessibilityLabel={`${tutorName}: ${item.fr}`} style={[type.frenchSm, { color: t.muted }]}>{item.fr}</Text>;
    }
    const ear = replayEar({ isLastTutorLine: true, canReplay: onReplay !== undefined, sounding: tutorSpeaking });
    return (
      <View style={s.newest}>
        <View style={s.newestWords}>
          <Text {...frenchText} accessibilityLiveRegion={announce ? 'polite' : 'none'} style={[fitDisplay(item.fr), { color: t.text }]}>{item.fr}</Text>
          {item.en ? <Text style={[type.body, { color: t.muted }]}>{item.en}</Text> : null}
        </View>
        {ear !== 'hidden' && onReplay ? (
          <Press haptic="none" accessibilityRole="button" accessibilityLabel={`Hear that line again: ${item.fr}`} onPress={onReplay}
            style={[s.hear, ear === 'sounding' && s.hearSounding]}>
            <BSpeaker size={20} color={t.text} />
          </Press>
        ) : null}
      </View>
    );
  }
  const big = item.emphasis === 'newest';
  return (
    <View style={s.learner}>
      <View accessible accessibilityLabel={item.partial ? `You, still listening: ${item.fr}` : `You: ${item.fr}`} style={[s.mark, { backgroundColor: t.sun }]}>
        <Text {...frenchText} style={[big ? type.french : type.frenchSm, s.learnerText, { color: t.onSun }]}>
          {item.fr}{item.partial ? <Text {...decorative}>{' |'}</Text> : null}
        </Text>
      </View>
      {item.recasts.map((recast, index) => (
        <MarginFix key={`${recast.textTurnId ?? 'legacy'}:${recast.correctionIndex ?? index}:${recast.quote}:${recast.better}`} recast={recast}
          latest={latestCorrection && index === item.recasts.length - 1} />
      ))}
    </View>
  );
}

/**
 * The sheet: the theme's ground, top radius 28, its lines at the foot above
 * the dock, scrolling inside once it reaches its cap. `children` is the dock,
 * drawn on the same ground under the lines.
 */
export function NotebookSheet({ turns, partialTranscript, transcriptVisible, tutorName, tutorSpeaking, announceReply, onReplayTutor,
  focusRevision, focusActive, onDismissKeyboard, children }: {
  turns: readonly TurnLine[];
  partialTranscript?: string | null;
  /** False: only the newest tutor line and the learner's current or last line. */
  transcriptVisible: boolean;
  tutorName: string;
  tutorSpeaking: boolean;
  announceReply: boolean;
  onReplayTutor?: () => void;
  focusRevision: number;
  focusActive: boolean;
  onDismissKeyboard: () => void;
  children?: ReactNode;
}) {
  const s = useThemedStyles(makeStyles);
  const ref = useRef<ScrollView>(null);
  const [, setNewLines] = useState(false);
  // Lines there when the sheet opened arrive in place; later ones arrive.
  const [present] = useState(() => new Set(turns.map((turn) => turn.id)));
  const reduced = useReduceMotion();
  const items = notebookLines(turns, partialTranscript, transcriptVisible ? 'all' : 'newest');
  const latest = transcriptTail(turns);
  const lastTutorId = latest.tutor?.id;
  const focusMessageId = latestSentMessageId(turns);
  const reducedRef = useRef(reduced);
  const dismissRef = useRef(onDismissKeyboard);
  reducedRef.current = reduced;
  dismissRef.current = onDismissKeyboard;
  const [scroll] = useState(() => createTranscriptScrollController({
    scrollTo: (options) => ref.current?.scrollTo(options),
    scrollToEnd: (options) => ref.current?.scrollToEnd(options),
    showNewLines: setNewLines,
    reduced: () => !!reducedRef.current,
    dismissKeyboard: () => dismissRef.current?.(),
  }));
  const tailId = items[items.length - 1]?.id;
  useLayoutEffect(() => { scroll.receivedTurn(tailId); }, [scroll, tailId]);
  useLayoutEffect(() => {
    if (!focusActive) { scroll.cancelFocus(); return; }
    scroll.focus(focusMessageId, focusRevision);
  }, [scroll, focusRevision, focusActive]);
  const announcedTutor = useRef<string | null>(null);
  useEffect(() => {
    if (latest.tutor === null || announcedTutor.current === latest.tutor.id) return;
    announcedTutor.current = latest.tutor.id;
    if (announceReply && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(replyAnnouncement(latest.tutor, tutorName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastTutorId, announceReply, tutorName]);
  return (
    <>
      <ScrollView
        ref={ref}
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        onScroll={scroll.onScroll}
        onScrollBeginDrag={scroll.onScrollBeginDrag}
        scrollEventThrottle={32}
        onLayout={scroll.onLayout}
        onContentSizeChange={scroll.onContentSizeChange}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
        {...(Platform.OS === 'web' ? { onWheel: scroll.onWebScrollIntent } : {})}
        onTouchMove={Platform.OS === 'web' ? scroll.onWebScrollIntent : undefined}
        accessibilityLabel="Your conversation so far"
        onTouchEnd={() => { scroll.cancelFocus(); onDismissKeyboard(); }}
      >
        {items.map((item) => (
          <View key={item.id} onLayout={({ nativeEvent: { layout } }) => scroll.onBubbleLayout(item.id, { y: layout.y, height: layout.height })}>
            <BubbleIn who={item.kind === 'learner' ? 'learner' : 'tutor'} play={!present.has(item.id) && !item.partial}>
              <NotebookLine item={item} tutorName={tutorName} tutorSpeaking={tutorSpeaking} announce={announceReply}
                latestCorrection={item.id === latest.correctionId}
                onReplay={item.kind === 'tutor' && item.id === lastTutorId ? onReplayTutor : undefined} />
            </BubbleIn>
          </View>
        ))}
      </ScrollView>
      {children}
    </>
  );
}

function makeStyles(t: B) {
  return StyleSheet.create({
    // The viewport starts under the sheet's 22pt top inset, so no line is ever
    // drawn inside the rounded band; lines scrolled past it are clipped here.
    scroll: { flexGrow: 0, flexShrink: 1, minHeight: 0, overflow: 'hidden' },
    content: { flexGrow: 1, justifyContent: 'flex-end', gap: 14, paddingBottom: 10, paddingHorizontal: 20 },
    narration: { textAlign: 'center', paddingHorizontal: 16 },
    newest: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    newestWords: { flexShrink: 1, flexGrow: 1, gap: 4 },
    hear: { width: HIT, height: HIT, borderRadius: HIT / 2, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' },
    hearSounding: { backgroundColor: t.lavender },
    learner: { alignItems: 'flex-end', gap: 8 },
    learnerText: { textAlign: 'right' },
    mark: { borderRadius: 6, paddingVertical: 1, paddingHorizontal: 6, maxWidth: 300 },
    fixRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: 310 },
    fix: { flexShrink: 1, backgroundColor: t.lavender, borderRadius: 16, borderBottomRightRadius: 5, paddingVertical: 8, paddingHorizontal: 12, gap: 2 },
    why: { minHeight: HIT, minWidth: HIT, justifyContent: 'center', alignSelf: 'flex-start' },
    underline: { textDecorationLine: 'underline' },
    toast: { width: 34, flexShrink: 0 },
  });
}
