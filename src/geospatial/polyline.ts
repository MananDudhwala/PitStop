import { GeoPoint } from '@/types';
import { haversineDistance } from './math';

/**
 * Decodes an encoded polyline string (OSRM/Google 5 or 6 decimal places).
 * Returns array of [longitude, latitude] coordinates.
 */
export function decodePolyline(encoded: string, precision: number = 5): [number, number][] {
  const factor = Math.pow(10, precision);
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lng / factor, lat / factor]);
  }

  return coordinates;
}

/**
 * Perpendicular distance between point P and line segment AB (Euclidean approximation in degrees).
 */
function perpendicularDistance(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  let [x, y] = p;
  let [x1, y1] = a;
  let [x2, y2] = b;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return Math.hypot(x - x1, y - y1);
  }

  const numerator = Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1);
  const denominator = Math.hypot(dx, dy);

  return numerator / denominator;
}

/**
 * Simplifies a polyline using the Ramer-Douglas-Peucker algorithm.
 * @param coords Array of [lng, lat] coordinates
 * @param tolerance Max perpendicular distance deviation in degrees (~0.0005° ≈ 50 meters)
 */
export function simplifyPolyline(
  coords: [number, number][],
  tolerance: number = 0.0005
): [number, number][] {
  if (coords.length <= 2) {
    return coords;
  }

  let maxDist = 0;
  let maxIndex = 0;
  const first = coords[0];
  const last = coords[coords.length - 1];

  for (let i = 1; i < coords.length - 1; i++) {
    const dist = perpendicularDistance(coords[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPolyline(coords.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPolyline(coords.slice(maxIndex), tolerance);
    return left.slice(0, -1).concat(right);
  }

  return [first, last];
}

/**
 * Samples evenly spaced waypoints along a polyline.
 * @param coords Array of [lng, lat] coordinates
 * @param intervalMeters Desired spacing (e.g. 5000 to 10000 meters)
 */
export function sampleAlongPolyline(
  coords: [number, number][],
  intervalMeters: number = 8000
): GeoPoint[] {
  if (coords.length === 0) return [];
  if (coords.length === 1) return [{ lat: coords[0][1], lng: coords[0][0] }];

  const samples: GeoPoint[] = [{ lat: coords[0][1], lng: coords[0][0] }];
  let accumulatedDistance = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const p1: GeoPoint = { lat: coords[i][1], lng: coords[i][0] };
    const p2: GeoPoint = { lat: coords[i + 1][1], lng: coords[i + 1][0] };
    const segDist = haversineDistance(p1, p2);

    accumulatedDistance += segDist;

    if (accumulatedDistance >= intervalMeters) {
      samples.push(p2);
      accumulatedDistance = 0;
    }
  }

  // Ensure last point is included
  const lastCoord = coords[coords.length - 1];
  const lastPoint: GeoPoint = { lat: lastCoord[1], lng: lastCoord[0] };
  const prevSample = samples[samples.length - 1];

  if (haversineDistance(prevSample, lastPoint) > intervalMeters / 2) {
    samples.push(lastPoint);
  }

  return samples;
}
