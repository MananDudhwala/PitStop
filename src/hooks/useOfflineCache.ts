import { useState, useEffect, useCallback } from 'react';
import { CacheManager } from '@/offline';
import { OfflineCacheManifest, RouteCorridor, CorridorPOI } from '@/types';

export function useOfflineCache(routeId?: string) {
  const [manifest, setManifest] = useState<OfflineCacheManifest | null>(null);
  const [isCaching, setIsCaching] = useState(false);

  const loadManifest = useCallback(async () => {
    if (!routeId) return;
    const m = await CacheManager.getManifest(routeId);
    setManifest(m);
  }, [routeId]);

  useEffect(() => {
    loadManifest();
  }, [loadManifest]);

  const saveOfflinePack = async (corridor: RouteCorridor, pois: CorridorPOI[]) => {
    setIsCaching(true);
    try {
      await CacheManager.cacheRoute(corridor);
      await CacheManager.cachePOIs(corridor.id, pois);

      const newManifest: OfflineCacheManifest = {
        routeId: corridor.id,
        cachedAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        tilesCached: 0,
        poisCached: pois.length,
        routeGeometryCached: true,
        totalSizeBytes: JSON.stringify(corridor).length + JSON.stringify(pois).length,
      };

      await CacheManager.saveManifest(newManifest);
      setManifest(newManifest);
    } finally {
      setIsCaching(false);
    }
  };

  const clearAllOfflineData = async () => {
    await CacheManager.clearAll();
    setManifest(null);
  };

  return {
    manifest,
    isCaching,
    saveOfflinePack,
    clearAllOfflineData,
    refreshManifest: loadManifest,
  };
}
