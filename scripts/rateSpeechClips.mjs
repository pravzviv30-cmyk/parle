/** Local, offline rating tool for the consented speech dataset. No network calls.
 * node scripts/rateSpeechClips.mjs <clipDir> --rater <pseudonym>   rate unrated clips
 * node scripts/rateSpeechClips.mjs <clipDir> --report              agreement and calibration report
 * Clips are personal data once they exist: keep the folder on an encrypted disk, never
 * email or upload it. See docs/changes/speech-dataset.md.
 * Last step: when rating is finished, delete the folder and tell the founder, so the
 * copy can be recorded as destroyed (docs/changes/speech-dataset.md).
 */
import { existsSync, readdirSync, readFileSync, appendFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline/promises';
import { agreementReport, calibrationReport, formatReport, parseManifest, parseRatings } from './speechRatings.mjs';

const USAGE = `Usage: node scripts/rateSpeechClips.mjs <clipDir> --rater <pseudonym>
       node scripts/rateSpeechClips.mjs <clipDir> --report
       node scripts/rateSpeechClips.mjs --help
Rater pseudonym: 2 to 32 characters of a-z, 0-9, _ or -. Works offline; makes no network calls.`;

function parseArgs(argv) {
  const out = { positional: [], rater: null, report: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--report') out.report = true;
    else if (arg === '--rater' && argv[i + 1] !== undefined) { out.rater = argv[i + 1]; i += 1; }
    else if (arg.startsWith('--')) throw new Error(`Unknown or incomplete flag: ${arg}`);
    else out.positional.push(arg);
  }
  return out;
}

function loadManifest(dir) {
  const file = path.join(dir, 'manifest.json');
  if (!existsSync(file)) throw new Error(`No manifest.json in ${dir}`);
  return parseManifest(JSON.parse(readFileSync(file, 'utf8')));
}

function loadAllRatings(dir) {
  const files = readdirSync(dir).filter((f) => /^ratings-.+\.jsonl$/.test(f)).sort();
  return files.flatMap((f) => {
    try { return parseRatings(readFileSync(path.join(dir, f), 'utf8')); }
    catch (error) { throw new Error(`${f}: ${error.message}`); }
  });
}

function play(file) {
  return new Promise((resolve) => {
    const child = spawn('afplay', [file], { stdio: 'ignore' });
    child.on('error', () => { console.log(`  (cannot play audio here; file: ${file})`); resolve(); });
    child.on('close', () => resolve());
  });
}

async function ask(rl, question, valid) {
  for (;;) {
    const answer = (await rl.question(question)).trim().toLowerCase();
    if (valid(answer)) return answer;
    console.log('  Please try again.');
  }
}

async function rate(dir, rater) {
  if (!/^[a-z0-9_-]{2,32}$/.test(rater)) throw new Error('--rater must match ^[a-z0-9_-]{2,32}$');
  const clips = loadManifest(dir);
  const ratingsFile = path.join(dir, `ratings-${rater}.jsonl`);
  const done = new Set(existsSync(ratingsFile) ? parseRatings(readFileSync(ratingsFile, 'utf8')).map((r) => r.clipId) : []);
  const todo = clips.filter((c) => !done.has(c.id));
  console.log(`${todo.length} clip(s) to rate, ${done.size} already rated by ${rater}.`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (const [index, clip] of todo.entries()) {
      console.log(`\nClip ${index + 1} of ${todo.length}  (${clip.cefrBand})`);
      console.log(`  Reference: ${clip.reference}`);
      const wav = path.join(dir, clip.file);
      if (!existsSync(wav)) { console.log(`  Missing audio file: ${wav}. Skipping.`); continue; }
      await play(wav);
      let overall = null;
      while (overall === null) {
        const answer = await ask(rl, '  Overall 1-5 (r to replay): ', (a) => a === 'r' || /^[1-5]$/.test(a));
        if (answer === 'r') await play(wav); else overall = Number(answer);
      }
      const phonemes = {};
      for (const ipa of clip.focusPhonemes) {
        const answer = await ask(rl, `  /${ipa}/ fine or off (f/o): `, (a) => ['f', 'o', 'fine', 'off'].includes(a));
        phonemes[ipa] = answer.startsWith('f') ? 'fine' : 'off';
      }
      appendFileSync(ratingsFile, `${JSON.stringify({ clipId: clip.id, rater, overall, phonemes, ratedAt: new Date().toISOString() })}\n`);
    }
  } finally { rl.close(); }
  console.log('\nDone.');
}

function report(dir) {
  const clips = loadManifest(dir);
  const ratings = loadAllRatings(dir);
  console.log(formatReport(agreementReport(ratings), calibrationReport(clips, ratings)));
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(USAGE); process.exit(0); }
  const dir = args.positional[0];
  if (!dir || args.positional.length > 1) throw new Error('Give exactly one clip folder.');
  if (args.report) report(dir);
  else if (args.rater) await rate(dir, args.rater);
  else throw new Error('Give --rater <pseudonym> or --report.');
} catch (error) {
  console.error(`${error.message}\n${USAGE}`);
  process.exit(2);
}
