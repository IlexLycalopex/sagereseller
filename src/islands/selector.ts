// Selector island. Runs entirely in the browser; answers leave the browser only
// when the buyer asks for the emailed report.
import { rules } from '../lib/rules';
import { decodeAnswers, encodeAnswers, pruneAnswers, score, visibleQuestions, type Answers } from '../lib/scoring';
import { questionCard, resultView } from './render';
import { track } from '../scripts/analytics';
import { iconSvg } from '../lib/icons';

type Step = number | 'result';
const SELECTOR_PATH = '/which-sage/';
const FREE_MAIL = ['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'live.co.uk', 'icloud.com', 'aol.com', 'btinternet.com', 'proton.me', 'protonmail.com'];

function readUrl(): { answers: Answers; step: Step } {
  const p = new URLSearchParams(location.search);
  const answers = decodeAnswers(p.get('a'), rules);
  const s = p.get('step');
  const total = visibleQuestions(answers, rules).length;
  let step: Step = s === 'result' ? 'result' : Math.min(Math.max(parseInt(s ?? '1', 10) || 1, 1), total);
  // Never show a result for an incomplete run: send the buyer to the first gap.
  if (step === 'result') {
    const firstMissing = visibleQuestions(answers, rules).findIndex((q) => !answers[q.id]?.length);
    if (firstMissing >= 0) step = firstMissing + 1;
  }
  return { answers, step };
}

function urlFor(answers: Answers, step: Step): string {
  const a = encodeAnswers(answers, rules);
  const qs = new URLSearchParams();
  if (a) qs.set('a', a);
  qs.set('step', String(step));
  return `${SELECTOR_PATH}?${qs.toString().replace(/%2C/g, ',')}`;
}

// Capture landing UTMs once per session so the report request can carry them.
function captureUtm() {
  try {
    const p = new URLSearchParams(location.search);
    const utm: Record<string, string> = {};
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const v = p.get(k);
      if (v) utm[k] = v;
    }
    if (Object.keys(utm).length && !sessionStorage.getItem('sbg-utm')) sessionStorage.setItem('sbg-utm', JSON.stringify(utm));
  } catch { /* storage unavailable */ }
}
function storedUtm(): Record<string, string> {
  try { return JSON.parse(sessionStorage.getItem('sbg-utm') ?? '{}'); } catch { return {}; }
}

class Selector {
  root: HTMLElement;
  entry: 'hero' | 'page';
  answers: Answers = {};
  step: Step = 1;
  started = false;
  live: HTMLElement;
  /** Where the question card lives. On the page, the result replaces the whole root. */
  slot: HTMLElement;
  pageIntro: HTMLElement[];

  constructor(root: HTMLElement) {
    this.root = root;
    this.entry = (root.dataset.entry as 'hero' | 'page') ?? 'page';
    this.slot = root.querySelector<HTMLElement>('[data-card-slot]') ?? root;
    this.pageIntro = [...document.querySelectorAll<HTMLElement>('[data-selector-intro]')];
    this.live = document.createElement('div');
    this.live.className = 'visually-hidden';
    this.live.setAttribute('aria-live', 'polite');
    root.appendChild(this.live);

    if (this.entry === 'page') {
      const s = readUrl();
      this.answers = s.answers;
      this.step = s.step;
      history.replaceState({ sbg: true }, '', urlFor(this.answers, this.step));
      window.addEventListener('popstate', () => {
        const s2 = readUrl();
        this.answers = s2.answers;
        this.step = s2.step;
        this.render(true);
      });
    } else {
      window.addEventListener('popstate', () => {
        if (location.pathname === SELECTOR_PATH) {
          const s2 = readUrl();
          this.answers = s2.answers;
          this.step = s2.step;
        } else {
          this.step = 1;
        }
        this.render(true);
      });
    }

    this.slot.addEventListener('click', (e) => this.onClick(e));
    this.slot.addEventListener('keydown', (e) => this.onKey(e));
    this.slot.addEventListener('submit', (e) => this.onSubmit(e));
    this.render(false);
  }

  get questions() {
    return visibleQuestions(this.answers, rules);
  }

