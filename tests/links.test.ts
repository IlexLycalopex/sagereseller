import { describe, expect, it } from 'vitest';
import { mysoftKeys, mysoftUrl, pageSlug } from '../src/lib/utm';
import rules from '../src/data/selector.rules.json';

describe('utm builder', () => {
  it('adds the four UTM parameters to every Mysoft link', () => {
    for (const key of mysoftKeys) {
      const url = new URL(mysoftUrl(key, 'home', 'test'));
      expect(url.hostname).toBe('www.mysoftx3.com');
      expect(url.protocol).toBe('https:');
      expect(url.searchParams.get('utm_source')).toBe('sagereseller');
      expect(url.searchParams.get('utm_medium')).toBe('referral');
      expect(url.searchParams.get('utm_campaign')).toBe('buyers-guide');
      expect(url.searchParams.get('utm_content')).toBe('home__test');
    }
  });

  it('builds utm_content as {page-slug}__{link-position}', () => {
    const url = new URL(mysoftUrl('mysoft-intacct', '/compare/sage-intacct-vs-netsuite/', 'verdict-cta'));
    expect(url.searchParams.get('utm_content')).toBe('compare-sage-intacct-vs-netsuite__verdict-cta');
    expect(url.pathname).toBe('/what-we-do/sage-intacct-solution/');
  });

  it('maps pathnames to slugs', () => {
    expect(pageSlug('/')).toBe('home');
    expect(pageSlug('/which-sage/')).toBe('which-sage');
  });

  it('rejects unknown keys', () => {
    expect(() => mysoftUrl('mysoft-nope', 'home', 'x')).toThrow();
  });

  it('every mysoft link referenced by the selector rules exists', () => {
    const keys = [
      ...rules.gaps.flatMap((g) => (g.link?.type === 'mysoft' ? [g.link.key as string] : [])),
      ...['intacct', 'x3', 'both', 'not-sage', 'too-early'].map(
        (o) => (rules.outcomes as Record<string, { ctaLink: string }>)[o].ctaLink,
      ),
    ];
    for (const k of keys) expect(mysoftKeys).toContain(k);
  });
});
