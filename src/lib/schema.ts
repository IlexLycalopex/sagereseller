// JSON-LD builders (spec Appendix C). Same Organization @id as mysoftx3.com.
import site from '../data/site.json';

const abs = (path: string) => new URL(path, site.url).toString();
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function sitewideGraph() {
  return [
    {
      '@type': 'Organization',
      '@id': site.orgId,
      name: site.company.name,
      url: 'https://www.mysoftx3.com',
      sameAs: [site.company.linkedin, site.company.companiesHouse],
    },
    {
      '@type': 'Person',
      '@id': site.personId,
      name: 'Jamie Watts',
      jobTitle: 'Managing Director',
      worksFor: { '@id': site.orgId },
      sameAs: [site.company.linkedin],
    },
    {
      '@type': 'WebSite',
      '@id': site.websiteId,
      name: site.name,
      url: site.url,
      publisher: { '@id': site.orgId },
      author: { '@id': site.personId },
      inLanguage: 'en-GB',
    },
  ];
}

export function articleNode(opts: { headline: string; description: string; path: string; published: Date; modified: Date }) {
  return {
    '@type': 'Article',
    headline: opts.headline,
    description: opts.description,
    author: { '@id': site.personId },
    publisher: { '@id': site.orgId },
    datePublished: iso(opts.published),
    dateModified: iso(opts.modified),
    mainEntityOfPage: abs(opts.path),
    isPartOf: { '@id': site.websiteId },
    inLanguage: 'en-GB',
  };
}

export function breadcrumbNode(items: { name: string; path?: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      ...(it.path ? { item: abs(it.path) } : {}),
    })),
  };
}

export function faqNode(faqs: { q: string; a: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function graph(nodes: object[]) {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c');
}
