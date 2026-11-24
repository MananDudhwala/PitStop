export interface OfflineCacheManifest {
  routeId: string;
  cachedAt: number;
  expiresAt: number;
  tilesCached: number;
  poisCached: number;
  routeGeometryCached: boolean;
  totalSizeBytes: number;
}

export interface CacheEntry<T> {
  key: string;
  data: T;
  cachedAt: number;
  ttlMs: number;
  version: number;
}

export interface SyncQueueItem {
  id: string;
  action: 'report_poi' | 'update_poi' | 'telemetry_ping';
  payload: unknown;
  createdAt: number;
  retryCount: number;
}
