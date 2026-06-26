/**
 * Calculates routes from start point to multiple hospitals using OSRM
 * @param {[number, number]} startPoint - [latitude, longitude] of emergency
 * @param {Array} hospitals - Array of hospital objects with position
 * @returns {Promise<Array>} Array of route objects (even if some fail)
 */
import  LRUCache  from 'lru-cache';

const OSRM_BASE_URL = import.meta.env.VITE_OSRM_URL || 'https://router.project-osrm.org';

// Helper function to create empty route objects
function createEmptyRoute() {
  return {
    distance: 0,
    duration: 0,
    geometry: null
  };
}

// Helper function to generate empty routes array matching hospitals length
function generateEmptyRoutes(hospitals) {
  if (!Array.isArray(hospitals)) return [];
  return hospitals.map(() => createEmptyRoute());
}

/**
 * Gets nearby hospitals from Overpass API with enhanced error handling
 */
export async function getNearbyHospitals([lat, lon], radius = 5000) {
  // Validate coordinates
  if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
    console.error('Invalid coordinates:', lat, lon);
    return [];
  }

  // Validate radius
  if (isNaN(radius) || radius <= 0) {
    console.warn('Invalid radius, using default 5000m');
    radius = 5000;
  }

  const overpassQuery = `
    [out:json];
    (
      node[amenity=hospital](around:${radius},${lat},${lon});
      way[amenity=hospital](around:${radius},${lat},${lon});
      relation[amenity=hospital](around:${radius},${lat},${lon});
    );
    out center;
  `;

  try {
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();

    return data.elements?.map(item => {
  const coords = item.center || (item.lat && item.lon ? { 
    lat: item.lat, 
    lon: item.lon 
  } : null);
  
  if (!coords) {
    console.warn('Hospital missing coordinates:', item);
    return null;
  }

  return {
    id: item.id,
    name: item.tags?.name,
    position: [coords.lat, coords.lon],
    // ... other properties
  };
}).filter(Boolean) || []; // Remove null entries
  } catch (error) {
    console.error('Failed to fetch hospitals:', error);
    return [];
  }
}

// Enhanced specialty detection
function getSpecialtyFromTags(tags) {
  if (!tags) return null;
  
  const specialties = {
    emergency: tags.emergency === 'yes' ? 'Emergency' : null,
    trauma: tags.trauma === 'yes' ? 'Trauma Center' : null,
    cardiac: tags.healthcare === 'cardiology' ? 'Cardiac' : null,
    pediatric: tags.healthcare === 'pediatric' ? 'Pediatric' : null,
    burn: tags.healthcare === 'burn' ? 'Burn Center' : null,
    custom: tags.healthcare_specialty || tags.speciality
  };

  return Object.values(specialties).find(s => s) || null;
}

function filterBySpecialty(hospitals, emergencyType) {
  const specialtyMap = {
    cardiac: ['Cardiac', 'Heart', 'Coronary'],
    trauma: ['Trauma', 'Emergency', 'Accident'],
    stroke: ['Stroke', 'Neurology'],
    respiratory: ['Pulmonary', 'Respiratory'],
    pediatric: ['Pediatric', 'Children']
  };

  if (!emergencyType) return hospitals; // Return all if no type specified

  return hospitals.filter(hospital => {
    const specialties = specialtyMap[emergencyType] || [];
    return specialties.some(s => 
      hospital.specialty?.toLowerCase().includes(s.toLowerCase())
    );
  });
}

// Then export it along with other functions
export {
  filterBySpecialty,
  generateEmptyRoutes, // Add this line
};


// Cache routes for 5 minutes to reduce API calls
const routeCache = new LRUCache({
  max: 100,
  ttl: 300000
});



export async function calculateRoutes(startPoint, hospitals) {
  try {
    // Filter out hospitals without valid positions
    const validHospitals = hospitals.filter(h => 
      h.position && 
      h.position.length === 2 &&
      !isNaN(h.position[0]) && 
      !isNaN(h.position[1])
    );

    if (validHospitals.length === 0) {
      console.warn('No hospitals with valid positions');
      return hospitals.map(() => ({ distance: 0, duration: 0 }));
    }

    const baseUrl = 'https://router.project-osrm.org/route/v1/driving/';
    const coordinates = validHospitals
      .map(h => h.position.join(','))
      .join(';');
    
    const url = `${baseUrl}${startPoint.join(',')};${coordinates}?overview=full`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`OSRM Error: ${response.status}`);
    }

    const data = await response.json();
    
    // Map routes to original hospital array
    return hospitals.map(hospital => {
      const validIndex = validHospitals.findIndex(h => 
        h.id === hospital.id || h.position === hospital.position
      );
      
      if (validIndex === -1 || !data.routes[validIndex]) {
        return { distance: 0, duration: 0, isFallback: true };
      }
      
      return {
        distance: data.routes[validIndex].distance || 0,
        duration: data.routes[validIndex].duration || 0,
        geometry: data.routes[validIndex].geometry
      };
    });

  } catch (error) {
    console.error('Routing error:', error);
    // Return fallback routes
    return hospitals.map(() => ({ 
      distance: 0, 
      duration: 0,
      isFallback: true 
    }));
  }
}

