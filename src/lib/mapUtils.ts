const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Shared Utils for Google Maps Platform

/**
 * Common color generator for markers based on strings (IDs)
 */
export const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 50%)`;
};

/**
 * Calculate distance between two points in meters (Haversine formula)
 */
export const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
};

// --- Google Maps Platform API Utils ---

export const getGoogleDistanceMatrix = async (origin: { lat: number; lng: number }, destinations: { lat: number; lng: number }[]) => {
    if (!GOOGLE_MAPS_API_KEY) {
        console.warn('Google Maps API Key not found');
        return null;
    }

    const originsStr = `${origin.lat},${origin.lng}`;
    const destinationsStr = destinations.map(d => `${d.lat},${d.lng}`).join('|');

    try {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsStr}&destinations=${destinationsStr}&key=${GOOGLE_MAPS_API_KEY}&mode=driving`
        );
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching Distance Matrix:', error);
        return null;
    }
};

export const getGoogleRoute = async (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }, waypoints: { lat: number; lng: number }[] = []) => {
    if (!GOOGLE_MAPS_API_KEY) return null;

    const originStr = `${origin.lat},${origin.lng}`;
    const destStr = `${destination.lat},${destination.lng}`;
    const waypointsStr = waypoints.map(w => `${w.lat},${w.lng}`).join('|');

    try {
        const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
        url.searchParams.append('origin', originStr);
        url.searchParams.append('destination', destStr);
        if (waypoints.length > 0) url.searchParams.append('waypoints', `optimize:true|${waypointsStr}`);
        url.searchParams.append('key', GOOGLE_MAPS_API_KEY);

        const response = await fetch(url.toString());
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching Directions:', error);
        return null;
    }
};

/**
 * Checks if a location is within a certain distance (geofence)
 * @param currentLocation User's current location
 * @param targetLocation Target customer location
 * @param radiusInMeters Fence radius (default 100m)
 */
export const isWithinGeofence = (
    currentLocation: { lat: number; lng: number },
    targetLocation: { lat: number; lng: number },
    radiusInMeters: number = 100
): boolean => {
    const distance = getDistance(
        currentLocation.lat,
        currentLocation.lng,
        targetLocation.lat,
        targetLocation.lng
    );
    return distance <= radiusInMeters;
};
