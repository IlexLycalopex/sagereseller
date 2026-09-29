import { describe, expect, it } from 'vitest';
import { decodeAnswers, encodeAnswers, score, type Answers } from '../src/lib/scoring';
import { rules } from '../src/lib/rules';

const ids = (r: ReturnType<typeof score>) => [...r.gaps, ...r.constraints].map((g) => g.id);

// Spec D2 test fixtures.
const fixtures: { id: string; answers: Answers; outcome: string; confidence?: string | null; includes?: string[] }[] = [
  {
    id: 'F-01',
    answers: { model: ['make'], stock: ['manufacture'], entities: ['2-5'], geo: ['few'], revenue: ['oneoff'], deploy: ['cloud-pref'], current: ['sage50-200'], size: ['20-100'] },
    outcome: 'x3', confidence: 'strong', includes: ['C2'],
  },
  {
    id: 'F-02',
    answers: { model: ['services'], stock: ['none'], entities: ['6-20'], revenue: ['projects'], deploy: ['cloud'], current: ['xero-qb'], size: ['5-20'] },
    outcome: 'intacct', confidence: 'strong',
  },
  {
    id: 'F-03',
    answers: { model: ['software'], stock: ['none'], entities: ['2-5'], revenue: ['subs'], deploy: ['cloud'], current: ['xero-qb'], size: ['5-20'] },
    outcome: 'intacct', confidence: 'strong',
  },
  {
    id: 'F-04',
    answers: { model: ['distribute'], stock: ['warehouses'], entities: ['one'], revenue: ['volume'], deploy: ['cloud-pref'], current: ['older-erp'] },
    outcome: 'x3', confidence: 'strong',
  },
  {
    id: 'F-05',
    answers: { model: ['nonprofit'], stock: ['none'], entities: ['one'], revenue: ['grants'], deploy: ['cloud'], current: ['sage50-200'], size: ['5-20'] },
    outcome: 'intacct', confidence: 'strong', includes: ['F1'],
  },
  {
    id: 'F-06',
    answers: { model: ['services'], stock: ['none'], entities: ['6-20'], revenue: ['projects'], deploy: ['onprem'], size: ['20-100'] },
    outcome: 'x3', confidence: 'strong',
  },
  {
    id: 'F-07',
    answers: { model: ['services'], stock: ['none'], entities: ['one'], revenue: ['oneoff'], size: ['under5'] },
    outcome: 'too-early', confidence: null,
  },
  {
    id: 'F-08',
    answers: { model: ['distribute'], stock: ['simple'], specialist: ['retail'] },
    outcome: 'not-sage', confidence: null,
  },
  {
    id: 'F-09',
    answers: { model: ['distribute'], stock: ['simple'], entities: ['2-5'], revenue: ['subs', 'oneoff'], deploy: ['cloud-pref'] },
    outcome: 'both', confidence: 'borderline',
  },
  {
    id: 'F-10',
    answers: { model: ['make'], stock: ['manufacture'], size: ['over500'], geo: ['six'] },
    outcome: 'x3', confidence: 'moderate', includes: ['C1'],
  },
];

describe('selector fixtures (spec D2)', () => {
  for (const f of fixtures) {
    it(`${f.id} => ${f.outcome}`, () => {
      const r = score(f.answers, rules);
      expect(r.outcome).toBe(f.outcome);
      if (f.confidence !== undefined) expect(r.confidence).toBe(f.confidence);
      for (const id of f.includes ?? []) expect(ids(r)).toContain(id);
    });
  }

  it('F-06 applies hard rule H1 with its reason first', () => {
    const r = score(fixtures[5].answers, rules);
    expect(r.appliedRules).toContain('H1');
    expect(r.reasons[0]).toMatch(/only as cloud software/);
  });

  it('F-01 applies H2, not H1', () => {
    const r = score(fixtures[0].answers, rules);
    expect(r.appliedRules).toEqual(['H2']);
  });
});

describe('engine behaviour', () => {
  it('a margin of 3 to 5 gives Moderate confidence', () => {
    const r = score({ model: ['software'] }, rules); // -2 / +3, margin 5
    expect(r.outcome).toBe('intacct');
    expect(r.confidence).toBe('moderate');
  });

  it('returns three reasons for product outcomes', () => {
    for (const f of fixtures.filter((x) => x.outcome === 'x3' || x.outcome === 'intacct')) {
      expect(score(f.answers, rules).reasons).toHaveLength(3);
    }
  });

  it('ignores specialist answers when the question is hidden', () => {
    const r = score({ model: ['services'], stock: ['none'], specialist: ['retail'] }, rules);
    expect(r.outcome).not.toBe('not-sage');
  });

  it('too-early needs one-off invoicing only', () => {
    const r = score({ model: ['services'], stock: ['none'], entities: ['one'], revenue: ['oneoff', 'subs'], size: ['under5'] }, rules);
    expect(r.outcome).not.toBe('too-early');
  });

  it('flags a manufacturing gap when Intacct wins despite manufacture', () => {
    const r = score({ model: ['software'], stock: ['manufacture'], entities: ['6-20'], revenue: ['subs', 'projects'], deploy: ['cloud'], current: ['xero-qb'] }, rules);
    expect(r.outcome).toBe('intacct');
    expect(ids(r)).toContain('G1');
  });

  it('adds the tight-timeline constraint for X3 within six months', () => {
    const r = score({ model: ['make'], stock: ['manufacture'], timeline: ['6m'] }, rules);
    expect(ids(r)).toContain('C1');
  });

  it('is a pure function', () => {
    const a: Answers = { model: ['make'], stock: ['manufacture'] };
    const copy = JSON.parse(JSON.stringify(a));
    score(a, rules);
    expect(a).toEqual(copy);
    expect(score(a, rules)).toEqual(score(a, rules));
  });
});

describe('URL state', () => {
  it('round-trips answers', () => {
    for (const f of fixtures) {
      const encoded = encodeAnswers(f.answers, rules);
      expect(decodeAnswers(encoded, rules)).toEqual(f.answers);
    }
  });

  it('drops unknown option ids', () => {
    expect(decodeAnswers('make,bogus', rules)).toEqual({ model: ['make'] });
  });

  it('contains no personal data, only option ids', () => {
    expect(encodeAnswers(fixtures[0].answers, rules)).toBe('make,manufacture,2-5,few,oneoff,cloud-pref,sage50-200,20-100');
  });
});

describe('URL state survives the browser', () => {
  it('round-trips multi-select answers through URLSearchParams', () => {
    const answers: Answers = { model: ['distribute'], stock: ['simple'], revenue: ['subs', 'oneoff'] };
    const qs = new URLSearchParams({ a: encodeAnswers(answers, rules) }).toString();
    expect(decodeAnswers(new URLSearchParams(qs).get('a'), rules)).toEqual(answers);
    // Unencoded commas, as the island writes them, must also decode.
    expect(decodeAnswers(new URLSearchParams(qs.replace(/%2C/g, ',')).get('a'), rules)).toEqual(answers);
  });
});
