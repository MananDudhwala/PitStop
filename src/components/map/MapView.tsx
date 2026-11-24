import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore, useRouteStore, usePOIStore, useRiderStore } from '@/store';
import { isValidCoordinate } from '@/geospatial';
import { MapStyleSwitcher } from './MapStyleSwitcher';
import { RiderTelemetryHUD } from '../hud/RiderTelemetry';

const MAP_STYLES = {
  'dark-hud': 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  street: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  topo: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};

export const MapView: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const riderMarkerRef = useRef<maplibregl.Marker | null>(null);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destinationMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [isLocating, setIsLocating] = useState(false);

  const { center, zoom, mapStyle, setMapReady, setCenter, setZoom } = useMapStore();
  const { corridor, origin, destination } = useRouteStore();
  const { pois, selectedPOI, setSelectedPOI } = usePOIStore();
  const telemetry = useRiderStore((s) => s.telemetry);

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialCenter: [number, number] = isValidCoordinate(center)
      ? [center.lng, center.lat]
      : [77.209, 28.6139]; // Default New Delhi

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES[mapStyle],
      center: initialCenter,
      zoom: Number.isFinite(zoom) ? zoom : 11,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, showZoom: true }),
      'bottom-right'
    );

    map.on('load', () => {
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update style when mapStyle changes
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(MAP_STYLES[mapStyle]);
  }, [mapStyle]);

  // Center & zoom listener
  useEffect(() => {
    if (!mapRef.current || !isValidCoordinate(center)) return;
    mapRef.current.easeTo({
      center: [center.lng, center.lat],
      zoom: Number.isFinite(zoom) ? zoom : 12,
      duration: 800,
    });
  }, [center, zoom]);

  // Render Route Polyline & Fit Bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateRouteLayer = () => {
      if (!map.isStyleLoaded()) return;

      const sourceId = 'route-source';
      const layerId = 'route-layer';
      const glowLayerId = 'route-glow-layer';

      if (map.getLayer(glowLayerId)) map.removeLayer(glowLayerId);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      if (!corridor || !corridor.geometry || !corridor.geometry.coordinates?.length) return;

      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: corridor.geometry,
        },
      });

      // High-luminance route glow
      map.addLayer({
        id: glowLayerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#22D3EE',
          'line-width': 10,
          'line-opacity': 0.35,
        },
      });

      // Core route line
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#06B6D4',
          'line-width': 4.5,
        },
      });

      // Fit map bounds to encompass the entire route
      const bbox = corridor.bbox;
      if (
        bbox &&
        Number.isFinite(bbox.west) &&
        Number.isFinite(bbox.south) &&
        Number.isFinite(bbox.east) &&
        Number.isFinite(bbox.north)
      ) {
        map.fitBounds(
          [
            [bbox.west, bbox.south],
            [bbox.east, bbox.north],
          ],
          { padding: 80, duration: 1200 }
        );
      }
    };

    if (map.isStyleLoaded()) {
      updateRouteLayer();
    } else {
      map.once('style.load', updateRouteLayer);
    }
  }, [corridor]);

  // Render Origin and Destination Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Origin Marker (Green Pin / A)
    if (origin && isValidCoordinate(origin)) {
      if (!originMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'pitstop-origin-marker';
        el.style.width = '32px';
        el.style.height = '32px';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.cursor = 'pointer';

        el.innerHTML = `
          <div style="position:relative; width:32px; height:32px; display:flex; align-items:center; justify-content:center;">
            <div style="position:absolute; width:32px; height:32px; border-radius:50%; background:rgba(16,185,129,0.3); animation:endpointPulse 2s infinite ease-out;"></div>
            <div style="width:24px; height:24px; border-radius:50%; background:#10B981; border:2.5px solid #FFFFFF; display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-weight:800; font-size:11px; box-shadow:0 0 10px rgba(16,185,129,0.8); z-index:2;">
              A
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 20, closeButton: false }).setHTML(
          `<div style="font-weight:700; font-size:12px; color:#F9FAFB;">📍 Origin: ${origin.name}</div>`
        );

        originMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([origin.lng, origin.lat])
          .setPopup(popup)
          .addTo(map);
      } else {
        originMarkerRef.current.setLngLat([origin.lng, origin.lat]);
      }
    } else {
      if (originMarkerRef.current) {
        originMarkerRef.current.remove();
        originMarkerRef.current = null;
      }
    }

    // Destination Marker (Amber Pin / B)
    if (destination && isValidCoordinate(destination)) {
      if (!destinationMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'pitstop-destination-marker';
        el.style.width = '32px';
        el.style.height = '32px';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.cursor = 'pointer';

        el.innerHTML = `
          <div style="position:relative; width:32px; height:32px; display:flex; align-items:center; justify-content:center;">
            <div style="position:absolute; width:32px; height:32px; border-radius:50%; background:rgba(245,158,11,0.3); animation:endpointPulse 2s infinite ease-out;"></div>
            <div style="width:24px; height:24px; border-radius:50%; background:#F59E0B; border:2.5px solid #FFFFFF; display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-weight:800; font-size:11px; box-shadow:0 0 10px rgba(245,158,11,0.8); z-index:2;">
              B
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 20, closeButton: false }).setHTML(
          `<div style="font-weight:700; font-size:12px; color:#F9FAFB;">🏁 Destination: ${destination.name}</div>`
        );

        destinationMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([destination.lng, destination.lat])
          .setPopup(popup)
          .addTo(map);
      } else {
        destinationMarkerRef.current.setLngLat([destination.lng, destination.lat]);
      }
    } else {
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }
    }
  }, [origin, destination]);

  // Render POI Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    pois.forEach((poi) => {
      if (!isValidCoordinate(poi.location)) return;

      const el = document.createElement('div');
      const isSelected = selectedPOI?.id === poi.id;

      const color =
        poi.category === 'fuel'
          ? 'var(--accent-amber)'
          : poi.category === 'mechanic'
          ? 'var(--accent-cyan)'
          : 'var(--accent-emerald)';

      const emoji = poi.category === 'fuel' ? '⛽' : poi.category === 'mechanic' ? '🔧' : '☕';

      el.style.width = isSelected ? '38px' : '30px';
      el.style.height = isSelected ? '38px' : '30px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#0B0F17';
      el.style.border = `2.5px solid ${color}`;
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontSize = isSelected ? '16px' : '13px';
      el.style.cursor = 'pointer';
      el.style.boxShadow = isSelected ? `0 0 16px ${color}` : '0 2px 8px rgba(0,0,0,0.6)';
      el.innerHTML = emoji;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedPOI(poi);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([poi.location.lng, poi.location.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [pois, selectedPOI, setSelectedPOI]);

  // Render Rider GPS live dot with safe child-element animation
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!telemetry.currentPosition || !isValidCoordinate(telemetry.currentPosition)) {
      if (riderMarkerRef.current) {
        riderMarkerRef.current.remove();
        riderMarkerRef.current = null;
      }
      return;
    }

    const { lng, lat } = telemetry.currentPosition;

    if (!riderMarkerRef.current) {
      // Outer container has NO transform animation so MapLibre positioning is strictly preserved
      const el = document.createElement('div');
      el.className = 'pitstop-rider-marker-wrapper';
      el.style.width = '34px';
      el.style.height = '34px';
      el.style.position = 'relative';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';

      // Radar pulse ring (child element)
      const pulseRing = document.createElement('div');
      pulseRing.className = 'pitstop-rider-pulse-ring';

      // Core dot (child element)
      const coreDot = document.createElement('div');
      coreDot.className = 'pitstop-rider-core-dot';

      el.appendChild(pulseRing);
      el.appendChild(coreDot);

      const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(
        `<div style="font-weight:700; font-size:12px; color:#F9FAFB;">📍 Current GPS Location</div>`
      );

      riderMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map);
    } else {
      riderMarkerRef.current.setLngLat([lng, lat]);
    }
  }, [telemetry.currentPosition]);

  // Tactical GPS Quick-Locate Handler
  const handleQuickLocate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (isValidCoordinate({ lat, lng })) {
          useRiderStore.getState().updatePosition(pos.coords);
          setCenter({ lat, lng });
          setZoom(14);

          if (mapRef.current) {
            mapRef.current.flyTo({
              center: [lng, lat],
              zoom: 14,
              speed: 1.4,
              curve: 1.2,
            });
          }
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('GPS location request error:', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating GPS Quick-Locate Button */}
      <button
        type="button"
        onClick={handleQuickLocate}
        title="Locate Current Position"
        aria-label="Locate Current Position"
        style={{
          position: 'absolute',
          bottom: 112,
          right: 10,
          zIndex: 10,
          width: 42,
          height: 42,
          borderRadius: '50%',
          backgroundColor: isLocating ? 'rgba(6, 182, 212, 0.3)' : 'rgba(11, 15, 23, 0.9)',
          backdropFilter: 'blur(8px)',
          border: `1.5px solid ${isLocating ? 'var(--accent-cyan)' : 'var(--surface-border)'}`,
          color: isLocating ? 'var(--accent-cyan)' : 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-hud)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            animation: isLocating ? 'pulseGlow 1s infinite' : 'none',
          }}
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
        </svg>
      </button>

      <MapStyleSwitcher />
      <RiderTelemetryHUD />
    </div>
  );
};
