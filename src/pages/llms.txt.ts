import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import site from '../data/site.json';

export const GET: APIRoute = async () => {
  const comparisons = (await getCollection('comparisons')).sort((a, b) => a.data.phase - b.data.phase);
  const guides = (await getCollection('guides')).sort((a, b) => a.data.order - b.data.order);
  const body = `# The Sage Buyer's Guide

> A buyer's guide for finance leaders choosing between Sage Intacct, Sage X3 and the alternatives. Published by Jamie Watts, Managing Director of Mysoft Ltd, a UK Sage Partner. Mysoft has a commercial interest in Sage; comparisons state where other systems are stronger and include a "Sage may not be right for you" outcome.

Publisher: Mysoft Ltd (https://www.mysoftx3.com). Author: Jamie Watts. Language: en-GB. Comparisons list sources and are reviewed quarterly.

## Decide

- [Which Sage product is right for you? (selector)](${site.url}/which-sage/): ten questions, result on screen.
- [Sage Intacct or Sage X3: how to decide](${site.url}/sage-intacct-or-sage-x3/): the selector's full rules as readable prose and tables.

## Comparisons

${comparisons.map((c) => `- [${c.data.title}](${site.url}/compare/${c.id}/): ${c.data.description}`).join('\n')}

## Guides

${guides.map((g) => `- [${g.data.title}](${site.url}/guides/${g.id}/): ${g.data.shortAnswer}`).join('\n')}

## Ecosystem

- [Sage marketplaces and add-ons](${site.url}/marketplace/)

## About

- [About this guide](${site.url}/about/)
- [How we compare (editorial policy)](${site.url}/how-we-compare/)
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
