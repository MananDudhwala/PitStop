import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { CorridorPOI, OfflineCacheManifest, RouteCorridor, SearchSuggestion, SyncQueueItem } from '@/types';

export interface PitStopDB extends DBSchema {
  routes: {
    key: string;
    value: {
      id: string;
      corridor: RouteCorridor;
      cachedAt: number;
      expiresAt: number;
    };
    indexes: { 'by-date': number };
  };
  pois: {
    key: string;
    value: {
      id: string;
      routeId: string;
      pois: CorridorPOI[];
      cachedAt: number;
      expiresAt: number;
    };
    indexes: { 'by-route': string };
  };
  'geocode-cache': {
    key: string;
    value: {
      query: string;
      suggestions: SearchSuggestion[];
      cachedAt: number;
      expiresAt: number;
    };
  };
  'tile-cache': {
    key: string; // "z/x/y"
    value: {
      key: string;
      blob: Blob;
      cachedAt: number;
      expiresAt: number;
    };
  };
  'sync-queue': {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-created': number };
  };
  manifests: {
    key: string;
    value: OfflineCacheManifest;
  };
}

const DB_NAME = 'pitstop-geospatial-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PitStopDB>> | null = null;

export function getDatabase(): Promise<IDBPDatabase<PitStopDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PitStopDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('routes')) {
          const routeStore = db.createObjectStore('routes', { keyPath: 'id' });
          routeStore.createIndex('by-date', 'cachedAt');
        }

        if (!db.objectStoreNames.contains('pois')) {
          const poiStore = db.createObjectStore('pois', { keyPath: 'id' });
          poiStore.createIndex('by-route', 'routeId');
        }

        if (!db.objectStoreNames.contains('geocode-cache')) {
          db.createObjectStore('geocode-cache', { keyPath: 'query' });
        }

        if (!db.objectStoreNames.contains('tile-cache')) {
          db.createObjectStore('tile-cache', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('sync-queue')) {
          const syncStore = db.createObjectStore('sync-queue', { keyPath: 'id' });
          syncStore.createIndex('by-created', 'createdAt');
        }

        if (!db.objectStoreNames.contains('manifests')) {
          db.createObjectStore('manifests', { keyPath: 'routeId' });
        }
      },
    });
  }
  return dbPromise;
}
