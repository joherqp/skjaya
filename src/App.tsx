import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DatabaseProvider, useDatabase } from "@/contexts/DatabaseContext";
import { APIProvider } from "@vis.gl/react-google-maps";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Pages
import { Suspense, lazy } from 'react';

// Pages - Lazy Loaded
const Login = lazy(() => import("./pages/login/Login"));
const Beranda = lazy(() => import("./pages/beranda/Beranda"));
const Barang = lazy(() => import("./pages/barang/Barang"));
const Restock = lazy(() => import("./pages/barang/Restock"));
const UpdateStok = lazy(() => import('./pages/barang/UpdateStok'));
const PermintaanBarang = lazy(() => import("./pages/barang/PermintaanBarang"));
const MutasiBarang = lazy(() => import("./pages/barang/MutasiBarang"));
const PenyesuaianBarang = lazy(() => import("./pages/barang/PenyesuaianBarang"));

const DetailBarang = lazy(() => import("./pages/barang/DetailBarang"));
const TambahPelanggan = lazy(() => import("./pages/pelanggan/TambahPelanggan"));
const MutasiPelanggan = lazy(() => import("./pages/pelanggan/MutasiPelanggan"));

const DetailPelanggan = lazy(() => import("./pages/pelanggan/DetailPelanggan"));
const EditPelanggan = lazy(() => import("./pages/pelanggan/EditPelanggan"));
const TambahPenjualan = lazy(() => import("./pages/penjualan/TambahPenjualan"));
const RekapPenjualan = lazy(() => import("./pages/penjualan/RekapPenjualan"));
const DetailPenjualan = lazy(() => import("./pages/penjualan/DetailPenjualan"));
const TambahSetoran = lazy(() => import("./pages/setoran/TambahSetoran"));
const SetorPusat = lazy(() => import("./pages/setoran/SetorPusat"));
const DetailSetoran = lazy(() => import("./pages/setoran/DetailSetoran"));
const Pelanggan = lazy(() => import("./pages/pelanggan/Pelanggan"));
const LaporanStok = lazy(() => import("./pages/laporan/LaporanStok"));
const LaporanAbsensi = lazy(() => import("./pages/laporan/LaporanAbsensi"));
const LaporanPiutang = lazy(() => import("./pages/laporan/LaporanPiutang"));
const Penjualan = lazy(() => import("./pages/penjualan/Penjualan"));
const Absensi = lazy(() => import("./pages/absensi/Absensi"));
const Setoran = lazy(() => import("./pages/setoran/Setoran"));
const Menu = lazy(() => import("./pages/menu/Menu"));
const Notifikasi = lazy(() => import("./pages/notifikasi/Notifikasi"));
const Profil = lazy(() => import("./pages/profil/Profil"));
const Pengaturan = lazy(() => import("./pages/pengaturan/Pengaturan"));
const Persetujuan = lazy(() => import("./pages/lainnya/Persetujuan"));
const Laporan = lazy(() => import("./pages/laporan/Laporan"));
const Monitoring = lazy(() => import("./pages/monitoring/MonitoringPage"));
const NotFound = lazy(() => import("./pages/not-found/NotFound"));
const Placeholder = lazy(() => import("@/components/shared/Placeholder"));
const ProfilPerusahaan = lazy(() => import("./pages/pengaturan/ProfilPerusahaan"));
const DataIntegrityPage = lazy(() => import("./pages/pengaturan/DataIntegrity"));
const RekeningBank = lazy(() => import("./pages/pengaturan/RekeningBank"));
const Area = lazy(() => import("./pages/pengaturan/Area"));
const Cabang = lazy(() => import("./pages/pengaturan/Cabang"));
const Pengguna = lazy(() => import("./pages/pengaturan/Pengguna"));
const Karyawan = lazy(() => import("./pages/pengaturan/Karyawan"));
const KategoriProduk = lazy(() => import("./pages/pengaturan/KategoriProduk"));
const KategoriPelanggan = lazy(() => import("./pages/pengaturan/KategoriPelanggan"));
const Satuan = lazy(() => import("./pages/pengaturan/Satuan"));
const Harga = lazy(() => import("./pages/pengaturan/Harga"));
const JadwalHargaPromo = lazy(() => import("./pages/laporan/JadwalHargaPromo"));
const Promo = lazy(() => import("./pages/pengaturan/Promo"));
const Backup = lazy(() => import("./pages/pengaturan/Backup"));
const TargetPage = lazy(() => import("./pages/pengaturan/Target"));
const MaintenancePage = lazy(() => import("./pages/maintenance/Maintenance"));

const LaporanSalesPerformance = lazy(() => import("./pages/laporan/LaporanSalesPerformance"));
const LaporanArsipPenjualan = lazy(() => import("./pages/laporan/LaporanArsipPenjualan"));
const Analisa = lazy(() => import("@/pages/laporan/Analisa"));
const MasterProduk = lazy(() => import("./pages/pengaturan/MasterProduk"));
const Reimburse = lazy(() => import("./pages/reimburse/Reimburse"));

