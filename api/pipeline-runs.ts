import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const productionOrigin = 'https://nico-pc-insurance-analytics.vercel.app';

export function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return false;
  if (origin === productionOrigin) return true;
  if (/^https:\/\/nico-pc-insurance-analytics-[a-z0-9-]+-devashish1000s-projects\.vercel\.app$/.test(origin)) return true;
  return /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin);
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ message: 'Method not allowed.' });
  }

  if (!isAllowedOrigin(request.headers.origin)) {
    return response.status(403).json({ message: 'This pipeline action is available only from the portfolio app.' });
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return response.status(503).json({ message: 'The controlled pipeline service is not configured.' });
  }

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: runId, error: runError } = await supabase.rpc('run_demo_pipeline');
  if (runError || !runId) {
    return response.status(502).json({ message: 'The controlled pipeline could not be started.' });
  }

  const { data: run, error: readError } = await supabase
    .from('vw_pipeline_runs')
    .select('*')
    .eq('run_id', runId)
    .single();

  if (readError || !run) {
    return response.status(502).json({ message: 'Pipeline evidence could not be read.' });
  }

  const statusCode = run.status === 'failed' ? 500 : run.status === 'cooldown' ? 429 : 200;
  return response.status(statusCode).json({
    runId: run.run_id,
    status: run.status,
    trigger: run.trigger_type,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    durationMs: run.duration_ms,
    rowCounts: { factPremium: run.premium_rows, factLoss: run.loss_rows },
    dq: { runId: run.dq_run_id, passed: run.checks_passed, total: run.checks_total },
    ...(run.status === 'cooldown' ? { message: run.error_message } : {}),
  });
}
