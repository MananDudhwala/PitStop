import { create } from 'zustand';
import { CorridorPOI, GeoPoint, RiderTelemetry, PositionInput } from '@/types';
import { isValidCoordinate } from '@/geospatial';

export interface RiderState {
  telemetry: RiderTelemetry;
  watchId: number | null;
  offRouteThresholdMeters: number;

  // Actions
  updatePosition: (coords: PositionInput) => void;
  setWatchId: (id: number | null) => void;
  stopTracking: () => void;
  setNextPOI: (poi: CorridorPOI | null) => void;
  setDistanceToNextPOI: (distanceMeters: number | null) => void;
  setDistanceRemaining: (distanceMeters: number | null) => void;
  setIsOnRoute: (isOnRoute: boolean) => void;
}

const initialTelemetry: RiderTelemetry = {
  currentPosition: null,
  heading: null,
  speed: null,
  accuracy: null,
  isOnRoute: true,
  distanceToNextPOI: null,
  nextPOI: null,
  distanceRemaining: null,
  isTracking: false,
  lastUpdated: Date.now(),
};

export const useRiderStore = create<RiderState>()((set) => ({
  telemetry: initialTelemetry,
  watchId: null,
  offRouteThresholdMeters: 100, // Alert if rider deviates >100m from route polyline

  updatePosition: (coords) =>
    set((state) => {
      const lat = 'latitude' in coords ? coords.latitude : coords.lat;
      const lng = 'longitude' in coords ? coords.longitude : coords.lng;

      if (!isValidCoordinate({ lat, lng })) {
        console.warn('Invalid GPS coordinates ignored by riderStore:', coords);
        return state;
      }

      return {
        telemetry: {
          ...state.telemetry,
          currentPosition: { lat, lng },
          heading: coords.heading ?? state.telemetry.heading,
          speed: coords.speed ?? state.telemetry.speed,
          accuracy: coords.accuracy ?? state.telemetry.accuracy,
          isTracking: true,
          lastUpdated: Date.now(),
        },
      };
    }),

  setWatchId: (watchId) => set({ watchId }),

  stopTracking: () =>
    set((state) => {
      if (state.watchId !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(state.watchId);
      }
      return {
        watchId: null,
        telemetry: {
          ...state.telemetry,
          isTracking: false,
        },
      };
    }),

  setNextPOI: (nextPOI) =>
    set((state) => ({
      telemetry: { ...state.telemetry, nextPOI },
    })),

  setDistanceToNextPOI: (distanceToNextPOI) =>
    set((state) => ({
      telemetry: { ...state.telemetry, distanceToNextPOI },
    })),

  setDistanceRemaining: (distanceRemaining) =>
    set((state) => ({
      telemetry: { ...state.telemetry, distanceRemaining },
    })),

  setIsOnRoute: (isOnRoute) =>
    set((state) => ({
      telemetry: { ...state.telemetry, isOnRoute },
    })),
}));
