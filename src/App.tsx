import { Github, Menu, Play, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import BrandMark from './components/BrandMark';
import GuidedTour from './components/GuidedTour';
import LandingHero from './components/LandingHero';
import { defaultView, isPersona, isView, navigationFor, type Persona, type View } from './lib/navigation';
import AzureMapping from './pc/AzureMapping';
import DataQuality from './pc/DataQuality';
import LinesOfBusiness from './pc/LinesOfBusiness';
import Overview from './pc/Overview';
import PipelineRuns from './pc/PipelineRuns';
import RatingEngine from './pc/RatingEngine';
import Requirements from './pc/Requirements';
import Warehouse from './pc/Warehouse';

const params = () => new URLSearchParams(window.location.search);

function initialPersona(): Persona | null {
  const value = params().get('persona');
  return isPersona(value) ? value : null;
}

function initialView(persona: Persona | null): View {
  const value = params().get('view');
  if (isView(value)) return value;
  return persona ? defaultView(persona) : 'overview';
}

export default function App() {
  const [persona, setPersona] = useState<Persona | null>(initialPersona);
  const [view, setView] = useState<View>(() => initialView(initialPersona()));
  const [testId, setTestId] = useState(() => params().get('test') ?? undefined);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const effectivePersona: Persona = persona ?? 'data-engineer';
  const nav = useMemo(() => navigationFor(effectivePersona), [effectivePersona]);
  const groups = useMemo(() => [...new Set(nav.map((item) => item.group))], [nav]);

  useEffect(() => {
    const handlePopState = () => {
      const nextPersona = initialPersona();
      setPersona(nextPersona);
      setView(initialView(nextPersona));
      setTestId(params().get('test') ?? undefined);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const writeUrl = (nextPersona: Persona, nextView: View, nextTest?: string) => {
    const search = new URLSearchParams({ persona: nextPersona, view: nextView });
    if (nextTest) search.set('test', nextTest);
    window.history.pushState({}, '', `${window.location.pathname}?${search.toString()}`);
  };

  const selectPersona = (nextPersona: Persona) => {
    const nextView = defaultView(nextPersona);
    setPersona(nextPersona);
    setView(nextView);
    setTestId(undefined);
    writeUrl(nextPersona, nextView);
    window.setTimeout(() => document.getElementById('platform')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const navigate = (nextView: View, nextTest?: string) => {
    const activePersona = persona ?? effectivePersona;
    if (!persona) setPersona(activePersona);
    setView(nextView);
    setTestId(nextTest);
    setMobileOpen(false);
    writeUrl(activePersona, nextView, nextTest);
    window.scrollTo({ top: document.getElementById('platform')?.offsetTop ?? 0, behavior: 'smooth' });
  };

  const renderView = () => {
    switch (view) {
      case 'overview': return <Overview />;
      case 'lob': return <LinesOfBusiness />;
      case 'warehouse': return <Warehouse />;
      case 'pipeline': return <PipelineRuns />;
      case 'dq': return <DataQuality />;
      case 'rating': return <RatingEngine testId={testId} />;
      case 'requirements': return <Requirements onNavigate={navigate} />;
      case 'azure': return <AzureMapping />;
    }
  };

  return (
    <div className="app-shell">
      <header className="global-header">
        <a className="brand-lockup" href="/" aria-label="P&C Insurance Analytics Platform home">
          <BrandMark />
          <span><strong>P&amp;C Insurance Analytics Platform</strong><small>Data warehouse work sample · Dev Neupane</small></span>
        </a>
        <div className="header-actions">
          <span className="synthetic-note">Synthetic data · no PII</span>
          <a className="source-link" href="https://github.com/devashish1000/nico-pc-insurance-analytics" target="_blank" rel="noreferrer"><Github size={16} /> Source</a>
          <button className="mobile-menu-button" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMobileOpen((open) => !open)}>{mobileOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      <LandingHero persona={persona} onSelect={selectPersona} />

      <section id="platform" className="platform-shell">
        <aside className={mobileOpen ? 'platform-nav open' : 'platform-nav'} aria-label="Platform navigation">
          <div className="persona-control">
            <span>View as</span>
            <select value={effectivePersona} onChange={(event) => selectPersona(event.target.value as Persona)} aria-label="Hiring perspective">
              <option value="data-engineer">Data Engineer</option>
              <option value="business-analyst">Business Analyst</option>
            </select>
          </div>
          {groups.map((group) => (
            <div className="nav-group" key={group}>
              <span>{group}</span>
              {nav.filter((item) => item.group === group).map(({ id, label, icon: Icon }) => (
                <button key={id} className={view === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={18} />{label}</button>
              ))}
            </div>
          ))}
          <button className="replay-tour" onClick={() => setTourOpen(true)}><RotateCcw size={17} /> Replay tour</button>
        </aside>

        <div className="mobile-platform-bar">
          <label><span>View as</span><select value={effectivePersona} onChange={(event) => selectPersona(event.target.value as Persona)}><option value="data-engineer">Data Engineer</option><option value="business-analyst">Business Analyst</option></select></label>
          <button onClick={() => setMobileOpen(true)}><Menu size={19} /> Explore</button>
        </div>

        <main className="platform-content">
          <div className="mobile-quick-actions"><button onClick={() => setTourOpen(true)}><Play size={16} /> Start tour</button><button onClick={() => navigate('pipeline')}><Play size={16} /> Run pipeline</button></div>
          {renderView()}
        </main>
      </section>

      <footer className="site-footer"><span>P&amp;C Insurance Analytics Platform</span><span>Synthetic P&amp;C data · Supabase Postgres · React + Vite</span><span>Built by Dev Neupane</span></footer>

      {tourOpen && <GuidedTour persona={effectivePersona} onNavigate={navigate} onClose={() => setTourOpen(false)} />}
    </div>
  );
}
