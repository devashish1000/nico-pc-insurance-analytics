import { Github, Menu, Play, RotateCcw, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import BrandMark from './components/BrandMark';
import LandingHero from './components/LandingHero';
import ProofStrip from './components/ProofStrip';
import {
  defaultDeliveryTab,
  defaultView,
  isDeliveryTab,
  isPersona,
  isView,
  navigationFor,
  type DeliveryTab,
  type Persona,
  type View,
} from './lib/navigation';

const AzureMapping = lazy(() => import('./pc/AzureMapping'));
const DataQuality = lazy(() => import('./pc/DataQuality'));
const DeliveryHub = lazy(() => import('./pc/DeliveryHub'));
const GuidedTour = lazy(() => import('./components/GuidedTour'));
const LinesOfBusiness = lazy(() => import('./pc/LinesOfBusiness'));
const Overview = lazy(() => import('./pc/Overview'));
const PipelineRuns = lazy(() => import('./pc/PipelineRuns'));
const RatingEngine = lazy(() => import('./pc/RatingEngine'));
const Requirements = lazy(() => import('./pc/Requirements'));
const Warehouse = lazy(() => import('./pc/Warehouse'));

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

function initialDeliveryTab(): DeliveryTab {
  const value = params().get('tab');
  return isDeliveryTab(value) ? value : defaultDeliveryTab;
}

function ViewFallback() {
  return (
    <div className="view-loading" role="status" aria-live="polite">
      <span />
      <span />
      <p>Loading evidence…</p>
    </div>
  );
}

export default function App() {
  const startingPersona = initialPersona();
  const [persona, setPersona] = useState<Persona | null>(startingPersona);
  const [view, setView] = useState<View>(() => initialView(startingPersona));
  const [deliveryTab, setDeliveryTab] = useState<DeliveryTab>(initialDeliveryTab);
  const [testId, setTestId] = useState(() => params().get('test') ?? undefined);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const effectivePersona: Persona = persona ?? 'data-engineer';
  const nav = useMemo(() => navigationFor(effectivePersona), [effectivePersona]);

  useEffect(() => {
    const handlePopState = () => {
      const nextPersona = initialPersona();
      setPersona(nextPersona);
      setView(initialView(nextPersona));
      setDeliveryTab(initialDeliveryTab());
      setTestId(params().get('test') ?? undefined);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!mobileOpen || !window.matchMedia('(max-width: 760px)').matches) return;
    const navigation = document.getElementById('platform-navigation');
    const focusable: HTMLElement[] = navigation
      ? Array.from(navigation.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), a[href]',
      ))
      : [];
    focusable[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      mobileTriggerRef.current?.focus();
    };
  }, [mobileOpen]);

  const writeUrl = (
    nextPersona: Persona,
    nextView: View,
    nextTest?: string,
    nextDeliveryTab: DeliveryTab = deliveryTab,
  ) => {
    const search = new URLSearchParams({ persona: nextPersona, view: nextView });
    if (nextTest) search.set('test', nextTest);
    if (nextView === 'delivery') search.set('tab', nextDeliveryTab);
    window.history.pushState({}, '', `${window.location.pathname}?${search.toString()}`);
  };

  const selectPersona = (nextPersona: Persona) => {
    const nextView = defaultView(nextPersona);
    setPersona(nextPersona);
    setView(nextView);
    setDeliveryTab(defaultDeliveryTab);
    setTestId(undefined);
    setMobileOpen(false);
    writeUrl(nextPersona, nextView, undefined, defaultDeliveryTab);
    window.setTimeout(() => document.getElementById('platform')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const navigate = (nextView: View, nextTest?: string, nextDeliveryTab = deliveryTab) => {
    const activePersona = persona ?? effectivePersona;
    if (!persona) setPersona(activePersona);
    setView(nextView);
    if (nextView === 'delivery') setDeliveryTab(nextDeliveryTab);
    setTestId(nextTest);
    setMobileOpen(false);
    writeUrl(activePersona, nextView, nextTest, nextDeliveryTab);
    window.scrollTo({ top: document.getElementById('platform')?.offsetTop ?? 0, behavior: 'smooth' });
  };

  const selectDeliveryTab = (nextTab: DeliveryTab) => {
    const activePersona = persona ?? effectivePersona;
    setDeliveryTab(nextTab);
    writeUrl(activePersona, 'delivery', undefined, nextTab);
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
      case 'delivery': return (
        <DeliveryHub
          activeTab={deliveryTab}
          onTabChange={selectDeliveryTab}
          onNavigate={navigate}
        />
      );
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
          <button
            ref={mobileTriggerRef}
            className="mobile-menu-button"
            aria-expanded={mobileOpen}
            aria-controls="platform-navigation"
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <LandingHero persona={persona} onSelect={selectPersona} />
      <ProofStrip />

      <section id="platform" className="platform-shell">
        <aside
          id="platform-navigation"
          className={mobileOpen ? 'platform-nav open' : 'platform-nav'}
          aria-label="Platform navigation"
          role={mobileOpen ? 'dialog' : undefined}
          aria-modal={mobileOpen ? true : undefined}
        >
          <div className="persona-control">
            <span>View as</span>
            <select value={effectivePersona} onChange={(event) => selectPersona(event.target.value as Persona)} aria-label="Hiring perspective">
              <option value="data-engineer">Data Engineer R14634</option>
              <option value="business-analyst">IT Business Analyst</option>
            </select>
          </div>
          {nav.map(({ id, label, group, icon: Icon }, index) => (
            <div className="nav-group nav-item" key={id}>
              {(index === 0 || nav[index - 1].group !== group) && <span>{group}</span>}
              <button className={view === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={18} />{label}</button>
            </div>
          ))}
          <button className="replay-tour" onClick={() => setTourOpen(true)}><RotateCcw size={17} /> Replay tour</button>
        </aside>

        <div className="mobile-platform-bar">
          <label>
            <span>View as</span>
            <select value={effectivePersona} onChange={(event) => selectPersona(event.target.value as Persona)}>
              <option value="data-engineer">Data Engineer R14634</option>
              <option value="business-analyst">IT Business Analyst</option>
            </select>
          </label>
          <button onClick={() => setMobileOpen(true)}><Menu size={19} /> Explore</button>
        </div>

        <main className="platform-content">
          <div className="mobile-quick-actions">
            <button onClick={() => setTourOpen(true)}><Play size={16} /> Start tour</button>
            <button onClick={() => navigate(effectivePersona === 'business-analyst' ? 'delivery' : 'pipeline')}>
              <Play size={16} /> {effectivePersona === 'business-analyst' ? 'Delivery hub' : 'Run pipeline'}
            </button>
          </div>
          <Suspense fallback={<ViewFallback />}>{renderView()}</Suspense>
        </main>
      </section>

      <footer className="site-footer"><span>P&amp;C Insurance Analytics Platform</span><span>Synthetic P&amp;C data · Supabase Postgres · React + Vite</span><span>Built by Dev Neupane</span></footer>

      {tourOpen && (
        <Suspense fallback={null}>
          <GuidedTour persona={effectivePersona} onNavigate={navigate} onClose={() => setTourOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
