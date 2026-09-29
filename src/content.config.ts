import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

const fitState = z.enum(['strong', 'possible', 'gap', 'neutral']);

// A source is either an external URL or a Mysoft page (built through utm.ts).
const source = z
  .object({
    title: z.string(),
    publisher: z.string(),
    url: z.url().optional(),
    mysoftKey: z.string().optional(),
    accessed: z.coerce.date(),
  })
  .refine((s) => Boolean(s.url) !== Boolean(s.mysoftKey), 'A source needs exactly one of url or mysoftKey');

const faq = z.object({ q: z.string(), a: z.string() });

// Shared editorial fields (spec C3). Build fails on missing author or sources.
const editorial = {
  title: z.string(),
  primaryQuery: z.string(),
  description: z.string().min(120).max(165),
  faqs: z.array(faq).default([]),
  sources: z.array(source).min(1, 'Every page needs at least one source'),
  author: reference('authors'),
  published: z.coerce.date(),
  lastReviewed: z.coerce.date(),
  nextReview: z.coerce.date(),
  region: z.array(z.enum(['uk', 'us'])).default(['uk']),
  ctaLink: z.string(),
  phase: z.number().int().min(1).max(3).default(1),
  // true once every factual statement has been checked against the listed sources.
  verified: z.boolean().default(false),
};

const comparisons = defineCollection({
  loader: glob({ pattern: '*.{md,mdx}', base: './src/content/comparisons' }),
  schema: z.object({
    ...editorial,
    sageProduct: z.enum(['intacct', 'x3']),
    competitor: z.string(),
    competitorVendor: z.string(),
    bestFor: z.string(),
    related: z.string().optional(),
    verdict: z.object({
      chooseSage: z.array(z.string()).length(3),
      chooseCompetitor: z.array(z.string()).length(3),
    }),
    table: z
      .array(
        z.object({
          feature: z.string(),
          sage: z.string(),
          competitor: z.string(),
          sageState: fitState.default('neutral'),
          competitorState: fitState.default('neutral'),
        }),
      )
      .min(6)
      .max(12),
    questions: z.array(z.string()).length(5),
  }),
});

const guides = defineCollection({
  loader: glob({ pattern: '*.{md,mdx}', base: './src/content/guides' }),
  schema: z.object({
    ...editorial,
    shortAnswer: z.string(),
    steps: z.array(z.object({ title: z.string(), body: z.string() })).optional(),
    ctaLabel: z.string(),
    ctaHref: z.string().optional(),
    relatedComparison: z.string(),
    order: z.number().default(50),
  }),
});

const marketplace = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/marketplace' }),
  schema: z.object({
    name: z.string(),
    publisher: z.string(),
    worksWith: z.enum(['intacct', 'x3', 'both']),
    function: z.enum(['marketplace', 'ap-automation', 'order-automation', 'document-management', 'notifications', 'inventory', 'manufacturing', 'planning', 'ecommerce', 'payroll', 'reporting']),
    bestFor: z.string(),
    description: z.string().optional(),
    relationship: z.enum(['sage', 'built-by-mysoft', 'mysoft-partner', 'independent']),
    url: z.url(),
    mysoftKey: z.string().optional(),
    sponsored: z.boolean().default(false),
    order: z.number().default(50),
    confirmed: z.boolean().default(false),
  }),
});

const authors = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/authors' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    credentials: z.string(),
    linkedin: z.url(),
    image: z.string().optional(),
  }),
});

export const collections = { comparisons, guides, marketplace, authors };
