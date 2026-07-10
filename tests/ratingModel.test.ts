import { describe, expect, it } from 'vitest';
import { rate, type RatingInput } from '../src/lib/ratingModel';

const input = (patch: Partial<RatingInput> = {}): RatingInput => ({
  lob: 'CAUTO', territory: 'NE', tier: 'STD', limit: 'L2', deductible: 'D500',
  endorsements: [], discounts: [], priorClaims: 0, ...patch,
});

describe('rating model', () => {
  it('reconciles base, territory, tier, and limit factors', () => {
    expect(rate(input()).annualPremium).toBe(6136);
    expect(rate(input({ territory: 'CO' })).annualPremium).toBe(7240);
  });

  it('applies the deductible credit before the multi-policy discount', () => {
    expect(rate(input({ deductible: 'D2500' })).annualPremium).toBe(5461);
    expect(rate(input({ deductible: 'D2500', discounts: ['MULTI'] })).annualPremium).toBe(4915);
  });

  it('caps the prior-claim surcharge at sixty percent', () => {
    expect(rate(input({ priorClaims: 0 })).annualPremium).toBe(6136);
    expect(rate(input({ priorClaims: 4 })).annualPremium).toBe(Math.round(6136 * 1.48));
    expect(rate(input({ priorClaims: 5 })).annualPremium).toBe(Math.round(6136 * 1.6));
  });
});

