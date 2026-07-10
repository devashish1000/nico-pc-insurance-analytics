import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const clientSource = [
  '../src/App.tsx',
  '../src/lib/supabase.ts',
  '../src/pc/PipelineRuns.tsx',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
const serverSource = readFileSync(new URL('../api/pipeline-runs.ts', import.meta.url), 'utf8');

describe('client/server secret boundary', () => {
  it('never references the service-role secret from browser code', () => {
    expect(clientSource).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(clientSource).not.toContain('service_role');
  });

  it('reads the service-role key only in the serverless function', () => {
    expect(serverSource).toContain('process.env.SUPABASE_SERVICE_ROLE_KEY');
    expect(serverSource).not.toContain('VITE_SUPABASE_SERVICE_ROLE_KEY');
  });
});
