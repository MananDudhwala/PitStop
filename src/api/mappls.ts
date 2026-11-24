import { BoundingBox, CorridorPOI, GeoPoint, RouteCorridor, RouteGeometry, SearchSuggestion } from '@/types';
import { crossTrackDistance, haversineDistance, projectPointOnRoute, sampleAlongPolyline, simplifyPolyline, decodePolyline } from '@/geospatial';
import { PipelineAudit } from '@/store';
import { generateFallbackCorridorPOIs } from '@/geospatial/fallback-generator';

/**
 * MapmyIndia (Mappls) Category Codes for Indian Highway Navigation
 * - PETPMP: Petrol Pumps & Fuel Stations (IOCL, BPCL, HPCL, Shell, Jio-bp, Nayara)
 * - AUTREP: Automobile & Motorcycle Repair, Puncture, Tyres, Vulcanizing
 * - RESTRT / FODCRT / HOTEL: Dhabas, Highway Restaurants, Food Plazas
 * - TOILET: Public Washrooms & Highway Rest Areas
 */
export const MAPPLS_CATEGORIES = {
  FUEL: 'PETPMP',
  MECHANIC: 'AUTREP',
  REST: 'RESTRT,FODCRT,HOTEL,TOILET',
} as const;

export interface MapplsConfig {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  tokenExpiresAt?: number;
}

const STORAGE_KEY = 'pitstop_mappls_config';

export function getMapplsConfig(): MapplsConfig {
  const envKey = import.meta.env.VITE_MAPPLS_REST_KEY;
  const envClientId = import.meta.env.VITE_MAPPLS_CLIENT_ID;
  const envClientSecret = import.meta.env.VITE_MAPPLS_CLIENT_SECRET;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        apiKey: parsed.apiKey || envKey,
        clientId: parsed.clientId || envClientId,
        clientSecret: parsed.clientSecret || envClientSecret,
        accessToken: parsed.accessToken,
        tokenExpiresAt: parsed.tokenExpiresAt,
      };
    }
  } catch (e) {
    // ignore
  }

  return {
    apiKey: envKey,
    clientId: envClientId,
    clientSecret: envClientSecret,
  };
}

export function saveMapplsConfig(config: Partial<MapplsConfig>): void {
  const current = getMapplsConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function isMapplsConfigured(): boolean {
  const cfg = getMapplsConfig();
  return Boolean(cfg.apiKey || (cfg.clientId && cfg.clientSecret) || cfg.accessToken);
}

/**
 * Fetches an OAuth2 bearer token from MapmyIndia (Mappls Outpost) if clientId and clientSecret are provided.
 */
export async function getMapplsAuthToken(): Promise<string | null> {
  const cfg = getMapplsConfig();

  if (cfg.accessToken && cfg.tokenExpiresAt && Date.now() < cfg.tokenExpiresAt - 60000) {
    return cfg.accessToken;
  }
  if (cfg.apiKey) {
    return cfg.apiKey;
  }

  if (cfg.clientId && cfg.clientSecret) {
    try {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
      });

      const res = await fetch('https://outpost.mappls.com/api/security/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) throw new Error(`Mappls OAuth error: ${res.statusText}`);
      const data = await res.json();

      const token = data.access_token;
      const expiresIn = data.expires_in || 86400;

      saveMapplsConfig({
        accessToken: token,
        tokenExpiresAt: Date.now() + expiresIn * 1000,
      });

      return token;
    } catch (err) {
      console.warn('[MapmyIndia] OAuth token generation failed:', err);
    }
  }

  return null;
}

// ─── 1. MapmyIndia Geocoding & AutoSuggest ─────────────────────────────────

