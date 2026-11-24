import { GeoPoint, SearchSuggestion } from '@/types';
import { searchMapplsPlaces } from './mappls';

export interface GeocodeOptions {
  bias?: GeoPoint;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Autocomplete place search powered by MapmyIndia (Mappls).
 */
export async function geocodeSearch(
  query: string,
  options: GeocodeOptions = {}
): Promise<SearchSuggestion[]> {
  return searchMapplsPlaces(query, options.bias);
}

/**
 * Reverse geocoding for MapmyIndia coordinates.
 */
export async function reverseGeocode(point: GeoPoint): Promise<string> {
  return `${point.lat.toFixed(4)}°N, ${point.lng.toFixed(4)}°E (India)`;
}
