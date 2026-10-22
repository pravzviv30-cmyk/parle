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
 * "Report this reply", for the closed beta: two sheets, one for each place.
 *
 * In the live room the flag never leaves the app. Opening Mail mid session
 * drops the room: on web expo-linking sets `window.location` to the `mailto:`
 * URL and LiveKit disconnects on pagehide, and on iOS the app has no
 * background-audio mode, so a long stay in Mail drops it too. So the room's
 * sheet (`RoomReportSheet`, the room's own cream `HelpSheet`) only marks a
 * report as pending, and the end card opens `ReportSheet` by itself.
 *
 * On the end cards the screen under it is paper, not the brand room, so
 * `ReportSheet` is the app's modal `Sheet`, which brings its own scrim and
 * follows the theme in light and dark. "Write to us" hands the learner to
 * their own mail app with a reference subject and nothing else
 * (`settings/reportMail.ts`, `settings/links.ts`). A phone that will not open
 * mail keeps the sheet open and says so, with the address in words, so nobody
 * is stranded on a button that did nothing.
 *
 * Both are mounted only while open, and draw nothing with no address to write to.
 */
export function ReportSheet({ tutorName, sessionId, onClose }: {
  tutorName: string; sessionId: string | null | undefined; onClose: () => void;
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
    <Text style={[bType.line16, { color: t.text }]}>{REPORT_COPY.body(tutorName)}</Text>
    <Text style={[bType.note, { color: t.muted }]}>{REPORT_COPY.reply}</Text>
    <Text style={[bType.note, { color: t.muted }]}>{REPORT_COPY.safety}</Text>
    {failed ? <Text accessibilityLiveRegion="polite" selectable style={[bType.line16, { color: t.text }]}>{REPORT_COPY.failed(address)}</Text> : null}
  </View>;
  const actions = <View style={{ gap: 10 }}>
    <SheetPrimary label={REPORT_COPY.write} icon={null} disabled={sending} onPress={write} />
    <SheetSecondary label={REPORT_COPY.notNow} onPress={onClose} />
  </View>;
  return <Sheet visible title={REPORT_COPY.title} onClose={onClose} surface={t.ground} ink={t.text} footer={actions}>{words}</Sheet>;
}

/**
 * The live room's sheet: saves a report for the end card, or cancels a saved one.
 * Never opens Mail (see above); `reportControl.test.ts` holds it to that.
 */
export function RoomReportSheet({ tutorName, pending, onPending, onClose }: {
  tutorName: string; pending: boolean; onPending: (pending: boolean) => void; onClose: () => void;
}) {
  const t = useB();
  if (reportAddress() === null) return null;
  return <HelpSheet title={REPORT_COPY.title} closeLabel={REPORT_COPY.close} onClose={onClose}>
    <View style={{ gap: 10 }}>
      <Text style={[bType.line16, { color: t.text }]}>{REPORT_COPY.roomBody(tutorName)}</Text>
      <Text style={[bType.note, { color: t.muted }]}>{REPORT_COPY.reply}</Text>
      <Text style={[bType.note, { color: t.muted }]}>{REPORT_COPY.safety}</Text>
    </View>
    <View style={{ gap: 10 }}>
      <SheetPrimary label={pending ? REPORT_COPY.cancel : REPORT_COPY.later} icon={null} onPress={() => { onPending(!pending); onClose(); }} />
      <SheetSecondary label={REPORT_COPY.notNow} onPress={onClose} />
    </View>
  </HelpSheet>;
}
