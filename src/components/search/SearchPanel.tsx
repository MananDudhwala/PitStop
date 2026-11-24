import React from 'react';
import { useRouteStore, useMapStore, usePOIStore } from '@/store';
import { useRoute } from '@/hooks';
import { SearchInput } from './SearchInput';
import { GeoPoint } from '@/types';

interface PresetRide {
  label: string;
  distance: string;
  origin: GeoPoint & { name: string };
  destination: GeoPoint & { name: string };
}

const PRESET_RIDES: PresetRide[] = [
  {
    label: 'Delhi ➔ Agra',
    distance: '215 km • Yamuna Exp.',
    origin: { lat: 28.6139, lng: 77.209, name: 'New Delhi' },
    destination: { lat: 27.1767, lng: 78.0081, name: 'Agra, Taj Express' },
  },
  {
    label: 'Mumbai ➔ Pune',
    distance: '148 km • Western Ghats',
    origin: { lat: 19.076, lng: 72.8777, name: 'Mumbai' },
    destination: { lat: 18.5204, lng: 73.8567, name: 'Pune' },
  },
  {
    label: 'Bengaluru ➔ Mysuru',
    distance: '144 km • Expressway',
    origin: { lat: 12.9716, lng: 77.5946, name: 'Bengaluru' },
    destination: { lat: 12.2958, lng: 76.6394, name: 'Mysuru' },
  },
];

export const SearchPanel: React.FC = () => {
  const {
    origin,
    destination,
    corridorBuffer,
    setOrigin,
    setDestination,
    setCorridorBuffer,
    swapEndpoints,
  } = useRouteStore();

  const setPOIBuffer = usePOIStore((s) => s.setBufferDistance);
  const mapCenter = useMapStore((s) => s.center);
  const { requestRoute, isLoading, error } = useRoute();

  const handleUseLocationForOrigin = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            setOrigin({
              lat,
              lng,
              name: 'My Current Location',
            });
            // Immediately sync with rider telemetry & center map
            useRiderStore.getState().updatePosition(pos.coords);
            useMapStore.getState().setCenter({ lat, lng });
            useMapStore.getState().setZoom(13);
          }
        },
        (err) => {
          console.warn('Geolocation access error:', err.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    }
  };

  const handleSelectPreset = (preset: PresetRide) => {
    setOrigin(preset.origin);
    setDestination(preset.destination);
    requestRoute(preset.origin, preset.destination);
  };

  const handleBufferChange = (dist: 2000 | 5000 | 10000) => {
    setCorridorBuffer(dist);
    setPOIBuffer(dist);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        backgroundColor: 'var(--surface-elevated)',
        padding: 16,
        borderRadius: 'var(--radius)',
        border: '1px solid var(--surface-border)',
        boxShadow: 'var(--shadow-hud)',
      }}
    >
      {/* Route Inputs Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
        <SearchInput
          label="Origin"
          placeholder="Where are you starting from?"
          value={origin?.name || ''}
          biasPoint={mapCenter}
          onSelect={(s) => setOrigin({ ...s.location, name: s.name })}
          onClear={() => setOrigin(null)}
          onUseCurrentLocation={handleUseLocationForOrigin}
          iconType="origin"
        />

        <div style={{ display: 'flex', justifyContent: 'center', margin: '-4px 0' }}>
          <button
            type="button"
            onClick={swapEndpoints}
            title="Swap Origin and Destination"
            style={{
              width: 32,
              height: 32,
              minWidth: 32,
              minHeight: 32,
              borderRadius: '50%',
              backgroundColor: 'var(--surface-overlay)',
              border: '1px solid var(--surface-border)',
              color: 'var(--text-secondary)',
              zIndex: 2,
            }}
          >
            ⇅
          </button>
        </div>

        <SearchInput
          label="Destination"
          placeholder="Where are you riding to?"
          value={destination?.name || ''}
          biasPoint={origin || mapCenter}
          onSelect={(s) => setDestination({ ...s.location, name: s.name })}
          onClear={() => setDestination(null)}
          iconType="destination"
        />
      </div>

      {/* Extended Corridor Buffer Selector (2km / 5km / 10km) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
          Corridor Reach:
        </span>
        <div
          style={{
            display: 'inline-flex',
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--radius-sm)',
            padding: 3,
            border: '1px solid var(--surface-border)',
          }}
        >
          {([2000, 5000, 10000] as const).map((dist) => (
            <button
              key={dist}
              type="button"
              onClick={() => handleBufferChange(dist)}
              style={{
                minHeight: 32,
                minWidth: 58,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                backgroundColor: corridorBuffer === dist ? 'var(--accent-amber)' : 'transparent',
                color: corridorBuffer === dist ? '#000' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              {`${dist / 1000} km`}
            </button>
          ))}
        </div>
      </div>

      {/* One-Tap Popular Rider Routes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
          Quick Popular Rides:
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PRESET_RIDES.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              style={{
                padding: '5px 10px',
                minHeight: 30,
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--surface-border)',
                color: 'var(--text-primary)',
                fontSize: 11,
                fontWeight: 600,
                textAlign: 'left',
                gap: 4,
              }}
            >
              <span style={{ color: 'var(--accent-amber)' }}>{preset.label}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({preset.distance.split('•')[0]})</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--danger)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Find Route Button */}
      <button
        type="button"
        disabled={isLoading || !origin || !destination}
        onClick={() => requestRoute()}
        style={{
          width: '100%',
          backgroundColor: !origin || !destination ? 'var(--surface-border)' : 'var(--accent-amber)',
          color: !origin || !destination ? 'var(--text-muted)' : '#000',
          fontWeight: 700,
          fontSize: 16,
          borderRadius: 'var(--radius)',
          boxShadow: origin && destination ? '0 4px 16px rgba(245, 165, 36, 0.3)' : 'none',
          cursor: !origin || !destination ? 'not-allowed' : 'pointer',
          letterSpacing: '0.02em',
        }}
      >
        {isLoading ? 'Computing Optimal Corridor…' : 'Find Route & Pit Stops'}
      </button>
    </div>
  );
};
