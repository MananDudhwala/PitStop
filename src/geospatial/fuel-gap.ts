import { CorridorPOI, FuelGapAlert, RouteCorridor } from '@/types';

/**
 * Analyzes gaps between consecutive fuel stations along the route.
 * Flags any contiguous stretch exceeding the threshold (default: 60 km).
 * Computes gap from route origin -> first fuel pump, between fuel pumps, and last fuel pump -> destination.
 */
export function analyzeFuelGaps(
  fuelPOIs: CorridorPOI[],
  route: RouteCorridor,
  thresholdKm: number = 60
): FuelGapAlert[] {
  const alerts: FuelGapAlert[] = [];
  const totalRouteKm = route.totalDistance / 1000;

  // Filter fuel only and sort by chainage
  const sortedFuel = fuelPOIs
    .filter((poi) => poi.category === 'fuel')
    .sort((a, b) => a.chainageKm - b.chainageKm);

  // If no fuel stations exist along the entire route!
  if (sortedFuel.length === 0) {
    if (totalRouteKm >= thresholdKm) {
      alerts.push({
        id: 'fuel-gap-entire-route',
        startStation: { name: route.origin.name || 'Origin', chainageKm: 0 },
        endStation: { name: route.destination.name || 'Destination', chainageKm: totalRouteKm },
        gapDistanceKm: Math.round(totalRouteKm),
        thresholdKm,
        severity: totalRouteKm > thresholdKm * 1.5 ? 'critical' : 'warning',
      });
    }
    return alerts;
  }

  // 1. Check gap from origin to first fuel station
  const firstStation = sortedFuel[0];
  if (firstStation.chainageKm >= thresholdKm) {
    alerts.push({
      id: `fuel-gap-origin-${firstStation.id}`,
      startStation: { name: route.origin.name || 'Origin', chainageKm: 0 },
      endStation: firstStation,
      gapDistanceKm: Math.round(firstStation.chainageKm),
      thresholdKm,
      severity: firstStation.chainageKm > thresholdKm * 1.5 ? 'critical' : 'warning',
    });
  }

  // 2. Check gaps between consecutive fuel stations
  for (let i = 0; i < sortedFuel.length - 1; i++) {
    const current = sortedFuel[i];
    const next = sortedFuel[i + 1];
    const gap = next.chainageKm - current.chainageKm;

    if (gap >= thresholdKm) {
      alerts.push({
        id: `fuel-gap-${current.id}-${next.id}`,
        startStation: current,
        endStation: next,
        gapDistanceKm: Math.round(gap),
        thresholdKm,
        severity: gap > thresholdKm * 1.5 ? 'critical' : 'warning',
      });
    }
  }

  // 3. Check gap from last fuel station to destination
  const lastStation = sortedFuel[sortedFuel.length - 1];
  const finalStretch = totalRouteKm - lastStation.chainageKm;
  if (finalStretch >= thresholdKm) {
    alerts.push({
      id: `fuel-gap-${lastStation.id}-destination`,
      startStation: lastStation,
      endStation: { name: route.destination.name || 'Destination', chainageKm: totalRouteKm },
      gapDistanceKm: Math.round(finalStretch),
      thresholdKm,
      severity: finalStretch > thresholdKm * 1.5 ? 'critical' : 'warning',
    });
  }

  return alerts;
}
