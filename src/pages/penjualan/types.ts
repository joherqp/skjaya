
export interface CartItem {
    barangId: string;
    jumlah: number;
    harga: number;
    diskon: number; 
    maxStok: number;
    satuanId?: string; 
    konversi: number;
    isBonus?: boolean;
    totalQty?: number;
    hargaTier?: { min: number; max: number; harga: number; isMixMatch?: boolean };
    // Bonus related fields
    promoId?: string; // Which promo generated this
    pendingBonus?: {
        options: string[];
        mechanism: 'single' | 'mix';
        maxQty: number;
    };
    // NEW: Flexible Promo Selection
    selectedPromoId?: string; // 'NONE' | uuid | undefined (Auto)
    availablePromos?: { id: string; nama: string; tipe: string; nilai: number; bonusProdukIds?: string[]; isBest?: boolean }[]; 
}
