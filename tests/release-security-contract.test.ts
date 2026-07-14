import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> };
type VercelConfig = { headers: HeaderRule[]; rewrites: Array<{ source: string; destination: string }> };

const vercel = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
) as VercelConfig;
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { engines?: { node?: string } };
const packageLock = JSON.parse(
  readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'),
) as { packages?: Record<string, { engines?: { node?: string } }> };
const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const benchmarkWorkflow = readFileSync(
  new URL('../.github/workflows/benchmark.yml', import.meta.url),
  'utf8',
);
const serverSource = readFileSync(new URL('../api/pipeline-runs.ts', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const globalRule = vercel.headers.find((rule) => rule.source === '/(.*)');
const headers = new Map(globalRule?.headers.map(({ key, value }) => [key, value]));
const csp = headers.get('Content-Security-Policy') ?? '';

describe('production response header contract', () => {
  it('applies a single, duplicate-free global security header policy', () => {
    expect(globalRule).toBeDefined();
    const names = globalRule?.headers.map(({ key }) => key) ?? [];
    expect(new Set(names).size).toBe(names.length);
    expect(headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    expect(headers.get('Permissions-Policy')).toContain('camera=()');
    expect(headers.get('Permissions-Policy')).toContain('microphone=()');
  });

  it('keeps scripts same-origin while allowing only the app and Supabase data connections', () => {
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co");
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(csp).toContain("font-src 'self' data: https://fonts.gstatic.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('allows the single structured-data script by hash instead of enabling inline scripts', () => {
    const structuredData = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(structuredData).not.toBeNull();
    const digest = createHash('sha256').update(structuredData?.[1] ?? '').digest('base64');
    expect(csp).toContain(`'sha256-${digest}'`);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it('keeps API requests out of the SPA fallback', () => {
    expect(vercel.rewrites).toContainEqual({
      source: '/((?!assets/|api/).*)',
      destination: '/index.html',
    });
  });
});

describe('release runtime and action contract', () => {
  it('pins the application and lockfile root to the Node 24 release line', () => {
    expect(packageJson.engines?.node).toBe('24.x');
    expect(packageLock.packages?.['']?.engines?.node).toBe('24.x');
    expect(workflow.match(/node-version: 24/g)).toHaveLength(3);
  });

  it('uses Node 24 action majors and does not persist checkout credentials', () => {
    expect(workflow.match(/uses: actions\/checkout@v6/g)).toHaveLength(3);
    expect(workflow.match(/uses: actions\/setup-node@v6/g)).toHaveLength(3);
    expect(workflow.match(/uses: actions\/upload-artifact@v7/g)).toHaveLength(2);
    expect(workflow.match(/persist-credentials: false/g)).toHaveLength(3);
    expect(workflow).not.toMatch(/uses: actions\/(checkout|setup-node|upload-artifact)@v[1-5]\b/);
    expect(workflow).toContain('npm audit --audit-level=high');
    expect(workflow).toContain('npm run check:bundle');
  });

  it('keeps the scheduled benchmark on the same Node 24 action boundary', () => {
    expect(benchmarkWorkflow).toContain('uses: actions/checkout@v6');
    expect(benchmarkWorkflow).toContain('persist-credentials: false');
    expect(benchmarkWorkflow).toContain('uses: actions/setup-node@v6');
    expect(benchmarkWorkflow).toContain('node-version: 24');
    expect(benchmarkWorkflow).toContain('uses: actions/upload-artifact@v7');
    expect(benchmarkWorkflow).not.toMatch(
      /uses: actions\/(checkout|setup-node|upload-artifact)@v[1-5]\b/,
    );
  });
});

describe('pipeline API release boundary', () => {
  it('sets non-cacheable JSON headers before every response branch', () => {
    const cacheHeader = serverSource.indexOf("response.setHeader('Cache-Control', 'no-store')");
    const contentType = serverSource.indexOf("response.setHeader('Content-Type', 'application/json; charset=utf-8')");
    const firstBranch = serverSource.indexOf("if (request.method !== 'POST')");
    expect(cacheHeader).toBeGreaterThan(-1);
    expect(contentType).toBeGreaterThan(cacheHeader);
    expect(firstBranch).toBeGreaterThan(contentType);
    expect(serverSource).not.toContain('Access-Control-Allow-Origin');
  });

  it('fails closed behind an exact server-only feature flag before privileged setup', () => {
    const flagCheck = serverSource.indexOf("process.env.PIPELINE_EXECUTION_ENABLED !== 'true'");
    const credentialRead = serverSource.indexOf('process.env.SUPABASE_SERVICE_ROLE_KEY');
    const privilegedClient = serverSource.indexOf('createClient(url, serviceRoleKey');
    expect(flagCheck).toBeGreaterThan(-1);
    expect(credentialRead).toBeGreaterThan(flagCheck);
    expect(privilegedClient).toBeGreaterThan(credentialRead);
    expect(serverSource).not.toContain('VITE_PIPELINE_EXECUTION_ENABLED');
  });

  it('preserves server-enforced cooldown and retry semantics', () => {
    expect(serverSource).toContain("action === 'simulate-failure' ? 900 : 300");
    expect(serverSource).toContain("response.setHeader('Retry-After', String(retryAfter))");
    expect(serverSource).toContain('response.status(429)');
    expect(serverSource).toContain('response.status(409)');
    expect(serverSource).toContain("request.headers['sec-fetch-site'] !== 'same-origin'");
  });
});
