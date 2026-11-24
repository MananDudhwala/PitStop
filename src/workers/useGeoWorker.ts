import { useEffect, useRef, useCallback } from 'react';
import {
  WorkerRequest,
  WorkerResponse,
  WorkerMessageType,
  GeoPoint,
  OverpassElement,
  CorridorPOI,
  FuelGapAlert,
} from './types';

export function useGeoWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRequests = useRef<
    Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>
  >(new Map());

  useEffect(() => {
    // Instantiate module worker
    const worker = new Worker(new URL('./geo.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const pending = pendingRequests.current.get(response.id);

      if (pending) {
        if (response.error) {
          pending.reject(new Error(response.error));
        } else {
          pending.resolve(response.result);
        }
        pendingRequests.current.delete(response.id);
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const dispatch = useCallback(
    <T>(type: WorkerMessageType, payload: any): Promise<T> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('GeoWorker is not initialized'));
          return;
        }

        const id = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        pendingRequests.current.set(id, { resolve, reject });

        const req: WorkerRequest = { id, type, payload } as WorkerRequest;
        workerRef.current.postMessage(req);
      });
    },
    []
  );

  const simplifyPolyline = useCallback(
    (coords: [number, number][], tolerance: number = 0.0005) => {
      return dispatch<[number, number][]>('simplify-polyline', { coords, tolerance });
    },
    [dispatch]
  );

  const sampleWaypoints = useCallback(
    (coords: [number, number][], intervalMeters: number = 8000) => {
      return dispatch<GeoPoint[]>('sample-waypoints', { coords, intervalMeters });
    },
    [dispatch]
  );

  const filterCorridorPOIs = useCallback(
    (pois: OverpassElement[], routeCoords: [number, number][], bufferMeters: number) => {
      return dispatch<CorridorPOI[]>('filter-corridor-pois', { pois, routeCoords, bufferMeters });
    },
    [dispatch]
  );

  const analyzeFuelGaps = useCallback(
    (fuelPOIs: CorridorPOI[], totalRouteDistance: number, thresholdKm: number = 60) => {
      return dispatch<FuelGapAlert[]>('analyze-fuel-gaps', {
        fuelPOIs,
        totalRouteDistance,
        thresholdKm,
      });
    },
    [dispatch]
  );

  return {
    simplifyPolyline,
    sampleWaypoints,
    filterCorridorPOIs,
    analyzeFuelGaps,
  };
}