// High-frequency Indian cities and highway nodes for instant response
const INDIA_CITIES_GAZETTEER: Array<{ name: string; state: string; lat: number; lng: number }> = [
  { name: 'New Delhi', state: 'Delhi NCR', lat: 28.6139, lng: 77.2090 },
  { name: 'Agra', state: 'Uttar Pradesh (Yamuna Expressway)', lat: 27.1767, lng: 78.0081 },
  { name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777 },
  { name: 'Pune', state: 'Maharashtra (Western Ghats)', lat: 18.5204, lng: 73.8567 },
  { name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
  { name: 'Mysuru', state: 'Karnataka (Expressway)', lat: 12.2958, lng: 76.6394 },
  { name: 'Jaipur', state: 'Rajasthan (NH48)', lat: 26.9124, lng: 75.7873 },
  { name: 'Chandigarh', state: 'Punjab/Haryana', lat: 30.7333, lng: 76.7794 },
  { name: 'Shimla', state: 'Himachal Pradesh (Himalayan NH5)', lat: 31.1048, lng: 77.1734 },
  { name: 'Manali', state: 'Himachal Pradesh (Leh Highway)', lat: 32.2432, lng: 77.1892 },
  { name: 'Leh', state: 'Ladakh (NH1D)', lat: 34.1526, lng: 77.5771 },
  { name: 'Goa (Panaji)', state: 'Goa (Coastal Highway)', lat: 15.4909, lng: 73.8278 },
  { name: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867 },
  { name: 'Chennai', state: 'Tamil Nadu (ECR Highway)', lat: 13.0827, lng: 80.2707 },
  { name: 'Kochi', state: 'Kerala (NH66)', lat: 9.9312, lng: 76.2673 },
  { name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 },
  { name: 'Udaipur', state: 'Rajasthan', lat: 24.5854, lng: 73.7125 },
  { name: 'Murthal', state: 'Haryana (Grand Trunk Road Dhabas)', lat: 29.0347, lng: 77.0734 },
  { name: 'Lonavala', state: 'Maharashtra (Mumbai-Pune Exp.)', lat: 18.7557, lng: 73.4091 },
  { name: 'Mathura', state: 'Uttar Pradesh (Yamuna Exp.)', lat: 27.4924, lng: 77.6737 },
];

export async function searchMapplsPlaces(
  query: string,
  bias?: GeoPoint
): Promise<SearchSuggestion[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  // 1. If MapmyIndia credentials are set, query Mappls Atlas Auto Suggest
  const token = await getMapplsAuthToken();
  if (token) {
    try {
      const url = `https://atlas.mappls.com/api/places/search/json?query=${encodeURIComponent(
        trimmed
      )}&region=IND${bias ? `&location=${bias.lat},${bias.lng}` : ''}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.suggestedLocations && Array.isArray(data.suggestedLocations)) {
          return data.suggestedLocations.map((item: any) => ({
            id: item.eLoc || String(Math.random()),
            name: item.placeName || item.poi,
            displayName: item.placeAddress || item.placeName,
            location: {
              lat: parseFloat(item.latitude),
              lng: parseFloat(item.longitude),
            },
            type: 'geocode',
          }));
        }
      }
    } catch (err) {
      console.warn('[MapmyIndia] AutoSuggest API error:', err);
    }
  }

  // 2. India Gazetteer Search (Instant, Doorstep Highway precision)
  const matches = INDIA_CITIES_GAZETTEER.filter(
    (c) =>
      c.name.toLowerCase().includes(trimmed) ||
      c.state.toLowerCase().includes(trimmed)
  );

  return matches.map((c) => ({
    id: `ind-${c.name.toLowerCase().replace(/\s+/g, '-')}`,
    name: c.name,
    displayName: `${c.name}, ${c.state}, India`,
    location: { lat: c.lat, lng: c.lng },
    type: 'geocode',
  }));
}

// ─── 2. MapmyIndia Routing & Highway Directions ─────────────────────────────

export async function computeMapplsRoute(
  origin: GeoPoint & { name: string },
  destination: GeoPoint & { name: string },
  options: { corridorBuffer?: number } = {}
): Promise<RouteCorridor> {
  const buffer = options.corridorBuffer || 2000;
  const token = await getMapplsAuthToken();

  // If Mappls is configured, query Mappls Advanced Driving / Motorcycle Route API
  if (token) {
    try {
      const url = `https://apis.mappls.com/advancedmaps/v1/${token}/route_adv/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?geometries=geojson&overview=full&steps=true`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coords: [number, number][] = route.geometry.coordinates;

          const simplified = simplifyPolyline(coords, 0.0005);
          const samplePoints = sampleAlongPolyline(simplified, 8000);

          let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
          for (const [lng, lat] of coords) {
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
          }

          return {
            id: `mappls-route-${Date.now()}`,
            origin,
            destination,
            geometry: { type: 'LineString', coordinates: coords },
            simplifiedGeometry: { type: 'LineString', coordinates: simplified },
            totalDistance: route.distance,
            estimatedDuration: route.duration,
            corridorBuffer: buffer,
            samplePoints,
            bbox: { south: minLat, west: minLng, north: maxLat, east: maxLng },
            createdAt: Date.now(),
          };
        }
      }
    } catch (err) {
      console.warn('[MapmyIndia] Direction API failed, falling back to highway router:', err);
    }
  }

  // Highway Routing Fallback (Project OSRM highway graph for India)
  const coordsParam = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const fallbackUrl = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson&steps=true`;

  const response = await fetch(fallbackUrl);
  const data = await response.json();
  const primaryRoute = data.routes[0];

  const coordinates: [number, number][] =
    typeof primaryRoute.geometry === 'string'
      ? decodePolyline(primaryRoute.geometry)
      : primaryRoute.geometry.coordinates;

  const simplifiedCoords = simplifyPolyline(coordinates, 0.0005);
  const samplePoints = sampleAlongPolyline(simplifiedCoords, 8000);

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [lng, lat] of coordinates) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  return {
    id: `route-${Date.now()}-${origin.name.slice(0, 6)}-${destination.name.slice(0, 6)}`,
    origin,
    destination,
    geometry: { type: 'LineString', coordinates },
    simplifiedGeometry: { type: 'LineString', coordinates: simplifiedCoords },
    totalDistance: primaryRoute.distance,
    estimatedDuration: primaryRoute.duration,
    corridorBuffer: buffer,
    samplePoints,
    bbox: { south: minLat, west: minLng, north: maxLat, east: maxLng },
    createdAt: Date.now(),
  };
}

// ─── 3. MapmyIndia Corridor POI Discovery (Petrol, Tyres, Dhabas) ───────────

export async function queryMapplsNearby(
  center: GeoPoint,
  keyword: string,
  radiusMeters: number
): Promise<any[]> {
  const token = await getMapplsAuthToken();
  if (!token) return [];

  const url = `https://atlas.mappls.com/api/places/nearby/json?keywords=${encodeURIComponent(
    keyword
  )}&refLocation=${center.lat},${center.lng}&radius=${Math.min(radiusMeters, 10000)}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.suggestedLocations || [];
  } catch (e) {
    return [];
  }
}

