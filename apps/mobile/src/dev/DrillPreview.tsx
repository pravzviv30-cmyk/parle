/**
 * Every drill and practice state as a screen preview (drill-b T1), so the
 * same state can be shot before and after a restyle.
 *
 * A drill key composes what DrillScreen draws for that state, from the same
 * parts in the same frame: the kind view in the real DrillFrame, with
 * SittingBar in its header and the AnswerSheet in the reserved footer. The
 * sheet is core's own model read with fixture verdicts. Review and Sound Check mount their real screens
 * under a preview-only storage scope; a state that needs a tap is reached by
 * pressing the real control on the web. Nothing is graded or sent.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { HIT, bType, space, type } from '../theme.ts';
import { useB } from '../main/bTheme.tsx';
import { Card, IconAction, PillButton } from '../components.tsx';
import { Screen, ScrollScreen, ScreenHeader } from '../layout.tsx';
import type { DrillShell } from '../drill/DrillFrame.tsx';
import { AnswerSheet } from '../drill/AnswerSheet.tsx';
import { sheetFor, type SheetInput } from '../drill/answerSheet.ts';
import { comboGlows } from '../drill/combo.ts';
import { drillTitle } from '../drill/title.ts';
import { SittingBar } from '../drill/SittingBar.tsx';
import { DRILL_END } from '../drill/endCopy.ts';
import { BestSentenceView, AppropriateReplyView } from '../drill/kinds/choose.tsx';
import { FillBlankView, TapTranslateView } from '../drill/kinds/build.tsx';
import { ListenTypeView, TranslationView } from '../drill/kinds/write.tsx';
import { RepeatThisView } from '../drill/kinds/RepeatThisView.tsx';
import { OwnWordsView, type OwnWordsOutcome } from '../drill/kinds/OwnWordsView.tsx';
import { FocusDrillPlayer } from '../drill/FocusDrillPlayer.tsx';
import { FixLineSheet } from '../drill/FixLineSheet.tsx';
import { EndCard } from '../celebrate/EndCard.tsx';
import { REVIEW_END } from '../review/sittingEnd.ts';
import { ReviewScreen } from '../ReviewScreen.tsx';
import { addPhrases } from '../review/store.ts';
import { SoundCheckScreen } from '../soundcheck/SoundCheckScreen.tsx';
import { AttemptCard, ComparedCard, FixesHeader } from '../practice/FixesParts.tsx';
import { FIXES_TITLE, FIX_COPY } from '../practice/fixesView.ts';
import { PRACTICE_END } from '../practice/copy.ts';
import { practiceEndCard } from '../practice/saveState.ts';
import { setActiveUser } from '../storage/scope.ts';
import type { DrillExercise } from '@luvani/core';
import * as F from './drillFixtures.ts';

export const DRILL_PREVIEWS = [
  'drill-choose', 'drill-choose-right', 'drill-reply', 'drill-roll', 'drill-reply-miss',
  'drill-blank', 'drill-blank-landed', 'drill-blank-nearly', 'drill-build', 'drill-build-right',
  'drill-translate', 'drill-translate-hint', 'drill-listen', 'drill-listen-miss2', 'drill-into-en-right',
  'drill-say', 'drill-say-listening', 'drill-say-result',
  'drill-own', 'drill-own-works', 'drill-own-nearly', 'drill-own-oneway',
  'drill-review-front', 'drill-review-typing', 'drill-review-back', 'drill-review-said', 'drill-review-empty',
  'drill-sound', 'drill-soundcheck', 'drill-soundcheck-result',
  'drill-fixes', 'drill-fixes-compared', 'drill-fixline',
  'drill-end', 'drill-end-unsaved', 'drill-end-review',
] as const;
export type DrillPreviewKey = typeof DRILL_PREVIEWS[number];

const noop = () => {};

/**
 * A stand-in for the navigator, for parts that ask whether they are focused
 * or may open a route. Always focused; every navigation call does nothing.
 */
const PREVIEW_NAVIGATION = new Proxy({} as Record<string, unknown>, {
  get: (_target, key) => (key === 'isFocused' ? () => true : key === 'addListener' ? () => noop : key === 'getState' ? () => undefined : noop),
}) as never;

/**
 * DrillScreen's shell for the real `DrillFrame`: the close, the bar with its
 * fill and glow, and the reserved sheet footer. The kind view draws the frame.
 */
