// User and Auth Types
export type UserRole = 'admin' | 'owner' | 'gudang' | 'leader' | 'sales' | 'staff' | 'finance' | 'driver';
export type ViewMode = 'all' | 'self';

export interface User {
  id: string;
  username: string;
  nama: string;
  email: string;
  telepon: string;
  roles: UserRole[];
  cabangId: string;
  karyawanId?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: Date;
  startDate?: Date;
  endDate?: Date;
}

export interface TimeStamps {
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

export interface Cabang {
  id: string;
  nama: string;
  alamat: string;
  kota: string;
  telepon: string;
  areaId?: string;
  koordinat?: string; // Format: "lat, lng"
}

// Attendance Types
export interface Absensi {
  id: string;
  userId: string;
  tanggal: Date;
  checkIn?: Date;
  checkOut?: Date;
  lokasiCheckIn?: Lokasi;
  lokasiCheckOut?: Lokasi;
  status: 'hadir' | 'izin' | 'sakit' | 'alpha';
  fotoCheckIn?: string;
  fotoCheckOut?: string;
  keterangan?: string;
}

export interface Lokasi {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  alamat?: string;
}

// Product Types
export interface Kategori {
  id: string;
  nama: string;
  deskripsi?: string;
}

export interface Satuan {
  id: string;
  nama: string;
  simbol: string;
}

export interface Barang {
  id: string;
  nama: string;
  kode?: string;
  kategoriId: string;
  satuanId: string;
  hargaBeli: number;
  hargaJual: number;
  foto?: string;
  deskripsi?: string;
  minStok?: number;
  isActive?: boolean;
  multiSatuan?: { satuanId: string; konversi: number }[];
  gambarUrl?: string; // Some parts of the app use this instead of 'foto'
  stok?: number;
}

// Customer Types
export interface KategoriPelanggan {
  id: string;
  nama: string;
  diskon?: number;
  programDiskon?: Record<string, unknown>; // JSONB
}

export interface Pelanggan {
  id: string;
  kode: string;
  nama: string;
  alamat?: string;
  telepon?: string;
  kategoriId: string;
  areaId: string;
  limitKredit?: number;
  sisaHutang: number;
  kunjunganRutin?: string[]; // Hari kunjungan
  sisaKredit?: number; // Some parts use this synonymously with buyer power
  noRekening?: string;
  namaBank?: string;
  namaPemilik?: string;
  email?: string;
  lokasi?: Lokasi;
  salesId?: string;
  cabangId?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Area {
  id: string;
  nama: string;
  cabangId?: string;
  kota?: string;
}

export interface RekeningBank {
  id: string;
  namaBank: string;
  nomorRekening: string;
  namaPemilik: string;
  cabang?: string;
  atasNama?: string;
  isTunai?: boolean;
  assignedUserId?: string;
}

// Sales Types
export interface Penjualan {
  id: string;
  transaksi: string;
  tanggal: Date;
  pelangganId: string;
  salesId: string;
  divisiId?: string; // For syncing with Google Sheet logic
  status: 'draft' | 'pending' | 'lunas' | 'batal';
  total: number;
  dibayar: number;
  sisa: number;
  metodePembayaran: 'tunai' | 'transfer' | 'tempo';
  bayar?: number;
  kembalian?: number;
  // Tempo
  jatuhTempo?: Date;
  isLunas?: boolean;
  tanggalPelunasan?: Date;
  lokasi?: Lokasi;
  updatedAt?: Date;
  updatedBy?: string;
  createdAt?: Date;
  createdBy?: string;
  keterangan?: string;
  catatan?: string;
  nomorNota?: string;
  cabangId?: string;
  items: PenjualanItem[];
  buktiPembayaran?: string;
  subtotal?: number;
  persetujuanId?: string; // FK to persetujuan for bidirectional sync (for pembatalan)
}

export interface PembayaranPenjualan {
  id: string;
  penjualanId: string;
  tanggal: Date;
  jumlah: number;
  metodePembayaran: string;
  lokasi?: Lokasi;
  catatan?: string;
  createdBy?: string;
}

export interface PenjualanItem {
  id: string;
  barangId: string;
  jumlah: number;
  satuanId: string; // Unit at time of sale
  harga: number; // Price per unit at time of sale
  diskon?: number; // Diskon (%)
  subtotal: number;
  konversi?: number; // Konversi ke satuan dasar jika ada
  isBonus?: boolean;
  totalQty?: number;
  promoId?: string;
}

// Deposit/Setoran Types
export interface Setoran {
  id: string;
  tanggal: Date;
  userId: string;
  jumlah: number;
  rekeningBankId?: string;
  buktiTransfer?: string;
  status: 'pending' | 'diterima' | 'ditolak' | 'disetujui';
  keterangan?: string;
  salesId?: string; // Used in monitoring
  bank?: RekeningBank; // Joined
  // Additional properties
  rekeningId?: string; // Alias
  nomorSetoran?: string;
  buktiUrl?: string;
  disetujuiOleh?: string;
  cabangId?: string;
  createdAt?: Date;
  createdBy?: string;
  updatedBy?: string;
  catatan?: string;
  persetujuanId?: string; // FK to persetujuan for bidirectional sync
}

// Others
export interface Karyawan {
  id: string;
  nama: string;
  nik?: string;
  jabatan?: string;
  tanggalMulai?: Date;
  alamat?: string;
  telepon?: string;
  gajiPokok?: number;
  tunjangan?: number;
  cabangId?: string;
  userAccountId?: string;
  posisi?: string;
  status: 'aktif' | 'nonaktif';
  kecamatan?: string;
  kelurahan?: string;
  kodePos?: string;
  koordinat?: Lokasi | string;
  kota?: string;
  provinsi?: string;
}

export interface Notifikasi {
  id: string;
  userId: string;
  judul: string;
  pesan: string;
  jenis: 'info' | 'warning' | 'success' | 'error';
  dibaca: boolean;
  link?: string;
  tanggal: Date;
}

export interface PersetujuanPayload {
  forwardToPusat?: boolean;
  isCabangChanged?: boolean;
  isStatusChanged?: boolean;
  oldCabangId?: string;
  oldStatus?: string;
  payNow?: boolean;
  keterangan?: string;
  keSalesId?: string;
  dariSalesId?: string;
  pelangganNama?: string;
  pelangganId?: string;
  jumlah?: number;
  startDate?: string | Date;
  endDate?: string | Date;
  reimburseId?: string;
  disetujuiOleh?: string;
  rekeningId?: string;
  nomorPenyesuaian?: string;
  nomorSetoran?: string;
  unitName?: string;
  limitKredit?: number;
  dariCabangId?: string;
  nama?: string;
  kode?: string;
  isActive?: boolean;
  tipe?: string;
  nilai?: number;
  mekanismeBonus?: string;
  bonusProdukIds?: string[];
  bonusProdukId?: string;
  scope?: string;
  targetProdukIds?: string[];
  tanggalMulai?: string | Date;
  tanggalBerakhir?: string | Date;
  stokTercatat?: number;
  stokFisik?: number;
  disetujuiPada?: Date;
  namaBank?: string;
  noRekening?: string;
  namaPemilik?: string;
  posisi?: string;
  userAccountId?: string;
  isKelipatan?: boolean;
  totalSales?: number;
  status?: string;
  keCabangId?: string;
  nomorNota?: string;
  count?: number;

