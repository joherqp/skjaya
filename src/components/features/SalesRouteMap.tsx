import { useState, useMemo, useEffect } from 'react';
import {
    Map,
    Marker,
    useMapsLibrary,
    useMap
} from '@vis.gl/react-google-maps';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pelanggan } from '@/lib/types';
import { MapPin, Navigation, Clock, RotateCcw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface SalesRouteMapProps {
    customers: Pelanggan[];
    onRouteCalculated?: (duration: string, distance: string) => void;
}

export function SalesRouteMap({ customers, onRouteCalculated }: SalesRouteMapProps) {
    const map = useMap();
    const routesLib = useMapsLibrary('routes');
    const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
    const [routeInfo, setRouteInfo] = useState<{ duration: string; distance: string } | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);

    // Initialize Directions Renderer
    useEffect(() => {
        if (!routesLib || !map) return;
        const renderer = new google.maps.DirectionsRenderer({
            map,
            suppressMarkers: false,
            polylineOptions: {
                strokeColor: '#3b82f6',
                strokeWeight: 5,
                strokeOpacity: 0.7
            }
        });
        setDirectionsRenderer(renderer);
        return () => renderer.setMap(null);
    }, [routesLib, map]);

    const optimizeRoute = async () => {
        if (!routesLib || !directionsRenderer || customers.length < 2) {
            toast.error('Pilih minimal 2 pelanggan untuk mengoptimalkan rute.');
            return;
        }

        setIsOptimizing(true);
        const service = new google.maps.DirectionsService();

        // Take first customer as start, last as end, others as waypoints
        // Or better: use current location as start if available
        const origin = { lat: customers[0].lokasi!.latitude, lng: customers[0].lokasi!.longitude };
        const destination = { lat: customers[customers.length - 1].lokasi!.latitude, lng: customers[customers.length - 1].lokasi!.longitude };

        const waypoints = customers.slice(1, -1).map(c => ({
            location: new google.maps.LatLng(c.lokasi!.latitude, c.lokasi!.longitude),
            stopover: true
        }));

        try {
            const result = await service.route({
                origin,
                destination,
                waypoints,
                travelMode: google.maps.TravelMode.DRIVING,
                optimizeWaypoints: true,
            });

            directionsRenderer.setDirections(result);

            const route = result.routes[0];
            let totalDistance = 0;
            let totalDuration = 0;

            route.legs.forEach(leg => {
                totalDistance += leg.distance?.value || 0;
                totalDuration += leg.duration?.value || 0;
            });

            const info = {
                distance: (totalDistance / 1000).toFixed(1) + ' km',
                duration: Math.round(totalDuration / 60) + ' mnt'
            };

            setRouteInfo(info);
            onRouteCalculated?.(info.duration, info.distance);
            toast.success('Rute berhasil dioptimalkan!');
        } catch (error) {
            console.error('Directions request failed', error);
            toast.error('Gagal menghitung rute.');
        } finally {
            setIsOptimizing(false);
        }
    };

    const center = useMemo(() => {
        if (customers.length > 0 && customers[0].lokasi) {
            return { lat: customers[0].lokasi.latitude, lng: customers[0].lokasi.longitude };
        }
        return { lat: -6.2, lng: 106.81 }; // Jakarta
    }, [customers]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Navigation className="w-4 h-4 text-primary" />
                        Optimasi Rute Kunjungan
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        {customers.length} Pelanggan dipilih
                    </p>
                </div>
                <Button
                    size="sm"
                    onClick={optimizeRoute}
                    disabled={isOptimizing || customers.length < 2}
                    className="gap-2"
                >
                    {isOptimizing ? 'Menghitung...' : 'Optimalkan Rute'}
                </Button>
            </div>

            {routeInfo && (
                <div className="grid grid-cols-2 gap-3">
                    <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="p-3 flex items-center gap-3">
                            <Clock className="w-4 h-4 text-primary" />
                            <div>
                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Estimasi Waktu</p>
                                <p className="text-sm font-bold">{routeInfo.duration}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="p-3 flex items-center gap-3">
                            <MapPin className="w-4 h-4 text-primary" />
                            <div>
                                <p className="text-[10px] uppercase text-muted-foreground font-bold">Total Jarak</p>
                                <p className="text-sm font-bold">{routeInfo.distance}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="h-[400px] w-full rounded-xl overflow-hidden border relative shadow-inner">
                <Map
                    defaultCenter={center}
                    defaultZoom={12}
                    mapId="bf51a910020faedc"
                    gestureHandling={'greedy'}
                >
                    {/* Markers are handled by DirectionsRenderer once calculated, 
              but we show initial markers before calculation */}
                    {!routeInfo && customers.map((c, i) => (
                        c.lokasi && (
                            <Marker
                                key={c.id}
                                position={{ lat: c.lokasi.latitude, lng: c.lokasi.longitude }}
                                label={(i + 1).toString()}
                            />
                        )
                    ))}
                </Map>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 space-y-2 border">
                <p className="text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-success" />
                    Urutan Kunjungan Optimal:
                </p>
                <div className="flex flex-wrap gap-2">
                    {customers.map((c, i) => (
                        <div key={c.id} className="flex items-center gap-1 bg-background border px-2 py-1 rounded text-[10px] font-medium shadow-sm">
                            <span className="bg-primary text-primary-foreground w-4 h-4 flex items-center justify-center rounded-full text-[8px]">{i + 1}</span>
                            {c.nama}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
