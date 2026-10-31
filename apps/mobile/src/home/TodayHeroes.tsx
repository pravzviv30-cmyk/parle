/**
 * The hero card bodies Today draws itself (UI-015), props in and nothing out,
 * so HomeTab and the dev preview (`dev/TodayPreview.tsx`) draw the same part:
 * the fix, the failed read, and the loading sand blocks. The screen owns the
 * reads, the lock seam and the navigation; these only draw what they are
 * handed and call back.
 */

import { StyleSheet, Text, View } from 'react-native';

import { IconAction, LockBadge, PillButton, Skeleton } from '../components.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { BButton, BMic, OutlineLock } from '../today/TodayParts.tsx';
import { HIT, bType, decorative, radius, space, type } from '../theme.ts';
import { lockSaid } from '../access/featureAccess.ts';
import { TODAY_COPY, type OneFix } from './todayView.ts';
import { TodayHeroCard } from './TodayHeroCard.tsx';

/**
 * One fix to try: the eyebrow, the lock when locked, the ask, the English,
 * what shows after the try on the inset panel, and the 50pt primary. The
 * caller routes the press through the lock seam.
 */
export function FixHero({ fix, onTry }: { fix: Pick<OneFix, 'english' | 'after' | 'locked'>; onTry: () => void }) {
  const t = useB();
  const st = useThemedStyles(makeStyles);
  return (
    <>
      <Text accessibilityRole="header" style={[bType.eyebrow, { color: t.link }]}>{TODAY_COPY.fix}</Text>
      {fix.locked && <View style={st.lockRow}><LockBadge feature="fixes" said /></View>}
      <Text style={[bType.note, { color: t.muted }]}>{TODAY_COPY.fixAsk}</Text>
      <Text style={[bType.bold20, { color: t.text }]}>{fix.english}</Text>
      {/* What shows after the try, on the inset panel with the outline lock. */}
      <View style={st.after}>
        <View {...decorative}><OutlineLock size={18} color={t.muted} /></View>
        <Text style={[bType.note, st.grow, { color: t.muted }]}>{fix.after}</Text>
      </View>
      <BButton
        label={TODAY_COPY.fixAction}
        accessibilityLabel={fix.locked ? lockSaid(TODAY_COPY.fixAction, 'fixes', true) : undefined}
        height={50}
        ground={t.primary}
        ink={t.onPrimary}
        text={bType.bold17}
        icon={<BMic size={18} color={t.onPrimary} />}
        onPress={onTry}
      />
    </>
  );
}

/** The read failed: say so, offer today's phrase, and the same read again. */
export function TodayFailedHero({ onPhrase, onRetry }: { onPhrase: () => void; onRetry: () => void }) {
  const t = useB();
  return (
    <TodayHeroCard>
      <Text accessibilityRole="header" style={[type.bodyStrong, { color: t.text }]}>Your next scene could not be loaded.</Text>
      <Text style={[type.body, { color: t.muted }]}>We could not check your saved work. Today's phrase is available on this phone while we try again.</Text>
      <PillButton label="Practise today's phrase" onPress={onPhrase} />
      <IconAction layout="inline" icon="refresh" label="Try loading my scenes again" onPress={onRetry} />
    </TodayHeroCard>
  );
}

/** Storage has not answered: still sand blocks shaped like the page (the hero, the path's rows, the three). */
export function TodayLoadingHero() {
  return <Skeleton blocks={[{ height: 262, radius: radius.feature }, { height: 168, radius: radius.card }, { height: 196, radius: radius.card }]} />;
}

const makeStyles = (t: B) =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    lockRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(2) },
    // The after-the-try note: the inset panel with the outline lock.
    after: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: HIT, backgroundColor: t.inset, borderRadius: 14, paddingVertical: 10, paddingHorizontal: space(3) },
  });
