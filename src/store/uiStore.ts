import { create } from 'zustand';
import { DrawerSnapPoint } from '@/types';

export interface UIState {
  drawerSnapPoint: DrawerSnapPoint;
  isSearchFocused: boolean;
  activeSearchField: 'origin' | 'destination' | null;
  isMobile: boolean;
  showFuelGapBanner: boolean;
  selectedPOIIdForHandoff: string | null;

  // Actions
  setDrawerSnapPoint: (snapPoint: DrawerSnapPoint) => void;
  setIsSearchFocused: (focused: boolean) => void;
  setActiveSearchField: (field: 'origin' | 'destination' | null) => void;
  setIsMobile: (isMobile: boolean) => void;
  setShowFuelGapBanner: (show: boolean) => void;
  setSelectedPOIIdForHandoff: (id: string | null) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  drawerSnapPoint: 'half',
  isSearchFocused: false,
  activeSearchField: null,
  isMobile: false,
  showFuelGapBanner: true,
  selectedPOIIdForHandoff: null,

  setDrawerSnapPoint: (drawerSnapPoint) => set({ drawerSnapPoint }),
  setIsSearchFocused: (isSearchFocused) => set({ isSearchFocused }),
  setActiveSearchField: (activeSearchField) => set({ activeSearchField }),
  setIsMobile: (isMobile) => set({ isMobile }),
  setShowFuelGapBanner: (showFuelGapBanner) => set({ showFuelGapBanner }),
  setSelectedPOIIdForHandoff: (selectedPOIIdForHandoff) => set({ selectedPOIIdForHandoff }),
}));
