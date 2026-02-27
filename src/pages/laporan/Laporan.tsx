import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Check if CardDescription needed
import { BarChart, Package, Calendar, DollarSign, FileText, CalendarDays, Target, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/lib/types';
import { WeeklyPettyCashDialog } from './components/WeeklyPettyCashDialog';
import { UangMakanBBMDialog } from './components/UangMakanBBMDialog';

export default function Laporan() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isPettyCashOpen, setIsPettyCashOpen] = useState(false);
  const [isUangMakanBBMOpen, setIsUangMakanBBMOpen] = useState(false);

  const reports = [
    {
      title: 'Rekap Penjualan',
      description: 'Rekap omzet, transaksi, dan performa sales',
      icon: BarChart,
      path: '/penjualan/rekap',
      color: 'text-primary',
      bg: 'bg-primary/10'
    },
    {
      title: 'Sales Performance',
      description: 'Progress target penjualan sales & cabang',
      icon: Target,
      path: '/laporan/sales-performance',
      color: 'text-violet-600',
      bg: 'bg-violet-100'
    },
    {
      title: 'Laporan Stok Barang',
      description: 'Posisi stok terkini dan nilai aset',
      icon: Package,
      path: '/laporan/stok',
      color: 'text-blue-600',
      bg: 'bg-blue-100'
    },
    {
      title: 'Laporan Absensi',
      description: 'Rekap kehadiran karyawan dan lokasi',
      icon: Calendar,
      path: '/laporan/absensi',
      color: 'text-orange-600',
      bg: 'bg-orange-100'
    },
    {
      title: 'Laporan Reimburse',
      description: 'Rekap pengajuan reimbursement dan status',
      icon: FileText,
      path: '/laporan/reimburse',
      color: 'text-pink-600',
      bg: 'bg-pink-100',
    },
    {
      title: 'Laporan Piutang',
      description: 'Sisa kredit pelanggan yang belum lunas',
      icon: DollarSign,
      path: '/laporan/piutang',
      color: 'text-red-600',
      bg: 'bg-red-100'
    },
    {
      title: 'Jadwal Harga & Promo',
      description: 'Riwayat & jadwal perubahan harga promo',
      icon: Calendar,
      path: '/laporan/jadwal-harga',
      color: 'text-indigo-600',
      bg: 'bg-indigo-100'
    },
    {
      title: 'Analisa Bisnis',
      description: 'Analisa visual dan pivot table interaktif',
      icon: BarChart,
      path: '/laporan/analisa',
      color: 'text-teal-600',
      bg: 'bg-teal-100',
      allowedRoles: ['admin', 'owner']
    },
    {
      title: 'Arsip Penjualan',
      description: 'Cari data penjualan lama (Database)',
      icon: CalendarDays,
      path: '/laporan/arsip-penjualan',
      color: 'text-slate-600',
      bg: 'bg-slate-100',
      allowedRoles: ['admin', 'owner']
    }
  ].filter(report => !report.allowedRoles || (user?.roles && report.allowedRoles.some(r => user.roles.includes(r as UserRole))));

  return (
    <MainLayout title="Laporan">
      <div className="p-4 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {reports.map((report, index) => (
          <Card
            key={index}
            className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1"
            onClick={() => navigate(report.path)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {report.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${report.bg}`}>
                <report.icon className={`h-4 w-4 ${report.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mt-2">
                {report.description}
              </p>
            </CardContent>
          </Card>
        ))}


        {/* Petty Cash Card - Finance Only */}
        {user?.roles.some(r => ['admin', 'owner', 'finance'].includes(r)) && (
          <Card
            className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 border-pink-200 bg-pink-50/50"
            onClick={() => setIsPettyCashOpen(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Laporan Weekly Petty Cash
              </CardTitle>
              <div className="p-2 rounded-full bg-pink-100">
                <FileText className="h-4 w-4 text-pink-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mt-2">
                Cetak laporan petty cash mingguan
              </p>
            </CardContent>
          </Card>
        )}

        {/* Uang Makan & BBM Card - Finance/Admin/Owner */}
        {user?.roles.some(r => ['admin', 'owner', 'finance'].includes(r)) && (
          <Card
            className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 border-blue-200 bg-blue-50/50"
            onClick={() => setIsUangMakanBBMOpen(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Laporan Uang Makan & BBM
              </CardTitle>
              <div className="p-2 rounded-full bg-blue-100">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mt-2">
                Rekap & Pembayaran Uang Makan Mingguan
              </p>
            </CardContent>
          </Card>
        )}

        {/* LPPU Card */}
        <Card
          className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 border-green-200 bg-green-50/50"
          onClick={() => navigate('/laporan/penjualan')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Laporan Harian (LPPU)
            </CardTitle>
            <div className="p-2 rounded-full bg-green-100">
              <FileText className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mt-2">
              Laporan Penjualan & Penerimaan Uang (Detail)
            </p>
          </CardContent>
        </Card>

        {/* Laporan Harian Konsolidasi Card */}
        <Card
          className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 border-purple-200 bg-purple-50/50"
          onClick={() => navigate('/laporan/harian')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Laporan Harian (Konsolidasi)
            </CardTitle>
            <div className="p-2 rounded-full bg-purple-100">
              <BarChart3 className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mt-2">
              Ringkasan Stok, Penjualan & Kas (Satu Halaman)
            </p>
          </CardContent>
        </Card>

      </div>

      <WeeklyPettyCashDialog
        open={isPettyCashOpen}
        onOpenChange={setIsPettyCashOpen}
      />

      <UangMakanBBMDialog
        open={isUangMakanBBMOpen}
        onOpenChange={setIsUangMakanBBMOpen}
      />

    </MainLayout>
  );
}
