import React from 'react';
import { CorridorPOI } from '@/types';
import { CategoryIcon } from '../common/CategoryIcon';
import { usePOIStore, useMapStore, useUIStore } from '@/store';

interface POICardProps {
  poi: CorridorPOI;
}

export const POICard: React.FC<POICardProps> = ({ poi }) => {
  const { selectedPOI, setSelectedPOI } = usePOIStore();
  const { setCenter, setZoom, setHoveredPOIId } = useMapStore();
  const setSelectedPOIIdForHandoff = useUIStore((s) => s.setSelectedPOIIdForHandoff);

  const isSelected = selectedPOI?.id === poi.id;

  const accentColor =
    poi.category === 'fuel'
      ? 'var(--accent-amber)'
      : poi.category === 'mechanic'
      ? 'var(--accent-cyan)'
      : 'var(--accent-emerald)';

  const handleCardClick = () => {
    setSelectedPOI(poi);
    setCenter(poi.location);
    setZoom(14);
  };

  const handleNavigateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPOIIdForHandoff(poi.id);
  };

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => setHoveredPOIId(poi.id)}
      onMouseLeave={() => setHoveredPOIId(null)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 14px',
        backgroundColor: isSelected ? 'var(--surface-overlay)' : 'var(--surface-elevated)',
        border: `1px solid ${isSelected ? accentColor : 'var(--surface-border)'}`,
        borderLeft: `5px solid ${accentColor}`,
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
        gap: 8,
        transition: 'all 0.15s ease',
        boxShadow: isSelected ? `0 0 12px ${accentColor}33` : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              padding: 6,
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--surface)',
            }}
          >
            <CategoryIcon category={poi.category} size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
              {poi.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
              {poi.category} • {poi.distanceFromRoute}m detour from road
            </div>
          </div>
        </div>

        {/* Chainage Badge (Road Distance from origin) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 800, color: accentColor }}>
            {poi.chainageKm} <span style={{ fontSize: 11, fontWeight: 500 }}>KM</span>
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>from start</span>
        </div>
      </div>

      {/* Highlights / Features (24/7, Fuel grades, services) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {poi.category === 'fuel' && (poi.details as any)?.is24Hours && (
          <span
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: 'rgba(52, 211, 153, 0.15)',
              color: 'var(--accent-emerald)',
              fontWeight: 600,
            }}
          >
            24/7 Open
          </span>
        )}
        {poi.category === 'mechanic' && (
          <span
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: 'rgba(34, 211, 238, 0.15)',
              color: 'var(--accent-cyan)',
              fontWeight: 600,
            }}
          >
            Tyre & Puncture
          </span>
        )}
        {poi.category === 'rest' && (poi.details as any)?.hasFoodService && (
          <span
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: 'rgba(245, 165, 36, 0.15)',
              color: 'var(--accent-amber)',
              fontWeight: 600,
            }}
          >
            Food & Refreshments
          </span>
        )}
      </div>

      {/* Quick Action Navigation Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          type="button"
          onClick={handleNavigateClick}
          style={{
            minHeight: 36,
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--surface-border)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 600,
            gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="3 11 22 2 13 21 11 13 3 11" />
          </svg>
          Navigate
        </button>
      </div>
    </div>
  );
};
