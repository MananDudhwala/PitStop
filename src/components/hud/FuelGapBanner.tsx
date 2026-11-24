import React from 'react';
import { usePOIStore, useUIStore } from '@/store';

export const FuelGapBanner: React.FC = () => {
  const fuelGapAlerts = usePOIStore((s) => s.fuelGapAlerts);
  const { showFuelGapBanner, setShowFuelGapBanner } = useUIStore();

  if (!showFuelGapBanner || fuelGapAlerts.length === 0) return null;

  // Show the most critical or longest gap
  const primaryGap = fuelGapAlerts.reduce((prev, curr) =>
    curr.gapDistanceKm > prev.gapDistanceKm ? curr : prev
  );

  const isCritical = primaryGap.severity === 'critical';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: isCritical ? 'rgba(239, 68, 68, 0.95)' : 'rgba(245, 158, 11, 0.95)',
        color: '#FFFFFF',
        padding: '10px 14px',
        borderRadius: 'var(--radius)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        gap: 12,
        animation: isCritical ? 'pulseWarning 2s infinite' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 24, lineHeight: 1 }}>⚠️</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            Fuel Dead Zone: {primaryGap.gapDistanceKm} KM Gap
          </div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>
            No verified fuel between {primaryGap.startStation.name} and {primaryGap.endStation.name}. Top up before entering this stretch!
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowFuelGapBanner(false)}
        style={{
          width: 32,
          height: 32,
          minWidth: 32,
          minHeight: 32,
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          color: '#FFF',
          fontSize: 14,
        }}
      >
        ✕
      </button>
    </div>
  );
};
