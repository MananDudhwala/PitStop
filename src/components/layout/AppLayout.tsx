import React from 'react';
import { useMediaQuery } from '@/hooks';
import { SearchPanel } from '../search/SearchPanel';
import { RouteSummary } from '../hud/RouteSummary';
import { FuelGapBanner } from '../hud/FuelGapBanner';
import { POIList } from '../poi/POIList';
import { MapView } from '../map/MapView';
import { BottomDrawer } from './BottomDrawer';
import { POIDetailSheet } from '../poi/POIDetailSheet';
import { useRouteStore } from '@/store';

export const AppLayout: React.FC = () => {
  const { isDesktop } = useMediaQuery();
  const corridor = useRouteStore((s) => s.corridor);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {isDesktop ? (
        /* Desktop Dual-Pane Layout */
        <div style={{ display: 'flex', width: '100%', height: '100%' }}>
          {/* Left Tactical Sidebar (420px) */}
          <aside
            style={{
              width: 440,
              height: '100%',
              backgroundColor: 'var(--surface)',
              borderRight: '1px solid var(--surface-border)',
              display: 'flex',
              flexDirection: 'column',
              padding: 20,
              gap: 16,
              zIndex: 30,
              boxShadow: 'var(--shadow-hud)',
              overflowY: 'auto',
            }}
          >
            {/* Branding Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28 }}>🏍️</span>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '0.05em', color: '#FFF' }}>
                    PIT<span style={{ color: 'var(--accent-amber)' }}>STOP</span>
                  </h1>
                  <p style={{ fontSize: 11, color: 'var(--accent-cyan)', fontWeight: 600 }}>
                    🇮🇳 Powered by MapmyIndia (Mappls)
                  </p>
                </div>
              </div>
            </div>

            <SearchPanel />

            {corridor && (
              <>
                <RouteSummary />
                <FuelGapBanner />
                <div style={{ flex: 1, minHeight: 0 }}>
                  <POIList />
                </div>
              </>
            )}
          </aside>

          {/* Full-Bleed Map */}
          <main style={{ flex: 1, height: '100%', position: 'relative' }}>
            <MapView />
          </main>
        </div>
      ) : (
        /* Mobile Layout */
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <main style={{ width: '100%', height: '100%' }}>
            <MapView />
          </main>

          {/* Mobile Top Search Overlay if no route */}
          {!corridor && (
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                right: 16,
                zIndex: 30,
              }}
            >
              <SearchPanel />
            </div>
          )}

          {/* Mobile Bottom Drawer if route active */}
          {corridor && (
            <BottomDrawer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <RouteSummary />
                <FuelGapBanner />
                <POIList />
              </div>
            </BottomDrawer>
          )}
        </div>
      )}

      {/* Quick Action Navigation Sheet */}
      <POIDetailSheet />
    </div>
  );
};
