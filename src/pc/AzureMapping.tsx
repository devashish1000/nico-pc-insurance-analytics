import { ArrowRight, Cloud, Database, Gauge, GitCompareArrows, LockKeyhole, Workflow } from 'lucide-react';
import { Card, SectionTitle } from './ui';

const mappings = [
  { project: 'Postgres dimensional warehouse', azure: 'Azure SQL or Synapse dimensional model', ramp: 'Translate DDL and optimization patterns into T-SQL and the target warehouse service.' },
  { project: 'PL/pgSQL stored-procedure ETL', azure: 'T-SQL procedures plus ADF or Synapse pipelines', ramp: 'Rebuild orchestration, linked services, retries, and monitoring in the team’s chosen service.' },
  { project: 'Postgres staging schema', azure: 'ADLS landing zone plus SQL staging', ramp: 'Apply the team’s file formats, medallion conventions, retention rules, and ingestion contracts.' },
  { project: 'Supabase Cron / pg_cron', azure: 'ADF triggers or scheduled Azure Functions', ramp: 'Map schedules, alerts, reruns, and on-call support into Azure Monitor and team runbooks.' },
  { project: 'Published Postgres views and REST', azure: 'Governed SQL presentation layer and APIs', ramp: 'Adopt enterprise catalog, lineage, private networking, and access-control standards.' },
  { project: 'Recharts decision dashboards', azure: 'Power BI semantic model and reports', ramp: 'Recreate measures, certified datasets, refresh policy, and audience-specific workspaces.' },
  { project: 'Postgres RLS and service roles', azure: 'SQL row-level security plus Microsoft Entra', ramp: 'Implement tenant, group, managed-identity, and least-privilege controls in the target environment.' },
];

const architecture = [
  { label: 'Sources', note: 'Policy · claims', icon: Database },
  { label: 'Ingestion', note: 'ADF / landing', icon: Workflow },
  { label: 'Warehouse', note: 'Azure SQL / Synapse', icon: Cloud },
  { label: 'Governance', note: 'Quality · security', icon: LockKeyhole },
  { label: 'Decision layer', note: 'Power BI', icon: Gauge },
];

export default function AzureMapping() {
  return (
    <div>
      <SectionTitle
        title="Azure Stack Mapping"
        subtitle="An honest translation of the demonstrated warehouse patterns into the Microsoft data stack—transferable engineering concepts, with the tooling ramp named explicitly."
        icon={<GitCompareArrows size={20} />}
      />

      <div className="honesty-note"><strong>What this page is—and is not.</strong><p>This is a transfer map, not a claim of production access to NICO systems. The project proves dimensional modeling, SQL loading, quality controls, testability, and operational thinking; Azure-specific implementation remains a focused ramp.</p></div>

      <Card className="azure-architecture">
        <span className="section-kicker">Target-state translation</span>
        <div className="azure-flow">{architecture.map(({ label, note, icon: Icon }, index) => (
          <div key={label} className="azure-step"><Icon size={23} /><strong>{label}</strong><span>{note}</span>{index < architecture.length - 1 && <ArrowRight className="azure-arrow" size={20} />}</div>
        ))}</div>
      </Card>

      <div className="mapping-table-wrap">
        <table className="mapping-table">
          <thead><tr><th>Demonstrated here</th><th>Closest Azure / NICO equivalent</th><th>What I would learn or adapt</th></tr></thead>
          <tbody>{mappings.map((row) => <tr key={row.project}><td>{row.project}</td><td>{row.azure}</td><td>{row.ramp}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