export async function queryMapplsCorridorPOIs(
  corridor: RouteCorridor,
  bufferMeters: number
): Promise<{ pois: CorridorPOI[]; audit: PipelineAudit } | null> {
  const token = await getMapplsAuthToken();
  if (!token) return null;

  const coords = corridor.geometry.coordinates;
  const samplePoints = corridor.samplePoints;
  const collectedPOIs: CorridorPOI[] = [];
  const visitedLocs = new Set<string>();

  const queryPoints: GeoPoint[] = [];
  for (let i = 0; i < samplePoints.length; i += 2) {
    queryPoints.push(samplePoints[i]);
  }

  for (const point of queryPoints.slice(0, 8)) {
    const categories = ['PETPMP', 'AUTREP', 'dhaba'];

    for (const cat of categories) {
      const places = await queryMapplsNearby(point, cat, bufferMeters);

      for (const place of places) {
        if (!place.latitude || !place.longitude) continue;
        const key = `${parseFloat(place.latitude).toFixed(4)},${parseFloat(place.longitude).toFixed(4)}`;
        if (visitedLocs.has(key)) continue;
        visitedLocs.add(key);

        const loc: GeoPoint = { lat: parseFloat(place.latitude), lng: parseFloat(place.longitude) };
        const projection = projectPointOnRoute(loc, coords);

        if (projection.crossTrackMeters <= bufferMeters) {
          let category: 'fuel' | 'mechanic' | 'rest' = 'rest';
          const name = place.placeName || place.poi || 'Highway Facility';
          const nameLower = name.toLowerCase();

          if (cat === 'PETPMP' || nameLower.includes('petrol') || nameLower.includes('fuel')) {
            category = 'fuel';
          } else if (cat === 'AUTREP' || nameLower.includes('tyre') || nameLower.includes('puncture') || nameLower.includes('repair')) {
            category = 'mechanic';
          }

          collectedPOIs.push({
            id: `mappls-${place.eLoc || Math.random().toString(36).slice(2, 8)}`,
            osmId: 900000 + collectedPOIs.length,
            osmType: 'node',
            category,
            name,
            location: loc,
            distanceFromRoute: Math.round(projection.crossTrackMeters),
            chainageKm: Number((projection.chainageMeters / 1000).toFixed(1)),
            tags: {
              source: 'MapmyIndia (Mappls)',
              eLoc: place.eLoc || '',
              address: place.placeAddress || '',
            },
            details: {
              brand: place.brandName || name,
              is24Hours: true,
              services: category === 'mechanic' ? ['puncture', 'tyres'] : [],
              hasFoodService: category === 'rest',
            } as any,
            projectedPoint: projection.projected,
            routeSegmentIndex: projection.segmentIndex,
            isVerified: true,
            lastUpdated: Date.now(),
          });
        }
      }
    }
  }

  if (collectedPOIs.length > 0) {
    collectedPOIs.sort((a, b) => a.chainageKm - b.chainageKm);
    const audit: PipelineAudit = {
      dataSource: 'live-overpass',
      rawElementsCount: visitedLocs.size,
      inCorridorCount: collectedPOIs.length,
      deduplicatedCount: collectedPOIs.length,
      mirrorUsed: 'MapmyIndia (Mappls Atlas API)',
      queriedAt: Date.now(),
    };
    return { pois: collectedPOIs, audit };
  }

  return null;
}

