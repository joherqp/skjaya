import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, Package, Users, ShoppingCart, Wallet, BarChart3, 
  MapPin, Settings, CheckCircle, Bell, User, LogOut,
  Truck, ArrowRightLeft, FileText, ClipboardList
} from 'lucide-react';

interface MenuItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  path: string;
  badge?: number | string;
  color?: string;
}

const MenuItem = ({ icon: Icon, label, description, path, badge, color = 'bg-primary/10 text-primary' }: MenuItemProps) => {
  const navigate = useNavigate();

  return (
    <Card 
      elevated 
      className="cursor-pointer hover:border-primary/30 active:scale-[0.98] transition-all"
      onClick={() => navigate(path)}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">{label}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {badge && (
          <Badge variant="destructive">{badge}</Badge>
        )}
      </CardContent>
    </Card>
  );
};

export default function Menu() {
  const { user, logout } = useAuth();
  const { notifikasi, persetujuan } = useDatabase();
  const navigate = useNavigate();

  const unreadNotifikasi = notifikasi.filter(n => 
    n.userId === user?.id && !n.dibaca
  ).length;

  const pendingApprovals = persetujuan.filter(p => p.status === 'pending').length;

  const mainMenuItems: MenuItemProps[] = [
    { 
      icon: Clock, 
      label: 'Absensi', 
      description: 'Check in & check out harian',
      path: '/absensi',
      color: 'bg-info/10 text-info'
    },
    { 
      icon: Package, 
      label: 'Barang', 
      description: 'Stok, mutasi, permintaan',
      path: '/barang',
      color: 'bg-primary/10 text-primary'
    },
    { 
      icon: Users, 
      label: 'Pelanggan', 
      description: 'Data pelanggan & mutasi',
      path: '/pelanggan',
      color: 'bg-success/10 text-success'
    },
    { 
      icon: ShoppingCart, 
      label: 'Penjualan', 
      description: 'Buat nota & ringkasan',
      path: '/penjualan',
      color: 'bg-warning/10 text-warning'
    },
    { 
      icon: Wallet, 
      label: 'Setoran', 
      description: 'Setor & riwayat setoran',
      path: '/setoran',
      color: 'bg-purple-500/10 text-purple-600'
    },
  ];

  const reportMenuItems: MenuItemProps[] = [
    { 
      icon: BarChart3, 
      label: 'Laporan', 
      description: 'Penjualan, stok, setoran',
      path: '/laporan',
      color: 'bg-primary/10 text-primary'
    },
    { 
      icon: MapPin, 
      label: 'Monitoring', 
      description: 'Tracking & live map',
      path: '/monitoring',
      color: 'bg-info/10 text-info'
    },
    { 
      icon: CheckCircle, 
      label: 'Persetujuan', 
      description: 'Pusat approval request',
      path: '/persetujuan',
      badge: pendingApprovals > 0 ? pendingApprovals : undefined,
      color: 'bg-success/10 text-success'
    },
  ];

  const accountMenuItems: MenuItemProps[] = [
    { 
      icon: Bell, 
      label: 'Notifikasi', 
      description: 'Pemberitahuan sistem',
      path: '/notifikasi',
      badge: unreadNotifikasi > 0 ? unreadNotifikasi : undefined,
      color: 'bg-warning/10 text-warning'
    },
    { 
      icon: User, 
      label: 'Profil', 
      description: 'Kelola akun Anda',
      path: '/profil',
      color: 'bg-muted text-muted-foreground'
    },
    { 
      icon: Settings, 
      label: 'Pengaturan', 
      description: 'Konfigurasi sistem',
      path: '/pengaturan',
      color: 'bg-muted text-muted-foreground'
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <MainLayout title="Menu">
      <div className="p-4 space-y-6">
        {/* Main Menu */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">Menu Utama</h3>
          <div className="space-y-2">
            {mainMenuItems.map((item, index) => (
              <div key={item.path} className="animate-slide-up" style={{ animationDelay: `${index * 30}ms` }}>
                <MenuItem {...item} />
              </div>
            ))}
          </div>
        </div>

        {/* Reports & Monitoring */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">Laporan & Monitoring</h3>
          <div className="space-y-2">
            {reportMenuItems.map((item, index) => (
              <div key={item.path} className="animate-slide-up" style={{ animationDelay: `${(index + mainMenuItems.length) * 30}ms` }}>
                <MenuItem {...item} />
              </div>
            ))}
          </div>
        </div>

        {/* Account */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">Akun & Pengaturan</h3>
          <div className="space-y-2">
            {accountMenuItems.map((item, index) => (
              <div key={item.path} className="animate-slide-up" style={{ animationDelay: `${(index + mainMenuItems.length + reportMenuItems.length) * 30}ms` }}>
                <MenuItem {...item} />
              </div>
            ))}
          </div>
        </div>

        {/* Logout */}
        <Card 
          className="cursor-pointer border-destructive/20 hover:bg-destructive/5 active:scale-[0.98] transition-all"
          onClick={handleLogout}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-destructive/10">
              <LogOut className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-destructive">Keluar</p>
              <p className="text-xs text-muted-foreground">Logout dari aplikasi</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
