import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { TUTOR_VOICES, DEFAULT_TUTOR_VOICE, DAILY_WORDS, DAILY_PHRASES, wordTierFor, type TutorVoiceKey } from '@luvani/core';
import { dailyTutorVoice, tutorAudioFor, tutorAudioForFrench, type TutorAudioPack } from './tutorAudio.ts';
import { VOICED_WORD_IDS, VOICED_PHRASE_IDS } from './voicedSelection.ts';
import { DAILY_ITEMS, todayItems } from './catalogue.ts';

const voices = Object.keys(TUTOR_VOICES) as TutorVoiceKey[];
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

test('French recording reuse is exact, Unicode-normalized and restricted to the selected voice', () => {
  const items = [{ id: 'first', fr: 'Café.' }, { id: 'second', fr: 'Café.' }];
  const pack = { alexandre: { first: 11 }, emilie: { second: 22 } };
  assert.equal(tutorAudioForFrench(pack, items, ' Cafe\u0301. ', 'alexandre'), 11);
  assert.equal(tutorAudioForFrench(pack, items, 'Café.', 'emilie'), 22);
  for (const text of ['Cafe.', 'café.', 'Café', 'Café ?', '']) {
    assert.equal(tutorAudioForFrench(pack, items, text, 'alexandre'), undefined);
  }
  assert.equal(tutorAudioForFrench(pack, items, 'Café.', 'marie'), undefined);
});

test('daily audio follows every tutor choice and has no other-voice or generic fallback', () => {
  const pack = Object.fromEntries(voices.map((voice, i) => [voice, { word: i + 1 }])) as TutorAudioPack;
  voices.forEach((voice, i) => {
    assert.equal(dailyTutorVoice(voice), voice);
    assert.equal(tutorAudioFor(pack, 'word', voice), i + 1);
    assert.equal(tutorAudioFor(pack, 'missing', voice), undefined);
    assert.equal(tutorAudioFor({}, 'word', voice), undefined);
    assert.equal(tutorAudioFor(pack, 'constructor', voice), undefined);
  });
  for (const invalid of [null, undefined, '', 'toString', 'constructor', {}, 2]) assert.equal(dailyTutorVoice(invalid), DEFAULT_TUTOR_VOICE);
  assert.equal(tutorAudioFor({ alexandre: { word: 1 } }, 'word', 'sarah'), undefined);
});

test('Home rotates only the fully voiced tier-balanced subset without shrinking the text library', () => {
  assert.equal(DAILY_ITEMS.length, 2000);
  for (const [ids, pool] of [[VOICED_WORD_IDS, DAILY_WORDS], [VOICED_PHRASE_IDS, DAILY_PHRASES]] as const) {
    assert.equal(ids.length, 200);
    assert.equal(new Set(ids).size, 200);
    assert.ok(ids.every(id => pool.some(item => item.id === id)));
    assert.deepEqual([1, 2, 3].map(tier => pool.filter(item => ids.includes(item.id) && item.tier === tier).length), [67, 67, 66]);
  }
  for (const level of [0, 1, 2, 3, 4, 5, -1, NaN]) {
    const seenWords = new Set<string>(), seenPhrases = new Set<string>();
    for (let day = 0; day < 66; day++) {
      const now = new Date(2026, 8, 19 + day, 12).getTime();
      const picks = todayItems(level, now);
      assert.deepEqual(picks, todayItems(level, now + 1000));
      assert.ok(VOICED_WORD_IDS.includes(picks.word.id));
      assert.ok(VOICED_PHRASE_IDS.includes(picks.phrase.id));
      assert.equal(DAILY_WORDS.find(w => w.id === picks.word.id)?.tier, wordTierFor(level));
      assert.equal(DAILY_PHRASES.find(p => p.id === picks.phrase.id)?.tier, wordTierFor(level));
      seenWords.add(picks.word.id); seenPhrases.add(picks.phrase.id);
    }
    assert.equal(seenWords.size, 66); assert.equal(seenPhrases.size, 66);
  }
});