function shell(kind: DrillExercise['kind'], { fill = 0.4, combo = 1, sheet = null, note = null, footer = true }: {
  fill?: number;
  combo?: number;
  sheet?: SheetInput | null;
  note?: string | null;
  footer?: boolean;
} = {}): DrillShell {
  return {
    header: (
      <ScreenHeader
        leave={{ onPress: noop, label: 'Leave', accessibilityLabel: 'Leave the drills', close: true }}
        title={drillTitle(kind)}
        centre={<SittingBar fill={fill} glow={comboGlows(combo)} />}
      />
    ),
    footer: footer ? (
      <View style={{ minHeight: HIT + 8, justifyContent: 'flex-end' }}>
        {sheet !== null && <AnswerSheet sheet={sheetFor(sheet)} note={note} onContinue={noop} />}
      </View>
    ) : undefined,
  };
}

/** Presses the real controls named in `labels`, in order, on the web, each once it is drawn. */
function usePressOnWeb(labels: readonly string[]) {
  useEffect(() => {
    if (Platform.OS !== 'web' || labels.length === 0) return;
    let step = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      if (step >= labels.length) return;
      const target = document.querySelector<HTMLElement>(`[aria-label="${labels[step]!}"]`);
      if (target) {
        target.click();
        step += 1;
      }
      timer = setTimeout(tick, 250);
    };
    timer = setTimeout(tick, 400);
    return () => { if (timer !== null) clearTimeout(timer); };
  }, [labels]);
}

/** A real screen under its own preview storage scope, optionally seeded with a review deck first. */
function Scoped({ name, seed, children }: { name: string; seed: boolean; children: (scope: string) => ReactNode }) {
  // A fresh scope per open, so a seeded deck or a recorded check never carries over.
  const [scope] = useState(() => `screen-preview-${name}-${Date.now()}`);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setActiveUser(scope);
    void (seed ? addPhrases(F.REVIEW_PHRASES, { source: 'sample' }) : Promise.resolve()).catch(noop).then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [scope, seed]);
  return ready ? <>{children(scope)}</> : <Screen><View /></Screen>;
}

/**
 * The real control each state is one press behind. A fresh preview deck holds
 * only first meetings, which turn over with Show me; "I said it" and "Type it"
 * belong to a due retrieval, which a deck seeded now cannot hold, so the
 * typing and said keys press them only if a retrieval card is drawn.
 */
const REVIEW_STEPS: Partial<Record<DrillPreviewKey, readonly string[]>> = {
  'drill-review-typing': ['Type it'],
  'drill-review-back': ['Show me'],
  'drill-review-said': ['I said it'],
  'drill-soundcheck-result': ['I said it without assessment'],
};

const NO_STEPS: readonly string[] = [];

function Driven({ preview, children }: { preview: DrillPreviewKey; children: ReactNode }) {
  usePressOnWeb(REVIEW_STEPS[preview] ?? NO_STEPS);
  return <>{children}</>;
}

/** The Fixes page's attempt and compared cards, composed as FixesScreen composes them. */
function FixesPreview({ compared, sheet }: { compared: boolean; sheet: boolean }) {
  const [open, setOpen] = useState(sheet);
  return (
    <ScrollScreen bottom="inset" topGap={8}>
      <View style={{ gap: space(4.5) }}>
        <FixesHeader title={FIXES_TITLE} subtitle="Au café, Saturday" locked={false} onBack={noop} />
        {compared ? (
          <ComparedCard label={`Fix 1, ${FIX_COPY.triedLabel}`}
            wrote={{ label: FIX_COPY.youWrote, text: 'Je veux un café.' }}
            said="You said" quote={F.FIX_REPAIR.quote} natural={FIX_COPY.natural} better={F.FIX_REPAIR.better} english={F.FIX_REPAIR.betterEn}
            hear={{ label: 'Hear it', playing: false, onPress: noop }}
            why={{ label: FIX_COPY.why, text: F.FIX_REPAIR.why }}
            again={{ label: FIX_COPY.again, onPress: () => setOpen(true) }} />
        ) : (
          <AttemptCard label={`Fix 1, ${FIX_COPY.attemptLabel}`} prompt={FIX_COPY.sayThis} english={F.FIX_REPAIR.betterEn} note={FIX_COPY.afterTry}
            say={{ label: FIX_COPY.say, onPress: () => setOpen(true) }} type={{ label: FIX_COPY.type, onPress: noop }} typing={null} />
        )}
      </View>
      {open && <FixLineSheet repair={F.FIX_REPAIR} onClose={() => setOpen(false)} />}
    </ScrollScreen>
  );
}

