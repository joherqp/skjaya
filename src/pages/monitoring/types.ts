
export type MapMode = 'team' | 'pelanggan' | 'transaksi';

export interface MapMarker {
    id: string;
    position: { lat: number; lng: number };
    title: string;
    subtitle: string;
    type: string;
    detail: string;
    color?: string;
    data: unknown;
    userName?: string;
}

export interface UserLocation {
    id: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    users?: {
        id: string;
        nama: string;
        roles: string[];
        cabang_id: string;
    };
}

export interface DynamicActivityData {
    start?: Date;
    end?: Date;
    isHome?: boolean;
    ownerName?: string;
    [key: string]: unknown;
}

export interface ActivityItem {
    id: string;
    type: 'ping' | 'stay' | 'sales' | 'deposit' | 'checkin' | 'checkout' | 'noo' | 'receive' | 'visit';
    timestamp: Date;
    userId: string;
    userName: string;
    title: string;
    description: string;
    lat?: number;
    lng?: number;
    duration?: number;
    data: unknown;
    color?: string;
}
