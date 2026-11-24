import { GeoPoint } from './geo.types';

export type MapStyle = 'dark-hud' | 'street' | 'topo';

export type DrawerSnapPoint = 'collapsed' | 'half' | 'expanded';

export interface POIFilterState {
  showFuel: boolean;
  showMechanic: boolean;
  showRest: boolean;
  bufferDistance: 2000 | 5000 | 10000;
}

export interface SearchSuggestion {
  id: string;
  name: string;
  displayName: string;
  location: GeoPoint;
  type: 'geocode' | 'gps' | 'recent';
}

export interface WaypointHandoff {
  provider: 'google' | 'apple' | 'geo';
  url: string;
  label: string;
}
