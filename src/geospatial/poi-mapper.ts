import { CorridorPOI, GeoPoint, OverpassElement, POICategory } from '@/types';
import { haversineDistance } from './math';

/**
 * Normalizes OpenStreetMap tags into one of the 3 core domain categories:
 * - fuel: amenity=fuel
 * - mechanic: shop=motorcycle_repair, car_repair, tyres, craft=mechanic
 * - rest: amenity=cafe, restaurant, fast_food, toilets, highway=rest_area, tourism=viewpoint
 */
export function mapOverpassToPOI(el: OverpassElement): Partial<CorridorPOI> | null {
  const tags = el.tags || {};
  let lat = el.lat;
  let lng = el.lon;

  // Ways and relations may store coordinate in center
  if ((lat === undefined || lng === undefined) && el.center) {
    lat = el.center.lat;
    lng = el.center.lon;
  }

  if (lat === undefined || lng === undefined) {
    return null;
  }

  const location: GeoPoint = { lat, lng };
  let category: POICategory | null = null;
  let details: any = {};

  // 1. Fuel category
  if (tags.amenity === 'fuel') {
    category = 'fuel';
    const fuelGrades: string[] = [];
    if (tags['fuel:octane_91'] === 'yes' || tags['fuel:petrol'] === 'yes' || tags['fuel:diesel'] === 'yes') {
      if (tags['fuel:petrol'] === 'yes') fuelGrades.push('petrol');
      if (tags['fuel:diesel'] === 'yes') fuelGrades.push('diesel');
      if (tags['fuel:cng'] === 'yes') fuelGrades.push('cng');
      if (tags['fuel:lpg'] === 'yes') fuelGrades.push('lpg');
    }
    details = {
      brand: tags.brand || tags.operator || tags.name,
      fuelGrades,
      is24Hours: tags.opening_hours === '24/7',
      hasAirPressure: tags['service:compressor'] === 'yes' || tags.compressed_air === 'yes',
      hasATM: tags.atm === 'yes',
    };
  }
  // 2. Mechanic category
  else if (
    tags.shop === 'motorcycle_repair' ||
    tags.shop === 'car_repair' ||
    tags.shop === 'tyres' ||
    tags.craft === 'mechanic'
  ) {
    category = 'mechanic';
    const services: string[] = [];
    if (tags.shop === 'tyres' || tags['service:tyres'] === 'yes') services.push('tyres/puncture');
    if (tags['service:vehicle:motorcycle'] === 'yes' || tags.shop === 'motorcycle_repair') {
      services.push('motorcycle_repair');
    }
    if (tags['service:oil_change'] === 'yes') services.push('oil_change');

    details = {
      services: services.length ? services : ['general_repair'],
      vehicleTypes: tags.shop === 'motorcycle_repair' ? ['motorcycle'] : ['motorcycle', 'car'],
      is24Hours: tags.opening_hours === '24/7',
      contactNumber: tags['contact:phone'] || tags.phone,
    };
  }
  // 3. Rest category
  else if (
    tags.amenity === 'cafe' ||
    tags.amenity === 'restaurant' ||
    tags.amenity === 'fast_food' ||
    tags.amenity === 'toilets' ||
    tags.highway === 'rest_area' ||
    tags.tourism === 'viewpoint'
  ) {
    category = 'rest';
    let subtype: any = 'restaurant';
    if (tags.amenity === 'cafe') subtype = 'cafe';
    else if (tags.amenity === 'toilets') subtype = 'toilets';
    else if (tags.highway === 'rest_area') subtype = 'rest_area';
    else if (tags.tourism === 'viewpoint') subtype = 'viewpoint';
    else if (tags.cuisine?.includes('dhaba') || tags.name?.toLowerCase().includes('dhaba')) {
      subtype = 'dhaba';
    }

    details = {
      subtype,
      hasFoodService: ['cafe', 'restaurant', 'fast_food', 'dhaba'].includes(subtype),
      hasWashrooms: tags.toilets === 'yes' || tags.amenity === 'toilets',
      hasParking: tags.parking === 'yes',
      openingHours: tags.opening_hours,
    };
  }

  if (!category) {
    return null;
  }

  const name =
    tags.name ||
    tags.brand ||
    tags.operator ||
    (category === 'fuel'
      ? 'Petrol Pump'
      : category === 'mechanic'
      ? 'Puncture & Repair Shop'
      : 'Highway Rest Stop');

  return {
    osmId: el.id,
    osmType: el.type,
    category,
    name,
    location,
    tags,
    details,
  };
}

/**
 * Deduplicates overlapping node/way POIs within a given radius in meters (default: 30m).
 * Prefers the entry with more metadata tags or verified status.
 */
export function deduplicatePOIs(pois: CorridorPOI[], radiusMeters: number = 30): CorridorPOI[] {
  const result: CorridorPOI[] = [];
  const visited = new Set<string>();

  for (let i = 0; i < pois.length; i++) {
    const current = pois[i];
    if (visited.has(current.id)) continue;

    const cluster = [current];
    visited.add(current.id);

    for (let j = i + 1; j < pois.length; j++) {
      const other = pois[j];
      if (visited.has(other.id)) continue;

      if (current.category === other.category) {
        const dist = haversineDistance(current.location, other.location);
        if (dist <= radiusMeters) {
          cluster.push(other);
          visited.add(other.id);
        }
      }
    }

    // Pick best from cluster: highest number of tags / has real name
    cluster.sort((a, b) => {
      const aTagCount = Object.keys(a.tags).length;
      const bTagCount = Object.keys(b.tags).length;
      return bTagCount - aTagCount;
    });

    result.push(cluster[0]);
  }

  return result;
}
