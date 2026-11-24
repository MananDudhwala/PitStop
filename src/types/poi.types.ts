import { GeoPoint, RouteGeometry } from './geo.types';

export type POICategory = 'fuel' | 'mechanic' | 'rest';

export interface FuelDetails {
  brand?: string;
  fuelGrades?: string[]; // e.g. ["regular", "premium", "diesel", "cng", "lpg"]
  is24Hours: boolean;
  hasAirPressure?: boolean;
  hasATM?: boolean;
}

export interface MechanicDetails {
  services: string[]; // e.g. ["puncture", "tyre_change", "engine_oil", "chain_lube", "welding"]
  vehicleTypes?: string[]; // e.g. ["motorcycle", "car", "heavy_vehicle"]
  is24Hours?: boolean;
  contactNumber?: string;
}

export interface RestStopDetails {
  subtype: 'cafe' | 'restaurant' | 'dhaba' | 'toilets' | 'rest_area' | 'viewpoint';
  hasFoodService: boolean;
  hasWashrooms: boolean;
  hasParking: boolean;
  openingHours?: string;
}

export interface CorridorPOI {
  id: string;
  eLoc?: string;             // MapmyIndia Mappls Digital Address Code (e.g. "123XYZ")
  osmId?: number;
  osmType?: 'node' | 'way' | 'relation' | string;
  category: POICategory;
  name: string;
  location: GeoPoint;
  distanceFromRoute: number; // perpendicular cross-track detour distance in meters
  chainageKm: number;        // cumulative distance from origin along route in kilometers
  tags: Record<string, string>; // normalized metadata tags (Mappls & road telemetry)
  details: FuelDetails | MechanicDetails | RestStopDetails;
  projectedPoint: GeoPoint;  // closest point on route polyline
  routeSegmentIndex: number; // index of nearest segment
  isVerified?: boolean;
  lastUpdated?: number;
}

export interface FuelGapAlert {
  id: string;
  startStation: CorridorPOI | { name: string; chainageKm: number };
  endStation: CorridorPOI | { name: string; chainageKm: number };
  gapDistanceKm: number;
  thresholdKm: number;
  severity: 'warning' | 'critical'; // warning: gap > threshold (default 60km); critical: gap > 1.5x threshold
  segmentGeometry?: RouteGeometry;
}
