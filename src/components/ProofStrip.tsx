import { CheckSquare2, Clock3, History, RefreshCw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  invalidateProofSnapshot,
  loadProofSnapshot,
  type ProofMetric,
  type ProofSnapshot,
} from '../lib/proof';

const verifying: ProofMetric = {
  label: 'Verifying evidence',
  value: 'Verifying…',
  detail: 'Checking live public results',
  state: 'attention',
};

function formatVerifiedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function ProofStrip() {
  const [snapshot, setSnapshot] = useState<ProofSnapshot>();
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    if (force) invalidateProofSnapshot();
    const next = await loadProofSnapshot({ force });
    setSnapshot(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void loadProofSnapshot().then((next) => {
      if (!active) return;
      setSnapshot(next);
      setLoading(false);
    });

    const handleRefresh = () => {
      invalidateProofSnapshot();
      if (active) void refresh(true);
    };
    window.addEventListener('nico:proof-refresh', handleRefresh);
    return () => {
      active = false;
      window.removeEventListener('nico:proof-refresh', handleRefresh);
    };
  }, [refresh]);

  const cards = [
    { id: 'data-quality', icon: ShieldCheck, metric: snapshot?.dataQuality ?? verifying },
    { id: 'acceptance', icon: CheckSquare2, metric: snapshot?.acceptance ?? verifying },
    { id: 'pipeline-runs', icon: History, metric: snapshot?.pipelineRuns ?? verifying },
  ];

  return (
    <section className="proof-strip" aria-label="Verified portfolio evidence" aria-busy={loading}>
      <div className="proof-strip-heading">
        <span>Evidence, not claims</span>
        <button type="button" onClick={() => refresh(true)} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'proof-spin' : ''} />
          {loading ? 'Verifying…' : 'Verify again'}
        </button>
      </div>
      <div className="proof-grid" aria-live="polite">
        {cards.map(({ id, icon: Icon, metric }) => (
          <article className={`proof-metric ${metric.state}`} key={id}>
            <Icon size={19} aria-hidden="true" />
            <div>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </div>
          </article>
        ))}
        <article className={`proof-metric ${snapshot?.degraded ? 'attention' : 'success'}`}>
          <Clock3 size={19} aria-hidden="true" />
          <div>
            <span>Latest verification</span>
            <strong>{snapshot ? formatVerifiedAt(snapshot.verifiedAt) : 'Verifying…'}</strong>
            <small>{!snapshot ? 'Checking live evidence' : snapshot.degraded ? 'Some evidence is degraded' : 'Live checks completed'}</small>
          </div>
        </article>
      </div>
    </section>
  );
}
