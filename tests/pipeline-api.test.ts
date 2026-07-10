import { describe, expect, it } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler, { isAllowedOrigin } from '../api/pipeline-runs';

function mockResponse() {
  const state = { status: 200, headers: {} as Record<string, string>, body: undefined as unknown };
  const response = {
    setHeader(name: string, value: string) { state.headers[name] = value; return response; },
    status(code: number) { state.status = code; return response; },
    json(body: unknown) { state.body = body; return response; },
  } as unknown as VercelResponse;
  return { response, state };
}

function mockRequest(method: string, origin?: string, secFetchSite?: string) {
  return { method, headers: { origin, ...(secFetchSite ? { 'sec-fetch-site': secFetchSite } : {}) } } as unknown as VercelRequest;
}

describe('pipeline origin boundary', () => {
  it('allows production, project previews, and local development', () => {
    expect(isAllowedOrigin('https://nico-pc-insurance-analytics.vercel.app')).toBe(true);
    expect(isAllowedOrigin('https://nico-pc-insurance-analytics-abc123-devashish1000s-projects.vercel.app')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:4178')).toBe(true);
  });

  it('rejects missing and unrelated origins', () => {
    expect(isAllowedOrigin(undefined)).toBe(false);
    expect(isAllowedOrigin('https://example.com')).toBe(false);
    expect(isAllowedOrigin('https://nico-pc-insurance-analytics.attacker.example')).toBe(false);
  });

  it('rejects non-POST requests before touching Supabase', async () => {
    const { response, state } = mockResponse();
    await handler(mockRequest('GET', 'https://nico-pc-insurance-analytics.vercel.app'), response);
    expect(state.status).toBe(405);
    expect(state.headers.Allow).toBe('POST');
  });

  it('rejects spoofed browser cross-site signals', async () => {
    const { response, state } = mockResponse();
    await handler(mockRequest('POST', 'https://nico-pc-insurance-analytics.vercel.app', 'cross-site'), response);
    expect(state.status).toBe(403);
  });

  it('fails closed when the server-only credential is absent', async () => {
    const { response, state } = mockResponse();
    await handler(mockRequest('POST', 'https://nico-pc-insurance-analytics.vercel.app', 'same-origin'), response);
    expect(state.status).toBe(503);
    expect(state.body).toEqual({ message: 'The controlled pipeline service is not configured.' });
  });
});
