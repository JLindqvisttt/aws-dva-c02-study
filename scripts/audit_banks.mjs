import fs from 'fs';
import path from 'path';
import vm from 'vm';

const qdir = path.join(process.cwd(), 'data', 'questions');
const files = fs.readdirSync(qdir)
  .filter(f => f.startsWith('questions-') && f.endsWith('.js'))
  .sort();

for (const f of files) {
  const src = fs.readFileSync(path.join(qdir, f), 'utf8');
  const ctx = { console: { log(){}, warn(){}, error(){} } };
  vm.createContext(ctx);
  vm.runInContext(`${src}\nthis.__b={QUESTIONS};`, ctx);
  const qs = ctx.__b.QUESTIONS || [];

  const dist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  let invalid = 0;
  let multi = 0;
  let dups = 0;
  const seen = new Set();

  for (const q of qs) {
    // Duplicate detection
    const key = (q.q || '').trim().toLowerCase().slice(0, 100);
    if (key) {
      if (seen.has(key)) dups++;
      else seen.add(key);
    }

    // Answer validity
    if (Array.isArray(q.answer)) { multi++; continue; }
    const opts = (q.options || []).length;
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= opts) {
      invalid++;
      continue;
    }
    dist[q.answer] = (dist[q.answer] || 0) + 1;
  }

  const total = qs.length - multi - invalid;
  const pct = i => total ? Math.round(dist[i] * 100 / total) + '%' : '?';
  const dominated = Object.values(dist).some(v => total && v / total > 0.70);

  const name = f.replace('questions-', '').replace('.js', '').padEnd(18);
  const flags = [];
  if (dominated) flags.push('SKEWED_ANSWERS');
  if (invalid > 0) flags.push('INVALID_ANS=' + invalid);
  if (dups > 0) flags.push('DUPS=' + dups);

  const status = flags.length ? 'WARN' : 'OK  ';
  console.log(
    `${status} ${name} n=${String(qs.length).padStart(3)} multi=${multi} A=${pct(0)} B=${pct(1)} C=${pct(2)} D=${pct(3)}`
    + (flags.length ? '  [' + flags.join(', ') + ']' : '')
  );
}
