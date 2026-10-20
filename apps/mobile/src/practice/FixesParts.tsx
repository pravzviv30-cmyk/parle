/**
 * The parts Your fixes is drawn from, to the B-Fixes artboard (2026-10-21
 * UI-008), in light and dark.
 *
 * Pure presentation: words, routes and locks arrive as props from
 * `practice/fixesView.ts` or the screen, and every colour is a `useB()` token.
 * Attempt before reveal is the screen's and the view's rule; these parts
 * cannot break it, because the try-first card takes no French at all.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LOCK_BADGE_LABEL, LockBadge, Press, RoundButton } from '../components.tsx';
import { HearButton, OneWaveSpeaker, TickGlyph } from '../explore/ExploreParts.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { BButton, BMic } from '../today/TodayParts.tsx';
import { HIT, bType, frenchText } from '../theme.ts';
import type { PhraseTone } from './fixesView.ts';

/** Back, the 26/800 title with the trial pill when locked, and the conversation line. */
export function FixesHeader({ title, subtitle, locked, onBack }: { title: string; subtitle: string | null; locked: boolean; onBack: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.header}>
      <RoundButton kind="back" onPress={onBack} accessibilityLabel="Back" />
      <View style={s.grow}>
        <View style={s.titleRow}>
          <Text accessibilityRole="header" style={[bType.title26, { color: t.text }]}>{title}</Text>
          {locked && <LockBadge />}
        </View>
        {subtitle !== null ? <Text style={[bType.meta, { color: t.muted }]}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

/** This conversation / All conversations: the white segmented control, the chosen side brand with its tick. */
export function ScopeToggle<K extends string>({ scopes, active, onChange }: { scopes: readonly { key: K; label: string }[]; active: K; onChange: (key: K) => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View accessibilityRole="tablist" accessibilityLabel="Which fixes" style={s.segmented}>
      {scopes.map((scope) => {
        const on = scope.key === active;
        return (
          <Press key={scope.key} haptic="selection" accessibilityRole="tab" accessibilityLabel={scope.label} accessibilityState={{ selected: on }} onPress={() => onChange(scope.key)} frame={s.fill} style={[s.segment, on && { backgroundColor: t.brand }]}>
            {on ? <TickGlyph size={14} color={t.onBrand} /> : null}
            <Text style={[on ? bType.bold15 : bType.semi15, { color: on ? t.onBrand : t.text }]}>{scope.label}</Text>
          </Press>
        );
      })}
    </View>
  );
}

/** Comes up often, the Fixes form: the butter card and its ink "Practise this" when a drill exists. */
export function FixesPatternCard({ eyebrow, title, hint, practise, locked, onPractise }: { eyebrow: string; title: string; hint: string; practise: string; locked: boolean; onPractise: (() => void) | null }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.pattern}>
      <View style={s.grow2}>
        <Text style={[bType.bold12, { color: t.text }]}>{eyebrow}</Text>
        <Text style={[bType.title17, { color: t.text }]}>{title}</Text>
        <Text style={[bType.note, { color: t.secondary }]}>{hint}</Text>
      </View>
      {onPractise !== null ? <BButton hug label={practise} accessibilityLabel={`${practise}, ${title}${locked ? `, ${LOCK_BADGE_LABEL}` : ''}`} height={40} ground={t.primary} ink={t.onPrimary} text={bType.bold14} onPress={onPractise} /> : null}
    </View>
  );
}

/**
 * Fix n, try it first: the English to say, the note that the answer waits,
 * then Say it and Type it, or the typing field the screen passes in.
 */
export function AttemptCard({ label, prompt, english, note, say, type, typing }: {
  label: string;
  prompt: string;
  english: string;
  note: string;
  say: { label: string; onPress: () => void } | null;
  type: { label: string; onPress: () => void };
  /** The field and its Compare, while the learner types. */
  typing: ReactNode | null;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.attempt}>
      <Text style={[bType.bold12, { color: t.link }]}>{label}</Text>
      <View style={s.gap2}>
        <Text style={[bType.note, { color: t.muted }]}>{prompt}</Text>
        <Text accessibilityRole="header" style={[bType.bold20, { color: t.text }]}>{english}</Text>
      </View>
      <View style={s.note}><Text style={[bType.note, { color: t.muted }]}>{note}</Text></View>
      {typing ?? (
        <View style={s.pair}>
          {say !== null ? (
            <View style={s.fill}><BButton label={say.label} height={48} ground={t.primary} ink={t.onPrimary} text={bType.bold15} icon={<BMic size={16} color={t.onPrimary} />} onPress={say.onPress} /></View>
          ) : null}
          <View style={s.fill}><BButton label={type.label} height={48} ground={t.quiet} ink={t.text} text={bType.bold15} onPress={type.onPress} /></View>
        </View>
      )}
    </View>
  );
}

