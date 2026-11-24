import { create } from 'zustand';
import { GeoPoint, MapStyle } from '@/types';

export interface MapState {
  center: GeoPoint;
  zoom: number;
  mapStyle: MapStyle;
  isMapReady: boolean;
  hoveredPOIId: string | null;

  // Actions
  setCenter: (center: GeoPoint) => void;
  setZoom: (zoom: number) => void;
  setMapStyle: (mapStyle: MapStyle) => void;
  setMapReady: (isMapReady: boolean) => void;
  setHoveredPOIId: (id: string | null) => void;
}

export const useMapStore = create<MapState>()((set) => ({
  center: { lat: 28.6139, lng: 77.209 }, // Default to New Delhi or general coordinate
  zoom: 11,
  mapStyle: 'dark-hud',
  isMapReady: false,
  hoveredPOIId: null,

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setMapStyle: (mapStyle) => set({ mapStyle }),
  setMapReady: (isMapReady) => set({ isMapReady }),
  setHoveredPOIId: (hoveredPOIId) => set({ hoveredPOIId }),
}));
