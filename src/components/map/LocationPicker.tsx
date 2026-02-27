import { useEffect, useState, useRef } from 'react';
import {
  Map,
  Marker,
  useApiIsLoaded,
  useMapsLibrary,
  useMap
} from '@vis.gl/react-google-maps';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin } from 'lucide-react';

interface LocationPickerProps {
  position: { lat: number; lng: number };
  onLocationSelect: (lat: number, lng: number) => void;
  readOnly?: boolean;
}

export function LocationPicker({ position, onLocationSelect, readOnly = false }: LocationPickerProps) {
  const apiIsLoaded = useApiIsLoaded();
  const placesLibrary = useMapsLibrary('places');
  const [searchInput, setSearchInput] = useState('');
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const map = useMap();

  const center = position.lat !== 0 && position.lng !== 0
    ? { lat: position.lat, lng: position.lng }
    : { lat: -6.200000, lng: 106.816666 }; // Default to Jakarta

  // Initialize Autocomplete
  useEffect(() => {
    if (!placesLibrary || !inputRef.current || readOnly) return;

    const options = {
      fields: ['geometry', 'name', 'formatted_address'],
      componentRestrictions: { country: 'id' }
    };

    const ac = new placesLibrary.Autocomplete(inputRef.current, options);
    setAutocomplete(ac);

    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        onLocationSelect(lat, lng);
        setSearchInput(place.formatted_address || place.name || '');
      }
    });

    return () => {
      google.maps.event.clearInstanceListeners(ac);
    };
  }, [placesLibrary, readOnly, onLocationSelect]);

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        onLocationSelect(pos.coords.latitude, pos.coords.longitude);
      });
    }
  };

  if (!apiIsLoaded) {
    return <div className="h-[300px] w-full rounded-md bg-muted animate-pulse flex items-center justify-center">Loading Maps...</div>;
  }

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              placeholder="Cari alamat atau tempat..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pr-10"
            />
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
          </div>
          <Button type="button" variant="secondary" onClick={handleGetCurrentLocation} title="Gunakan Lokasi Saat Ini">
            <MapPin className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="h-[300px] w-full rounded-md overflow-hidden border">
        <Map
          defaultCenter={center}
          defaultZoom={position.lat !== 0 ? 15 : 5}
          center={center}
          mapId="bf51a910020faedc" // Optional: update with your map style ID
          gestureHandling={'greedy'}
          disableDefaultUI={false}
        >
          {position.lat !== 0 && position.lng !== 0 && (
            <Marker
              position={{ lat: position.lat, lng: position.lng }}
              draggable={!readOnly}
              onDragEnd={(e) => {
                if (e.latLng) {
                  onLocationSelect(e.latLng.lat(), e.latLng.lng());
                }
              }}
            />
          )}
        </Map>
      </div>

      {position.lat !== 0 && (
        <p className="text-xs text-muted-foreground italic">
          Koordinat: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
        </p>
      )}
    </div>
  );
}

// Keeping the interface for address extraction if needed by other components, but marking as deprecated
/** @deprecated Use Google Geocoding API instead for better results */
export const extractAddressFromCoordinates = async (lat: number, lng: number) => {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=id`);
    if (!response.ok) throw new Error("Nominatim error");
    const data = await response.json();
    return data.display_name || "";
  } catch (err) {
    console.error(err);
    return "";
  }
}
