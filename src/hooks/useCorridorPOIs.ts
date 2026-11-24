import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { discoverCorridorPOIs } from '@/api';
import { analyzeFuelGaps } from '@/geospatial';
import { usePOIStore, useRouteStore, PipelineAudit } from '@/store';
import { CacheManager } from '@/offline';
import { CorridorPOI, FuelGapAlert } from '@/types';

export function useCorridorPOIs() {
  const corridor = useRouteStore((s) => s.corridor);
  const corridorBuffer = useRouteStore((s) => s.corridorBuffer);

  const {
    pois,
    fuelGapAlerts,
    isLoadingPOIs,
    poiError,
    audit,
    setPOIs,
    setFuelGapAlerts,
    setIsLoadingPOIs,
    setPOIError,
    setAudit,
    getFilteredPOIs,
  } = usePOIStore();

  const queryKey = ['corridor-pois', corridor?.id, corridorBuffer];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<{ pois: CorridorPOI[]; fuelGaps: FuelGapAlert[]; audit: PipelineAudit }> => {
      if (!corridor) {
        return {
          pois: [],
          fuelGaps: [],
          audit: {
            dataSource: 'indexeddb-cache',
            rawElementsCount: 0,
            inCorridorCount: 0,
            deduplicatedCount: 0,
            queriedAt: Date.now(),
          },
        };
      }

      // 1. Check IndexedDB cache first
      const cached = await CacheManager.getCachedPOIs(corridor.id);
      if (cached && cached.length > 0) {
        const fuelGaps = analyzeFuelGaps(cached, corridor, 60);
        const audit: PipelineAudit = {
          dataSource: 'indexeddb-cache',
          rawElementsCount: cached.length,
          inCorridorCount: cached.length,
          deduplicatedCount: cached.length,
          mirrorUsed: 'IndexedDB (Offline Cache)',
          queriedAt: Date.now(),
        };
        return { pois: cached, fuelGaps, audit };
      }

      // 2. Discover POIs along corridor via Bounding Box & Fallback Synthesizer
      const { pois: discoveredPOIs, audit: discoverAudit } = await discoverCorridorPOIs(
        corridor,
        corridorBuffer
      );

      // 3. Fuel-Gap Analysis (default threshold: 60 km)
      const fuelGaps = analyzeFuelGaps(discoveredPOIs, corridor, 60);

      // 4. Cache results in IndexedDB
      if (discoveredPOIs.length > 0) {
        await CacheManager.cachePOIs(corridor.id, discoveredPOIs);
      }

      return { pois: discoveredPOIs, fuelGaps, audit: discoverAudit };
    },
    enabled: Boolean(corridor && corridor.geometry.coordinates.length > 1),
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  // Synchronize Query state with Zustand store
  useEffect(() => {
    setIsLoadingPOIs(query.isLoading);

    if (query.data) {
      setPOIs(query.data.pois);
      setFuelGapAlerts(query.data.fuelGaps);
      setAudit(query.data.audit);
    }

    if (query.error) {
      setPOIError((query.error as Error).message);
    }
  }, [query.isLoading, query.data, query.error, setIsLoadingPOIs, setPOIs, setFuelGapAlerts, setAudit, setPOIError]);

  return {
    pois: getFilteredPOIs(),
    rawCount: pois.length,
    fuelGapAlerts,
    audit,
    isLoading: isLoadingPOIs || query.isLoading,
    error: poiError,
    refetch: query.refetch,
  };
}
