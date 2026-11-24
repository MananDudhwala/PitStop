import { GeoPoint, RouteGeometry } from './geo.types';

export interface MapplsPlace {
  eLoc?: string;
  placeName: string;
  placeAddress?: string;
  latitude: number | string;
  longitude: number | string;
  type?: string;
  distance?: number;
  brandName?: string;
}

export interface MapplsSearchResponse {
  suggestedLocations: MapplsPlace[];
}

export interface MapplsRouteResponse {
  code: string;
  routes: Array<{
    geometry: RouteGeometry | string;
    distance: number;
    duration: number;
  }>;
}

export interface PhotonFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

export interface PhotonResponse {
  type: 'FeatureCollection';
  features: PhotonFeature[];
}

export interface OSRMStep {
  name: string;
  distance: number;
  duration: number;
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number];
  };
}

export interface OSRMLeg {
  distance: number;
  duration: number;
  steps: OSRMStep[];
  summary: string;
}

export interface OSRMRoute {
  geometry: RouteGeometry | string;
  distance: number;
  duration: number;
  legs: OSRMLeg[];
  weight_name: string;
}

export interface OSRMResponse {
  code: string;
  routes: OSRMRoute[];
  waypoints?: Array<{
    name: string;
    location: [number, number];
  }>;
}

export interface OverpassElement {
  type: 'node' | 'way' | 'relation' | string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  nodes?: number[];
}

export interface OverpassResponse {
  version: number;
  generator: string;
  elements: OverpassElement[];
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

export interface APIEndpoint {
  url: string;
  name: string;
  priority: number;
  lastFailure?: number;
  failureCount: number;
}
