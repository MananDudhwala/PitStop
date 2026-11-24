import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { geocodeSearch } from '@/api';
import { GeoPoint, SearchSuggestion } from '@/types';
import { CacheManager } from '@/offline';

export function useGeocodeSearch(biasPoint?: GeoPoint) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce user keystrokes (300ms) and cancel stale in-flight requests
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(searchTerm.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: suggestions = [], isLoading, error } = useQuery({
    queryKey: ['geocode', debouncedQuery, biasPoint?.lat, biasPoint?.lng],
    queryFn: async () => {
      if (!debouncedQuery) return [];

      // Check IndexedDB cache first
      const cached = await CacheManager.getCachedGeocode(debouncedQuery);
      if (cached && cached.length > 0) {
        return cached;
      }

      abortControllerRef.current = new AbortController();
      const results = await geocodeSearch(debouncedQuery, {
        bias: biasPoint,
        signal: abortControllerRef.current.signal,
      });

      if (results.length > 0) {
        await CacheManager.cacheGeocode(debouncedQuery, results);
      }

      return results;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000,    // 30 minutes
  });

  return {
    searchTerm,
    setSearchTerm,
    suggestions,
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
