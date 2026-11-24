import React from 'react';
import { usePOIStore } from '@/store';
import { useCorridorPOIs } from '@/hooks';
import { POICard } from './POICard';
import { LoadingSpinner } from '../common/LoadingSpinner';

export const POIList: React.FC = () => {
  const { filters, toggleCategoryFilter, pois: allPOIs } = usePOIStore();
  const { pois, isLoading, error } = useCorridorPOIs();

  const fuelCount = allPOIs.filter((p) => p.category === 'fuel').length;
  const mechanicCount = allPOIs.filter((p) => p.category === 'mechanic').length;
  const restCount = allPOIs.filter((p) => p.category === 'rest').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      {/* Category Filter Pills (Glove-Friendly) */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {/* Fuel Filter */}
        <button
          type="button"
          onClick={() => toggleCategoryFilter('fuel')}
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: filters.showFuel ? 'rgba(245, 165, 36, 0.2)' : 'var(--surface-elevated)',
            border: `1.5px solid ${filters.showFuel ? 'var(--accent-amber)' : 'var(--surface-border)'}`,
            color: filters.showFuel ? 'var(--accent-amber)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: 13,
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          <span>⛽ Fuel</span>
          <span
            style={{
              backgroundColor: filters.showFuel ? 'var(--accent-amber)' : 'var(--surface-border)',
              color: filters.showFuel ? '#000' : 'var(--text-secondary)',
              padding: '1px 6px',
              borderRadius: 10,
              fontSize: 11,
            }}
          >
            {fuelCount}
          </span>
        </button>

        {/* Mechanic Filter */}
        <button
          type="button"
          onClick={() => toggleCategoryFilter('mechanic')}
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: filters.showMechanic ? 'rgba(34, 211, 238, 0.2)' : 'var(--surface-elevated)',
            border: `1.5px solid ${filters.showMechanic ? 'var(--accent-cyan)' : 'var(--surface-border)'}`,
            color: filters.showMechanic ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: 13,
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          <span>🔧 Mechanic</span>
          <span
            style={{
              backgroundColor: filters.showMechanic ? 'var(--accent-cyan)' : 'var(--surface-border)',
              color: filters.showMechanic ? '#000' : 'var(--text-secondary)',
              padding: '1px 6px',
              borderRadius: 10,
              fontSize: 11,
            }}
          >
            {mechanicCount}
          </span>
        </button>

        {/* Rest Filter */}
        <button
          type="button"
          onClick={() => toggleCategoryFilter('rest')}
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: filters.showRest ? 'rgba(52, 211, 153, 0.2)' : 'var(--surface-elevated)',
            border: `1.5px solid ${filters.showRest ? 'var(--accent-emerald)' : 'var(--surface-border)'}`,
            color: filters.showRest ? 'var(--accent-emerald)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: 13,
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          <span>☕ Rest Stops</span>
          <span
            style={{
              backgroundColor: filters.showRest ? 'var(--accent-emerald)' : 'var(--surface-border)',
              color: filters.showRest ? '#000' : 'var(--text-secondary)',
              padding: '1px 6px',
              borderRadius: 10,
              fontSize: 11,
            }}
          >
            {restCount}
          </span>
        </button>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <LoadingSpinner size="lg" label="Scanning corridor for verified pit stops…" />
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 14,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 'var(--radius)',
            color: 'var(--danger)',
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* POI Cards Container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          overflowY: 'auto',
          paddingRight: 4,
          flex: 1,
        }}
      >
        {!isLoading && pois.length === 0 && (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: 14,
              backgroundColor: 'var(--surface-elevated)',
              borderRadius: 'var(--radius)',
              border: '1px dashed var(--surface-border)',
            }}
          >
            No pit stops found along the selected corridor buffer. Try increasing the buffer distance (e.g. to 5 km or 10 km).
          </div>
        )}

        {pois.map((poi) => (
          <POICard key={poi.id} poi={poi} />
        ))}
      </div>
    </div>
  );
};