const PettyCash = lazy(() => import("./pages/petty-cash/PettyCash"));
const TambahPettyCash = lazy(() => import("./pages/petty-cash/TambahPettyCash"));
const TambahReimburse = lazy(() => import("./pages/reimburse/TambahReimburse"));
const LaporanReimburse = lazy(() => import("@/pages/laporan/LaporanReimburse"));
const LaporanPenjualan = lazy(() => import("@/pages/laporan/LaporanPenjualan"));
const LaporanHarian = lazy(() => import("./pages/laporan/LaporanHarian"));

const queryClient = new QueryClient();

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const { absensi, isLoading: isDbLoading } = useDatabase();
  const location = useLocation();

  if (isAuthLoading || (isAuthenticated && isDbLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-14 h-14 logo-round flex items-center justify-center mx-auto mb-4">
            <span className="logo-text text-lg">SKJ</span>
          </div>
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Attendance Guard
  // Only check if we are NOT on the absensi page
  // Attendance Guard Removed as per user request (Mode Bebas)

  return <>{children}</>;
}

// Role Protected Route wrapper
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Strict: Settings are Admin-only. Owner only Approves.
  if (!user.roles.includes('admin') && !user.roles.includes('owner')) {
    return <Navigate to="/beranda" replace />;
  }

  return <>{children}</>;
};

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/beranda";

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
}

// App Routes
function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/*" element={
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            </div>
          </div>
        }>
          <AppRoutesContent />
        </Suspense>
      } />
    </Routes>
  );
}

function AppRoutesContent() {
  const { isAuthenticated, user } = useAuth();
  const { profilPerusahaan } = useDatabase();

  const isMaintenance = profilPerusahaan?.config?.isMaintenance;
  const isAdminOrOwner = user?.roles.includes('admin') || user?.roles.includes('owner');

  return (
    <Routes>
      {/* Maintenance Route */}
      <Route path="/maintenance" element={<MaintenancePage />} />

      {/* Public Routes */}
      <Route
        path="/login"
        element={
          isMaintenance && !isAdminOrOwner ? (
            <Navigate to="/maintenance" replace />
          ) : (
            <PublicRoute><Login /></PublicRoute>
          )
        }
      />

      {/* Protected Routes Wrapper for Maintenance */}
      <Route
        path="/*"
        element={
          isMaintenance && !isAdminOrOwner ? (
            <Navigate to="/maintenance" replace />
          ) : (
            <AuthenticatedRoutes />
          )
        }
      />
    </Routes>
  );
}