test('all 2400 bundled tutor recordings match the frozen text, voice, configuration and file hashes', () => {
  const manifest = JSON.parse(read('../../../../artifacts/daily-tutor-batch-1/manifest.json'));
  assert.equal(manifest.status, 'complete');
  assert.equal(manifest.config.model, 'eleven_flash_v2_5');
  assert.equal(manifest.config.gainDb, -4);
  assert.equal(manifest.config.language, 'fr');
  assert.equal(manifest.config.cap, 25000);
  assert.ok(manifest.accountedCredits <= 25000);
  assert.equal(manifest.settledBalance.batchDelta, manifest.accountedCredits);
  assert.equal(Object.keys(manifest.clips).length, 2400);
  const source = read('./tutorAudioManifest.ts');
  const groups = [...source.matchAll(/  (\w+): \{\n([\s\S]*?)\n  \},/g)];
  assert.deepEqual(groups.map(g => g[1]), voices);
  const ids = new Set([...VOICED_WORD_IDS, ...VOICED_PHRASE_IDS]);
  for (const group of groups) {
    const voice = group[1]!;
    const rows = [...group[2]!.matchAll(/"([^"]+)": require\('\.\.\/\.\.\/assets\/daily-tutors\/([^']+)'\)/g)];
    assert.equal(rows.length, 400);
    assert.deepEqual(new Set(rows.map(r => r[1])), ids);
    for (const row of rows) {
      const id = row[1]!, file = row[2]!;
      const clip = manifest.clips[`${voice}:${id}`];
      assert.equal(clip.status, 'complete');
      assert.equal(clip.voice, voice);
      assert.equal(clip.text, DAILY_ITEMS.find(item => item.id === id)?.fr);
      assert.equal(clip.file, file);
      assert.equal(file, `${voice}/${sha(JSON.stringify({ config: manifest.config, voice, text: clip.text })).slice(0, 24)}.m4a`);
      const bytes = readFileSync(new URL(`../../assets/daily-tutors/${file}`, import.meta.url));
      assert.equal(bytes.subarray(4, 8).toString(), 'ftyp');
      assert.equal(bytes.length, clip.bytes);
      assert.equal(sha(bytes), clip.sha256);
    }
  }
});

test('every final tutor clip decodes with the approved moderate level and no clipping', () => {
  const evidence = JSON.parse(read('../../../../artifacts/daily-tutor-batch-1/audio-verification.json'));
  const manifest = JSON.parse(read('../../../../artifacts/daily-tutor-batch-1/manifest.json'));
  assert.equal(evidence.fingerprint, manifest.fingerprint);
  assert.equal(evidence.count, 2400);
  assert.equal(evidence.clips.length, 2400);
  assert.ok(evidence.maxGainErrorDb <= 0.25);
  assert.ok(evidence.maxPeak < 1);
  const clips = Object.values(manifest.clips) as { file: string; sha256: string }[];
  assert.deepEqual(new Set(evidence.clips.map((c: { file: string }) => c.file)), new Set(clips.map(c => c.file)));
  for (const row of evidence.clips) assert.equal(row.sha256, clips.find(c => c.file === row.file)?.sha256);
});

test('daily playback is local, gated by coverage and cancelled when the selected tutor changes', () => {
  for (const name of ['DailyCard.tsx', 'DailyPracticeScreen.tsx']) {
    const source = read(name);
    assert.match(source, /dailyTutorVoice\(profile.tutorVoice\)/);
    assert.match(source, /tutorAudioFor\(TUTOR_DAILY_AUDIO,/);
    assert.doesNotMatch(source, /from '.\/audioManifest|fetch\(|Speech\.speak|speechSynthesis|https:\/\//);
    assert.doesNotMatch(source, /Hear example/);
    assert.match(source, /releaseDailyPlayback\(player\)/);
    assert.match(source, /ownsDailyPlayback\(player\)/);
  }
  const card = read('DailyCard.tsx'), practice = read('DailyPracticeScreen.tsx');
  assert.match(card, /asset != null && <GhostButton label="Hear"/);
  assert.match(card, /asset != null && <GhostButton label="Slow replay"/);
  assert.match(card, /\[focused, player, item.id, tutorVoice\]/);
  assert.match(practice, /modelAsset != null && <GhostButton label="Hear model"/);
  for (const state of ['Record my take', 'Hear my take', 'Try again', 'Finish practice']) {
    assert.ok(practice.includes(state), `local comparison lost its ${state} state`);
  }
  assert.match(practice, /your take is deleted when you leave/i);
  assert.match(practice, /\[tutorVoice, player, item\?\.id\]/);
  assert.match(practice, /playback !== playbackTicket.current/);
  assert.match(read('DailyLibraryScreen.tsx'), /VOICED_WORD_IDS.length/);
});
