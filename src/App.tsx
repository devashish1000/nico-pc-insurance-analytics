import React, { useState } from 'react';
import {
  LayoutDashboard, Layers, Calculator, ShieldCheck, Database, ClipboardList, Shield, Github,
} from 'lucide-react';
import Overview from './pc/Overview';
import LinesOfBusiness from './pc/LinesOfBusiness';
import RatingEngine from './pc/RatingEngine';
import DataQuality from './pc/DataQuality';
import Warehouse from './pc/Warehouse';
import Requirements from './pc/Requirements';

type Page = 'overview' | 'lob' | 'rating' | 'dq' | 'warehouse' | 'requirements';

const NAV: { id: Page; label: string; icon: React.ReactNode; group: string }[] = [
  { id: 'overview', label: 'Portfolio Overview', icon: <LayoutDashboard size={17} />, group: 'Analytics' },
  { id: 'lob', label: 'Lines of Business', icon: <Layers size={17} />, group: 'Analytics' },
  { id: 'warehouse', label: 'Warehouse Architecture', icon: <Database size={17} />, group: 'Data Engineering' },
  { id: 'dq', label: 'Data Quality', icon: <ShieldCheck size={17} />, group: 'Data Engineering' },
  { id: 'rating', label: 'Rating Engine', icon: <Calculator size={17} />, group: 'Business Analysis' },
  { id: 'requirements', label: 'Requirements', icon: <ClipboardList size={17} />, group: 'Business Analysis' },
];

export default function App() {
  const [page, setPage] = useState<Page>('overview');
  const groups = Array.from(new Set(NAV.map((n) => n.group)));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1f3a5f] text-white">
              <Shield size={18} />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight text-slate-900" style={{ fontFamily: 'Figtree, Inter, sans-serif' }}>
                P&C Insurance Analytics Platform
              </div>
              <div className="text-[11px] text-slate-500">Data-warehouse work sample · Dev Neupane</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 sm:inline">
              Synthetic data · no PII
            </span>
            <a
              href="https://github.com/devashish1000/nico-pc-insurance-analytics"
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Github size={14} /> Source
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-5 py-6">
        {/* Sidebar */}
        <nav className="hidden w-56 shrink-0 md:block">
          {groups.map((g) => (
            <div key={g} className="mb-5">
              <div className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g}</div>
              {NAV.filter((n) => n.group === g).map((n) => (
                <button
                  key={n.id}
                  onClick={() => setPage(n.id)}
                  className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    page === n.id ? 'bg-[#1f3a5f] text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {n.icon} {n.label}
                </button>
              ))}
            </div>
          ))}
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-relaxed text-slate-500">
            Built to mirror a P&C insurer's Data Warehouse team: SQL star schema, stored-procedure ETL, data-quality
            controls, BI dashboards, and BA requirements — the full source-to-insight lifecycle.
          </div>
        </nav>

        {/* Mobile nav */}
        <div className="mb-4 flex gap-2 overflow-x-auto md:hidden">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${page === n.id ? 'bg-[#1f3a5f] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
              {n.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="min-w-0 flex-1">
          {page === 'overview' && <Overview />}
          {page === 'lob' && <LinesOfBusiness />}
          {page === 'rating' && <RatingEngine />}
          {page === 'dq' && <DataQuality />}
          {page === 'warehouse' && <Warehouse />}
          {page === 'requirements' && <Requirements />}
        </main>
      </div>

      <footer className="mx-auto max-w-7xl px-5 py-6 text-center text-[11px] text-slate-400">
        Synthetic P&C insurance data · Supabase Postgres star schema · React + Vite · Built by Dev Neupane
      </footer>
    </div>
  );
}
