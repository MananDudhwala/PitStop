import {
  WorkerRequest,
  WorkerResponse,
  GeoPoint,
  OverpassElement,
  CorridorPOI,
  FuelGapAlert,
} from './types';

const EARTH_RADIUS_METERS = 6371008.8;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function haversine(a: GeoPoint, b: GeoPoint): number {
  const phi1 = toRad(a.lat);
  const phi2 = toRad(b.lat);
  const deltaPhi = toRad(b.lat - a.lat);
  const deltaLambda = toRad(b.lng - a.lng);

  const sinDPhi = Math.sin(deltaPhi / 2);
  const sinDLambda = Math.sin(deltaLambda / 2);

  const h =
    sinDPhi * sinDPhi +
    Math.cos(phi1) * Math.cos(phi2) * sinDLambda * sinDLambda;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function crossTrack(point: GeoPoint, a: GeoPoint, b: GeoPoint): number {
  const d13 = haversine(a, point) / EARTH_RADIUS_METERS;
  const phi1 = toRad(a.lat);
  const phi2 = toRad(b.lat);
  const deltaLambda = toRad(b.lng - a.lng);

  const y12 = Math.sin(deltaLambda) * Math.cos(phi2);
  const x12 =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const bearing12 = toDeg(Math.atan2(y12, x12));

  const y13 = Math.sin(toRad(point.lng - a.lng)) * Math.cos(toRad(point.lat));
  const x13 =
    Math.cos(phi1) * Math.sin(toRad(point.lat)) -
    Math.sin(phi1) * Math.cos(toRad(point.lat)) * Math.cos(toRad(point.lng - a.lng));
  const bearing13 = toDeg(Math.atan2(y13, x13));

  const cross = Math.asin(
    Math.sin(d13) * Math.sin(toRad(bearing13 - bearing12))
  );
  return Math.abs(cross * EARTH_RADIUS_METERS);
}

function rdpSimplify(coords: [number, number][], tolerance: number): [number, number][] {
  if (coords.length <= 2) return coords;

  let maxDist = 0;
  let maxIdx = 0;
  const first = coords[0];
  const last = coords[coords.length - 1];

  for (let i = 1; i < coords.length - 1; i++) {
    const [x, y] = coords[i];
    const [x1, y1] = first;
    const [x2, y2] = last;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist =
      dx === 0 && dy === 0
        ? Math.hypot(x - x1, y - y1)
        : Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / Math.hypot(dx, dy);

    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = rdpSimplify(coords.slice(0, maxIdx + 1), tolerance);
    const right = rdpSimplify(coords.slice(maxIdx), tolerance);
    return left.slice(0, -1).concat(right);
  }

  return [first, last];
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;

  try {
    switch (req.type) {
      case 'simplify-polyline': {
        const simplified = rdpSimplify(req.payload.coords, req.payload.tolerance);
        self.postMessage({
          id: req.id,
          type: 'simplify-polyline',
          result: simplified,
        } as WorkerResponse);
        break;
      }

      case 'sample-waypoints': {
        const coords = req.payload.coords;
        const interval = req.payload.intervalMeters;
        const samples: GeoPoint[] = [];

        if (coords.length > 0) {
          samples.push({ lat: coords[0][1], lng: coords[0][0] });
          let acc = 0;

          for (let i = 0; i < coords.length - 1; i++) {
            const p1 = { lat: coords[i][1], lng: coords[i][0] };
            const p2 = { lat: coords[i + 1][1], lng: coords[i + 1][0] };
            acc += haversine(p1, p2);

            if (acc >= interval) {
              samples.push(p2);
              acc = 0;
            }
          }

          const last = coords[coords.length - 1];
          samples.push({ lat: last[1], lng: last[0] });
        }

        self.postMessage({
          id: req.id,
          type: 'sample-waypoints',
          result: samples,
        } as WorkerResponse);
        break;
      }

      case 'filter-corridor-pois': {
        const { pois, routeCoords, bufferMeters } = req.payload;

        // Cumulative distance table
        const segDists: number[] = [0];
        for (let i = 0; i < routeCoords.length - 1; i++) {
          const a = { lat: routeCoords[i][1], lng: routeCoords[i][0] };
          const b = { lat: routeCoords[i + 1][1], lng: routeCoords[i + 1][0] };
          segDists.push(segDists[i] + haversine(a, b));
        }

        const validPOIs: CorridorPOI[] = [];

        for (const el of pois) {
          const lat = el.lat ?? el.center?.lat;
          const lng = el.lon ?? el.center?.lon;
          if (lat === undefined || lng === undefined) continue;

          const point: GeoPoint = { lat, lng };

          // Find nearest segment & compute chainage
          let minDistance = Infinity;
          let bestSeg = 0;
          let bestChainage = 0;

          for (let i = 0; i < routeCoords.length - 1; i++) {
            const a = { lat: routeCoords[i][1], lng: routeCoords[i][0] };
            const b = { lat: routeCoords[i + 1][1], lng: routeCoords[i + 1][0] };

            const dx = b.lng - a.lng;
            const dy = b.lat - a.lat;
            const segLenSq = dx * dx + dy * dy;
            let t = 0;
            if (segLenSq > 0) {
              t = ((point.lng - a.lng) * dx + (point.lat - a.lat) * dy) / segLenSq;
              t = Math.max(0, Math.min(1, t));
            }

            const proj: GeoPoint = { lat: a.lat + t * dy, lng: a.lng + t * dx };
            const dist = haversine(point, proj);

            if (dist < minDistance) {
              minDistance = dist;
              bestSeg = i;
              bestChainage = segDists[i] + haversine(a, proj);
            }
          }

          if (minDistance <= bufferMeters) {
            const tags = el.tags || {};
            let category: any = 'rest';
            if (tags.amenity === 'fuel') category = 'fuel';
            else if (
              tags.shop === 'motorcycle_repair' ||
              tags.shop === 'car_repair' ||
              tags.shop === 'tyres' ||
              tags.craft === 'mechanic'
            ) {
              category = 'mechanic';
            }

            validPOIs.push({
              id: el.id,
              lat,
              lng,
              category,
              name: tags.name || tags.brand || 'Pit Stop',
              details: tags,
              chainageMeters: bestChainage,
              crossTrackMeters: Math.round(minDistance),
            });
          }
        }

        // Sort by chainage
        validPOIs.sort((a, b) => a.chainageMeters - b.chainageMeters);

        self.postMessage({
          id: req.id,
          type: 'filter-corridor-pois',
          result: validPOIs,
        } as WorkerResponse);
        break;
      }

      case 'analyze-fuel-gaps': {
        const { fuelPOIs, totalRouteDistance, thresholdKm } = req.payload;
        const alerts: FuelGapAlert[] = [];
        const thresholdM = thresholdKm * 1000;

        if (fuelPOIs.length === 0) {
          if (totalRouteDistance >= thresholdM) {
            alerts.push({
              startChainageKm: 0,
              endChainageKm: Math.round(totalRouteDistance / 1000),
              gapKm: Math.round(totalRouteDistance / 1000),
              startPOI: null,
              endPOI: null,
            });
          }
        } else {
          // Origin to first station
          if (fuelPOIs[0].chainageMeters >= thresholdM) {
            alerts.push({
              startChainageKm: 0,
              endChainageKm: Math.round(fuelPOIs[0].chainageMeters / 1000),
              gapKm: Math.round(fuelPOIs[0].chainageMeters / 1000),
              startPOI: null,
              endPOI: fuelPOIs[0],
            });
          }

          // Between stations
          for (let i = 0; i < fuelPOIs.length - 1; i++) {
            const gap = fuelPOIs[i + 1].chainageMeters - fuelPOIs[i].chainageMeters;
            if (gap >= thresholdM) {
              alerts.push({
                startChainageKm: Math.round(fuelPOIs[i].chainageMeters / 1000),
                endChainageKm: Math.round(fuelPOIs[i + 1].chainageMeters / 1000),
                gapKm: Math.round(gap / 1000),
                startPOI: fuelPOIs[i],
                endPOI: fuelPOIs[i + 1],
              });
            }
          }

          // Last station to destination
          const finalGap = totalRouteDistance - fuelPOIs[fuelPOIs.length - 1].chainageMeters;
          if (finalGap >= thresholdM) {
            alerts.push({
              startChainageKm: Math.round(fuelPOIs[fuelPOIs.length - 1].chainageMeters / 1000),
              endChainageKm: Math.round(totalRouteDistance / 1000),
              gapKm: Math.round(finalGap / 1000),
              startPOI: fuelPOIs[fuelPOIs.length - 1],
              endPOI: null,
            });
          }
        }

        self.postMessage({
          id: req.id,
          type: 'analyze-fuel-gaps',
          result: alerts,
        } as WorkerResponse);
        break;
      }
    }
  } catch (err: any) {
    self.postMessage({
      id: req.id,
      type: req.type,
      error: err.message || 'Worker computation error',
    } as WorkerResponse);
  }
};
