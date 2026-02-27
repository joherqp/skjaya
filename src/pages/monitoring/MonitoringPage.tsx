import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { MapPin, MessageCircle, Clock, User, Activity, Users, ShoppingCart, Crosshair, Wallet, LogIn, LogOut, Map as MapIcon, Package, Store, PlusCircle, Home, TrendingUp, Coins, Target, CheckCircle, CheckCircle2, ListFilter, Building, Navigation, RotateCcw } from 'lucide-react';
import { formatTanggal, formatWaktu, formatRupiah } from '@/lib/utils';
import { differenceInMinutes } from 'date-fns';
import { AIChat } from '@/components/features/AIChat';
import { SalesRouteMap } from '@/components/features/SalesRouteMap';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRange } from "react-day-picker";
import { addDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { Absensi, Pelanggan, Penjualan, User as UserType } from '@/lib/types';

// Google Maps
import { Map as GMap, AdvancedMarker, InfoWindow, useMap, Pin } from '@vis.gl/react-google-maps';
import { stringToColor, getDistance } from '@/lib/mapUtils';
import { MapMode, MapMarker, UserLocation, DynamicActivityData, ActivityItem } from './types';

// Custom Icons constants
const ICONS = {
    team: '#3b82f6', // blue
    customer: '#10b981', // green
    transaction: '#ef4444', // red
    active: '#f59e0b' // gold
};


import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Info, Filter, ChevronDown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";



export default function Monitoring() {
    const { user } = useAuth();
    const currentUser = user;
    const {
        users, absensi, cabang: listCabang, pelanggan: listPelanggan, penjualan, setoran, mutasiBarang, karyawan: listKaryawan,
        viewMode
    } = useDatabase();

    const [mapMode, setMapMode] = useState<MapMode>('team');
    const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
    const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: -6.2088, lng: 106.8456 });
    const [selectedCabang, setSelectedCabang] = useState<string>('all');
    const [selectedUser, setSelectedUser] = useState<string>('all');
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date()
    });

    // Infinite Scroll States
    const [historyLimit, setHistoryLimit] = useState(10);
    const [sessionLimit, setSessionLimit] = useState(10);

    // Tab State Management
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'explore';

    const handleTabChange = (value: string) => {
        setSearchParams(prev => {
            prev.set('tab', value);
            return prev;
        });
    };

    // --- ROUTE OPTIMIZATION STATE ---
    const [selectedRouteCustomers, setSelectedRouteCustomers] = useState<Pelanggan[]>([]);
    const toggleCustomerForRoute = (p: Pelanggan) => {
        setSelectedRouteCustomers(prev =>
            prev.find(c => c.id === p.id)
                ? prev.filter(c => c.id !== p.id)
                : [...prev, p]
        );
    };

    // --- SESSION LOGIN TAB LOGIC ---
    const [sessionLocations, setSessionLocations] = useState<UserLocation[]>([]);
    const [selectedSessionUsers, setSelectedSessionUsers] = useState<string[]>([]); // Changed to array for multi-select

    // Helper to filter items based on viewMode
    const filterByViewMode = useCallback(<T extends { userId?: string; salesId?: string; createdBy?: string; id: string }>(items: T[]) => {
        if (viewMode === 'me') {
            return items.filter(item =>
                (item.userId && item.userId === user?.id) ||
                (item.salesId && item.salesId === user?.id) ||
                (item.createdBy && item.createdBy === user?.id) ||
                (item.id === user?.id) // For user-specific items like activeUsers
            );
        }
        return items;
    }, [viewMode, user]);

    // Calculate Team Markers
    const teamMarkers = useMemo(() => {
        if (!dateRange?.from) return [];

        const start = startOfDay(dateRange.from);
        const end = endOfDay(dateRange.to || dateRange.from);

        const filteredAbsensi = absensi.filter(a => {
            const d = new Date(a.tanggal);
            return d >= start && d <= end;
        });

        const userLatestAbsensi = new Map<string, Absensi>();
        filterByViewMode<Absensi>(filteredAbsensi).forEach(a => { // Apply viewMode filter here
            if (a.lokasiCheckIn?.latitude && a.lokasiCheckIn?.longitude) {
                const existing = userLatestAbsensi.get(a.userId);
                if (!existing || new Date(a.checkIn || a.tanggal) > new Date(existing.checkIn || existing.tanggal)) {
                    userLatestAbsensi.set(a.userId, a);
                }
            }
        });

        return Array.from(userLatestAbsensi.values()).map(record => {
            const u = users.find(u => u.id === record.userId);
            if (!u) return null;
            if (selectedCabang !== 'all' && u.cabangId !== selectedCabang) return null;
            if (selectedUser !== 'all' && u.id !== selectedUser) return null;

            return {
                id: record.id,
                position: { lat: record.lokasiCheckIn!.latitude, lng: record.lokasiCheckIn!.longitude },
                title: u.nama,
                subtitle: `Check-in: ${formatWaktu(new Date(record.checkIn || record.tanggal))}`,
                type: 'team',
                detail: u.roles.join(', '),
                color: stringToColor(u.id),
                data: { ...u, absensi: record },
                userName: u.nama
            };
        }).filter(Boolean) as MapMarker[];
    }, [dateRange, absensi, users, filterByViewMode, selectedCabang, selectedUser]);

    // Calculate Customer Markers
    const customerMarkers = useMemo(() => {
        if (!dateRange?.from) return [];

        const start = startOfDay(dateRange.from);
        const end = endOfDay(dateRange.to || dateRange.from);

        return filterByViewMode<Pelanggan>(listPelanggan).filter(p => { // Apply viewMode filter here
            const created = new Date(p.createdAt);
            const updated = new Date(p.updatedAt);
            const inRange = (created >= start && created <= end) || (updated >= start && updated <= end);

            if (selectedCabang !== 'all' && p.cabangId !== selectedCabang) return false;
            if (selectedUser !== 'all' && p.salesId !== selectedUser) return false;

            return inRange && p.lokasi?.latitude && p.lokasi?.longitude;
        }).map(p => {
            const sales = users.find(u => u.id === p.salesId);
            return {
                id: p.id,
                position: { lat: p.lokasi!.latitude, lng: p.lokasi!.longitude },
                title: p.nama,
                subtitle: p.telepon,
                type: 'customer',
                detail: `${p.alamat} (Sales: ${sales?.nama || '-'})`,
                color: sales ? stringToColor(sales.id) : undefined,
                data: p,
                userName: sales?.nama
            };
        }) as MapMarker[];
    }, [dateRange, listPelanggan, users, filterByViewMode, selectedCabang, selectedUser]);

    // Calculate Transaction Markers
    const transactionMarkers = useMemo(() => {
        if (!dateRange?.from) return [];

        const start = startOfDay(dateRange.from);
        const end = endOfDay(dateRange.to || dateRange.from);

        return filterByViewMode<Penjualan>(penjualan).filter(p => { // Apply viewMode filter here
            const d = new Date(p.tanggal);
            if (selectedCabang !== 'all') {
                const saleUser = users.find(u => u.id === p.salesId);
                if (saleUser?.cabangId !== selectedCabang) return false;
            }
            if (selectedUser !== 'all' && p.salesId !== selectedUser) return false;
            return d >= start && d <= end && p.lokasi?.latitude && p.lokasi?.longitude;
        }).map(p => {
            const cust = listPelanggan.find(c => c.id === p.pelangganId);
            const sales = users.find(u => u.id === p.salesId);

            return {
                id: p.id,
                position: { lat: p.lokasi!.latitude, lng: p.lokasi!.longitude },
                title: cust?.nama || 'Umum',
                subtitle: `${sales?.nama || '-'} • ${formatRupiah(p.total)}`,
                type: 'transaction',
                detail: `Nota: ${p.nomorNota}`,
                color: sales ? stringToColor(sales.id) : undefined,
                data: p,
                userName: sales?.nama
            };
        }) as MapMarker[];
    }, [dateRange, penjualan, listPelanggan, users, filterByViewMode, selectedCabang, selectedUser]);

    // Combine Markers based on Map Mode and View Mode
    const markers = useMemo(() => {
        let result: MapMarker[] = [];

        if (mapMode === 'team') result = teamMarkers;
        if (mapMode === 'pelanggan') result = customerMarkers;
        if (mapMode === 'transaksi') result = transactionMarkers;

        return result;
    }, [mapMode, teamMarkers, customerMarkers, transactionMarkers]);

    // Sync Map Center when markers change or mode changes
    useEffect(() => {
        if (markers.length > 0) {
            setMapCenter(markers[0].position);
        }
    }, [markers]);

    // Reset selectedUser when selectedCabang changes
    useEffect(() => {
        setSelectedUser('all');
    }, [selectedCabang]);
    // --- EXISTING LOGIC FOR OTHER TABS ---
    // Get today's check-ins
    const today = new Date();
    const todayStr = today.toDateString();
    const todayAbsensi = absensi.filter(a => new Date(a.tanggal).toDateString() === todayStr);

    // Filter Users based on Role and ViewMode
    const activeUsers = useMemo(() => {
        const filteredUsers = users.filter(u => {
            // 1. Must be active
            if (!u.isActive) return false;
            // 2. Must be relevant roles (Keep Sales & Leader for monitoring)
            if (!(u.roles.includes('sales') || u.roles.includes('leader'))) return false;

            // 3. Permission Check
            // If Admin/Owner/Finance -> See All
            if (user?.roles.includes('admin') || user?.roles.includes('owner') || user?.roles.includes('finance')) {
                return true;
            }
            // If Leader -> See only their branch
            if (user?.roles.includes('leader')) {
                return u.cabangId === user.cabangId;
            }
            // If Sales -> See ONLY themselves
            return u.id === user?.id;
        });

        // Apply viewMode filter
        return filterByViewMode(filteredUsers);
    }, [users, filterByViewMode, user]);



    // Fetch User Locations for Session Tab
    useEffect(() => {
        const fetchLocations = async () => {
            if (!user) return;
            // Only Admin/Owner can see all sessions, others only their own
            if (!user.roles.some(r => (['admin', 'owner'] as string[]).includes(r)) && viewMode !== 'me') return;

            let query = supabase
                .from('user_locations')
                .select(`
                  id,
                  latitude,
                  longitude,
                  timestamp,
                  users ( id, nama, roles, cabang_id )
              `)
                .order('timestamp', { ascending: false });

            // Filter Date (Same as global dateRange)
            if (dateRange?.from) {
                const start = startOfDay(dateRange.from).toISOString();
                const end = endOfDay(dateRange.to || dateRange.from).toISOString();
                query = query.gte('timestamp', start).lte('timestamp', end);
            }

            // Apply viewMode filter for session locations
            if (viewMode === 'me') {
                query = query.eq('user_id', user.id);
            } else if (selectedSessionUsers.length > 0) {
                query = query.in('user_id', selectedSessionUsers);
            }

            const { data, error } = await query;
            if (!error && data) {
                // Normalize data structure handling potential array return for joined relation
                // We define the shape of the returning data manually to avoid 'any'
                type LocationResult = {
                    id: string;
                    latitude: number;
                    longitude: number;
                    timestamp: string;
                    users: { id: string; nama: string; roles: string[]; cabang_id: string } | { id: string; nama: string; roles: string[]; cabang_id: string }[];
                };

                const formattedData = (data as unknown as LocationResult[]).map((d) => ({
                    id: d.id,
                    latitude: d.latitude,
                    longitude: d.longitude,
                    timestamp: d.timestamp,
                    users: Array.isArray(d.users) ? d.users[0] : d.users as { id: string; nama: string; roles: string[]; cabang_id: string }
                }));
                setSessionLocations(formattedData);
            }
        };

        fetchLocations();
    }, [dateRange, selectedSessionUsers, user, viewMode]); // Re-fetch on filters change

    const sessionMarkers = useMemo(() => {
        return sessionLocations.map(loc => ({
            id: loc.id,
            position: { lat: loc.latitude, lng: loc.longitude },
            title: loc.users?.nama || 'Unknown',
            subtitle: formatWaktu(new Date(loc.timestamp)),
            type: 'active',
            color: loc.users?.id ? stringToColor(loc.users.id) : undefined, // Unique color per user
            detail: `Time: ${formatWaktu(new Date(loc.timestamp))}`,
            data: loc
        }));
    }, [sessionLocations]);

    // COMBINED TIMELINE LOGIC
    const combinedActivities = useMemo(() => {
        if (!dateRange?.from) return [];
        const start = startOfDay(dateRange.from);
        const end = endOfDay(dateRange.to || dateRange.from);

        // 1. Collect all raw activities with common structure


        const items: ActivityItem[] = [];

        // Filter by users and date
        const filteredUserIds = selectedSessionUsers.length > 0
            ? selectedSessionUsers
            : users.map(u => u.id);

        // Location Pings
        sessionLocations.forEach(loc => {
            items.push({
                id: loc.id,
                type: 'ping',
                timestamp: new Date(loc.timestamp),
                userId: loc.users?.id || '',
                userName: loc.users?.nama || 'Unknown',
                title: 'Lokasi Ping',
                description: `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`,
                lat: loc.latitude,
                lng: loc.longitude,
                data: loc,
                color: loc.users?.id ? stringToColor(loc.users.id) : undefined
            });
        });

        // Attendance
        absensi.filter(a => {
            const d = new Date(a.tanggal);
            return d >= start && d <= end && filteredUserIds.includes(a.userId);
        }).forEach(a => {
            const u = users.find(u => u.id === a.userId);
            if (a.checkIn) {
                items.push({
                    id: `${a.id}-in`,
                    type: 'checkin',
                    timestamp: new Date(a.checkIn),
                    userId: a.userId,
                    userName: u?.nama || 'Unknown',
                    title: 'Absen Masuk',
                    description: a.lokasiCheckIn?.alamat || 'Check-in Absensi',
                    lat: a.lokasiCheckIn?.latitude,
                    lng: a.lokasiCheckIn?.longitude,
                    data: a
                });
            }
            if (a.checkOut) {
                items.push({
                    id: `${a.id}-out`,
                    type: 'checkout',
                    timestamp: new Date(a.checkOut),
                    userId: a.userId,
                    userName: u?.nama || 'Unknown',
                    title: 'Absen Pulang',
                    description: a.lokasiCheckOut?.alamat || 'Check-out Absensi',
                    lat: a.lokasiCheckOut?.latitude,
                    lng: a.lokasiCheckOut?.longitude,
                    data: a
                });
            }
        });

        // Sales
        penjualan.filter(p => {
            const d = new Date(p.tanggal);
            return d >= start && d <= end && filteredUserIds.includes(p.salesId);
        }).forEach(p => {
            const u = users.find(u => u.id === p.salesId);
            const c = listPelanggan.find(cust => cust.id === p.pelangganId);
            items.push({
                id: p.id,
                type: 'sales',
                timestamp: new Date(p.tanggal),
                userId: p.salesId,
                userName: u?.nama || 'Unknown',
                title: `Penjualan: ${c?.nama || 'Umum'}`,
                description: `Nota: ${p.nomorNota} • ${formatRupiah(p.total)}`,
                lat: p.lokasi?.latitude,
                lng: p.lokasi?.longitude,
                data: p
            });
        });

        // Deposits
        setoran.filter(s => {
            const d = new Date(s.tanggal);
            return d >= start && d <= end && filteredUserIds.includes(s.salesId);
        }).forEach(s => {
            const u = users.find(u => u.id === s.salesId);
            items.push({
                id: s.id,
                type: 'deposit',
                timestamp: new Date(s.tanggal),
                userId: s.salesId,
                userName: u?.nama || 'Unknown',
                title: 'Setoran Uang',
                description: `${formatRupiah(s.jumlah)} • ${s.status.toUpperCase()}`,
                data: s
            });
        });

        // NOO (New Open Outlet / Toko Baru)
        listPelanggan.filter(p => {
            const d = new Date(p.createdAt);
            return d >= start && d <= end && filteredUserIds.includes(p.salesId);
        }).forEach(p => {
            const u = users.find(u => u.id === p.salesId);
            items.push({
                id: `noo-${p.id}`,
                type: 'noo',
                timestamp: new Date(p.createdAt),
                userId: p.salesId,
                userName: u?.nama || 'Unknown',
                title: 'Toko Baru (NOO)',
                description: `Mendaftarkan toko: ${p.nama}`,
                lat: p.lokasi?.latitude,
                lng: p.lokasi?.longitude,
                data: p
            });
        });

        // Terima Barang (Mutasi)
        mutasiBarang.filter(m => {
            const d = new Date(m.tanggal);
            // We show mutation if the user belongs to the target branch or is the one who created it (using createdAt.createdBy)
            // For now, let's simplify and show all relevant to date if admin/owner, or filter by branch
            const isRelevant = currentUser?.roles.some(r => ['admin', 'owner'].includes(r)) ||
                (m.keCabangId === currentUser?.cabangId) ||
                (m.dariCabangId === currentUser?.cabangId);

            return d >= start && d <= end && isRelevant;
        }).forEach(m => {
            const targetCabang = listCabang.find(c => c.id === m.keCabangId);
            items.push({
                id: `mut-${m.id}`,
                type: 'receive',
                timestamp: new Date(m.tanggal),
                userId: 'SYSTEM', // Not tracked by specific user in the same way
                userName: 'Gudang/Logistik',
                title: `Mutasi Barang: ${m.nomorMutasi}`,
                description: `${m.status.toUpperCase()} • Ke: ${targetCabang?.nama || 'N/A'}`,
                data: m
            });
        });

        // 2. Sort all by timestamp descending
        items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        // 3. Process Grouping (Spatial & Temporal)
        // Group pings into "stay" if consecutive and within 100m
        const processed: ActivityItem[] = [];
        let currentStay: ActivityItem | null = null;

        // Process from oldest to newest for grouping logic, then reverse back
        const chronological = [...items].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        chronological.forEach((item, idx) => {
            if (item.type !== 'ping') {
                if (currentStay) {
                    processed.push(currentStay);
                    currentStay = null;
                }
                processed.push(item);
                return;
            }

            // It's a ping
            if (!currentStay) {
                currentStay = { ...item, type: 'stay', duration: 0, title: 'Menetap di Lokasi' };
                return;
            }

            // Compare with current Stay
            const dist = getDistance(currentStay.lat!, currentStay.lng!, item.lat!, item.lng!);
            const timeDiff = differenceInMinutes(item.timestamp, currentStay.timestamp);

            if (dist < 100 && timeDiff < 60) { // Same place within 100m and last ping was < 1hr ago
                const d = currentStay.data as DynamicActivityData;
                currentStay.duration = differenceInMinutes(item.timestamp, d.start || currentStay.timestamp);
                d.end = item.timestamp;
                if (!d.start) d.start = currentStay.timestamp;

                // CHECK FOR NEARBY CABANG (Basecamp Detection)
                const nearbyCabang = listCabang.find(c => {
                    if (!c.koordinat) return false;
                    const [lat, lng] = c.koordinat.split(',').map(s => parseFloat(s.trim()));
                    if (isNaN(lat) || isNaN(lng)) return false;
                    return getDistance(item.lat!, item.lng!, lat, lng) < 100;
                });

                // CHECK FOR HOME (Home Detection for self or colleagues)
                const nearbyKaryawanHome = listKaryawan.find(k => {
                    if (!k.koordinat) return false;
                    if (!k.koordinat) return false;
                    let hLat: number | undefined;
                    let hLng: number | undefined;

                    if (typeof k.koordinat === 'string') {
                        const [lat, lng] = k.koordinat.split(',').map(s => parseFloat(s.trim()));
                        if (!isNaN(lat) && !isNaN(lng)) {
                            hLat = lat;
                            hLng = lng;
                        }
                    } else {
                        hLat = k.koordinat.latitude || k.koordinat.lat;
                        hLng = k.koordinat.longitude || k.koordinat.lng;
                    }
                    if (hLat === undefined || hLng === undefined) return false;
                    return getDistance(item.lat!, item.lng!, hLat, hLng) < 100;
                });

                const isHome = !!nearbyKaryawanHome;
                const isOwnHome = nearbyKaryawanHome?.userAccountId === item.userId;

                // CHECK FOR NEARBY CUSTOMER (Proximity/Visit Detection)
                const nearbyCustomer = listPelanggan.find(p => {
                    if (!p.lokasi) return false;
                    return getDistance(item.lat!, item.lng!, p.lokasi.latitude, p.lokasi.longitude) < 100;
                });

                if (isHome) {
                    currentStay.type = 'visit';
                    currentStay.title = `Rumah: ${nearbyKaryawanHome?.nama}`;
                    currentStay.description = isOwnHome
                        ? `Berada di rumah sendiri (${currentStay.duration} mnt)`
                        : `Sedang berkunjung ke rumah ${nearbyKaryawanHome?.nama} (${currentStay.duration} mnt)`;
                    const d = currentStay.data as DynamicActivityData;
                    d.isHome = true;
                    d.ownerName = nearbyKaryawanHome?.nama;
                } else if (nearbyCabang) {
                    currentStay.type = 'visit';
                    currentStay.title = `Basecamp: ${nearbyCabang.nama}`;
                    currentStay.description = `Berada di Basecamp ${nearbyCabang.nama} (${currentStay.duration} mnt)`;
                } else if (nearbyCustomer) {
                    currentStay.type = 'visit';
                    currentStay.title = `Kunjungan: ${nearbyCustomer.nama}`;
                    currentStay.description = `Sedang berkunjung di ${nearbyCustomer.nama} (${currentStay.duration} mnt)`;
                } else {
                    currentStay.description = `Menetap selama ${currentStay.duration} menit`;
                }
            } else {
                // Moved or too long ago
                processed.push(currentStay);
                currentStay = { ...item, type: 'stay', duration: 0, title: 'Menetap di Lokasi' };
            }
        });

        if (currentStay) processed.push(currentStay);

        // Filter out very short stays (pings) if they are just single pings but keep them if they are meaningful
        // Or just return everything sorted
        return processed.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [sessionLocations, absensi, penjualan, setoran, mutasiBarang, dateRange, selectedSessionUsers, users, listPelanggan, listCabang, listKaryawan, currentUser?.roles, currentUser?.cabangId]);


    return (
        <MainLayout title="Monitoring">
            <div className="p-4 space-y-4">
                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                    <TabsList className="w-full grid grid-cols-4 h-auto p-1">
                        <TabsTrigger value="explore" className="text-xs md:text-sm py-2">
                            <MapPin className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                            Jelajahi
                        </TabsTrigger>
                        {user?.roles.some(r => (['admin', 'owner'] as string[]).includes(r)) && (
                            <TabsTrigger value="tracking" className="text-xs md:text-sm py-2">
                                <Activity className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                                Tracking
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="chat" className="text-xs md:text-sm py-2">
                            <MessageCircle className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                            Chat AI
                        </TabsTrigger>
                        <TabsTrigger value="history" className="text-xs md:text-sm py-2">
                            <Clock className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                            Riwayat
                        </TabsTrigger>
                        <TabsTrigger value="route" className="text-xs md:text-sm py-2">
                            <Navigation className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                            Rute Sales
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="explore" className="mt-4 space-y-4">
                        {/* Quick Stats Summary */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {mapMode === 'team' && (
                                <>
                                    <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-200/50">
                                        <CardContent className="p-3">
                                            <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider mb-1">Total Tim ({selectedCabang !== 'all' ? listCabang.find(c => c.id === selectedCabang)?.nama : 'Semua'})</p>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xl font-bold text-blue-700">{users.filter(u => (selectedCabang === 'all' || u.cabangId === selectedCabang) && (selectedUser === 'all' || u.id === selectedUser)).length}</h4>
                                                <Users className="w-4 h-4 text-blue-400" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-200/50">
                                        <CardContent className="p-3">
                                            <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wider mb-1">Aktif Sekarang</p>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xl font-bold text-green-700">{activeUsers.filter(u => todayAbsensi.some(a => a.userId === u.id && !a.checkOut)).length}</h4>
                                                <Activity className="w-4 h-4 text-green-400" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-200/50 col-span-2 md:col-span-1">
                                        <CardContent className="p-3">
                                            <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wider mb-1">Selesai/Pulang</p>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xl font-bold text-orange-700">{todayAbsensi.filter(a => !!a.checkOut).length}</h4>
                                                <CheckCircle className="w-4 h-4 text-orange-400" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </>
                            )}

                            {mapMode === 'pelanggan' && (
                                <>
                                    <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-200/50">
                                        <CardContent className="p-3">
                                            <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider mb-1">Titik Pelanggan</p>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xl font-bold text-emerald-700">{markers.length}</h4>
                                                <Target className="w-4 h-4 text-emerald-400" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-200/50">
                                        <CardContent className="p-3">
                                            <p className="text-[10px] text-cyan-600 font-semibold uppercase tracking-wider mb-1">Total Terdata</p>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xl font-bold text-cyan-700">{listPelanggan.length}</h4>
                                                <ListFilter className="w-4 h-4 text-cyan-400" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-200/50 col-span-2 md:col-span-1">
                                        <CardContent className="p-3">
                                            <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider mb-1">Cakupan Wilayah</p>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xl font-bold text-indigo-700">{new Set(listPelanggan.map(p => p.cabangId)).size} Cabang</h4>
                                                <MapPin className="w-4 h-4 text-indigo-400" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </>
                            )}

                            {mapMode === 'transaksi' && (
                                <>
                                    <Card className="bg-gradient-to-br from-red-500/10 to-rose-500/10 border-red-200/50">
                                        <CardContent className="p-3">
                                            <p className="text-[10px] text-red-600 font-semibold uppercase tracking-wider mb-1">Total Penjualan</p>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xl font-bold text-red-700">{formatRupiah(markers.reduce((sum, m) => sum + ((m.data as { total: number })?.total || 0), 0))}</h4>
                                                <Coins className="w-4 h-4 text-red-400" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-gradient-to-br from-orange-500/10 to-rose-500/10 border-orange-200/50">
                                        <CardContent className="p-3">
                                            <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wider mb-1">Volume Nota</p>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xl font-bold text-orange-700">{markers.length} Nota</h4>
                                                <ShoppingCart className="w-4 h-4 text-orange-400" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-200/50 col-span-2 md:col-span-1">
                                        <CardContent className="p-3">
                                            <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider mb-1">Rerata Transaksi</p>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xl font-bold text-amber-700">
                                                    {formatRupiah(markers.length > 0 ? markers.reduce((sum, m) => sum + ((m.data as { total: number })?.total || 0), 0) / markers.length : 0)}
                                                </h4>
                                                <TrendingUp className="w-4 h-4 text-amber-400" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </>
                            )}
                        </div>

                        {/* Map Controls */}
                        <div className="flex flex-col md:flex-row gap-2 p-2 bg-muted/40 rounded-xl border">
                            {(currentUser?.roles.includes('admin') || currentUser?.roles.includes('owner') || currentUser?.roles.includes('finance')) && (
                                <>
                                    <Select value={selectedCabang} onValueChange={setSelectedCabang}>
                                        <SelectTrigger className="w-full md:w-[200px] h-9 text-xs bg-background">
                                            <SelectValue placeholder="Semua Cabang" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">
                                                <div className="flex items-center gap-2">
                                                    <Building className="w-3.5 h-3.5 text-muted-foreground" />
                                                    <span className="text-xs">Semua Cabang</span>
                                                </div>
                                            </SelectItem>
                                            {listCabang.map(cabang => (
                                                <SelectItem key={cabang.id} value={cabang.id}>
                                                    <span className="text-xs">{cabang.nama}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                                        <SelectTrigger className="w-full md:w-[200px] h-9 text-xs bg-background">
                                            <SelectValue placeholder="Semua Tim" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                                    <span className="text-xs">Semua Tim</span>
                                                </div>
                                            </SelectItem>
                                            {users
                                                .filter(u => selectedCabang === 'all' || u.cabangId === selectedCabang)
                                                .map(user => (
                                                    <SelectItem key={user.id} value={user.id}>
                                                        <span className="text-xs">{user.nama}</span>
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </>
                            )}

                            <Select value={mapMode} onValueChange={(v) => setMapMode(v as MapMode)}>
                                <SelectTrigger className="w-full md:w-[200px] h-9 text-xs bg-background">
                                    <SelectValue placeholder="Pilih Mode Peta" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="team">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-3.5 h-3.5 text-blue-500" />
                                            <span className="text-xs">Lokasi Tim</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="pelanggan">
                                        <div className="flex items-center gap-2">
                                            <Crosshair className="w-3.5 h-3.5 text-green-500" />
                                            <span className="text-xs">Lokasi Pelanggan</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="transaksi">
                                        <div className="flex items-center gap-2">
                                            <ShoppingCart className="w-3.5 h-3.5 text-red-500" />
                                            <span className="text-xs">Lokasi Transaksi</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>

                            <div className="flex-1 min-w-0">
                                <DatePickerWithRange
                                    date={dateRange}
                                    setDate={setDateRange}
                                    className="w-full [&>button]:h-9 [&>button]:text-xs [&>button]:bg-background"
                                />
                            </div>
                        </div>

                        {/* Map Container */}
                        <Card elevated className="overflow-hidden">
                            <CardContent className="p-0 relative h-[300px] md:h-[450px] z-0">
                                <GMap
                                    mapId="8e0a97af9386fef"
                                    center={mapCenter}
                                    zoom={11}
                                    style={{ height: '100%', width: '100%' }}
                                    onCenterChanged={(ev) => setMapCenter(ev.detail.center)}
                                >
                                    {markers.map((marker: MapMarker) => (
                                        <AdvancedMarker
                                            key={marker.id}
                                            position={marker.position}
                                            onClick={() => {
                                                setMapCenter(marker.position);
                                                setSelectedMarker(marker);
                                            }}
                                        >
                                            <Pin
                                                background={marker.color || ICONS[marker.type as keyof typeof ICONS] || ICONS.team}
                                                glyphColor={'#ffffff'}
                                                borderColor={'#ffffff'}
                                            />
                                        </AdvancedMarker>
                                    ))}

                                    {selectedMarker && (
                                        <InfoWindow
                                            position={selectedMarker.position}
                                            onCloseClick={() => setSelectedMarker(null)}
                                        >
                                            <div className="p-2 min-w-[200px]">
                                                <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                                                    <div
                                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                                                        style={{ backgroundColor: selectedMarker.color || '#3b82f6' }}
                                                    >
                                                        {selectedMarker.userName ? (selectedMarker.userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()) : (selectedMarker.type === 'team' ? 'T' : selectedMarker.type === 'customer' ? 'C' : 'S')}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm capitalize">{selectedMarker.title}</p>
                                                        <p className="text-xs text-muted-foreground">{selectedMarker.subtitle}</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-1 mb-3">
                                                    <p className="text-xs text-muted-foreground">{selectedMarker.detail}</p>
                                                    {(selectedMarker.type === 'customer' || selectedMarker.type === 'transaction') && selectedMarker.userName && (
                                                        <p className="text-xs font-semibold text-primary">Sales: {selectedMarker.userName}</p>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        className="w-full text-xs h-7"
                                                        onClick={(e) => {
                                                            const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedMarker.position.lat},${selectedMarker.position.lng}`;
                                                            window.open(url, '_blank');
                                                        }}
                                                    >
                                                        <MapIcon className="w-3 h-3 mr-1" />
                                                        Rute
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="w-full text-xs h-7">Detail</Button>
                                                </div>
                                            </div>
                                        </InfoWindow>
                                    )}
                                </GMap>

                                {/* Dynamic Legend Overlay */}
                                <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-border max-w-[200px] max-h-[300px] overflow-y-auto z-[1000]">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2 tracking-wider">
                                        Legenda ({mapMode === 'team' ? 'Tim' : 'Sales'})
                                    </p>
                                    <div className="space-y-1.5">
                                        {Array.from(new Set(markers.map(m => m.userName).filter(Boolean))).map(userName => {
                                            const marker = markers.find(m => m.userName === userName);
                                            return (
                                                <div key={userName} className="flex items-center gap-2">
                                                    <div
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: marker?.color || '#94a3b8' }}
                                                    />
                                                    <span className="text-xs truncate font-medium text-slate-700 capitalize">{userName}</span>
                                                </div>
                                            );
                                        })}
                                        {markers.length === 0 && <span className="text-[10px] text-muted-foreground italic">Tidak ada data</span>}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Dynamic List based on Map Mode */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="text-sm font-semibold text-muted-foreground">
                                    {mapMode === 'team' && (currentUser?.roles.includes('sales') ? 'Status Saya' : 'Sales Aktif Hari Ini')}
                                    {mapMode === 'pelanggan' && 'Daftar Pelanggan Terpilih'}
                                    {mapMode === 'transaksi' && 'Daftar Transaksi Terpilih'}
                                </h3>
                                <Badge variant="outline" className="text-[10px] font-normal">
                                    {markers.length} Data
                                </Badge>
                            </div>

                            {markers.length === 0 ? (
                                <div className="text-center p-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                                    Tidak ada data untuk filter ini
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {mapMode === 'team' && activeUsers.map((user, index) => {
                                        const userAbsensi = todayAbsensi.find(a => a.userId === user.id);
                                        const cabang = listCabang.find(c => c.id === user.cabangId);
                                        const isCheckedIn = !!userAbsensi?.checkIn;
                                        const isCheckedOut = !!userAbsensi?.checkOut;

                                        return (
                                            <Card
                                                key={user.id}
                                                className="bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                                                onClick={() => {
                                                    const marker = markers.find(m => m.id === user.id);
                                                    if (marker) {
                                                        setMapCenter(marker.position);
                                                        setSelectedMarker(marker);
                                                    }
                                                }}
                                            >
                                                <CardContent className="p-4 flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCheckedIn && !isCheckedOut ? 'bg-blue-500/10' : 'bg-muted'
                                                        }`}>
                                                        <User className={`w-5 h-5 ${isCheckedIn && !isCheckedOut ? 'text-blue-500' : 'text-muted-foreground'
                                                            }`} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-sm truncate">{user.nama} {user.id === currentUser?.id ? '(Saya)' : ''}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{cabang?.nama}</p>
                                                    </div>
                                                    <div className="text-right flex flex-col items-end gap-1">
                                                        {isCheckedIn ? (
                                                            <Badge variant={isCheckedOut ? 'muted' : 'success'}>
                                                                {isCheckedOut ? 'Selesai' : 'Aktif'}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="warning">Belum Absen</Badge>
                                                        )}
                                                        {isCheckedIn && userAbsensi?.checkIn && (
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {formatWaktu(new Date(userAbsensi.checkIn))}
                                                            </p>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}

                                    {mapMode === 'pelanggan' && markers.map((marker, index) => {
                                        const p = listPelanggan.find(item => item.id === marker.id);
                                        return (
                                            <Card
                                                key={marker.id}
                                                className="bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                                                onClick={() => {
                                                    setMapCenter(marker.position);
                                                    setSelectedMarker(marker);
                                                }}
                                            >
                                                <CardContent className="p-4 flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                                                        <Crosshair className="w-5 h-5 text-green-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-sm truncate">{marker.title}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{p?.alamat || marker.subtitle}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <Badge variant="outline" className="text-[10px]">
                                                            {p?.namaPemilik || 'Umum'}
                                                        </Badge>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}

                                    {mapMode === 'transaksi' && markers.map((marker, index) => {
                                        const penjualan = marker.data as Penjualan;
                                        return (
                                            <Card
                                                key={marker.id}
                                                className="bg-card hover:bg-muted/30 transition-colors cursor-pointer group"
                                                onClick={() => {
                                                    setMapCenter(marker.position);
                                                    setSelectedMarker(marker);
                                                }}
                                            >
                                                <CardContent className="p-4 flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 group-hover:bg-red-500/20 transition-colors">
                                                        <ShoppingCart className="w-5 h-5 text-red-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-sm truncate capitalize">{marker.title}</p>
                                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                            <User className="w-3 h-3" />
                                                            <span className="capitalize">{marker.userName || 'Sales'}</span>
                                                        </div>
                                                        <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">{penjualan?.nomorNota || '#'}</p>
                                                    </div>
                                                    <div className="text-right flex flex-col items-end gap-1">
                                                        <p className="text-sm font-bold text-primary">{formatRupiah(penjualan?.total || 0)}</p>
                                                        <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">
                                                            Transaksi
                                                        </Badge>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="chat" className="mt-4">
                        <Card elevated className="h-[500px] md:h-[650px] flex flex-col">
                            <CardContent className="p-4 md:p-6 h-full">
                                <AIChat />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="history" className="mt-4 space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground px-1">Riwayat Absensi Terkini</h3>

                        {/* Show recent check-ins instead of generic users list */}
                        {absensi
                            .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
                            .slice(0, historyLimit)
                            .filter(a => {
                                // Same filtering logic as explore
                                const u = users.find(user => user.id === a.userId);
                                if (!u) return false;
                                if (currentUser?.roles.includes('admin') || currentUser?.roles.includes('owner') || currentUser?.roles.includes('finance')) return true;
                                if (currentUser?.roles.includes('leader')) return u.cabangId === currentUser.cabangId;
                                return u.id === currentUser?.id;
                            })
                            .map((record, index) => {
                                const user = users.find(u => u.id === record.userId);
                                const cabang = listCabang.find(c => c.id === user?.cabangId);

                                if (!user) return null;

                                return (
                                    <Card
                                        key={record.id}
                                        className="animate-slide-up"
                                        style={{ animationDelay: `${index * 30}ms` }}
                                    >
                                        <CardContent className="p-4 flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-muted">
                                                <Activity className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-sm">{user.nama}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {record.status === 'hadir' ? 'Check-In' : record.status} • {cabang?.nama}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">
                                                    {formatTanggal(new Date(record.tanggal))}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {record.checkIn ? formatWaktu(new Date(record.checkIn)) : '-'}
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        {absensi.length > historyLimit && (
                            <Button
                                variant="ghost"
                                className="w-full mt-4 border-dashed text-muted-foreground"
                                onClick={() => setHistoryLimit(prev => prev + 10)}
                            >
                                Lihat Lainnya
                            </Button>
                        )}
                    </TabsContent>

                    {/* TRACKING TAB CONTENT */}
                    <TabsContent value="tracking" className="mt-4 space-y-4">
                        {/* Session Controls */}
                        <div className="flex flex-col md:flex-row gap-3 p-3 bg-card rounded-xl border shadow-sm">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full md:w-[250px] justify-between">
                                        <div className="flex items-center gap-2 truncate">
                                            <Filter className="w-4 h-4 text-muted-foreground" />
                                            <span>
                                                {selectedSessionUsers.length === 0
                                                    ? "Semua User"
                                                    : `${selectedSessionUsers.length} User terpilih`}
                                            </span>
                                        </div>
                                        <ChevronDown className="w-4 h-4 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-[250px] max-h-[300px] overflow-y-auto">
                                    <DropdownMenuLabel>Pilih User</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuCheckboxItem
                                        checked={selectedSessionUsers.length === 0}
                                        onCheckedChange={() => setSelectedSessionUsers([])}
                                    >
                                        Semua User
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuSeparator />
                                    {users.filter(u => u.isActive).map(u => (
                                        <DropdownMenuCheckboxItem
                                            key={u.id}
                                            checked={selectedSessionUsers.includes(u.id)}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedSessionUsers([...selectedSessionUsers, u.id]);
                                                } else {
                                                    setSelectedSessionUsers(selectedSessionUsers.filter(id => id !== u.id));
                                                }
                                            }}
                                        >
                                            {u.nama}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <div className="flex-1">
                                <DatePickerWithRange
                                    date={dateRange}
                                    setDate={setDateRange}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* Session Map */}
                        <Card elevated className="overflow-hidden">
                            <CardContent className="p-0 relative h-[300px] md:h-[450px] z-0">
                                <GMap
                                    mapId="8e0a97af9386fef"
                                    center={sessionMarkers.length > 0 ? sessionMarkers[0].position : { lat: -6.2088, lng: 106.8456 }}
                                    zoom={11}
                                    style={{ height: '100%', width: '100%' }}
                                >
                                    {sessionMarkers.map((marker, idx) => (
                                        <AdvancedMarker
                                            key={marker.id}
                                            position={marker.position}
                                            onClick={() => setSelectedMarker(marker)}
                                        >
                                            <Pin
                                                background={marker.color || ICONS.active}
                                                glyphColor={'#ffffff'}
                                                borderColor={'#ffffff'}
                                            />
                                        </AdvancedMarker>
                                    ))}

                                    {selectedMarker && selectedMarker.type === 'active' && (
                                        <InfoWindow
                                            position={selectedMarker.position}
                                            onCloseClick={() => setSelectedMarker(null)}
                                        >
                                            <div className="p-2 min-w-[150px]">
                                                <p className="font-semibold text-sm mb-1">{selectedMarker.title}</p>
                                                <p className="text-xs text-muted-foreground mb-3">{selectedMarker.subtitle}</p>

                                                <div className="flex flex-col gap-2">
                                                    <a
                                                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedMarker.position.lat},${selectedMarker.position.lng}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white !text-white text-[10px] py-2 px-2 rounded-md flex items-center justify-center gap-1 transition-colors no-underline font-medium"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                        Google Maps
                                                    </a>
                                                </div>
                                            </div>
                                        </InfoWindow>
                                    )}
                                </GMap>
                                <div className="absolute bottom-4 right-4 bg-white/90 p-2 rounded-lg shadow-md text-xs z-[1000] border">
                                    <p className="font-semibold mb-1">Total Logs: {sessionMarkers.length}</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Timeline */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-muted-foreground px-1 flex items-center gap-2 mt-6">
                                <Activity className="w-4 h-4" /> Aktivitas
                            </h3>

                            {combinedActivities.length === 0 ? (
                                <div className="text-center p-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                                    Pilih user dan tanggal untuk melihat linimasa
                                </div>
                            ) : (
                                <Card className="border shadow-sm p-4">
                                    <div className="relative space-y-0 pl-1 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-muted-foreground/20">
                                        {combinedActivities.slice(0, sessionLimit).map((activity, idx) => {
                                            let Icon = Activity;
                                            let colorClass = 'bg-primary';

                                            if (activity.type === 'sales') { Icon = ShoppingCart; colorClass = 'bg-red-500'; }
                                            if (activity.type === 'deposit') { Icon = Wallet; colorClass = 'bg-green-600'; }
                                            if (activity.type === 'checkin') { Icon = LogIn; colorClass = 'bg-success'; }
                                            if (activity.type === 'checkout') { Icon = LogOut; colorClass = 'bg-orange-500'; }
                                            if (activity.type === 'stay') { Icon = MapIcon; colorClass = activity.color ? '' : 'bg-blue-500'; }
                                            if (activity.type === 'noo') { Icon = PlusCircle; colorClass = 'bg-purple-600'; }
                                            if (activity.type === 'receive') { Icon = Package; colorClass = 'bg-yellow-600'; }
                                            if (activity.type === 'visit') {
                                                Icon = Store;
                                                colorClass = 'bg-cyan-600';
                                                if ((activity.data as DynamicActivityData)?.isHome) {
                                                    Icon = Home;
                                                    colorClass = 'bg-blue-600';
                                                } else if (activity.title.startsWith('Basecamp')) {
                                                    Icon = MapPin;
                                                    colorClass = 'bg-indigo-600';
                                                }
                                            }

                                            return (
                                                <div key={activity.id} className="relative pl-8 pb-8 last:pb-2">
                                                    {/* Timeline dot */}
                                                    <div
                                                        className={`absolute left-[5px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-background z-10 shadow-sm flex items-center justify-center ${colorClass}`}
                                                        style={activity.color ? { backgroundColor: activity.color } : {}}
                                                    >
                                                        <Icon className="w-2 h-2 text-white" />
                                                    </div>

                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex items-center justify-between gap-4">
                                                            <div className="flex flex-col">
                                                                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{activity.userName}</p>
                                                                <p className="text-sm font-bold tracking-tight">{activity.title}</p>
                                                            </div>
                                                            <Badge variant="secondary" className="text-[10px] font-mono font-medium shrink-0">
                                                                {formatWaktu(activity.timestamp)}
                                                            </Badge>
                                                        </div>

                                                        <div className="flex flex-col gap-2">
                                                            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 leading-tight">
                                                                {activity.type === 'stay' ? (
                                                                    <>
                                                                        <Clock className="w-3 h-3 shrink-0" />
                                                                        {activity.duration && activity.duration > 0 ? `Menetap selama ${activity.duration} menit` : 'Singgah sebentar'}
                                                                    </>
                                                                ) : (
                                                                    activity.description
                                                                )}
                                                            </p>

                                                            {(activity.lat && activity.lng) && (
                                                                <div className="flex items-center gap-3 mt-1">
                                                                    <a
                                                                        href={`https://www.google.com/maps/dir/?api=1&destination=${activity.lat},${activity.lng}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-[10px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5 hover:underline transition-colors"
                                                                    >
                                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                                        Lihat Lokasi
                                                                    </a>

                                                                    <span className="text-[9px] text-muted-foreground italic bg-muted px-1.5 py-0.5 rounded">
                                                                        {activity.lat.toFixed(4)}, {activity.lng.toFixed(4)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {combinedActivities.length > sessionLimit && (
                                            <Button
                                                variant="ghost"
                                                className="w-full mt-4 border-dashed text-muted-foreground"
                                                onClick={() => setSessionLimit(prev => prev + 10)}
                                            >
                                                Lihat Lainnya
                                            </Button>
                                        )}
                                    </div>
                                </Card>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="route" className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Customer Selection Sidebar */}
                            <div className="lg:col-span-1 space-y-4">
                                <Card>
                                    <CardHeader className="p-4">
                                        <CardTitle className="text-sm">Pilih Pelanggan</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="max-h-[600px] overflow-y-auto">
                                            {listPelanggan
                                                .filter(p => (selectedCabang === 'all' || p.cabangId === selectedCabang) && (selectedUser === 'all' || p.salesId === selectedUser))
                                                .filter(p => p.lokasi?.latitude && p.lokasi?.longitude)
                                                .map(p => (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => toggleCustomerForRoute(p)}
                                                        className={`p-3 border-b cursor-pointer transition-colors hover:bg-muted/50 flex items-start gap-3 ${selectedRouteCustomers.find(c => c.id === p.id) ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                                                    >
                                                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedRouteCustomers.find(c => c.id === p.id) ? 'bg-primary border-primary text-white' : 'bg-background'}`}>
                                                            {selectedRouteCustomers.find(c => c.id === p.id) && <CheckCircle2 className="w-3 h-3" />}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-xs font-bold leading-none">{p.nama}</p>
                                                            <p className="text-[10px] text-muted-foreground line-clamp-1">{p.alamat}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </CardContent>
                                </Card>
                                {selectedRouteCustomers.length > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs gap-2"
                                        onClick={() => setSelectedRouteCustomers([])}
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        Reset Pilihan ({selectedRouteCustomers.length})
                                    </Button>
                                )}
                            </div>

                            {/* Route Map Component */}
                            <div className="lg:col-span-2 space-y-4">
                                <Card>
                                    <CardContent className="p-4">
                                        {selectedRouteCustomers.length === 0 ? (
                                            <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-3 bg-muted/20 rounded-xl border border-dashed p-6">
                                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <Navigation className="w-6 h-6 text-primary" />
                                                </div>
                                                <div className="space-y-1">
                                                    <h3 className="text-sm font-semibold">Siapkan Rute Kunjungan</h3>
                                                    <p className="text-xs text-muted-foreground max-w-[250px]">
                                                        Pilih beberapa pelanggan dari daftar di samping untuk membuat rute perjalanan yang optimal.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <SalesRouteMap
                                                customers={selectedRouteCustomers}
                                            />
                                        )}
                                    </CardContent>
                                </Card>

                                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                                    <h4 className="text-xs font-bold text-blue-800 flex items-center gap-2 mb-2">
                                        <Info className="w-3 h-3" /> Tips Optimasi
                                    </h4>
                                    <ul className="text-[10px] text-blue-700 space-y-1 list-disc pl-4">
                                        <li>Urutan rute akan dimulai dari pelanggan pertama yang Anda pilih.</li>
                                        <li>Sistem akan mengurutkan titik tengah untuk memberikan jarak tempuh minimum.</li>
                                        <li>Pastikan semua pelanggan yang dipilih memiliki koordinat lokasi yang valid.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Detail Dialog */}
                <Dialog open={!!selectedMarker} onOpenChange={(open) => !open && setSelectedMarker(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Detail Informasi</DialogTitle>
                            <DialogDescription>
                                Rincian lengkap dari {selectedMarker?.type === 'team' ? 'Tim' : selectedMarker?.type === 'customer' ? 'Pelanggan' : 'Transaksi'} yang dipilih.
                            </DialogDescription>
                        </DialogHeader>

                        {selectedMarker && (
                            <div className="space-y-4 py-2">
                                {/* TEAM DETAILS */}
                                {selectedMarker.type === 'team' && (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            {/* Cast data to User & { absensi: Absensi } */}
                                            {(() => {
                                                const d = selectedMarker.data as UserType & { absensi: Absensi };
                                                return (
                                                    <>
                                                        <span className="text-muted-foreground">Nama:</span>
                                                        <span className="col-span-2 font-medium">{d.nama}</span>

                                                        <span className="text-muted-foreground">Jabatan:</span>
                                                        <span className="col-span-2">{d.roles?.join(', ')}</span>

                                                        <span className="text-muted-foreground">Email:</span>
                                                        <span className="col-span-2">{d.email}</span>

                                                        <span className="text-muted-foreground">Telepon:</span>
                                                        <span className="col-span-2">{d.telepon}</span>

                                                        <span className="text-muted-foreground">Waktu Check-in:</span>
                                                        <span className="col-span-2">{formatWaktu(new Date(d.absensi.checkIn || d.absensi.tanggal))}</span>

                                                        <span className="text-muted-foreground">Lokasi:</span>
                                                        <span className="col-span-2 text-xs">{d.absensi.lokasiCheckIn?.alamat || `${selectedMarker.position.lat}, ${selectedMarker.position.lng}`}</span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* CUSTOMER DETAILS */}
                                {selectedMarker.type === 'customer' && (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            {(() => {
                                                const d = selectedMarker.data as Pelanggan;
                                                return (
                                                    <>
                                                        <span className="text-muted-foreground">Kode:</span>
                                                        <span className="col-span-2 font-medium">{d.kode}</span>

                                                        <span className="text-muted-foreground">Nama:</span>
                                                        <span className="col-span-2 font-medium">{d.nama}</span>

                                                        <span className="text-muted-foreground">Alamat:</span>
                                                        <span className="col-span-2">{d.alamat}</span>

                                                        <span className="text-muted-foreground">Telepon:</span>
                                                        <span className="col-span-2">{d.telepon}</span>

                                                        <span className="text-muted-foreground">Status:</span>
                                                        <span className="col-span-2">
                                                            <Badge variant={d.isActive ? 'success' : 'destructive'}>
                                                                {d.isActive ? 'Aktif' : 'Non-Aktif'}
                                                            </Badge>
                                                        </span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* TRANSACTION DETAILS */}
                                {selectedMarker.type === 'transaction' && (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            {(() => {
                                                const d = selectedMarker.data as Penjualan;
                                                return (
                                                    <>
                                                        <span className="text-muted-foreground">No. Nota:</span>
                                                        <span className="col-span-2 font-medium">{d.nomorNota}</span>

                                                        <span className="text-muted-foreground">Tanggal:</span>
                                                        <span className="col-span-2">{formatTanggal(new Date(d.tanggal))}</span>

                                                        <span className="text-muted-foreground">Total:</span>
                                                        <span className="col-span-2 font-bold text-primary">{formatRupiah(d.total)}</span>

                                                        <span className="text-muted-foreground">Metode:</span>
                                                        <span className="col-span-2 capitalize">{d.metodePembayaran}</span>

                                                        <span className="text-muted-foreground">Status:</span>
                                                        <span className="col-span-2">
                                                            <Badge variant={
                                                                d.status === 'lunas' ? 'success' :
                                                                    d.status === 'batal' ? 'destructive' : 'warning'
                                                            }>
                                                                {d.status?.toUpperCase()}
                                                            </Badge>
                                                        </span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 flex justify-end">
                                    <a
                                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedMarker.position.lat},${selectedMarker.position.lng}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Button size="sm" className="gap-2">
                                            <ExternalLink className="w-4 h-4" />
                                            Buka Peta
                                        </Button>
                                    </a>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

            </div>
        </MainLayout>
    );
}

