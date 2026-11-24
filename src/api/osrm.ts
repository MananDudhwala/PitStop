import { GeoPoint, RouteCorridor } from '@/types';
import { computeMapplsRoute } from './mappls';

export interface ComputeRouteOptions {
  corridorBuffer?: number;
  sampleIntervalMeters?: number;
}

/**
 * Computes road highway route powered by MapmyIndia (Mappls).
 */
export async function computeRoute(
  origin: GeoPoint & { name: string },
  destination: GeoPoint & { name: string },
  options: ComputeRouteOptions = {}
): Promise<RouteCorridor> {
  return computeMapplsRoute(origin, destination, {
    corridorBuffer: options.corridorBuffer || 2000,
  });
}
