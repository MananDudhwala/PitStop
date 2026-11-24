import { GeoPoint, CorridorPOI, OverpassElement } from '@/types';
import { haversineDistance, crossTrackDistance } from './math';
import { mapOverpassToPOI, deduplicatePOIs } from './poi-mapper';

export interface RouteProjection {
  projected: GeoPoint;
  chainageMeters: number;
  segmentIndex: number;
  crossTrackMeters: number;
}

/**
 * Projects a point onto the closest segment of a route polyline.
 * Computes:
 * 1. Nearest projected point
 * 2. Cross-track detour distance (perpendicular distance to road)
 * 3. Cumulative chainage (road distance from origin in meters)
 */
export function projectPointOnRoute(
  point: GeoPoint,
  routeCoords: [number, number][]
): RouteProjection {
  let minDistance = Infinity;
  let bestSegmentIndex = 0;
  let bestProjectedPoint: GeoPoint = { lat: routeCoords[0][1], lng: routeCoords[0][0] };
  let bestCrossTrack = 0;

  // Running distance from origin up to start of each segment
  const segmentCumulativeDistances: number[] = [0];
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const pA: GeoPoint = { lat: routeCoords[i][1], lng: routeCoords[i][0] };
    const pB: GeoPoint = { lat: routeCoords[i + 1][1], lng: routeCoords[i + 1][0] };
    segmentCumulativeDistances.push(
      segmentCumulativeDistances[i] + haversineDistance(pA, pB)
    );
  }

  for (let i = 0; i < routeCoords.length - 1; i++) {
    const a: GeoPoint = { lat: routeCoords[i][1], lng: routeCoords[i][0] };
    const b: GeoPoint = { lat: routeCoords[i + 1][1], lng: routeCoords[i + 1][0] };

    // Vector projection in local approximation
    const dx = b.lng - a.lng;
    const dy = b.lat - a.lat;
    const segLenSq = dx * dx + dy * dy;

    let t = 0;
    if (segLenSq > 0) {
      t = ((point.lng - a.lng) * dx + (point.lat - a.lat) * dy) / segLenSq;
      t = Math.max(0, Math.min(1, t)); // Clamp to segment endpoints
    }

    const projectedLat = a.lat + t * dy;
    const projectedLng = a.lng + t * dx;
    const candidateProjected: GeoPoint = { lat: projectedLat, lng: projectedLng };

    const distToProj = haversineDistance(point, candidateProjected);

    if (distToProj < minDistance) {
      minDistance = distToProj;
      bestSegmentIndex = i;
      bestProjectedPoint = candidateProjected;
      bestCrossTrack = crossTrackDistance(point, a, b);
    }
  }

  // Calculate cumulative chainage along polyline up to the projected point
  const segStartPoint: GeoPoint = {
    lat: routeCoords[bestSegmentIndex][1],
    lng: routeCoords[bestSegmentIndex][0],
  };
  const distAlongSegment = haversineDistance(segStartPoint, bestProjectedPoint);
  const totalChainageMeters = segmentCumulativeDistances[bestSegmentIndex] + distAlongSegment;

  return {
    projected: bestProjectedPoint,
    chainageMeters: totalChainageMeters,
    segmentIndex: bestSegmentIndex,
    crossTrackMeters: minDistance, // Use actual closest distance to segment
  };
}

/**
 * Checks if a point falls within a buffer corridor around a polyline.
 */
export function isPointInCorridor(
  point: GeoPoint,
  routeCoords: [number, number][],
  bufferMeters: number
): boolean {
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const a: GeoPoint = { lat: routeCoords[i][1], lng: routeCoords[i][0] };
    const b: GeoPoint = { lat: routeCoords[i + 1][1], lng: routeCoords[i + 1][0] };

    // Quick bounding box rejection
    const minLat = Math.min(a.lat, b.lat) - 0.05;
    const maxLat = Math.max(a.lat, b.lat) + 0.05;
    const minLng = Math.min(a.lng, b.lng) - 0.05;
    const maxLng = Math.max(a.lng, b.lng) + 0.05;

    if (point.lat < minLat || point.lat > maxLat || point.lng < minLng || point.lng > maxLng) {
      continue;
    }

    const xtrack = crossTrackDistance(point, a, b);
    if (xtrack <= bufferMeters) {
      return true;
    }
  }
  return false;
}

/**
 * Filter, project, order, and deduplicate Overpass elements into CorridorPOIs.
 */
export function filterAndOrderPOIs(
  elements: OverpassElement[],
  routeCoords: [number, number][],
  bufferMeters: number
): CorridorPOI[] {
  const mappedPOIs: CorridorPOI[] = [];

  for (const el of elements) {
    const partial = mapOverpassToPOI(el);
    if (!partial || !partial.location) continue;

    const projection = projectPointOnRoute(partial.location, routeCoords);

    // Strict cross-track filter
    if (projection.crossTrackMeters <= bufferMeters) {
      mappedPOIs.push({
        id: `${el.type}-${el.id}`,
        osmId: el.id,
        osmType: el.type,
        category: partial.category || 'rest',
        name: partial.name || 'Unnamed Stop',
        location: partial.location,
        distanceFromRoute: Math.round(projection.crossTrackMeters),
        chainageKm: Number((projection.chainageMeters / 1000).toFixed(2)),
        tags: partial.tags || {},
        details: partial.details || ({} as any),
        projectedPoint: projection.projected,
        routeSegmentIndex: projection.segmentIndex,
        isVerified: false,
        lastUpdated: Date.now(),
      });
    }
  }

  // Deduplicate overlapping nodes/ways within 30 meters
  const deduplicated = deduplicatePOIs(mappedPOIs, 30);

  // Strict chronological ordering by route chainage
  deduplicated.sort((a, b) => a.chainageKm - b.chainageKm);

  return deduplicated;
}
