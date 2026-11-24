import { create } from 'zustand';
import { GeoPoint, RouteCorridor } from '@/types';

export interface RouteState {
  origin: (GeoPoint & { name: string }) | null;
  destination: (GeoPoint & { name: string }) | null;
  corridor: RouteCorridor | null;
  isRouteLoading: boolean;
  routeError: string | null;
  corridorBuffer: 2000 | 5000 | 10000;

  // Actions
  setOrigin: (origin: (GeoPoint & { name: string }) | null) => void;
  setDestination: (destination: (GeoPoint & { name: string }) | null) => void;
  setCorridor: (corridor: RouteCorridor | null) => void;
  setCorridorBuffer: (buffer: 2000 | 5000 | 10000) => void;
  setIsRouteLoading: (loading: boolean) => void;
  setRouteError: (error: string | null) => void;
  clearRoute: () => void;
  swapEndpoints: () => void;
}

export const useRouteStore = create<RouteState>()((set) => ({
  origin: null,
  destination: null,
  corridor: null,
  isRouteLoading: false,
  routeError: null,
  corridorBuffer: 2000,

  setOrigin: (origin) => set({ origin, routeError: null }),
  setDestination: (destination) => set({ destination, routeError: null }),
  setCorridor: (corridor) => set({ corridor, isRouteLoading: false, routeError: null }),
  setCorridorBuffer: (corridorBuffer) => set({ corridorBuffer }),
  setIsRouteLoading: (isRouteLoading) => set({ isRouteLoading }),
  setRouteError: (routeError) => set({ routeError, isRouteLoading: false }),

  clearRoute: () =>
    set({
      origin: null,
      destination: null,
      corridor: null,
      isRouteLoading: false,
      routeError: null,
    }),

  swapEndpoints: () =>
    set((state) => ({
      origin: state.destination,
      destination: state.origin,
      corridor: null,
    })),
}));
