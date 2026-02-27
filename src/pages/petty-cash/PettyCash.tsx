import React, { useState, useEffect, useRef } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatTanggal, cn } from '@/lib/utils';
import { ArrowUpCircle, ArrowDownCircle, History, Wallet, FileText, ArrowUp, ArrowDown, User, Calendar, Tag, Info, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PettyCash as PettyCashType } from '@/lib/types';
import { Filter, X, Search, Plus } from 'lucide-react';

export default function PettyCash() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [selectedTransaction, setSelectedTransaction] = useState<PettyCashType | null>(null);

  // Filter States
  const [filterBranchId, setFilterBranchId] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const isAdminOrOwner = user?.roles.some(r => ['admin', 'owner'].includes(r));
  const { pettyCash, users, cabang } = useDatabase();

  const activeFiltersCount = 
    (filterBranchId !== 'all' ? 1 : 0) + 
    (filterCategory !== 'all' ? 1 : 0) + 
    (filterStartDate ? 1 : 0) + 
    (filterEndDate ? 1 : 0);

  // Filter Transactions based on Role using useMemo
  const { displayedData, currentBalance } = React.useMemo(() => {
      // 1. Identify permissions
      const isGlobalAccess = isAdminOrOwner;
      
      // 2. Filter logic
      let filtered = isGlobalAccess 
          ? pettyCash 
          : pettyCash.filter(item => {
              // Find creator
              const creator = users.find(u => u.id === item.createdBy);
              // Match branch
              return creator?.cabangId === user?.cabangId;
          });

      // Apply Admin/Owner Filters
      if (isGlobalAccess) {
          if (filterBranchId !== 'all') {
              filtered = filtered.filter(item => {
                  const creator = users.find(u => u.id === item.createdBy);
                  return creator?.cabangId === filterBranchId;
              });
          }
      }

      // Apply Common Filters
      if (filterCategory !== 'all') {
          filtered = filtered.filter(item => item.kategori === filterCategory);
      }

      if (filterStartDate) {
          const start = new Date(filterStartDate);
          start.setHours(0,0,0,0);
          filtered = filtered.filter(item => new Date(item.tanggal) >= start);
      }

      if (filterEndDate) {
          const end = new Date(filterEndDate);
          end.setHours(23,59,59,999);
          filtered = filtered.filter(item => new Date(item.tanggal) <= end);
      }

      // 3. Sort by Date Descending
      const sorted = [...filtered].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

      // 4. Calculate Balance for this specific view scope
      const balance = sorted.reduce((acc, curr) => {
          return acc + (curr.tipe === 'masuk' ? curr.jumlah : -curr.jumlah);
      }, 0);

      return { displayedData: sorted, currentBalance: balance };
  }, [pettyCash, users, user, isAdminOrOwner, filterBranchId, filterCategory, filterStartDate, filterEndDate]);

  const displayedTransactions = displayedData.slice(0, visibleCount);
  const hasMore = visibleCount < displayedData.length;



  return (
    <MainLayout title="Kas Kecil (Petty Cash)">
      <div className="p-4 space-y-6">

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="col-span-2 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-800">
                        <Wallet className="w-4 h-4" /> Saldo Saat Ini
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-4xl font-bold text-blue-700">
                        {formatCurrency(currentBalance)}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 mt-4">
                        <Button className="flex-1 bg-green-600 hover:bg-green-700 h-10 text-xs sm:text-sm shadow-sm" onClick={() => navigate('/petty-cash/tambah?type=masuk')}>
                            <ArrowUpCircle className="w-4 h-4 mr-2" /> Tambah Dana
                        </Button>
                        <Button className="flex-1 bg-red-600 hover:bg-red-700 h-10 text-xs sm:text-sm shadow-sm" onClick={() => navigate('/petty-cash/tambah?type=keluar')}>
                            <ArrowDownCircle className="w-4 h-4 mr-2" /> Catat Pengeluaran
                        </Button>
                    </div>
                </CardContent>
            </Card>
            
            <div className="grid grid-cols-2 gap-3 col-span-2 lg:col-span-2">
                <Card className="col-span-1 border-none shadow-sm sm:border bg-green-50/50">
                    <CardHeader className="pb-1 p-3">
                        <CardTitle className="text-[10px] sm:text-xs font-medium text-green-600 uppercase tracking-wider flex items-center gap-1">
                             <ArrowUp className="w-3 h-3" /> Pemasukan (Bulan Ini)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-sm sm:text-xl font-bold text-green-700 truncate">
                            +{formatCurrency(
                                displayedData
                                .filter(p => p.tipe === 'masuk' && new Date(p.tanggal).getMonth() === new Date().getMonth())
                                .reduce((acc, c) => acc + c.jumlah, 0)
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-1 border-none shadow-sm sm:border bg-red-50/50">
                    <CardHeader className="pb-1 p-3">
                        <CardTitle className="text-[10px] sm:text-xs font-medium text-red-600 uppercase tracking-wider flex items-center gap-1">
                            <ArrowDown className="w-3 h-3" /> Pengeluaran (Bulan Ini)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-sm sm:text-xl font-bold text-red-700 truncate">
                            -{formatCurrency(
                                displayedData
                                .filter(p => p.tipe === 'keluar' && new Date(p.tanggal).getMonth() === new Date().getMonth())
                                .reduce((acc, c) => acc + c.jumlah, 0)
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>

        <Card className="border-none shadow-sm sm:border">
            <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5" /> 
                        Riwayat Transaksi {isAdminOrOwner ? '(Global)' : ''}
                    </div>
                    
                    {isAdminOrOwner && (
                        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                            <PopoverTrigger asChild>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className={cn("h-8 gap-1.5", activeFiltersCount > 0 && "border-primary text-primary bg-primary/5")}
                                >
                                    <Filter className="w-3.5 h-3.5" />
                                    <span className="text-xs">Filter</span>
                                    {activeFiltersCount > 0 && (
                                        <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px] ml-0.5">
                                            {activeFiltersCount}
                                        </Badge>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-0" align="end">
                                <div className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-semibold text-sm">Filter Kas Kecil</h4>
                                        {activeFiltersCount > 0 && (
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-7 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => {
                                                    setFilterBranchId('all');
                                                    setFilterCategory('all');
                                                    setFilterStartDate('');
                                                    setFilterEndDate('');
                                                }}
                                            >
                                                Reset
                                            </Button>
                                        )}
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        {/* Branch Filter */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Cabang</Label>
                                            <Select value={filterBranchId} onValueChange={setFilterBranchId}>
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Semua Cabang" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">Semua Cabang</SelectItem>
                                                    {cabang.map(c => (
                                                        <SelectItem key={c.id} value={c.id}>{c.nama}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Category Filter */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Kategori</Label>
                                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Semua Kategori" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">Semua Kategori</SelectItem>
                                                    {Array.from(new Set(pettyCash.map(p => p.kategori))).sort().map(cat => (
                                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Date Filter */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Rentang Tanggal</Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input 
                                                    type="date" 
                                                    className="h-8 text-[10px] px-2" 
                                                    value={filterStartDate}
                                                    onChange={(e) => setFilterStartDate(e.target.value)}
                                                />
                                                <Input 
                                                    type="date" 
                                                    className="h-8 text-[10px] px-2" 
                                                    value={filterEndDate}
                                                    onChange={(e) => setFilterEndDate(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {displayedTransactions.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                            <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p>Belum ada transaksi.</p>
                        </div>
                    ) : (
                        <>
                            {displayedTransactions.map((item) => (
                                <div 
                                    key={item.id} 
                                    className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-slate-50/80 transition-all group cursor-pointer"
                                    onClick={() => {
                                        setSelectedTransaction(item);
                                        setIsDetailOpen(true);
                                    }}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border ${
                                            item.tipe === 'masuk' 
                                                ? 'bg-green-100 border-green-200 text-green-600' 
                                                : 'bg-red-100 border-red-200 text-red-600'
                                        }`}>
                                            {item.tipe === 'masuk' ? <ArrowUp className="w-5 h-5" /> : <ArrowDown className="w-5 h-5" />}
                                        </div>
                                        
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-sm sm:text-base truncate group-hover:text-primary transition-colors">
                                                {item.keterangan}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                <span>{formatTanggal(item.tanggal)}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                <Badge variant="secondary" className="font-normal text-[10px] h-5 px-1.5 bg-slate-100 text-slate-600 border-slate-200">
                                                    {item.kategori}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col items-end gap-0.5 ml-3">
                                        <span className={`font-bold text-sm sm:text-base whitespace-nowrap ${
                                            item.tipe === 'masuk' ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                            {item.tipe === 'masuk' ? '+' : '-'}{formatCurrency(item.jumlah)}
                                        </span>
                                        {item.buktiUrl && (
                                             <a href={item.buktiUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-1 hover:underline">
                                                 <FileText className="w-3 h-3" /> Bukti
                                             </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {hasMore && (
                                <Button 
                                    variant="ghost" 
                                    className="w-full mt-4 border-dashed text-muted-foreground"
                                    onClick={() => setVisibleCount(prev => prev + 10)}
                                >
                                    Lihat Lainnya
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" /> Detail Transaksi
            </DialogTitle>
            <DialogDescription>
              Detail lengkap transaksi kas kecil.
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-6 py-2">
              <div className={`p-4 rounded-xl flex flex-col items-center justify-center border-2 border-dashed ${
                selectedTransaction.tipe === 'masuk' 
                  ? 'bg-green-50 border-green-100' 
                  : 'bg-red-50 border-red-100'
              }`}>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Jumlah {selectedTransaction.tipe === 'masuk' ? 'Masuk' : 'Keluar'}
                </span>
                <span className={`text-3xl font-bold ${
                  selectedTransaction.tipe === 'masuk' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {selectedTransaction.tipe === 'masuk' ? '+' : '-'}{formatCurrency(selectedTransaction.jumlah)}
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <History className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Keterangan</p>
                    <p className="font-medium">{selectedTransaction.keterangan}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tanggal</p>
                      <p className="font-medium">{formatTanggal(selectedTransaction.tanggal)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Tag className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Kategori</p>
                      <Badge variant="outline" className="font-medium mt-0.5">
                        {selectedTransaction.kategori}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Dicatat Oleh</p>
                    <p className="font-medium">
                      {users.find(u => u.id === selectedTransaction.createdBy)?.nama || 'System'}
                    </p>
                  </div>
                </div>

                {selectedTransaction.buktiUrl && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Bukti Transaksi
                    </p>
                    <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-video bg-slate-50 flex items-center justify-center">
                        <img 
                            src={selectedTransaction.buktiUrl} 
                            alt="Bukti" 
                            className="w-full h-full object-cover"
                        />
                        <a 
                            href={selectedTransaction.buktiUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white gap-2 font-medium"
                        >
                            <ExternalLink className="w-5 h-5" /> Lihat Ukuran Penuh
                        </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
