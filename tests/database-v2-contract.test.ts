import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contracts = JSON.parse(readFileSync(new URL('../benchmarks/contracts/v2-contracts.json', import.meta.url), 'utf8')) as {
  tables: Record<string, string>;
  functions: Record<string, string>;
  views: Record<string, string>;
  actions: string[];
  stagingMetadataColumns: string[];
  factLineageColumns: string[];
};
const objectTests = readFileSync(new URL('../supabase/tests/01000_v2_contracts.sql', import.meta.url), 'utf8');
const securityTests = readFileSync(new URL('../supabase/tests/02000_v2_security.sql', import.meta.url), 'utf8');
const quarantineBehaviorTests = readFileSync(new URL('../supabase/tests/04000_quarantine_recovery_lineage.sql', import.meta.url), 'utf8');

describe('warehouse v2 database contract', () => {
  it('keeps every agreed table and view under automated pgTAP coverage', () => {
    for (const qualifiedName of [...Object.values(contracts.tables), ...Object.values(contracts.views)]) {
      const [, objectName] = qualifiedName.split('.');
      expect(`${objectTests}\n${securityTests}`).toContain(objectName);
    }
  });

  it('locks the exact public and private function signatures', () => {
    for (const signature of Object.values(contracts.functions)) {
      expect(objectTests).toContain(signature);
    }
  });

  it('covers source metadata, fact lineage, and the action whitelist', () => {
    for (const column of [...contracts.stagingMetadataColumns, ...contracts.factLineageColumns]) {
      expect(objectTests).toContain(`'${column}'`);
    }
    expect(contracts.actions).toEqual(['run', 'simulate-failure', 'recover']);
  });

  it('protects raw operational evidence from browser roles', () => {
    expect(securityTests).toContain("not has_table_privilege('anon', 'ops.quarantine_records', 'select')");
    expect(securityTests).toContain("not has_function_privilege('authenticated', 'public.run_demo_pipeline_action(text,uuid)', 'execute')");
    expect(securityTests).toContain("column_name in ('payload', 'raw_payload', 'record_payload', 'stack_trace', 'sqlstate')");
  });

  it('locks pending quarantine ownership to the original recovery target', () => {
    expect(quarantineBehaviorTests).toContain('private.v2_quarantine_invalid_candidates');
    expect(quarantineBehaviorTests).toContain('retry run does not steal ownership');
    expect(quarantineBehaviorTests).toContain('quarantine retry does not mutate premium or loss facts');
    expect(quarantineBehaviorTests).toContain('quarantine retry does not advance or rewrite ETL watermarks');
  });
});
