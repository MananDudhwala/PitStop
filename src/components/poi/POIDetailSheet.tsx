import React from 'react';
import { usePOIStore, useUIStore } from '@/store';
import { CategoryIcon } from '../common/CategoryIcon';

export const POIDetailSheet: React.FC = () => {
  const { pois } = usePOIStore();
  const { selectedPOIIdForHandoff, setSelectedPOIIdForHandoff } = useUIStore();

  if (!selectedPOIIdForHandoff) return null;

  const poi = pois.find((p) => p.id === selectedPOIIdForHandoff);
  if (!poi) return null;

  const { lat, lng } = poi.location;

  // External Navigation URI Schemes
  const mapplsUrl = `https://mappls.com/direction?end=${lat},${lng}`;
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const appleMapsUrl = `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
  const geoUri = `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(poi.name)})`;

  const copyCoordinates = () => {
    navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    alert('Coordinates copied to clipboard!');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={() => setSelectedPOIIdForHandoff(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          backgroundColor: 'var(--surface-elevated)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          border: '1px solid var(--surface-border)',
          borderBottom: 'none',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: 'var(--shadow-hud)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CategoryIcon category={poi.category} size={28} />
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                {poi.name}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {poi.chainageKm} km from start • {poi.distanceFromRoute}m from highway
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPOIIdForHandoff(null)}
            style={{
              width: 36,
              height: 36,
              minWidth: 36,
              minHeight: 36,
              borderRadius: '50%',
              backgroundColor: 'var(--surface)',
              color: 'var(--text-secondary)',
            }}
          >
            ✕
          </button>
        </div>

        {/* 1-Tap Navigation Handoff Buttons (Glove-Friendly, 48px min height) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* MapmyIndia (Mappls) India-First Handoff */}
          <a
            href={mapplsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              minHeight: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#1E293B',
              border: '1.5px solid var(--accent-cyan)',
              color: 'var(--accent-cyan)',
              fontWeight: 800,
              fontSize: 15,
              borderRadius: 'var(--radius)',
              textDecoration: 'none',
              gap: 8,
            }}
          >
            <span>🇮🇳</span>
            <span>Open in MapmyIndia (Mappls)</span>
          </a>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              minHeight: 46,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--accent-amber)',
              color: '#000',
              fontWeight: 700,
              fontSize: 14,
              borderRadius: 'var(--radius)',
              textDecoration: 'none',
              gap: 8,
            }}
          >
            Open in Google Maps
          </a>

          <div style={{ display: 'flex', gap: 10 }}>
            <a
              href={appleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--surface-overlay)',
                border: '1px solid var(--surface-border)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: 13,
                borderRadius: 'var(--radius)',
                textDecoration: 'none',
              }}
            >
              Apple Maps
            </a>

            <a
              href={geoUri}
              style={{
                flex: 1,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--surface-overlay)',
                border: '1px solid var(--surface-border)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: 13,
                borderRadius: 'var(--radius)',
                textDecoration: 'none',
              }}
            >
              System Geo App
            </a>
          </div>

          <button
            type="button"
            onClick={copyCoordinates}
            style={{
              minHeight: 40,
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--surface-border)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              borderRadius: 'var(--radius)',
            }}
          >
            Copy Coordinates ({lat.toFixed(5)}, {lng.toFixed(5)})
          </button>
        </div>
      </div>
    </div>
  );
};
