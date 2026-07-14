import type { IncomingHttpHeaders } from 'node:http';
import { createClient } from '@supabase/supabase-js';

export type PipelineRequest = {
  body?: unknown;
  headers: IncomingHttpHeaders;
  method?: string;
};

export type PipelineResponse = {
  json: (body: unknown) => PipelineResponse;
  setHeader: (name: string, value: string) => PipelineResponse;
  status: (statusCode: number) => PipelineResponse;
};

const productionOrigin = 'https://nico-pc-insurance-analytics.vercel.app';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PipelineAction =
  | { action: 'run' }
  | { action: 'simulate-failure' }
  | { action: 'recover'; recoveryRunId: string };

type ParseResult =
  | { ok: true; value: PipelineAction }
  | { ok: false; message: string };

type PipelineRunRow = {
  run_id: string;
  status: 'running' | 'success' | 'failed' | 'cooldown';
  trigger_type: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  premium_rows: number | null;
  loss_rows: number | null;
  dq_run_id: string | null;
  checks_passed: number | null;
  checks_total: number | null;
  mode?: string | null;
  scenario?: string | null;
  watermark_start?: unknown;
  watermark_end?: unknown;
  source_rows?: number | null;
  inserted_rows?: number | null;
  updated_rows?: number | null;
  unchanged_rows?: number | null;
  recalculated_rows?: number | null;
  rejected_rows?: number | null;
  freshness_lag_seconds?: number | null;
  recovered_from_run_id?: string | null;
};

type StageRow = {
  stage_order: number;
  stage_name: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  input_rows: number;
  inserted_rows: number;
  updated_rows: number;
  unchanged_rows: number;
  recalculated_rows: number;
  rejected_rows: number;
  sanitized_error: string | null;
};

type QuarantineRow = {
  quarantine_id: string;
  run_id: string;
  source_name: string;
  reason_code: string;
  severity: string;
  disposition: string;
  quarantined_at: string;
  resolved_at: string | null;
  recovered_by_run_id: string | null;
};

function decodeBody(body: unknown): unknown {
  if (typeof body === 'string') return JSON.parse(body);
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8'));
  return body;
}

export function parsePipelineAction(body: unknown): ParseResult {
  let decoded: unknown;
  try {
    decoded = decodeBody(body);
  } catch {
    return { ok: false, message: 'Request body must be valid JSON.' };
  }

  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    return { ok: false, message: 'Request body must be a JSON object.' };
  }

  const record = decoded as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (record.action === 'run' || record.action === 'simulate-failure') {
    if (keys.length !== 1 || keys[0] !== 'action') {
      return { ok: false, message: 'Request body contains unsupported fields.' };
    }
    return { ok: true, value: { action: record.action } };
  }

  if (record.action === 'recover') {
    if (keys.length !== 2 || keys[0] !== 'action' || keys[1] !== 'recoveryRunId') {
      return { ok: false, message: 'Recovery requires only action and recoveryRunId.' };
    }
    if (typeof record.recoveryRunId !== 'string' || !uuidPattern.test(record.recoveryRunId)) {
      return { ok: false, message: 'recoveryRunId must be a valid UUID.' };
    }
    return { ok: true, value: { action: 'recover', recoveryRunId: record.recoveryRunId } };
  }

  return { ok: false, message: 'Unsupported pipeline action.' };
}

export function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return false;
  if (origin === productionOrigin) return true;
  if (/^https:\/\/nico-pc-insurance-analytics-[a-z0-9-]+-devashish1000s-projects\.vercel\.app$/.test(origin)) return true;
  return /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin);
}

function cooldownSeconds(action: PipelineAction['action']) {
  return action === 'simulate-failure' ? 900 : 300;
}

function evidenceResponse(run: PipelineRunRow, stages: StageRow[], quarantine: QuarantineRow[]) {
  return {
    runId: run.run_id,
    status: run.status,
    trigger: run.trigger_type,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    durationMs: run.duration_ms,
    rowCounts: { factPremium: run.premium_rows, factLoss: run.loss_rows },
    dq: { runId: run.dq_run_id, passed: run.checks_passed, total: run.checks_total },
    mode: run.mode ?? null,
    scenario: run.scenario ?? null,
    watermarks: { start: run.watermark_start ?? null, end: run.watermark_end ?? null },
    counts: {
      source: run.source_rows ?? 0,
      inserted: run.inserted_rows ?? 0,
      updated: run.updated_rows ?? 0,
      unchanged: run.unchanged_rows ?? 0,
      recalculated: run.recalculated_rows ?? 0,
      rejected: run.rejected_rows ?? 0,
    },
    freshnessLagSeconds: run.freshness_lag_seconds ?? null,
    recoveredFromRunId: run.recovered_from_run_id ?? null,
    stages: stages.map((stage) => ({
      order: stage.stage_order,
      name: stage.stage_name,
      status: stage.status,
      startedAt: stage.started_at,
      finishedAt: stage.finished_at,
      durationMs: stage.duration_ms,
      inputRows: stage.input_rows,
      insertedRows: stage.inserted_rows,
      updatedRows: stage.updated_rows,
      unchangedRows: stage.unchanged_rows,
      recalculatedRows: stage.recalculated_rows,
      rejectedRows: stage.rejected_rows,
      error: stage.sanitized_error,
    })),
    quarantine: quarantine.map((item) => ({
      id: item.quarantine_id,
      runId: item.run_id,
      source: item.source_name,
      reason: item.reason_code,
      severity: item.severity,
      disposition: item.disposition,
      quarantinedAt: item.quarantined_at,
      resolvedAt: item.resolved_at,
      recoveredByRunId: item.recovered_by_run_id,
    })),
  };
}

