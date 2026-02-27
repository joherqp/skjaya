import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { formatRupiah, formatNumber } from '@/lib/utils';
import { Download, History, ArrowRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Penjualan, PenjualanItem } from '@/lib/types';

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
  sales?: { nama: string };
  cabang?: { nama: string };
}

interface PerformanceItem extends SalesTargetDB {
  actual: number;
  percentage: number;
  status: string;
}

interface AdjustmentHistory {
  id: string;
  nilai_lama: number;
  nilai_baru: number;
  keterangan: string;
  tanggal: string;
}

export default function LaporanSalesPerformance() {
  const { user } = useAuth();
  const { cabang } = useDatabase();
  const [loading, setLoading] = useState(false);
  const [performanceData, setPerformanceData] = useState<PerformanceItem[]>([]);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const isAdminOrOwner = user?.roles.some(r => ['admin', 'owner'].includes(r));
  const userCabangId = user?.cabangId;

  const [selectedCabang, setSelectedCabang] = useState<string>(
    isAdminOrOwner ? 'all' : (userCabangId || 'all')
  );

  // History State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<PerformanceItem | null>(null);
  const [historyData, setHistoryData] = useState<AdjustmentHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const startDate = startOfMonth(new Date(selectedYear, selectedMonth, 1));
        const endDate = endOfMonth(startDate);

        // 1. Fetch Targets: Currently active fixed-date targets in this period OR Looping targets
        const query = supabase
          .from('sales_targets')
          .select('*')
          // Logic: 
          // 1. Looping targets must be Active to show (since they have no fixed end date implies they run until stopped)
          // 2. Fixed targets show if they overlap the period, regardless of current active status (History)
          .or(`and(is_looping.eq.true,is_active.eq.true),and(start_date.lte.${endDate.toISOString()},end_date.gte.${startDate.toISOString()})`);

        const { data: targetData, error: targetError } = await query;
        if (targetError) throw targetError;

        // Manual Fetch (Fix for missing FK)
        const salesIds = [...new Set((targetData as SalesTargetDB[]).map(t => t.sales_id).filter(id => id))];
        const cabangIds = [...new Set((targetData as SalesTargetDB[]).map(t => t.cabang_id).filter(id => id))];

        const salesMap: Record<string, string> = {};
        const cabangMap: Record<string, string> = {};

        if (salesIds.length > 0) {
          const { data } = await supabase.from('users').select('id, nama').in('id', salesIds);
          data?.forEach((u: any) => salesMap[u.id] = u.nama);
        }
        if (cabangIds.length > 0) {
          const { data } = await supabase.from('cabang').select('id, nama').in('id', cabangIds);
          data?.forEach((c: any) => cabangMap[c.id] = c.nama);
        }

        // 2. Fetch Sales Data for this period
        let salesQuery = supabase
          .from('penjualan')
          .select('*, salesId:sales_id, cabangId:cabang_id')
          .eq('status', 'lunas') // Changed from selesai
          .gte('tanggal', startDate.toISOString())
          .lte('tanggal', endDate.toISOString());

        if (!isAdminOrOwner && userCabangId) {
          salesQuery = salesQuery.eq('cabang_id', userCabangId);
        } else if (selectedCabang !== 'all') {
          salesQuery = salesQuery.eq('cabang_id', selectedCabang);
        }

        const { data, error: salesError } = await salesQuery;
        if (salesError) throw salesError;
        const salesData = data as Penjualan[];

        // 3. Calculate Performance & Apply final filtering
        const rawCalculatedData = (targetData as SalesTargetDB[])?.map((targetRow: SalesTargetDB) => {
          // Enrich with names
          const target = {
            ...targetRow,
            sales: targetRow.sales_id ? { nama: salesMap[targetRow.sales_id] || 'Unknown' } : undefined,
            cabang: targetRow.cabang_id ? { nama: cabangMap[targetRow.cabang_id] || 'Unknown' } : undefined
          };

          // Filter sales relevant to this target
          let targetStart: Date;
          let targetEnd: Date;

          if (target.is_looping) {
            targetStart = startDate;
            targetEnd = endDate;
          } else {
            targetStart = new Date(target.start_date!);
            targetEnd = new Date(target.end_date!);
          }

          // Intersection of Target Period and Selected Month
          const effectiveStart = targetStart < startDate ? startDate : targetStart;
          const effectiveEnd = targetEnd > endDate ? endDate : targetEnd;

          const relevantSales = salesData?.filter(p => {
            const pDate = new Date(p.tanggal);

            // Strict Payment Check (Consistent with Dashboard)
            const isPaid = p.isLunas === true || (p.metodePembayaran !== 'tempo' && p.status === 'lunas');
            if (!isPaid) return false;

            if (pDate < effectiveStart || pDate > effectiveEnd) return false;
            if (target.scope === 'sales') {
              return p.salesId === target.sales_id; // Using cameraCase salesId
            } else if (target.scope === 'cabang') {
              return p.cabangId === target.cabang_id; // Using cameraCase cabangId
            }
            return false;
          }) || [];

          const actual = target.target_type === 'nominal'
            ? relevantSales.reduce((sum, p) => sum + p.total, 0)
            : relevantSales.reduce((sum, p) => sum + p.items
              .filter((i: PenjualanItem) => i.harga > 0 && !i.promoId && !i.isBonus) // Exclude promo/bonus
              .reduce((s: number, i: PenjualanItem) => s + (i.totalQty !== undefined ? i.totalQty : (i.jumlah * (i.konversi || 1))), 0), 0);

          const percentage = target.nilai > 0 ? (actual / target.nilai) * 100 : 0;

          return {
            ...target,
            actual,
            percentage,
            status: percentage >= 100 ? 'Achieved' : 'On Progress'
          };
        });

        const filteredData = rawCalculatedData?.filter((item: PerformanceItem) => {
          if (isAdminOrOwner) {
            if (selectedCabang === 'all') return true;
            return item.cabang_id === selectedCabang || (item.scope === 'sales' && salesData?.some(p => p.salesId === item.sales_id));
          }
          return item.cabang_id === userCabangId || (item.scope === 'sales' && salesData?.some(p => p.salesId === item.sales_id));
        });

        const sortedData = (filteredData || []).sort((a: PerformanceItem, b: PerformanceItem) => {
          // 1. Sort by scope: 'sales' (personal) first, 'cabang' (team) last
          if (a.scope !== b.scope) {
            return a.scope === 'sales' ? -1 : 1;
          }

          // 2. Sort by percentage (achievement) descending
          if (b.percentage !== a.percentage) return b.percentage - a.percentage;

          // 3. Sort by name
          const nameA = a.scope === 'sales' ? a.sales?.nama || '' : a.cabang?.nama || '';
          const nameB = b.scope === 'sales' ? b.sales?.nama || '' : b.cabang?.nama || '';
          return nameA.localeCompare(nameB);
        });

        setPerformanceData(sortedData);

      } catch (error) {
        console.error('Error fetching report:', error);
        toast.error('Gagal memuat laporan');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedMonth, selectedYear, selectedCabang, isAdminOrOwner, userCabangId]);

  const fetchHistory = async (target: PerformanceItem) => {
    setSelectedTarget(target);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_target_history')
        .select('*')
        .eq('target_id', target.id)
        .order('tanggal', { ascending: false });

      if (error) throw error;
      setHistoryData(data as AdjustmentHistory[] || []);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Gagal memuat riwayat');
    } finally {
      setHistoryLoading(false);
    }
  }

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(performanceData.map(item => ({
      'Jenis': item.jenis,
      'Scope': item.scope,
      'Nama': item.scope === 'sales' ? item.sales?.nama : item.cabang?.nama,
      'Target Type': item.target_type,
      'Mulai': item.is_looping ? 'Looping' : (item.start_date ? format(new Date(item.start_date), 'dd/MM/yyyy') : '-'),
      'Selesai': item.is_looping ? 'Looping' : (item.end_date ? format(new Date(item.end_date), 'dd/MM/yyyy') : '-'),
      'Target': item.nilai,
      'Aktual': item.actual,
      'Persentase': `${item.percentage.toFixed(2)}%`,
      'Status': item.status
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Performance");
    XLSX.writeFile(wb, "Sales_Performance_Report.xlsx");
  };

  return (
    <MainLayout title="Laporan Sales Performance">
      <div className="p-4 space-y-4">
        {/* Filters */}
        <Card className="border-none shadow-none md:border md:shadow-sm">
          <CardContent className="p-0 md:p-4 flex flex-col md:flex-row md:flex-wrap gap-3 md:gap-4 items-stretch md:items-end">
            <div className="grid grid-cols-2 md:contents gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase opacity-70">Bulan</label>
                <Select
                  value={selectedMonth.toString()}
                  onValueChange={(v) => setSelectedMonth(parseInt(v))}
                >
                  <SelectTrigger className="w-full md:w-[150px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {format(new Date(2024, i, 1), 'MMMM', { locale: localeId })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase opacity-70">Tahun</label>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(v) => setSelectedYear(parseInt(v))}
                >
                  <SelectTrigger className="w-full md:w-[100px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: new Date().getFullYear() - 2024 + 2 }, (_, i) => {
                      const year = 2024 + i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase opacity-70">Cabang</label>
              <Select
                value={selectedCabang}
                onValueChange={setSelectedCabang}
                disabled={!isAdminOrOwner}
              >
                <SelectTrigger className="w-full md:w-[200px] h-9">
                  <SelectValue placeholder="Semua Cabang" />
                </SelectTrigger>
                <SelectContent>
                  {isAdminOrOwner && <SelectItem value="all">Semua Cabang</SelectItem>}
                  {cabang.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="hidden md:block flex-1"></div>

            <Button variant="outline" size="sm" onClick={downloadExcel} disabled={performanceData.length === 0} className="h-9">
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </CardContent>
        </Card>

        {/* Data List / Table */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">Loading...</div>
          ) : performanceData.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground bg-muted/30 rounded-lg border-2 border-dashed">
              Tidak ada data target pada periode ini
            </div>
          ) : (
            performanceData.map((item, idx) => (
              <Card key={idx} className="overflow-hidden border-l-4 border-l-primary/50 shadow-sm">
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm">
                        {item.scope === 'sales' ? item.sales?.nama : item.cabang?.nama}
                      </h4>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        {item.scope} • {item.jenis} ({item.target_type})
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 -mt-1 -mr-1" onClick={() => fetchHistory(item)}>
                      <History className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase opacity-70">Target</p>
                      <p className="text-xs font-semibold">
                        {item.target_type === 'nominal' ? formatRupiah(item.nilai) : formatNumber(item.nilai)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase opacity-70">Aktual</p>
                      <p className="text-xs font-semibold">
                        {item.target_type === 'nominal' ? formatRupiah(item.actual) : formatNumber(item.actual)}
                      </p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase opacity-70">Pencapaian</p>
                      <p className={`text-xs font-bold ${item.percentage >= 100 ? 'text-green-600' : 'text-primary'}`}>
                        {item.percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] pt-1 border-t border-muted/50">
                    <div className="text-muted-foreground">
                      {item.is_looping ? (
                        <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">Looping</span>
                      ) : (
                        `${format(new Date(item.start_date!), 'dd/MM')} - ${format(new Date(item.end_date!), 'dd/MM')}`
                      )}
                    </div>
                    <div className={`font-bold uppercase tracking-tighter ${item.percentage >= 100 ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {item.status}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama / Cabang</TableHead>
                <TableHead className="text-right">Pencapaian</TableHead>
                <TableHead className="text-right">Aktual</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
                <TableHead>Jenis Target</TableHead>
                <TableHead>Periode</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">Loading...</TableCell>
                </TableRow>
              ) : performanceData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">Tidak ada data target pada periode ini</TableCell>
                </TableRow>
              ) : (
                performanceData.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {item.scope === 'sales' ? item.sales?.nama || 'Unknown' : item.cabang?.nama || 'Unknown'}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">{item.scope}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className={`font-bold ${item.percentage >= 100 ? 'text-green-600' : item.percentage >= 50 ? 'text-blue-600' : 'text-red-600'}`}>
                          {item.percentage.toFixed(1)}%
                        </span>
                        <span className={`text-[10px] uppercase font-bold ${item.percentage >= 100 ? 'text-green-600' : 'text-muted-foreground'
                          }`}>
                          {item.status}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {item.target_type === 'nominal' ? formatRupiah(item.actual) : formatNumber(item.actual)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {item.target_type === 'nominal' ? formatRupiah(item.nilai) : formatNumber(item.nilai)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button size="icon" variant="ghost" onClick={() => fetchHistory(item)} title="Riwayat Penyesuaian">
                        <History className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                    <TableCell className="capitalize text-sm whitespace-nowrap">{item.jenis} ({item.target_type})</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {item.is_looping ? (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">Looping</span>
                      ) : (
                        `${format(new Date(item.start_date!), 'dd/MM')} - ${format(new Date(item.end_date!), 'dd/MM')}`
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* History Dialog */}
        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Riwayat Penyesuaian Target</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Target Saat Ini</p>
                <p className="font-medium">
                  {selectedTarget?.scope === 'sales' ? selectedTarget?.sales?.nama : selectedTarget?.cabang?.nama}
                </p>
              </div>

              <div className="space-y-3">
                {historyLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Memuat riwayat...</div>
                ) : historyData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    Belum ada riwayat penyesuaian nilai
                  </div>
                ) : (
                  <div className="relative pl-4 space-y-6 before:absolute before:left-[11px] before:top-2 before:h-[calc(100%-16px)] before:w-[2px] before:bg-border">
                    {historyData.map((h) => (
                      <div key={h.id} className="relative">
                        <div className="absolute -left-[29px] top-1.5 w-4 h-4 rounded-full border-2 border-primary bg-background z-10" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">
                              {selectedTarget?.target_type === 'nominal' ? formatRupiah(h.nilai_lama) : formatNumber(h.nilai_lama)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span className="font-bold text-primary">
                              {selectedTarget?.target_type === 'nominal' ? formatRupiah(h.nilai_baru) : formatNumber(h.nilai_baru)}
                            </span>
                          </div>
                          <p className="text-xs font-medium">{h.keterangan}</p>
                          <p className="text-[10px] text-muted-foreground italic">
                            {format(new Date(h.tanggal), 'dd MMM yyyy, HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
