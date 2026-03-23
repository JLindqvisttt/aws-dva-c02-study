/**
 * fix_answer_distribution.mjs
 *
 * Rotates options arrays so correct answers are spread evenly across A/B/C/D.
 * Content is unchanged — only the letter ordering is adjusted.
 * Handles both single (integer) and multi (array) answers.
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = process.cwd();
const QDIR = path.join(ROOT, 'data', 'questions');

// Only fix banks that are actually skewed (100% B or heavily B-dominant)
const TARGETS = [
  'questions-aif-c01.js',
  'questions-ans-c01.js',
  'questions-cloudops-c01.js',
  'questions-dea-c01.js',
  'questions-dop-c02.js',
  'questions-genai-dev-pro.js',
  'questions-mla-c01.js',
  'questions-mls-c01.js',
  'questions-saa-c03.js',
  'questions-sap-c02.js',
  'questions-scs-c02.js',
];

/**
 * Rotate an array left by r positions.
 * rotate([A,B,C,D], 1) => [B,C,D,A]
 */
function rotateLeft(arr, r) {
  const n = arr.length;
  if (n === 0) return arr;
  const shift = ((r % n) + n) % n;
  return [...arr.slice(shift), ...arr.slice(0, shift)];
}

/**
 * New index of element that was at oldIdx after rotating left by r.
 * Element at oldIdx ends up at (oldIdx - r + n) % n.
 */
function newIdx(oldIdx, r, n) {
  return ((oldIdx - r) % n + n) % n;
}

for (const filename of TARGETS) {
  const filepath = path.join(QDIR, filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`SKIP ${filename} — file not found`);
    continue;
  }

  const source = fs.readFileSync(filepath, 'utf8');
  const ctx = { console: { log() {}, warn() {}, error() {} } };
  vm.createContext(ctx);
  vm.runInContext(`${source}\nthis.__bank={CERT_META,TOPIC_RULES,QUESTIONS,SERVICES};`, ctx, {
    filename: filepath,
  });

  const { CERT_META, TOPIC_RULES, QUESTIONS, SERVICES } = ctx.__bank;

  const before = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const after = { 0: 0, 1: 0, 2: 0, 3: 0 };

  const fixedQuestions = QUESTIONS.map((q, i) => {
    const opts = Array.isArray(q.options) ? q.options : [];
    const n = opts.length;
    if (n < 2) return q;

    // Track original distribution (single-answer only)
    if (!Array.isArray(q.answer) && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < n) {
      before[Math.min(q.answer, 3)] = (before[Math.min(q.answer, 3)] || 0) + 1;
    }

    // Rotation amount cycles 0,1,2,3 based on question index
    const r = i % 4;
    if (r === 0) {
      // No change
      if (!Array.isArray(q.answer) && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < n) {
        after[Math.min(q.answer, 3)] = (after[Math.min(q.answer, 3)] || 0) + 1;
      }
      return q;
    }

    const rotatedOptions = rotateLeft(opts, r);

    let rotatedAnswer;
    if (Array.isArray(q.answer)) {
      rotatedAnswer = q.answer
        .filter(a => Number.isInteger(a) && a >= 0 && a < n)
        .map(a => newIdx(a, r, n))
        .sort((a, b) => a - b);
    } else if (Number.isInteger(q.answer) && q.answer >= 0 && q.answer < n) {
      rotatedAnswer = newIdx(q.answer, r, n);
      after[Math.min(rotatedAnswer, 3)] = (after[Math.min(rotatedAnswer, 3)] || 0) + 1;
    } else {
      // Invalid answer — leave unchanged
      return q;
    }

    return { ...q, options: rotatedOptions, answer: rotatedAnswer };
  });

  // Rebuild file
  const lines = [];
  lines.push(`const CERT_META = ${JSON.stringify(CERT_META, null, 2)};`);
  lines.push('');
  lines.push('const TOPIC_RULES = [');
  for (const [matcher, topic] of TOPIC_RULES) {
    lines.push(`  [${matcher.toString()}, ${JSON.stringify(topic)}],`);
  }
  lines.push('];');
  lines.push('');
  lines.push(`const QUESTIONS = ${JSON.stringify(fixedQuestions, null, 2)};`);
  lines.push('');
  if (Array.isArray(SERVICES)) {
    lines.push(`const SERVICES = ${JSON.stringify(SERVICES, null, 2)};`);
    lines.push('');
  }

  fs.writeFileSync(filepath, lines.join('\n'));

  const beforeStr = Object.entries(before).map(([k,v]) => `${String.fromCharCode(65+Number(k))}=${v}`).join(' ');
  const afterStr  = Object.entries(after).map(([k,v])  => `${String.fromCharCode(65+Number(k))}=${v}`).join(' ');
  console.log(`FIXED ${filename.replace('questions-','').replace('.js','').padEnd(16)} before=[${beforeStr}]  after=[${afterStr}]`);
}

console.log('\nDone. Run audit_banks.mjs to verify.');