function OwnWords({ outcome, typed = '' }: { outcome: OwnWordsOutcome | null; typed?: string }) {
  const [text, setText] = useState(typed);
  return (
    <OwnWordsView exercise={F.OWN_WORDS} typed={text} onChange={setText} onCheck={noop} onTake={noop}
      busy={false} outcome={outcome} onKeep={noop} keeping={false} kept={false} keepFailed={false} shell={shell('own-words', { footer: false })} />
  );
}

/** Text views keep their own field, so a key can open with words already typed. */
function Typed({ initial = '', children }: { initial?: string; children: (typed: string, onChange: (t: string) => void) => ReactNode }) {
  const [typed, setTyped] = useState(initial);
  return <>{children(typed, setTyped)}</>;
}

function Tapped({ initial, children }: { initial: number[]; children: (placed: number[], onPlaced: (n: number[]) => void) => ReactNode }) {
  const [placed, setPlaced] = useState(initial);
  return <>{children(placed, setPlaced)}</>;
}

/** The drill end as DrillScreen draws a settled finish. */
function DrillEnd() {
  const bt = useB();
  return (
    <ScrollScreen footer={<PillButton label="Done" onPress={noop} />}>
      <View style={{ gap: space(4) }}>
        <EndCard delta={F.END_DELTA} count={F.END_COUNT} />
        <Text style={[type.small, { color: bt.muted }]}>{DRILL_END.deck}</Text>
      </View>
    </ScrollScreen>
  );
}

/** A practice sitting whose save did not land, as DrillScreen draws it. */
function PracticeUnsaved() {
  const bt = useB();
  const card = practiceEndCard('not-saved', 'practised');
  return (
    <ScrollScreen footer={<PillButton label="Done" onPress={noop} />}>
      <View style={{ gap: space(4) }}>
        <Card>
          <Text style={[type.title, { color: bt.text }]}>{card.title}</Text>
          <Text style={[type.small, { color: bt.muted, marginTop: space(3) }]}>{card.body}</Text>
          {card.retry && (
            <View style={{ marginTop: space(3), alignItems: 'flex-start' }}>
              <IconAction layout="inline" icon="refresh" busy={false} label={PRACTICE_END.retry} disabled={false} onPress={noop} />
            </View>
          )}
        </Card>
      </View>
    </ScrollScreen>
  );
}

/** The review end as ReviewScreen draws a settled finish. */
function ReviewEnd() {
  const bt = useB();
  return (
    <ScrollScreen footer={<PillButton label="Done" onPress={noop} />}>
      <View style={{ gap: space(4) }}>
        <Text accessibilityRole="header" style={[bType.bold19, { color: bt.text }]}>{REVIEW_END.finished}</Text>
        <EndCard delta={F.REVIEW_END_DELTA} count={F.REVIEW_END_COUNT} />
      </View>
    </ScrollScreen>
  );
}

export function DrillPreview({ preview }: { preview: DrillPreviewKey }) {
  return <NavigationContext.Provider value={PREVIEW_NAVIGATION}>{body(preview)}</NavigationContext.Provider>;
}

