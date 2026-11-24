# PitStop — System Architecture Document

> **Version:** 1.0.0  
> **Last Updated:** 2026-11-19  
> **Status:** Production-Grade Specification  
> **Authors:** PitStop Architecture Team  

**PitStop** is a mobile-first, offline-resilient Progressive Web Application (PWA) designed for motorcyclists. It provides real-time corridor-aware POI discovery, fuel-gap telemetry, and a tactical rider HUD — all engineered to function reliably in low-connectivity environments common on long-distance rides.

---

## Table of Contents

1. [System Context & Data-Flow Diagram](#1-system-context--data-flow-diagram)
2. [End-to-End Geospatial Data Pipeline](#2-end-to-end-geospatial-data-pipeline)
3. [Modular Directory Structure](#3-modular-directory-structure)
4. [TypeScript Domain Contracts](#4-typescript-domain-contracts)
5. [API Resilience & Rate-Limit Strategy](#5-api-resilience--rate-limit-strategy)
6. [Web Worker Offloading Plan](#6-web-worker-offloading-plan)
7. [Offline & PWA Strategy](#7-offline--pwa-strategy)
8. [UI/UX Tactical Rider HUD Specification](#8-uiux-tactical-rider-hud-specification)
9. [Phased Implementation Roadmap](#9-phased-implementation-roadmap)

---

## 1. System Context & Data-Flow Diagram

### 1.1 High-Level System Context

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL SERVICES                                      │
│                                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│  │  Photon       │  │  OSRM        │  │  Overpass API    │  │  Tile Servers      │   │
│  │  Geocoder     │  │  Routing     │  │  (3 mirrors)     │  │  (OSM Raster/Vec)  │   │
│  │              │  │  Engine      │  │                  │  │                    │   │
│  │  photon.     │  │  router.     │  │  overpass-api.de │  │  tile.openstreet   │   │
│  │  komoot.io   │  │  project-    │  │  kumi.systems    │  │  map.org           │   │
│  │              │  │  osrm.org    │  │  maps.mail.ru    │  │                    │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  └────────┬───────────┘   │
│         │                 │                   │                     │               │
└─────────┼─────────────────┼───────────────────┼─────────────────────┼───────────────┘
          │                 │                   │                     │
          │ HTTPS/JSON      │ HTTPS/JSON        │ HTTPS/XML+JSON     │ HTTPS/PNG+PBF
          ▼                 ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           PROXY / CORS GATEWAY (Optional)                           │
│                                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────────┐    │
│  │  Cloudflare Worker / Vercel Edge Function                                   │    │
│  │  • CORS header injection         • Response caching (Cache-Control: 300s)   │    │
│  │  • Rate-limit token rotation      • Request coalescing for identical bbox   │    │
│  │  • API key injection (if needed)  • Gzip/Brotli passthrough                │    │
│  └──────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────┬───────────────────────────────────────────────┘
                                      │
                                      │ HTTPS/JSON
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              PWA CLIENT (Browser)                                   │
│                                                                                     │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │                         SERVICE WORKER LAYER                                   │  │
│  │                                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐  │  │
│  │  │  Cache-First  │  │ Network-First│  │  Stale-While- │  │  Background      │  │  │
│  │  │  Strategy     │  │  Strategy    │  │  Revalidate   │  │  Sync Queue      │  │  │
│  │  │              │  │              │  │               │  │                  │  │  │
│  │  │  • App Shell  │  │  • Geocode   │  │  • Tile cache │  │  • Deferred POI  │  │  │
│  │  │  • Static JS  │  │  • Route API │  │  • POI data   │  │    fetches       │  │  │
│  │  │  • CSS/Fonts  │  │  • Overpass  │  │               │  │  • Telemetry     │  │  │
│  │  │  • Icons      │  │              │  │               │  │    uploads       │  │  │
│  │  └──────────────┘  └──────────────┘  └───────────────┘  └──────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                     │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │                         MAIN THREAD                                            │  │
│  │                                                                                │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────────────┐   │  │
│  │  │  React App       │  │  Zustand Store   │  │  Leaflet / MapLibre GL      │   │  │
│  │  │                 │  │                 │  │                              │   │  │
│  │  │  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌──────────┐ ┌──────────┐  │   │  │
│  │  │  │ HUD Shell │  │  │  │ routeSlice│  │  │  │ POI Layer│ │ Route    │  │   │  │
│  │  │  │           │  │  │  │           │  │  │  │          │ │ Polyline │  │   │  │
│  │  │  │ SearchBar │  │  │  │ poiSlice  │  │  │  │ Cluster  │ │ Layer    │  │   │  │
│  │  │  │ POI List  │  │  │  │           │  │  │  │ Group    │ │          │  │   │  │
│  │  │  │ FuelGauge │  │  │  │ uiSlice   │  │  │  │          │ │ Corridor │  │   │  │
│  │  │  │ Drawer    │  │  │  │           │  │  │  │ Markers  │ │ Buffer   │  │   │  │
│  │  │  │           │  │  │  │ riderSlice│  │  │  │          │ │          │  │   │  │
│  │  │  └───────────┘  │  │  │           │  │  │  └──────────┘ └──────────┘  │   │  │
│  │  │                 │  │  │offlineSlce│  │  │                              │   │  │
│  │  └─────────────────┘  │  └───────────┘  │  └──────────────────────────────┘   │  │
│  │                       └─────────────────┘                                     │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                               │
│                        postMessage() │ Transferable                                  │
│                                      ▼                                               │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │                        WEB WORKER POOL                                         │  │
│  │                                                                                │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                   │  │
│  │  │ GeoWorker #1   │  │ GeoWorker #2   │  │ GeoWorker #3   │                   │  │
│  │  │                │  │                │  │                │                   │  │
│  │  │ • Polyline     │  │ • Cross-track  │  │ • POI dedup    │                   │  │
│  │  │   decode       │  │   distance     │  │   (30m radius) │                   │  │
│  │  │ • RDP simplify │  │   calculation  │  │ • Fuel-gap     │                   │  │
│  │  │ • Corridor     │  │ • Chainage     │  │   analysis     │                   │  │
│  │  │   sampling     │  │   projection   │  │ • OSM tag      │                   │  │
│  │  │               │  │               │  │   taxonomy     │                   │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘                   │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                               │
│                                      ▼                                               │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │                        INDEXEDDB PERSISTENCE                                   │  │
│  │                                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │  │
│  │  │ tile_cache   │  │ route_cache  │  │ poi_cache    │  │ offline_manifest │   │  │
│  │  │              │  │              │  │              │  │                  │   │  │
│  │  │ key: z/x/y   │  │ key: hash    │  │ key: osm_id │  │ key: region_id   │   │  │
│  │  │ val: blob    │  │ val: geojson │  │ val: poi+meta│  │ val: manifest    │   │  │
│  │  │ ttl: 7d      │  │ ttl: 24h     │  │ ttl: 12h     │  │ ttl: ∞           │   │  │
│  │  │ idx: expires │  │ idx: expires │  │ idx: expires │  │ idx: version     │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘   │  │
│  │                                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐                                           │  │
│  │  │ rider_prefs  │  │ sync_queue   │                                           │  │
│  │  │              │  │              │                                           │  │
│  │  │ key: pref_id │  │ key: auto    │                                           │  │
│  │  │ val: config  │  │ val: request │                                           │  │
│  │  │ ttl: ∞       │  │ ttl: 48h     │                                           │  │
│  │  └──────────────┘  └──────────────┘                                           │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data-Flow Sequence

```
┌──────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│Rider │     │  React   │     │  Zustand  │     │  Worker  │     │ IndexedDB│
│      │     │  UI      │     │  Store    │     │  Pool    │     │          │
└──┬───┘     └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
   │               │               │               │               │
   │ 1. Enter      │               │               │               │
   │    Origin &   │               │               │               │
   │    Dest.      │               │               │               │
   │──────────────>│               │               │               │
   │               │ 2. dispatch   │               │               │
   │               │   searchRoute │               │               │
   │               │──────────────>│               │               │
   │               │               │ 3. Check      │               │
   │               │               │    cache       │               │
   │               │               │───────────────────────────────>│
   │               │               │               │  4. miss/hit  │
   │               │               │<──────────────────────────────│
   │               │               │               │               │
   │               │               │ 5. Fetch Photon + OSRM        │
   │               │               │─────────────> │ (if cache miss)│
   │               │               │               │               │
   │               │               │ 6. postMessage│               │
   │               │               │   raw polyline│               │
   │               │               │──────────────>│               │
   │               │               │               │ 7. Decode +   │
   │               │               │               │    simplify   │
   │               │               │               │    + corridor │
   │               │               │               │    sampling   │
   │               │               │<──────────────│               │
   │               │               │ 8. Corridor   │               │
   │               │               │    geometry   │               │
   │               │               │               │               │
   │               │               │ 9. Overpass   │               │
   │               │               │    bbox query │               │
   │               │               │──────────────>│               │
   │               │               │               │ 10. Filter +  │
   │               │               │               │     dedup +   │
   │               │               │               │     classify  │
   │               │               │<──────────────│               │
   │               │               │ 11. POIs +    │               │
   │               │               │     fuel-gaps │               │
   │               │               │               │ 12. Persist   │
   │               │               │───────────────────────────────>│
   │               │ 13. Update UI │               │               │
   │               │<──────────────│               │               │
   │ 14. Render    │               │               │               │
   │    HUD + Map  │               │               │               │
   │<──────────────│               │               │               │
```

---

## 2. End-to-End Geospatial Data Pipeline

### 2.1 Stage 1 — Origin & Destination Acquisition

#### 2.1.1 Photon Geocoding

Photon (powered by Komoot) provides free, OpenStreetMap-backed geocoding without API keys.

**Endpoint:** `https://photon.komoot.io/api/?q={query}&limit=5&lang=en`

**Acquisition Flow:**
1. User types a location string (minimum 3 characters, debounced at 350ms).
2. The autocomplete module sends a GET request to Photon.
3. Response GeoJSON features are parsed into `GeoPoint[]`.
4. Results are ranked by `properties.osm_value` relevance (city > town > village > hamlet).
5. Selected point is committed to `routeSlice.origin` or `routeSlice.destination`.

**Location Bias:** Requests include `&lat={lat}&lon={lon}` from the rider's current GPS to bias results geographically.

**Fallback:** If Photon is unreachable, the system falls back to Nominatim with a 1 req/sec rate limit.

#### 2.1.2 GPS Tracking (Geolocation API)

```
navigator.geolocation.watchPosition(callback, errorCallback, {
  enableHighAccuracy: true,    // Force GPS hardware
  maximumAge: 5000,            // Accept 5s-old cached position
  timeout: 10000               // 10s before timeout error
});
```

**Position Processing Pipeline:**
1. Raw coordinates are received from the Geolocation API.
2. A Kalman filter smooths GPS jitter (process noise Q=0.01, measurement noise R=1.0).
3. Positions with `accuracy > 50m` are discarded.
4. Speed is derived from successive positions (`Δdist / Δtime`).
5. Heading is computed via forward azimuth between consecutive points.
6. The filtered position is emitted to `riderSlice.currentPosition`.

### 2.2 Stage 2 — Route Computation & Polyline Decoding

#### 2.2.1 OSRM Route Request

**Endpoint:** `https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}`

**Query Parameters:**
| Parameter       | Value                        | Purpose                              |
|----------------|------------------------------|--------------------------------------|
| `overview`     | `full`                       | Complete polyline geometry            |
| `geometries`   | `polyline6`                  | 6-digit precision encoded polyline   |
| `steps`        | `true`                       | Turn-by-turn maneuver metadata       |
| `annotations`  | `duration,distance,speed`    | Per-segment telemetry                |
| `alternatives` | `3`                          | Up to 3 alternative routes           |

#### 2.2.2 Polyline6 Decoding Algorithm

The encoded polyline is decoded into a coordinate array using the standard Google polyline algorithm adapted for 6-digit precision (1e-6 degree resolution ≈ 0.11m at equator):

```
function decodePolyline6(encoded: string): [number, number][] {
  // 1. Read each character, subtract 63, extract 5-bit chunks
  // 2. Reconstruct signed 32-bit integers from variable-length encoding
  // 3. Divide by 1e6 (not 1e5) for polyline6 precision
  // 4. Accumulate deltas to produce absolute lat/lng pairs
  // Returns array of [latitude, longitude] tuples
}
```

**Output:** A dense coordinate array, typically 2,000–15,000 points for a 200–500 km route.

#### 2.2.3 Ramer-Douglas-Peucker (RDP) Simplification

The raw decoded polyline is too dense for real-time rendering. RDP reduces vertex count while preserving route shape:

**Algorithm:**
1. Find the point with maximum perpendicular distance from the line segment connecting start → end.
2. If `maxDistance > ε`, recursively simplify both sub-segments.
3. If `maxDistance ≤ ε`, discard all intermediate points.

**Epsilon Thresholds by Zoom Level:**

| Zoom Level | ε (degrees) | ε (meters approx.) | Use Case               |
|-----------|-------------|--------------------|-----------------------|
| ≤ 8       | 0.001       | ~111m              | Overview/thumbnail     |
| 9–12      | 0.0003      | ~33m               | Regional view          |
| 13–15     | 0.00005     | ~5.5m              | Street-level detail    |
| ≥ 16      | 0 (raw)     | —                  | Full fidelity          |

**Result:** Typically reduces a 10,000-point polyline to 300–800 points at zoom 12, dramatically improving render performance.

### 2.3 Stage 3 — Corridor Sampling & Spatial Indexing

#### 2.3.1 Corridor Definition

A "corridor" is the geographic buffer zone around the route within which POIs are relevant to the rider. The corridor width adapts to context:

| Road Type            | Corridor Half-Width | Rationale                              |
|---------------------|--------------------|-----------------------------------------|
| Highway/Motorway    | 5 km               | Service areas only at exits             |
| State/National Road | 2 km               | POIs typically visible from road        |
| Urban               | 500 m              | Dense POI availability                  |
| Default             | 2 km               | Balanced coverage                       |

#### 2.3.2 Cross-Track Distance Calculation

For each candidate POI, its perpendicular distance to the nearest route segment is computed:

```
Given: Point P, Line segment A→B

1. Project P onto line AB:
   t = dot(AP, AB) / dot(AB, AB)
   t_clamped = clamp(t, 0, 1)

2. Nearest point on segment:
   N = A + t_clamped * (AB)

3. Cross-track distance:
   d = haversine(P, N)

4. Accept POI if d ≤ corridor_half_width
```

**Optimization:** Instead of testing against all N segments, the route is spatially indexed using a simple grid (0.05° cells). Only segments in the POI's grid cell ± 1 neighbor are tested.

#### 2.3.3 Chainage Projection

Each corridor POI receives a **chainage value** — its distance-along-route from the origin, measured in kilometers:

```
1. Find the nearest route segment S_i to the POI.
2. Project the POI onto S_i to get foot-point F.
3. chainage = sum(length(S_0..S_{i-1})) + distance(S_i.start, F)
```

This enables:
- Sorting POIs by ride order (not geographic proximity).
- Fuel-gap analysis (gaps between fuel stations along the route).
- ETA computation to each POI based on average speed.

#### 2.3.4 Overpass QL Corridor Query

The corridor bounding boxes are computed and queried via Overpass API:

**Bbox Chunking Strategy:**
For routes > 50 km, the route is divided into overlapping bbox chunks to avoid Overpass timeout:

```
Route length     → Chunk size    → Overlap
< 50 km          → Single bbox   → N/A
50–150 km        → 50 km chunks  → 5 km overlap
150–300 km       → 75 km chunks  → 7.5 km overlap
> 300 km         → 100 km chunks → 10 km overlap
```

**Overpass QL Template:**
```
[out:json][timeout:30][bbox:{south},{west},{north},{east}];
(
  // Fuel stations
  node["amenity"="fuel"];
  way["amenity"="fuel"];

  // Food & drink
  node["amenity"~"restaurant|cafe|fast_food|food_court"];
  way["amenity"~"restaurant|cafe|fast_food|food_court"];

  // Rest areas
  node["highway"="rest_area"];
  node["amenity"~"parking|shelter|toilets"];

  // Repair & service
  node["shop"="motorcycle"];
  node["shop"~"car_repair|car_parts|tyres"];
  node["amenity"="car_wash"];
  node["craft"="motorcycle_repair"];

  // Accommodation
  node["tourism"~"hotel|motel|guest_house|hostel|camp_site"];

  // Medical
  node["amenity"~"hospital|clinic|pharmacy"];

  // ATM & Banking
  node["amenity"="atm"];
  node["amenity"="bank"];
);
out center meta;
```

### 2.4 Stage 4 — POI Taxonomy, Deduplication & Fuel-Gap Telemetry

#### 2.4.1 OSM Tag → PitStop Category Mapping

Raw OSM tags are normalized into PitStop's internal taxonomy:

```
OSM Tag                              → PitStop Category    → Icon    → Priority
─────────────────────────────────────────────────────────────────────────────────
amenity=fuel                         → FUEL                → ⛽       → CRITICAL
amenity=fuel + fuel:diesel=yes       → FUEL_DIESEL         → ⛽🟢    → CRITICAL
amenity=fuel + fuel:octane_95=yes    → FUEL_PETROL_95      → ⛽       → CRITICAL
amenity=restaurant                   → FOOD_RESTAURANT     → 🍽️     → HIGH
amenity=cafe                         → FOOD_CAFE           → ☕       → MEDIUM
amenity=fast_food                    → FOOD_FAST           → 🍔      → MEDIUM
highway=rest_area                    → REST_AREA           → 🅿️     → HIGH
amenity=parking                      → PARKING             → 🅿️     → LOW
shop=motorcycle                      → MOTO_SHOP           → 🏍️     → HIGH
shop=car_repair                      → REPAIR_GENERAL      → 🔧      → MEDIUM
craft=motorcycle_repair              → MOTO_REPAIR         → 🔧      → HIGH
amenity=hospital                     → MEDICAL_HOSPITAL    → 🏥      → CRITICAL
amenity=clinic                       → MEDICAL_CLINIC      → ⚕️     → HIGH
amenity=pharmacy                     → MEDICAL_PHARMACY    → 💊      → MEDIUM
amenity=atm                          → ATM                 → 💳      → LOW
tourism=hotel                        → STAY_HOTEL          → 🏨      → MEDIUM
tourism=camp_site                    → STAY_CAMP           → ⛺       → MEDIUM
amenity=toilets                      → RESTROOM            → 🚻      → LOW
amenity=shelter                      → SHELTER             → 🛖      → LOW
```

#### 2.4.2 Spatial Deduplication (30m Radius)

OSM data frequently contains duplicate entries (node + way for the same establishment, overlapping imports). PitStop deduplicates using:

**Algorithm:**
```
1. Sort all corridor POIs by [category, chainage].
2. For each POI p_i:
   a. Compare against all POIs p_j where j > i AND same category.
   b. If haversine(p_i, p_j) < 30 meters:
      - Merge: keep the POI with richer metadata (more tags).
      - Transfer any unique tags from the discarded POI.
      - Mark the discarded POI as merged.
3. Return deduplicated set.
```

**Why 30m?** Analysis of OSM data shows that:
- Same-entity duplicates are typically within 5–15m.
- Adjacent but distinct businesses (e.g., two restaurants in a strip mall) are typically > 40m apart.
- 30m provides a safe dedup boundary with minimal false positives.

#### 2.4.3 Fuel-Gap Telemetry & Dead-Zone Analyzer

The fuel-gap analyzer identifies stretches along the route where no fuel station exists, alerting the rider to fill up before entering a dead zone.

**Algorithm:**
```
Input: fuelPOIs[] sorted by chainage, totalRouteDistance, tankRange (default 250 km)

1. Insert virtual "stations" at chainage=0 (origin) and chainage=totalRouteDistance (dest).
2. Compute gaps: gap_i = fuelPOI[i+1].chainage - fuelPOI[i].chainage
3. For each gap_i:
   a. If gap_i > tankRange * 0.8 (200 km default):
      → Emit FuelGapAlert { severity: 'CRITICAL', ... }
   b. If gap_i > tankRange * 0.5 (125 km default):
      → Emit FuelGapAlert { severity: 'WARNING', ... }
   c. If gap_i > tankRange * 0.3 (75 km default):
      → Emit FuelGapAlert { severity: 'INFO', ... }
4. Annotate the "last fuel before gap" POI with isLastBeforeGap=true.
5. Return FuelGapAlert[] sorted by severity (CRITICAL first).
```

**Rider-Configurable Parameters:**
| Parameter        | Default | Description                                |
|-----------------|---------|--------------------------------------------|
| `tankRange`     | 250 km  | Motorcycle tank range at comfortable pace  |
| `reserveBuffer` | 20%     | Percentage of range to trigger warnings    |
| `fuelType`      | `any`   | Filter: `petrol`, `diesel`, `any`          |

---

## 3. Modular Directory Structure

```
src/
├── app/                              # Application shell & entry point
│   ├── App.tsx                       # Root component with providers
│   ├── AppProviders.tsx              # Compose all context providers
│   ├── routes.tsx                    # Route definitions (React Router)
│   └── manifest.json                # PWA manifest
│
├── components/                       # Shared presentational components
│   ├── hud/                          # Tactical Rider HUD components
│   │   ├── HUDShell.tsx             # Dark-themed shell container
│   │   ├── SearchBar.tsx            # Dual-input origin/destination
│   │   ├── POIList.tsx              # Virtualized POI card list
│   │   ├── POICard.tsx              # Individual POI card with actions
│   │   ├── FuelGauge.tsx            # Fuel-gap severity indicator
│   │   ├── BottomDrawer.tsx         # 3-snap-point bottom sheet
│   │   ├── CategoryFilter.tsx       # POI category toggle chips
│   │   ├── RouteAltPicker.tsx       # Alternative route selector
│   │   ├── RiderTelemetryBar.tsx    # Speed/heading/ETA strip
│   │   └── EmergencyPanel.tsx       # Quick-access emergency info
│   │
│   ├── map/                          # Map-specific components
│   │   ├── MapContainer.tsx         # Leaflet/MapLibre wrapper
│   │   ├── POIMarker.tsx            # Category-colored markers
│   │   ├── POICluster.tsx           # Cluster group component
│   │   ├── RoutePolyline.tsx        # Styled route overlay
│   │   ├── CorridorOverlay.tsx      # Semi-transparent corridor
│   │   ├── FuelGapOverlay.tsx       # Red-shaded gap zones
│   │   ├── RiderPositionMarker.tsx  # Animated current position
│   │   └── TileLayerSwitcher.tsx    # Tile source toggle
│   │
│   └── common/                       # Generic reusable components
│       ├── Spinner.tsx
│       ├── Toast.tsx
│       ├── Badge.tsx
│       ├── IconButton.tsx
│       └── OfflineBanner.tsx
│
├── features/                         # Feature-sliced domain modules
│   ├── search/                       # Location search & geocoding
│   │   ├── useGeocodeSearch.ts      # Photon geocode hook
│   │   ├── SearchAutocomplete.tsx   # Debounced autocomplete UI
│   │   └── geocode.service.ts       # Photon API client
│   │
│   ├── routing/                      # Route computation
│   │   ├── useRouteComputation.ts   # OSRM route hook
│   │   ├── route.service.ts         # OSRM API client
│   │   └── RouteSelector.tsx        # Route comparison UI
│   │
│   ├── corridor/                     # Corridor POI discovery
│   │   ├── useCorridorPOIs.ts       # Orchestrator hook
│   │   ├── corridor.service.ts      # Overpass API client
│   │   └── CorridorPanel.tsx        # POI results UI
│   │
│   └── rider/                        # Rider tracking & telemetry
│       ├── useRiderPosition.ts      # GPS watch hook
│       ├── rider.service.ts         # Telemetry processing
│       └── RiderStatus.tsx          # Position/speed display
│
├── geospatial/                       # Pure geospatial computation
│   ├── haversine.ts                 # Haversine distance formula
│   ├── bearing.ts                   # Forward & reverse azimuth
│   ├── crossTrackDistance.ts        # Point-to-segment distance
│   ├── chainageProjection.ts        # Distance-along-route calc
│   ├── polylineDecode.ts            # Polyline6 decoder
│   ├── rdpSimplify.ts              # Ramer-Douglas-Peucker
│   ├── bboxUtils.ts                 # Bounding box computation
│   ├── corridorBuffer.ts           # Corridor polygon generation
│   ├── spatialGrid.ts              # Grid-based spatial index
│   ├── poiDedup.ts                  # 30m radius deduplication
│   ├── fuelGapAnalyzer.ts           # Dead-zone detection
│   ├── kalmanFilter.ts              # GPS smoothing filter
│   └── index.ts                     # Barrel export
│
├── api/                              # API client layer
│   ├── client.ts                    # Base fetch wrapper with retry
│   ├── photon.api.ts                # Photon geocoder client
│   ├── osrm.api.ts                  # OSRM routing client
│   ├── overpass.api.ts              # Overpass API client
│   ├── overpass.mirrors.ts          # Mirror rotation config
│   ├── tileServer.config.ts         # Tile server URLs
│   └── types.ts                     # API response types
│
├── store/                            # Zustand state management
│   ├── routeSlice.ts                # Route state & actions
│   ├── poiSlice.ts                  # POI collection state
│   ├── uiSlice.ts                   # UI state (drawer, filters)
│   ├── riderSlice.ts                # Rider position & telemetry
│   ├── offlineSlice.ts              # Offline/sync state
│   ├── createStore.ts               # Store factory with middleware
│   └── index.ts                     # Combined store export
│
├── offline/                          # Offline & persistence layer
│   ├── idb.ts                       # IndexedDB wrapper (idb library)
│   ├── idb.schema.ts                # Database schema & migrations
│   ├── tileCache.ts                 # Tile blob storage
│   ├── routeCache.ts                # Route GeoJSON cache
│   ├── poiCache.ts                  # POI data cache
│   ├── syncQueue.ts                 # Background sync queue
│   ├── ttlInvalidator.ts           # TTL-based cache cleanup
│   └── offlineDetector.ts           # Network status monitor
│
├── workers/                          # Web Worker scripts
│   ├── geo.worker.ts                # Main geometry worker
│   ├── workerPool.ts                # Worker pool manager
│   ├── workerMessages.ts           # Message type definitions
│   └── workerBridge.ts             # Promise-based worker API
│
├── hooks/                            # Shared custom hooks
│   ├── useOnlineStatus.ts           # Navigator.onLine reactive
│   ├── useDebounce.ts               # Input debouncing
│   ├── useMediaQuery.ts             # Responsive breakpoints
│   ├── useMapSync.ts                # Map ↔ list synchronization
│   └── useServiceWorker.ts          # SW registration & updates
│
├── utils/                            # General utilities
│   ├── formatDistance.ts            # "2.3 km" / "450 m"
│   ├── formatDuration.ts           # "1h 23m"
│   ├── formatSpeed.ts              # "85 km/h"
│   ├── osmTagParser.ts             # OSM tag normalization
│   └── constants.ts                 # App-wide constants
│
├── styles/                           # Global styles & theme
│   ├── theme.ts                     # Design tokens
│   ├── globals.css                  # CSS reset & base styles
│   └── hud.module.css               # HUD-specific styles
│
├── types/                            # Shared TypeScript types
│   ├── domain.ts                    # Core domain interfaces
│   ├── api.ts                       # API response types
│   ├── geo.ts                       # Geospatial types
│   └── ui.ts                        # UI state types
│
├── service-worker/                   # Service Worker source
│   ├── sw.ts                        # Main service worker
│   ├── strategies.ts                # Caching strategies
│   ├── precache-manifest.ts         # Build-generated manifest
│   └── sw-registration.ts          # Registration helper
│
├── __tests__/                        # Test files (mirrors src/)
│   ├── geospatial/
│   ├── api/
│   ├── store/
│   └── components/
│
├── index.tsx                         # Entry point
└── vite-env.d.ts                    # Vite type declarations

public/
├── icons/                            # PWA icons (192, 512, maskable)
├── splash/                           # iOS splash screens
├── manifest.webmanifest             # PWA manifest
├── sw.js                            # Compiled service worker
└── offline.html                     # Offline fallback page
```

---

## 4. TypeScript Domain Contracts

### 4.1 Core Geospatial Primitives

```typescript
/**
 * A geographic point with optional elevation.
 * All coordinates use WGS84 (EPSG:4326).
 */
interface GeoPoint {
  /** Latitude in decimal degrees, range [-90, 90] */
  readonly lat: number;
  /** Longitude in decimal degrees, range [-180, 180] */
  readonly lng: number;
  /** Elevation in meters above sea level (optional, from SRTM/GPS) */
  readonly elevation?: number;
}

/**
 * A single segment of a computed route between two adjacent waypoints.
 * Segments compose into a full RouteGeometry.
 */
interface RouteSegment {
  /** Starting point of this segment */
  readonly start: GeoPoint;
  /** Ending point of this segment */
  readonly end: GeoPoint;
  /** Segment index within the parent route (0-based) */
  readonly index: number;
  /** Great-circle distance of this segment in meters */
  readonly distanceMeters: number;
  /** Estimated travel duration in seconds */
  readonly durationSeconds: number;
  /** Road name or reference (e.g., "NH-48", "M.G. Road") */
  readonly roadName: string | null;
  /** OSM highway classification */
  readonly roadType: 'motorway' | 'trunk' | 'primary' | 'secondary' |
                      'tertiary' | 'residential' | 'unclassified' | 'service';
  /** Average speed for this segment in km/h (from OSRM annotations) */
  readonly avgSpeedKmh: number;
  /** Encoded sub-polyline for this segment (polyline6) */
  readonly encodedGeometry: string;
}
```

### 4.2 Route & Corridor Domain

```typescript
/**
 * Complete route corridor with geometry, POIs, and analysis results.
 * This is the primary domain aggregate for a planned ride.
 */
interface RouteCorridor {
  /** Unique identifier (SHA-256 hash of origin+destination+profile+timestamp) */
  readonly id: string;
  /** Route computation timestamp */
  readonly computedAt: string; // ISO 8601
  /** Starting location */
  readonly origin: GeoPoint & { label: string };
  /** Ending location */
  readonly destination: GeoPoint & { label: string };
  /** Ordered array of route segments */
  readonly segments: RouteSegment[];
  /** Full decoded polyline coordinates (simplified for current zoom) */
  readonly polyline: GeoPoint[];
  /** Raw encoded polyline6 string from OSRM */
  readonly encodedPolyline: string;
  /** Total route distance in meters */
  readonly totalDistanceMeters: number;
  /** Total estimated duration in seconds */
  readonly totalDurationSeconds: number;
  /** Corridor half-width in meters (adaptive per road type) */
  readonly corridorWidthMeters: number;
  /** Bounding box encompassing the entire corridor */
  readonly bbox: {
    readonly south: number;
    readonly west: number;
    readonly north: number;
    readonly east: number;
  };
  /** All POIs discovered within the corridor */
  readonly pois: CorridorPOI[];
  /** Fuel gap analysis results */
  readonly fuelGaps: FuelGapAlert[];
  /** Alternative routes (up to 3), each a simplified RouteCorridor */
  readonly alternatives: Omit<RouteCorridor, 'alternatives'>[];
  /** Route profile used */
  readonly profile: 'car' | 'bike' | 'foot';
  /** Whether this corridor was loaded from offline cache */
  readonly isOfflineCached: boolean;
  /** Cache expiry timestamp */
  readonly cacheExpiresAt: string | null; // ISO 8601
}
```

### 4.3 POI Domain

```typescript
/**
 * Enumeration of all POI categories in PitStop's taxonomy.
 */
type POICategory =
  | 'FUEL'
  | 'FUEL_DIESEL'
  | 'FUEL_PETROL_95'
  | 'FUEL_PETROL_91'
  | 'FOOD_RESTAURANT'
  | 'FOOD_CAFE'
  | 'FOOD_FAST'
  | 'FOOD_COURT'
  | 'REST_AREA'
  | 'PARKING'
  | 'MOTO_SHOP'
  | 'MOTO_REPAIR'
  | 'REPAIR_GENERAL'
  | 'CAR_PARTS'
  | 'TYRES'
  | 'CAR_WASH'
  | 'MEDICAL_HOSPITAL'
  | 'MEDICAL_CLINIC'
  | 'MEDICAL_PHARMACY'
  | 'ATM'
  | 'BANK'
  | 'STAY_HOTEL'
  | 'STAY_MOTEL'
  | 'STAY_GUEST_HOUSE'
  | 'STAY_HOSTEL'
  | 'STAY_CAMP'
  | 'RESTROOM'
  | 'SHELTER'
  | 'WATER'
  | 'VIEWPOINT';

/**
 * Category group for UI filtering.
 */
type POICategoryGroup =
  | 'fuel'
  | 'food'
  | 'rest'
  | 'repair'
  | 'medical'
  | 'finance'
  | 'stay'
  | 'utility';

/**
 * A Point of Interest within the route corridor.
 */
interface CorridorPOI {
  /** Unique PitStop ID (derived from OSM ID + category) */
  readonly id: string;
  /** Original OpenStreetMap node/way ID */
  readonly osmId: number;
  /** OSM element type */
  readonly osmType: 'node' | 'way' | 'relation';
  /** Geographic position (centroid for way/relation elements) */
  readonly position: GeoPoint;
  /** PitStop category classification */
  readonly category: POICategory;
  /** Parent category group */
  readonly categoryGroup: POICategoryGroup;
  /** Display name (from OSM name tag, or generated fallback) */
  readonly name: string;
  /** Perpendicular distance from the route in meters */
  readonly crossTrackDistanceMeters: number;
  /** Distance along route from origin in meters */
  readonly chainageMeters: number;
  /** Side of the route this POI is on */
  readonly side: 'left' | 'right' | 'on-route';
  /** Estimated time to reach this POI from current position in seconds */
  readonly etaSeconds: number | null;
  /** Raw OSM tags (preserved for detailed display) */
  readonly osmTags: Record<string, string>;
  /** Operating hours parsed from opening_hours tag */
  readonly openingHours: string | null;
  /** Phone number from OSM */
  readonly phone: string | null;
  /** Website URL from OSM */
  readonly website: string | null;
  /** Brand name (e.g., "Indian Oil", "HP", "Shell") */
  readonly brand: string | null;
  /** Whether this is the last fuel station before a gap */
  readonly isLastBeforeGap: boolean;
  /** Deduplication: IDs of merged duplicate POIs */
  readonly mergedFrom: string[];
  /** Data freshness timestamp */
  readonly fetchedAt: string; // ISO 8601
  /** Priority score for display ordering (higher = more important) */
  readonly displayPriority: number;
}
```

### 4.4 Fuel Gap Analysis

```typescript
/**
 * Alert generated when a fuel gap exceeds safety thresholds.
 */
interface FuelGapAlert {
  /** Unique alert identifier */
  readonly id: string;
  /** Severity level based on gap vs. tank range ratio */
  readonly severity: 'CRITICAL' | 'WARNING' | 'INFO';
  /** Start chainage of the gap in meters */
  readonly gapStartMeters: number;
  /** End chainage of the gap in meters */
  readonly gapEndMeters: number;
  /** Length of the gap in meters */
  readonly gapLengthMeters: number;
  /** Geographic start point of the gap */
  readonly gapStartPoint: GeoPoint;
  /** Geographic end point of the gap */
  readonly gapEndPoint: GeoPoint;
  /** The last fuel station before this gap (fill up here!) */
  readonly lastFuelStation: CorridorPOI | null;
  /** The first fuel station after this gap */
  readonly nextFuelStation: CorridorPOI | null;
  /** Human-readable message */
  readonly message: string;
  /** Gap as percentage of configured tank range */
  readonly gapToRangeRatio: number;
}
```

### 4.5 Rider Telemetry

```typescript
/**
 * Real-time rider telemetry state.
 */
interface RiderTelemetry {
  /** Current GPS position (Kalman-filtered) */
  readonly position: GeoPoint;
  /** Raw GPS accuracy in meters */
  readonly accuracyMeters: number;
  /** Current speed in km/h (derived from position deltas) */
  readonly speedKmh: number;
  /** Current heading in degrees (0 = North, clockwise) */
  readonly headingDeg: number;
  /** Current chainage along active route in meters (-1 if off-route) */
  readonly chainageMeters: number;
  /** Distance remaining to destination in meters */
  readonly remainingDistanceMeters: number;
  /** Estimated time remaining in seconds */
  readonly etaSeconds: number;
  /** Whether the rider is currently on the computed route */
  readonly isOnRoute: boolean;
  /** Deviation distance from route in meters (0 if on-route) */
  readonly deviationMeters: number;
  /** GPS fix timestamp */
  readonly timestamp: string; // ISO 8601
  /** GPS signal quality */
  readonly signalQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'no-fix';
  /** Is the rider currently moving? (speed > 3 km/h) */
  readonly isMoving: boolean;
}
```

### 4.6 Overpass Query Strategy

```typescript
/**
 * Configuration for an Overpass API query strategy,
 * including mirror selection, chunking, and tag filters.
 */
interface OverpassQueryStrategy {
  /** Active mirror URL (selected from rotation pool) */
  readonly mirrorUrl: string;
  /** All available mirror URLs in preference order */
  readonly mirrorPool: string[];
  /** Current mirror index in the rotation */
  readonly currentMirrorIndex: number;
  /** Bounding box chunks for this route */
  readonly bboxChunks: Array<{
    readonly south: number;
    readonly west: number;
    readonly north: number;
    readonly east: number;
    /** Chunk index for progress tracking */
    readonly index: number;
    /** Whether this chunk has been fetched */
    fetched: boolean;
    /** Number of retry attempts for this chunk */
    retryCount: number;
  }>;
  /** Overpass QL query template (with {bbox} placeholder) */
  readonly queryTemplate: string;
  /** Timeout per query in seconds */
  readonly timeoutSeconds: number;
  /** Maximum response size in bytes (maxsize parameter) */
  readonly maxSizeBytes: number;
  /** Tags to query, organized by category group */
  readonly tagFilters: Record<POICategoryGroup, string[]>;
  /** Rate limit: minimum ms between requests to same mirror */
  readonly rateLimitMs: number;
  /** Maximum concurrent in-flight requests */
  readonly maxConcurrent: number;
}
```

### 4.7 Offline Cache Manifest

```typescript
/**
 * Tracks the state of offline-cached data for a geographic region or route.
 */
interface OfflineCacheManifest {
  /** Unique manifest identifier */
  readonly id: string;
  /** Cache version for migration support */
  readonly version: number;
  /** When this manifest was created */
  readonly createdAt: string; // ISO 8601
  /** When any cached data was last updated */
  readonly lastUpdatedAt: string; // ISO 8601
  /** Associated route corridor ID (if route-specific cache) */
  readonly routeCorridorId: string | null;
  /** Cached tile metadata */
  readonly tiles: {
    /** Number of cached tile blobs */
    readonly count: number;
    /** Total size of cached tiles in bytes */
    readonly sizeBytes: number;
    /** Zoom levels cached */
    readonly zoomLevels: number[];
    /** Tile expiry timestamp */
    readonly expiresAt: string; // ISO 8601
  };
  /** Cached route data */
  readonly routes: {
    readonly count: number;
    readonly sizeBytes: number;
    readonly expiresAt: string; // ISO 8601
  };
  /** Cached POI data */
  readonly pois: {
    readonly count: number;
    readonly sizeBytes: number;
    readonly categories: POICategoryGroup[];
    readonly expiresAt: string; // ISO 8601
  };
  /** Total cache size in bytes */
  readonly totalSizeBytes: number;
  /** Maximum allowed cache size in bytes (quota) */
  readonly quotaBytes: number;
  /** Storage usage as percentage of quota */
  readonly usagePercent: number;
  /** Pending sync items (queued while offline) */
  readonly pendingSyncCount: number;
}
```

---

## 5. API Resilience & Rate-Limit Strategy

### 5.1 Overpass API Mirror Failover Rotation

PitStop uses three public Overpass API mirrors with automatic failover:

```
Priority  Mirror                              Region    Rate Limit    Max Payload
────────  ──────────────────────────────────   ──────    ──────────    ───────────
1 (Primary)  https://overpass-api.de/api/interpreter    EU-DE     2 req/10s     256 MB
2 (Secondary) https://overpass.kumi.systems/api/interpreter   EU-FR     5 req/min     128 MB
3 (Tertiary)  https://maps.mail.ru/osm/tools/overpass/api/interpreter  RU     3 req/10s     256 MB
```

**Failover State Machine:**

```
                    ┌─────────────────┐
                    │   HEALTHY       │
           ┌──────>│ (Use this mirror)│<──────────────────┐
           │       └────────┬────────┘                    │
           │                │                             │
           │          HTTP 429/503                   Success after
           │          or timeout                     cooldown
           │                │                             │
           │                ▼                             │
           │       ┌─────────────────┐                    │
           │       │   DEGRADED      │                    │
           │       │ (1 failure)     │────── Success ────>┘
           │       └────────┬────────┘
           │                │
           │          2nd consecutive
           │          failure
           │                │
           │                ▼
           │       ┌─────────────────┐
           │       │   CIRCUIT_OPEN  │
           │       │ (Skip mirror)   │
           │       └────────┬────────┘
           │                │
           │          Cooldown timer
           │          (60s initial,
           │           doubles each
           │           trip, max 15m)
           │                │
           │                ▼
           │       ┌─────────────────┐
           └───────│  HALF_OPEN      │
                   │ (Test 1 request)│
                   └─────────────────┘
```

**Mirror Selection Algorithm:**
```typescript
function selectMirror(mirrors: MirrorState[]): MirrorState {
  // 1. Filter to HEALTHY or HALF_OPEN mirrors
  const available = mirrors.filter(m =>
    m.status === 'HEALTHY' || m.status === 'HALF_OPEN'
  );

  // 2. If none available, pick the CIRCUIT_OPEN mirror closest to cooldown expiry
  if (available.length === 0) {
    return mirrors.reduce((a, b) =>
      a.cooldownExpiresAt < b.cooldownExpiresAt ? a : b
    );
  }

  // 3. Among available, prefer HEALTHY over HALF_OPEN
  const healthy = available.filter(m => m.status === 'HEALTHY');
  if (healthy.length > 0) {
    // Pick the one with the lowest recent latency
    return healthy.reduce((a, b) =>
      a.avgLatencyMs < b.avgLatencyMs ? a : b
    );
  }

  // 4. Use HALF_OPEN mirror (test request)
  return available[0];
}
```

### 5.2 Bbox Chunking for Long Routes (300+ km)

Long routes require splitting the Overpass query into geographic chunks to avoid timeouts:

**Chunking Algorithm:**
```
Input: route polyline, chunkSizeKm

1. Walk the polyline, accumulating distance.
2. Every chunkSizeKm, record a split point.
3. For each chunk between split points:
   a. Compute the tight bounding box of all points in the chunk.
   b. Expand bbox by corridorWidth in all directions.
   c. Add overlap margin (10% of chunk size) to north/south edges
      to prevent POIs at chunk boundaries from being missed.
4. Return bbox[] with chunk metadata.
```

**Chunk Execution Strategy:**
- Chunks are queued and executed with max concurrency of 2.
- Each chunk respects per-mirror rate limits.
- Failed chunks are retried up to 3 times with the next mirror.
- Partial results are displayed immediately as chunks complete (progressive loading).
- Results across chunks are merged and deduplicated.

### 5.3 Exponential Backoff with Jitter

All API calls use exponential backoff on failure:

```
baseDelay = 1000ms
maxDelay  = 30000ms
maxRetries = 4

attempt   delay (ms)         with jitter
───────   ──────────         ────────────────────────
1         1000               random(500, 1500)
2         2000               random(1000, 3000)
3         4000               random(2000, 6000)
4         8000               random(4000, 12000)
fail      → switch mirror or return cached/offline data
```

**Jitter Formula:** `delay = baseDelay * 2^attempt * (0.5 + Math.random())`

This prevents thundering herd when multiple clients retry simultaneously.

### 5.4 IndexedDB TTL Invalidation

Each cached entry has a `expiresAt` timestamp. The TTL invalidator runs:

**TTL Configuration:**

| Data Type        | TTL       | Rationale                                       |
|-----------------|-----------|------------------------------------------------|
| Map tiles        | 7 days    | OSM tiles update weekly                         |
| Route geometry   | 24 hours  | Roads rarely change, but construction happens   |
| POI data         | 12 hours  | Business hours / fuel prices may change daily   |
| Geocode results  | 72 hours  | Place names are very stable                     |
| Rider prefs      | ∞         | Never expire                                    |
| Sync queue items | 48 hours  | Discard if not synced within 2 days             |

**Invalidation Triggers:**
1. **On-access check:** When reading from cache, compare `now > expiresAt`. If expired, return stale data *and* trigger background refresh.
2. **Periodic sweep:** Every 6 hours (when app is foregrounded), scan all stores for expired entries and delete them.
3. **Storage pressure:** When `navigator.storage.estimate()` shows > 80% usage, evict oldest expired entries first, then oldest valid entries by LRU.
4. **Manual purge:** User can clear specific cache categories from settings.

**Invalidation Sweep Implementation:**
```typescript
async function sweepExpiredEntries(db: IDBDatabase): Promise<SweepResult> {
  const now = Date.now();
  const stores = ['tile_cache', 'route_cache', 'poi_cache', 'sync_queue'];
  let totalEvicted = 0;

  for (const storeName of stores) {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const index = store.index('expiresAt');
    const range = IDBKeyRange.upperBound(now);

    let cursor = await index.openCursor(range);
    while (cursor) {
      cursor.delete();
      totalEvicted++;
      cursor = await cursor.continue();
    }
  }

  return { totalEvicted, timestamp: new Date().toISOString() };
}
```

---

## 6. Web Worker Offloading Plan

### 6.1 Why Offload?

The main thread must remain responsive for map pan/zoom interactions (targeting 60 fps) and touch gesture recognition. The following operations are CPU-intensive and MUST run off the main thread:

| Operation                   | Typical Input Size       | Main Thread Cost | Worker Benefit     |
|----------------------------|--------------------------|------------------|--------------------|
| Polyline6 decode            | 10K–50K characters       | 15–80ms          | Zero main-thread   |
| RDP simplification          | 5K–15K points            | 30–200ms         | Zero main-thread   |
| Cross-track distance (all)  | 500 POIs × 2K segments   | 100–800ms        | Zero main-thread   |
| Chainage projection         | 500 POIs × 2K segments   | 50–300ms         | Zero main-thread   |
| POI deduplication           | 500–2000 POIs            | 20–100ms         | Zero main-thread   |
| Fuel-gap analysis           | 50–200 fuel POIs         | 5–20ms           | Batched with above |
| Corridor buffer polygon     | 2K–10K route points      | 50–200ms         | Zero main-thread   |
| Kalman filter batch         | 100–500 GPS points       | 5–30ms           | Near-realtime      |

### 6.2 Worker Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       MAIN THREAD                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                 WorkerBridge (Singleton)                   │    │
│  │                                                          │    │
│  │  • Maintains Map<taskId, {resolve, reject}> for pending  │    │
│  │  • Routes responses back to correct Promise              │    │
│  │  • Handles worker errors and restarts                    │    │
│  │  • Tracks worker utilization metrics                     │    │
│  │                                                          │    │
│  │  API:                                                    │    │
│  │  ├── decodePolyline(encoded) → Promise<GeoPoint[]>       │    │
│  │  ├── simplifyRoute(points, ε) → Promise<GeoPoint[]>      │    │
│  │  ├── computeCorridor(route, pois) → Promise<CorridorPOI[]>│   │
│  │  ├── analyzeGaps(fuelPOIs, range) → Promise<FuelGapAlert[]>│  │
│  │  └── deduplicatePOIs(pois, radius) → Promise<CorridorPOI[]>│  │
│  └─────────────────┬────────────────────────────────────────┘    │
│                    │ postMessage (Transferable ArrayBuffer)       │
│                    ▼                                              │
└────────────────────────────────────────────────────────────────── ┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ GeoWorker #1 │ │ GeoWorker #2 │ │ GeoWorker #3 │
│              │ │              │ │              │
│ Message      │ │ Message      │ │ Message      │
│ Handler:     │ │ Handler:     │ │ Handler:     │
│              │ │              │ │              │
│ switch(type):│ │ switch(type):│ │ switch(type):│
│  DECODE_POLY │ │  DECODE_POLY │ │  DECODE_POLY │
│  RDP_SIMPLIFY│ │  RDP_SIMPLIFY│ │  RDP_SIMPLIFY│
│  CROSS_TRACK │ │  CROSS_TRACK │ │  CROSS_TRACK │
│  CHAINAGE    │ │  CHAINAGE    │ │  CHAINAGE    │
│  POI_DEDUP   │ │  POI_DEDUP   │ │  POI_DEDUP   │
│  FUEL_GAP    │ │  FUEL_GAP    │ │  FUEL_GAP    │
│  CORRIDOR_BUF│ │  CORRIDOR_BUF│ │  CORRIDOR_BUF│
│  KALMAN_BATCH│ │  KALMAN_BATCH│ │  KALMAN_BATCH│
└──────────────┘ └──────────────┘ └──────────────┘
```

### 6.3 Worker Pool Management

```typescript
// Pool sizing adapts to device capability
const POOL_SIZE = Math.min(
  navigator.hardwareConcurrency ?? 2,
  4  // Cap at 4 to avoid memory pressure on mobile
);
```

**Task Assignment Strategy:**
1. Round-robin assignment for independent tasks.
2. Sequential assignment for pipeline tasks (decode → simplify → corridor) — all stages go to the same worker to avoid serialization overhead.
3. If a worker is busy, the task is queued in a FIFO buffer.
4. Workers are terminated after 60s of idle time and respawned on demand to conserve memory.

### 6.4 Data Transfer Optimization

- **Transferable ArrayBuffers:** Coordinate arrays are transferred (not copied) using `postMessage(data, [data.buffer])` for zero-copy transfer.
- **Float64Array encoding:** GeoPoint arrays are packed into `Float64Array` (16 bytes per point: 8 for lat, 8 for lng) instead of JSON objects.
- **Batch operations:** Multiple small tasks are batched into a single message to reduce postMessage overhead.

**Transfer Size Example:**
```
5,000 points as JSON objects: ~350 KB (serialization: ~15ms)
5,000 points as Float64Array: ~80 KB  (transfer: ~0.1ms, zero-copy)
Savings: 77% size reduction, 150× faster transfer
```

---

## 7. Offline & PWA Strategy

### 7.1 Service Worker Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    SERVICE WORKER (sw.ts)                      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   INSTALL EVENT                         │  │
│  │                                                        │  │
│  │  1. Precache app shell (HTML, JS, CSS, fonts, icons)   │  │
│  │  2. Cache offline fallback page                        │  │
│  │  3. self.skipWaiting() for immediate activation        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   ACTIVATE EVENT                        │  │
│  │                                                        │  │
│  │  1. Clean old cache versions                           │  │
│  │  2. clients.claim() to control all tabs immediately    │  │
│  │  3. Run IndexedDB migration if schema version changed  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   FETCH EVENT ROUTER                    │  │
│  │                                                        │  │
│  │  Request URL                     → Strategy            │  │
│  │  ─────────────────────────────   ─────────────────     │  │
│  │  /                               → Cache-First         │  │
│  │  /*.html                         → Cache-First         │  │
│  │  /assets/*.js                    → Cache-First         │  │
│  │  /assets/*.css                   → Cache-First         │  │
│  │  /assets/*.woff2                 → Cache-First         │  │
│  │  /icons/*                        → Cache-First         │  │
│  │                                                        │  │
│  │  tile.openstreetmap.org/*        → Stale-While-Rev.    │  │
│  │  *.tile.openstreetmap.org/*      → Stale-While-Rev.    │  │
│  │                                                        │  │
│  │  photon.komoot.io/*              → Network-First       │  │
│  │  router.project-osrm.org/*       → Network-First       │  │
│  │  overpass-api.de/*               → Network-First       │  │
│  │  overpass.kumi.systems/*         → Network-First       │  │
│  │  maps.mail.ru/*                  → Network-First       │  │
│  │                                                        │  │
│  │  (navigation fallback)           → offline.html        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   BACKGROUND SYNC                       │  │
│  │                                                        │  │
│  │  Tag: 'pitstop-sync'                                   │  │
│  │  • Replay queued API requests when connectivity returns │  │
│  │  • Process queued telemetry uploads                    │  │
│  │  • Retry failed Overpass queries for offline corridors │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   PERIODIC SYNC (if supported)          │  │
│  │                                                        │  │
│  │  Tag: 'pitstop-cache-refresh'                          │  │
│  │  Interval: 12 hours                                    │  │
│  │  • Refresh POI data for pinned/saved routes            │  │
│  │  • Pre-cache tiles for upcoming planned rides          │  │
│  │  • Sweep expired cache entries                         │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Caching Strategy Details

#### Cache-First (App Shell)
```
Request → Check Cache → Hit? → Return cached response
                     → Miss? → Fetch from network
                              → Cache the response
                              → Return response
                              → If network fails → Return offline.html
```
**Used for:** Static assets that change only on deployment. Cache key includes content hash from build.

#### Network-First (API Data)
```
Request → Fetch from network → Success? → Cache response in IndexedDB
                                        → Return response
                             → Failure? → Check IndexedDB cache
                                        → Hit? → Return stale data + show "offline" badge
                                        → Miss? → Return error state
```
**Used for:** Geocode results, routes, POIs. Ensures freshness when online; serves stale data when offline.

#### Stale-While-Revalidate (Map Tiles)
```
Request → Check Cache → Hit? → Return cached tile IMMEDIATELY
                             → Fetch fresh tile in background
                             → Update cache (silent, no UI update)
                     → Miss? → Fetch from network
                              → Cache the tile
                              → Return tile
                              → If network fails → Return placeholder tile
```
**Used for:** Map tiles that rarely change but should stay reasonably fresh.

### 7.3 IndexedDB Schema

**Database Name:** `pitstop-db`  
**Current Version:** 1

```typescript
// Schema definition using idb library
const DB_SCHEMA = {
  version: 1,
  stores: {
    tile_cache: {
      keyPath: 'key',          // Format: "z/x/y" (e.g., "14/8723/5765")
      indexes: {
        expiresAt: { unique: false },
        zoomLevel: { unique: false },
        sizeBytes: { unique: false },
      },
      // Value: { key, blob: Blob, zoomLevel, sizeBytes, fetchedAt, expiresAt }
    },

    route_cache: {
      keyPath: 'id',           // SHA-256 hash of origin+destination+profile
      indexes: {
        expiresAt: { unique: false },
        origin: { unique: false, multiEntry: false },
        destination: { unique: false, multiEntry: false },
        computedAt: { unique: false },
      },
      // Value: RouteCorridor (full domain object)
    },

    poi_cache: {
      keyPath: 'id',           // PitStop POI ID
      indexes: {
        osmId: { unique: false },
        category: { unique: false },
        categoryGroup: { unique: false },
        expiresAt: { unique: false },
        chainageMeters: { unique: false },
        routeCorridorId: { unique: false },
      },
      // Value: CorridorPOI (full domain object) + routeCorridorId
    },

    rider_prefs: {
      keyPath: 'key',          // Preference key (e.g., "tankRange", "theme")
      // Value: { key, value: any, updatedAt }
      // No TTL — persists forever
    },

    sync_queue: {
      keyPath: 'id',           // Auto-incrementing
      autoIncrement: true,
      indexes: {
        type: { unique: false },      // 'api_request' | 'telemetry'
        createdAt: { unique: false },
        expiresAt: { unique: false },
        status: { unique: false },     // 'pending' | 'in_progress' | 'failed'
      },
      // Value: { id, type, payload: Request-like object, createdAt, expiresAt, status, retryCount }
    },

    offline_manifest: {
      keyPath: 'id',
      indexes: {
        routeCorridorId: { unique: false },
        createdAt: { unique: false },
      },
      // Value: OfflineCacheManifest
    },
  },
};
```

### 7.4 Offline-First Data Access Pattern

```typescript
async function fetchWithOfflineFallback<T>(
  cacheKey: string,
  storeName: string,
  networkFetcher: () => Promise<T>,
  ttlMs: number,
): Promise<{ data: T; source: 'network' | 'cache' | 'stale-cache' }> {
  // 1. Try IndexedDB cache first
  const cached = await idb.get(storeName, cacheKey);

  if (cached && Date.now() < cached.expiresAt) {
    // Fresh cache hit — trigger background refresh if online
    if (navigator.onLine) {
      queueBackgroundRefresh(cacheKey, storeName, networkFetcher, ttlMs);
    }
    return { data: cached.value, source: 'cache' };
  }

  // 2. Try network
  if (navigator.onLine) {
    try {
      const freshData = await networkFetcher();
      // Cache the fresh response
      await idb.put(storeName, {
        key: cacheKey,
        value: freshData,
        fetchedAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
      });
      return { data: freshData, source: 'network' };
    } catch (error) {
      // Network failed — fall through to stale cache
    }
  }

  // 3. Return stale cache (if any)
  if (cached) {
    return { data: cached.value, source: 'stale-cache' };
  }

  // 4. No cache, no network — throw
  throw new OfflineError('No cached data available and network is unreachable.');
}
```

### 7.5 Background Sync Queue

When the app is offline and an API call would normally be made, the request is queued:

```typescript
// Enqueue a request for later sync
async function enqueueForSync(request: SyncableRequest): Promise<void> {
  await idb.add('sync_queue', {
    type: request.type,
    payload: {
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body,
    },
    createdAt: Date.now(),
    expiresAt: Date.now() + 48 * 60 * 60 * 1000, // 48h
    status: 'pending',
    retryCount: 0,
  });

  // Register for background sync
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register('pitstop-sync');
  }
}
```

### 7.6 PWA Manifest

```json
{
  "name": "PitStop — Motorcycle Ride Planner",
  "short_name": "PitStop",
  "description": "Corridor-aware POI discovery and fuel-gap telemetry for motorcyclists",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#0B0F17",
  "background_color": "#0B0F17",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "categories": ["navigation", "travel"],
  "shortcuts": [
    {
      "name": "Plan Ride",
      "url": "/plan",
      "icons": [{ "src": "/icons/shortcut-plan.png", "sizes": "96x96" }]
    },
    {
      "name": "Saved Routes",
      "url": "/saved",
      "icons": [{ "src": "/icons/shortcut-saved.png", "sizes": "96x96" }]
    }
  ]
}
```

---

## 8. UI/UX Tactical Rider HUD Specification

### 8.1 Design Philosophy

PitStop's UI is a **Tactical Rider HUD** — not a consumer map app. Design decisions prioritize:

1. **Glanceability:** Information must be readable in < 1 second at arm's length.
2. **Touch safety:** All interactive targets are ≥ 48×48 dp for gloved-hand operation.
3. **Night riding:** Pure dark theme eliminates screen glare on helmet visors.
4. **Minimal distraction:** Critical data is always visible; supplementary data is on-demand.

### 8.2 Color System — Dark HUD Palette

```
Token                  Hex        RGB              Usage
─────────────────────  ─────────  ───────────────  ──────────────────────────
--hud-bg-primary       #0B0F17    (11, 15, 23)     App background, map overlay base
--hud-bg-secondary     #131924    (19, 25, 36)     Card backgrounds, drawer surface
--hud-bg-tertiary      #1A2235    (26, 34, 53)     Elevated surfaces, bottom sheet
--hud-bg-elevated      #212B3E    (33, 43, 62)     Active states, pressed surfaces

--hud-border-subtle    #1E2A3D    (30, 42, 61)     Dividers, card borders
--hud-border-active    #2D4A6F    (45, 74, 111)    Focus rings, active borders

--hud-text-primary     #E8ECF1    (232, 236, 241)  Primary text, headings
--hud-text-secondary   #8899AA    (136, 153, 170)  Secondary labels, metadata
--hud-text-muted       #556677    (85, 102, 119)   Disabled text, placeholders

--hud-accent-blue      #3B82F6    (59, 130, 246)   Route line, primary actions
--hud-accent-cyan      #22D3EE    (34, 211, 238)   Rider position, GPS indicator
--hud-accent-green     #10B981    (16, 185, 129)   Success, fuel available
--hud-accent-amber     #F59E0B    (245, 158, 11)   Warning, fuel gap caution
--hud-accent-red       #EF4444    (239, 68, 68)    Critical alert, fuel gap danger
--hud-accent-purple    #8B5CF6    (139, 92, 246)   Alternative routes

--hud-fuel             #F97316    (249, 115, 22)   Fuel station markers
--hud-food             #10B981    (16, 185, 129)   Food/restaurant markers
--hud-repair           #6366F1    (99, 102, 241)   Repair/mechanic markers
--hud-medical          #EF4444    (239, 68, 68)    Medical/emergency markers
--hud-stay             #8B5CF6    (139, 92, 246)   Accommodation markers
--hud-rest             #22D3EE    (34, 211, 238)   Rest area markers
```

### 8.3 Typography Scale

```
Element            Font                 Size    Weight  Line Height  Letter Spacing
─────────────────  ───────────────────  ──────  ──────  ───────────  ──────────────
HUD Metric Value   Inter / System       32px    700     1.1          -0.02em
Section Title      Inter / System       18px    600     1.3          -0.01em
Card Title         Inter / System       15px    600     1.4          0
Body Text          Inter / System       14px    400     1.5          0
Label / Caption    Inter / System       12px    500     1.4          0.02em
Badge / Tag        Inter / System       11px    600     1.0          0.04em
Monospace Data     JetBrains Mono       13px    400     1.3          0
```

### 8.4 Responsive Layout — Dual-Pane Architecture

```
MOBILE (< 768px)                          TABLET/DESKTOP (≥ 768px)
─────────────────────                     ───────────────────────────────────────

┌────────────────────┐                    ┌──────────────────────┬─────────────┐
│   STATUS BAR       │                    │                      │  SIDE PANEL │
│   (GPS, Offline)   │                    │                      │  (380px)    │
├────────────────────┤                    │                      │             │
│                    │                    │      MAP VIEW        │  ┌────────┐ │
│                    │                    │      (flex: 1)       │  │ Search │ │
│    MAP VIEW        │                    │                      │  ├────────┤ │
│    (100vh)         │                    │                      │  │Category│ │
│                    │                    │                      │  │Filters │ │
│                    │                    │                      │  ├────────┤ │
│                    │                    │                      │  │        │ │
│                    │                    │                      │  │  POI   │ │
├────────────────────┤                    │                      │  │  List  │ │
│ ┌────────────────┐ │                    │                      │  │        │ │
│ │ BOTTOM DRAWER  │ │                    │                      │  │        │ │
│ │                │ │                    │                      │  │        │ │
│ │ Snap 1: Peek   │ │                    │                      │  ├────────┤ │
│ │ (80px handle)  │ │                    │                      │  │  Fuel  │ │
│ │                │ │                    │                      │  │  Gauge │ │
│ │ Snap 2: Half   │ │                    │                      │  │        │ │
│ │ (50vh)         │ │                    │                      │  └────────┘ │
│ │                │ │                    │                      │             │
│ │ Snap 3: Full   │ │                    └──────────────────────┴─────────────┘
│ │ (90vh)         │ │
│ └────────────────┘ │
└────────────────────┘
```

### 8.5 Bottom Drawer — 3 Snap Points

The bottom drawer uses CSS `scroll-snap` with spring physics:

| Snap Point | Height | Content Visible                              | Trigger            |
|-----------|--------|----------------------------------------------|--------------------|
| **Peek**  | 80px   | Drag handle + route summary strip            | Default / swipe ↓  |
| **Half**  | 50vh   | Search + filter chips + first 3–4 POI cards  | Tap handle / ↑     |
| **Full**  | 90vh   | Full POI list + fuel gauge + route details   | Swipe ↑ from half  |

**Snap Behavior:**
- Velocity-based snap: flick up → snap to next point; flick down → snap to previous.
- Threshold: > 30% past a snap boundary → commit; < 30% → spring back.
- Map interaction: When drawer is at Half or Full, the map is compressed but still pannable.
- Keyboard: `Escape` closes to Peek; `↑`/`↓` cycles snap points.

### 8.6 Touch Target Specification

```
Component             Min Size     Padding   Hit Area
────────────────────  ──────────   ────────  ─────────
POI Card (tappable)   Full width   16px      48px height min
Category Chip         auto × 36px  12px H    48×48 (expanded hit)
Map Zoom +/-          44×44        —         48×48
Search Input          Full width   12px      48px height
Drawer Handle         Full width   —         48×20 (handle) + 20px top margin
Icon Buttons          40×40        4px       48×48
FAB (Locate Me)       56×56        —         56×56
Back/Close            40×40        4px       48×48
```

### 8.7 Map ↔ List Synchronized Interaction

```
User Action                    Map Response                List Response
──────────────────────────     ──────────────────────      ──────────────────────
Tap POI marker on map          → Highlight marker          → Scroll to POI card
                               → Show tooltip              → Highlight card border

Tap POI card in list           → Pan map to POI            → Highlight card
                               → Open marker popup         → (already in view)

Hover/long-press POI card      → Pulse marker ring         → Show expanded preview
                               → (no pan)

Filter category chip           → Show/hide markers         → Filter card list
                               → Cluster recompute         → Update result count

Zoom map to cluster            → Expand cluster            → Filter list to visible
                               → Show individual markers   → POIs in viewport

Pan/zoom map                   → (normal behavior)         → "Show POIs in view"
                                                           → button appears
```

### 8.8 Fuel Gauge Component

The HUD includes a persistent fuel-gap severity indicator:

```
┌──────────────────────────────────────────────────────────────┐
│  ⛽ FUEL STATUS                                              │
│                                                              │
│  Route: Bangalore → Goa (560 km)                            │
│                                                              │
│  ████████░░░░████████████░░░░░░░░░██████████████████████     │
│  0 km    80km   120km          280km                 560km   │
│           ▲                     ▲                            │
│     ⚠️ 40km gap            🔴 160km gap                      │
│                                                              │
│  Alerts:                                                     │
│  🔴 CRITICAL: 160 km gap between Hubli (280 km) and         │
│     Panaji (440 km). Fill up at HPCL Hubli.                  │
│  ⚠️ WARNING: 40 km gap between Chitradurga (80 km) and      │
│     Davangere (120 km).                                      │
│                                                              │
│  Tank Range: 250 km │ Fuel Stops: 6 │ Next Fuel: 23 km      │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. Phased Implementation Roadmap

### Phase 1 — MVP (Weeks 1–6)

**Goal:** Core route planning with corridor POI discovery. Ship a usable product.

| Week  | Deliverable                                      | Key Files                                              |
|-------|--------------------------------------------------|-------------------------------------------------------|
| 1–2   | **Project scaffold & map**                       |                                                       |
|       | • Vite + React + TypeScript setup                | `vite.config.ts`, `tsconfig.json`                     |
|       | • Leaflet map integration                        | `MapContainer.tsx`, `TileLayerSwitcher.tsx`            |
|       | • Dark HUD theme & design tokens                 | `theme.ts`, `globals.css`                             |
|       | • Basic responsive layout (mobile + desktop)     | `HUDShell.tsx`, `App.tsx`                             |
| 3     | **Search & routing**                             |                                                       |
|       | • Photon geocoder integration                    | `photon.api.ts`, `useGeocodeSearch.ts`                |
|       | • OSRM route computation                         | `osrm.api.ts`, `useRouteComputation.ts`               |
|       | • Polyline6 decoding (Web Worker)                | `polylineDecode.ts`, `geo.worker.ts`                  |
|       | • RDP simplification (Web Worker)                | `rdpSimplify.ts`                                      |
|       | • Route polyline rendering on map                | `RoutePolyline.tsx`                                   |
| 4     | **Corridor POI discovery**                       |                                                       |
|       | • Overpass API client with single mirror         | `overpass.api.ts`                                     |
|       | • Cross-track distance filtering (Worker)        | `crossTrackDistance.ts`                                |
|       | • Chainage projection (Worker)                   | `chainageProjection.ts`                                |
|       | • OSM tag → category mapping                     | `osmTagParser.ts`                                     |
|       | • POI markers on map                             | `POIMarker.tsx`, `POICluster.tsx`                     |
| 5     | **POI list & drawer**                            |                                                       |
|       | • Bottom drawer with 3 snap points               | `BottomDrawer.tsx`                                    |
|       | • Virtualized POI card list                      | `POIList.tsx`, `POICard.tsx`                          |
|       | • Category filter chips                          | `CategoryFilter.tsx`                                  |
|       | • Map ↔ list synchronization                     | `useMapSync.ts`                                       |
| 6     | **Testing, polish & MVP ship**                   |                                                       |
|       | • Zustand store wiring                           | `routeSlice.ts`, `poiSlice.ts`, `uiSlice.ts`         |
|       | • Unit tests for geospatial functions             | `__tests__/geospatial/`                               |
|       | • Integration tests for API layer                | `__tests__/api/`                                      |
|       | • Lighthouse audit (PWA, perf, a11y)             |                                                       |
|       | • Deploy to Vercel/Netlify                       |                                                       |

**MVP Exit Criteria:**
- [x] User can search origin + destination and see route on map.
- [x] POIs are discovered and displayed along the corridor.
- [x] POIs can be filtered by category.
- [x] Map and list are synchronized on tap.
- [x] Lighthouse PWA score ≥ 90.
- [x] Core Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1.

---

### Phase 1.1 — Resilience & Intelligence (Weeks 7–10)

**Goal:** Offline capability, fuel-gap analysis, and API resilience.

| Week  | Deliverable                                      | Key Files                                              |
|-------|--------------------------------------------------|-------------------------------------------------------|
| 7     | **Offline foundation**                           |                                                       |
|       | • Service Worker with Workbox strategies          | `sw.ts`, `strategies.ts`                              |
|       | • IndexedDB schema & migration framework          | `idb.schema.ts`, `idb.ts`                             |
|       | • Route & POI caching to IndexedDB                | `routeCache.ts`, `poiCache.ts`                        |
|       | • Tile caching (stale-while-revalidate)            | `tileCache.ts`                                        |
|       | • Offline detection & UI banner                    | `offlineDetector.ts`, `OfflineBanner.tsx`              |
| 8     | **API resilience**                               |                                                       |
|       | • 3-mirror Overpass failover rotation              | `overpass.mirrors.ts`                                 |
|       | • Circuit breaker state machine                    | `api/client.ts`                                       |
|       | • Exponential backoff with jitter                  | `api/client.ts`                                       |
|       | • Bbox chunking for 300+ km routes                 | `bboxUtils.ts`, `overpass.api.ts`                     |
|       | • TTL invalidation sweep                           | `ttlInvalidator.ts`                                   |
| 9     | **Fuel-gap analysis**                            |                                                       |
|       | • 30m spatial deduplication (Worker)               | `poiDedup.ts`                                         |
|       | • Fuel-gap dead-zone analyzer                      | `fuelGapAnalyzer.ts`                                  |
|       | • FuelGauge HUD component                          | `FuelGauge.tsx`                                       |
|       | • Fuel-gap overlays on map                         | `FuelGapOverlay.tsx`                                  |
|       | • Rider-configurable tank range                    | `rider_prefs` in IDB                                  |
| 10    | **Background sync & testing**                    |                                                       |
|       | • Background sync queue                            | `syncQueue.ts`                                        |
|       | • Offline cache manifest tracking                  | `offline_manifest` store                               |
|       | • Comprehensive offline scenario tests             |                                                       |
|       | • Worker pool stress tests (simulated 15K points)  |                                                       |
|       | • Deploy v1.1                                      |                                                       |

**v1.1 Exit Criteria:**
- [x] App works fully offline with previously cached routes.
- [x] Overpass mirrors failover transparently — zero user-visible errors.
- [x] Fuel gaps are detected and displayed with severity levels.
- [x] 300+ km routes load successfully via bbox chunking.
- [x] Cache TTL invalidation runs without blocking main thread.

---

### Phase 2.0 — Live Ride & Advanced Features (Weeks 11–16)

**Goal:** Real-time rider tracking, live ETA, and power-user features.

| Week  | Deliverable                                      | Key Files                                              |
|-------|--------------------------------------------------|-------------------------------------------------------|
| 11    | **GPS tracking & rider telemetry**               |                                                       |
|       | • Geolocation API watchPosition integration        | `useRiderPosition.ts`                                 |
|       | • Kalman filter GPS smoothing (Worker)             | `kalmanFilter.ts`                                     |
|       | • Rider position marker with heading               | `RiderPositionMarker.tsx`                              |
|       | • Speed/heading/ETA telemetry bar                  | `RiderTelemetryBar.tsx`                                |
|       | • On-route / off-route detection                   | `rider.service.ts`                                    |
| 12    | **Live corridor updates**                        |                                                       |
|       | • Progressive POI loading as rider advances        | `corridor.service.ts`                                 |
|       | • Dynamic "next fuel" counter                      | `FuelGauge.tsx` update                                |
|       | • Corridor re-computation on route deviation       | `useRouteComputation.ts`                              |
|       | • POI ETA updates based on live speed              | `poiSlice.ts`                                         |
| 13    | **Alternative routes & comparison**              |                                                       |
|       | • OSRM alternative route display (up to 3)         | `RouteAltPicker.tsx`                                  |
|       | • Route comparison (distance, duration, fuel gaps)  | `RouteSelector.tsx`                                   |
|       | • Corridor overlay toggle per alternative           | `CorridorOverlay.tsx`                                 |
| 14    | **Saved routes & ride history**                  |                                                       |
|       | • Save/favorite routes to IndexedDB                | `rider_prefs` store                                   |
|       | • Ride history with date/distance log               | New `ride_history` store                               |
|       | • Pre-cache tiles for saved routes                  | `tileCache.ts`                                        |
|       | • Share route via URL (encoded params)              | URL serialization util                                 |
| 15    | **Emergency & utility features**                 |                                                       |
|       | • Emergency panel (nearest hospital, police)        | `EmergencyPanel.tsx`                                  |
|       | • One-tap call for nearest repair shop              | `POICard.tsx` action                                  |
|       | • Weather overlay integration (OpenMeteo API)       | New weather module                                     |
|       | • Elevation profile for route                       | New elevation component                                |
| 16    | **Performance, a11y & launch**                   |                                                       |
|       | • Bundle analysis & code splitting                  | Dynamic imports                                        |
|       | • WCAG 2.1 AA compliance audit                     |                                                       |
|       | • End-to-end test suite (Playwright)                |                                                       |
|       | • Performance profiling (60 fps scroll, < 3s LCP)   |                                                       |
|       | • Production deployment with monitoring              |                                                       |

**v2.0 Exit Criteria:**
- [x] Live GPS tracking with Kalman-filtered position on map.
- [x] Real-time ETA to next fuel / food / rest stops.
- [x] Route deviation triggers automatic re-routing.
- [x] Up to 3 alternative routes with comparison view.
- [x] Saved routes load instantly from IndexedDB.
- [x] Emergency panel surfaces nearest critical services.
- [x] Lighthouse: Performance ≥ 95, Accessibility ≥ 95, PWA ≥ 100.
- [x] Bundle size: < 200 KB initial JS (gzipped).
- [x] Works on Android Chrome, iOS Safari, Desktop Chrome/Firefox.

---

## Appendix A — Technology Stack Summary

| Layer             | Technology                        | Version  | Rationale                              |
|------------------|-----------------------------------|----------|----------------------------------------|
| Framework        | React                             | 18+      | Component model, ecosystem             |
| Build            | Vite                              | 5+       | Fast HMR, ESM-native                   |
| Language         | TypeScript                        | 5.3+     | Type safety, IDE support               |
| State            | Zustand                           | 4+       | Lightweight, no boilerplate            |
| Map              | Leaflet + React-Leaflet           | 1.9 / 4+ | Mature, plugin-rich, offline-capable   |
| Map (future)     | MapLibre GL JS                    | 3+       | Vector tiles, 3D, better perf          |
| Styling          | CSS Modules + CSS Custom Props    | —        | Scoped, theme-able, no runtime cost    |
| Persistence      | IndexedDB (via idb)               | 8+       | Large storage, structured data         |
| Service Worker   | Workbox                           | 7+       | Battle-tested SW tooling               |
| Testing          | Vitest + React Testing Library    | —        | Vite-native, fast                      |
| E2E Testing      | Playwright                        | —        | Cross-browser, mobile emulation        |
| Linting          | ESLint + Prettier                 | —        | Code consistency                       |
| Deployment       | Vercel / Netlify                  | —        | Edge CDN, preview deploys              |

## Appendix B — External API Reference

| API            | Base URL                                          | Auth     | Rate Limit           | CORS   |
|---------------|---------------------------------------------------|----------|----------------------|--------|
| Photon         | `https://photon.komoot.io/api/`                   | None     | Fair use             | Yes    |
| Nominatim      | `https://nominatim.openstreetmap.org/`            | None     | 1 req/sec            | Yes    |
| OSRM           | `https://router.project-osrm.org/route/v1/`      | None     | Fair use             | Yes    |
| Overpass #1    | `https://overpass-api.de/api/interpreter`         | None     | 2 req/10s            | Yes    |
| Overpass #2    | `https://overpass.kumi.systems/api/interpreter`   | None     | 5 req/min            | Yes    |
| Overpass #3    | `https://maps.mail.ru/osm/tools/overpass/api/interpreter` | None | 3 req/10s      | Varies |
| OSM Tiles      | `https://tile.openstreetmap.org/{z}/{x}/{y}.png`  | None     | Fair use (< 2 req/s) | Yes    |

---

*This document is the single source of truth for PitStop's technical architecture. All implementation decisions should reference and comply with the specifications herein.*
