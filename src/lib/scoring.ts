// Pure selector engine: score(answers, rules) => Result.
// No DOM, no network. Used by the Selector island, the decision guide page
// and the /api/report function, so the three can never disagree.

export type Product = 'intacct' | 'x3';
export type Outcome = 'intacct' | 'x3' | 'both' | 'not-sage' | 'too-early';
export type Confidence = 'strong' | 'moderate' | 'borderline';
export type FitState = 'strong' | 'possible' | 'gap' | 'neutral';
export type Severity = 'gap' | 'possible' | 'constraint' | 'note';

/** A single-select answer is a one-item array; unanswered questions are absent. */
export type Answers = Record<string, string[]>;

/** Array = answer is any of these values. { only } = every selected value is in the list. */
export type Condition = Record<string, string[] | { only: string[] }>;

export interface Option {
  id: string;
  label: string;
  weights: Record<Product, number>;
  reason?: Partial<Record<Product, string>>;
}

export interface Question {
  id: string;
  text: string;
  helper?: string;
  type: 'single' | 'multi';
  showIf?: Record<string, string[]>;
  exclusive?: string[];
  options: Option[];
}

export interface RuleLink {
  type: 'internal' | 'mysoft' | 'anchor';
  href?: string;
  key?: string;
  label: string;
}

export interface GapRule {
  id: string;
  when: Condition;
  severity: Severity;
  issue: string;
  action: string;
  link?: RuleLink;
  verify?: boolean;
}

export interface FitRow {
  area: string;
  intacct: { state: FitState; label: string };
  x3: { state: FitState; label: string };
}

export interface Rules {
  version: string;
  questions: Question[];
  hardRules: { id: string; when: Condition; force: Product; reason: string }[];
  overrides: { id: string; when: Condition; outcome: 'not-sage' | 'too-early' }[];
  caps: {
    id: string;
    when: Condition;
    maxConfidence: Confidence;
    constraint: { issue: string; action: string; link?: RuleLink };
  }[];
  gaps: GapRule[];
  fitProfile: FitRow[];
  questionsToAsk: string[];
  outcomes: {
    thresholds: { strong: number; moderate: number };
    intacct: ProductOutcomeCopy;
    x3: ProductOutcomeCopy;
    both: OutcomeCopy & { tipIt: string[] };
    'not-sage': OutcomeCopy & { consider: string[] };
    'too-early': OutcomeCopy & { signals: string[]; guide: { href: string; label: string } };
  };
}

interface OutcomeCopy {
  headline: string;
  ctaLink: string;
  ctaLabel: string;
  summary?: string;
}
interface ProductOutcomeCopy extends OutcomeCopy {
  defaultReasons: string[];
}

export interface ResultItem {
  id: string;
  severity: Severity;
  issue: string;
  action: string;
  link?: RuleLink;
}

export interface Result {
  outcome: Outcome;
  product: Product | null;
  confidence: Confidence | null;
  scores: Record<Product, number>;
  margin: number;
  reasons: string[];
  fitProfile: FitRow[];
  gaps: ResultItem[];
  constraints: ResultItem[];
  questionsToAsk: string[];
  ctaLink: string;
  appliedRules: string[];
}

const CONFIDENCE_ORDER: Confidence[] = ['borderline', 'moderate', 'strong'];

/** Which questions apply given the answers so far (handles showIf). */
export function visibleQuestions(answers: Answers, rules: Rules): Question[] {
  return rules.questions.filter((q) => {
    if (!q.showIf) return true;
    return Object.entries(q.showIf).every(([qid, values]) =>
      (answers[qid] ?? []).some((v) => values.includes(v)),
    );
  });
}

export function matches(when: Condition, answers: Answers, result?: Outcome): boolean {
  return Object.entries(when).every(([key, cond]) => {
    const selected = key === 'result' ? (result ? [result] : []) : answers[key] ?? [];
    if (selected.length === 0) return false;
    if (Array.isArray(cond)) return selected.some((v) => cond.includes(v));
    return selected.every((v) => cond.only.includes(v));
  });
}

function confidenceFor(margin: number, rules: Rules): Confidence {
  const { strong, moderate } = rules.outcomes.thresholds;
  if (margin >= strong) return 'strong';
  if (margin >= moderate) return 'moderate';
  return 'borderline';
}

function capConfidence(c: Confidence, max: Confidence): Confidence {
  return CONFIDENCE_ORDER.indexOf(c) > CONFIDENCE_ORDER.indexOf(max) ? max : c;
}

