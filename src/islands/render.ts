// String renderers shared by the server (first question in static HTML) and the
// Selector island, so the markup is identical before and after hydration.
import { iconSvg, fitIcon, type IconName } from '../lib/icons';
import { mysoftUrl } from '../lib/utm';
import type { Answers, Question, Result, Rules, RuleLink, ResultItem, Severity } from '../lib/scoring';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface CardOpts {
  question: Question;
  index: number; // 1-based
  total: number;
  answers: Answers;
  entry: 'hero' | 'page';
}

export function questionCard({ question: q, index, total, answers, entry }: CardOpts): string {
  const selected = answers[q.id] ?? [];
  const multi = q.type === 'multi';
  const role = multi ? 'group' : 'radiogroup';
  const optRole = multi ? 'checkbox' : 'radio';
  const focusIdx = Math.max(0, q.options.findIndex((o) => selected.includes(o.id)));
  const stacked = q.options.some((o) => o.label.length > 34);
  const pct = Math.round(((index - 1) / total) * 100);
  const showChrome = entry === 'page' || index > 1;

  const options = q.options
    .map((o, i) => {
      const on = selected.includes(o.id);
      const tab = multi ? 0 : i === focusIdx ? 0 : -1;
      const box = multi ? `<span class="box">${on ? iconSvg('check', 12) : ''}</span>` : '';
      return `<button type="button" class="option" role="${optRole}" aria-checked="${on}" tabindex="${tab}" data-option="${esc(o.id)}">${box}<span>${esc(o.label)}</span></button>`;
    })
    .join('');

  const back =
    index > 1 || entry === 'page'
      ? `<button type="button" class="back-btn" data-back ${index === 1 ? 'hidden' : ''}>${iconSvg('arrow-left', 16)}Back</button>`
      : '<span></span>';
  const cont = multi
    ? `<button type="button" class="btn btn-primary" data-continue ${selected.length ? '' : 'aria-disabled="true"'}>Continue</button>`
    : '';

  return `
  <div class="selector-card" data-card data-qid="${esc(q.id)}">
    <div class="selector-meta">
      <span class="eyebrow">Question ${index} of ${total}</span>
      <span class="muted">About three minutes</span>
    </div>
    ${showChrome ? `<div class="progress" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>` : ''}
    <h2 class="selector-q" id="q-${esc(q.id)}" tabindex="-1">${esc(q.text)}</h2>
    ${q.helper ? `<p class="selector-helper" id="h-${esc(q.id)}">${esc(q.helper)}</p>` : ''}
    <div class="options${stacked ? ' stacked' : ''}" role="${role}" aria-labelledby="q-${esc(q.id)}"${q.helper ? ` aria-describedby="h-${esc(q.id)}"` : ''}>${options}</div>
    ${showChrome || multi ? `<div class="selector-actions">${back}${cont}</div>` : ''}
    <p class="field-error" data-card-error hidden role="alert"></p>
  </div>`;
}

// Result screen

const sevIcon: Record<Severity, IconName> = { gap: 'x', possible: 'minus', constraint: 'info', note: 'check-circle' };
const sevLabel: Record<Severity, string> = { gap: 'Gap', possible: 'Possible with work', constraint: 'Constraint', note: 'Fit note' };
const confLabel = { strong: 'Strong', moderate: 'Moderate', borderline: 'Borderline' } as const;
const confBars = { strong: 3, moderate: 2, borderline: 1 } as const;

function linkHtml(link: RuleLink | undefined, position: string): string {
  if (!link) return '';
  if (link.type === 'mysoft' && link.key) {
    return `<a href="${esc(mysoftUrl(link.key, 'which-sage', position))}" data-mysoft="${esc(link.key)}" data-position="${position}">${esc(link.label)}</a>`;
  }
  return `<a href="${esc(link.href ?? '#')}">${esc(link.label)}</a>`;
}