  render(focus: boolean) {
    if (this.step === 'result') {
      if (this.entry === 'hero') {
        location.assign(urlFor(this.answers, 'result'));
        return;
      }
      const result = score(this.answers, rules);
      this.pageIntro.forEach((el) => (el.hidden = true));
      this.slot.innerHTML = resultView(result, rules);
      this.mountTurnstile();
      const key = encodeAnswers(this.answers, rules);
      try {
        if (sessionStorage.getItem('sbg-complete') !== key) {
          sessionStorage.setItem('sbg-complete', key);
          track('selector_complete', { outcome: result.outcome, confidence: result.confidence ?? 'n/a' });
        }
      } catch { /* ignore */ }
      if (focus) this.slot.querySelector<HTMLElement>('[data-result-heading]')?.focus();
      window.scrollTo({ top: 0 });
      document.title = `${rules.outcomes[result.outcome].headline} | The Sage Buyer's Guide`;
      return;
    }
    this.pageIntro.forEach((el) => (el.hidden = false));
    const qs = this.questions;
    const idx = Math.min(this.step, qs.length);
    const q = qs[idx - 1];
    this.slot.innerHTML = questionCard({ question: q, index: idx, total: qs.length, answers: this.answers, entry: this.entry });
    if (focus) {
      this.slot.querySelector<HTMLElement>('.selector-q')?.focus({ preventScroll: true });
      this.live.textContent = `Question ${idx} of ${qs.length}`;
      const card = this.slot.querySelector<HTMLElement>('[data-card]');
      if (card && card.getBoundingClientRect().top < 0) card.scrollIntoView({ block: 'start' });
    }
  }

  go(step: Step) {
    // Record the latest answers on the current entry first, so Back restores them.
    // The hero's first entry is the home page, which keeps its own URL.
    if (location.pathname === SELECTOR_PATH) history.replaceState({ sbg: true }, '', urlFor(this.answers, this.step));
    this.step = step;
    if (!(this.entry === 'hero' && step === 'result')) history.pushState({ sbg: true }, '', urlFor(this.answers, step));
    this.render(true);
  }

  currentQuestion() {
    return this.questions[(this.step as number) - 1];
  }

  advance() {
    const q = this.currentQuestion();
    this.answers = pruneAnswers(this.answers, rules);
    if (!this.started) {
      this.started = true;
      track('selector_start', { entry: this.entry });
    }
    track('selector_step', { step: this.step, question_id: q.id });
    const qs = this.questions;
    const next = (this.step as number) + 1;
    this.go(next > qs.length ? 'result' : next);
  }

  onClick(e: Event) {
    const t = e.target as HTMLElement;
    const opt = t.closest<HTMLButtonElement>('[data-option]');
    if (opt) return this.choose(opt);
    if (t.closest('[data-back]')) {
      if (typeof this.step === 'number' && this.step > 1) history.back();
      return;
    }
    if (t.closest('[data-continue]')) {
      const q = this.currentQuestion();
      if (!this.answers[q.id]?.length) {
        const err = this.slot.querySelector<HTMLElement>('[data-card-error]');
        if (err) { err.hidden = false; err.textContent = 'Choose at least one option to continue.'; }
        return;
      }
      return this.advance();
    }
    if (t.closest('[data-restart]')) {
      this.answers = {};
      try { sessionStorage.removeItem('sbg-complete'); } catch { /* ignore */ }
      return this.go(1);
    }
    if (t.closest('[data-print]')) window.print();
  }