// Haversine distance calculation
function haversineDistance([lat1, lon1], [lat2, lon2]) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

// Duration estimation (meters to minutes)
function estimateDuration(start, end) {
  const distance = haversineDistance(start, end);
  const avgSpeed = 30 * 1000 / 3600; // 30 km/h in m/s
  return (distance / avgSpeed) * 1.3; // 30% buffer
}
// Self-hosted OSRM implementation
async function calculateWithOSRM(startPoint, hospitals, options) {
  const cacheKey = `${startPoint.join(',')}|${hospitals.map(h => h.position.join(',')).join(';')}`;
  
  // Check cache first
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }

  const baseUrl = options.osrmUrl || 'https://router.yourdomain.com/route/v1';
  const coordinates = hospitals.map(h => h.position.join(','));

  const response = await fetch(
    `${baseUrl}/car/${startPoint.join(',')};${coordinates.join(';')}?overview=full&steps=true`,
    {
      signal: AbortSignal.timeout(5000) // Timeout after 5 seconds
    }
  );

  if (!response.ok) {
    throw new Error(`OSRM Error: ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 'Ok') throw new Error(data.message || 'OSRM routing error');

  const result = hospitals.map((hospital, index) => ({
    hospitalId: hospital.id,
    distance: data.routes[index]?.distance ?? 0,
    duration: data.routes[index]?.duration ?? 0,
    geometry: data.routes[index]?.geometry,
    isFallback: false
  }));

  routeCache.set(cacheKey, result);
  return result;
}

// Mapbox Directions API fallback
async function calculateWithMapbox(startPoint, hospitals, options) {
  const accessToken = options.mapboxToken || import.meta.env.VITE_MAPBOX_TOKEN;
  if (!accessToken) throw new Error('Mapbox token not configured');

  const coordinates = [
    startPoint,
    ...hospitals.map(h => h.position)
  ].map(c => c.join(',')).join(';');

  const profile = options.profile || 'driving-traffic';
  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?` +
    `access_token=${accessToken}&geometries=geojson&steps=true`
  );

  if (!response.ok) {
    throw new Error(`Mapbox Error: ${response.status}`);
  }

  const data = await response.json();
  return hospitals.map((hospital, index) => ({
    hospitalId: hospital.id,
    distance: data.routes[index]?.distance ?? 0,
    duration: data.routes[index]?.duration ?? 0,
    geometry: data.routes[index]?.geometry,
    isFallback: false
  }));
}



// Coordinate validation
function validateCoordinates(coords) {
  return Array.isArray(coords) && 
         coords.length === 2 &&
         !isNaN(coords[0]) && 
         !isNaN(coords[1]) &&
         Math.abs(coords[0]) <= 90 &&
         Math.abs(coords[1]) <= 180;
}


/**
 * Enhanced hospital finder with routing integration
 */
export async function findBestHospital(emergencyLocation, emergencyType) {
  // 1. Get nearby hospitals with specialties
  const hospitals = await getNearbyHospitals(emergencyLocation);
  
  // 2. Filter by emergency type capability
  const suitableHospitals = filterBySpecialty(hospitals, emergencyType);
  
  // 3. Calculate routes with production-grade service
  const routes = await calculateRoutes(emergencyLocation, suitableHospitals, {
    profile: emergencyType === 'cardiac' ? 'driving-traffic' : 'driving'
  });

  // 4. Select best hospital considering:
  // - Distance
  // - Duration
  // - Hospital capability
  return suitableHospitals
    .map((hospital, index) => ({
      ...hospital,
      route: routes[index]
    }))
    .sort((a, b) => {
      // Prioritize cardiac centers for heart attacks
      if (emergencyType === 'cardiac' && a.specialty === 'Cardiac') return -1;
      
      // Sort by duration, then distance
      return a.route.duration - b.route.duration || 
             a.route.distance - b.route.distance;
    })[0];
}