function itemsHtml(items: ResultItem[], position: string): string {
  return `<ul class="items">${items
    .map(
      (g) => `<li class="item">
        <span class="sev-${g.severity}">${iconSvg(sevIcon[g.severity], 20)}</span>
        <div>
          <span class="sev-label sev-${g.severity}">${sevLabel[g.severity]}</span>
          <p class="item-issue">${esc(g.issue)}</p>
          <p class="item-action">${esc(g.action)} ${linkHtml(g.link, position)}</p>
        </div>
      </li>`,
    )
    .join('')}</ul>`;
}

function fitTable(result: Result, focus: 'intacct' | 'x3' | null): string {
  const cell = (s: { state: keyof typeof fitIcon; label: string }) =>
    `<span class="fit fit-${s.state}">${iconSvg(fitIcon[s.state], 16)}<span>${esc(s.label)}</span></span>`;
  const head = (p: 'intacct' | 'x3', name: string) => `<th scope="col">${name}${focus === p ? ' <span class="fit-tag">Recommended</span>' : ''}</th>`;
  return `<div class="table-wrap"><table class="data-table">
    <caption class="visually-hidden">Fit profile: Sage Intacct and Sage X3</caption>
    <thead><tr><th scope="col">Area</th>${head('intacct', 'Sage Intacct')}${head('x3', 'Sage X3')}</tr></thead>
    <tbody>${result.fitProfile
      .map((r) => `<tr><th scope="row">${esc(r.area)}</th><td>${cell(r.intacct)}</td><td>${cell(r.x3)}</td></tr>`)
      .join('')}</tbody></table></div>
    <p class="small muted" style="margin-top:12px">Fit states are Mysoft's view from implementation experience and are reviewed by Mysoft Consulting.</p>`;
}

const ROLES = ['Chief Financial Officer or Finance Director', 'Financial Controller or Head of Finance', 'Chief Operating Officer or Operations', 'CEO or Managing Director', 'IT or Systems', 'Other'];

function reportForm(): string {
  const siteKey = (import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined) ?? '';
  return `
  <form class="form-panel" data-report-form novalidate>
    <div>
      <h2>Get the full report</h2>
      <p class="text-2" style="margin-top:8px">Everything on this page plus detailed fit notes, an indicative timeline and cost ranges, emailed as a PDF-ready report. Your result above stays visible whether or not you ask for it.</p>
    </div>
    <div class="form-grid">
      <div class="field"><label for="rf-name">Name</label><input id="rf-name" name="name" autocomplete="name" required /><p class="field-error" id="rf-name-err" hidden></p></div>
      <div class="field"><label for="rf-email">Work email</label><input id="rf-email" name="email" type="email" autocomplete="email" required /><p class="field-hint" id="rf-email-hint" hidden></p><p class="field-error" id="rf-email-err" hidden></p></div>
      <div class="field"><label for="rf-company">Company</label><input id="rf-company" name="company" autocomplete="organization" required /><p class="field-error" id="rf-company-err" hidden></p></div>
      <div class="field"><label for="rf-role">Role</label><select id="rf-role" name="role" required><option value="">Choose your role</option>${ROLES.map((r) => `<option>${esc(r)}</option>`).join('')}</select><p class="field-error" id="rf-role-err" hidden></p></div>
    </div>
    <label class="check"><input type="checkbox" name="marketing" /><span>Send me occasional guidance from Mysoft on choosing and running Sage. You can unsubscribe at any time.</span></label>
    <p class="small muted">Mysoft Ltd will use your details to send this report and record your request in its CRM. See the <a href="/privacy/">privacy notice</a>.</p>
    ${siteKey ? `<div data-turnstile data-sitekey="${esc(siteKey)}"></div>` : ''}
    <div class="btn-row"><button type="submit" class="btn btn-primary" data-submit>Email me the report</button></div>
    <div data-form-status aria-live="polite"></div>
  </form>`;
}