function body(preview: DrillPreviewKey): ReactNode {
  const locked = (sheet: SheetInput | null) => sheet !== null;
  switch (preview) {
    case 'drill-choose':
    case 'drill-choose-right': {
      const sheet = preview === 'drill-choose-right' ? F.SHEETS.chooseRight : null;
      return <BestSentenceView exercise={F.BEST_SENTENCE} onAnswer={noop} locked={locked(sheet)} shell={shell('best-sentence', { sheet })} />;
    }
    case 'drill-reply':
    case 'drill-roll':
    case 'drill-reply-miss': {
      const sheet = preview === 'drill-roll' ? F.SHEETS.roll : preview === 'drill-reply-miss' ? F.SHEETS.replyMiss : null;
      return <AppropriateReplyView exercise={F.APPROPRIATE_REPLY} onAnswer={noop} locked={locked(sheet)}
        shell={shell('appropriate-reply', { combo: preview === 'drill-roll' ? 3 : 1, fill: preview === 'drill-roll' ? 0.6 : 0.4, sheet })} />;
    }
    case 'drill-blank':
    case 'drill-blank-landed': {
      const sheet = preview === 'drill-blank-landed' ? F.SHEETS.blankLanded : null;
      return <FillBlankView exercise={F.FILL_BLANK_CHOICE} typed="" onChange={noop} onAnswer={noop} locked={locked(sheet)} shell={shell('fill-blank', { sheet })} />;
    }
    case 'drill-blank-nearly':
      return <FillBlankView exercise={F.FILL_BLANK_TYPED} typed="combein" onChange={noop} onAnswer={noop} locked shell={shell('fill-blank', { sheet: F.SHEETS.blankNearly })} />;
    case 'drill-build':
    case 'drill-build-right': {
      const right = preview === 'drill-build-right';
      return <Tapped initial={right ? F.TAP_ALL : F.TAP_PLACED}>{(placed, onPlaced) =>
        <TapTranslateView exercise={F.TAP_TRANSLATE} assembled={placed} onAssembled={onPlaced} onAnswer={noop} locked={right}
          shell={shell('tap-translate', { sheet: right ? F.SHEETS.buildRight : null })} />}</Tapped>;
    }
    case 'drill-translate':
    case 'drill-translate-hint':
      return <Typed>{(typed, onChange) =>
        <TranslationView exercise={F.TRANSLATE_INTO_FR} typed={typed} onChange={onChange} onAnswer={noop} locked={false}
          help={{ shown: preview === 'drill-translate-hint', onShow: noop }} shell={shell('translate')} />}</Typed>;
    case 'drill-into-en-right':
      return <TranslationView exercise={F.TRANSLATE_INTO_EN} typed="The bill, please." onChange={noop} onAnswer={noop} locked
        shell={shell('translate', { sheet: F.SHEETS.intoEnRight })} />;
    case 'drill-listen':
      return <Typed>{(typed, onChange) =>
        <ListenTypeView exercise={F.LISTEN_TYPE} typed={typed} onChange={onChange} onAnswer={noop} locked={false} shell={shell('listen-type')} />}</Typed>;
    case 'drill-listen-miss2':
      return <ListenTypeView exercise={F.LISTEN_TYPE} typed="Je voudrai un cafait" onChange={noop} onAnswer={noop} locked
        shell={shell('listen-type', { sheet: F.SHEETS.listenMiss2 })} />;
    case 'drill-say':
    case 'drill-say-listening':
    case 'drill-say-result': {
      const result = preview === 'drill-say-result';
      return <RepeatThisView exercise={F.REPEAT_THIS} onAnswer={noop} onSpoke={noop} onNoMic={noop} locked={result}
        initialMic={preview === 'drill-say-listening' ? 'live' : 'armed'}
        shell={shell('repeat-this', { sheet: result ? F.SHEETS.sayResult : null, note: result ? F.SAY_NOTE : null })} />;
    }
    case 'drill-own': return <OwnWords outcome={null} />;
    case 'drill-own-works': return <OwnWords outcome={F.OWN_OUTCOMES.works} typed={F.OWN_OUTCOMES.works.attempt!} />;
    case 'drill-own-nearly': return <OwnWords outcome={F.OWN_OUTCOMES.nearly} typed={F.OWN_OUTCOMES.nearly.attempt!} />;
    case 'drill-own-oneway': return <OwnWords outcome={F.OWN_OUTCOMES.oneway} typed={F.OWN_OUTCOMES.oneway.attempt!} />;
    case 'drill-review-front':
    case 'drill-review-typing':
    case 'drill-review-back':
    case 'drill-review-said':
      return <Scoped name={preview} seed>{() => <Driven preview={preview}><ReviewScreen onDone={noop} /></Driven>}</Scoped>;
    case 'drill-review-empty':
      return <Scoped name={preview} seed={false}>{() => <ReviewScreen onDone={noop} />}</Scoped>;
    case 'drill-sound':
      return <FocusDrillPlayer drill={F.SOUND_DRILL} onDone={noop} />;
    case 'drill-soundcheck':
    case 'drill-soundcheck-result':
      return <Scoped name={preview} seed={false}>{(scope) => <Driven preview={preview}><SoundCheckScreen userId={scope} missionId={F.SOUND_CHECK_MISSION} onDone={noop} /></Driven>}</Scoped>;
    case 'drill-fixes': return <FixesPreview compared={false} sheet={false} />;
    case 'drill-fixes-compared': return <FixesPreview compared sheet={false} />;
    case 'drill-fixline': return <FixesPreview compared={false} sheet />;
    case 'drill-end': return <DrillEnd />;
    case 'drill-end-unsaved': return <PracticeUnsaved />;
    case 'drill-end-review': return <ReviewEnd />;
  }
}
