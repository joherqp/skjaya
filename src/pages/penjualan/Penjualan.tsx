import { useState, useEffect, useRef, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Switch } from "@/components/ui/switch";
import { Search, Plus, ShoppingCart, Filter, Receipt, BarChart, Trophy, TrendingUp, Users, ChevronLeft, ChevronRight, User, Coins } from 'lucide-react';
import { formatRupiah, formatTanggal, cn, formatNumber } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { StatsSlideshow } from "@/components/penjualan/StatsSlideshow";

import { Barang, Pelanggan, Penjualan as PenjualanType, Satuan } from '@/lib/types';



export default function Penjualan() {
  const { user } = useAuth();
  const {
    penjualan, pelanggan, barang, satuan, users, karyawan,
    viewMode, setViewMode
  } = useDatabase();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const [displayLimit, setDisplayLimit] = useState(10);
  const [scopedSalesId, setScopedSalesId] = useState<string>('all');


  // Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterPayment, setFilterPayment] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isTunaiSummaryOpen, setIsTunaiSummaryOpen] = useState(false);
  const [isQtySummaryOpen, setIsQtySummaryOpen] = useState(false);
  const [isCreditSummaryOpen, setIsCreditSummaryOpen] = useState(false);

  const activeFiltersCount =
    (filterStartDate ? 1 : 0) +
    (filterEndDate ? 1 : 0) +
    (filterStatus.length > 0 ? 1 : 0) +
    (filterPayment.length > 0 ? 1 : 0);

  // ... [Scope Filtering Logic] ...
  // Scope Filtering: "Sub-database" logic
  const isAdminOrOwner = user?.roles.includes('admin') || user?.roles.includes('owner');
  const isLeader = user?.roles.includes('leader');

  // Determine effective sales ID for filtering
  // If viewMode is 'self', we always filter by user.id
  // If viewMode is 'all', we use scopedSalesId (which could be 'all' or a specific user)
  const effectiveSalesId = viewMode === 'me' ? (user?.id || 'all') : scopedSalesId;

  const scopedPenjualan = penjualan.filter(p => {
    if (isAdminOrOwner) {
      if (effectiveSalesId !== 'all' && p.salesId !== effectiveSalesId && p.createdBy !== effectiveSalesId) return false;
      return true;
    }
    if (p.cabangId !== user?.cabangId) return false;
    if (isLeader) {
      if (effectiveSalesId !== 'all' && p.salesId !== effectiveSalesId && p.createdBy !== effectiveSalesId) return false;
      return true;
    }
    return p.salesId === user?.id;
  });

  const filteredPenjualan = scopedPenjualan.filter(p => {
    const customer = pelanggan.find(c => c.id === p.pelangganId);

    // 1. Search
    const matchesSearch = p.nomorNota.toLowerCase().includes(search.toLowerCase()) ||
      customer?.nama.toLowerCase().includes(search.toLowerCase());

    // 2. Date Filter
    let matchesDate = true;
    if (filterStartDate || filterEndDate) {
      const pDate = new Date(p.tanggal);
      pDate.setHours(0, 0, 0, 0);

      if (filterStartDate) {
        const start = new Date(filterStartDate);
        start.setHours(0, 0, 0, 0);
        if (pDate < start) matchesDate = false;
      }
      if (filterEndDate && matchesDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999); // End of day
        const pDateEndOfDay = new Date(p.tanggal); // Use original time or normalize?
        // Comparison: pDate is date object.
        // Let's normalize pDate to 00:00:00 for strict day comparison or keep time?
        // Usually "End Date" means "Up to the end of that day".
        if (pDate > end) matchesDate = false;
      }
    }

    // 3. Status Filter
    const matchesStatus = filterStatus.length === 0 || filterStatus.includes(p.status);

    // 4. Payment Filter
    const matchesPayment = filterPayment.length === 0 || filterPayment.includes(p.metodePembayaran);

    return matchesSearch && matchesDate && matchesStatus && matchesPayment;
  })
    .sort((a, b) => {
      // Priority 1: Unpaid (Belum Lunas) first
      // Check if it's a credit sale that is NOT lunas
      const aUnpaid = a.metodePembayaran === 'tempo' && !a.isLunas;
      const bUnpaid = b.metodePembayaran === 'tempo' && !b.isLunas;

      if (aUnpaid && !bUnpaid) return -1;
      if (!aUnpaid && bUnpaid) return 1;

      // Priority 2: Newest Date first
      return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
    });

  // Infinite scroll observer


  const today = new Date();
  const todayStr = today.toDateString();

  // -- Data Summaries for Quick Stats --
  const summaryData = useMemo(() => {
    // 1. Tunai Hari Ini (Customers)
    const tunaiTodayList = scopedPenjualan.filter(p =>
      new Date(p.tanggal).toDateString() === todayStr &&
      p.status === 'lunas' &&
      p.metodePembayaran === 'tunai'
    );

    // Group by customer for the summary
    const tunaiByCustomer = tunaiTodayList.reduce((acc: Record<string, { name: string, total: number, count: number }>, p) => {
      const customer = pelanggan.find(c => c.id === p.pelangganId);
      const name = (customer?.nama || 'Umum').toUpperCase();
      if (!acc[p.pelangganId]) acc[p.pelangganId] = { name, total: 0, count: 0 };
      acc[p.pelangganId].total += p.total;
      acc[p.pelangganId].count += 1;
      return acc;
    }, {});

    const totalTunaiToday = tunaiTodayList.reduce((sum, p) => sum + p.total, 0);

    // 2. Total Qty (Products) Today
    const todaySelesaiList = scopedPenjualan.filter(p =>
      new Date(p.tanggal).toDateString() === todayStr &&
      p.status === 'lunas'
    );

    const productQtyMap = todaySelesaiList.reduce((acc: Record<string, { name: string, qty: number, unit: string }>, p) => {
      p.items.forEach(item => {
        const b = barang.find(x => x.id === item.barangId);
        if (!b) return;
        const unitName = satuan.find(s => s.id === b.satuanId)?.simbol || 'Unit';
        if (!acc[b.id]) acc[b.id] = { name: b.nama, qty: 0, unit: unitName };
        acc[b.id].qty += (item.totalQty !== undefined ? item.totalQty : (item.jumlah * (item.konversi || 1)));
      });
      return acc;
    }, {});

    const totalQtyAll = Object.values(productQtyMap).reduce((sum, p) => sum + p.qty, 0);

    // Group grand total by unit
    const qtyByUnit = Object.values(productQtyMap).reduce((acc: Record<string, number>, p) => {
      if (!acc[p.unit]) acc[p.unit] = 0;
      acc[p.unit] += p.qty;
      return acc;
    }, {});

    const qtySummaryStr = Object.entries(qtyByUnit)
      .map(([unit, qty]) => `${formatNumber(qty)} ${unit}`)
      .join(', ');

    // 3. Sisa Kredit (Debtors)
    // Filter customers who belong to the current user's scope and have debt
    const debtors = pelanggan.filter(p => {
      // Scope logic matching filteredPelanggan
      if (!isAdminOrOwner) {
        if (p.cabangId !== user?.cabangId) return false;
        if (!isLeader && p.salesId !== user?.id) return false;
      }
      return p.sisaKredit > 0;
    }).sort((a, b) => b.sisaKredit - a.sisaKredit);

    const totalPiutang = debtors.reduce((sum, p) => sum + p.sisaKredit, 0);

    return {
      totalTunaiToday,
      tunaiByCustomer: Object.values(tunaiByCustomer).sort((a, b) => b.total - a.total),
      totalQtyAll,
      qtySummaryStr,
      productQtyByVol: Object.values(productQtyMap).sort((a, b) => b.qty - a.qty),
      totalPiutang,
      debtors
    };
  }, [scopedPenjualan, pelanggan, barang, satuan, todayStr, user, isAdminOrOwner, isLeader]);

  return (
    <MainLayout title="Penjualan">
      <div className="p-4 space-y-4">
        {/* Management Filter: Team Switcher removed - moved to Beranda */}

        {/* Search & Actions */}
        <div className="flex gap-2">
          {/* ... [Search Inputs] ... */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari nota..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className={activeFiltersCount > 0 ? "border-primary text-primary relative" : ""}>
                <Filter className="w-4 h-4" />
                {activeFiltersCount > 0 && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span></span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium leading-none">Filter Penjualan</h4>
                  {(activeFiltersCount > 0) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-destructive text-xs"
                      onClick={() => {
                        setFilterStartDate('');
                        setFilterEndDate('');
                        setFilterStatus([]);
                        setFilterPayment([]);
                      }}
                    >
                      Reset
                    </Button>
                  )}
                </div>

                {/* Date Range */}
                <div className="space-y-3">
                  <Label>Tanggal</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground">Dari</span>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground">Sampai</span>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-3">
                  <Label>Status</Label>
                  <div className="space-y-2">
                    {['lunas', 'draft', 'batal'].map(status => (
                      <div key={status} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`status-${status}`}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={filterStatus.includes(status)}
                          onChange={(e) => {
                            if (e.target.checked) setFilterStatus([...filterStatus, status]);
                            else setFilterStatus(filterStatus.filter(s => s !== status));
                          }}
                        />
                        <label htmlFor={`status-${status}`} className="text-sm leading-none capitalize cursor-pointer">
                          {status}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Filter */}
                <div className="space-y-3">
                  <Label>Metode Pembayaran</Label>
                  <div className="space-y-2">
                    {['tunai', 'tempo', 'transfer'].map(method => (
                      <div key={method} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`pay-${method}`}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={filterPayment.includes(method)}
                          onChange={(e) => {
                            if (e.target.checked) setFilterPayment([...filterPayment, method]);
                            else setFilterPayment(filterPayment.filter(m => m !== method));
                          }}
                        />
                        <label htmlFor={`pay-${method}`} className="text-sm leading-none capitalize cursor-pointer">
                          {method}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Sales Filter (Only if in Team Mode) */}
                {(isAdminOrOwner || isLeader) && viewMode === 'all' && (
                  <div className="space-y-3">
                    <Label>Salesperson</Label>
                    <Select value={scopedSalesId} onValueChange={setScopedSalesId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Pilih Sales" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Sales</SelectItem>
                        {users.filter(u => {
                          if (isAdminOrOwner) return (u.roles.includes('sales') || u.roles.includes('leader')) && u.isActive !== false;
                          return (u.roles.includes('sales') || u.roles.includes('leader')) && u.cabangId === user?.cabangId && u.isActive !== false;
                        }).map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.nama.toUpperCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={() => navigate('/penjualan/rekap')}>
            <BarChart className="w-4 h-4" />
          </Button>
          {user?.roles.includes('sales') && (
            <Button size="icon" variant="glow" onClick={() => navigate('/penjualan/buat')}>
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Stats Slideshow */}
        <StatsSlideshow
          data={scopedPenjualan}
          pelanggan={pelanggan}
          barang={barang}
          satuan={satuan}
        />

        {/* ... [Rest of code] ... */}

        {/* Quick Stats Summaries */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="bg-success/5 border-success/20 cursor-pointer hover:bg-success/10 transition-colors" onClick={() => setIsTunaiSummaryOpen(true)}>
            <CardContent className="p-3 text-center">
              <p className="text-sm font-bold text-success truncate">
                {formatRupiah(summaryData.totalTunaiToday)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Tunai Hari Ini</p>
            </CardContent>
          </Card>
          <Card className="bg-warning/5 border-warning/20 cursor-pointer hover:bg-warning/10 transition-colors" onClick={() => setIsQtySummaryOpen(true)}>
            <CardContent className="p-3 text-center">
              <p className="text-sm font-bold text-warning truncate">
                {formatNumber(summaryData.totalQtyAll)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Qty Hari Ini</p>
            </CardContent>
          </Card>
          <Card className="bg-destructive/5 border-destructive/20 cursor-pointer hover:bg-destructive/10 transition-colors" onClick={() => setIsCreditSummaryOpen(true)}>
            <CardContent className="p-3 text-center">
              <p className="text-sm font-bold text-destructive truncate">
                {formatRupiah(summaryData.totalPiutang)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Sisa Kredit</p>
            </CardContent>
          </Card>
        </div>

        {/* Penjualan List */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">Riwayat Penjualan</h3>
          {filteredPenjualan.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Receipt className="w-12 h-12 mx-auto text-muted-foreground/50" />
                <p className="mt-3 text-muted-foreground">Tidak ada penjualan ditemukan</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {filteredPenjualan.slice(0, displayLimit).map((item, index) => {
                const customer = pelanggan.find(c => c.id === item.pelangganId);
                const customerName = (customer?.nama || 'Umum').toUpperCase();

                // Resolve Sales Name
                const salesId = item.salesId || item.createdBy;
                const linkedEmployee = karyawan.find(k => k.userAccountId === salesId);
                const salesPerson = users.find(u => u.id === salesId);
                const salesName = linkedEmployee?.nama || salesPerson?.nama || 'Sales';

                return (
                  <Card
                    key={item.id}
                    elevated
                    className="animate-slide-up cursor-pointer hover:border-primary/30"
                    style={{ animationDelay: `${index * 30}ms` }}
                    onClick={() => navigate(`/penjualan/${item.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-primary flex-shrink-0" />
                            <p className="font-semibold text-sm truncate">{item.nomorNota}</p>
                          </div>
                          <p className="text-sm mt-1 font-bold truncate">{customerName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Sales: {salesName}</p>

                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant={
                              item.status === 'lunas'
                                ? (item.isLunas ? 'success' : 'destructive')
                                : (item.status === 'draft' ? 'warning' : 'destructive')
                            }>
                              {item.status === 'lunas'
                                ? (item.isLunas ? 'LUNAS' : 'BELUM LUNAS')
                                : (item.status === 'draft' ? 'DRAFT' : 'BATAL')}
                            </Badge>
                            <Badge variant="muted">
                              {item.metodePembayaran.charAt(0).toUpperCase() + item.metodePembayaran.slice(1)}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold text-primary">
                            {formatRupiah(item.total)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTanggal(item.tanggal)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {filteredPenjualan.length > displayLimit && (
                <Button
                  variant="ghost"
                  className="w-full mt-4 border-dashed text-muted-foreground"
                  onClick={() => setDisplayLimit(prev => prev + 10)}
                >
                  Lihat Lainnya
                </Button>
              )}
            </>
          )}
        </div>
      </div>


      {/* -- Summary Dialogs -- */}

      {/* 1. Tunai Summary Dialog */}
      <Dialog open={isTunaiSummaryOpen} onOpenChange={setIsTunaiSummaryOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>Penjualan Tunai Hari Ini</DialogTitle>
            <DialogDescription>
              Ringkasan setoran tunai per pelanggan ({formatTanggal(today)})
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="px-4 pb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Pelanggan</TableHead>
                    <TableHead className="text-right text-xs">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryData.tunaiByCustomer.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">Belum ada penjualan tunai hari ini</TableCell>
                    </TableRow>
                  ) : (
                    summaryData.tunaiByCustomer.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs py-2">
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground">{item.count} Transaksi</p>
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-success">{formatRupiah(item.total)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {summaryData.tunaiByCustomer.length > 0 && (
                  <TableFooter className="bg-success/5 border-t">
                    <TableRow>
                      <TableCell className="text-xs font-bold py-3 text-foreground">Grand Total</TableCell>
                      <TableCell className="text-right text-xs font-bold py-3 text-success">
                        {formatRupiah(summaryData.totalTunaiToday)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* 2. Qty Summary Dialog */}
      <Dialog open={isQtySummaryOpen} onOpenChange={setIsQtySummaryOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>Ringkasan Produk Hari Ini</DialogTitle>
            <DialogDescription>
              Total kuantitas barang terjual hari ini ({formatTanggal(today)})
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="px-4 pb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Produk</TableHead>
                    <TableHead className="text-right text-xs">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryData.productQtyByVol.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">Belum ada produk terjual</TableCell>
                    </TableRow>
                  ) : (
                    summaryData.productQtyByVol.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs py-2 font-medium">{item.name}</TableCell>
                        <TableCell className="text-right text-xs font-bold">
                          {formatNumber(item.qty)} <span className="text-[10px] text-muted-foreground font-normal">{item.unit}</span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {summaryData.productQtyByVol.length > 0 && (
                  <TableFooter className="bg-muted/50 border-t">
                    <TableRow>
                      <TableCell className="text-xs font-bold py-3 text-foreground">Grand Total</TableCell>
                      <TableCell className="text-right text-xs font-bold py-3 text-foreground">
                        {summaryData.qtySummaryStr}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* 3. Credit Summary Dialog */}
      <Dialog open={isCreditSummaryOpen} onOpenChange={setIsCreditSummaryOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[425px] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>Daftar Piutang</DialogTitle>
            <DialogDescription>
              Pelanggan dengan sisa kredit (hutang) aktif
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="px-4 pb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Pelanggan</TableHead>
                    <TableHead className="text-right text-xs">Sisa Kredit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryData.debtors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">Tidak ada hutang aktif</TableCell>
                    </TableRow>
                  ) : (
                    summaryData.debtors.map((item, i) => (
                      <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/pelanggan/${item.id}`)}>
                        <TableCell className="text-xs py-2">
                          <p className="font-semibold">{item.nama}</p>
                          <p className="text-[10px] text-muted-foreground">{item.kode}</p>
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-destructive">{formatRupiah(item.sisaKredit)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {summaryData.debtors.length > 0 && (
                  <TableFooter className="bg-destructive/5 border-t">
                    <TableRow>
                      <TableCell className="text-xs font-bold py-3 text-foreground">Grand Total</TableCell>
                      <TableCell className="text-right text-xs font-bold py-3 text-destructive">
                        {formatRupiah(summaryData.totalPiutang)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

    </MainLayout>
  );
}
