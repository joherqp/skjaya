import React, { useState, useRef, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useDatabase } from '@/contexts/DatabaseContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatRupiah, formatTanggal } from '@/lib/utils';
import { startOfWeek, endOfWeek, format, addWeeks, subWeeks, isSameDay, getISOWeek, eachDayOfInterval } from 'date-fns';
import { id } from 'date-fns/locale';
import { FileText, Download, Wallet, Clock, CheckCircle, XCircle, Search, ChevronLeft, ChevronRight, Calendar as CalendarIcon, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';

export default function LaporanReimburse() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { reimburse, users } = useDatabase();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('disetujui');
  const [dateFilter, setDateFilter] = useState<string>('this_month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [displayLimit, setDisplayLimit] = useState(20);

  // Week Logic
  const startDate = startOfWeek(selectedDate, { weekStartsOn: 0 }); // Sunday start
  const endDate = endOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekNumber = getISOWeek(selectedDate);
  const daysOfWeek = React.useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);


  // Calculate Global Date Bounds for Navigation
  const { minDate, maxDate } = React.useMemo(() => {
     if (reimburse.length === 0) return { minDate: new Date(), maxDate: new Date() };
     
     const dates = reimburse.map(r => new Date(r.tanggal).getTime());
     return {
         minDate: startOfWeek(new Date(Math.min(...dates)), { weekStartsOn: 0 }),
         maxDate: endOfWeek(new Date(Math.max(...dates)), { weekStartsOn: 0 })
     };
  }, [reimburse]);

  const hasDataForWeek = (date: Date) => {
      const start = startOfWeek(date, { weekStartsOn: 0 });
      const end = endOfWeek(date, { weekStartsOn: 0 });
      // Use accessibleReimburse to respect roles
      return accessibleReimburse.some(item => {
          const itemDate = new Date(item.tanggal);
          return itemDate >= start && itemDate <= end;
      });
  };

  const changeWeek = (direction: 'next' | 'prev') => {
      let currentCheck = selectedDate;
      const skippedWeeks: number[] = [];
      let found = false;
      const limit = 100; 

      for (let i = 0; i < limit; i++) {
          currentCheck = direction === 'next' ? addWeeks(currentCheck, 1) : subWeeks(currentCheck, 1);
          
          if (direction === 'prev' && currentCheck < minDate) {
               toast.info("Sudah di minggu pertama data.");
               return;
          }
           if (direction === 'next' && currentCheck > maxDate) {
               toast.info("Sudah di minggu terakhir data.");
               return;
          }

          if (hasDataForWeek(currentCheck)) {
              found = true;
              break;
          } else {
              skippedWeeks.push(getISOWeek(currentCheck));
          }
      }

      if (found) {
        setSelectedDate(currentCheck);
        if (skippedWeeks.length > 0) {
            if (skippedWeeks.length > 3) {
                 toast.info(`Melewati ${skippedWeeks.length} minggu kosong.`);
            } else {
                 toast.info(`Week ${skippedWeeks.join(', ')} dilewati (Data Kosong).`);
            }
        }
      } else {
          toast.info("Tidak ada data di minggu selanjutnya/sebelumnya.");
      }
  };

  const prevWeek = () => changeWeek('prev');
  const nextWeek = () => changeWeek('next');

  // Helper
  const formatUserDetail = (userId: string | undefined) => {
      if (!userId) return '-';
      const user = users.find(u => u.id === userId);
      return user ? user.nama : 'Unknown';
  };

  // Role-Based Filtering
  const accessibleReimburse = React.useMemo(() => {
    if (!currentUser) return [];
    
    // 1. Admin/Owner: Access All
    if (currentUser.roles.includes('admin') || currentUser.roles.includes('owner')) {
        return reimburse;
    }

    // 2. Others (Leader/Sales/Staff): Access Branch Members
    // User request: "laporan hanya bisa akses dalam cabang yang sama"
    // Fix: If no cabangId, return empty
    if (!currentUser?.cabangId) return [];
    
    const branchUserIds = users.filter(u => u.cabangId === currentUser.cabangId).map(u => u.id);
    return reimburse.filter(r => branchUserIds.includes(r.userId));
  }, [reimburse, currentUser, users]);

  // Main Filter Logic
  const filteredData = accessibleReimburse.filter(item => {
    const matchSearch = 
      item.keterangan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatUserDetail(item.userId).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchStatus = statusFilter === 'all' ? true : item.status === statusFilter;
    
    let matchDate = true;
    const itemDate = new Date(item.tanggal);
    const today = new Date();
    
    if (dateFilter === 'this_month') {
        matchDate = itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear();
    } else if (dateFilter === 'last_month') {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        matchDate = itemDate.getMonth() === lastMonth.getMonth() && itemDate.getFullYear() === lastMonth.getFullYear();
    }

    return matchSearch && matchStatus && matchDate;
  }).sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());



  // Weekly Aggregation
  const weeklyData = React.useMemo(() => {
    // Also filter users for the weekly view
    let relevantUsers = users;
    // Check if user is restricted
    // Check if user is restricted
    const isGlobal = currentUser?.roles.includes('admin') || currentUser?.roles.includes('owner');

    if (!isGlobal) {
         // Everyone else sees users in their branch
         // Fix: If no branch, empty
         if (!currentUser?.cabangId) {
             relevantUsers = [];
         } else {
             relevantUsers = users.filter(u => u.cabangId === currentUser.cabangId);
         }
    }

    return relevantUsers.map(user => {
        const userReimbursements = accessibleReimburse.filter(r => 
            r.userId === user.id && 
            new Date(r.tanggal) >= startDate && 
            new Date(r.tanggal) <= endDate &&
            (statusFilter === 'all' ? r.status !== 'ditolak' : r.status === statusFilter)
        );

        const dailyAmounts = daysOfWeek.map(day => {
            const amount = userReimbursements
                .filter(r => isSameDay(new Date(r.tanggal), day))
                .reduce((sum, r) => sum + r.jumlah, 0);
            return { day, amount };
        });

        const totalWeekly = dailyAmounts.reduce((sum, d) => sum + d.amount, 0);

        return {
            user,
            dailyAmounts,
            totalWeekly
        };
    }).filter(row => row.totalWeekly > 0); 
  }, [users, accessibleReimburse, startDate, endDate, statusFilter, daysOfWeek, currentUser]);

  const dailyTotals = daysOfWeek.map(day => {
      return weeklyData.reduce((sum, row) => {
          const dayAmount = row.dailyAmounts.find(d => isSameDay(d.day, day))?.amount || 0;
          return sum + dayAmount;
      }, 0);
  });
  const grandTotalWeekly = weeklyData.reduce((sum, row) => sum + row.totalWeekly, 0);

  // Statistics
  const stats = {
    total: filteredData.reduce((acc, curr) => acc + curr.jumlah, 0),
    count: filteredData.length,
    pending: filteredData.filter(i => i.status === 'pending').length,
    approved: filteredData.filter(i => i.status === 'disetujui').length,
    paid: filteredData.filter(i => i.status === 'dibayar').length,
    totalApproved: filteredData.filter(i => i.status === 'disetujui').reduce((acc, curr) => acc + curr.jumlah, 0)
  };

  const handleExport = () => {
    try {
        const dataToExport = filteredData.map(item => ({
            Tanggal: format(new Date(item.tanggal), 'yyyy-MM-dd'),
            Karyawan: formatUserDetail(item.userId),
            Kategori: item.kategori,
            Keterangan: item.keterangan,
            Jumlah: item.jumlah,
            Status: item.status === 'dibayar' ? 'Dibayar' : 
                    item.status === 'disetujui' ? 'Belum Dibayar' : 
                    item.status === 'ditolak' ? 'Ditolak' : 'Menunggu Review',
            'Disetujui Oleh': item.disetujuiOleh ? formatUserDetail(item.disetujuiOleh) : '-',
            'Dibayar Pada': item.dibayarPada ? format(new Date(item.dibayarPada), 'yyyy-MM-dd HH:mm') : '-'
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        XLSX.utils.book_append_sheet(wb, ws, "Laporan Reimburse");
        XLSX.writeFile(wb, `Laporan_Reimburse_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        toast.success('Laporan berhasil diunduh');
    } catch (error) {
        console.error('Export error:', error);
        toast.error('Gagal mengunduh laporan');
    }
  };

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'dibayar': return <Badge className="bg-green-600">Dibayar</Badge>;
          case 'disetujui': return <Badge className="bg-orange-500">Belum Dibayar</Badge>;
          case 'ditolak': return <Badge variant="destructive">Ditolak</Badge>;
          default: return <Badge variant="secondary">Menunggu Review</Badge>;
      }
  };

  return (
    <MainLayout title="Laporan Reimburse">
      <div className="p-4 space-y-6">
        <div className="flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate('/laporan')} className="pl-0">
            <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
          </Button>
        </div>
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Item</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.count}</div>
                    <p className="text-xs text-muted-foreground">Periode ini ({statusFilter})</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Nominal</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatRupiah(stats.total)}</div>
                    <p className="text-xs text-muted-foreground">Gabungan semua status</p>
                </CardContent>
            </Card>
            <Card className="border-orange-200 bg-orange-50/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-orange-700">Siap Bayar</CardTitle>
                    <Wallet className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-orange-700">{formatRupiah(stats.totalApproved)}</div>
                    <p className="text-xs text-orange-600 font-medium">{stats.approved} Pengajuan</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">Menunggu Review</CardTitle>
                    <Clock className="h-4 w-4 text-slate-400" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-slate-600">{stats.pending}</div>
                    <p className="text-xs text-muted-foreground">Belum di-approve</p>
                </CardContent>
            </Card>
            <Card className="border-green-100 bg-green-50/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-green-700">Sudah Dibayar</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-700">{stats.paid}</div>
                    <p className="text-xs text-green-600 font-medium">Paiement selesai</p>
                </CardContent>
            </Card>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-3 rounded-xl shadow-sm border gap-4">
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
                <TabsList className="bg-muted/50 p-1 h-11">
                    <TabsTrigger value="all" className="rounded-lg h-9 data-[state=active]:bg-white data-[state=active]:shadow-sm">Semua</TabsTrigger>
                    <TabsTrigger value="pending" className="rounded-lg h-9 data-[state=active]:bg-white data-[state=active]:shadow-sm">Menunggu Review</TabsTrigger>
                    <TabsTrigger value="disetujui" className="rounded-lg h-9 data-[state=active]:bg-white data-[state=active]:shadow-sm">Belum Dibayar</TabsTrigger>
                    <TabsTrigger value="dibayar" className="rounded-lg h-9 data-[state=active]:bg-white data-[state=active]:shadow-sm">Dibayar</TabsTrigger>
                    <TabsTrigger value="ditolak" className="rounded-lg h-9 data-[state=active]:bg-white data-[state=active]:shadow-sm">Ditolak</TabsTrigger>
                </TabsList>
            </Tabs>
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-full sm:w-[160px] h-11 rounded-xl">
                        <SelectValue placeholder="Periode Laporan" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="this_month">Bulan Ini</SelectItem>
                        <SelectItem value="last_month">Bulan Lalu</SelectItem>
                        <SelectItem value="all">Semua Waktu</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={handleExport}>
                    <Download className="h-4 w-4 text-pink-600" />
                </Button>
            </div>
        </div>

        {/* Weekly Table Card */}
        <Card>
            <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle>Rekap Mingguan</CardTitle>
                    <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevWeek}>
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <div className="text-sm font-medium px-2 text-center min-w-[150px]">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" className="h-auto py-1 px-2 font-medium hover:bg-muted">
                                        Week {weekNumber}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="center">
                                    <Calendar
                                        mode="single"
                                        selected={selectedDate}
                                        onSelect={(date) => date && setSelectedDate(date)}
                                        disabled={(date) => !hasDataForWeek(date)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            <div className="text-[10px] text-muted-foreground font-normal">
                                {format(startDate, 'dd MMM')} - {format(endDate, 'dd MMM yyyy')}
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextWeek}>
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-pink-600 text-white">
                            <tr>
                                <th className="p-2 text-left font-medium min-w-[150px]">Nama Karyawan</th>
                                {daysOfWeek.map(day => (
                                    <th key={day.toString()} className="p-2 text-center font-medium min-w-[80px] border-l border-pink-500">
                                        {format(day, 'EEEE', { locale: id }).replace('Minggu', 'Mgg').replace('Senin', 'Sen').replace('Selasa','Sel').replace('Rabu','Rab').replace('Kamis','Kam').replace('Jumat','Jum').replace('Sabtu','Sab')}
                                        <div className="text-[9px] font-normal opacity-80">{format(day, 'dd/MM')}</div>
                                    </th>
                                ))}
                                <th className="p-2 text-center font-medium min-w-[100px] border-l border-pink-500">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {weeklyData.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-4 text-center text-muted-foreground">Tidak ada pengajuan minggu ini</td>
                                </tr>
                            ) : weeklyData.map((row) => (
                                <tr key={row.user.id} className="hover:bg-muted/50">
                                    <td className="p-2 border-r font-medium">{row.user.nama}</td>
                                    {row.dailyAmounts.map((d, idx) => (
                                        <td key={idx} className="p-2 border-r text-right text-xs">
                                            {d.amount > 0 ? (
                                                <span className="font-medium text-slate-700">{formatRupiah(d.amount).replace('Rp', '')}</span>
                                            ) : '-'}
                                        </td>
                                    ))}
                                    <td className="p-2 text-right font-bold border-l bg-slate-50">
                                        {formatRupiah(row.totalWeekly).replace('Rp', '')}
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-pink-50 font-bold text-xs">
                                <td className="p-2 border-r text-right">TOTAL</td>
                                {dailyTotals.map((total, idx) => (
                                    <td key={idx} className="p-2 border-r text-right border-pink-100">
                                        {total > 0 ? formatRupiah(total).replace('Rp', '') : '-'}
                                    </td>
                                ))}
                                <td className="p-2 text-right text-pink-700">
                                    {formatRupiah(grandTotalWeekly)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>

        {/* Filters & Actions */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex flex-1 gap-2 w-full md:w-auto">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari karyawan atau keterangan pengeluaran..."
                        className="pl-10 h-11 rounded-xl"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <Button className="w-full md:w-auto h-11 px-6 rounded-xl bg-pink-600 hover:bg-pink-700 shadow-md" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" /> Export Data Excel
            </Button>
        </div>

        {/* Table */}
        <Card>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Karyawan</TableHead>
                        <TableHead>Keterangan</TableHead>
                        <TableHead>Jumlah</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Dibayar Pada</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                Tidak ada data reimbursement sesuai filter.
                            </TableCell>
                        </TableRow>
                    ) : (
                        <>
                        {filteredData.slice(0, displayLimit).map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{formatTanggal(item.tanggal)}</TableCell>
                                <TableCell>
                                    <div className="font-medium">{formatUserDetail(item.userId)}</div>
                                    <div className="text-xs text-muted-foreground capitalize">{item.kategori}</div>
                                </TableCell>
                                <TableCell className="max-w-[300px] truncate" title={item.keterangan}>
                                    {item.keterangan}
                                </TableCell>
                                <TableCell className="font-bold">{formatRupiah(item.jumlah)}</TableCell>
                                <TableCell>{getStatusBadge(item.status)}</TableCell>
                                <TableCell>
                                    {item.dibayarPada ? (
                                        <div className="text-xs">
                                            <div>{formatTanggal(item.dibayarPada)}</div>
                                            <div className="text-muted-foreground">Petty Cash</div>
                                        </div>
                                    ) : '-'}
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredData.length > displayLimit && (
                            <TableRow>
                                <TableCell colSpan={6} className="p-0 border-0 text-center">
                                    <Button 
                                        variant="ghost" 
                                        className="w-full mt-4 border-dashed text-muted-foreground"
                                        onClick={() => setDisplayLimit(prev => prev + 20)}
                                    >
                                        Lihat Lainnya
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )}
                        </>
                    )}
                </TableBody>
            </Table>
        </Card>
      </div>
    </MainLayout>
  );
}
