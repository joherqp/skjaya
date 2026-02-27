import { useState, useMemo, useCallback } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Barang as BarangType } from '@/lib/types';


// -- Global State for Persistence Across Navigation --
let globalSearch = '';
let globalFilterKategori: string[] = [];
let globalFilterStok: string[] = [];
let globalFilterCabang: string[] = [];
let globalShowInactive = false;

export const useBarangManagement = () => {
    const { user } = useAuth();
    const { barang, satuan: satuanList, stokPengguna, penjualan, kategori: kategoriList, cabang, users } = useDatabase();

    // -- Access Control --
    const isAdminOrOwner = user?.roles.includes('admin') || user?.roles.includes('owner');

    // -- Filters State --
    const [search, _setSearch] = useState(globalSearch);
    const [filterKategori, _setFilterKategori] = useState<string[]>(globalFilterKategori);
    const [filterStok, _setFilterStok] = useState<string[]>(globalFilterStok);
    const [filterCabang, _setFilterCabang] = useState<string[]>(globalFilterCabang);
    const [showInactive, _setShowInactive] = useState(globalShowInactive);

    // Sync setters to global
    const setSearch = (val: string) => { globalSearch = val; _setSearch(val); };
    const setFilterKategori = (val: string[]) => { globalFilterKategori = val; _setFilterKategori(val); };
    const setFilterStok = (val: string[]) => { globalFilterStok = val; _setFilterStok(val); };
    const setFilterCabang = (val: string[]) => { globalFilterCabang = val; _setFilterCabang(val); };
    const setShowInactive = (val: boolean | ((prevState: boolean) => boolean)) => {
        if (typeof val === 'function') {
            _setShowInactive((prev) => {
                const next = val(prev);
                globalShowInactive = next;
                return next;
            });
        } else {
            globalShowInactive = val;
            _setShowInactive(val);
        }
    };

    // -- Logic Calculators --
    const getStockHealth = useCallback((barangId: string, currentStock: number) => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // 1. Calculate Sales in last 30 days
        const relevantSales = penjualan.filter(p =>
            new Date(p.tanggal) >= thirtyDaysAgo &&
            p.status !== 'batal' &&
            (isAdminOrOwner ? true : p.salesId === user?.id)
        );

        let totalSold = 0;
        relevantSales.forEach(sale => {
            const item = sale.items.find(i => i.barangId === barangId);
            if (item) totalSold += item.jumlah;
        });

        const b = barang.find(x => x.id === barangId);
        const minStok = b?.minStok || 0;

        let status: 'aman' | 'warning' | 'critical' = 'aman';
        const avgDailySales = totalSold / 30;
        const daysCoverage = avgDailySales > 0 ? currentStock / avgDailySales : 999;

        // 2. Hybrid Logic
        if (totalSold > 0) {
            // Velocity-based logic: prioritized for "permintaan pasar"
            if (daysCoverage < 7) status = 'critical';
            else if (daysCoverage < 14) status = 'warning';
        }

        // Always check against minStok (safety net)
        if (status === 'aman') {
            if (currentStock <= minStok * 0.5) status = 'critical';
            else if (currentStock <= minStok) status = 'warning';
        }

        return {
            avgDailySales,
            daysCoverage,
            status,
            demandLevel: avgDailySales > 5 ? 'Tinggi' : avgDailySales > 2 ? 'Sedang' : totalSold > 0 ? 'Rendah' : 'Tidak Ada Penjualan'
        };
    }, [penjualan, user?.id, isAdminOrOwner, barang]);

    // -- Data Filtering --
    const filteredBarang = useMemo(() => {
        return barang.filter(b => {
            const matchesSearch = b.nama.toLowerCase().includes(search.toLowerCase()) || b.kode.toLowerCase().includes(search.toLowerCase());
            const matchesKategori = filterKategori.length === 0 || filterKategori.includes(b.kategoriId);
            const matchesActive = showInactive ? true : (b.isActive !== false);

            return matchesSearch && matchesKategori && matchesActive;
        });
    }, [barang, search, filterKategori, showInactive]);

    const activeFiltersCount = [
        filterKategori.length > 0,
        filterStok.length > 0,
        filterCabang.length > 0
    ].filter(Boolean).length;

    // -- Display Logic (Global vs Personal) --
    const displayedItems = useMemo(() => {
        // 1. Admin / Owner / Gudang -> Global or Branch-specific
        if (isAdminOrOwner) {
            if (filterCabang.length === 0) {
                // All User Stocks
                return filteredBarang.map(item => {
                    let consolidatedStock = 0;
                    stokPengguna.filter(s => s.barangId === item.id)
                        .forEach(s => consolidatedStock += s.jumlah);

                    const globalItem = { ...item, stok: consolidatedStock };

                    if (filterStok.length > 0) {
                        const health = getStockHealth(globalItem.id, globalItem.stok);
                        if (filterStok.includes('aman') && health.status === 'aman') return globalItem;
                        if (filterStok.includes('rendah') && health.status !== 'aman') return globalItem;
                        return null;
                    }
                    return globalItem;
                }).filter((item): item is (BarangType & { stok: number }) => item !== null);
            } else {
                // Specific Branch Stock
                const branchUserIds = users.filter(u => filterCabang.includes(u.cabangId)).map(u => u.id);

                return filteredBarang.map(item => {
                    let branchStock = 0;
                    stokPengguna.filter(s => s.barangId === item.id && branchUserIds.includes(s.userId))
                        .forEach(s => branchStock += s.jumlah);

                    const branchItem = { ...item, stok: branchStock };

                    if (filterStok.length > 0) {
                        const health = getStockHealth(branchItem.id, branchItem.stok);
                        if (filterStok.includes('aman') && health.status === 'aman') return branchItem;
                        if (filterStok.includes('rendah') && health.status !== 'aman') return branchItem;
                        return null;
                    }

                    // Sembunyikan barang dengan stok kosong jika sedang filter cabang dan tidak sedang mencari
                    if (search === '' && branchItem.stok <= 0) {
                        return null;
                    }

                    return branchItem;
                }).filter((item): item is (BarangType & { stok: number }) => item !== null)
                    .sort((a, b) => (b.stok || 0) - (a.stok || 0));
            }
        }

        // 2. Sales / Staff -> Personal Stock
        return filteredBarang.map(item => {
            const myStock = stokPengguna.find(s => s.userId === user?.id && s.barangId === item.id);
            const quantity = myStock ? myStock.jumlah : 0;
            const personalItem = { ...item, stok: quantity };

            if (filterStok.length > 0) {
                const health = getStockHealth(personalItem.id, personalItem.stok);
                if (filterStok.includes('aman') && health.status === 'aman') return personalItem;
                if (filterStok.includes('rendah') && health.status !== 'aman') return personalItem;
                return null;
            }

            return personalItem;
        }).filter((item): item is (BarangType & { stok: number }) => item !== null)
            .sort((a, b) => (b.stok || 0) - (a.stok || 0));

    }, [filteredBarang, stokPengguna, user, isAdminOrOwner, filterStok, filterCabang, users, cabang, getStockHealth]);

    return {
        // State
        search, setSearch,
        filterKategori, setFilterKategori,
        filterStok, setFilterStok,
        filterCabang, setFilterCabang,
        showInactive, setShowInactive,
        activeFiltersCount,

        // Data
        displayedItems,
        kategoriList,
        satuanList,
        cabangList: cabang,

        // Utils
        isAdminOrOwner,
        getStockHealth
    };
};
