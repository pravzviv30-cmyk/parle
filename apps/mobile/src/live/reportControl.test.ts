/**
 * Where "Report this reply" is drawn, and where it is not.
 *
 * Read from source with comments stripped, as SummaryScreen.test.ts does: the
 * screens import React Native and cannot load under `node --test`. The rule is
 * that the report control lives in the live room and on the two end cards, and
 * never on the waiting room, an error, or the safety stop.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { REPORT_COPY } from '../settings/reportMail.ts';
import { roomMenuRows } from './liveRoomView.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}
const src = (relative: string) => stripComments(read(relative));

describe('the live room', () => {
  const room = src('./C2LiveRoom.tsx');

  test('draws the report control only when the owner passes report', () => {
    // UI-014: the report control is the room menu's "Report this reply" row,
    // and roomMenuRows adds it only when the room is reportable.
    assert.match(room, /const reportable = report !== undefined && reportAddress\(\) !== null;/);
    assert.match(room, /roomMenuRows\(\{[^}]*reportable, reportPending: report\?\.pending \}\)/);
    assert.deepEqual(roomMenuRows({ typing: false, transcriptVisible: true, reportable: false }).map((row) => row.kind), ['transcript']);
    assert.equal(roomMenuRows({ typing: false, transcriptVisible: true, reportable: true }).at(-1)?.kind, 'report');
  });

  test('opens the room report sheet in the sheet layer, never with Help', () => {
    assert.match(room, /\{reportOpen && reportable && report && !helpOpen \? <View style=\{\[st\.sheetLayer/);
    assert.match(room, /<RoomReportSheet tutorName=\{tutorName\} pending=\{report\.pending\} onPending=\{report\.onPending\}/);
    assert.doesNotMatch(room, /<ReportSheet /);
    assert.match(room, /row\.kind === 'report'\) \{ setMenuOpen\(false\); setHelpOpen\(false\); setReportOpen\(value => !value\)/);
    assert.match(room, /useEffect\(\(\) => \{ if \(helpOpen\) setReportOpen\(false\); \}, \[helpOpen\]\);/);
  });

  test('a saved report marks the menu disc and says so', () => {
    // UI-014: a saved report puts a sun dot on the menu disc, and the disc and
    // the row both say it in REPORT_COPY.pendingControl.
    assert.match(room, /accessibilityLabel=\{report\?\.pending \? `Room settings\. \$\{REPORT_COPY\.pendingControl\}` : 'Room settings'\}/);
    assert.match(room, /\{report\?\.pending \? <View \{\.\.\.decorative\} style=\{st\.reportPending\} \/> : null\}/);
    assert.equal(roomMenuRows({ typing: false, transcriptVisible: true, reportable: true, reportPending: true }).at(-1)?.label, REPORT_COPY.pendingControl);
    assert.equal(roomMenuRows({ typing: false, transcriptVisible: true, reportable: true, reportPending: false }).at(-1)?.label, REPORT_COPY.control);
  });

  test('the room never opens Mail', () => {
    assert.doesNotMatch(room, /openMail|expo-linking/);
  });

  test('the disc meets the 44pt floor', () => {
    assert.match(room, /menu: \{ width: 44, height: 44/);
    assert.match(src('./DockParts.tsx'), /row: \{ minHeight: 56/);
  });
});

describe('the owners pass report only to the live room', () => {
  for (const file of ['../ConvoScreen.tsx', '../LiveSessionScreen.tsx']) {
    const screen = src(file);
    test(`${file} passes report on every C2LiveRoom and nowhere else`, () => {
      const passes = screen.match(/report=\{\{ pending: reportPending, onPending: setReportPending \}\}/g) ?? [];
      const rooms = screen.match(/<C2LiveRoom /g) ?? [];
      assert.ok(rooms.length > 0);
      assert.equal(passes.length, rooms.length);
      for (const match of screen.matchAll(/report=\{\{ pending: reportPending, onPending: setReportPending \}\}/g)) {
        assert.equal(screen.slice(match.index - '<C2LiveRoom '.length, match.index), '<C2LiveRoom ');
      }
    });

    test(`${file} draws no report on the safety stop or the waiting room`, () => {
      assert.doesNotMatch(screen, /<SafetyStopView[^>]*report/);
      assert.doesNotMatch(screen, /<RoomWait[^>]*report/);
      assert.equal((screen.match(/<ReportSheet /g) ?? []).length, 1, 'the leave sheet is the only one this screen draws');
      assert.doesNotMatch(screen, /RoomReportSheet|openMail/);
    });

    test(`${file} closes the room, then shows ReportSheet, then exits, when a saved report has no end card`, () => {
      assert.match(screen, /const reportHeld = reportPending && !stopped;/);
      assert.match(screen, /const leaveToReport = \(\) => \{ const sessionId = live\.sessionId; (leaveTo|void live\.leave\(\)\.finally)\(\(\) => setLeftWithReport\(\{ sessionId \}\)\); \};/);
      assert.match(screen, /if \(leaving\) \{ (if \(!reportHeld\) leaveNow\(\); else leaveToReport\(\);|if \(reportHeld\) leaveToReport\(\); else if \(!leaveKeepingWork\(\)\) leaveNow\(\);) \}/);
      assert.match(screen, /if \(leftWithReport !== null\) \{[\s\S]*?<ReportSheet tutorName=\{tutorName\} sessionId=\{leftWithReport\.sessionId\} onClose=\{onExit\} \/>/);
      const stop = screen.indexOf("if (safety.kind === 'stop') {");
      assert.ok(stop > 0 && stop < screen.indexOf('if (leftWithReport !== null) {'), 'the leave sheet can be drawn over a safety stop');
    });
  }

  test('the safety stop surface has no report control', () => {
    const stop = src('../tutor/SafetyStopView.tsx');
    assert.doesNotMatch(stop, /ReportSheet|REPORT_COPY|openMail/);
  });
});

describe('the end cards', () => {
  test('RecapScreen offers the end link and the sheet for its session', () => {
    const recap = src('../RecapScreen.tsx');
    assert.match(recap, /\{REPORT_COPY\.endLink\}/);
    assert.match(recap, /<ReportSheet [^>]*sessionId=\{momentKey\}/);
  });

  test('SummaryScreen offers the end link after More and the sheet for its session', () => {
    const summary = src('../SummaryScreen.tsx');
    assert.ok(summary.indexOf('{REPORT_COPY.endLink}') > summary.indexOf("'Show less' : 'More'"));
    assert.match(summary, /<ReportSheet [^>]*sessionId=\{sessionId\}/);
  });

  test('a report saved in the room opens the sheet by itself on both end cards', () => {
    for (const file of ['../RecapScreen.tsx', '../SummaryScreen.tsx']) {
      assert.match(src(file), /const \[reporting, setReporting\] = useState\(openReport\);/, file);
    }
    assert.match(src('../ConvoScreen.tsx'), /openReport=\{reportPending\}/);
    const live = src('../LiveSessionScreen.tsx');
    const nav = src('../nav/RootNavigator.tsx');
    assert.match(live, /onReportPending\?\.\(reportPending\)/);
    assert.match(nav, /onReportPending=\{setSummaryReport\}/);
    assert.match(nav, /openReport=\{summaryReport\}/);
    const again = nav.slice(nav.indexOf('const again = useCallback('));
    assert.match(again.slice(0, again.indexOf('}, [')), /setSummaryReport\(false\);/);
  });

  test('a safety stop surfaces no saved report: the stop returns before either end card', () => {
    const convo = src('../ConvoScreen.tsx');
    const stop = convo.indexOf("if (safety.kind === 'stop') {");
    assert.ok(stop > 0 && stop < convo.indexOf('<RecapScreen'), 'the recap can be drawn over a stop');
    const live = src('../LiveSessionScreen.tsx');
    assert.match(live, /if \(live\.summary && !stopped && live\.settlement === null\) onFinish\(live\.summary\);/);
    const nav = src('../nav/RootNavigator.tsx');
    assert.ok(nav.indexOf('if (summary) {') < nav.indexOf('<SummaryScreen'), 'the summary is drawn without a summary');
  });

  test('the lesson threads its session id to the summary', () => {
    const live = src('../LiveSessionScreen.tsx');
    const nav = src('../nav/RootNavigator.tsx');
    assert.match(live, /onSessionId\?\.\(live\.sessionId\)/);
    assert.match(nav, /onSessionId=\{setSummarySession\}/);
    assert.match(nav, /sessionId=\{summarySession\}/);
  });
});

describe('the sheet', () => {
  const sheet = src('./ReportSheet.tsx');

  test('the room sheet never calls openMail', () => {
    const roomSheet = sheet.slice(sheet.indexOf('export function RoomReportSheet('));
    assert.ok(roomSheet.length > 0);
    assert.doesNotMatch(roomSheet, /openMail|reportSubject/);
    assert.match(roomSheet, /onPending\(!pending\); onClose\(\);/);
    assert.match(roomSheet, /pending \? REPORT_COPY\.cancel : REPORT_COPY\.later/);
  });

  test('goes through openMail with the reference subject, never Linking itself', () => {
    assert.match(sheet, /openMail\(address, subject\)/);
    assert.match(sheet, /reportSubject\(\{ sessionId, version: Constants\.expoConfig\?\.version \}\)/);
    assert.doesNotMatch(sheet, /expo-linking|Linking\./);
  });

  test('a failed open keeps the sheet and says so politely', () => {
    assert.match(sheet, /if \(outcome === 'done'\) onClose\(\); else setFailed\(true\);/);
    assert.match(sheet, /accessibilityLiveRegion="polite"[^>]*>\{REPORT_COPY\.failed\(address\)\}/);
  });
});

describe('the two report sheets carry their own titles', () => {
  test('the room says this reply; the card says the session', () => {
    assert.equal(REPORT_COPY.roomTitle, 'Report this reply');
    assert.equal(REPORT_COPY.title, 'Tell us what felt off');
    const sheet = read('./ReportSheet.tsx');
    assert.match(sheet, /<Sheet visible title=\{REPORT_COPY\.title\}/, 'the card sheet lost its session title');
    assert.match(sheet, /<HelpSheet title=\{REPORT_COPY\.roomTitle\}/, 'the room sheet lost "Report this reply"');
  });
});
