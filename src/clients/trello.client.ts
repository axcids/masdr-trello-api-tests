import type { APIRequestContext, APIResponse } from '@playwright/test';
import { config, authParams } from '../config/env';
import { parseBody, sleep } from '../utils/http';

export type QueryParams = Record<string, string | number | boolean>;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface TimedResponse<T = unknown> {
  status: number;
  ok: boolean;
  body: T;
  raw: APIResponse;
  durationMs: number;
  attempts: number;
}

const MIN_REQUEST_INTERVAL_MS = Number(process.env.MIN_REQUEST_INTERVAL_MS ?? 120);
const MAX_RATE_LIMIT_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

let lastRequestAt = 0;

/** Spaces requests out. Runs before timing starts, so it never inflates
 *  measured response times. */
async function pace(): Promise<void> {
  const waitFor = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
  if (waitFor > 0) await sleep(waitFor);
  lastRequestAt = Date.now();
}

export class TrelloClient {
  constructor(private readonly request: APIRequestContext) { }

  get<T>(path: string, params: QueryParams = {}) {
    return this.send<T>('GET', path, params);
  }

  post<T>(path: string, params: QueryParams = {}) {
    return this.send<T>('POST', path, params);
  }

  put<T>(path: string, params: QueryParams = {}) {
    return this.send<T>('PUT', path, params);
  }

  delete<T>(path: string, params: QueryParams = {}) {
    return this.send<T>('DELETE', path, params);
  }

  private async send<T>(
    method: HttpMethod,
    path: string,
    params: QueryParams,
  ): Promise<TimedResponse<T>> {
    
    let result!: TimedResponse<T>;

    for (let attempt = 1; attempt <= MAX_RATE_LIMIT_RETRIES + 1; attempt++) {
      result = { ...(await this.sendOnce<T>(method, path, params)), attempts: attempt };

      if (result.status !== 429) return result;

      if (attempt <= MAX_RATE_LIMIT_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }

    return result;
  }

  private async sendOnce<T>(
    method: HttpMethod,
    path: string,
    params: QueryParams,
  ): Promise<TimedResponse<T>> {
    await pace();

    const startedAt = performance.now();
    const raw = await this.request.fetch(`${config.baseUrl}${path}`, {
      method,
      params: { ...authParams, ...params },
      failOnStatusCode: false,
    });
    const durationMs = performance.now() - startedAt;

    return {
      status: raw.status(),
      ok: raw.ok(),
      body: await parseBody<T>(raw),
      raw,
      durationMs,
      attempts: 1,
    };
  }
}