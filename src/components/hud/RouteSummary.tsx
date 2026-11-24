import React, { useState } from 'react';
import { useRouteStore, usePOIStore } from '@/store';
import { getMapplsConfig, saveMapplsConfig, isMapplsConfigured } from '@/api/mappls';

export const RouteSummary: React.FC = () => {
  const corridor = useRouteStore((s) => s.corridor);
  const pois = usePOIStore((s) => s.pois);
  const audit = usePOIStore((s) => s.audit);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [mapplsApiKey, setMapplsApiKey] = useState(getMapplsConfig().apiKey || '');

  if (!corridor) return null;

  const totalDistanceKm = (corridor.totalDistance / 1000).toFixed(0);
  const durationHours = Math.floor(corridor.estimatedDuration / 3600);
  const durationMins = Math.round((corridor.estimatedDuration % 3600) / 60);

  const fuelCount = pois.filter((p) => p.category === 'fuel').length;
  const mechCount = pois.filter((p) => p.category === 'mechanic').length;
  const restCount = pois.filter((p) => p.category === 'rest').length;

  const handleSaveKey = () => {
    saveMapplsConfig({ apiKey: mapplsApiKey.trim() });
    setShowKeyInput(false);
    alert('MapmyIndia (Mappls) Key saved! Future corridor queries will query Mappls Atlas APIs directly.');
  };

  // Mappls Web Link for India route
  const mapplsUrl = `https://mappls.com/direction?start=${corridor.origin.lat},${corridor.origin.lng}&end=${corridor.destination.lat},${corridor.destination.lng}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          backgroundColor: 'var(--surface-elevated)',
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius)',
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-amber)' }}>
              {totalDistanceKm}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              KM RIDE
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>•</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {durationHours > 0 ? `${durationHours}h ` : ''}
              {durationMins}m
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            🇮🇳 {corridor.origin.name.split(',')[0]} → {corridor.destination.name.split(',')[0]}
          </div>
        </div>

        {/* Pit Stop Breakdown Badges */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
            <span>⛽</span>
            <span style={{ color: 'var(--accent-amber)' }}>{fuelCount}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
            <span>🔧</span>
            <span style={{ color: 'var(--accent-cyan)' }}>{mechCount}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
            <span>☕</span>
            <span style={{ color: 'var(--accent-emerald)' }}>{restCount}</span>
          </div>

          {/* Audit Inspector Toggle Button */}
          <button
            type="button"
            onClick={() => setShowAuditModal(!showAuditModal)}
            title="Inspect Data Pipeline & MapmyIndia Telemetry"
            style={{
              padding: '3px 8px',
              minHeight: 28,
              borderRadius: 6,
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--surface-border)',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--accent-cyan)',
              gap: 4,
            }}
          >
            <span>🇮🇳</span>
            <span>Audit</span>
          </button>
        </div>
      </div>

      {/* Expandable Pipeline Audit Inspector */}
      {showAuditModal && (
        <div
          style={{
            backgroundColor: 'var(--surface-overlay)',
            border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius)',
            padding: 12,
            fontSize: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
              🇮🇳 India Route & POI Pipeline
            </span>
            <span
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                backgroundColor: isMapplsConfigured()
                  ? 'rgba(52, 211, 153, 0.2)'
                  : 'rgba(245, 165, 36, 0.2)',
                color: isMapplsConfigured()
                  ? 'var(--accent-emerald)'
                  : 'var(--accent-amber)',
                fontWeight: 700,
              }}
            >
              {isMapplsConfigured() ? '🟢 MAPPLS ATLAS LIVE' : '🇮🇳 INDIA HIGHWAY ENGINE'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, color: 'var(--text-secondary)' }}>
            <div>
              Provider: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>MapmyIndia / Mappls</span>
            </div>
            <div>
              Stops Found: <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>{pois.length} stops</span>
            </div>
            <div>
              Highway Buffer: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{corridor.corridorBuffer}m</span>
            </div>
            <div>
              Target: <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>Indian Highways</span>
            </div>
          </div>

          {/* MapmyIndia API Key / Mappls Configurator */}
          <div style={{ marginTop: 4 }}>
            {!showKeyInput ? (
              <button
                type="button"
                onClick={() => setShowKeyInput(true)}
                style={{
                  fontSize: 11,
                  color: 'var(--accent-cyan)',
                  textDecoration: 'underline',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  minHeight: 20,
                }}
              >
                ⚙️ {isMapplsConfigured() ? 'Edit MapmyIndia (Mappls) API Key' : 'Add your MapmyIndia (Mappls) API Key'}
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                <input
                  type="text"
                  placeholder="Paste MapmyIndia REST API Key / Token"
                  value={mapplsApiKey}
                  onChange={(e) => setMapplsApiKey(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 6,
                    color: '#FFF',
                    fontSize: 12,
                    minHeight: 32,
                  }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 4,
                      backgroundColor: 'var(--accent-amber)',
                      color: '#000',
                      fontWeight: 700,
                      fontSize: 11,
                      minHeight: 28,
                    }}
                  >
                    Save Key
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowKeyInput(false)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 4,
                      backgroundColor: 'var(--surface)',
                      color: 'var(--text-secondary)',
                      fontSize: 11,
                      minHeight: 28,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick External Link to MapmyIndia (Mappls) */}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <a
              href={mapplsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                minHeight: 30,
                padding: '4px 10px',
                borderRadius: 6,
                backgroundColor: 'rgba(34, 211, 238, 0.15)',
                border: '1px solid rgba(34, 211, 238, 0.4)',
                color: 'var(--accent-cyan)',
                fontSize: 11,
                fontWeight: 700,
                textDecoration: 'none',
                gap: 6,
              }}
            >
              <span>🇮🇳</span>
              <span>Open in MapmyIndia (Mappls Direction)</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
