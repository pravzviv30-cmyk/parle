/**
 * The hero card bodies Today draws itself (UI-015), props in and nothing out,
 * so HomeTab and the dev preview (`dev/TodayPreview.tsx`) draw the same part:
 * the fix, the failed read, and the loading sand blocks. The screen owns the
 * reads, the lock seam and the navigation; these only draw what they are
 * handed and call back.
 */

import { StyleSheet, Text, View } from 'react-native';

import { IconAction, PillButton, Skeleton } from '../components.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { BMic, OutlineLock } from '../today/TodayParts.tsx';
import { HIT, bType, corner, decorative, radius, space, type } from '../theme.ts';
import { TODAY_COPY, type OneFix } from './todayView.ts';
import { HERO_SAND, TodayHeroCard } from './TodayHeroCard.tsx';

/**
 * One fix to try (F996), free on every plan (founder, 2026-11-18): the English line as the header
 * that leads, the ask under it, what shows after the try on the inset panel,
 * and the lipped primary. No label over it.
 */
export function FixHero({ fix, onTry }: { fix: Pick<OneFix, 'english' | 'after'>; onTry: () => void }) {
  const t = useB();
  const st = useThemedStyles(makeStyles);
  return (
    <>
      <Text accessibilityRole="header" style={[bType.bold20, { color: t.text }]}>{fix.english}</Text>
      <Text style={[bType.note, { color: t.muted }]}>{TODAY_COPY.fixAsk}</Text>
      {/* What shows after the try, on the inset panel with the outline lock. */}
      <View style={st.after}>
        <View {...decorative}><OutlineLock size={18} color={t.muted} /></View>
        <Text style={[bType.note, st.grow, { color: t.muted }]}>{fix.after}</Text>
      </View>
      <PillButton
        label={TODAY_COPY.fixAction}
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
  return <Skeleton blocks={[HERO_SAND, { height: 168, radius: radius.card }, { height: 196, radius: radius.card }]} />;
}

const makeStyles = (t: B) =>
  StyleSheet.create({
    grow: { flex: 1, minWidth: 0 },
    // The after-the-try note: the inset panel with the outline lock.
    after: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: HIT, backgroundColor: t.inset, ...corner.field, paddingVertical: 10, paddingHorizontal: space(3) },
  });