  // Missing properties added
  amount?: number;
  cashAmount?: number;
  transferAmount?: number;
  catatan?: string;
  items?: { barangId: string; jumlah: number; satuanId?: string; konversi?: number; id?: string }[] | unknown[];
  isNew?: boolean;
  id?: string;
  barangId?: string;
  namaPromo?: string;
  selisih?: number;
  satuanId?: string;
  hargaBaru?: number;
  hargaLama?: number;
  minQty?: number;
  cabangId?: string;
  kategoriPelangganIds?: string[];
  grosir?: { min: number; max: number; harga: number; isMixMatch?: boolean }[];
  tanggalEfektif?: string | Date;
  namaBarang?: string;
  rekeningTujuanId?: string;
  tanggal?: string | Date;
  buktiUrl?: string;
  senderCabangId?: string;
  pecahan?: Record<string, number>;
  transfers?: { amount: number; bankId?: string; proofUrl?: string }[];
  rekeningNama?: string;
  buktiGambar?: string;
  [key: string]: unknown;
}

export interface Persetujuan {
  id: string;
  jenis: 'diskon_manual' | 'edit_harga' | 'hapus_transaksi' | 'permintaan' | 'mutasi_stok' | 'restock' | 'mutasi' | 'pembatalan_penjualan' | 'penjualan' | 'perubahan_data_pelanggan' | 'perubahan_harga' | 'promo' | 'rencana_setoran' | 'setoran' | 'reimburse' | 'mutasi_karyawan' | 'opname' | 'mutasi_pelanggan';
  data: PersetujuanPayload; // JSON detail
  diajukanOleh: string;
  disetujuiOleh?: string;
  targetCabangId?: string;
  targetUserId?: string;
  targetRole?: UserRole;
  status: 'pending' | 'disetujui' | 'ditolak';
  keterangan?: string;
  catatan?: string;
  tanggalPengajuan: Date;
  tanggalPersetujuan?: Date;
  referensiId?: string;

}

export interface Harga {
  id: string;
  barangId: string;
  kategoriPelangganId?: string;
  harga: number;
  detail_harga_satuan?: Record<string, unknown>; // JSONB for multiple unit prices
  status?: 'aktif' | 'nonaktif' | 'pending' | 'disetujui' | 'ditolak';
  satuanId?: string;
  minQty?: number;
  cabangId?: string;
  kategoriPelangganIds?: string[]; // Used in some parts instead of single ID
  disetujuiOleh?: string;
  tanggalEfektif?: Date;
  grosir?: { min: number; max: number; harga: number; isMixMatch?: boolean }[];
  persetujuanId?: string; // FK to persetujuan for bidirectional sync
}

export interface StokPengguna {
  id: string;
  userId: string;
  barangId: string;
  jumlah: number;
}

export interface Promo {
  id: string;
  nama: string;
  tipe: 'nominal' | 'persen' | 'produk' | 'potongan_harga' | 'bonus_barang' | 'diskon_persen';
  syarat_jumlah?: number;
  syarat_barang_id?: string;
  bonus_barang_id?: string;
  bonus_jumlah?: number;
  nilai_potongan?: number;
  kategori_pelanggan_id?: string;
  berlaku_mulai: Date;
  berlaku_sampai: Date;
  aktif: boolean;
  keterangan?: string;
  // New properties from IDE report
  tanggalMulai: Date | string; // Handle both
  tanggalBerakhir?: Date | string | null;
  isActive?: boolean;
  kode?: string;
  nilai: number;
  bonusProdukIds?: string[];
  bonusProdukId?: string;
  mekanismeBonus?: 'single' | 'random' | 'mix';
  isKelipatan?: boolean;
  is_kelipatan?: boolean; // DB Column
  scope?: 'all' | 'selected_products' | 'global' | 'cabang' | 'pelanggan';
  targetProdukIds?: string[];
  target_produk_ids?: string[]; // DB Column
  minQty?: number;
  min_qty?: number; // DB column
  cabangId?: string;
  maxApply?: number;
  max_apply?: number; // DB Column
  metodeKelipatan?: 'per_item' | 'per_nota';
  metode_kelipatan?: 'per_item' | 'per_nota'; // DB Column
}

export interface MutasiBarang {
  id: string;
  tanggal: Date;
  dari_stok_id: string; // User ID source
  ke_stok_id: string; // User ID dest
  status: 'pending' | 'disetujui' | 'ditolak';
  keterangan?: string;
  referensiId?: string; // Optional: ID Persetujuan
  jenis?: 'masuk' | 'keluar' | 'pindah' | 'opname' | 'musnah' | 'mutasi';
  items?: MutasiItem[] | Record<string, unknown>;
  nomorMutasi?: string;
  keCabangId?: string;
  dariCabangId?: string;
  persetujuanId?: string; // FK to persetujuan for bidirectional sync
}

export interface MutasiItem {
  barangId: string;
  jumlah: number;
  satuanId: string;
  keterangan?: string;
}

export interface SaldoPengguna {
  id: string;
  userId: string;
  saldo: number;
  updatedAt: Date;
}

export interface Restock {
  id: string;
  nomorRestock: string;
  tanggal: Date;
  barangId: string;
  jumlah: number;
  satuanId?: string;
  konversi?: number;
  cabangId?: string;
  penerimaId?: string;
  dibuatOleh?: string;
  disetujuiOleh?: string;
  status: 'pending' | 'disetujui' | 'ditolak';
  keterangan?: string;
  persetujuanId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Reimburse {
  id: string;
  userId: string;
  tanggal: Date;
  jenis: 'bbm' | 'tol' | 'parkir' | 'lainnya';
  jumlah: number;
  keterangan?: string;
  bukti?: string; // URL image
  status: 'pending' | 'disetujui' | 'ditolak' | 'dibayar';
  disetujuiOleh?: string;
  tanggalDisetujui?: Date;
  kategori?: string;
  metodePembayaran?: 'pettycash' | 'transfer';
  buktiUrl?: string; // Synonym for bukti
  dibayarPada?: Date;
  disetujuiPada?: Date; // Alias
  catatanPenolakan?: string;
  persetujuanId?: string; // FK to persetujuan for bidirectional sync
}

export interface PettyCash {
  id: string;
  tanggal: Date;
  jenis: 'pemasukan' | 'pengeluaran';
  kategori: string; // e.g., 'Operasional', 'Konsumsi', 'ATK'
  jumlah: number;
  saldoAkhir: number;
  keterangan?: string;
  bukti?: string; // URL image
  userId: string; // Yang input
  tipe?: string; // Some parts use this
  buktiUrl?: string;
  createdBy?: string;
  reimburseId?: string;
}

export interface ProfilPerusahaan {
  id: string;
  nama: string;
  alamat?: string;
  updatedAt?: Date;
  updatedBy?: string;
  telepon?: string;
  email?: string;
  website?: string;
  deskripsi?: string;
  logo?: string;
  logoUrl?: string; // Used in print templates
  config?: {
    daysToFetch?: number;
    taxRate?: number;
    currency?: string;
    useGlobalLimit?: boolean;
    globalLimitAmount?: number;
    blockOnDebt?: boolean;
    blockMode?: 'soft' | 'hard' | 'strict' | 'limit_only';
    enableClosing?: boolean;
    closingStartTime?: string;
    closingEndTime?: string;
    isMaintenance?: boolean;
    maintenanceMessage?: string;
  };
}

export interface PenyesuaianStok {
  id: string;
  barangId: string;
  selisih: number;
  alasan: string;
  keterangan?: string;
  status: 'pending' | 'disetujui' | 'ditolak';
  tanggal: Date;
  updatedAt?: Date;
  createdAt: Date;
  cabangId?: string;
  nomorPenyesuaian?: string;
  persetujuanId?: string; // FK to persetujuan for bidirectional sync
}

export interface PermintaanBarang {
  id: string;
  nomorPermintaan: string;
  tanggal: Date;
  dariCabangId: string;
  keCabangId: string;
  items: {
    barangId: string;
    satuanId: string;
    jumlah: number;
    konversi?: number;
    totalQty?: number;
  }[];
  status: 'pending' | 'disetujui' | 'ditolak' | 'selesai';
  catatan?: string;
  dibuatOleh?: string;
  persetujuanId?: string; // FK to persetujuan for bidirectional sync
}

export interface DatabaseContextType {
  // Master Data
  kategori: Kategori[];
  satuan: Satuan[];
  kategoriPelanggan: KategoriPelanggan[];
  rekeningBank: RekeningBank[];
  area: Area[];
  cabang: Cabang[];
  barang: Barang[];
  pelanggan: Pelanggan[];
  users: User[];
  karyawan: Karyawan[];
  harga: Harga[];
  stokPengguna: StokPengguna[];
  saldoPengguna: SaldoPengguna[];
  promo: Promo[];

