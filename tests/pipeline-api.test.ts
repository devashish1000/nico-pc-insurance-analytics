import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from '../api/pipeline-runs';

describe('pipeline origin boundary', () => {
  it('allows production, project previews, and local development', () => {
    expect(isAllowedOrigin('https://nico-pc-insurance-analytics.vercel.app')).toBe(true);
    expect(isAllowedOrigin('https://nico-pc-insurance-analytics-abc123-devashish1000s-projects.vercel.app')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:4178')).toBe(true);
  });

  it('rejects missing and unrelated origins', () => {
    expect(isAllowedOrigin(undefined)).toBe(false);
    expect(isAllowedOrigin('https://example.com')).toBe(false);
    expect(isAllowedOrigin('https://nico-pc-insurance-analytics.attacker.example')).toBe(false);
  });
});

