import { CorridorPOI, RouteCorridor } from '@/types';
import { discoverMapplsCorridorPOIs } from './mappls';
import { PipelineAudit } from '@/store';

export interface DiscoverResult {
  pois: CorridorPOI[];
  audit: PipelineAudit;
}

/**
 * Discovers pit stops (Petrol, Puncture, Mechanics, Dhabas) along the corridor
 * using MapmyIndia (Mappls).
 */
export async function discoverCorridorPOIs(
  corridor: RouteCorridor,
  bufferMeters: number
): Promise<DiscoverResult> {
  return discoverMapplsCorridorPOIs(corridor, bufferMeters);
}

// Retained for backward-compatibility
export async function queryCorridorPOIs(): Promise<any[]> {
  return [];
}