  // Transactions
  penjualan: Penjualan[];
  setoran: Setoran[];
  absensi: Absensi[];
  notifikasi: Notifikasi[];
  persetujuan: Persetujuan[];
  mutasiBarang: MutasiBarang[];
  reimburse: Reimburse[];
  pettyCash: PettyCash[];

  // Other tables
  permintaanBarang: PermintaanBarang[];
  penyesuaianStok: PenyesuaianStok[];

  // UI/System State
  profilPerusahaan: ProfilPerusahaan;
  pettyCashBalance: number;
  isLoading: boolean;
  isRefreshing: boolean;
  setIsLoading: (loading: boolean) => void;
  viewMode: 'all' | 'me';
  setViewMode: (mode: 'all' | 'me') => void;
  pendingSyncCount: number;
  isAdminOrOwner: boolean;
  refresh: () => Promise<void>;
  repairUser: () => Promise<void>;

  // CRUD Actions
  addKategori: (item: Partial<Kategori>) => Promise<Kategori>;
  updateKategori: (id: string, item: Partial<Kategori>) => Promise<void>;
  deleteKategori: (id: string) => Promise<void>;

  addSatuan: (item: Partial<Satuan>) => Promise<Satuan>;
  updateSatuan: (id: string, item: Partial<Satuan>) => Promise<void>;
  deleteSatuan: (id: string) => Promise<void>;