function reasonsFor(product: Product, answers: Answers, rules: Rules, lead?: string): string[] {
  const scored: { text: string; weight: number }[] = [];
  for (const q of visibleQuestions(answers, rules)) {
    for (const id of answers[q.id] ?? []) {
      const opt = q.options.find((o) => o.id === id);
      const text = opt?.reason?.[product];
      if (opt && text && opt.weights[product] > 0) scored.push({ text, weight: opt.weights[product] });
    }
  }
  scored.sort((a, b) => b.weight - a.weight);
  const out: string[] = lead ? [lead] : [];
  for (const r of [...scored.map((s) => s.text), ...rules.outcomes[product].defaultReasons]) {
    if (out.length >= 3) break;
    if (!out.includes(r)) out.push(r);
  }
  return out;
}

/** Drop answers to questions the buyer can no longer see (e.g. after changing question 1). */
export function pruneAnswers(answers: Answers, rules: Rules): Answers {
  const out: Answers = {};
  for (const q of visibleQuestions(answers, rules)) if (answers[q.id]?.length) out[q.id] = answers[q.id];
  return out;
}

export function score(input: Answers, rules: Rules): Result {
  const applied: string[] = [];
  const answers = pruneAnswers(input, rules);
  const visible = visibleQuestions(answers, rules);
  const scores: Record<Product, number> = { x3: 0, intacct: 0 };

  for (const q of visible) {
    for (const id of answers[q.id] ?? []) {
      const opt = q.options.find((o) => o.id === id);
      if (!opt) continue;
      scores.x3 += opt.weights.x3;
      scores.intacct += opt.weights.intacct;
    }
  }
  const margin = Math.abs(scores.x3 - scores.intacct);

  // 1. Hard rules first; the first matching rule wins.
  let outcome: Outcome;
  let product: Product | null;
  let confidence: Confidence | null;
  let leadReason: string | undefined;
  const hard = rules.hardRules.find((r) => matches(r.when, answers));
  if (hard) {
    applied.push(hard.id);
    product = hard.force;
    outcome = hard.force;
    confidence = 'strong';
    leadReason = hard.reason;
  } else {
    // 2 and 3. Sum weights and compare the margin with the thresholds.
    confidence = confidenceFor(margin, rules);
    if (confidence === 'borderline') {
      outcome = 'both';
      product = null;
    } else {
      product = scores.x3 > scores.intacct ? 'x3' : 'intacct';
      outcome = product;
    }
  }

  // 4. Not-Sage and too-early triggers override the scored outcome.
  const override = rules.overrides.find((r) => matches(r.when, answers));
  if (override) {
    applied.push(override.id);
    outcome = override.outcome;
    product = null;
    confidence = null;
  }

  const constraints: ResultItem[] = [];

  // Confidence caps (C1) apply to product outcomes only.
  if (product && confidence) {
    for (const cap of rules.caps) {
      if (!matches(cap.when, answers)) continue;
      applied.push(cap.id);
      confidence = capConfidence(confidence, cap.maxConfidence);
      constraints.push({ id: cap.id, severity: 'constraint', ...cap.constraint });
    }
  }

  // 5. Gap and constraint rules against the answers and the outcome.
  const gaps: ResultItem[] = [];
  for (const g of rules.gaps) {
    if (!matches(g.when, answers, outcome)) continue;
    const item: ResultItem = { id: g.id, severity: g.severity, issue: g.issue, action: g.action, link: g.link };
    (g.severity === 'constraint' ? constraints : gaps).push(item);
  }

  let reasons: string[] = [];
  if (product) reasons = reasonsFor(product, answers, rules, leadReason);
  else if (outcome === 'both') reasons = rules.outcomes.both.tipIt.slice(0, 3);

  const ctaLink = rules.outcomes[outcome].ctaLink;

  return {
    outcome,
    product,
    confidence,
    scores,
    margin,
    reasons,
    fitProfile: rules.fitProfile,
    gaps,
    constraints,
    questionsToAsk: rules.questionsToAsk,
    ctaLink,
    appliedRules: applied,
  };
}

// URL state: ?a=make,manufacture,2-5,... positional by question order, multi joined by "+".
export function encodeAnswers(answers: Answers, rules: Rules): string {
  const parts = rules.questions.map((q) => (answers[q.id] ?? []).join('+'));
  while (parts.length && parts[parts.length - 1] === '') parts.pop();
  return parts.join(',');
}

export function decodeAnswers(value: string | null, rules: Rules): Answers {
  const answers: Answers = {};
  if (!value) return answers;
  value.split(',').forEach((part, i) => {
    const q = rules.questions[i];
    if (!q || !part) return;
    const valid = part.split('+').filter((id) => q.options.some((o) => o.id === id));
    if (valid.length === 0) return;
    answers[q.id] = q.type === 'single' ? valid.slice(0, 1) : Array.from(new Set(valid));
  });
  return answers;
}
