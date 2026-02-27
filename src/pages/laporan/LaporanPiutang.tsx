import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatRupiah } from '@/lib/utils';
import { ArrowLeft, TrendingUp, FileSpreadsheet, Search, ArrowUpDown, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Penjualan } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Filter } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter, // Import TableFooter
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';

type SortOption = 'highest' | 'lowest' | 'name-asc' | 'name-desc';

export default function LaporanPiutang() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { pelanggan, kategoriPelanggan, cabang, penjualan, users, profilPerusahaan } = useDatabase();
  
  const [filterCabang, setFilterCabang] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string[]>([]); // Changed to Array
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('highest');

  const [isDebtDialogOpen, setIsDebtDialogOpen] = useState(false);
  const [unpaidDebtsForDialog, setUnpaidDebtsForDialog] = useState<Penjualan[]>([]);
  const [selectedCustomerName, setSelectedCustomerName] = useState('');

  // Auto-select "Cati" if exists
  useEffect(() => {
    if (users.length > 0 && filterUser.length === 0) {
      const cati = users.find(u => u.nama.toLowerCase() === 'cati');
      if (cati) {
        setFilterUser([cati.id]);
      }
    }
  }, [users, filterUser.length]);

  const handlePayClick = (customerId: string, customerName: string) => {
      const debts = penjualan.filter(p => 
          p.pelangganId === customerId && 
          p.metodePembayaran === 'tempo' && 
          p.status === 'lunas' && 
          !p.isLunas &&
          (p.bayar || 0) < p.total
      );

      setUnpaidDebtsForDialog(debts);
      setSelectedCustomerName(customerName);
      setIsDebtDialogOpen(true);
  };

  const isAdminOrOwner = currentUser?.roles.includes('admin') || currentUser?.roles.includes('owner');

  // Use Global Limit Config
  const useGlobal = profilPerusahaan?.config?.useGlobalLimit;
  const globalMax = profilPerusahaan?.config?.globalLimitAmount || 0;

  // 1. Get Relevant Users (Sales) - ONLY those with Debt
  const relevantUsers = users.filter(u => {
      // Branch Filter First
      if (filterCabang !== 'all' && u.cabangId !== filterCabang) return false;
      
      // MUST have customers with debt
      const hasDebt = pelanggan.some(p => p.salesId === u.id && (p.sisaKredit || 0) > 0);
      return hasDebt;
  });

  // 2. Filter Customers by Branch AND Multi-Sales User
  const filteredPelanggan = pelanggan.filter(p => {
      // Branch Filter
      if (isAdminOrOwner && filterCabang !== 'all') {
          if (p.cabangId !== filterCabang) return false;
      } else if (!isAdminOrOwner && currentUser?.cabangId) {
          if (p.cabangId !== currentUser.cabangId) return false;
      }

      // User/Sales Filter (Multi-Select)
      if (filterUser.length > 0) {
          if (!filterUser.includes(p.salesId)) return false;
      }

      return true;
  });

  // 3. Prepare Data with Calculated Debt & Global Limit Logic
  const calculatedData = filteredPelanggan.map(p => {
      // Source of truth for debt is now p.sisaKredit
      const totalHutang = p.sisaKredit || 0;
      
      // Ceiling calculations matching model
      const limitMax = useGlobal ? globalMax : (p.limitKredit + (p.sisaKredit || 0));
      const sisaPlafon = useGlobal ? (globalMax - totalHutang) : (p.limitKredit || 0);

      const unpaidSales = penjualan.filter(s => 
          s.pelangganId === p.id && 
          s.metodePembayaran === 'tempo' && 
          s.status === 'lunas' && 
          (s.isLunas === false || ((s.bayar || 0) < s.total))
      );

      // Calculate Overdue
      const overdueInvoices = unpaidSales.filter(s => 
          s.jatuhTempo && new Date(s.jatuhTempo) < new Date()
      ).length;

      return {
          ...p,
          totalHutang,
          limitMax,
          sisaPlafon,
          overdueInvoices,
          unpaidSales // Still useful for dialog
      };
  });

  // 3. Filter by having Debt & Search Query
  const piutangList = calculatedData.filter(p => {
      if (p.totalHutang <= 0) return false;

      const q = searchQuery.toLowerCase();
      return p.nama.toLowerCase().includes(q) || 
             p.kode.toLowerCase().includes(q);
  });

  // 4. Sort
  const sortedList = [...piutangList].sort((a, b) => {
      switch (sortBy) {
          case 'highest': return b.totalHutang - a.totalHutang;
          case 'lowest': return a.totalHutang - b.totalHutang;
          case 'name-asc': return a.nama.localeCompare(b.nama);
          case 'name-desc': return b.nama.localeCompare(a.nama);
          default: return 0;
      }
  });

  const totalPiutang = sortedList.reduce((sum, p) => sum + p.totalHutang, 0);

  const handleExportExcel = () => {
    if (sortedList.length === 0) {
        toast.error("Tidak ada data piutang untuk diexport");
        return;
    }
    try {
        const data = sortedList.map(item => {
            const kategori = kategoriPelanggan.find(k => k.id === item.kategoriId);
            const userSales = users.find(u => u.id === item.salesId);
            return {
                "Sales": userSales?.nama || '-',
                "Kategori": kategori?.nama || '-',
                "Nama Pelanggan": item.nama,
                "Limit Kredit": item.limitMax,
                "Sisa Plafon": item.sisaPlafon,
                "Total Hutang": item.totalHutang
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        
        ws['!cols'] = [
            { wch: 15 }, // Sales
            { wch: 15 }, // Kategori
            { wch: 30 }, // Nama
            { wch: 15 }, // Limit
            { wch: 15 }, // Sisa
            { wch: 15 }  // Hutang
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Laporan Piutang");
        XLSX.writeFile(wb, `Laporan_Piutang_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        toast.success("Excel piutang berhasil diunduh");
    } catch (err) {
        console.error("Export Error: ", err);
        toast.error("Gagal export Excel");
    }
  };

  return (
    <MainLayout title="Laporan Piutang">
      <div className="p-4 space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
            <Button variant="ghost" onClick={() => navigate('/laporan')} className="pl-0 -ml-2">
                <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
            </Button>
            
            <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
                {isAdminOrOwner && (
                    <Select value={filterCabang} onValueChange={(v) => {
                        setFilterCabang(v);
                        setFilterUser([]); // Reset user filter on branch change
                    }}>
                        <SelectTrigger className="w-[180px] h-9 text-xs">
                            <SelectValue placeholder="Filter Cabang" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Cabang</SelectItem>
                            {cabang.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.nama}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 text-xs flex gap-2">
                             <Filter className="w-4 h-4" /> 
                             {filterUser.length === 0 ? "Semua Sales" : `${filterUser.length} Sales Dipilih`}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-0" align="start">
                        <div className="p-3 border-b bg-muted/50 font-semibold text-xs">Pilih Sales</div>
                        <div className="max-h-60 overflow-y-auto p-2 space-y-2">
                            {relevantUsers.map(u => (
                                <div key={u.id} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={u.id} 
                                        checked={filterUser.includes(u.id)}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setFilterUser(prev => [...prev, u.id]);
                                            } else {
                                                setFilterUser(prev => prev.filter(id => id !== u.id));
                                            }
                                        }}
                                    />
                                    <label htmlFor={u.id} className="text-xs cursor-pointer select-none">
                                        {u.nama}
                                    </label>
                                </div>
                            ))}
                            {relevantUsers.length === 0 && <p className="text-[10px] text-center p-2 text-muted-foreground">Tidak ada sales dengan piutang</p>}
                        </div>
                        <div className="p-2 border-t flex justify-between bg-muted/20">
                             <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setFilterUser([])}>Reset</Button>
                             <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setFilterUser(relevantUsers.map(u => u.id))}>Pilih Semua</Button>
                        </div>
                    </PopoverContent>
                </Popover>
                 
                <div className="relative flex-1 md:w-[200px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama / kode..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-xs w-full"
                    />
                </div>

                <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-9 bg-white border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800">
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
                </Button>
            </div>
        </div>

        {/* Total Summary */}
        <Card className="bg-gradient-to-br from-red-50 to-white border-red-200 shadow-sm">
             <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-100 rounded-full shadow-inner">
                        <TrendingUp className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Piutang Berjalan</p>
                        <h2 className="text-2xl sm:text-3xl font-bold text-red-700 mt-1">{formatRupiah(totalPiutang)}</h2>
                    </div>
                </div>
             </CardContent>
        </Card>

        {/* Data Table */}
        <Card className="border-none shadow-md overflow-hidden">
            <div className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    Rincian Piutang
                    <Badge variant="secondary" className="font-normal text-xs">{sortedList.length} Pelanggan</Badge>
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Urutkan:</span>
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                        <SelectTrigger className="w-[140px] h-8 text-xs bg-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                            <SelectItem value="highest">Termiskin (Hutang Tertinggi)</SelectItem>
                            <SelectItem value="lowest">Terkaya (Hutang Terendah)</SelectItem>
                            <SelectItem value="name-asc">Nama (A-Z)</SelectItem>
                            <SelectItem value="name-desc">Nama (Z-A)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[120px]">Sales</TableHead>
                            <TableHead className="w-[120px]">Kategori</TableHead>
                            <TableHead>Pelanggan</TableHead>
                            <TableHead className="text-right hidden sm:table-cell">Limit Kredit</TableHead>
                            <TableHead className="text-right hidden sm:table-cell">Sisa Plafon</TableHead>
                            <TableHead className="text-right font-bold text-red-600">Total Hutang</TableHead>
                            <TableHead className="w-[80px]">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedList.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                    Tidak ada data piutang ditemukan
                                </TableCell>
                            </TableRow>
                        ) : (() => {
                            // Logic Grouping & Subtotal
                            const rows: React.ReactNode[] = [];
                            const groups: { [key: string]: typeof sortedList } = {};

                            sortedList.forEach(item => {
                                if (!groups[item.salesId]) groups[item.salesId] = [];
                                groups[item.salesId].push(item);
                            });

                            const isMultiSales = Object.keys(groups).length > 1;

                            Object.keys(groups).forEach(salesId => {
                                const groupItems = groups[salesId];
                                const salesName = users.find(u => u.id === salesId)?.nama || 'Tanpa Sales';
                                let subtotal = 0;

                                groupItems.forEach(item => {
                                    subtotal += item.totalHutang;
                                    const kategori = kategoriPelanggan.find(k => k.id === item.kategoriId);

                                    rows.push(
                                        <TableRow key={item.id} className="hover:bg-muted/30">
                                            <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                                                {salesName}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px] font-normal whitespace-nowrap">
                                                    {kategori?.nama || '-'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium text-sm">{item.nama}</div>
                                            </TableCell>
                                            <TableCell className="text-right hidden sm:table-cell text-muted-foreground text-xs">
                                                {formatRupiah(item.limitMax)}
                                            </TableCell>
                                            <TableCell className="text-right hidden sm:table-cell text-muted-foreground text-xs">
                                                {formatRupiah(item.sisaPlafon)}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-red-600">
                                                {formatRupiah(item.totalHutang)}
                                                {item.overdueInvoices > 0 && (
                                                    <div className="text-[10px] text-red-500 font-normal">
                                                        {item.overdueInvoices} Nota Jatuh Tempo
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Button 
                                                    size="sm" 
                                                    variant="default" 
                                                    className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                                                    onClick={() => handlePayClick(item.id, item.nama)}
                                                >
                                                    Bayar
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                });

                                // Add Subtotal row if multi-sales
                                if (isMultiSales) {
                                    rows.push(
                                        <TableRow key={`subtotal-${salesId}`} className="bg-muted/50 border-t-2 font-bold">
                                            <TableCell colSpan={5} className="text-right py-2 italic text-xs">
                                                Subtotal {salesName}
                                            </TableCell>
                                            <TableCell className="text-right text-red-700 py-2">
                                                {formatRupiah(subtotal)}
                                            </TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>
                                    );
                                }
                            });

                            return rows;
                        })()}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={5} className="text-right font-bold">Grand Total Hutang</TableCell>
                             <TableCell className="text-right font-bold text-red-600">
                                {formatRupiah(totalPiutang)}
                             </TableCell>
                             <TableCell colSpan={2}></TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
        </Card>

        {/* Debt Selection Dialog */}
        <AlertDialog open={isDebtDialogOpen} onOpenChange={setIsDebtDialogOpen}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Pilih Transaksi untuk Dibayar
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-left">
                        <div className="mb-4">
                            Daftar hutang untuk pelanggan <span className="font-bold text-foreground">{selectedCustomerName}</span>.
                            <br/>Klik "Lihat Detail" untuk memproses pembayaran per nota.
                        </div>
                        
                        <div className="border rounded-md max-h-[300px] overflow-y-auto bg-muted/20">
                            {unpaidDebtsForDialog.map((debt, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 border-b last:border-0 hover:bg-muted/50 transition-colors">
                                    <div className="space-y-1">
                                        <p className="font-semibold text-xs text-foreground">{debt.nomorNota}</p>
                                        <div className="flex gap-2 text-[10px] text-muted-foreground">
                                            <span>{new Date(debt.tanggal).toLocaleDateString('id-ID')}</span>
                                            {debt.jatuhTempo && (
                                                <span className={new Date(debt.jatuhTempo) < new Date() ? "text-red-500 font-bold" : ""}>
                                                    Jatuh Tempo: {new Date(debt.jatuhTempo).toLocaleDateString('id-ID')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-red-600 text-xs">
                                            {formatRupiah(debt.total - (debt.bayar || 0))}
                                        </p>
                                        <Button 
                                            variant="link" 
                                            size="sm" 
                                            className="h-auto p-0 text-[10px] text-primary"
                                            onClick={() => navigate(`/penjualan/${debt.id}`)}
                                        >
                                            Lihat Detail &rarr;
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsDebtDialogOpen(false)}>
                        Tutup
                    </AlertDialogCancel>
                    {/* Optional: Add a button to go to Customer Detail if they want to see everything
                    <AlertDialogAction onClick={() => {
                         // Find ID logic needed or pass ID to state?
                         // For now, list navigation is efficient. 
                    }}>
                        Lihat Semua
                    </AlertDialogAction> */}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
