import { GeoPoint } from './geo.types';
import { CorridorPOI } from './poi.types';

export interface RiderTelemetry {
  currentPosition: GeoPoint | null;
  heading: number | null;            // 0..360 degrees
  speed: number | null;              // m/s
  accuracy: number | null;           // meters
  isOnRoute: boolean;
  distanceToNextPOI: number | null;  // meters
  nextPOI: CorridorPOI | null;
  distanceRemaining: number | null;  // meters to final destination
  isTracking: boolean;
  lastUpdated: number;               // epoch ms
}

export type PositionInput =
  | GeolocationCoordinates
  | { latitude: number; longitude: number; heading?: number | null; speed?: number | null; accuracy?: number | null }
  | { lat: number; lng: number; heading?: number | null; speed?: number | null; accuracy?: number | null };

export interface GPSWatchConfig {
  enableHighAccuracy: boolean;
  maximumAge: number;
  timeout: number;
}
