import axios from 'axios';

// Call Nominatim API for OpenStreetMap Geocoding
export const geocodeAddress = async (query) => {
  if (!query || query.trim().length < 3) return null;
  try {
    const { data } = await axios.get(`https://nominatim.openstreetmap.org/search`, {
      params: { q: query, format: 'json', limit: 1 },
      headers: { 'Accept-Language': 'en' }
    });
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        address: query
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
};

// Call OSRM API for Driving Route Polyline
export const fetchRoutePolyline = async (startCoords, endCoords) => {
  if (!startCoords || !endCoords) return null;
  try {
    const { data } = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${startCoords.lng},${startCoords.lat};${endCoords.lng},${endCoords.lat}?overview=full&geometries=geojson`
    );
    if (data.routes && data.routes.length > 0) {
      const rawCoords = data.routes[0].geometry.coordinates;
      // OSRM returns [lng, lat], react-native-maps expects {latitude, longitude}
      return rawCoords.map(coord => ({ latitude: coord[1], longitude: coord[0] }));
    }
  } catch (error) {
    console.error('OSRM route error:', error);
  }
  return null;
};
