// ─── Domain Types ──────────────────────────────────────────────────────────

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export type POICategory =
  | 'fuel'
  | 'food'
  | 'rest_area'
  | 'hospital'
  | 'atm'
  | 'parking'
  | 'ev_charging'
  | 'mechanic'
  | 'hotel'
  | 'toilet'
  | 'police'
  | 'other';

export interface CorridorPOI {
  id: number;
  lat: number;
  lng: number;
  category: POICategory;
  name: string;
  details: Record<string, string>;
  chainageMeters: number; // distance along route from start
  crossTrackMeters: number; // perpendicular distance from route
}

export interface FuelGapAlert {
  startChainageKm: number;
  endChainageKm: number;
  gapKm: number;
  startPOI: CorridorPOI | null;
  endPOI: CorridorPOI | null;
}

// ─── Worker Message Types (discriminated union) ────────────────────────────

export type WorkerMessageType =
  | 'simplify-polyline'
  | 'sample-waypoints'
  | 'filter-corridor-pois'
  | 'analyze-fuel-gaps';

// ── Request payloads ───────────────────────────────────────────────────────

export interface SimplifyPolylinePayload {
  coords: [number, number][];
  tolerance: number;
}

export interface SampleWaypointsPayload {
  coords: [number, number][];
  intervalMeters: number;
}

export interface FilterCorridorPOIsPayload {
  pois: OverpassElement[];
  routeCoords: [number, number][];
  bufferMeters: number;
}

export interface AnalyzeFuelGapsPayload {
  fuelPOIs: CorridorPOI[];
  totalRouteDistance: number;
  thresholdKm: number;
}

// ── Discriminated WorkerRequest ────────────────────────────────────────────

export type WorkerRequest =
  | {
      id: string;
      type: 'simplify-polyline';
      payload: SimplifyPolylinePayload;
    }
  | {
      id: string;
      type: 'sample-waypoints';
      payload: SampleWaypointsPayload;
    }
  | {
      id: string;
      type: 'filter-corridor-pois';
      payload: FilterCorridorPOIsPayload;
    }
  | {
      id: string;
      type: 'analyze-fuel-gaps';
      payload: AnalyzeFuelGapsPayload;
    };

// ── Discriminated WorkerResponse ───────────────────────────────────────────

export type WorkerResponse =
  | {
      id: string;
      type: 'simplify-polyline';
      result: [number, number][];
      error?: undefined;
    }
  | {
      id: string;
      type: 'sample-waypoints';
      result: GeoPoint[];
      error?: undefined;
    }
  | {
      id: string;
      type: 'filter-corridor-pois';
      result: CorridorPOI[];
      error?: undefined;
    }
  | {
      id: string;
      type: 'analyze-fuel-gaps';
      result: FuelGapAlert[];
      error?: undefined;
    }
  | {
      id: string;
      type: WorkerMessageType;
      result?: undefined;
      error: string;
    };
