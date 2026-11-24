# 🏍️ PitStop — Ride Route & Corridor POI Navigator (India Edition)

> **Mobile-first, offline-resilient Progressive Web App (PWA) built for motorcyclists and long-distance touring in India. Powered by MapmyIndia (Mappls).**

PitStop computes optimal road routes between an origin and destination and discovers all **petrol pumps (IOCL, BPCL, HPCL, Shell, Jio-bp)**, **puncture & tyre repair shops (24/7 tubeless repair, vulcanizing)**, and **rest stops (Murthal/Amritsari dhabas, food plazas, washrooms, viewpoints)** within a configurable corridor buffer (2 km, 5 km, 10 km) along the highway, strictly ordered by cumulative road chainage from the start.

---

## ⚡ Core Architecture & Capabilities

- **🇮🇳 Powered by MapmyIndia (Mappls)**: Custom-engineered for Indian highways, expressways, bypasses, and mountain passes using Mappls Atlas search, direction routing, and category codes (`PETPMP`, `AUTREP`, `RESTRT`, `TOILET`).
- **Offline & Edge Resilience**: Service Worker with Workbox + IndexedDB (`idb`) caching active polylines, corridor POIs, and map tiles so riders maintain pit-stop visibility in zero-connectivity highway and mountain zones.
- **Geospatial Pipeline**: Ramer-Douglas-Peucker (RDP) polyline simplification, route corridor sampling (5–10 km intervals), exact point-to-segment cross-track distance filtering (2km, 5km, 10km reach), and cumulative chainage projection.
- **Fuel-Gap / Dead-Zone Telemetry**: Continuous scanner flagging any contiguous stretch between consecutive fuel pumps exceeding 60 km with high-visibility tactical warning banners.
- **Tactical Rider HUD**: Dark-mode-first high-contrast palette (`#0B0F17` surface, high-luminance amber/cyan/emerald markers) with 48px+ touch targets designed for roadside and glove-friendly operation.
- **1-Tap Waypoint Handoff**: Quick handoff to **MapmyIndia (Mappls)**, Google Maps, Apple Maps, and Geo URIs.

---

## 📚 Technical Documentation

For the comprehensive technical architecture specification, see:
👉 **[`docs/ARCHITECTURE.md`](file:///Users/manandudhwala/Desktop/personal/PitStop-1/docs/ARCHITECTURE.md)**

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript (strict mode), Vite 6, PWA Plugin
- **Geospatial & Search Engine**: MapmyIndia (Mappls Atlas API, Direction Engine, Category Code Taxonomy)
- **State Management**: Zustand 5 (UI, HUD, Rider telemetry, Map), TanStack Query 5 (geocoding, routing, POI caching)
- **Mapping**: MapLibre GL JS, Great-Circle & Haversine Math, RDP Polyline Simplification
- **Persistence**: IndexedDB (`idb` v8), Service Worker (Workbox v7)

---

## 🚀 Getting Started

```bash
# 1. Start local development server
npm run dev
# or: pnpm dev / yarn dev

# 2. Production build
npm run build
```
