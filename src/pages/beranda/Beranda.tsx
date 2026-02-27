import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import {
  Package, Users, ShoppingCart, Wallet, Clock, TrendingUp,
  AlertCircle, CheckCircle, ArrowRight, MapPin, BarChart,
  ScanLine, X, QrCode
} from 'lucide-react';
import { Html5Qrcode } from "html5-qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatRupiah, formatTanggal, formatNumber, formatCompactRupiah, formatCompactNumber, formatKarton } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Target, User, Users as UsersIcon } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth
} from 'date-fns';

interface SalesTargetDB {
  id: string;
  jenis: 'bulanan' | 'mingguan' | 'harian';
  target_type: 'nominal' | 'qty';
  nilai: number;
  scope: 'cabang' | 'sales';
  cabang_id?: string;
  sales_id?: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  is_looping: boolean;
}

export default function Beranda() {
  const { user } = useAuth();
  const [activeTargets, setActiveTargets] = useState<SalesTargetDB[]>([]);
  const [expandedTargets, setExpandedTargets] = useState<Record<string, boolean>>({});
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    const fetchTargets = async () => {
      try {

        const { data, error } = await supabase
          .from('sales_targets')
          .select('*')
          .eq('is_active', true);

        if (error) throw error;

        const now = new Date();
        const validTargets = (data as SalesTargetDB[])?.filter(t => {
          // Scope Check
          if (t.scope === 'sales' && t.sales_id !== user?.id) return false;
          if (t.scope === 'cabang' && t.cabang_id !== (user?.cabangId || '')) return false;

          // Date Check
          if (t.is_looping) return true;
          if (t.start_date && t.end_date) {
            const start = new Date(t.start_date);
            const end = new Date(t.end_date);
            return now >= start && now <= end;
          }
          if (t.start_date && !t.end_date) {
            return now >= new Date(t.start_date);
          }

          return true;
        }) || [];

        setActiveTargets(validTargets);
      } catch (err) {
        console.error('Error fetching targets', err);
      }
    };

    if (user?.roles.includes('sales')) {
      fetchTargets();
    }
  }, [user]);
  const {
    barang, pelanggan, penjualan, setoran, absensi, persetujuan,
    karyawan, cabang: cabangList, stokPengguna, users, saldoPengguna,
    viewMode, setViewMode
  } = useDatabase();
  const navigate = useNavigate();

  const today = new Date();
  const todayStr = today.toDateString();

  // Find linked Karyawan for Name & Cabang info
  const linkedKaryawan = karyawan.find(k => k.userAccountId === user?.id);
  const cabangId = linkedKaryawan?.cabangId || user?.cabangId;
  const cabang = cabangId ? cabangList.find(c => c.id === cabangId) : null;
  // Fallback location name if no cabang
  const locationName = cabang?.nama || 'Lokasi Belum Diatur';

  // Check today's attendance
  const todayAbsensi = absensi.find(a =>
    a.userId === user?.id &&
    new Date(a.tanggal).toDateString() === todayStr
  );

  // Role & Scope Logic
  const isAdminOrOwner = user?.roles.includes('admin') || user?.roles.includes('owner');
  const isLeader = user?.roles.includes('leader');

  // Filter Penjualan based on role & View Mode
  const scopedPenjualan = penjualan.filter(p => {
    if (isAdminOrOwner) {
      if (viewMode === 'me') return p.salesId === user?.id || p.createdBy === user?.id;
      return true;
    }

    // For regular sales (not leader), prioritize showing their own sales
    if (!isLeader) {
      return p.salesId === user?.id;
    }

    // For Leader, enforce Cabang check
    if (p.cabangId !== cabangId) return false;

    if (viewMode === 'me') return p.salesId === user?.id || p.createdBy === user?.id;
    return true;
  });

  // Filter Persetujuan based on actionable items (Inbox)
  const scopedPersetujuan = persetujuan.filter(p => {
    if (p.status !== 'pending') return false;
    if (p.diajukanOleh === user?.id) return false; // Actionable means others need to approve it

    let isTarget = true;
    if (p.targetUserId) {
      if (p.targetUserId !== user?.id) isTarget = false;
    } else {
      const isSuperUser = isAdminOrOwner;
      if (p.targetRole && !user?.roles.includes(p.targetRole) && !isSuperUser) isTarget = false;
      if (p.targetCabangId && !isSuperUser && p.targetCabangId !== cabangId) isTarget = false;
    }

    return isTarget;
  });

  // -- Refined Low Stock Logic (Demand-Based) --
  const { lowStockItemsCount, highDemandLowStock } = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Base Sales Data
    const relevantSales = penjualan.filter(p =>
      new Date(p.tanggal) >= thirtyDaysAgo &&
      p.status !== 'batal' &&
      (isAdminOrOwner ? true : p.salesId === user?.id)
    );

    const items = barang.filter(b => b.isActive !== false).map(b => {
      // A. Determine current stock based on role
      let currentStock = 0;
      if (isAdminOrOwner) {
        currentStock = stokPengguna
          .filter(s => s.barangId === b.id)
          .reduce((sum, s) => sum + s.jumlah, 0);
      } else {
        const userStock = stokPengguna.find(s => s.barangId === b.id && s.userId === user?.id);
        currentStock = userStock ? userStock.jumlah : 0;
      }

      // B. Calculate Velocity
      let totalSold = 0;
      relevantSales.forEach(sale => {
        const item = sale.items.find(i => i.barangId === b.id);
        if (item) totalSold += item.jumlah;
      });

      const avgDailySales = totalSold / 30;
      const daysCoverage = avgDailySales > 0 ? currentStock / avgDailySales : 999;

      // C. Hybrid Status
      let status: 'aman' | 'warning' | 'critical' = 'aman';
      if (totalSold > 0) {
        if (daysCoverage < 7) status = 'critical';
        else if (daysCoverage < 14) status = 'warning';
      }

      if (status === 'aman') {
        if (currentStock <= b.minStok * 0.5) status = 'critical';
        else if (currentStock <= b.minStok) status = 'warning';
      }

      return {
        ...b,
        currentStock,
        avgDailySales,
        daysCoverage,
        status,
        totalSold
      };
    });

    const lowStockList = items.filter(i => i.status !== 'aman');

    // D. Prioritize High Demand for the Dashboard List
    const highDemand = lowStockList
      .filter(i => i.totalSold > 0) // Must have sales to be "demand-based"
      .sort((a, b) => b.totalSold - a.totalSold) // Sort by most sold
      .slice(0, 3);

    return {
      lowStockItemsCount: lowStockList.length,
      highDemandLowStock: highDemand
    };
  }, [barang, stokPengguna, penjualan, user, isAdminOrOwner]);

  // Stats
  const validPenjualanHariIni = scopedPenjualan
    .filter(p => new Date(p.tanggal).toDateString() === todayStr && p.status !== 'batal' && p.status !== 'draft');

  const totalPenjualanHariIni = validPenjualanHariIni.reduce((sum, p) => sum + p.total, 0);

  const totalQtyHariIni = validPenjualanHariIni
    .reduce((sum, p) => sum + p.items
      .filter(i => !i.isBonus && i.subtotal > 0) // Align with RekapPenjualan logic
      .reduce((s, i) => s + (i.jumlah * (i.konversi || 1)), 0), 0);

  const totalNotaHariIni = validPenjualanHariIni.length;

  const pendingApprovals = scopedPersetujuan.length;
  const lowStockItems = lowStockItemsCount;

  // const cabang = user?.cabangId ? getCabangById(user.cabangId) : null; // Removed old logic

  const quickActions = [
    {
      label: 'Scan QR',
      icon: QrCode,
      path: '#scan',
      color: 'bg-primary/10 text-primary',
      onClick: () => setIsScannerOpen(true),
      badge: 0
    },
    // Buat Nota only for Sales
    ...(user?.roles?.includes('sales') ? [{
      label: 'Buat Nota',
      icon: ShoppingCart,
      path: '/penjualan/buat',
      color: 'bg-success/10 text-success',
      badge: 0
    }] : []),
    // Laporan for Non-Sales (e.g. Admin, Owner, Leader)
    ...(!user?.roles?.includes('sales') ? [{
      label: 'Laporan',
      icon: BarChart,
      path: '/laporan',
      color: 'bg-purple-500/10 text-purple-500',
      badge: 0
    }] : []),
    {
      label: 'Setoran',
      icon: Wallet,
      path: '/setoran',
      color: 'bg-warning/10 text-warning',
      badge: 0
    },
    {
      label: 'Pelanggan',
      icon: Users,
      path: '/pelanggan',
      color: 'bg-primary/10 text-primary',
      badge: 0
    },
  ];

  const stats = [
    {
      label: 'Omset Hari Ini',
      value: formatRupiah(totalPenjualanHariIni),
      icon: TrendingUp,
      color: 'text-success',
      path: '/penjualan/rekap'
    },
    {
      label: 'Qty Produk Terjual',
      value: formatNumber(totalQtyHariIni) + ' Bks',
      icon: Package,
      color: 'text-purple-600',
      path: '/penjualan/rekap'
    },
    {
      label: 'Total Nota',
      value: totalNotaHariIni.toString(),
      icon: ShoppingCart,
      color: 'text-blue-600',
      path: '/penjualan/rekap'
    },
    {
      label: 'Stok Menipis',
      value: lowStockItems.toString(),
      icon: AlertCircle,
      color: lowStockItems > 0 ? 'text-warning' : 'text-muted-foreground',
      path: '/barang'
    },
    {
      label: 'Perlu Persetujuan',
      value: pendingApprovals.toString(),
      icon: CheckCircle,
      color: pendingApprovals > 0 ? 'text-info' : 'text-muted-foreground',
      path: '/persetujuan'
    },
  ];



  const getGreeting = () => {
    const hour = today.getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  return (
    <MainLayout>
      <div className="p-4 space-y-5">
        {/* Welcome Card */}
        <Card className="gradient-hero text-primary-foreground overflow-hidden">
          <CardContent className="p-5 relative">
            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-primary-foreground/10" />
            <div className="absolute -right-5 -bottom-10 w-32 h-32 rounded-full bg-primary-foreground/5" />

            <div className="flex justify-between items-start relative z-10">
              <div className="space-y-0.5">
                <p className="text-primary-foreground/80 text-[10px] font-bold uppercase tracking-wider">{getGreeting()}</p>
                <h2 className="text-xl font-bold">{linkedKaryawan?.nama || user?.nama}</h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-primary-foreground/90 flex items-center gap-1 font-bold bg-primary-foreground/20 px-2 py-0.5 rounded-md uppercase">
                    <MapPin className="w-3 h-3" />
                    {locationName}
                  </span>
                </div>
              </div>

              {/* View Mode Toggle - Hidden for Owner (Auto All) */}
              {((isAdminOrOwner || isLeader) && !user?.roles.includes('owner')) && (
                <div className="flex flex-col items-center gap-1.5 p-1 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
                  <Switch
                    id="view-mode"
                    checked={viewMode === 'all'}
                    onCheckedChange={(checked) => setViewMode(checked ? 'all' : 'me')}
                    className="scale-90 data-[state=checked]:bg-gray-300 data-[state=unchecked]:bg-gray-300"
                  />
                  <Label htmlFor="view-mode" className="text-[9px] font-bold text-white uppercase tracking-tighter">
                    {viewMode === 'all' ? 'Team' : 'Saya'}
                  </Label>
                </div>
              )}
            </div>

            <div className="relative mt-4">
              <p className="text-[10px] text-primary-foreground/70 font-semibold uppercase tracking-wider">
                {today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Alert */}
        {!todayAbsensi && (
          <Card elevated className="border-warning/30 bg-warning/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Anda belum absen hari ini</p>
                <p className="text-xs text-muted-foreground">Tap untuk melakukan absensi</p>
              </div>
              <Button size="sm" onClick={() => navigate('/absensi')}>
                Absen
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Sales Targets */}
        {activeTargets.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground px-1">Target Penjualan</h3>
            <div className="grid gap-3">
              {activeTargets.map((target) => {
                // Determine Period
                let startDate: Date;
                let endDate: Date;

                if (target.is_looping) {
                  const now = new Date();
                  if (target.jenis === 'harian') {
                    startDate = startOfDay(now);
                    endDate = endOfDay(now);
                  } else if (target.jenis === 'mingguan') {
                    startDate = startOfWeek(now, { weekStartsOn: 1 });
                    endDate = endOfWeek(now, { weekStartsOn: 1 });
                  } else { // bulanan
                    startDate = startOfMonth(now);
                    endDate = endOfMonth(now);
                  }
                } else {
                  startDate = new Date(target.start_date!);
                  endDate = new Date(target.end_date!);
                }

                // Filter Sales
                const actualSales = penjualan.filter(p => {
                  const pDate = new Date(p.tanggal);
                  // Ensure only 'lunas' transactions are counted AND fully paid (isLunas)
                  // For tempo, isLunas must be true. For others (tunai), it's implicitly true.
                  // CRITICAL: Exclude 'batal' and 'draft'
                  if (p.status === 'batal' || p.status === 'draft') return false;

                  const isPaid = p.isLunas === true || (p.metodePembayaran !== 'tempo' && p.status === 'lunas');
                  const inDate = pDate >= startDate && pDate <= endDate && isPaid;

                  if (!inDate) return false;

                  if (target.scope === 'sales') {
                    return p.salesId === target.sales_id;
                  }
                  if (target.scope === 'cabang') {
                    return p.cabangId === target.cabang_id;
                  }
                  return false;
                });

                const currentAmount = target.target_type === 'nominal'
                  ? actualSales.reduce((sum, p) => sum + p.total, 0)
                  : actualSales.reduce((sum, p) => sum + (p.items as any[])
                    .filter(i => i.harga > 0 && !i.promoId && !i.isBonus) // Exclude free items (bonuses/promos)
                    .reduce((s, i) => s + (i.jumlah * (i.konversi || 1)), 0), 0);

                const percentage = Math.min(100, Math.round((currentAmount / target.nilai) * 100));
                const isWarning = percentage < 50 && new Date() > new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2);

                return (
                  <Card key={target.id} elevated className={`cursor-pointer hover:bg-muted/10 active:scale-[0.98] transition-all ${isWarning ? 'border-warning/50' : ''}`} onClick={() => navigate('/laporan/sales-performance')}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Target className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-sm capitalize">{target.jenis} ({target.target_type})</p>
                              {target.scope === 'sales' ? (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0 rounded font-bold uppercase">Personal</span>
                              ) : (
                                <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0 rounded font-bold uppercase">Cabang/Team</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatTanggal(startDate)} - {formatTanggal(endDate)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right cursor-pointer select-none" onClick={() => setExpandedTargets(prev => ({ ...prev, [target.id]: !prev[target.id] }))}>
                          <p className="font-bold text-sm">
                            {expandedTargets[target.id]
                              ? (target.target_type === 'nominal' ? formatRupiah(currentAmount) : formatNumber(currentAmount))
                              : (target.target_type === 'nominal' ? formatCompactRupiah(currentAmount) : formatKarton(currentAmount))}
                            <span className="text-muted-foreground font-normal"> / {expandedTargets[target.id]
                              ? (target.target_type === 'nominal' ? formatRupiah(target.nilai) : formatNumber(target.nilai))
                              : (target.target_type === 'nominal' ? formatCompactRupiah(target.nilai) : formatKarton(target.nilai))}</span>
                          </p>
                          <p className={`text-xs font-semibold ${percentage >= 100 ? 'text-success' : 'text-primary'}`}>
                            {percentage}% Tercapai
                          </p>
                        </div>
                      </div>
                      <Progress value={percentage} className={`h-2 ${percentage >= 100 ? 'bg-success/20' : ''}`} />
                      {isWarning && (
                        <div className="flex items-center gap-2 text-xs text-warning">
                          <AlertCircle className="w-3 h-3" />
                          <span>Perlu ditingkatkan untuk mencapai target</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.path}
                onClick={action.onClick || (() => navigate(action.path))}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border/50 hover:shadow-md transition-all active:scale-95"
              >
                <div className={`p-2.5 rounded-xl ${action.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-center">{action.label}</span>
                {action.badge > 0 && (
                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                    {action.badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {/* Stats */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">Ringkasan</h3>
          <div className="grid gap-3">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card
                  key={index}
                  elevated
                  className="animate-slide-up cursor-pointer active:scale-[0.98] transition-all hover:bg-muted/10"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => navigate(stat.path)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`p-3 rounded-xl bg-muted ${stat.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-lg font-bold mt-0.5">{stat.value}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* High Demand Low Stock List */}
        {highDemandLowStock.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground px-1 flex items-center justify-between">
              <span>Permintaan Tinggi & Stok Menipis</span>
              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary" onClick={() => navigate('/barang')}>
                Semua
              </Button>
            </h3>
            <div className="space-y-2">
              {highDemandLowStock.map((item, index) => (
                <Card key={item.id} className="animate-slide-up border-l-4 border-l-warning" style={{ animationDelay: `${index * 50}ms` }}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      {item.gambarUrl ? (
                        <img src={item.gambarUrl} alt={item.nama} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Package className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs truncate">{item.nama}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="muted" className="text-[9px] px-1 py-0 h-4">
                          {item.totalSold} terjual / 30hr
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Sisa: {formatNumber(item.currentStock)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <Badge variant={item.status === 'critical' ? 'destructive' : 'warning'} className="text-[9px] px-1 py-0 h-4 min-w-[60px] justify-center">
                        {item.daysCoverage < 1 ? '< 1 hari' : `${Math.round(item.daysCoverage)} hari`}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate(`/barang/${item.id}`)}>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Recent Sales */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-muted-foreground">Penjualan Terakhir</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/penjualan')}>
              Lihat Semua
            </Button>
          </div>
          <div className="space-y-2">
            {scopedPenjualan
              .filter(p => p.status !== 'batal' && p.status !== 'draft')
              .slice(0, 3)
              .map((p, index) => {
                const customerName = pelanggan.find(pel => pel.id === p.pelangganId)?.nama || 'Pelanggan Umum';
                return (
                  <Card key={p.id} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{customerName}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.nomorNota} • {formatTanggal(p.tanggal)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{formatRupiah(p.total)}</p>
                        <Badge variant={p.status === 'lunas' ? 'success' : 'muted'} className="text-[10px]">
                          {p.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>


        {/* Finance Monitoring Section */}

      </div>

      {isScannerOpen && (
        <QRScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </MainLayout>
  );
}

function QRScannerModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState<'camera' | 'gallery'>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const { penjualan } = useDatabase();

  const handleScanSuccess = useCallback((decodedText: string) => {
    if (decodedText.startsWith('JBR-PST-')) {
      const id = decodedText.replace('JBR-PST-', '');
      toast.success("QR Berhasil dipindai!");
      onClose();
      navigate(`/persetujuan?id=${id}`);
    } else if (decodedText.startsWith('JBR-NOTA-')) {
      const notaNum = decodedText.replace('JBR-NOTA-', '');
      const trx = penjualan.find(p => p.nomorNota === notaNum);

      if (trx) {
        toast.success("Nota berhasil ditemukan!");
        onClose();
        navigate(`/penjualan/${trx.id}`);
      } else {
        toast.error(`Nota ${notaNum} tidak ditemukan di database Anda.`);
      }
    } else {
      toast.error("QR Code tidak valid atau bukan format CVSKJ.");
    }
  }, [navigate, onClose, penjualan]);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (isOpen && activeMode === 'camera') {

      const startScanner = async () => {
        // Wait a bit for Dialog animation/portal to settle
        await new Promise(resolve => setTimeout(resolve, 100));

        const element = document.getElementById("reader");
        if (!element) {
          console.warn("Reader element not found yet, retrying...");
          return;
        }

        try {
          setIsScanning(true);
          html5QrCode = new Html5Qrcode("reader");
          const config = { fps: 10, qrbox: { width: 250, height: 250 } };

          await html5QrCode?.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
              handleScanSuccess(decodedText);
            },
            () => { } // Ignore errors
          );
        } catch (err) {
          console.error("Failed to start scanner", err);
          // Only show toast if it's not a "not found" error which we already logged
          if (isOpen && activeMode === 'camera') {
            toast.error("Gagal mengakses kamera. Pastikan izin diberikan.");
          }
          setIsScanning(false);
        }
      };

      startScanner();
    }

    return () => {
      if (html5QrCode?.isScanning) {
        html5QrCode.stop().catch(err => console.error("Error stopping scanner", err));
      }
    };
  }, [isOpen, activeMode, handleScanSuccess]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const html5QrCode = new Html5Qrcode("reader-hidden");
    try {
      const decodedText = await html5QrCode.scanFile(file, false);
      handleScanSuccess(decodedText);
    } catch (err) {
      console.error("Scan error", err);
      toast.error("Gagal membaca QR dari gambar. Pastikan gambar jelas.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            Scan QR Code Setoran
          </DialogTitle>
          <DialogDescription>
            Pindai QR Code pada laporan cetak untuk melihat detail persetujuan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex bg-muted p-1 rounded-lg">
            <button
              onClick={() => setActiveMode('camera')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeMode === 'camera' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}
            >
              Kamera
            </button>
            <button
              onClick={() => setActiveMode('gallery')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeMode === 'gallery' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}
            >
              Galeri / Upload
            </button>
          </div>

          <div className="relative aspect-square bg-black rounded-lg overflow-hidden border-2 border-primary/20">
            {activeMode === 'camera' ? (
              <>
                <div id="reader" className="w-full h-full"></div>
                {!isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs text-center p-4">
                    Menghubungkan ke kamera...
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-4">
                <div className="p-4 rounded-full bg-muted">
                  <Package className="w-10 h-10 text-muted-foreground/50" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Pilih dari Galeri</p>
                  <p className="text-xs">Upload screenshot atau foto QR Code</p>
                </div>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  <Button variant="secondary" size="sm" asChild>
                    <span>Pilih Gambar</span>
                  </Button>
                </label>
              </div>
            )}
            {/* Hidden element for file scanning */}
            <div id="reader-hidden" className="hidden"></div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