/** Fix n, after your try: what was said, the mint better way with its speaker, why, and once more. */
export function ComparedCard({ label, wrote, said, quote, natural, better, english, hear, why, again }: {
  label: string;
  wrote: { label: string; text: string } | null;
  said: string;
  quote: string;
  natural: string;
  better: string;
  english: string;
  hear: { label: string; playing: boolean; onPress: () => void };
  why: { label: string; text: string } | null;
  again: { label: string; onPress: () => void } | null;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.compared}>
      <Text style={[bType.bold12, { color: t.mintWords }]}>{label}</Text>
      {wrote !== null ? (
        <View style={s.gap4}>
          <Text style={[bType.note, { color: t.muted }]}>{wrote.label}</Text>
          <Text {...frenchText} style={[bType.line16, { color: t.text }]}>{wrote.text}</Text>
        </View>
      ) : null}
      <View style={s.gap4}>
        <Text style={[bType.note, { color: t.muted }]}>{said}</Text>
        <Text {...frenchText} style={[bType.line16, { color: t.muted }]}>{quote}</Text>
      </View>
      <View style={s.better}>
        <View style={s.grow2}>
          <Text style={[bType.bold12, { color: t.mintWords }]}>{natural}</Text>
          <Text {...frenchText} style={[bType.title17, { color: t.text }]}>{better}</Text>
          <Text style={[bType.note, { color: t.secondary }]}>{english}</Text>
        </View>
        <Press haptic="light" accessibilityLabel={hear.playing ? 'Stop' : hear.label} accessibilityState={{ busy: hear.playing }} onPress={hear.onPress} style={s.speaker}>
          <OneWaveSpeaker size={18} color={t.text} />
        </Press>
      </View>
      {why !== null ? <Text style={[bType.meta, { color: t.text }]}><Text style={bType.bold14}>{why.label}</Text> {why.text}</Text> : null}
      {again !== null ? (
        <Press haptic="light" accessibilityRole="link" accessibilityLabel={again.label} onPress={again.onPress} style={s.link}>
          <Text style={[bType.bold14, { color: t.link }]}>{again.label}</Text>
        </Press>
      ) : null}
    </View>
  );
}

/** Fix n, collapsed: its English and a lavender "Try it". */
export function WaitingRow({ label, english, tryIt, onTry }: { label: string; english: string; tryIt: string; onTry: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.waiting}>
      <View style={s.grow2}>
        <Text style={[bType.bold12, { color: t.muted }]}>{label}</Text>
        <Text style={[bType.bold16, { color: t.text }]}>{english}</Text>
      </View>
      <BButton hug label={tryIt} accessibilityLabel={`${tryIt}, ${english}`} height={40} ground={t.lavender} ink={t.text} text={bType.bold14} onPress={onTry} />
    </View>
  );
}

/** Phrases from this conversation: the white list, each phrase over its standing, and a hear button. */
export function PhraseList({ title, phrases, hearLabel, playing, onHear }: {
  title: string;
  phrases: readonly { fr: string; en: string; status: string; tone: PhraseTone }[];
  hearLabel: string;
  playing: string | null;
  onHear: (fr: string) => void;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const tone = (kind: PhraseTone) => (kind === 'used' ? { color: t.mintWords, ...bType.semi13 } : kind === 'recalled' ? { color: t.link, ...bType.semi13 } : { color: t.muted, ...bType.note });
  return (
    <View style={s.phrases}>
      <Text accessibilityRole="header" style={[bType.section19, { color: t.text }]}>{title}</Text>
      <View style={s.list}>
        {phrases.map((phrase, i) => (
          <View key={phrase.fr} style={[s.phrase, i < phrases.length - 1 && s.divider]}>
            <View style={s.grow2}>
              <Text {...frenchText} style={[bType.bold15, { color: t.text }]}>{phrase.fr}</Text>
              <Text style={tone(phrase.tone)}>{phrase.status}</Text>
            </View>
            <HearButton label={playing === phrase.fr ? 'Stop' : `${hearLabel}, ${phrase.en}`} onPress={() => onHear(phrase.fr)} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** A white notice card: a calm head, a line, and a way on. */
export function FixesNotice({ title, body, action, disabled = false, onPress }: { title: string; body: string | null; action: string; disabled?: boolean; onPress: () => void }) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.notice}>
      <Text accessibilityRole="header" style={[bType.bold17, { color: t.text }]}>{title}</Text>
      {body !== null ? <Text style={[bType.meta, { color: t.secondary }]}>{body}</Text> : null}
      <BButton hug label={action} height={44} ground={t.quiet} ink={t.text} text={bType.bold15} disabled={disabled} onPress={onPress} />
    </View>
  );
}

const makeStyles = (t: B) =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    grow2: { flex: 1, minWidth: 0, gap: 2 },
    fill: { flex: 1 },
    gap2: { gap: 2 },
    gap4: { gap: 4 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 },
    segmented: { backgroundColor: t.card, borderRadius: 24, padding: 4, flexDirection: 'row', gap: 4 },
    segment: { minHeight: HIT, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
    pattern: { backgroundColor: t.butter, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    attempt: { backgroundColor: t.card, borderRadius: 24, padding: 16, gap: 12, borderWidth: 2, borderColor: t.brand },
    note: { backgroundColor: t.inset, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
    pair: { flexDirection: 'row', gap: 8 },
    compared: { backgroundColor: t.card, borderRadius: 24, padding: 16, gap: 10 },
    better: { backgroundColor: t.mintWash, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
    speaker: { width: HIT, height: HIT, borderRadius: HIT / 2, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    link: { minHeight: HIT, justifyContent: 'center', alignSelf: 'flex-start' },
    waiting: { backgroundColor: t.card, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    phrases: { gap: 10 },
    list: { backgroundColor: t.card, borderRadius: 22, paddingVertical: 4, paddingHorizontal: 16 },
    phrase: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: HIT },
    divider: { borderBottomWidth: 1, borderBottomColor: t.line },
    notice: { backgroundColor: t.card, borderRadius: 24, padding: 16, gap: 8 },
  });
