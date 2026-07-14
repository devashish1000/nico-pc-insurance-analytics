import { ArrowRight, BarChart3, BriefcaseBusiness, Database, ShieldCheck, Warehouse } from 'lucide-react';
import type { Persona } from '../lib/navigation';

const pipeline = [
  { label: 'Source', note: 'Policy · claims', icon: Database },
  { label: 'Staging', note: 'Clean · standardize', icon: BriefcaseBusiness },
  { label: 'Warehouse', note: 'Star schema', icon: Warehouse },
  { label: 'Quality', note: '6 controls', icon: ShieldCheck },
  { label: 'BI', note: 'Decision views', icon: BarChart3 },
];

export default function LandingHero({ persona, onSelect }: { persona: Persona | null; onSelect: (persona: Persona) => void }) {
  return (
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-copy">
        <span className="target-role">Data Engineer R14634 · IT Business Analyst</span>
        <h1 id="landing-title">Built for NICO data and cross-functional IT teams.</h1>
        <div className="editorial-rule" />
        <p>A live synthetic-data work sample connecting warehouse engineering, controlled recovery, quality evidence, traceable requirements, and testable business outcomes.</p>
        <div className="persona-actions" aria-label="Choose a hiring perspective">
          <button className={persona !== 'business-analyst' ? 'persona-action active' : 'persona-action'} onClick={() => onSelect('data-engineer')}>
            <Database size={19} /> Explore Data Engineer R14634
          </button>
          <button className={persona === 'business-analyst' ? 'persona-action active' : 'persona-action'} onClick={() => onSelect('business-analyst')}>
            <BarChart3 size={19} /> Explore IT Business Analyst
          </button>
        </div>
      </div>
      <div className="hero-pipeline" aria-label="Source to business intelligence pipeline">
        {pipeline.map(({ label, note, icon: Icon }, index) => (
          <div className="hero-pipeline-step" key={label}>
            <div className="pipeline-icon"><Icon size={23} /></div>
            <strong>{label}</strong>
            <span>{note}</span>
            {index < pipeline.length - 1 && <ArrowRight className="pipeline-arrow" size={22} aria-hidden="true" />}
          </div>
        ))}
      </div>
    </section>
  );
}
