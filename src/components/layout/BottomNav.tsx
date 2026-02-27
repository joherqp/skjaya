
import { Home, Package, Users, ShoppingCart, Menu, Wallet } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface BottomNavProps {
  onMenuClick: () => void;
}

export function BottomNav({ onMenuClick }: BottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Beranda', path: '/beranda' },
    { icon: Package, label: 'Barang', path: '/barang' },
    { icon: Users, label: 'Pelanggan', path: '/pelanggan' },
    { icon: ShoppingCart, label: 'Penjualan', path: '/penjualan' },
    { icon: Wallet, label: 'Setoran', path: '/setoran' },
  ];

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 flex items-center justify-around z-50 pb-safe">
      {navItems.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={cn(
            "flex flex-col items-center justify-center w-full h-full gap-1",
            isActive(item.path) ? "text-teal-600" : "text-gray-400 hover:text-gray-600"
          )}
        >
          <item.icon className={cn("w-5 h-5", isActive(item.path) && "fill-current")} />
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
