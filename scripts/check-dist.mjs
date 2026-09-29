// Post-build checks on the rendered site (spec C3 and C10). Fails the build on:
//  - missing disclosure strip or footer disclosure on any page
//  - missing author box on comparison and guide pages
//  - em dash or exclamation mark in rendered text
//  - a mysoftx3.com link without the UTM parameters from utm.ts
//  - inline executable scripts (CSP allows none)
//  - more or fewer than one <h1>, or a <title> over 60 characters
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(import.meta.dirname, '..', 'dist');
const site = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '..', 'src/data/site.json'), 'utf8'));
const errors = [];

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const html = walk(dist).filter((f) => f.endsWith('.html'));
const decode = (s) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

for (const file of html) {
  const rel = '/' + path.relative(dist, file).replace(/index\.html$/, '');
  const src = fs.readFileSync(file, 'utf8');
  const fail = (m) => errors.push(`${rel}: ${m}`);

  if (!src.includes('class="disclosure-strip"') || !decode(src).includes(site.strapline)) fail('missing disclosure strip');
  if (!decode(src).includes(site.footerDisclosure)) fail('missing footer disclosure');
  if (/^\/(compare|guides)\/[^/]+\/$/.test(rel) && !src.includes('class="author-box"')) fail('missing author box');

  const h1s = src.match(/<h1[\s>]/g) ?? [];
  if (h1s.length !== 1) fail(`has ${h1s.length} <h1> elements`);
  const title = decode(src.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  if (!title) fail('missing <title>');
  if (title.length > 60) fail(`title is ${title.length} characters: "${title}"`);

  for (const m of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1];
    if (/type="application\/ld\+json"/.test(attrs)) continue;
    if (!/\bsrc=/.test(attrs) && m[2].trim()) fail('contains an inline executable script');
  }

  for (const m of src.matchAll(/href="([^"]*mysoftx3\.com[^"]*)"/g)) {
    const u = new URL(decode(m[1]));
    const p = u.searchParams;
    if (p.get('utm_source') !== 'sagereseller' || p.get('utm_medium') !== 'referral' || p.get('utm_campaign') !== 'buyers-guide' || !p.get('utm_content')?.includes('__')) {
      fail(`Mysoft link without UTMs: ${u}`);
    }
  }

  const text = decode(
    src
      .replace(/<!doctype[^>]*>/i, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, ' '),
  );
  if (text.includes('—') || src.includes('&mdash;')) fail('contains an em dash');
  const bang = text.match(/.{0,30}!.{0,30}/);
  if (bang) fail(`contains an exclamation mark: "${bang[0].trim()}"`);
}

if (errors.length) {
  for (const e of errors) console.error(`error ${e}`);
  console.error(`\nDist check failed with ${errors.length} error(s) across ${html.length} pages.`);
  process.exit(1);
}
console.log(`Dist check passed for ${html.length} pages.`);
