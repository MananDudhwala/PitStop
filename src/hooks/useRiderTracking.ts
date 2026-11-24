import { useEffect, useRef, useState, useCallback } from 'react';
import { useRiderStore, useRouteStore, usePOIStore } from '@/store';
import { haversineDistance, projectPointOnRoute } from '@/geospatial';
import { GeoPoint } from '@/types';

export function useRiderTracking() {
  const {
    telemetry,
    watchId,
    offRouteThresholdMeters,
    updatePosition,
    setWatchId,
    stopTracking,
    setNextPOI,
    setDistanceToNextPOI,
    setDistanceRemaining,
    setIsOnRoute,
  } = useRiderStore();

  const corridor = useRouteStore((s) => s.corridor);
  const pois = usePOIStore((s) => s.pois);

  const [error, setError] = useState<string | null>(null);

  const startTracking = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    if (watchId !== null) return;

    setError(null);

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        updatePosition(pos.coords);

        const currentPos: GeoPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        // If active route is loaded, compute off-route and distance telemetry
        if (corridor && corridor.geometry.coordinates.length > 1) {
          const projection = projectPointOnRoute(currentPos, corridor.geometry.coordinates);

          // Off-route check
          const onRoute = projection.crossTrackMeters <= offRouteThresholdMeters;
          setIsOnRoute(onRoute);

          // Distance remaining to destination
          const remainingMeters = Math.max(0, corridor.totalDistance - projection.chainageMeters);
          setDistanceRemaining(Math.round(remainingMeters));

          // Find next upcoming POI ahead on route
          const currentChainageKm = projection.chainageMeters / 1000;
          const upcomingPOIs = pois.filter((p) => p.chainageKm > currentChainageKm);

          if (upcomingPOIs.length > 0) {
            const next = upcomingPOIs[0];
            setNextPOI(next);
            const distMeters = (next.chainageKm - currentChainageKm) * 1000;
            setDistanceToNextPOI(Math.round(distMeters));
          } else {
            setNextPOI(null);
            setDistanceToNextPOI(null);
          }
        }
      },
      (err) => {
        setError(err.message || 'GPS location error');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 3000,
      }
    );

    setWatchId(id);
  }, [
    watchId,
    corridor,
    pois,
    offRouteThresholdMeters,
    updatePosition,
    setWatchId,
    setIsOnRoute,
    setDistanceRemaining,
    setNextPOI,
    setDistanceToNextPOI,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    telemetry,
    isTracking: Boolean(telemetry.isTracking && watchId !== null),
    error,
    startTracking,
    stopTracking,
  };
}
