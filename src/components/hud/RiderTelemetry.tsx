import React from 'react';
import { useRiderTracking } from '@/hooks';
import { useRouteStore } from '@/store';
import { CategoryIcon } from '../common/CategoryIcon';

export const RiderTelemetryHUD: React.FC = () => {
  const { telemetry, isTracking, startTracking, stopTracking } = useRiderTracking();
  const corridor = useRouteStore((s) => s.corridor);

  const speedKmh = telemetry.speed !== null ? Math.round(telemetry.speed * 3.6) : null;
  const distRemainingKm =
    telemetry.distanceRemaining !== null ? (telemetry.distanceRemaining / 1000).toFixed(1) : null;
  const distToNextKm =
    telemetry.distanceToNextPOI !== null ? (telemetry.distanceToNextPOI / 1000).toFixed(1) : null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Off-Route Alert Banner */}
      {!telemetry.isOnRoute && isTracking && (
        <div
          style={{
            backgroundColor: 'var(--danger)',
            color: '#FFF',
            padding: '8px 14px',
            borderRadius: 'var(--radius)',
            fontWeight: 800,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 0 16px rgba(239, 68, 68, 0.7)',
            animation: 'pulseGlow 1.5s infinite',
          }}
        >
          <span>⚠️</span>
          <span>OFF ROUTE DETECTED — Rejoin Corridor</span>
        </div>
      )}

      {/* Tactical HUD Pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          backgroundColor: 'rgba(11, 15, 23, 0.88)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-pill)',
          padding: '6px 16px',
          boxShadow: 'var(--shadow-hud)',
        }}
      >
        {/* GPS Tracking Toggle Button */}
        <button
          type="button"
          onClick={isTracking ? stopTracking : startTracking}
          style={{
            padding: '4px 10px',
            minHeight: 34,
            borderRadius: 'var(--radius-pill)',
            backgroundColor: isTracking ? 'rgba(52, 211, 153, 0.2)' : 'var(--surface-elevated)',
            border: `1px solid ${isTracking ? 'var(--accent-emerald)' : 'var(--surface-border)'}`,
            color: isTracking ? 'var(--accent-emerald)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: 12,
            gap: 6,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: isTracking ? 'var(--accent-emerald)' : 'var(--text-muted)',
              boxShadow: isTracking ? '0 0 8px var(--accent-emerald)' : 'none',
            }}
          />
          {isTracking ? 'GPS Active' : 'Start GPS'}
        </button>

        {/* Speed Telemetry */}
        {isTracking && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
              {speedKmh !== null ? speedKmh : '--'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>
              KM/H
            </span>
          </div>
        )}

        {/* Next Pit Stop Quick Peek */}
        {telemetry.nextPOI && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderLeft: '1px solid var(--surface-border)',
              paddingLeft: 12,
            }}
          >
            <CategoryIcon category={telemetry.nextPOI.category} size={16} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  maxWidth: 120,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {telemetry.nextPOI.name}
              </span>
              <span style={{ fontSize: 10, color: 'var(--accent-amber)', fontWeight: 600 }}>
                in {distToNextKm} km
              </span>
            </div>
          </div>
        )}

        {/* Total Remaining Distance */}
        {distRemainingKm && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              borderLeft: '1px solid var(--surface-border)',
              paddingLeft: 12,
            }}
          >
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Remaining</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-cyan)' }}>
              {distRemainingKm} km
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
