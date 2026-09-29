// Pure helpers for the /api/report Pages Function, kept here so they can be unit tested.
import { rules } from '../lib/rules';
import { decodeAnswers, score, visibleQuestions, type Result } from '../lib/scoring';
import { mysoftUrl } from '../lib/utm';

export interface ReportRequest {
  name: string;
  email: string;
  company: string;
  role: string;
  marketingOptIn: boolean;
  answers: string;
  pageUrl: string;
  utm: Record<string, string>;
  turnstileToken: string;
}

export const FREE_MAIL = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'live.co.uk', 'icloud.com', 'aol.com', 'btinternet.com', 'proton.me', 'protonmail.com']);

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function validate(body: unknown): { ok: true; req: ReportRequest; freeMail: boolean } | { ok: false; errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const req: ReportRequest = {
    name: clip(b.name, 120),
    email: clip(b.email, 200).toLowerCase(),
    company: clip(b.company, 160),
    role: clip(b.role, 120),
    marketingOptIn: b.marketingOptIn === true,
    answers: clip(b.answers, 400),
    pageUrl: clip(b.pageUrl, 500),
    utm: {},
    turnstileToken: clip(b.turnstileToken, 4096),
  };
  if (b.utm && typeof b.utm === 'object') {
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const v = clip((b.utm as Record<string, unknown>)[k], 200);
      if (v) req.utm[k] = v;
    }
  }
  const errors: string[] = [];
  if (!req.name) errors.push('name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.email)) errors.push('email');
  if (!req.company) errors.push('company');
  if (!req.role) errors.push('role');
  const answers = decodeAnswers(req.answers, rules);
  const missing = visibleQuestions(answers, rules).filter((q) => !answers[q.id]?.length);
  if (missing.length) errors.push('answers');
  if (errors.length) return { ok: false, errors };
  return { ok: true, req, freeMail: FREE_MAIL.has(req.email.split('@')[1]) };
}

/** Recompute the result server-side from the answers; never trust the client's result. */
export function resultFor(req: ReportRequest): Result {
  return score(decodeAnswers(req.answers, rules), rules);
}

export function answersSummary(req: ReportRequest): string {
  const answers = decodeAnswers(req.answers, rules);
  return visibleQuestions(answers, rules)
    .map((q) => `${q.text} ${(answers[q.id] ?? []).map((id) => q.options.find((o) => o.id === id)?.label ?? id).join(', ')}`)
    .join('\n');
}

export function leadDescription(req: ReportRequest, result: Result, freeMail: boolean, now: Date): string {
  const items = [...result.gaps, ...result.constraints].map((g) => `- ${g.issue}`).join('\n') || '- None';
  return [
    `Selector outcome: ${result.outcome}${result.confidence ? ` (${result.confidence})` : ''}`,
    `Scores: Sage X3 ${result.scores.x3}, Sage Intacct ${result.scores.intacct}. Rules: ${result.appliedRules.join(', ') || 'none'}`,
    '',
    'Gaps and constraints:',
    items,
    '',
    'Answers:',
    answersSummary(req),
    '',
    `Marketing opt-in: ${req.marketingOptIn ? 'yes' : 'no'} at ${now.toISOString()}`,
    freeMail ? 'Note: free-mail address.' : '',
    `Page: ${req.pageUrl}`,
    Object.keys(req.utm).length ? `Landing UTMs: ${JSON.stringify(req.utm)}` : '',
  ].filter((l) => l !== '').join('\n');
}

