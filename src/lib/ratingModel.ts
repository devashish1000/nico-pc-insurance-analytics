// Simplified P&C rating model — demonstrates base rate × territory × tier × modifiers,
// with coverage limits, deductible credits, endorsements, discounts and surcharges.
// This mirrors how a real rating engine composes a premium and is the artifact the
// BA-facing "Rating Engine" + Requirements pages document.

export type Lob = 'PAUTO' | 'HOME' | 'CAUTO' | 'GL' | 'WC';

export const LOBS: { code: Lob; name: string; baseRate: number }[] = [
  { code: 'PAUTO', name: 'Personal Auto', baseRate: 1200 },
  { code: 'HOME', name: 'Homeowners', baseRate: 1600 },
  { code: 'CAUTO', name: 'Commercial Auto', baseRate: 5200 },
  { code: 'GL', name: 'General Liability', baseRate: 4200 },
  { code: 'WC', name: 'Workers Comp', baseRate: 6800 },
];

export const TERRITORIES: { code: string; name: string; factor: number }[] = [
  { code: 'NE', name: 'Nebraska', factor: 1.0 },
  { code: 'IA', name: 'Iowa', factor: 0.96 },
  { code: 'KS', name: 'Kansas', factor: 1.04 },
  { code: 'MO', name: 'Missouri', factor: 1.12 },
  { code: 'CO', name: 'Colorado', factor: 1.18 },
  { code: 'SD', name: 'South Dakota', factor: 0.92 },
];

// Risk tier multiplier (underwriting grade)
export const TIERS: { code: string; name: string; factor: number }[] = [
  { code: 'PREF', name: 'Preferred', factor: 0.85 },
  { code: 'STD', name: 'Standard', factor: 1.0 },
  { code: 'SUB', name: 'Substandard', factor: 1.35 },
];

export const LIMIT_FACTORS: { code: string; name: string; factor: number }[] = [
  { code: 'L1', name: '$100K / $300K', factor: 1.0 },
  { code: 'L2', name: '$250K / $500K', factor: 1.18 },
  { code: 'L3', name: '$500K / $1M', factor: 1.35 },
  { code: 'L4', name: '$1M / $2M', factor: 1.6 },
];

// Higher deductible => premium credit
export const DEDUCTIBLES: { code: string; name: string; credit: number }[] = [
  { code: 'D500', name: '$500', credit: 0 },
  { code: 'D1000', name: '$1,000', credit: 0.05 },
  { code: 'D2500', name: '$2,500', credit: 0.11 },
  { code: 'D5000', name: '$5,000', credit: 0.18 },
];

export const ENDORSEMENTS: { code: string; name: string; premium: number }[] = [
  { code: 'EQ', name: 'Equipment breakdown', premium: 140 },
  { code: 'CY', name: 'Cyber liability', premium: 320 },
  { code: 'UM', name: 'Uninsured motorist', premium: 95 },
  { code: 'FL', name: 'Flood extension', premium: 260 },
];

export const DISCOUNTS: { code: string; name: string; factor: number }[] = [
  { code: 'MULTI', name: 'Multi-policy', factor: 0.9 },
  { code: 'CLAIMFREE', name: 'Claim-free (3 yrs)', factor: 0.93 },
  { code: 'PAYFULL', name: 'Paid-in-full', factor: 0.97 },
];

export type RatingInput = {
  lob: Lob;
  territory: string;
  tier: string;
  limit: string;
  deductible: string;
  endorsements: string[];
  discounts: string[];
  priorClaims: number; // surcharge driver
};

export type RatingStep = { label: string; detail: string; running: number };
export type RatingResult = { steps: RatingStep[]; annualPremium: number; monthly: number };

export function rate(input: RatingInput): RatingResult {
  const lob = LOBS.find((l) => l.code === input.lob)!;
  const terr = TERRITORIES.find((t) => t.code === input.territory)!;
  const tier = TIERS.find((t) => t.code === input.tier)!;
  const limit = LIMIT_FACTORS.find((l) => l.code === input.limit)!;
  const ded = DEDUCTIBLES.find((d) => d.code === input.deductible)!;

  const steps: RatingStep[] = [];
  let running = lob.baseRate;
  steps.push({ label: 'Base rate', detail: lob.name, running });

  running *= terr.factor;
  steps.push({ label: 'Territory factor', detail: `${terr.name} ×${terr.factor}`, running });

  running *= tier.factor;
  steps.push({ label: 'Risk tier', detail: `${tier.name} ×${tier.factor}`, running });

  running *= limit.factor;
  steps.push({ label: 'Limit factor', detail: `${limit.name} ×${limit.factor}`, running });

  const dedCredit = running * ded.credit;
  running -= dedCredit;
  steps.push({ label: 'Deductible credit', detail: `${ded.name} −${(ded.credit * 100).toFixed(0)}%`, running });

  // prior-claims surcharge: +12% per claim, capped at +60%
  const surchargeFactor = 1 + Math.min(0.6, input.priorClaims * 0.12);
  running *= surchargeFactor;
  steps.push({
    label: 'Prior-claims surcharge',
    detail: `${input.priorClaims} claim(s) ×${surchargeFactor.toFixed(2)}`,
    running,
  });

  // discounts (multiplicative)
  input.discounts.forEach((dc) => {
    const d = DISCOUNTS.find((x) => x.code === dc);
    if (d) {
      running *= d.factor;
      steps.push({ label: 'Discount', detail: `${d.name} ×${d.factor}`, running });
    }
  });

  // endorsements (added premium)
  input.endorsements.forEach((ec) => {
    const e = ENDORSEMENTS.find((x) => x.code === ec);
    if (e) {
      running += e.premium;
      steps.push({ label: 'Endorsement', detail: `${e.name} +$${e.premium}`, running });
    }
  });

  const annualPremium = Math.round(running);
  return { steps, annualPremium, monthly: Math.round((annualPremium / 12) * 100) / 100 };
}
