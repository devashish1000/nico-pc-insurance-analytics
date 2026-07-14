import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const benchmark = readFileSync(new URL('../.github/workflows/benchmark.yml', import.meta.url), 'utf8');

describe('CI and benchmark workflow contract', () => {
  it('runs application checks, pgTAP, and the 10K smoke benchmark on pull requests', () => {
    expect(ci).toContain('pull_request:');
    expect(ci).toContain('npm run typecheck');
    expect(ci).toContain('npm run lint');
    expect(ci).toContain('npm test');
    expect(ci).toContain('supabase test db supabase/tests --local');
    expect(ci).toContain('run-benchmark.mjs --mode smoke');
  });

  it('pins the Supabase CLI and validates benchmark artifacts', () => {
    expect(ci).toContain('node-version: 24');
    expect(benchmark).toContain('node-version: 24');
    expect(ci).toContain('version: 2.109.1');
    expect(benchmark).toContain('version: 2.109.1');
    expect(ci).toContain('validate-benchmark-result.mjs');
    expect(benchmark).toContain('validate-benchmark-result.mjs');
  });

  it('keeps extended mode behind manual dispatch', () => {
    expect(benchmark).toContain('workflow_dispatch:');
    expect(benchmark).toContain('- extended');
    expect(benchmark).toContain("github.event_name == 'workflow_dispatch'");
    expect(benchmark).toContain("|| 'primary'");
    expect(benchmark).not.toContain('pull_request:');
  });
});
