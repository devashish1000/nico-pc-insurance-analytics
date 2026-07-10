import { describe, expect, it } from 'vitest';
import { ACCEPTANCE_CASES, executeAcceptance } from '../src/lib/acceptance';

describe('deterministic acceptance cases', () => {
  it('passes all six rating-engine cases', async () => {
    const results = await Promise.all(ACCEPTANCE_CASES.slice(0, 6).map(executeAcceptance));
    expect(results.map((result) => result.status)).toEqual(Array(6).fill('pass'));
  });
});

