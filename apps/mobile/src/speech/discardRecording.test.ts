/**
 * F115: a spoken attempt does not outlive the attempt.
 *
 * Two screens record through expo-audio and hand the uri up to be scored, and
 * until this landed nothing ever removed the file. The consequence was the part
 * that mattered: clearing a learner's data emptied the twelve AsyncStorage
 * namespaces and deleting the account cascaded the server rows, and a learner
 * who did both still had their own voice sitting in the app's cache.
 *
 * What is provable here and what is not, said plainly. The policy below is
 * real behaviour under test: the ordering, the exit paths, and what a failed
 * discard is allowed to cost. The unlink itself is a platform call, injected as
 * `remove`, and lives in removeRecording.native.ts where no test on this
 * machine can run it. That half is a device check, not a claim this file makes.
 *
 * The last test is a source read rather than a run, for the usual reason there
 * is no renderer in this suite (docs/TESTING.md). It is narrow on purpose: it
 * only asks that neither recording screen has grown a second way to score a
 * take, because a scoring call that does not go through consumeRecording is
 * exactly the shape the bug had.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import { RECORDING_NOT_DISCARDED, consumeRecording, discardRecording } from './discardRecording.ts';

/** A cache directory with one rule: what is written stays until it is removed. */
class Cache {
  readonly files = new Set<string>();

  /** The shape expo-audio actually writes: the app cache, an m4a, a uuid. */
  write(name: string): string {
    const uri = `file:///var/mobile/Containers/Data/Application/parle/Library/Caches/ExpoAudio/${name}.m4a`;
    this.files.add(uri);
    return uri;
  }

  has(uri: string): boolean {
    return this.files.has(uri);
  }

  readonly remove = (uri: string): void => {
    this.files.delete(uri);
  };
}

describe('an attempt recording does not outlive the attempt — F115', () => {
  test('a recorded attempt is deleted once it has been scored', async () => {
    const cache = new Cache();
    const take = cache.write('recording-scored');
    let readableWhileScoring = false;

    const score = await consumeRecording(
      take,
      async (uri) => {
        // The upload reads the bytes from disk at this point. A discard that
        // ran before now would turn a scored attempt into an unscored one,
        // silently, and only for learners on a slow connection.
        readableWhileScoring = cache.has(uri);
        return { observations: ['r'] };
      },
      { remove: cache.remove },
    );

    assert.deepEqual(score, { observations: ['r'] }, 'the scorer did not get the recording');
    assert.equal(readableWhileScoring, true, 'the recording was removed before the scorer had read it');
    assert.equal(cache.has(take), false, 'the recording is still in the cache after it was scored');
  });

  test('a recording nothing scored is deleted just the same', async () => {
    const cache = new Cache();

    // Assessment needs a vendor key the default install does not have, so this
    // is the ordinary case rather than an edge: scoreRecordedAttempt answers
    // null, nothing ever looked at the take, and the take is still on disk.
    const unscored = cache.write('recording-scoring-off');
    assert.equal(await consumeRecording(unscored, async () => null, { remove: cache.remove }), null);
    assert.equal(cache.has(unscored), false, 'a recording made while scoring was off stayed in the cache');

    // An upload that threw. This is the path that matters most, because a
    // learner whose attempts keep failing is the one about to delete the app.
    const thrown = cache.write('recording-upload-threw');
    await assert.rejects(
      consumeRecording(
        thrown,
        async () => {
          throw new Error('the network went away');
        },
        { remove: cache.remove },
      ),
      /the network went away/,
      'the scoring failure was swallowed instead of being reported',
    );
    assert.equal(cache.has(thrown), false, 'a recording whose upload threw stayed in the cache');

    // The take the recorder lost: stop() threw, but the file it opened is
    // there, and the drill grades the attempt without scoring it.
    const lost = cache.write('recording-stop-threw');
    discardRecording(lost, { remove: cache.remove });
    assert.equal(cache.has(lost), false, 'a take the recorder lost stayed in the cache');

    // And the take that arrived after its beat had passed, which is what the
    // guards at the top of DrillScreen's spoke() throw away.
    const late = cache.write('recording-too-late');
    discardRecording(late, { remove: cache.remove });
    assert.equal(cache.has(late), false, 'a take that arrived too late to grade stayed in the cache');

    assert.deepEqual([...cache.files], [], 'something was left in the cache');
  });

  test('a discard that fails costs the learner nothing, and does not pass in silence', async () => {
    const alarms: string[] = [];
    const refuse = (): void => {
      throw new Error('the volume is read only');
    };
    const hooks = { remove: refuse, alarm: (line: string) => alarms.push(line) };

    // The answer is worth more than the cleanup, so the score survives.
    const score = await consumeRecording('file:///cache/ExpoAudio/recording-1.m4a', async () => ({ ok: true }), hooks);
    assert.deepEqual(score, { ok: true }, 'a cleanup error took the learner attempt down with it');

    // Swallowed, not hidden. Speech that should have gone is still there and
    // somebody has to be able to grep for that.
    assert.doesNotThrow(() => discardRecording('file:///cache/ExpoAudio/recording-2.m4a', hooks));
    assert.deepEqual(alarms, [RECORDING_NOT_DISCARDED, RECORDING_NOT_DISCARDED]);
    assert.match(RECORDING_NOT_DISCARDED, /^\[parle\] [A-Z_]+$/, 'the alarm left the house shape');
    assert.doesNotMatch(RECORDING_NOT_DISCARDED, /file:|\/|Caches/, 'the alarm carries a device path');
  });

  test('nothing is invented to delete when the recorder lost the take entirely', async () => {
    const removed: (string | null)[] = [];
    const remove = (uri: string): void => {
      removed.push(uri);
    };

    let scored = false;
    const score = await consumeRecording(
      null,
      async () => {
        scored = true;
        return { observations: [] };
      },
      { remove },
    );

    assert.equal(score, null, 'a take with no uri was scored anyway');
    assert.equal(scored, false, 'the scorer was handed a recording that does not exist');
    discardRecording(null, { remove });
    discardRecording('', { remove });
    assert.deepEqual(removed, [], 'the remover was called with nothing to remove');
  });

  test('neither recording screen scores a take without handing it back to be discarded', () => {
    // Lexical, and narrow because of it. It cannot see that the delete works;
    // it sees that no second scoring path has appeared beside the one that
    // cleans up, which is the shape F115 was.
    const src = join(import.meta.dirname, '..');
    const screens = ['DrillScreen.tsx', join('soundcheck', 'SoundCheckScreen.tsx')];
    const count = (body: string, needle: string): number => body.split(needle).length - 1;

    for (const screen of screens) {
      const body = readFileSync(join(src, screen), 'utf8');
      const scoring = count(body, 'scoreRecordedAttempt(');
      assert.ok(scoring > 0, `${screen} no longer scores anything; this test is reading the wrong file`);
      assert.equal(
        count(body, 'consumeRecording('),
        scoring,
        `${screen} scores a recording somewhere that never discards it`,
      );
      assert.ok(count(body, 'discardRecording(') > 0, `${screen} has no path that discards an unscored take`);
    }
  });
});
