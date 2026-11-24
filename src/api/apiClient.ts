import { RetryConfig } from '@/types';

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1200,
  maxDelayMs: 8000,
  backoffFactor: 2,
};

// Request in-flight deduplication cache
const inFlightRequests = new Map<string, Promise<any>>();

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  retryConfig?: Partial<RetryConfig>;
  deduplicate?: boolean;
}

export async function fetchWithRetry<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    timeoutMs = 12000,
    retryConfig = {},
    deduplicate = true,
    ...fetchInit
  } = options;

  const config: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...retryConfig,
  };

  const cacheKey = `${fetchInit.method || 'GET'}:${url}:${JSON.stringify(fetchInit.body || '')}`;
  if (deduplicate && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey) as Promise<T>;
  }

  const execution = (async () => {
    let attempt = 0;
    let delay = config.baseDelayMs;

    while (attempt <= config.maxRetries) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Chain caller's signal if present
      if (fetchInit.signal) {
        fetchInit.signal.addEventListener('abort', () => controller.abort());
      }

      try {
        const response = await fetch(url, {
          ...fetchInit,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const rawText = await response.text();

        // Detect 502/504 gateway timeouts or HTML error bodies from public Overpass servers
        const isHtmlError =
          rawText.includes('<html') ||
          rawText.includes('502 Gateway Timeout') ||
          rawText.includes('504 Gateway Timeout') ||
          rawText.includes('currently at capacity') ||
          rawText.includes('request queue is full');

        if (!response.ok || isHtmlError) {
          const isCapacityOrTimeout =
            [429, 502, 503, 504].includes(response.status) || isHtmlError;

          if (isCapacityOrTimeout && attempt < config.maxRetries) {
            throw new Error(`OVERPASS_CAPACITY_ERROR: Server busy or timeout (${response.status || 502})`);
          }
          throw new Error(
            isHtmlError
              ? 'Overpass public mirror is currently at capacity. Rotating mirror...'
              : `HTTP error ${response.status}: ${response.statusText}`
          );
        }

        // Parse JSON safely
        try {
          const data = JSON.parse(rawText);
          return data as T;
        } catch (jsonErr) {
          throw new Error(`JSON parse error from ${url}: Server returned non-JSON response`);
        }
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (attempt >= config.maxRetries || fetchInit.signal?.aborted) {
          throw err;
        }

        // Exponential backoff with random jitter (200-500ms)
        const jitter = Math.random() * 300 + 200;
        const sleepMs = Math.min(delay + jitter, config.maxDelayMs);
        await new Promise((resolve) => setTimeout(resolve, sleepMs));

        delay *= config.backoffFactor;
        attempt++;
      }
    }

    throw new Error(`Failed to fetch ${url} after ${config.maxRetries} retries`);
  })();

  if (deduplicate) {
    inFlightRequests.set(cacheKey, execution);
    execution.finally(() => {
      inFlightRequests.delete(cacheKey);
    });
  }

  return execution;
}
