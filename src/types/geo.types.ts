/**
 * Geospatial primitive types for PitStop
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][]; // [longitude, latitude] per GeoJSON specification
}

export interface RouteSegment {
  start: GeoPoint;
  end: GeoPoint;
  bearing: number; // degrees 0..360
  length: number;  // meters
}

export interface RouteCorridor {
  id: string;
  origin: GeoPoint & { name: string };
  destination: GeoPoint & { name: string };
  geometry: RouteGeometry;
  simplifiedGeometry: RouteGeometry; // RDP simplified (~0.0005° tolerance) for spatial querying
  totalDistance: number;             // meters
  estimatedDuration: number;         // seconds
  corridorBuffer: number;            // meters (2000, 5000, 10000)
  samplePoints: GeoPoint[];          // waypoints sampled along route
  bbox: BoundingBox;
  createdAt: number;
}
