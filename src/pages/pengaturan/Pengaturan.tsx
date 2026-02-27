import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Users, UserCog, Shield, MapPin, GitBranch,
  CreditCard, Ruler, Tags, UsersRound, DollarSign, CalendarClock,
  Percent, Database, ChevronRight, Package, Target, ShoppingCart
} from 'lucide-react';

interface SettingItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  path: string;
}

const SettingItem = ({ icon: Icon, label, description, path }: SettingItemProps) => {
  const navigate = useNavigate();

  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted cursor-pointer transition-colors"
      onClick={() => navigate(path)}
    >
      <div className="p-2 rounded-lg bg-primary/10">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </div>
  );
};

export default function Pengaturan() {
  const companySettings = [
    { icon: Building2, label: 'Profil Perusahaan', description: 'Nama, logo, kontak', path: '/pengaturan/perusahaan' },
  ];

  const userSettings = [
    { icon: Users, label: 'Pengguna', description: 'Kelola akun pengguna', path: '/pengaturan/pengguna' },
    { icon: UserCog, label: 'Karyawan', description: 'Data karyawan', path: '/pengaturan/karyawan' },
  ];

  const locationSettings = [
    { icon: MapPin, label: 'Area', description: 'Wilayah distribusi', path: '/pengaturan/area' },
    { icon: GitBranch, label: 'Cabang', description: 'Kelola cabang', path: '/pengaturan/cabang' },
    { icon: CreditCard, label: 'Rekening Bank', description: 'Rekening & tunai', path: '/pengaturan/rekening' },
  ];

  const productSettings = [
    { icon: Package, label: 'Produk', description: 'Master data produk', path: '/pengaturan/produk' },
    { icon: Tags, label: 'Kategori Produk', description: 'Klasifikasi barang', path: '/pengaturan/kategori-produk' },
    { icon: UsersRound, label: 'Kategori Pelanggan', description: 'Tipe pelanggan', path: '/pengaturan/kategori-pelanggan' },
    { icon: Ruler, label: 'Satuan', description: 'Unit pengukuran', path: '/pengaturan/satuan' },
  ];

  const pricingSettings = [
    { icon: DollarSign, label: 'Harga', description: 'Daftar harga produk', path: '/pengaturan/harga' },
    { icon: Percent, label: 'Promo', description: 'Diskon & promosi', path: '/pengaturan/promo' },
    { icon: Target, label: 'Target Penjualan', description: 'Target sales & cabang', path: '/pengaturan/target' },
  ];

  const systemSettings = [
    { icon: Database, label: 'Backup', description: 'Import & export data', path: '/pengaturan/backup' },
    { icon: Shield, label: 'Cek Integritas', description: 'Verifikasi stok & saldo', path: '/pengaturan/integritas' },
  ];

  return (
    <MainLayout title="Pengaturan">
      <div className="p-4 space-y-5">
        {/* Company */}
        <Card elevated>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Perusahaan</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {companySettings.map((item, index) => (
              <div key={item.path} className="animate-slide-up" style={{ animationDelay: `${index * 20}ms` }}>
                <SettingItem {...item} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Users & Roles */}
        <Card elevated>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pengguna & Peran</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {userSettings.map((item, index) => (
              <div key={item.path} className="animate-slide-up" style={{ animationDelay: `${(index + companySettings.length) * 20}ms` }}>
                <SettingItem {...item} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Location */}
        <Card elevated>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Lokasi & Keuangan</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {locationSettings.map((item, index) => (
              <div key={item.path} className="animate-slide-up" style={{ animationDelay: `${(index + companySettings.length + userSettings.length) * 20}ms` }}>
                <SettingItem {...item} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Products */}
        <Card elevated>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Produk & Pelanggan</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {productSettings.map((item, index) => (
              <div key={item.path} className="animate-slide-up" style={{ animationDelay: `${(index + companySettings.length + userSettings.length + locationSettings.length) * 20}ms` }}>
                <SettingItem {...item} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card elevated>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Harga & Promo</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {pricingSettings.map((item, index) => (
              <div key={item.path} className="animate-slide-up" style={{ animationDelay: `${(index + companySettings.length + userSettings.length + locationSettings.length + productSettings.length) * 20}ms` }}>
                <SettingItem {...item} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* System */}
        <Card elevated>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sistem</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {systemSettings.map((item, index) => (
              <div key={item.path} className="animate-slide-up" style={{ animationDelay: `${(index + companySettings.length + userSettings.length + locationSettings.length + productSettings.length + pricingSettings.length) * 20}ms` }}>
                <SettingItem {...item} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
