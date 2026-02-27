import { useState, useEffect } from 'react';
import { Menu, Bell, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

  export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
    const { user, logout } = useAuth();
    const { notifikasi, markNotifikasiRead, refresh, isRefreshing } = useDatabase();
    const navigate = useNavigate();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userNotifikasi = notifikasi
    .filter(n => n.userId === user?.id && !n.dibaca)
    .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
    
  const unreadCount = userNotifikasi.length;

  const handleNotifClick = (id: string, link?: string) => {
      markNotifikasiRead(id);
      if (link) navigate(link);
  };
    
    return (
      <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b px-4 h-14 flex items-center justify-between lg:hidden shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onMenuClick} className="-ml-2">
            <Menu className="w-5 h-5 text-gray-700" />
          </Button>
          <div 
            onClick={() => refresh()}
            className={cn(
              "w-9 h-9 logo-round transition-all",
              isRefreshing && "animate-spin"
            )}
            style={isRefreshing ? { animationDuration: '3s' } : undefined}
          >
            <span className="logo-text text-sm">SKJ</span>
          </div>
        
        {/* Placeholder for the redacted block or just Title */}
        <div className="h-6 w-20 bg-teal-600/10 rounded hidden sm:block"></div> 
      </div>
      
      <div className="flex items-center gap-2">
        
        {/* Notification Dropdown */}
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-gray-500">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                          {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                  )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[90vw] sm:w-[350px] p-0 mr-1 mt-1">
                <DropdownMenuLabel className="px-4 py-3 border-b flex justify-between items-center bg-gray-50/50">
                    <span>Notifikasi ({unreadCount})</span>
                </DropdownMenuLabel>
                <div className="max-h-[60vh] overflow-y-auto">
                    {unreadCount === 0 ? (
                        <div className="p-8 text-center flex flex-col items-center text-muted-foreground gap-2">
                             <Bell className="w-8 h-8 opacity-20" />
                            <span className="text-sm">Tidak ada notifikasi baru</span>
                        </div>
                    ) : (
                        userNotifikasi.map(n => (
                            <DropdownMenuItem 
                                key={n.id} 
                                className="px-4 py-3 border-b last:border-0 cursor-pointer items-start gap-3 transition-colors hover:bg-muted/50 focus:bg-muted/50"
                                onClick={() => handleNotifClick(n.id, n.link)}
                            >
                                <div className={`w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0 ring-2 ring-white ${
                                    n.jenis === 'success' ? 'bg-green-500' : 
                                    n.jenis === 'error' ? 'bg-red-500' : 
                                    n.jenis === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                                }`} />
                                <div className="flex-1 space-y-1.5 min-w-0">
                                    <div className="flex justify-between items-start gap-2">
                                        <p className="text-sm font-semibold leading-tight text-foreground">{n.judul}</p>
                                        <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                                            {new Date(n.tanggal).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                                        {n.pesan}
                                    </p>
                                </div>
                            </DropdownMenuItem>
                        ))
                    )}
                </div>
                <div className="p-2 border-t bg-gray-50/50 text-center">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs w-full h-8 hover:bg-transparent text-primary"
                        onClick={() => navigate('/notifikasi')}
                    >
                        Lihat Semua Notifikasi
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="w-8 h-8 bg-teal-600 cursor-pointer">
                <AvatarFallback className="bg-teal-600 text-white text-xs">
                  {user?.nama?.charAt(0) || 'A'}
                </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Akun Saya</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profil')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Keluar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Connection Indicator */}
        <div 
            className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'} ring-2 ring-white shadow-sm flex-shrink-0`}
            title={isOnline ? "Terhubung" : "Terputus"}
        />
      </div>
    </div>
  );
}
