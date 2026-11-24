import { useMutation } from '@tanstack/react-query';
import { computeRoute } from '@/api';
import { useRouteStore } from '@/store';
import { GeoPoint, RouteCorridor } from '@/types';
import { CacheManager } from '@/offline';

export function useRoute() {
  const {
    origin,
    destination,
    corridor,
    corridorBuffer,
    isRouteLoading,
    routeError,
    setCorridor,
    setIsRouteLoading,
    setRouteError,
  } = useRouteStore();

  const routeMutation = useMutation({
    mutationFn: async ({
      start,
      end,
      buffer,
    }: {
      start: GeoPoint & { name: string };
      end: GeoPoint & { name: string };
      buffer: number;
    }) => {
      setIsRouteLoading(true);
      setRouteError(null);

      const computed = await computeRoute(start, end, {
        corridorBuffer: buffer,
        sampleIntervalMeters: 8000,
      });

      // Cache route in IndexedDB
      await CacheManager.cacheRoute(computed);

      return computed;
    },
    onSuccess: (data: RouteCorridor) => {
      setCorridor(data);
    },
    onError: (err: Error) => {
      setRouteError(err.message || 'Route calculation failed');
    },
  });

  const requestRoute = (
    customOrigin?: GeoPoint & { name: string },
    customDestination?: GeoPoint & { name: string }
  ) => {
    const o = customOrigin || origin;
    const d = customDestination || destination;

    if (!o || !d) {
      setRouteError('Please specify both origin and destination');
      return;
    }

    routeMutation.mutate({
      start: o,
      end: d,
      buffer: corridorBuffer,
    });
  };

  return {
    corridor,
    isLoading: isRouteLoading || routeMutation.isPending,
    error: routeError,
    requestRoute,
  };
}
