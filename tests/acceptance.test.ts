import { describe, expect, it } from 'vitest';
import {
  ACCEPTANCE_CASES,
  assessCriticalQualityControls,
  executeAcceptance,
} from '../src/lib/acceptance';

describe('deterministic acceptance cases', () => {
  it('passes all six rating-engine cases', async () => {
    const results = await Promise.all(ACCEPTANCE_CASES.slice(0, 6).map(executeAcceptance));
    expect(results.map((result) => result.status)).toEqual(Array(6).fill('pass'));
  });

  it('accepts every passing critical validity and reconciliation control by category', () => {
    const result = assessCriticalQualityControls([
      { category: 'validity', severity: 'critical', status: 'pass' },
      { category: 'validity', severity: 'critical', status: 'pass' },
      { category: 'reconciliation', severity: 'critical', status: 'pass' },
      { category: 'reconciliation', severity: 'critical', status: 'pass' },
      { category: 'integrity', severity: 'critical', status: 'pass' },
    ]);
    expect(result).toEqual({ pass: true, actual: '4/4 pass' });
  });

  it('fails when a required category is missing or a critical control is not green', () => {
    expect(assessCriticalQualityControls([
      { category: 'validity', severity: 'critical', status: 'pass' },
    ]).pass).toBe(false);
    expect(assessCriticalQualityControls([
      { category: 'validity', severity: 'critical', status: 'pass' },
      { category: 'reconciliation', severity: 'critical', status: 'fail' },
    ])).toEqual({ pass: false, actual: '1/2 pass' });
  });
});
