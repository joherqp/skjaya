import { useState, useMemo, useRef, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatTanggal, formatWaktu } from '@/lib/utils';
import { ArrowLeft, MapPin, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  startOfWeek, 
  endOfWeek, 
  format, 
  addWeeks, 
  subWeeks, 
  isSameDay, 
  parseISO,
  getISOWeek,
  eachDayOfInterval
} from 'date-fns';
import { id } from 'date-fns/locale';

export default function LaporanAbsensi() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { absensi, users, cabang, penjualan } = useDatabase();
  const [filterCabang, setFilterCabang] = useState<string>(() => {
      const isGlobal = currentUser?.roles.includes('admin') || currentUser?.roles.includes('owner');
      if (isGlobal) return 'all';
      return currentUser?.cabangId || '';
  });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [displayLimit, setDisplayLimit] = useState(20);
  const [logLimit, setLogLimit] = useState(20);

  const isAdminOrOwner = currentUser?.roles.includes('admin') || currentUser?.roles.includes('owner');

  // Filter Users first based on Branch access
  // Filter Users first based on Branch access
  const filteredUsers = useMemo(() => {
    const isGlobal = currentUser?.roles.includes('admin') || currentUser?.roles.includes('owner');

    // 1. Global Access
    if (isGlobal) {
        if (filterCabang !== 'all') {
            return users.filter(u => u.cabangId === filterCabang).sort((a, b) => a.nama.localeCompare(b.nama));
        }
        return users.sort((a, b) => a.nama.localeCompare(b.nama));
    }

    // 2. Others (Leader/Sales): Access Branch Members
    // User request: "laporan hanya bisa akses dalam cabang yang sama"
    if (!currentUser?.cabangId) return [];
    
    return users.filter(u => u.cabangId === currentUser.cabangId).sort((a, b) => a.nama.localeCompare(b.nama));
  }, [users, filterCabang, currentUser]);

  // Week Logic
  const startDate = startOfWeek(selectedDate, { weekStartsOn: 0 }); // Sunday start
  const endDate = endOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekNumber = getISOWeek(selectedDate);
  const daysOfWeek = eachDayOfInterval({ start: startDate, end: endDate });

  // Filter Absensi for current range and relevant users
  const weeklyAttendance = useMemo(() => {
    return absensi.filter(item => {
        const itemDate = new Date(item.tanggal);
        // Check date range
        if (itemDate < startDate || itemDate > endDate) return false;
        
        // Check user relevance
        return filteredUsers.some(u => u.id === item.userId);
    });
  }, [absensi, startDate, endDate, filteredUsers]);

  // Filter Sales for current week
  const weeklySales = useMemo(() => {
      return penjualan.filter(p => {
          const pDate = new Date(p.tanggal);
          return pDate >= startDate && pDate <= endDate;
      });
  }, [penjualan, startDate, endDate]);

  // Generate Table Data
  const tableData = filteredUsers.map(user => {
      const attendance = daysOfWeek.map(day => {
          const record = weeklyAttendance.find(a => 
              a.userId === user.id && isSameDay(new Date(a.tanggal), day)
          );
          
          let status = '-'; // Default
          if (record) {
              if (record.status === 'hadir') {
                  status = 'M';
                  
                  // Check for Sales Role logic
                  const isSales = user.roles.includes('sales');
                  if (isSales) {
                      const hasSales = weeklySales.some(s => 
                          s.salesId === user.id && isSameDay(new Date(s.tanggal), day)
                      );
                      if (!hasSales) {
                          status = 'L';
                      }
                  }
              }
              else status = 'I'; 
          }
          return { day, status, record };
      });
      
      const distinctDaysPresent = attendance.filter(a => a.status === 'M' || a.status === 'L').length; // Should L count as present? Yes, they checked in.

      return {
          user,
          attendance,
          total: distinctDaysPresent
      };
  });

  // Calculate Daily Totals
  const dailyTotals = daysOfWeek.map(day => {
      const count = weeklyAttendance.filter(a => 
         isSameDay(new Date(a.tanggal), day) && a.status === 'hadir'
      ).length;
      return count;
  });

  const totalWeeklyAttendance = dailyTotals.reduce((a, b) => a + b, 0);

  // Calculate Global Date Bounds for Navigation
  const { minDate, maxDate } = useMemo(() => {
     if (absensi.length === 0) return { minDate: new Date(), maxDate: new Date() }; // Default
     
     const dates = absensi.map(a => new Date(a.tanggal).getTime());
     return {
         minDate: startOfWeek(new Date(Math.min(...dates)), { weekStartsOn: 0 }),
         maxDate: endOfWeek(new Date(Math.max(...dates)), { weekStartsOn: 0 })
     };
  }, [absensi]);

  const hasDataForWeek = (date: Date) => {
      const start = startOfWeek(date, { weekStartsOn: 0 });
      const end = endOfWeek(date, { weekStartsOn: 0 });
      return absensi.some(item => {
          const itemDate = new Date(item.tanggal);
          return itemDate >= start && itemDate <= end && filteredUsers.some(u => u.id === item.userId); // Check filtered users too? Yes.
      });
  };

  const changeWeek = (direction: 'next' | 'prev') => {
      let currentCheck = selectedDate;
      const skippedWeeks: number[] = [];
      let found = false;
      // Safety limit of ~2 years (100 weeks) or just date bound check
      const limit = 100; 

      for (let i = 0; i < limit; i++) {
          currentCheck = direction === 'next' ? addWeeks(currentCheck, 1) : subWeeks(currentCheck, 1);
          
          // Check Bounds
          if (direction === 'prev' && currentCheck < minDate) {
               toast.info("Sudah di minggu pertama data absensi.");
               return;
          }
           if (direction === 'next' && currentCheck > maxDate) {
               toast.info("Sudah di minggu terakhir data absensi.");
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
            // Simplify message if many weeks skipped
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

  // Export Excel
  const handleExportExcel = () => {
    try {
        const wb = XLSX.utils.book_new();

        // Filter rows for export as well
        const validRows = tableData.filter(r => r.total > 0);

        // Sheet 1: Matrix Recap
        const headers = ["Nama Karyawan", ...daysOfWeek.map(d => format(d, 'EEEE, dd MMM', { locale: id })), "Total"];
        const rows = validRows.map(row => {
             const attStatuses = row.attendance.map(a => a.status === '-' ? '' : a.status);
             return [row.user.nama, ...attStatuses, row.total];
        });
        
        // Add daily totals row
        const totalRow = ["TOTAL HADIR", ...dailyTotals, totalWeeklyAttendance];
        
        const wsData = [headers, ...rows, totalRow];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        // Style hint (optional, simpler without style lib)
        ws['!cols'] = [{ wch: 20 }, ...daysOfWeek.map(() => ({ wch: 15 })), { wch: 10 }];

        XLSX.utils.book_append_sheet(wb, ws, "Rekap Absensi");

        // Sheet 2: Detail Logs
        const detailData = weeklyAttendance.map(item => {
             const user = users.find(u => u.id === item.userId);
             return {
                 "Tanggal": format(new Date(item.tanggal), 'yyyy-MM-dd'),
                 "Nama": user?.nama || 'Unknown',
                 "Status": item.status,
                 "Check In": item.checkIn ? formatWaktu(new Date(item.checkIn)) : '-',
                 "Lokasi": item.lokasiCheckIn?.alamat || `${item.lokasiCheckIn?.latitude}, ${item.lokasiCheckIn?.longitude}` || '-'
             };
        });
        const wsDetail = XLSX.utils.json_to_sheet(detailData);
        wsDetail['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 50 }];
        
        XLSX.utils.book_append_sheet(wb, wsDetail, "Log Detail");

        XLSX.writeFile(wb, `Laporan_Absensi_Week${weekNumber}_${format(startDate, 'yyyyMMdd')}.xlsx`);
        toast.success("Excel absensi berhasil diunduh");

    } catch (err) {
        console.error("Export Error:", err);
        toast.error("Gagal export Excel");
    }
  };

  // Filter Display Data
  const displayData = tableData.filter(row => row.total > 0);



  return (
    <MainLayout title="Laporan Absensi">
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
            <Button variant="ghost" onClick={() => navigate('/laporan')} className="pl-0">
            <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
            </Button>
            
            <div className="flex gap-2 items-center">
                <div className="w-[200px]">
                        <Select 
                            value={filterCabang} 
                            onValueChange={setFilterCabang}
                            disabled={!isAdminOrOwner}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Filter Cabang" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Global (Semua Cabang)</SelectItem>
                                {cabang.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.nama}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-8">
                     <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Export Excel
                </Button>
            </div>
        </div>

        <Card>
            <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle>Rekap Absensi Mingguan</CardTitle>
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
                        <thead className="bg-green-500 text-white">
                            <tr>
                                <th className="p-2 text-left font-medium min-w-[150px]">Nama</th>
                                {daysOfWeek.map(day => (
                                    <th key={day.toString()} className="p-2 text-center font-medium min-w-[40px] border-l border-green-400">
                                        {format(day, 'EEEE', { locale: id }).replace('Minggu', 'Minggu').replace('Senin', 'Senin').substring(0,6)}
                                    </th>
                                ))}
                                <th className="p-2 text-center font-medium min-w-[80px] border-l border-green-400">Jumlah</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {displayData.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-4 text-center text-muted-foreground">Tidak ada data karyawan</td>
                                </tr>
                            ) : (
                                <>
                                {displayData.slice(0, displayLimit).map((row) => (
                                <tr key={row.user.id} className="hover:bg-muted/50">
                                    <td className="p-2 border-r font-medium">{row.user.nama}</td>
                                    {row.attendance.map((att, idx) => (
                                        <td key={idx} className={`p-2 border-r text-center font-bold ${
                                            att.status === 'M' ? '' : 
                                            att.status === 'I' ? 'bg-red-200 text-red-700' : 
                                            att.status === 'L' ? 'bg-yellow-200 text-yellow-700' : ''
                                        }`}>
                                            {att.status === '-' ? '' : att.status}
                                        </td>
                                    ))}
                                    <td className="p-2 text-center font-bold">{row.total}</td>
                                </tr>
                            ))}
                             {displayData.length > displayLimit && (
                                <tr>
                                    <td colSpan={9} className="p-0 border-0 text-center">
                                        <Button 
                                            variant="ghost" 
                                            className="w-full mt-4 border-dashed text-muted-foreground"
                                            onClick={() => setDisplayLimit(prev => prev + 20)}
                                        >
                                            Lihat Lainnya
                                        </Button>
                                    </td>
                                </tr>
                             )}
                            </>
                            )}
                            <tr className="bg-green-100 font-bold">
                                <td className="p-2 border-r">Jumlah</td>
                                {dailyTotals.map((total, idx) => (
                                    <td key={idx} className="p-2 border-r text-center border-green-200">{total}</td>
                                ))}
                                <td className="p-2 text-center">{totalWeeklyAttendance}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>

        {/* List View for Detail (Optional / Previous View) */}
        {/* ... (We can keep simpler list below if needed or remove it. User asked for Table "default minggu ini". I'll replace the previous list with this table primarily, but maybe keep list as 'Detail Harian' below?) */}
        {/* I will keep the previous list content below the table as "Detail Log" for completeness unless user asked to replace. */}
        
        <Card>
            <CardHeader><CardTitle>Detail Log Aktivitas</CardTitle></CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {weeklyAttendance.slice(0, logLimit).map((item) => { 
                         const user = users.find(u => u.id === item.userId);
                         return (
                            <div key={item.id} className="p-3 border rounded-lg hover:bg-muted/50 space-y-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-sm">{user?.nama}</p>
                                        <div className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium uppercase mt-1 ${
                                            item.status === 'hadir' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                                        }`}>
                                            {item.status}
                                        </div>
                                    </div>
                                    <div className="text-right text-xs">
                                        <p className="font-medium">{formatTanggal(new Date(item.tanggal))}</p>
                                        <p className="text-muted-foreground">{item.checkIn ? formatWaktu(new Date(item.checkIn)) : '-'}</p>
                                    </div>
                                </div>
                                {item.lokasiCheckIn && (
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
                                        <MapPin className="w-3 h-3 flex-shrink-0" />
                                        <span className="truncate">{item.lokasiCheckIn.alamat || `${item.lokasiCheckIn.latitude}, ${item.lokasiCheckIn.longitude}`}</span>
                                    </div>
                                )}
                            </div>
                         );
                    })}
                    {weeklyAttendance.length > logLimit && (
                        <Button 
                            variant="ghost" 
                            className="w-full mt-4 border-dashed text-muted-foreground"
                            onClick={() => setLogLimit(prev => prev + 20)}
                        >
                            Lihat Lainnya
                        </Button>
                    )}
                    {weeklyAttendance.length === 0 && <p className="text-center text-muted-foreground py-4">Tidak ada log aktivitas minggu ini</p>}
                </div>
            </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
