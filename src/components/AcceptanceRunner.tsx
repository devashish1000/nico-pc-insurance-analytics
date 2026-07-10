import { CheckCircle2, Circle, ExternalLink, LoaderCircle, Play, RotateCcw, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ACCEPTANCE_CASES, executeAcceptance, type AcceptanceResult, type AcceptanceStatus } from '../lib/acceptance';
import type { View } from '../lib/navigation';
import { STORIES } from '../lib/requirements';

const emptyResults = (): AcceptanceResult[] => ACCEPTANCE_CASES.map((test) => ({
  ...test, status: 'pending', actual: 'Not run', durationMs: 0,
}));

function StatusIcon({ status }: { status: AcceptanceStatus }) {
  if (status === 'running') return <LoaderCircle className="test-spin" size={17} />;
  if (status === 'pass') return <CheckCircle2 className="test-pass" size={17} />;
  if (status === 'fail') return <XCircle className="test-fail" size={17} />;
  return <Circle className="test-pending" size={17} />;
}

export default function AcceptanceRunner({ onNavigate, requestedStory, onStoryHandled }: {
  onNavigate: (view: View, testId?: string) => void;
  requestedStory?: string;
  onStoryHandled: () => void;
}) {
  const [results, setResults] = useState<AcceptanceResult[]>(emptyResults);
  const [running, setRunning] = useState(false);
  const passed = results.filter((result) => result.status === 'pass').length;
  const failed = results.filter((result) => result.status === 'fail').length;
  const grouped = useMemo(() => STORIES.map((story) => ({
    story,
    results: results.filter((result) => result.storyId === story.id),
  })), [results]);

  const runTests = async (ids = ACCEPTANCE_CASES.map((test) => test.id)) => {
    if (running) return;
    setRunning(true);
    for (const id of ids) {
      const test = ACCEPTANCE_CASES.find((candidate) => candidate.id === id);
      if (!test) continue;
      setResults((current) => current.map((result) => result.id === id ? { ...result, status: 'running', actual: 'Executing…' } : result));
      const result = await executeAcceptance(test);
      setResults((current) => current.map((candidate) => candidate.id === id ? result : candidate));
    }
    setRunning(false);
  };

  useEffect(() => {
    if (!requestedStory || running) return;
    const ids = ACCEPTANCE_CASES.filter((test) => test.storyId === requestedStory).map((test) => test.id);
    void runTests(ids).finally(onStoryHandled);
  }, [requestedStory]);

  return (
    <section className="acceptance-runner" aria-labelledby="acceptance-title">
      <div className="acceptance-header">
        <div>
          <span className="section-kicker">Executable traceability</span>
          <h2 id="acceptance-title">Acceptance test runner</h2>
          <p>These are the requirements below executing against the same rating logic and live warehouse views shown in the app.</p>
        </div>
        <div className="acceptance-actions">
          <div className="suite-score" aria-live="polite"><strong>{passed}</strong>/10 passing{failed > 0 && <span> · {failed} failed</span>}</div>
          <button className="button-primary" onClick={() => runTests()} disabled={running}><Play size={16} /> Run acceptance suite</button>
          <button className="button-quiet" onClick={() => setResults(emptyResults())} disabled={running}><RotateCcw size={16} /> Reset</button>
        </div>
      </div>

      <div className="traceability-table-wrap">
        <table className="traceability-table">
          <thead><tr><th>Story</th><th>Test</th><th>Expected</th><th>Actual</th><th>Status</th><th /></tr></thead>
          <tbody>
            {grouped.flatMap(({ story, results: storyResults }) => storyResults.map((result, index) => (
              <tr key={result.id}>
                <td>{index === 0 ? <><strong>{story.id}</strong><span>{story.role}</span></> : null}</td>
                <td><strong>{result.id}</strong><span>{result.label}</span></td>
                <td>{result.expected}</td>
                <td>{result.actual}{result.durationMs > 0 && <small>{result.durationMs} ms</small>}</td>
                <td><span className={`test-status ${result.status}`}><StatusIcon status={result.status} /> {result.status}</span></td>
                <td>
                  {result.ratingInput ? (
                    <button className="table-action" onClick={() => onNavigate('rating', result.id)} aria-label={`Open ${result.id} in rating engine`}><ExternalLink size={15} /></button>
                  ) : (
                    <button className="table-action" onClick={() => runTests([result.id])} disabled={running} aria-label={`Run ${result.id}`}><Play size={15} /></button>
                  )}
                </td>
              </tr>
            ))) }
          </tbody>
        </table>
      </div>
    </section>
  );
}
