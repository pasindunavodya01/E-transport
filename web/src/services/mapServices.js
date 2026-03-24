import axios from 'axios';

// Call Nominatim API for OpenStreetMap
export const geocodeAddress = async (query) => {
  if (!query) return null;
  try {
    const { data } = await axios.get(`https://nominatim.openstreetmap.org/search`, {
      params: { q: query, format: 'json', limit: 1 },
      headers: { 'Accept-Language': 'en' }
    });
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        address: query // Keep original user query or use data[0].display_name
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
};

// Call OSRM API for Driving Routes returning GeoJSON format
export const fetchRoutePolyline = async (startCoords, endCoords, viaCoords = null) => {
  if (!startCoords || !endCoords) return null;
  try {
    let url = `https://router.project-osrm.org/route/v1/driving/${startCoords.lng},${startCoords.lat};`;
    if (viaCoords) {
      if (Array.isArray(viaCoords)) {
        viaCoords.forEach(c => { url += `${c.lng},${c.lat};`; });
      } else {
        url += `${viaCoords.lng},${viaCoords.lat};`;
      }
    }
    url += `${endCoords.lng},${endCoords.lat}?overview=full&geometries=geojson`;

    const { data } = await axios.get(url);
    if (data.routes && data.routes.length > 0) {
      // OSRM returns GeoJSON coordinates as [Longitude, Latitude]
      // Leaflet and React Native Maps expect [Latitude, Longitude]
      const rawCoords = data.routes[0].geometry.coordinates;
      return rawCoords.map(coord => ({ lat: coord[1], lng: coord[0] }));
    }
  } catch (error) {
    console.error('OSRM route error:', error);
  }
  return null;
};

// Call OSRM API for Alternative Driving Routes
export const fetchRouteAlternatives = async (startCoords, endCoords, viaCoords = null) => {
  if (!startCoords || !endCoords) return [];
  try {
    let url = `https://router.project-osrm.org/route/v1/driving/${startCoords.lng},${startCoords.lat};`;
    if (viaCoords) {
      if (Array.isArray(viaCoords)) {
        viaCoords.forEach(c => { url += `${c.lng},${c.lat};`; });
      } else {
        url += `${viaCoords.lng},${viaCoords.lat};`;
      }
    }
    url += `${endCoords.lng},${endCoords.lat}?overview=full&geometries=geojson&alternatives=true`;

    const { data } = await axios.get(url);
    if (data.routes && data.routes.length > 0) {
      return data.routes.map((r, i) => {
        const rawCoords = r.geometry.coordinates;
        return {
          id: i,
          distance: r.distance, // in meters
          duration: r.duration, // in seconds
          polyline: JSON.stringify(rawCoords.map(coord => ({ lat: coord[1], lng: coord[0] })))
        };
      });
    }
  } catch (error) {
    console.error('OSRM route alternatives error:', error);
  }
  return [];
};