  addKategoriPelanggan: (item: Partial<KategoriPelanggan>) => Promise<KategoriPelanggan>;
  updateKategoriPelanggan: (id: string, item: Partial<KategoriPelanggan>) => Promise<void>;
  deleteKategoriPelanggan: (id: string) => Promise<void>;

  addRekeningBank: (item: Partial<RekeningBank>) => Promise<RekeningBank>;
  updateRekeningBank: (id: string, item: Partial<RekeningBank>) => Promise<void>;
  deleteRekeningBank: (id: string) => Promise<void>;

  addArea: (item: Partial<Area>) => Promise<Area>;
  updateArea: (id: string, item: Partial<Area>) => Promise<void>;
  deleteArea: (id: string) => Promise<void>;

  addCabang: (item: Partial<Cabang>) => Promise<Cabang>;
  updateCabang: (id: string, item: Partial<Cabang>) => Promise<void>;
  deleteCabang: (id: string) => Promise<void>;

  addBarang: (item: Partial<Barang>) => Promise<Barang>;
  updateBarang: (id: string, item: Partial<Barang>) => Promise<void>;
  deleteBarang: (id: string) => Promise<void>;

  addPelanggan: (item: Partial<Pelanggan>) => Promise<Pelanggan>;
  updatePelanggan: (id: string, item: Partial<Pelanggan>) => Promise<void>;
  deletePelanggan: (id: string) => Promise<void>;

