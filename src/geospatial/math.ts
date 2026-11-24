import { GeoPoint } from '@/types';

const EARTH_RADIUS_METERS = 6371008.8; // Mean Earth radius in WGS84

export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Calculates great-circle distance between two points using the Haversine formula.
 * @returns Distance in meters
 */
export function haversineDistance(a: GeoPoint, b: GeoPoint): number {
  const phi1 = toRadians(a.lat);
  const phi2 = toRadians(b.lat);
  const deltaPhi = toRadians(b.lat - a.lat);
  const deltaLambda = toRadians(b.lng - a.lng);

  const sinHalfDeltaPhi = Math.sin(deltaPhi / 2);
  const sinHalfDeltaLambda = Math.sin(deltaLambda / 2);

  const squareHalfChordLength =
    sinHalfDeltaPhi * sinHalfDeltaPhi +
    Math.cos(phi1) * Math.cos(phi2) * sinHalfDeltaLambda * sinHalfDeltaLambda;

  const angularDistance = 2 * Math.atan2(Math.sqrt(squareHalfChordLength), Math.sqrt(1 - squareHalfChordLength));

  return EARTH_RADIUS_METERS * angularDistance;
}

/**
 * Computes forward azimuth/bearing from point A to point B.
 * @returns Bearing in degrees (0..360, where 0 is North)
 */
export function bearing(from: GeoPoint, to: GeoPoint): number {
  const phi1 = toRadians(from.lat);
  const phi2 = toRadians(to.lat);
  const deltaLambda = toRadians(to.lng - from.lng);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return (toDegrees(theta) + 360) % 360;
}

/**
 * Computes destination point given origin, initial bearing, and distance.
 */
export function destinationPoint(origin: GeoPoint, initialBearingDeg: number, distanceMeters: number): GeoPoint {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const initialBearingRad = toRadians(initialBearingDeg);
  const phi1 = toRadians(origin.lat);
  const lambda1 = toRadians(origin.lng);

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(angularDistance) +
    Math.cos(phi1) * Math.sin(angularDistance) * Math.cos(initialBearingRad)
  );

  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(initialBearingRad) * Math.sin(angularDistance) * Math.cos(phi1),
      Math.cos(angularDistance) - Math.sin(phi1) * Math.sin(phi2)
    );

  return {
    lat: toDegrees(phi2),
    lng: ((toDegrees(lambda2) + 540) % 360) - 180, // Normalise to -180..+180
  };
}

/**
 * Calculates perpendicular cross-track distance from a point to a great-circle path (segment A -> B).
 * Positive if point is right of course, negative if left.
 * @returns Cross-track distance in meters
 */
export function crossTrackDistance(point: GeoPoint, segStart: GeoPoint, segEnd: GeoPoint): number {
  const d13 = haversineDistance(segStart, point) / EARTH_RADIUS_METERS; // Angular distance
  const theta13 = toRadians(bearing(segStart, point));
  const theta12 = toRadians(bearing(segStart, segEnd));

  const crossTrackAngular = Math.asin(Math.sin(d13) * Math.sin(theta13 - theta12));
  return Math.abs(crossTrackAngular * EARTH_RADIUS_METERS);
}

/**
 * Validates whether a given coordinate object has valid numeric WGS84 coordinates.
 */
export function isValidCoordinate(
  coord?: { lat?: number | null; lng?: number | null; latitude?: number | null; longitude?: number | null } | null
): coord is GeoPoint {
  if (!coord) return false;
  const lat = typeof coord.lat === 'number' ? coord.lat : (coord as any).latitude;
  const lng = typeof coord.lng === 'number' ? coord.lng : (coord as any).longitude;

  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}
