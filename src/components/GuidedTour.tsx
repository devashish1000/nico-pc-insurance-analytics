import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Persona, View } from '../lib/navigation';

const tours: Record<Persona, { title: string; body: string; view: View }[]> = {
  'data-engineer': [
    { title: 'Follow the warehouse', body: 'Inspect the source-to-published architecture, conformed dimensions, fact grain, and real row counts.', view: 'warehouse' },
    { title: 'Operate the pipeline', body: 'Run the controlled load, then inspect duration, fact counts, and scheduled history.', view: 'pipeline' },
    { title: 'Prove trust', body: 'Review the six reconciliation, integrity, completeness, and validity controls.', view: 'dq' },
  ],
  'business-analyst': [
    { title: 'Trace delivery intent', body: 'Connect objectives, stories, rules, tests, evidence, ownership, and UAT boundaries in the Delivery Hub.', view: 'delivery' },
    { title: 'Start with testability', body: 'Run requirements as executable acceptance tests and inspect expected versus actual evidence.', view: 'requirements' },
    { title: 'Trace into the product', body: 'Open a tested scenario in the rating engine and inspect the transparent calculation worksheet.', view: 'rating' },
  ],
};

export default function GuidedTour({ persona, onNavigate, onClose }: { persona: Persona; onNavigate: (view: View) => void; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const step = tours[persona][index];

  const close = () => {
    sessionStorage.setItem(`nico-tour-${persona}`, 'complete');
    onClose();
  };

  const advance = () => {
    onNavigate(step.view);
    if (index === tours[persona].length - 1) close();
    else setIndex((value) => value + 1);
  };

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable: HTMLElement[] = dialogRef.current
        ? Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])',
        ))
        : [];
      if (!focusable.length) return;
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
      previousFocus.current?.focus();
    };
  }, []);

  return (
    <div className="tour-backdrop" role="presentation">
      <section ref={dialogRef} className="tour-dialog" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-description">
        <button className="tour-close" aria-label="Close guided tour" onClick={close}><X size={19} /></button>
        <span className="tour-count">Step {index + 1} of {tours[persona].length}</span>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-description">{step.body}</p>
        <div className="tour-progress" aria-hidden="true">
          {tours[persona].map((_, dot) => <span key={dot} className={dot <= index ? 'active' : ''} />)}
        </div>
        <div className="tour-actions">
          <button className="button-quiet" onClick={() => setIndex((value) => value - 1)} disabled={index === 0}><ArrowLeft size={16} /> Back</button>
          <button className="button-primary" onClick={advance}>{index === tours[persona].length - 1 ? 'Finish tour' : 'Show me'} <ArrowRight size={16} /></button>
        </div>
      </section>
    </div>
  );
}