export function resultView(result: Result, rules: Rules): string {
  const o = rules.outcomes[result.outcome];
  const cta = `<a class="btn btn-primary" href="${esc(mysoftUrl(o.ctaLink, 'which-sage', 'result-cta'))}" data-mysoft="${esc(o.ctaLink)}" data-position="result-cta">${esc(o.ctaLabel)}</a>`;
  const restart = `<button type="button" class="btn btn-ghost" data-restart>Start again</button>`;

  let head = '';
  let body = '';

  if (result.outcome === 'intacct' || result.outcome === 'x3') {
    const c = result.confidence ?? 'moderate';
    const bars = [1, 2, 3].map((n) => `<span class="${n <= confBars[c] ? 'on' : ''}"></span>`).join('');
    head = `
      <span class="eyebrow">Your result</span>
      <h1 tabindex="-1" data-result-heading>${esc(o.headline)}</h1>
      <div class="confidence"><span>Confidence: <strong>${confLabel[c]}</strong></span><span class="confidence-bar" aria-hidden="true">${bars}</span></div>
      <h2 class="visually-hidden">Why</h2>
      <ul class="reasons">${result.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`;
  } else if (result.outcome === 'both') {
    const both = rules.outcomes.both;
    head = `
      <span class="eyebrow">Your result</span>
      <h1 tabindex="-1" data-result-heading>${esc(both.headline)}</h1>
      <div class="confidence"><span>Confidence: <strong>Borderline</strong></span><span class="confidence-bar" aria-hidden="true"><span class="on"></span><span></span><span></span></span></div>
      <p class="lede">${esc(both.summary ?? '')}</p>`;
    body += `<section class="result-block"><h2>What would tip it</h2><ul class="reasons">${both.tipIt.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <div class="btn-row" style="margin-top:20px"><a class="text-link" href="/sage-intacct-or-sage-x3/">Read the full Sage Intacct or Sage X3 guide ${iconSvg('arrow-right', 16)}</a></div></section>`;
  } else if (result.outcome === 'not-sage') {
    const ns = rules.outcomes['not-sage'];
    head = `
      <span class="eyebrow">Your result</span>
      <h1 tabindex="-1" data-result-heading>${esc(ns.headline)}</h1>
      <p class="lede">${esc(ns.summary ?? '')}</p>`;
    body += `<section class="result-block"><h2>What to consider instead</h2><ul class="reasons">${ns.consider.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>`;
  } else {
    const te = rules.outcomes['too-early'];
    head = `
      <span class="eyebrow">Your result</span>
      <h1 tabindex="-1" data-result-heading>${esc(te.headline)}</h1>
      <p class="lede">${esc(te.summary ?? '')}</p>`;
    body += `<section class="result-block"><h2>Signals that it is time to move</h2><ul class="reasons">${te.signals.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <p style="margin-top:20px"><a class="text-link" href="${esc(te.guide.href)}">${esc(te.guide.label)} ${iconSvg('arrow-right', 16)}</a></p></section>`;
  }

  const showFit = result.outcome !== 'not-sage';
  if (showFit) {
    body += `<section class="result-block"><h2>Fit profile</h2>${fitTable(result, result.product)}</section>`;
  }
  if (result.gaps.length) {
    body += `<section class="result-block"><h2>Gaps to plan for</h2>${itemsHtml(result.gaps, 'result-gap')}</section>`;
  }
  if (result.constraints.length) {
    body += `<section class="result-block"><h2>Constraints</h2>${itemsHtml(result.constraints, 'result-constraint')}</section>`;
  }
  body += `<section class="result-block" id="questions">
    <div class="section-head"><h2>Questions to ask any supplier</h2><button type="button" class="btn btn-ghost no-print" data-print>${iconSvg('printer', 16)}Print this page</button></div>
    <ol class="questions-list">${result.questionsToAsk.map((q) => `<li>${esc(q)}</li>`).join('')}</ol></section>`;
  body += `<section class="result-block">${reportForm()}
    <div class="btn-row" style="margin-top:20px"><span class="muted small">Or:</span>${cta}${restart}</div></section>`;

  return `<div class="result" data-result data-outcome="${result.outcome}"><div class="result-block result-head">${head}</div>${body}</div>`;
}
