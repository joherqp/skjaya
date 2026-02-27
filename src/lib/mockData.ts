import { User, Cabang, Barang, Pelanggan, Penjualan, Setoran, Absensi, Notifikasi, Kategori, Satuan, RekeningBank, KategoriPelanggan, Persetujuan, TimeStamps } from './types';

const defaultAudit: TimeStamps = {
  createdAt: new Date('2024-01-01'),
  createdBy: 'system',
  updatedAt: new Date('2024-01-01'),
  updatedBy: 'system'
};

// Cabang (Branches) - BOOTSTRAP DATA ONLY
export const cabangData: Cabang[] = [
  { id: 'cab-pusat', nama: 'Pusat (Head Office)', alamat: 'Jl. Sudirman No. 1', kota: 'Jakarta', telepon: '021-1234567' },
];

// Users - BOOTSTRAP DATA ONLY
export const usersData: User[] = [
  // Bootstrap Admin
  {
    id: 'usr-admin',
    username: 'admin',
    nama: 'Administrator',
    email: 'admin@cvskj.com',
    telepon: '081234567890',
    roles: ['admin'],
    cabangId: 'cab-pusat',
    isActive: true,
    createdAt: new Date('2024-01-01'),
  },
];

// Kategori
export const kategoriData: Kategori[] = [];

// Satuan
export const satuanData: Satuan[] = [];

// Barang
export const barangData: Barang[] = [];

// Kategori Pelanggan
export const kategoriPelangganData: KategoriPelanggan[] = [];

// Area / Territory
export const areaData = [];

// Peran / Roles
export const peranData = [];

// User Accounts


// Karyawan / Employees
export const karyawanData = [];

// Pelanggan
export const pelangganData: Pelanggan[] = [];

// Rekening Bank
export const rekeningData: RekeningBank[] = [];

// Penjualan
export const penjualanData: Penjualan[] = [];

// Setoran
export const setoranData: Setoran[] = [];

// Absensi
export const absensiData: Absensi[] = [];

// Notifikasi
export const notifikasiData: Notifikasi[] = [];

// Persetujuan
export const persetujuanData: Persetujuan[] = [];

// Helper functions to get data
export const getUserById = (id: string) => usersData.find(u => u.id === id);
export const getCabangById = (id: string) => cabangData.find(c => c.id === id);
export const getBarangById = (id: string) => barangData.find(b => b.id === id);
export const getPelangganById = (id: string) => pelangganData.find(p => p.id === id);
export const getKategoriById = (id: string) => kategoriData.find(k => k.id === id);
export const getSatuanById = (id: string) => satuanData.find(s => s.id === id);
export const getRekeningById = (id: string) => rekeningData.find(r => r.id === id);
export const getKategoriPelangganById = (id: string) => kategoriPelangganData.find(k => k.id === id);

// Format currency
export const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Compact format currency (e.g. 1.5 Jt)
export const formatCompactRupiah = (amount: number): string => {
  if (amount >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} Miliar`;
  }
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} Juta`;
  }
  if (amount >= 1_000) {
    return `Rp ${(amount / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} Rb`;
  }
  return formatRupiah(amount);
};

// Format date
export const formatTanggal = (date: Date | string | undefined): string => {
  const d = date instanceof Date ? date : new Date(date as string);
  if (isNaN(d.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
};

export const formatWaktu = (date: Date): string => {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};
