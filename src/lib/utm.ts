// Every link to mysoftx3.com is built here (spec C8). Never hand-type a Mysoft URL.
import linkMap from '../data/links.json';

export type MysoftKey = keyof typeof linkMap.links;

export const UTM = {
  utm_source: 'sagereseller',
  utm_medium: 'referral',
  utm_campaign: 'buyers-guide',
} as const;

export function isMysoftKey(key: string): key is MysoftKey {
  return key in linkMap.links;
}

/** Slug used in utm_content: "/" => "home", "/compare/x/" => "compare-x". */
export function pageSlug(pathname: string): string {
  const s = pathname.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
  return s || 'home';
}

/**
 * Build a tracked Mysoft URL.
 * @param key      link map key, e.g. "mysoft-intacct"
 * @param page     page slug or pathname, e.g. "sage-intacct-vs-netsuite"
 * @param position where on the page, e.g. "verdict-cta"
 */
export function mysoftUrl(key: string, page: string, position: string): string {
  if (!isMysoftKey(key)) throw new Error(`Unknown Mysoft link key: ${key}`);
  const url = new URL(linkMap.links[key].path, linkMap.base);
  for (const [k, v] of Object.entries(UTM)) url.searchParams.set(k, v);
  const slug = page.includes('/') ? pageSlug(page) : page;
  url.searchParams.set('utm_content', `${slug}__${position}`);
  return url.toString();
}

export function mysoftLabel(key: string): string {
  if (!isMysoftKey(key)) throw new Error(`Unknown Mysoft link key: ${key}`);
  return linkMap.links[key].label;
}

export const mysoftKeys = Object.keys(linkMap.links) as MysoftKey[];
