import { create } from 'zustand';
import { CorridorPOI, FuelGapAlert, POICategory, POIFilterState } from '@/types';
import { useRouteStore } from './routeStore';

export interface PipelineAudit {
  dataSource: 'live-overpass' | 'indexeddb-cache' | 'synthetic-fallback';
  rawElementsCount: number;
  inCorridorCount: number;
  deduplicatedCount: number;
  mirrorUsed?: string;
  overpassQuery?: string;
  queriedAt: number;
}

export interface POIState {
  pois: CorridorPOI[];
  selectedPOI: CorridorPOI | null;
  filters: POIFilterState;
  fuelGapAlerts: FuelGapAlert[];
  isLoadingPOIs: boolean;
  poiError: string | null;
  audit: PipelineAudit | null;

  // Actions
  setPOIs: (pois: CorridorPOI[]) => void;
  setSelectedPOI: (poi: CorridorPOI | null) => void;
  toggleCategoryFilter: (category: POICategory) => void;
  setBufferDistance: (buffer: 2000 | 5000 | 10000) => void;
  setFuelGapAlerts: (alerts: FuelGapAlert[]) => void;
  setIsLoadingPOIs: (loading: boolean) => void;
  setPOIError: (error: string | null) => void;
  setAudit: (audit: PipelineAudit | null) => void;
  clearPOIs: () => void;

  // Selectors / Helpers
  getFilteredPOIs: () => CorridorPOI[];
}

export const usePOIStore = create<POIState>()((set, get) => ({
  pois: [],
  selectedPOI: null,
  filters: {
    showFuel: true,
    showMechanic: true,
    showRest: true,
    bufferDistance: 2000,
  },
  fuelGapAlerts: [],
  isLoadingPOIs: false,
  poiError: null,
  audit: null,

  setPOIs: (pois) => set({ pois, isLoadingPOIs: false, poiError: null }),
  setSelectedPOI: (selectedPOI) => set({ selectedPOI }),

  toggleCategoryFilter: (category) =>
    set((state) => {
      const filters = { ...state.filters };
      if (category === 'fuel') filters.showFuel = !filters.showFuel;
      if (category === 'mechanic') filters.showMechanic = !filters.showMechanic;
      if (category === 'rest') filters.showRest = !filters.showRest;
      return { filters };
    }),

  setBufferDistance: (bufferDistance) =>
    set((state) => ({
      filters: { ...state.filters, bufferDistance },
    })),

  setFuelGapAlerts: (fuelGapAlerts) => set({ fuelGapAlerts }),
  setIsLoadingPOIs: (isLoadingPOIs) => set({ isLoadingPOIs }),
  setPOIError: (poiError) => set({ poiError, isLoadingPOIs: false }),
  setAudit: (audit) => set({ audit }),

  clearPOIs: () =>
    set({
      pois: [],
      selectedPOI: null,
      fuelGapAlerts: [],
      isLoadingPOIs: false,
      poiError: null,
      audit: null,
    }),

  getFilteredPOIs: () => {
    const { pois, filters } = get();
    const activeBuffer = useRouteStore.getState().corridorBuffer || filters.bufferDistance || 2000;

    return pois.filter((poi) => {
      if (poi.category === 'fuel' && !filters.showFuel) return false;
      if (poi.category === 'mechanic' && !filters.showMechanic) return false;
      if (poi.category === 'rest' && !filters.showRest) return false;
      if (poi.distanceFromRoute > activeBuffer) return false;
      return true;
    });
  },
}));
