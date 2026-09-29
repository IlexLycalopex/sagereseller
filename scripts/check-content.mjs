// Pre-build content checks (spec C3). Fails the build on:
//  - em dash (U+2014) or exclamation mark in content and data files
//  - lastReviewed older than 120 days on any comparison or guide
// Warns on nextReview in the past and on pages not yet verified by Consulting.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dirs = ['src/content', 'src/data'];
const errors = [];
const warnings = [];
const MAX_AGE_DAYS = 120;
const today = new Date(process.env.CHECK_DATE ?? Date.now());

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

for (const dir of dirs) {
  for (const file of walk(path.join(root, dir))) {
    if (!/\.(md|mdx|json)$/.test(file)) continue;
    const rel = path.relative(root, file);
    const text = fs.readFileSync(file, 'utf8');
    text.split('\n').forEach((line, i) => {
      if (line.includes('—')) errors.push(`${rel}:${i + 1} contains an em dash`);
      // Ignore "!" inside JS/JSX expressions in MDX imports (none expected) and markdown image syntax.
      const prose = line.replace(/!\[/g, '[').replace(/!==?/g, '');
      if (prose.includes('!')) errors.push(`${rel}:${i + 1} contains an exclamation mark`);
    });

    if (!/src\/content\/(comparisons|guides)\//.test(rel)) continue;
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) { errors.push(`${rel} has no frontmatter`); continue; }
    const get = (k) => fm[1].match(new RegExp(`^${k}:\\s*(\\S+)`, 'm'))?.[1];
    const reviewed = get('lastReviewed');
    const next = get('nextReview');
    if (!get('author')) errors.push(`${rel} has no author`);
    if (reviewed) {
      const age = (today - new Date(reviewed)) / 86400000;
      if (age > MAX_AGE_DAYS) errors.push(`${rel} was last reviewed ${Math.floor(age)} days ago (limit ${MAX_AGE_DAYS})`);
    }
    if (next && new Date(next) < today) warnings.push(`${rel} nextReview ${next} is in the past`);
    if (!/^verified:\s*true/m.test(fm[1])) warnings.push(`${rel} is not yet verified by Consulting`);
  }
}

for (const w of warnings) console.warn(`warn  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error ${e}`);
  console.error(`\nContent check failed with ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`Content check passed (${warnings.length} warning(s)).`);