  choose(btn: HTMLButtonElement) {
    const q = this.currentQuestion();
    const id = btn.dataset.option!;
    if (q.type === 'single') {
      this.answers = { ...this.answers, [q.id]: [id] };
      btn.setAttribute('aria-checked', 'true');
      // Brief visual confirmation before advancing, skipped for reduced motion.
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => this.advance(), reduce ? 0 : 140);
      return;
    }
    const cur = new Set(this.answers[q.id] ?? []);
    const exclusive = (q.exclusive ?? []).includes(id);
    if (cur.has(id)) cur.delete(id);
    else {
      if (exclusive) cur.clear();
      else for (const x of q.exclusive ?? []) cur.delete(x);
      cur.add(id);
    }
    this.answers = { ...this.answers, [q.id]: [...cur] };
    this.slot.querySelectorAll<HTMLButtonElement>('[data-option]').forEach((b) => {
      const on = cur.has(b.dataset.option!);
      b.setAttribute('aria-checked', String(on));
      const box = b.querySelector('.box');
      if (box) box.innerHTML = on ? iconSvg('check', 12) : '';
    });
    const cont = this.slot.querySelector('[data-continue]');
    if (cur.size) cont?.removeAttribute('aria-disabled');
    else cont?.setAttribute('aria-disabled', 'true');
    const err = this.slot.querySelector<HTMLElement>('[data-card-error]');
    if (err) err.hidden = true;
  }

  onKey(e: KeyboardEvent) {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[role="radio"]');
    if (!btn) return;
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const all = [...this.slot.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const i = all.indexOf(btn);
    let n = i;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (i + 1) % all.length;
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (i - 1 + all.length) % all.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = all.length - 1;
    all.forEach((b, j) => (b.tabIndex = j === n ? 0 : -1));
    all[n].focus();
  }

  // Report request

  turnstileId: string | null = null;

  mountTurnstile() {
    const el = this.slot.querySelector<HTMLElement>('[data-turnstile]');
    if (!el) return;
    const w = window as unknown as { turnstile?: { render: (el: HTMLElement, o: object) => string; getResponse: (id: string) => string; reset: (id: string) => void }; onTurnstileLoad?: () => void };
    const doRender = () => {
      this.turnstileId = w.turnstile!.render(el, { sitekey: el.dataset.sitekey, theme: 'light', appearance: 'interaction-only' });
    };
    if (w.turnstile) return doRender();
    w.onTurnstileLoad = doRender;
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
    s.async = true;
    document.head.appendChild(s);
  }

  async onSubmit(e: Event) {
    const form = (e.target as HTMLElement).closest<HTMLFormElement>('[data-report-form]');
    if (!form) return;
    e.preventDefault();
    const get = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value.trim() ?? '';
    const setErr = (id: string, msg: string) => {
      const input = form.querySelector<HTMLInputElement>(`#rf-${id}`)!;
      const err = form.querySelector<HTMLElement>(`#rf-${id}-err`)!;
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg) input.setAttribute('aria-describedby', `rf-${id}-err`);
      else input.removeAttribute('aria-describedby');
      err.hidden = !msg;
      err.innerHTML = msg ? `${iconSvg('alert', 14)}${msg}` : '';
      return !msg;
    };
    const email = get('email');
    const checks = [
      setErr('name', get('name') ? '' : 'Enter your name so we can address the report.'),
      setErr('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Enter a work email address so we can send the report.'),
      setErr('company', get('company') ? '' : 'Enter your company name.'),
      setErr('role', get('role') ? '' : 'Choose the role closest to yours.'),
    ];
    const hint = form.querySelector<HTMLElement>('#rf-email-hint')!;
    const domain = email.split('@')[1]?.toLowerCase();
    hint.hidden = !(domain && FREE_MAIL.includes(domain));
    hint.textContent = 'A work email helps us tailor the report. We will still send it to this address.';
    if (checks.includes(false)) {
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }

    const w = window as unknown as { turnstile?: { getResponse: (id: string) => string; reset: (id: string) => void } };
    const token = this.turnstileId && w.turnstile ? w.turnstile.getResponse(this.turnstileId) : '';
    const status = form.querySelector<HTMLElement>('[data-form-status]')!;
    const submit = form.querySelector<HTMLButtonElement>('[data-submit]')!;
    submit.disabled = true;
    submit.textContent = 'Sending';
    const result = score(this.answers, rules);

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: get('name'),
          email,
          company: get('company'),
          role: get('role'),
          marketingOptIn: (form.elements.namedItem('marketing') as HTMLInputElement).checked,
          answers: encodeAnswers(this.answers, rules),
          outcome: result.outcome,
          pageUrl: location.href,
          utm: storedUtm(),
          turnstileToken: token,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      track('report_requested', { outcome: result.outcome });
      status.innerHTML = `<div class="form-status ok" role="status">${iconSvg('check-circle', 20)}<div><strong>Your report is on its way.</strong><p class="text-2">Check ${email.replace(/[<>&"]/g, '')} in the next few minutes. If it has not arrived, look in your junk folder.</p></div></div>`;
      form.querySelectorAll('input, select, button[type="submit"]').forEach((el) => ((el as HTMLInputElement).disabled = true));
      submit.textContent = 'Report requested';
    } catch {
      status.innerHTML = `<div class="form-status err" role="alert">${iconSvg('alert', 20)}<div><strong>We could not send your request.</strong><p class="text-2">Your details are still here. Check your connection and select "Email me the report" again.</p></div></div>`;
      submit.disabled = false;
      submit.textContent = 'Email me the report';
      if (this.turnstileId && w.turnstile) w.turnstile.reset(this.turnstileId);
    }
  }
}

captureUtm();
document.querySelectorAll<HTMLElement>('[data-selector]').forEach((el) => new Selector(el));