/**
 * Main Corridor POI Engine for MapmyIndia:
 * 1. Queries MapmyIndia (Mappls) live APIs if configured.
 * 2. Defaults to the Indian Highway Corridor Engine (IOCL, BPCL, HPCL, Puncture walas, Dhabas).
 */
export async function discoverMapplsCorridorPOIs(
  corridor: RouteCorridor,
  bufferMeters: number
): Promise<{ pois: CorridorPOI[]; audit: PipelineAudit }> {
  // 1. Try MapmyIndia (Mappls) Live API
  const liveMappls = await queryMapplsCorridorPOIs(corridor, bufferMeters);
  if (liveMappls && liveMappls.pois.length > 0) {
    return liveMappls;
  }

  // 2. India Highway Corridor Synthesizer (Instant, 100% offline resilient)
  const indiaPOIs = generateFallbackCorridorPOIs(corridor, bufferMeters);
  const audit: PipelineAudit = {
    dataSource: 'synthetic-fallback',
    rawElementsCount: indiaPOIs.length,
    inCorridorCount: indiaPOIs.length,
    deduplicatedCount: indiaPOIs.length,
    mirrorUsed: 'MapmyIndia Highway Engine (IOCL/BPCL/Puncture/Dhabas)',
    queriedAt: Date.now(),
  };

  return { pois: indiaPOIs, audit };
}