function AuthenticatedRoutes() {
  return (
    <Routes>
      <Route path="/beranda" element={<ProtectedRoute><Beranda /></ProtectedRoute>} />
      <Route path="/barang" element={<ProtectedRoute><Barang /></ProtectedRoute>} />
      <Route path="/barang/restock" element={<ProtectedRoute><Restock /></ProtectedRoute>} />
      <Route path="/barang/update-stok" element={<ProtectedRoute><UpdateStok /></ProtectedRoute>} />
      <Route path="/barang/permintaan" element={<ProtectedRoute><PermintaanBarang /></ProtectedRoute>} />
      <Route path="/barang/mutasi" element={<ProtectedRoute><MutasiBarang /></ProtectedRoute>} />
      <Route path="/barang/penyesuaian" element={<ProtectedRoute><PenyesuaianBarang /></ProtectedRoute>} />

      <Route path="/barang/:id" element={<ProtectedRoute><DetailBarang /></ProtectedRoute>} />
      <Route path="/pelanggan" element={<ProtectedRoute><Pelanggan /></ProtectedRoute>} />
      <Route path="/pelanggan/tambah" element={<ProtectedRoute><TambahPelanggan /></ProtectedRoute>} />
      <Route path="/pelanggan/mutasi" element={<ProtectedRoute><MutasiPelanggan /></ProtectedRoute>} />

      <Route path="/pelanggan/:id" element={<ProtectedRoute><DetailPelanggan /></ProtectedRoute>} />
      <Route path="/pelanggan/edit/:id" element={<ProtectedRoute><EditPelanggan /></ProtectedRoute>} />
      <Route path="/penjualan" element={<ProtectedRoute><Penjualan /></ProtectedRoute>} />
      <Route path="/penjualan/buat" element={<ProtectedRoute><TambahPenjualan /></ProtectedRoute>} />
      <Route path="/penjualan/rekap" element={<ProtectedRoute><RekapPenjualan /></ProtectedRoute>} />
      <Route path="/penjualan/:id" element={<ProtectedRoute><DetailPenjualan /></ProtectedRoute>} />
      <Route path="/absensi" element={<ProtectedRoute><Absensi /></ProtectedRoute>} />
      <Route path="/setoran" element={<ProtectedRoute><Setoran /></ProtectedRoute>} />
      <Route path="/setoran/buat" element={<ProtectedRoute><TambahSetoran /></ProtectedRoute>} />
      <Route path="/setoran/rencana" element={<ProtectedRoute><SetorPusat /></ProtectedRoute>} />
      <Route path="/setoran/:id" element={<ProtectedRoute><DetailSetoran /></ProtectedRoute>} />
      <Route path="/menu" element={<ProtectedRoute><Menu /></ProtectedRoute>} />
      <Route path="/notifikasi" element={<ProtectedRoute><Notifikasi /></ProtectedRoute>} />
      <Route path="/profil" element={<ProtectedRoute><Profil /></ProtectedRoute>} />

      {/* Admin/Owner Only Routes */}
      <Route path="/pengaturan" element={<AdminRoute><Pengaturan /></AdminRoute>} />
      <Route path="/pengaturan/perusahaan" element={<AdminRoute><ProfilPerusahaan /></AdminRoute>} />
      <Route path="/pengaturan/integritas" element={<AdminRoute><DataIntegrityPage /></AdminRoute>} />

      {/* Settings Sub-routes */}
      <Route path="/pengaturan/pengguna" element={<AdminRoute><Pengguna /></AdminRoute>} />
      <Route path="/pengaturan/karyawan" element={<AdminRoute><Karyawan /></AdminRoute>} />
      <Route path="/pengaturan/area" element={<AdminRoute><Area /></AdminRoute>} />
      <Route path="/pengaturan/cabang" element={<AdminRoute><Cabang /></AdminRoute>} />
      <Route path="/pengaturan/rekening" element={<AdminRoute><RekeningBank /></AdminRoute>} />
      <Route path="/pengaturan/satuan" element={<AdminRoute><Satuan /></AdminRoute>} />
      <Route path="/pengaturan/kategori-produk" element={<AdminRoute><KategoriProduk /></AdminRoute>} />
      <Route path="/pengaturan/produk" element={<AdminRoute><MasterProduk /></AdminRoute>} />
      <Route path="/pengaturan/kategori-pelanggan" element={<AdminRoute><KategoriPelanggan /></AdminRoute>} />
      <Route path="/pengaturan/harga" element={<AdminRoute><Harga /></AdminRoute>} />

      <Route path="/pengaturan/promo" element={<AdminRoute><Promo /></AdminRoute>} />
      <Route path="/pengaturan/target" element={<AdminRoute><TargetPage /></AdminRoute>} />
      <Route path="/pengaturan/backup" element={<AdminRoute><Backup /></AdminRoute>} />


      <Route path="/pengaturan/*" element={<ProtectedRoute><Placeholder title="Pengaturan" /></ProtectedRoute>} />
      <Route path="/persetujuan" element={<ProtectedRoute><Persetujuan /></ProtectedRoute>} />
      <Route path="/laporan" element={<ProtectedRoute><Laporan /></ProtectedRoute>} />
      <Route path="/laporan/stok" element={<ProtectedRoute><LaporanStok /></ProtectedRoute>} />
      <Route path="/laporan/absensi" element={<ProtectedRoute><LaporanAbsensi /></ProtectedRoute>} />
      <Route path="/laporan/piutang" element={<ProtectedRoute><LaporanPiutang /></ProtectedRoute>} />
      <Route path="/laporan/jadwal-harga" element={<ProtectedRoute><JadwalHargaPromo /></ProtectedRoute>} />
      <Route path="/laporan/sales-performance" element={<ProtectedRoute><LaporanSalesPerformance /></ProtectedRoute>} />
      <Route path="/laporan/arsip-penjualan" element={<AdminRoute><LaporanArsipPenjualan /></AdminRoute>} />
      <Route path="/laporan/analisa" element={<AdminRoute><Analisa /></AdminRoute>} />
      <Route path="/laporan/penjualan" element={<ProtectedRoute><LaporanPenjualan /></ProtectedRoute>} />
      <Route path="/laporan/harian" element={<ProtectedRoute><LaporanHarian /></ProtectedRoute>} />

      <Route path="/monitoring" element={<ProtectedRoute><Monitoring /></ProtectedRoute>} />

      <Route path="/reimburse" element={<ProtectedRoute><Reimburse /></ProtectedRoute>} />
      <Route path="/reimburse/ajukan" element={<ProtectedRoute><TambahReimburse /></ProtectedRoute>} />
      <Route path="/petty-cash" element={<ProtectedRoute><PettyCash /></ProtectedRoute>} />
      <Route path="/petty-cash/tambah" element={<ProtectedRoute><TambahPettyCash /></ProtectedRoute>} />
      <Route path="/laporan/reimburse" element={<ProtectedRoute><LaporanReimburse /></ProtectedRoute>} />

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/beranda" replace />} />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" closeButton richColors duration={2000} />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <DatabaseProvider>
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY || ""}>
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </APIProvider>
          </DatabaseProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
