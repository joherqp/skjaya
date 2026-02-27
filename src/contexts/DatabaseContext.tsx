/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  DatabaseContextType,
  Kategori,
  Satuan,
  Barang,
  Pelanggan,
  User,
  Karyawan,
  Penjualan,
  Setoran,
  Absensi,
  Notifikasi,
  Persetujuan,
  KategoriPelanggan,
  RekeningBank,
  Area,
  Cabang,
  Harga,
  StokPengguna,
  Promo,
  MutasiBarang,
  SaldoPengguna,
  ProfilPerusahaan,
  Reimburse,
  PettyCash,
  PembayaranPenjualan,
  Restock
} from '@/lib/types';
import { toCamelCase, toSnakeCase } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

const DatabaseContext = createContext<DatabaseContextType | null>(null);

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const { user: currentUser } = useAuth();

  // State definitions
  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [satuan, setSatuan] = useState<Satuan[]>([]);
  const [kategoriPelanggan, setKategoriPelanggan] = useState<KategoriPelanggan[]>([]);
  const [rekeningBank, setRekeningBank] = useState<RekeningBank[]>([]);
  const [area, setArea] = useState<Area[]>([]);
  const [cabang, setCabang] = useState<Cabang[]>([]);

  const [barang, setBarang] = useState<Barang[]>([]);
  const [pelanggan, setPelanggan] = useState<Pelanggan[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [karyawan, setKaryawan] = useState<Karyawan[]>([]);
  const [penjualan, setPenjualan] = useState<Penjualan[]>([]);
  const [setoran, setSetoran] = useState<Setoran[]>([]);
  const [absensi, setAbsensi] = useState<Absensi[]>([]);
  const [notifikasi, setNotifikasi] = useState<Notifikasi[]>([]);
  const [persetujuan, setPersetujuan] = useState<Persetujuan[]>([]);
  const [harga, setHarga] = useState<Harga[]>([]);
  const [stokPengguna, setStokPengguna] = useState<StokPengguna[]>([]);
  const [promo, setPromo] = useState<Promo[]>([]);
  const [mutasiBarang, setMutasiBarang] = useState<MutasiBarang[]>([]);
  const [saldoPengguna, setSaldoPengguna] = useState<SaldoPengguna[]>([]);
  const [reimburse, setReimburse] = useState<Reimburse[]>([]);
  const [pettyCash, setPettyCash] = useState<PettyCash[]>([]);
  const [restock, setRestock] = useState<Restock[]>([]);

  // Profil Perusahaan
  const [profilPerusahaan, setProfilPerusahaan] = useState<ProfilPerusahaan>({
    id: '',
    nama: 'Loading...',
    alamat: '',
    telepon: '',
    email: '',
    website: '',
    deskripsi: ''
  });

  // UI State
  const [pettyCashBalance, setPettyCashBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'me'>('all'); // Default to 'all' per request

  // Feature: Offline Sync
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  // Feature: Other tables
  const [penyesuaianStok, setPenyesuaianStok] = useState<any[]>([]);
  const [permintaanBarang, setPermintaanBarang] = useState<any[]>([]);

  // Monitor Online Status
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); toast.success('Online'); };
    const handleOffline = () => { setIsOnline(false); toast.warning('Offline Mode'); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial queue
    const queue = JSON.parse(localStorage.getItem('item_queue') || '[]');
    setPendingSyncCount(queue.length);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Process Offline Queue
  const processQueue = useCallback(async () => {
    if (!navigator.onLine) return;

    const queue = JSON.parse(localStorage.getItem('item_queue') || '[]');
    if (queue.length === 0) return;

    console.log(`Processing ${queue.length} offline items...`);

    const failedItems: unknown[] = [];

    for (const item of queue) {
      try {
        const itemTyped = item as { table: string; action: string; data: Record<string, unknown>; id: string };
        const table = itemTyped.table;
        const action = itemTyped.action;
        const data = itemTyped.data;
        const id = itemTyped.id;

        // Remove internal flags before sending
        const { ...dbData } = data;

        if (action === 'CREATE') {
          const { error } = await supabase.from(table).insert(dbData);
          if (error) throw error;
        } else if (action === 'UPDATE') {
          const { error } = await supabase.from(table).update(dbData).eq('id', id);
          if (error) throw error;
        } else if (action === 'DELETE') {
          const { error } = await supabase.from(table).delete().eq('id', id);
          if (error) throw error;
        }
      } catch (err) {
        console.error('Sync failed for item', item, err);
        failedItems.push(item);
      }
    }

    localStorage.setItem('item_queue', JSON.stringify(failedItems));
    setPendingSyncCount(failedItems.length);

    if (failedItems.length === 0 && queue.length > 0) {
      toast.success('Sinkronisasi data berhasil!');
    } else if (failedItems.length > 0) {
      toast.error(`Gagal menyinkronkan ${failedItems.length} data.`);
    }
  }, []);

  // Trigger Sync when Online
  useEffect(() => {
    if (isOnline) {
      processQueue();
    }
  }, [isOnline, processQueue]);

  // Helper for realtime updates
  const handleRealtimeUpdate = useCallback(<T extends { id: string }>(prev: T[], event: string, newItem: T, oldItem: T) => {
    // Safety check
    if (!prev) prev = [];

    if (event === 'INSERT') {
      if (!newItem || !newItem.id) {
        console.warn('Realtime INSERT received invalid item:', newItem);
        return prev;
      }
      // Avoid duplicates
      if (prev.some(p => p.id === newItem.id)) return prev;
      return [newItem, ...prev];
    }

    if (event === 'UPDATE') {
      if (!newItem || !newItem.id) return prev;
      return prev.map(item => item.id === newItem.id ? newItem : item);
    }

    if (event === 'DELETE') {
      if (!oldItem || !oldItem.id) return prev;
      return prev.filter(item => item.id !== oldItem.id);
    }
    return prev;
  }, []);

  // Realtime Subscription
  useEffect(() => {
    console.log('Setting up Realtime Subscription...');
    const changes = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        console.log('Realtime Change Received:', payload);
        const { table, eventType, new: newRecord, old: oldRecord } = payload;

        const updateLocalState = (tableName: string, newItem: unknown, oldItem: unknown) => {
          const camelNew = newItem ? toCamelCase(newItem) : null;
          // For DELETE, oldItem usually only has ID in 'old' property if replica identity is small
          const safeOld = oldItem || {};

          switch (tableName) {
            case 'notifikasi':
              console.log('Updating notifikasi state from realtime...');
              setNotifikasi(prev => handleRealtimeUpdate(prev, eventType, camelNew, safeOld));

              // Show Toast or System Notification for new notifications (logic simplified for brevity)
              if (eventType === 'INSERT' && camelNew && (camelNew as any).userId === currentUser?.id) {
                const n = camelNew as Notifikasi;
                const toastType = n.jenis === 'error' ? 'error' :
                  n.jenis === 'success' ? 'success' :
                    n.jenis === 'warning' ? 'warning' : 'info';

                toast[toastType](n.pesan || 'Notification', {
                  description: n.judul,
                  duration: 5000,
                });
              }
              break;
            case 'persetujuan': setPersetujuan(prev => handleRealtimeUpdate(prev, eventType, camelNew, safeOld)); break;
            case 'penjualan': setPenjualan(prev => handleRealtimeUpdate(prev, eventType, camelNew, safeOld)); break;
            case 'absensi': setAbsensi(prev => handleRealtimeUpdate(prev, eventType, camelNew, safeOld)); break;
            case 'stok_pengguna': setStokPengguna(prev => handleRealtimeUpdate(prev, eventType, camelNew, safeOld)); break;
            case 'barang': setBarang(prev => handleRealtimeUpdate(prev, eventType, camelNew, safeOld)); break;
            case 'profil_perusahaan':
              if (camelNew) {
                setProfilPerusahaan(camelNew as ProfilPerusahaan);
              }
              break;
          }
        };

        updateLocalState(table, newRecord, oldRecord);
      })
      .subscribe((status) => {
        console.log(`Realtime Subscription Status: ${status}`);
      });

    return () => {
      console.log('Cleaning up Realtime Subscription...');
      supabase.removeChannel(changes);
    };
  }, [currentUser, handleRealtimeUpdate]);

  // Generic fetch function
  const fetchData = useCallback(async <T,>(tableName: string, daysToFetch: number = 30): Promise<T[]> => {
    try {
      let sortColumn = 'created_at';
      let dateFilterColumn: string | null = null;

      // Handle tables with different timestamp column names
      if (tableName === 'notifikasi') {
        sortColumn = 'tanggal';
        dateFilterColumn = 'tanggal';
      } else if (tableName === 'persetujuan') {
        sortColumn = 'tanggal_pengajuan';
        dateFilterColumn = 'tanggal_pengajuan';
      } else if (['penjualan', 'setoran', 'absensi', 'mutasi_barang', 'permintaan_barang', 'penyesuaian_stok', 'reimburse', 'petty_cash'].includes(tableName)) {
        dateFilterColumn = 'tanggal';
        if (tableName === 'penjualan' || tableName === 'setoran' || tableName === 'absensi' || tableName === 'reimburse' || tableName === 'petty_cash') {
          sortColumn = 'tanggal';
        }
      }

      let query = supabase
        .from(tableName)
        .select('*')
        .order(sortColumn, { ascending: false });

      // Apply daysToFetch limit for high-volume transaction tables
      if (dateFilterColumn) {
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - daysToFetch);
        // Set to beginning of that day to be safe
        limitDate.setHours(0, 0, 0, 0);

        query = query.gte(dateFilterColumn, limitDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const result = toCamelCase(data || []) as T[];
      if (tableName === 'absensi' || tableName === 'penjualan') {
        console.log(`fetchData [${tableName}]: Loaded ${result.length} records (Last ${daysToFetch} Days).`);
      }
      return result;
    } catch (error) {
      console.error(`Error fetching ${tableName}:`, error);
      return [];
    }
  }, []);

  // Load all data
  const loadAllData = useCallback(async (isManualRefresh = false) => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      // 1. Fetch Company Profile FIRST to get settings (daysToFetch)
      let daysLimit = 30; // Default
      try {
        const { data: profileData } = await supabase
          .from('profil_perusahaan')
          .select('*')
          .limit(1)
          .single();

        if (profileData) {
          const profile = toCamelCase(profileData) as ProfilPerusahaan;
          setProfilPerusahaan(profile);

          if (profile.config && profile.config.daysToFetch) {
            daysLimit = profile.config.daysToFetch;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch company profile', err);
      }

      console.log(`Loading data with retention limit: ${daysLimit} days`);

      // Helper to safely fetch data without throwing
      const safeFetch = async <T,>(tableName: string, daysToFetch: number = 30): Promise<T[]> => {
        try {
          return await fetchData<T>(tableName, daysToFetch);
        } catch (err) {
          console.warn(`Failed to fetch ${tableName}, returning empty array.`, err);
          return [];
        }
      };

      // Load master data in parallel
      const results = await Promise.allSettled([
        safeFetch<Kategori>('kategori'),
        safeFetch<Satuan>('satuan'),
        safeFetch<KategoriPelanggan>('kategori_pelanggan'),
        safeFetch<RekeningBank>('rekening_bank'),
        safeFetch<Area>('area'),
        safeFetch<Cabang>('cabang'),
        safeFetch<Barang>('barang'),
        safeFetch<Pelanggan>('pelanggan'),
        safeFetch<User>('users'),
        safeFetch<Karyawan>('karyawan'),
        safeFetch<Penjualan>('penjualan', daysLimit),
        safeFetch<Setoran>('setoran', daysLimit),
        safeFetch<Absensi>('absensi', daysLimit),
        safeFetch<Notifikasi>('notifikasi', daysLimit),
        safeFetch<Persetujuan>('persetujuan', daysLimit),
        safeFetch<Harga>('harga'),
        safeFetch<StokPengguna>('stok_pengguna'),
        safeFetch<Promo>('promo'),
        safeFetch<MutasiBarang>('mutasi_barang', daysLimit),
        safeFetch<SaldoPengguna>('saldo_pengguna'),
        safeFetch<Reimburse>('reimburse', daysLimit),
        safeFetch<PettyCash>('petty_cash', daysLimit),
        safeFetch<Restock>('restock', daysLimit),
      ]);

      // Extract results
      const getResult = <T,>(index: number): T[] => {
        const result = results[index];
        return result.status === 'fulfilled' ? (result.value as T[]) : [];
      };

      setKategori(getResult<Kategori>(0));
      setSatuan(getResult<Satuan>(1));
      setKategoriPelanggan(getResult<KategoriPelanggan>(2));
      setRekeningBank(getResult<RekeningBank>(3));
      setArea(getResult<Area>(4));
      setCabang(getResult<Cabang>(5));
      setBarang(getResult<Barang>(6));
      setPelanggan(getResult<Pelanggan>(7));
      setUsers(getResult<User>(8));
      setKaryawan(getResult<Karyawan>(9));
      setPenjualan(getResult<Penjualan>(10));
      setSetoran(getResult<Setoran>(11));
      setAbsensi(getResult<Absensi>(12));
      setNotifikasi(getResult<Notifikasi>(13));
      setPersetujuan(getResult<Persetujuan>(14));
      setHarga(getResult<Harga>(15));
      setStokPengguna(getResult<StokPengguna>(16));
      setPromo(getResult<Promo>(17));
      setMutasiBarang(getResult<MutasiBarang>(18));
      setSaldoPengguna(getResult<SaldoPengguna>(19));

      setReimburse(getResult<Reimburse>(20));
      const loadedPettyCash = getResult<PettyCash>(21);
      setPettyCash(loadedPettyCash);
      if (loadedPettyCash && loadedPettyCash.length > 0) {
        setPettyCashBalance(loadedPettyCash[0].saldoAkhir);
      } else {
        setPettyCashBalance(0);
      }
      setRestock(getResult<Restock>(22));

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      if (isManualRefresh) {
        setTimeout(() => setIsRefreshing(false), 1000);
      } else {
        setIsLoading(false);
      }
    }
  }, [currentUser, fetchData]);

  // Load data when user changes
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Generic CRUD functions
  const createItem = useCallback(async <T,>(tableName: string, item: Record<string, unknown>, setter: React.Dispatch<React.SetStateAction<T[]>>): Promise<T> => {
    try {
      const dbItem = toSnakeCase(item) as Record<string, unknown>;

      const excludeAuditColumns = ['karyawan', 'area', 'cabang', 'kategori', 'satuan', 'rekening_bank', 'kategori_pelanggan', 'peran', 'persetujuan', 'users', 'harga', 'notifikasi', 'stok_pengguna', 'absensi', 'saldo_pengguna', 'reimburse', 'petty_cash', 'permintaan_barang', 'penyesuaian_stok'];

      if (currentUser && !excludeAuditColumns.includes(tableName)) {
        dbItem.created_by = currentUser.id;
        dbItem.updated_by = currentUser.id;
      }

      // Check Offline
      if (!isOnline) {
        const tempId = crypto.randomUUID();
        const offlineItem = { ...dbItem, id: tempId };

        const queueItem = {
          table: tableName,
          action: 'CREATE',
          data: offlineItem,
          id: tempId,
          timestamp: Date.now()
        };

        const currentQueue = JSON.parse(localStorage.getItem('item_queue') || '[]');
        localStorage.setItem('item_queue', JSON.stringify([...currentQueue, queueItem]));
        setPendingSyncCount(prev => prev + 1);

        const newItem = toCamelCase(offlineItem) as T;
        setter((prev) => [newItem, ...prev]);
        toast.info('Disimpan offline (akan disinkronkan saat online)');
        return newItem;
      }

      if (!dbItem.id) {
        delete dbItem.id;
      }

      // Clean empty strings for UUID columns (PostgreSQL rejects "" for uuid)
      const uuidColumns = ['referensi_id', 'diajukan_oleh', 'disetujui_oleh', 'target_cabang_id', 'target_user_id', 'cabang_id', 'user_id', 'sales_id', 'pelanggan_id', 'barang_id', 'satuan_id', 'kategori_id', 'rekening_bank_id', 'karyawan_id', 'area_id', 'dari_cabang_id', 'ke_cabang_id', 'user_account_id', 'penjualan_id'];
      Object.keys(dbItem).forEach(key => {
        if (uuidColumns.includes(key) && dbItem[key] === '') {
          dbItem[key] = null;
        }
      });

      const { data, error } = await supabase
        .from(tableName)
        .insert(dbItem)
        .select()
        .single();

      if (error) throw error;

      const newItem = toCamelCase(data) as T;
      setter((prev) => [newItem, ...prev]);
      return newItem;
    } catch (error) {
      console.error(`Error creating ${tableName}:`, error);
      throw error;
    }
  }, [currentUser, isOnline]);

  const updateItem = useCallback(async <T,>(tableName: string, id: string, item: Record<string, unknown>, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
    try {
      const dbItem = toSnakeCase(item) as Record<string, unknown>;

      const excludeAuditColumns = ['karyawan', 'area', 'cabang', 'kategori', 'satuan', 'rekening_bank', 'kategori_pelanggan', 'peran', 'persetujuan', 'users', 'harga', 'notifikasi', 'stok_pengguna', 'absensi', 'saldo_pengguna', 'permintaan_barang', 'penyesuaian_stok'];

      if (currentUser && !excludeAuditColumns.includes(tableName)) {
        dbItem.updated_by = currentUser.id;
      }

      // Check Offline
      if (!isOnline) {
        const queueItem = {
          table: tableName,
          action: 'UPDATE',
          data: dbItem,
          id: id,
          timestamp: Date.now()
        };

        const currentQueue = JSON.parse(localStorage.getItem('item_queue') || '[]');
        localStorage.setItem('item_queue', JSON.stringify([...currentQueue, queueItem]));
        setPendingSyncCount(prev => prev + 1);

        setter((prev) => prev.map((p) => {
          if ((p as { id: string }).id === id) {
            return { ...p, ...(toCamelCase(item) as any) };
          }
          return p;
        }));
        toast.info('Perubahan disimpan offline');
        return;
      }

      // Clean empty strings for UUID columns (PostgreSQL rejects "" for uuid)
      const uuidColumns = ['referensi_id', 'diajukan_oleh', 'disetujui_oleh', 'target_cabang_id', 'target_user_id', 'cabang_id', 'user_id', 'sales_id', 'pelanggan_id', 'barang_id', 'satuan_id', 'kategori_id', 'rekening_bank_id', 'karyawan_id', 'area_id', 'dari_cabang_id', 'ke_cabang_id', 'user_account_id', 'penjualan_id'];
      Object.keys(dbItem).forEach(key => {
        if (uuidColumns.includes(key) && dbItem[key] === '') {
          dbItem[key] = null;
        }
      });

      const { data, error } = await supabase
        .from(tableName)
        .update(dbItem)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const updatedItem = toCamelCase(data) as T;
      setter((prev) => prev.map((p) => ((p as { id: string }).id === id ? updatedItem : p)));
    } catch (error) {
      console.error(`Error updating ${tableName}:`, error);
      throw error;
    }
  }, [currentUser, isOnline]);

  const deleteItem = useCallback(async <T,>(tableName: string, id: string, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
    try {
      // Check Offline
      if (!isOnline) {
        const queueItem = {
          table: tableName,
          action: 'DELETE',
          data: {},
          id: id,
          timestamp: Date.now()
        };

        const currentQueue = JSON.parse(localStorage.getItem('item_queue') || '[]');
        localStorage.setItem('item_queue', JSON.stringify([...currentQueue, queueItem]));
        setPendingSyncCount(prev => prev + 1);

        setter((prev) => prev.filter((p) => (p as { id: string }).id !== id));
        toast.info('Dihapus (offline)');
        return;
      }

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;

      setter((prev) => prev.filter((p) => (p as { id: string }).id !== id));
    } catch (error) {
      console.error(`Error deleting ${tableName}:`, error);
      throw error;
    }
  }, [isOnline]);

  // Implement CRUD for all entities

  // Auto-checkout for previous days
  useEffect(() => {
    if (!currentUser || absensi.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const staleAbsensi = absensi.filter(a => {
      const absensiDate = new Date(a.tanggal);
      absensiDate.setHours(0, 0, 0, 0);
      return a.userId === currentUser.id &&
        !a.checkOut &&
        absensiDate.getTime() < today.getTime();
    });

    if (staleAbsensi.length > 0) {
      console.log(`Found ${staleAbsensi.length} stale absensi records. Auto-checking out...`);
      staleAbsensi.forEach(async (item) => {
        const autoOutTime = new Date(item.tanggal);
        autoOutTime.setHours(23, 59, 59);
        try {
          await updateItem('absensi', item.id, {
            checkOut: autoOutTime,
          }, setAbsensi);
          toast.success(`Absensi tanggal ${new Date(item.tanggal).toLocaleDateString('id-ID')} otomatis di-checkout.`);
        } catch (e) {
          console.error("Auto checkout failed", e);
        }
      });
    }
  }, [absensi, currentUser, updateItem]);

  const isAdminOrOwner = currentUser?.roles.includes('admin') || currentUser?.roles.includes('owner');

  const value: DatabaseContextType = {
    // State
    kategori,
    satuan,
    kategoriPelanggan,
    rekeningBank,
    area,
    cabang,
    barang,
    harga,
    stokPengguna,
    saldoPengguna,
    pelanggan,
    users,
    karyawan,
    penjualan,
    setoran,
    absensi,
    permintaanBarang,
    mutasiBarang,
    promo,
    penyesuaianStok,
    notifikasi,
    persetujuan,
    profilPerusahaan,
    // Reimbursement & Petty Cash
    reimburse,
    pettyCash,
    pettyCashBalance,
    isLoading,
    isRefreshing,
    setIsLoading,
    viewMode,
    setViewMode,
    pendingSyncCount,
    isAdminOrOwner,
    refresh: () => loadAllData(true),
    repairUser: async () => {
      // No-op or refresh implementation
      await loadAllData(true);
    },

    // Kategori
    addKategori: (item) => createItem('kategori', item, setKategori),
    updateKategori: (id, item) => updateItem('kategori', id, item, setKategori),
    deleteKategori: (id) => deleteItem('kategori', id, setKategori),

    // Satuan
    addSatuan: (item) => createItem('satuan', item, setSatuan),
    updateSatuan: (id, item) => updateItem('satuan', id, item, setSatuan),
    deleteSatuan: (id) => deleteItem('satuan', id, setSatuan),

    // Kategori Pelanggan
    addKategoriPelanggan: (item) => createItem('kategori_pelanggan', item, setKategoriPelanggan),
    updateKategoriPelanggan: (id, item) => updateItem('kategori_pelanggan', id, item, setKategoriPelanggan),
    deleteKategoriPelanggan: (id) => deleteItem('kategori_pelanggan', id, setKategoriPelanggan),

    // Rekening Bank
    addRekeningBank: (item) => createItem('rekening_bank', item, setRekeningBank),
    updateRekeningBank: (id, item) => updateItem('rekening_bank', id, item, setRekeningBank),
    deleteRekeningBank: (id) => deleteItem('rekening_bank', id, setRekeningBank),

    // Area
    addArea: (item) => createItem('area', item, setArea),
    updateArea: (id, item) => updateItem('area', id, item, setArea),
    deleteArea: (id) => deleteItem('area', id, setArea),

    // Cabang
    addCabang: (item) => createItem('cabang', item, setCabang),
    updateCabang: (id, item) => updateItem('cabang', id, item, setCabang),
    deleteCabang: (id) => deleteItem('cabang', id, setCabang),

    // Barang
    addBarang: (item) => createItem('barang', item, setBarang),
    updateBarang: (id, item) => updateItem('barang', id, item, setBarang),
    deleteBarang: (id) => deleteItem('barang', id, setBarang),

    // Pelanggan
    addPelanggan: (item) => createItem('pelanggan', item, setPelanggan),
    updatePelanggan: (id, item) => updateItem('pelanggan', id, item, setPelanggan),
    deletePelanggan: (id) => deleteItem('pelanggan', id, setPelanggan),

    // Penjualan
    addPenjualan: async (item) => {
      try {
        const newItem = await createItem('penjualan', item, setPenjualan);

        // Side Effect: Deduct Stock
        if (item.items && Array.isArray(item.items)) {
          const salesmanId = item.salesId || currentUser?.id;
          if (!salesmanId) {
            console.warn("No salesman ID for stock deduction");
            return newItem;
          }

          const stockCache = new Map<string, number>();

          for (const soldItem of item.items) {
            let currentStock = 0;
            let stockId = '';

            if (stockCache.has(soldItem.barangId)) {
              currentStock = stockCache.get(soldItem.barangId)!;
              const stockRecord = stokPengguna.find(s => s.barangId === soldItem.barangId && s.userId === salesmanId);
              stockId = stockRecord?.id || '';
            } else {
              const stockRecord = stokPengguna.find(s => s.barangId === soldItem.barangId && s.userId === salesmanId);
              if (stockRecord) {
                currentStock = stockRecord.jumlah;
                stockId = stockRecord.id;
              }
            }

            if (stockId) {
              const deduction = soldItem.jumlah * (soldItem.konversi || 1);
              const newStock = currentStock - deduction;
              stockCache.set(soldItem.barangId, newStock);
              await updateItem('stok_pengguna', stockId, { jumlah: newStock }, setStokPengguna);
            } else {
              console.warn(`No stock record found for product ${soldItem.barangId} user ${salesmanId}`);
            }
          }
        }
        return newItem;
      } catch (error) {
        console.error("Error in addPenjualan:", error);
        throw error;
      }
    },
    updatePenjualan: (id, item) => updateItem('penjualan', id, item, setPenjualan),
    deletePenjualan: (id) => deleteItem('penjualan', id, setPenjualan),

    // Setoran
    addSetoran: (item) => createItem('setoran', item, setSetoran),
    updateSetoran: (id, item) => updateItem('setoran', id, item, setSetoran),
    deleteSetoran: (id) => deleteItem('setoran', id, setSetoran),

    // Absensi
    addAbsensi: async (item) => {
      try {
        const dbItem = toSnakeCase(item) as Record<string, unknown>;

        if (!isOnline) {
          const tempId = crypto.randomUUID();
          const offlineItem = { ...dbItem, id: tempId };

          const queueItem = {
            table: 'absensi',
            action: 'CREATE',
            data: offlineItem,
            id: tempId,
            timestamp: Date.now()
          };

          const currentQueue = JSON.parse(localStorage.getItem('item_queue') || '[]');
          localStorage.setItem('item_queue', JSON.stringify([...currentQueue, queueItem]));
          setPendingSyncCount(prev => prev + 1);

          const newItem = toCamelCase(offlineItem) as Absensi;
          setAbsensi((prev) => {
            const next = [newItem, ...prev];
            localStorage.setItem('cache_absensi', JSON.stringify(next));
            return next;
          });
          toast.info('Check-in disimpan offline');
          return newItem;
        }

        delete dbItem.id;

        const { data, error } = await supabase
          .from('absensi')
          .insert(dbItem)
          .select()
          .single();

        if (error) throw error;

        const newItem = toCamelCase(data) as Absensi;
        setAbsensi((prev) => {
          const filtered = prev.filter(p => p.id !== newItem.id);
          const next = [newItem, ...filtered];
          localStorage.setItem('cache_absensi', JSON.stringify(next));
          return next;
        });

        await loadAllData();
        return newItem;
      } catch (error) {
        console.error(`Error creating absensi:`, error);
        throw error;
      }
    },
    updateAbsensi: (id, item) => updateItem('absensi', id, item, setAbsensi),
    deleteAbsensi: (id) => deleteItem('absensi', id, setAbsensi),

    // Karyawan
    addKaryawan: (item) => createItem('karyawan', item, setKaryawan),
    updateKaryawan: (id, item) => updateItem('karyawan', id, item, setKaryawan),
    deleteKaryawan: (id) => deleteItem('karyawan', id, setKaryawan),

    // Users
    addUser: (item) => {
      const userItem = { ...item, roles: item.roles || ['staff'] };
      return createItem('users', userItem, setUsers);
    },
    updateUser: (id, item) => updateItem('users', id, item, setUsers),
    deleteUser: (id) => deleteItem('users', id, setUsers),

    // Notifikasi
    addNotifikasi: (item) => createItem('notifikasi', item, setNotifikasi),
    updateNotifikasi: (id, item) => updateItem('notifikasi', id, item, setNotifikasi),
    deleteNotifikasi: (id) => deleteItem('notifikasi', id, setNotifikasi),
    markNotifikasiRead: async (id) => {
      await updateItem('notifikasi', id, { dibaca: true }, setNotifikasi);
    },
    markAllNotifikasiRead: async () => {
      if (!currentUser) return;
      const unread = notifikasi.filter(n => n.userId === currentUser.id && !n.dibaca);
      await Promise.all(unread.map(n => updateItem('notifikasi', n.id, { dibaca: true }, setNotifikasi)));
    },

    // Persetujuan
    addPersetujuan: (item) => createItem('persetujuan', item, setPersetujuan),
    updatePersetujuan: (id, item) => updateItem('persetujuan', id, item, setPersetujuan),
    deletePersetujuan: (id) => deleteItem('persetujuan', id, setPersetujuan),

    // Harga Khusus
    addHarga: (item) => createItem('harga', item, setHarga),
    updateHarga: (id, item) => updateItem('harga', id, item, setHarga),
    deleteHarga: (id) => deleteItem('harga', id, setHarga),

    // Profil Perusahaan
    updateProfilPerusahaan: async (item) => {
      try {
        const dbItem = toSnakeCase(item) as Record<string, unknown>;
        if (currentUser) {
          dbItem.updated_by = currentUser.id;
        }

        const { data: existing } = await supabase
          .from('profil_perusahaan')
          .select('id')
          .limit(1)
          .single();

        // This is where setProfil errors might occur if types aren't matched
        // Assuming setProfilPerusahaan is strictly typed as React.Dispatch<React.SetStateAction<ProfilPerusahaan>>

        let result: ProfilPerusahaan;

        if (existing) {
          const { data, error } = await supabase
            .from('profil_perusahaan')
            .update(dbItem)
            .eq('id', existing.id)
            .select()
            .single();

          if (error) throw error;
          result = toCamelCase(data) as ProfilPerusahaan;
        } else {
          const { data, error } = await supabase
            .from('profil_perusahaan')
            .insert(dbItem)
            .select()
            .single();

          if (error) throw error;
          result = toCamelCase(data) as ProfilPerusahaan;
        }

        setProfilPerusahaan(result);
        return result;

      } catch (error) {
        console.error('Error updating company profile:', error);
        throw error;
      }
    },

    // REIMBURSE
    addReimburse: (item) => createItem('reimburse', item, setReimburse),
    updateReimburse: (id, item) => updateItem('reimburse', id, item, setReimburse),
    deleteReimburse: (id) => deleteItem('reimburse', id, setReimburse),

    // PETTY CASH
    addPettyCash: async (item) => {
      try {
        // Calculate new balance
        const isExpenses = item.jenis === 'pengeluaran';
        const amount = item.jumlah || 0;
        const newBalance = isExpenses
          ? pettyCashBalance - amount
          : pettyCashBalance + amount;

        const newItemData = { ...item, saldo_akhir: newBalance };
        const newItem = await createItem('petty_cash', newItemData, setPettyCash);

        // Start sync of balance immediately
        setPettyCashBalance(newBalance);
        return newItem;
      } catch (e) {
        console.error("Failed add petty cash", e);
        throw e;
      }
    },
    updatePettyCash: (id, item) => updateItem('petty_cash', id, item, setPettyCash),
    deletePettyCash: (id) => deleteItem('petty_cash', id, setPettyCash),

    // Stok Pengguna
    addStokPengguna: async (item) => {
      try {
        const dbItem = toSnakeCase(item) as Record<string, unknown>;
        // Perform an upsert that will ignore if there's an exact race condition insert,
        // or overwrite it. In our case, useApprovalAction calculates the full new sum
        // so overwriting with the calculated sum is correct.
        const { data, error } = await supabase
          .from('stok_pengguna')
          .upsert(dbItem, { onConflict: 'user_id,barang_id' })
          .select()
          .single();
        if (error) throw error;
        const inserted = toCamelCase(data) as StokPengguna;
        setStokPengguna(prev => {
          const exists = prev.some(p => p.id === inserted.id);
          return exists ? prev.map(p => p.id === inserted.id ? inserted : p) : [...prev, inserted];
        });
        return inserted;
      } catch (error) {
        console.error('Error adding/upserting stok_pengguna:', error);
        throw error;
      }
    },
    updateStokPengguna: (id, item) => updateItem('stok_pengguna', id, item, setStokPengguna),
    deleteStokPengguna: (id) => deleteItem('stok_pengguna', id, setStokPengguna),

    // Promo
    addPromo: (item) => createItem('promo', item, setPromo),
    updatePromo: (id, item) => updateItem('promo', id, item, setPromo),
    deletePromo: (id) => deleteItem('promo', id, setPromo),

    // Mutasi
    addMutasiBarang: (item) => createItem('mutasi_barang', item, setMutasiBarang),
    updateMutasiBarang: (id, item) => updateItem('mutasi_barang', id, item, setMutasiBarang),
    deleteMutasiBarang: (id) => deleteItem('mutasi_barang', id, setMutasiBarang),

    // Saldo
    addSaldoPengguna: (item) => createItem('saldo_pengguna', item, setSaldoPengguna),
    updateSaldoPengguna: (id, item) => updateItem('saldo_pengguna', id, item, setSaldoPengguna),
    deleteSaldoPengguna: (id) => deleteItem('saldo_pengguna', id, setSaldoPengguna),

    // NEW METHODS ADDED FOR MISSING PROPERTIES IN CONTEXT
    // Penyesuaian Stok
    addPenyesuaianStok: (item) => createItem('penyesuaian_stok', item, setPenyesuaianStok),
    updatePenyesuaianStok: (id, item) => updateItem('penyesuaian_stok', id, item, setPenyesuaianStok),
    deletePenyesuaianStok: (id) => deleteItem('penyesuaian_stok', id, setPenyesuaianStok),

    // Permintaan Barang
    addPermintaanBarang: (item) => createItem('permintaan_barang', item, setPermintaanBarang),
    updatePermintaanBarang: (id, item) => updateItem('permintaan_barang', id, item, setPermintaanBarang),
    deletePermintaanBarang: (id) => deleteItem('permintaan_barang', id, setPermintaanBarang),

    // Pembayaran Penjualan
    addPembayaranPenjualan: async (item) => {
      const newItem = await createItem<PembayaranPenjualan>('pembayaran_penjualan', item, () => { });
      // Optionally refresh penjualan to update payment status
      await loadAllData(true);
      return newItem;
    },

    // Restock
    restock,
    addRestock: (item) => createItem('restock', item, setRestock),
    updateRestock: (id, item) => updateItem('restock', id, item, setRestock),
    deleteRestock: (id) => deleteItem('restock', id, setRestock),
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}
