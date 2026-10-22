import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Sheet } from '../components.tsx';
import { bType } from '../theme.ts';
import { useB } from '../main/bTheme.tsx';
import { openMail } from '../settings/links.ts';
import { REPORT_COPY, reportAddress, reportSubject } from '../settings/reportMail.ts';
import { HelpSheet, SheetPrimary, SheetSecondary } from './LiveParts.tsx';

/**
 * "Report this reply", for the closed beta: one sheet, two places.
 *
 * In the live room (`place="room"`) it is the room's own cream sheet,
 * `HelpSheet`, drawn by C2LiveRoom in the same layer as Help, so the two never
 * open together. On the end cards (`place="card"`) the screen under it is paper,
 * not the brand room, so it is the app's modal `Sheet`, which brings its own
 * scrim and follows the theme in light and dark.
 *
 * "Write to us" hands the learner to their own mail app with a reference
 * subject and nothing else (`settings/reportMail.ts`, `settings/links.ts`). A
 * phone that will not open mail keeps the sheet open and says so, with the
 * address in words, so nobody is stranded on a button that did nothing.
 * Mounted only while open; renders nothing when there is no address to write to.
 */
export function ReportSheet({ tutorName, sessionId, onClose, place = 'room' }: {
  tutorName: string; sessionId: string | null | undefined; onClose: () => void; place?: 'room' | 'card';
}) {
  const t = useB();
  const address = reportAddress();
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  if (address === null) return null;
  const write = () => {
    if (sending) return;
    setSending(true);
    const subject = reportSubject({ sessionId, version: Constants.expoConfig?.version });
    void openMail(address, subject).then((outcome) => {
      if (!mounted.current) return;
      setSending(false);
      if (outcome === 'done') onClose(); else setFailed(true);
    });
  };
  const words = <View style={{ gap: 10 }}>
    <Text style={[bType.line16, { color: t.text }]}>{REPORT_COPY.body(tutorName, place === 'room' ? 'reply' : 'session')}</Text>
    <Text style={[bType.note, { color: t.muted }]}>{REPORT_COPY.reply}</Text>
    <Text style={[bType.note, { color: t.muted }]}>{REPORT_COPY.safety}</Text>
    {failed ? <Text accessibilityLiveRegion="polite" selectable style={[bType.line16, { color: t.text }]}>{REPORT_COPY.failed(address)}</Text> : null}
  </View>;
  const actions = <View style={{ gap: 10 }}>
    <SheetPrimary label={REPORT_COPY.write} icon={null} disabled={sending} onPress={write} />
    <SheetSecondary label={REPORT_COPY.notNow} onPress={onClose} />
  </View>;
  if (place === 'card') {
    return <Sheet visible title={REPORT_COPY.title} onClose={onClose} surface={t.ground} ink={t.text} footer={actions}>{words}</Sheet>;
  }
  return <HelpSheet title={REPORT_COPY.title} closeLabel={REPORT_COPY.close} onClose={onClose}>
    {words}
    {actions}
  </HelpSheet>;
}
