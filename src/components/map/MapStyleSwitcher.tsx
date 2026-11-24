import React from 'react';
import { useMapStore } from '@/store';
import { MapStyle } from '@/types';

export const MapStyleSwitcher: React.FC = () => {
  const { mapStyle, setMapStyle } = useMapStore();

  const styles: { id: MapStyle; label: string; icon: string }[] = [
    { id: 'dark-hud', label: 'Dark HUD', icon: '🌙' },
    { id: 'street', label: 'Street', icon: '🛣️' },
    { id: 'topo', label: 'Topo', icon: '⛰️' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 20,
        display: 'flex',
        backgroundColor: 'rgba(11, 15, 23, 0.88)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--surface-border)',
        borderRadius: 'var(--radius-pill)',
        padding: 3,
        boxShadow: 'var(--shadow-hud)',
      }}
    >
      {styles.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => setMapStyle(s.id)}
          title={`Switch to ${s.label} view`}
          style={{
            minHeight: 34,
            minWidth: 40,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 'var(--radius-pill)',
            backgroundColor: mapStyle === s.id ? 'var(--surface-overlay)' : 'transparent',
            color: mapStyle === s.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            border: mapStyle === s.id ? '1px solid var(--surface-border)' : 'none',
            gap: 4,
          }}
        >
          <span>{s.icon}</span>
          <span style={{ display: 'none' }}>{s.label}</span>
        </button>
      ))}
    </div>
  );
};
