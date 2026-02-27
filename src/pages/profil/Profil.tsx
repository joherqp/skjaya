import { useState, useEffect, FormEvent } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { formatTanggal } from '@/lib/utils';
import {
  User, Mail, Phone, MapPin, Calendar, Shield,
  Edit, LogOut, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useDatabase } from '@/contexts/DatabaseContext';

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  owner: 'Owner',
  gudang: 'Gudang',
  leader: 'Leader',
  sales: 'Sales',
  staff: 'Staff',
};

export default function Profil() {
  const { user, logout, updatePassword } = useAuth();
  const { karyawan, cabang: listCabang } = useDatabase(); // Get Karyawan data
  const navigate = useNavigate();

  const cabang = user?.cabangId ? listCabang.find(c => c.id === user.cabangId) : null;
  const linkedKaryawan = karyawan.find(k => k.userAccountId === user?.id);

  const [isLoading, setIsLoading] = useState(false);

  // Helper functions
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };



  // Get Cabang from Karyawan data (priority) or User data
  const displayCabangId = linkedKaryawan?.cabangId || user?.cabangId;
  const displayCabang = displayCabangId ? listCabang.find(c => c.id === displayCabangId) : null;

  const profileItems = [
    { icon: User, label: 'Nama Lengkap', value: linkedKaryawan?.nama || user?.nama },
    { icon: User, label: 'Username', value: user?.username },
    { icon: Shield, label: 'Jabatan', value: linkedKaryawan?.posisi || '-' },
    { icon: Shield, label: 'Peran', value: user?.roles ? user.roles.map(r => roleLabels[r]).join(', ') : '-' },
    { icon: MapPin, label: 'Cabang', value: displayCabang?.nama || '-' },
    { icon: Phone, label: 'Telepon', value: linkedKaryawan?.telepon || user?.telepon || '-' },
    { icon: Mail, label: 'Email', value: user?.email || '-' }, // Email usually in Account

    // Detailed Location from Karyawan (New)
    { icon: MapPin, label: 'Alamat', value: linkedKaryawan?.alamat || '-' },
    { icon: MapPin, label: 'Kota/Kab', value: linkedKaryawan?.kota ? `${linkedKaryawan.kota}, ${linkedKaryawan.provinsi || ''}` : '-' },
  ];

  return (
    <MainLayout title="Profil">
      <div className="p-4 space-y-5">
        {/* Profile Header */}
        <Card elevated className="overflow-hidden">
          <div className="h-20 gradient-hero" />
          <CardContent className="relative pb-5">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2">
              <Avatar className="w-20 h-20 border-4 border-card shadow-lg">
                <AvatarImage src={user?.avatarUrl} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {user ? getInitials(user.nama) : 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="pt-12 text-center">
              <h2 className="text-xl font-bold">{linkedKaryawan?.nama || user?.nama}</h2>
              <Badge variant="default" className="mt-2">
                {user?.roles ? user.roles.map(r => roleLabels[r]).join(', ') : '-'}
              </Badge>
              <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1">
                <MapPin className="w-3 h-3" />
                {displayCabang?.nama || '-'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Profile Details */}
        <Card elevated>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Informasi Akun</CardTitle>
              {/* Edit disallowed as per requirement: "Informasi Akun tidak bisa di ubah" */}
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Terproteksi
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {profileItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={index}
                  className="flex items-center gap-3 py-2 animate-slide-up"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-medium">{item.value || '-'}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-2">


          <Card
            className="cursor-pointer border-destructive/20 hover:bg-destructive/5 transition-all"
            onClick={handleLogout}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <LogOut className="w-4 h-4 text-destructive" />
                </div>
                <span className="text-sm font-medium text-destructive">Keluar</span>
              </div>
              <ChevronRight className="w-4 h-4 text-destructive" />
            </CardContent>
          </Card>
        </div>

        {/* App Version */}
        <p className="text-center text-xs text-muted-foreground pt-4">
          CVSKJ v1.0.0
        </p>
      </div>
    </MainLayout>
  );
}
