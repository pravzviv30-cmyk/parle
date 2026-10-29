import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const convo=readFileSync(new URL('../ConvoScreen.tsx',import.meta.url),'utf8');
const transcript=readFileSync(new URL('./Transcript.tsx',import.meta.url),'utf8');

test('conversation opening and recap timeout use committed state without resetting the deadline',()=>{
 assert.match(convo,/useEffect\(\(\) => \{\n    if \(roomOpen && openedAtRef\.current === null\) openedAtRef\.current = Date\.now\(\);\n  \}, \[roomOpen\]\)/);
 assert.match(convo,/useLayoutEffect\(\(\) => \{ recapBailLeave\.current = leaveWaiting \? leaveTimedOut : leaveNow; \}\);/);
 assert.match(convo,/setTimeout\(\(\) => recapBailLeave\.current\(\), leaveWaiting \? LEAVE_RECAP_WAIT_MS : RECAP_WAIT_MS\)/);
 assert.match(convo,/\}, \[finishing, leaveWaiting, live\.recap\]\)/);
 assert.equal((convo.match(/tutorNameOf\(profile\)/g)??[]).length,1);
 const firstCode=convo.indexOf('function practiceBatch(');
 assert.ok(!/\nimport /.test(convo.slice(firstCode)));
});

test('the conversation announces only its newest typed tutor reply',()=>{
 assert.doesNotMatch(transcript,/\[\.\.\.turns\]\.reverse\(\)/);
 assert.match(transcript,/AccessibilityInfo\.announceForAccessibility\(replyAnnouncement\(latest\.tutor, tutorName\)\)/);
 assert.match(transcript,/announcedTutor\.current === latest\.tutor\.id/);
 assert.match(transcript,/Platform\.OS === 'ios'/);
 assert.match(transcript,/accessibilityLiveRegion=\{announceReply && isLastTutorLine \? 'polite' : 'none'\}/);
 const room=readFileSync(new URL('../live/C2LiveRoom.tsx',import.meta.url),'utf8');
 assert.match(room,/announceReply=\{typing\}/);
 assert.equal((convo.match(/<C2LiveRoom\b/g)??[]).length,2);
});