export default async function handler(request: PipelineRequest, response: PipelineResponse) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ message: 'Method not allowed.' });
  }

  if (!isAllowedOrigin(request.headers.origin)) {
    return response.status(403).json({ message: 'This pipeline action is available only from the portfolio app.' });
  }

  if (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site'] !== 'same-origin') {
    return response.status(403).json({ message: 'Cross-site pipeline requests are not allowed.' });
  }

  if (process.env.PIPELINE_EXECUTION_ENABLED !== 'true') {
    return response.status(503).json({ message: 'Interactive pipeline execution is disabled.' });
  }

  const parsedAction = parsePipelineAction(request.body);
  if (parsedAction.ok === false) {
    return response.status(400).json({ message: parsedAction.message });
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return response.status(503).json({ message: 'The controlled pipeline service is not configured.' });
  }

  try {
    const supabase = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const rpcResult = parsedAction.value.action === 'run'
      ? await supabase.rpc('run_demo_pipeline')
      : await supabase.rpc('run_demo_pipeline_action', {
          p_action: parsedAction.value.action,
          p_recovery_run_id: parsedAction.value.action === 'recover'
            ? parsedAction.value.recoveryRunId
            : null,
        });
    const result = rpcResult.data as { run_id?: string; accepted?: boolean } | null;
    if (rpcResult.error || !result?.run_id || typeof result.accepted !== 'boolean') {
      return response.status(502).json({ message: 'The controlled pipeline action could not be completed.' });
    }

    const { data: runData, error: runReadError } = await supabase
      .from('pipeline_runs')
      .select('run_id,status,trigger_type,started_at,finished_at,duration_ms,premium_rows,loss_rows,dq_run_id,checks_passed,checks_total,mode,scenario,watermark_start,watermark_end,source_rows,inserted_rows,updated_rows,unchanged_rows,recalculated_rows,rejected_rows,freshness_lag_seconds,recovered_from_run_id')
      .eq('run_id', result.run_id)
      .single();
    if (runReadError || !runData) {
      return response.status(502).json({ message: 'Pipeline evidence could not be read.' });
    }
    const run = runData as PipelineRunRow;
    const quarantineOwnerRunId = run.recovered_from_run_id ?? result.run_id;

    const { data: stageData, error: stageReadError } = await supabase
      .from('vw_pipeline_stage_runs')
      .select('stage_order,stage_name,status,started_at,finished_at,duration_ms,input_rows,inserted_rows,updated_rows,unchanged_rows,recalculated_rows,rejected_rows,sanitized_error')
      .eq('run_id', result.run_id)
      .order('stage_order', { ascending: true })
      .limit(20);
    const { data: quarantineData, error: quarantineReadError } = await supabase
      .from('vw_quarantine_evidence')
      .select('quarantine_id,run_id,source_name,reason_code,severity,disposition,quarantined_at,resolved_at,recovered_by_run_id')
      .eq('run_id', quarantineOwnerRunId)
      .order('quarantined_at', { ascending: false })
      .limit(20);
    if (stageReadError || quarantineReadError) {
      return response.status(502).json({ message: 'Pipeline evidence could not be read.' });
    }

    const evidence = evidenceResponse(
      run,
      (stageData ?? []) as StageRow[],
      (quarantineData ?? []) as QuarantineRow[],
    );

    if (!result.accepted || run.status === 'cooldown') {
      if (parsedAction.value.action === 'recover') {
        return response.status(409).json({
          ...evidence,
          message: 'This recovery is no longer available.',
        });
      }
      const retryAfter = cooldownSeconds(parsedAction.value.action);
      response.setHeader('Retry-After', String(retryAfter));
      return response.status(429).json({
        ...evidence,
        message: parsedAction.value.action === 'simulate-failure'
          ? 'A controlled failure is already pending or was requested recently. Recover it before retrying; new simulations have a fifteen-minute cooldown.'
          : 'A synthetic pipeline run was requested recently. Try again after the five-minute cooldown.',
      });
    }

    if (parsedAction.value.action === 'simulate-failure' && run.status === 'failed') {
      return response.status(200).json({
        ...evidence,
        message: 'Controlled failure recorded; published facts and watermarks were unchanged.',
      });
    }

    if (run.status === 'failed') {
      return response.status(500).json({
        ...evidence,
        message: 'Pipeline execution failed. Review the sanitized stage evidence.',
      });
    }

    return response.status(200).json(evidence);
  } catch {
    return response.status(502).json({ message: 'The controlled pipeline action could not be completed.' });
  }
}
