import { useState, useRef, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Notifikasi() {
  const { user } = useAuth();
  const { notifikasi, markNotifikasiRead, markAllNotifikasiRead } = useDatabase();
  const [displayLimit, setDisplayLimit] = useState(10);
  const navigate = useNavigate();


  const userNotifikasi = notifikasi
    .filter(n => n.userId === user?.id)
    .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());



  // Infinite scroll observer


  const unreadCount = userNotifikasi.filter(n => !n.dibaca).length;

  const getIcon = (jenis: string) => {
    switch (jenis) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return <Info className="w-5 h-5 text-info" />;
    }
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    return `${days} hari lalu`;
  };

  const handleNotifikasiClick = (notif: typeof userNotifikasi[0]) => {
    markNotifikasiRead(notif.id);
    if (notif.link) {
      let targetLink = notif.link;
      
      // If notification is already processed (Success/Error type) and links to Persetujuan, 
      // redirect to the history tab.
      if ((notif.jenis === 'success' || notif.jenis === 'error') && targetLink.includes('/persetujuan')) {
          targetLink = '/persetujuan?tab=riwayat';
      }

      // If notification is for Penjualan and is processed, go to Rekap
      if ((notif.jenis === 'success' || notif.jenis === 'error') && targetLink === '/penjualan') {
          targetLink = '/penjualan/rekap';
      }
      
      navigate(targetLink);
    }
  };

  return (
    <MainLayout title="Notifikasi">
      <div className="p-4 space-y-4">
        {/* Header */}
        {unreadCount > 0 && (
          <div className="flex items-center justify-between">
            <Badge variant="default">{unreadCount} belum dibaca</Badge>
            <Button variant="ghost" size="sm" onClick={markAllNotifikasiRead}>
              <CheckCheck className="w-4 h-4 mr-1" />
              Tandai semua dibaca
            </Button>
          </div>
        )}

        {/* Notification List */}
        {userNotifikasi.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground/50" />
              <p className="mt-3 text-muted-foreground">Tidak ada notifikasi</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <>
            {userNotifikasi.slice(0, displayLimit).map((notif, index) => (
              <Card 
                key={notif.id}
                elevated={!notif.dibaca}
                className={`cursor-pointer transition-all animate-slide-up ${
                  !notif.dibaca ? 'border-primary/30 bg-primary/5' : ''
                }`}
                style={{ animationDelay: `${index * 30}ms` }}
                onClick={() => handleNotifikasiClick(notif)}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    notif.jenis === 'success' ? 'bg-success/10' :
                    notif.jenis === 'warning' ? 'bg-warning/10' :
                    notif.jenis === 'error' ? 'bg-destructive/10' : 'bg-info/10'
                  }`}>
                    {getIcon(notif.jenis)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${!notif.dibaca ? 'font-semibold' : 'font-medium'}`}>
                        {notif.judul.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      {!notif.dibaca && (
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {notif.pesan}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-2">
                      {getTimeAgo(notif.tanggal)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {userNotifikasi.length > displayLimit && (
                 <Button 
                     variant="ghost" 
                     className="w-full mt-4 border-dashed text-muted-foreground"
                     onClick={() => setDisplayLimit(prev => prev + 10)}
                 >
                     Lihat Lainnya
                 </Button>
            )}
            </>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
