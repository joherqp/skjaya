import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const TRACKING_INTERVAL = 3600000; // 1 hour

export function LocationTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const trackLocation = () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            try {
              await supabase.from('user_locations').insert({
                user_id: user.id,
                latitude,
                longitude,
                timestamp: new Date().toISOString()
              });
            } catch (error) {
              console.error('Error tracking location:', error);
            }
          },
          (error) => {
            console.error('Error getting location:', error);
          }
        );
      }
    };

    // Initial track
    trackLocation();

    // Set interval (1 hour)
    const intervalId = setInterval(trackLocation, TRACKING_INTERVAL);

    return () => clearInterval(intervalId);
  }, [user]);

  return null; // Logic-only component
}
