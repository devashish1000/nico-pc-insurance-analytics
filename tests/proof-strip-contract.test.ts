import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCEPTANCE_CASES } from '../src/lib/acceptance';

const proofSource = readFileSync(new URL('../src/lib/proof.ts', import.meta.url), 'utf8');
const stripSource = readFileSync(new URL('../src/components/ProofStrip.tsx', import.meta.url), 'utf8');
const heroSource = readFileSync(new URL('../src/components/LandingHero.tsx', import.meta.url), 'utf8');

describe('dynamic hiring-manager proof strip', () => {
  it('verifies all ten acceptance cases and fetches public evidence in parallel', () => {
    expect(ACCEPTANCE_CASES).toHaveLength(10);
    expect(proofSource).toContain('Promise.all(ACCEPTANCE_CASES.map(executeAcceptance))');
    expect(proofSource).toContain('Promise.allSettled([');
    expect(proofSource).toContain('verifyAcceptance()');
    expect(proofSource).toContain('verifyDataQuality()');
    expect(proofSource).toContain('verifyPipelineRuns()');
  });

  it('derives quality, acceptance, and run counts instead of displaying fixed claims', () => {
    expect(proofSource).toContain('value: `${passed}/${total}`');
    expect(proofSource).toContain('value: `${passed}/${rows.length}`');
    expect(proofSource).toContain('value: `${successful} of ${rows.length}`');
    expect(stripSource).not.toMatch(/<strong>\s*(6\/6|10\/10|7 of 7)\s*<\/strong>/);
  });

  it('exposes honest loading, retry, and partial-failure states', () => {
    expect(stripSource).toContain("value: 'Verifying…'");
    expect(stripSource).toContain('Verify again');
    expect(stripSource).toContain("snapshot?.degraded ? 'attention' : 'success'");
    expect(stripSource).toContain("key={id}");
    expect(stripSource).not.toContain('key={metric.label}');
    expect(stripSource).toContain("!snapshot ? 'Checking live evidence'");
    expect(proofSource).toContain("value: 'Unavailable'");
    expect(proofSource).toContain("metric.state !== 'success'");
  });

  it('uses the exact dual-role NICO framing', () => {
    expect(heroSource).toContain('Data Engineer R14634 · IT Business Analyst');
    expect(heroSource).toContain('Built for NICO data and cross-functional IT teams.');
    expect(heroSource).toContain('Explore Data Engineer R14634');
    expect(heroSource).toContain('Explore IT Business Analyst');
  });
});