export function zohoLead(req: ReportRequest, result: Result, freeMail: boolean, now: Date, subSourceField: string) {
  const parts = req.name.split(/\s+/);
  const last = parts.length > 1 ? parts.pop()! : parts[0];
  const first = parts.length ? parts.join(' ') : '';
  return {
    First_Name: first || undefined,
    Last_Name: last,
    Email: req.email,
    Company: req.company,
    Designation: req.role,
    Lead_Source: 'sagereseller.com',
    [subSourceField]: 'Selector report',
    Email_Opt_Out: !req.marketingOptIn,
    Description: leadDescription(req, result, freeMail, now),
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function reportEmail(req: ReportRequest, result: Result): { subject: string; html: string; text: string } {
  const o = rules.outcomes[result.outcome];
  const link = (key: string, pos: string) => mysoftUrl(key, 'report-email', pos);
  const first = esc(req.name.split(/\s+/)[0]);
  const conf = result.confidence ? ` Confidence: ${result.confidence[0].toUpperCase()}${result.confidence.slice(1)}.` : '';
  const list = (xs: string[]) => `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const items = [...result.gaps, ...result.constraints];
  const fit = result.outcome === 'not-sage' ? '' : `
    <h2 style="font-size:18px">Fit profile</h2>
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #E4E6EA;font-size:14px">
      <tr style="background:#F7F8F9"><th align="left">Area</th><th align="left">Sage Intacct</th><th align="left">Sage X3</th></tr>
      ${result.fitProfile.map((r) => `<tr><td style="border-top:1px solid #E4E6EA">${esc(r.area)}</td><td style="border-top:1px solid #E4E6EA">${esc(r.intacct.label)}</td><td style="border-top:1px solid #E4E6EA">${esc(r.x3.label)}</td></tr>`).join('')}
    </table>`;
  let extra = '';
  if (result.outcome === 'both') extra = `<h2 style="font-size:18px">What would tip it</h2>${list(rules.outcomes.both.tipIt)}`;
  if (result.outcome === 'not-sage') extra = `<h2 style="font-size:18px">What to consider instead</h2>${list(rules.outcomes['not-sage'].consider)}`;
  if (result.outcome === 'too-early') extra = `<h2 style="font-size:18px">Signals that it is time to move</h2>${list(rules.outcomes['too-early'].signals)}`;

  const html = `<!doctype html><html lang="en-GB"><body style="margin:0;background:#FFFFFF;color:#001A22;font-family:'Avenir Next',Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px">
    <p style="font-size:13px;color:#006380;text-transform:uppercase;letter-spacing:0.14em;font-weight:600">The Sage Buyer's Guide</p>
    <p>Hello ${first},</p>
    <p>Here is the report you asked for.</p>
    <h1 style="font-size:26px;line-height:1.2">${esc(o.headline)}</h1>
    <p>${`${esc(o.summary ?? '')}${conf}`.trim()}</p>
    ${result.reasons.length ? `<h2 style="font-size:18px">Why</h2>${list(result.reasons)}` : ''}
    ${extra}
    ${fit}
    ${items.length ? `<h2 style="font-size:18px">Gaps and constraints to plan for</h2><ul>${items.map((g) => `<li><strong>${esc(g.issue)}</strong> ${esc(g.action)}</li>`).join('')}</ul>` : ''}
    <h2 style="font-size:18px">Indicative timeline and cost</h2>
    <p>Timeline and cost depend on your scope, entities and data. A Mysoft consultant can give you an indicative range for your situation in a short call.</p>
    <h2 style="font-size:18px">Questions to ask any supplier</h2>
    <ol>${result.questionsToAsk.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
    <p><a href="${esc(link('mysoft-case-studies', 'case-studies'))}" style="color:#006380">See how Mysoft customers made the move</a></p>
    <p><a href="${esc(link(o.ctaLink, 'report-cta'))}" style="display:inline-block;background:#001A22;color:#FFFFFF;padding:12px 18px;border-radius:4px;text-decoration:none">${esc(o.ctaLabel)}</a></p>
    <p>Jamie Watts<br>Managing Director, Mysoft</p>
    <hr style="border:0;border-top:1px solid #E4E6EA">
    <p style="font-size:12px;color:#6B7480">You asked for this report on sagereseller.com, published by Jamie Watts and Mysoft Ltd, a UK Sage Partner. Mysoft has a commercial interest in Sage. <a href="https://sagereseller.com/privacy/" style="color:#006380">Privacy notice</a>.</p>
  </div></body></html>`;

  const text = [
    `Hello ${req.name.split(/\s+/)[0]},`,
    '',
    `${o.headline}.${conf}`,
    ...result.reasons.map((r) => `- ${r}`),
    '',
    items.length ? 'Gaps and constraints:' : '',
    ...items.map((g) => `- ${g.issue} ${g.action}`),
    '',
    'Questions to ask any supplier:',
    ...result.questionsToAsk.map((q, i) => `${i + 1}. ${q}`),
    '',
    `${o.ctaLabel}: ${link(o.ctaLink, 'report-cta')}`,
    '',
    'Jamie Watts, Managing Director, Mysoft',
  ].join('\n');

  return { subject: `Your Sage Buyer's Guide report: ${o.headline}`, html, text };
}
