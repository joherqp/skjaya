
import {
  Home,
  Clock,
  Package,
  Users,
  ShoppingCart,
  Wallet,
  CheckCircle,
  BarChart,
  Activity,
  Settings,
  X,
  FileText,
  CheckSquare,
  Coins,
  Inbox
} from 'lucide-react';
import { cn, cleanCompanyName } from '@/lib/utils';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface SidebarProps {
  className?: string;
  onClose?: () => void;
  isCollapsed?: boolean;
}

export function Sidebar({ className, onClose, isCollapsed = false }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { refresh, isRefreshing, cabang, profilPerusahaan } = useDatabase();

  // Dynamic Branch Name
  const userCabang = cabang.find(c => c.id === user?.cabangId);
  const branchName = userCabang ? userCabang.nama : 'Pusat';

  const menuItems = [
    { icon: Home, label: 'Beranda', path: '/beranda' },
    { icon: Inbox, label: 'Kotak Masuk', path: '/persetujuan' },
    { icon: Clock, label: 'Absensi', path: '/absensi' },
    { icon: Package, label: 'Barang', path: '/barang' },
    { icon: Users, label: 'Pelanggan', path: '/pelanggan' },
    { icon: ShoppingCart, label: 'Penjualan', path: '/penjualan' },
    { icon: Wallet, label: 'Setoran', path: '/setoran' },
    { icon: BarChart, label: 'Laporan', path: '/laporan' },

    // Reimbursement & Petty Cash - Hidden for owner
    ...(!user?.roles?.includes('owner') ? [
      { icon: FileText, label: 'Reimburse', path: '/reimburse' },
    ] : []),
    ...(user?.roles?.some(r => ['admin', 'finance'].includes(r)) ? [
      { icon: Coins, label: 'Kas Kecil', path: '/petty-cash' },
    ] : []),

    // Only show Monitoring to Admin or Owner
    ...(user?.roles?.some(r => ['admin', 'owner'].includes(r)) ? [
      { icon: Activity, label: 'Monitoring', path: '/monitoring' }
    ] : []),
    // Only show Settings to Admin
    ...(user?.roles?.includes('admin') ? [
      { icon: Settings, label: 'Pengaturan', path: '/pengaturan' }
    ] : []),
  ];

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className={cn("flex flex-col h-full bg-[#1a202c] text-white transition-all duration-300", className, isCollapsed ? "w-20" : "w-64")}>
      {/* Header */}
      <div className={cn("flex items-center border-b border-white/10 h-16 transition-all", isCollapsed ? "justify-center px-0" : "justify-between px-4")}>
        <div className="flex items-center gap-2 overflow-hidden">
          <div
            onClick={() => refresh()}
            className={cn(
              "shrink-0 w-9 h-9 logo-round transition-all",
              isRefreshing && "animate-spin text-white"
            )}
            style={isRefreshing ? { animationDuration: '3s' } : undefined}
          >
            <span className="logo-text text-sm">SKJ</span>
          </div>
          {!isCollapsed && <span className="font-bold text-lg truncate tracking-tight">CVSKJ</span>}
        </div>
        {!isCollapsed && onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10 md:hidden">
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Profile Section */}
      <Link
        to="/profil"
        onClick={onClose}
        className={cn("mx-2 mt-4 rounded-xl flex items-center gap-3 transition-all cursor-pointer hover:bg-white/10", isCollapsed ? "p-2 justify-center bg-transparent" : "p-4 bg-white/5 mx-4")}
      >
        <Avatar className={cn("border border-teal-500/50 transition-all", isCollapsed ? "w-8 h-8" : "w-10 h-10")}>
          <AvatarImage src="" />
          <AvatarFallback className="bg-teal-500 text-white font-medium text-xs">{user?.nama?.charAt(0) || 'A'}</AvatarFallback>
        </Avatar>

        {!isCollapsed && (
          <div className="flex-1 overflow-hidden min-w-0">
            <p className="font-medium text-sm truncate">{user?.nama || 'Administrator'}</p>
            <Badge variant="secondary" className="bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 text-[10px] px-1 py-0 h-5 border-none shrink-0 mt-1">
              {user?.roles?.[0] || 'Admin'}
            </Badge>
            <span className="text-xs text-muted-foreground truncate mt-1 block" title={branchName}>{branchName}</span>
          </div>
        )}
      </Link>

      {/* Menu Items */}
      <ScrollArea className="flex-1 px-2 py-4">
        <div className="space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors mb-1",
                isActive(item.path)
                  ? "text-teal-400 bg-white/5"
                  : "text-gray-400 hover:text-white hover:bg-white/5",
                isCollapsed ? "justify-center" : ""
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          ))}
        </div>
      </ScrollArea>

      {!isCollapsed && (
        <div className="p-4 text-xs text-center text-gray-500 border-t border-white/10 whitespace-nowrap overflow-hidden">
          CVSKJ v1.0.0
        </div>
      )}
    </div>
  );
}
