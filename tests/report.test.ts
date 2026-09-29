import { describe, expect, it } from 'vitest';
import { validate, resultFor, zohoLead, reportEmail } from '../src/server/report';

const base = {
  name: 'Alex Morgan',
  email: 'alex@example.co.uk',
  company: 'Example Ltd',
  role: 'Chief Financial Officer or Finance Director',
  marketingOptIn: false,
  answers: 'make,manufacture,2-5,few,oneoff,cloud-pref,sage50-200,20-100,6-12m,lead',
  pageUrl: 'https://sagereseller.com/which-sage/',
  utm: { utm_source: 'linkedin' },
  turnstileToken: 't',
};

describe('report request', () => {
  it('accepts a complete request', () => {
    const v = validate(base);
    expect(v.ok).toBe(true);
  });

  it('rejects missing fields and incomplete answers', () => {
    const v = validate({ ...base, email: 'nope', answers: 'make' });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors).toEqual(expect.arrayContaining(['email', 'answers']));
  });

  it('flags free-mail softly without rejecting', () => {
    const v = validate({ ...base, email: 'alex@gmail.com' });
    expect(v.ok && v.freeMail).toBe(true);
  });

  it('recomputes the result server-side', () => {
    const v = validate(base);
    if (!v.ok) throw new Error('invalid');
    expect(resultFor(v.req).outcome).toBe('x3');
  });

  it('builds a Zoho lead with the right source and opt-out', () => {
    const v = validate(base);
    if (!v.ok) throw new Error('invalid');
    const lead = zohoLead(v.req, resultFor(v.req), v.freeMail, new Date('2026-10-01T10:00:00Z'), 'Lead_Sub_Source');
    expect(lead.Lead_Source).toBe('sagereseller.com');
    expect(lead.Lead_Sub_Source).toBe('Selector report');
    expect(lead.First_Name).toBe('Alex');
    expect(lead.Last_Name).toBe('Morgan');
    expect(lead.Email_Opt_Out).toBe(true);
    expect(lead.Description).toContain('Selector outcome: x3 (strong)');
  });

  it('escapes user input in the report email and tags Mysoft links', () => {
    const v = validate({ ...base, name: '<b>Alex</b> Morgan' });
    if (!v.ok) throw new Error('invalid');
    const e = reportEmail(v.req, resultFor(v.req));
    expect(e.html).not.toContain('<b>Alex</b>');
    expect(e.html).toContain('utm_content=report-email__report-cta');
    expect(e.html.replace(/<!doctype[^>]*>/i, '')).not.toMatch(/[\u2014!]/);
    expect(e.text).not.toMatch(/[\u2014!]/);
  });
});
