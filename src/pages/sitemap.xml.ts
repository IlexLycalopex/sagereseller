import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import site from '../data/site.json';

// lastmod comes from lastReviewed (spec C5).
export const GET: APIRoute = async () => {
  const launch = '2026-09-29';
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const comparisons = await getCollection('comparisons');
  const guides = await getCollection('guides');
  const urls: { loc: string; lastmod: string }[] = [
    ...['/', '/which-sage/', '/sage-intacct-or-sage-x3/', '/compare/', '/guides/', '/marketplace/', '/about/', '/how-we-compare/', '/privacy/'].map((p) => ({ loc: p, lastmod: launch })),
    ...comparisons.map((c) => ({ loc: `/compare/${c.id}/`, lastmod: iso(c.data.lastReviewed) })),
    ...guides.map((g) => ({ loc: `/guides/${g.id}/`, lastmod: iso(g.data.lastReviewed) })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${site.url}${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
