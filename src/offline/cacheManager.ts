import { CorridorPOI, OfflineCacheManifest, RouteCorridor, SearchSuggestion } from '@/types';
import { getDatabase } from './db';

const ROUTE_TTL_MS = 24 * 60 * 60 * 1000;      // 24 hours
const POI_TTL_MS = 12 * 60 * 60 * 1000;        // 12 hours
const GEOCODE_TTL_MS = 2 * 60 * 60 * 1000;     // 2 hours

export class CacheManager {
  static async cacheRoute(corridor: RouteCorridor): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();
    await db.put('routes', {
      id: corridor.id,
      corridor,
      cachedAt: now,
      expiresAt: now + ROUTE_TTL_MS,
    });
  }

  static async getCachedRoute(routeId: string): Promise<RouteCorridor | null> {
    const db = await getDatabase();
    const entry = await db.get('routes', routeId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      await db.delete('routes', routeId);
      return null;
    }
    return entry.corridor;
  }

  static async cachePOIs(routeId: string, pois: CorridorPOI[]): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();
    await db.put('pois', {
      id: routeId,
      routeId,
      pois,
      cachedAt: now,
      expiresAt: now + POI_TTL_MS,
    });
  }

  static async getCachedPOIs(routeId: string): Promise<CorridorPOI[] | null> {
    const db = await getDatabase();
    const entry = await db.get('pois', routeId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      await db.delete('pois', routeId);
      return null;
    }
    return entry.pois;
  }

  static async cacheGeocode(query: string, suggestions: SearchSuggestion[]): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();
    await db.put('geocode-cache', {
      query: query.toLowerCase().trim(),
      suggestions,
      cachedAt: now,
      expiresAt: now + GEOCODE_TTL_MS,
    });
  }

  static async getCachedGeocode(query: string): Promise<SearchSuggestion[] | null> {
    const db = await getDatabase();
    const entry = await db.get('geocode-cache', query.toLowerCase().trim());
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      await db.delete('geocode-cache', query.toLowerCase().trim());
      return null;
    }
    return entry.suggestions;
  }

  static async saveManifest(manifest: OfflineCacheManifest): Promise<void> {
    const db = await getDatabase();
    await db.put('manifests', manifest);
  }

  static async getManifest(routeId: string): Promise<OfflineCacheManifest | null> {
    const db = await getDatabase();
    const manifest = await db.get('manifests', routeId);
    return manifest || null;
  }

  static async purgeExpired(): Promise<number> {
    const db = await getDatabase();
    const now = Date.now();
    let purged = 0;

    // Purge expired routes
    const routes = await db.getAll('routes');
    for (const r of routes) {
      if (now > r.expiresAt) {
        await db.delete('routes', r.id);
        purged++;
      }
    }

    // Purge expired POIs
    const pois = await db.getAll('pois');
    for (const p of pois) {
      if (now > p.expiresAt) {
        await db.delete('pois', p.id);
        purged++;
      }
    }

    return purged;
  }

  static async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.clear('routes');
    await db.clear('pois');
    await db.clear('geocode-cache');
    await db.clear('tile-cache');
    await db.clear('manifests');
  }
}