  addPenjualan: (item: Partial<Penjualan>) => Promise<Penjualan>;
  updatePenjualan: (id: string, item: Partial<Penjualan>) => Promise<void>;
  deletePenjualan: (id: string) => Promise<void>;

  addSetoran: (item: Partial<Setoran>) => Promise<Setoran>;
  updateSetoran: (id: string, item: Partial<Setoran>) => Promise<void>;
  deleteSetoran: (id: string) => Promise<void>;

  addAbsensi: (item: Partial<Absensi>) => Promise<Absensi>;
  updateAbsensi: (id: string, item: Partial<Absensi>) => Promise<void>;
  deleteAbsensi: (id: string) => Promise<void>;

  addKaryawan: (item: Partial<Karyawan>) => Promise<Karyawan>;
  updateKaryawan: (id: string, item: Partial<Karyawan>) => Promise<void>;
  deleteKaryawan: (id: string) => Promise<void>;

  addUser: (item: Partial<User>) => Promise<User>;
  updateUser: (id: string, item: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  addNotifikasi: (item: Partial<Notifikasi>) => Promise<Notifikasi>;
  updateNotifikasi: (id: string, item: Partial<Notifikasi>) => Promise<void>;
  deleteNotifikasi: (id: string) => Promise<void>;
  markNotifikasiRead: (id: string) => Promise<void>;
  markAllNotifikasiRead: () => Promise<void>;

  addPersetujuan: (item: Partial<Persetujuan>) => Promise<Persetujuan>;
  updatePersetujuan: (id: string, item: Partial<Persetujuan>) => Promise<void>;
  deletePersetujuan: (id: string) => Promise<void>;

  addHarga: (item: Partial<Harga>) => Promise<Harga>;
  updateHarga: (id: string, item: Partial<Harga>) => Promise<void>;
  deleteHarga: (id: string) => Promise<void>;

  updateProfilPerusahaan: (item: Partial<ProfilPerusahaan>) => Promise<ProfilPerusahaan>;

  addReimburse: (item: Partial<Reimburse>) => Promise<Reimburse>;
  updateReimburse: (id: string, item: Partial<Reimburse>) => Promise<void>;
  deleteReimburse: (id: string) => Promise<void>;

  addPettyCash: (item: Partial<PettyCash>) => Promise<PettyCash>;
  updatePettyCash: (id: string, item: Partial<PettyCash>) => Promise<void>;
  deletePettyCash: (id: string) => Promise<void>;

  addStokPengguna: (item: Partial<StokPengguna>) => Promise<StokPengguna>;
  updateStokPengguna: (id: string, item: Partial<StokPengguna>) => Promise<void>;
  deleteStokPengguna: (id: string) => Promise<void>;

  addPromo: (item: Partial<Promo>) => Promise<Promo>;
  updatePromo: (id: string, item: Partial<Promo>) => Promise<void>;
  deletePromo: (id: string) => Promise<void>;

  addMutasiBarang: (item: Partial<MutasiBarang>) => Promise<MutasiBarang>;
  updateMutasiBarang: (id: string, item: Partial<MutasiBarang>) => Promise<void>;
  deleteMutasiBarang: (id: string) => Promise<void>;

  addSaldoPengguna: (item: Partial<SaldoPengguna>) => Promise<SaldoPengguna>;
  updateSaldoPengguna: (id: string, item: Partial<SaldoPengguna>) => Promise<void>;
  deleteSaldoPengguna: (id: string) => Promise<void>;

  addPenyesuaianStok: (item: Record<string, unknown>) => Promise<unknown>;
  updatePenyesuaianStok: (id: string, item: Record<string, unknown>) => Promise<void>;
  deletePenyesuaianStok: (id: string) => Promise<void>;

  addPermintaanBarang: (item: Record<string, unknown>) => Promise<unknown>;
  updatePermintaanBarang: (id: string, item: Record<string, unknown>) => Promise<void>;
  deletePermintaanBarang: (id: string) => Promise<void>;

  addPembayaranPenjualan: (item: Partial<PembayaranPenjualan>) => Promise<PembayaranPenjualan>;

  // Restock
  restock: Restock[];
  addRestock: (item: Partial<Restock>) => Promise<Restock>;
  updateRestock: (id: string, item: Partial<Restock>) => Promise<void>;
  deleteRestock: (id: string) => Promise<void>;
}
