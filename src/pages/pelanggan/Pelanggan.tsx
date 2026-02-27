import { useState, useRef, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDatabase } from '@/contexts/DatabaseContext';
import { Search, Plus, Users, MapPin, Phone, Filter, ArrowLeftRight, UserCheck } from 'lucide-react';
import { formatRupiah, formatCompactRupiah } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


export default function Pelanggan() {
  const { user } = useAuth();
  const { pelanggan, users, kategoriPelanggan, profilPerusahaan, viewMode, setViewMode } = useDatabase();
  const [search, setSearch] = useState('');
  const [displayLimit, setDisplayLimit] = useState(10);
  const [scopedSalesId, setScopedSalesId] = useState<string>('all');
  
  // Filters
  const [filterKategori, setFilterKategori] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const navigate = useNavigate();

  const activeFiltersCount = (filterKategori.length > 0 ? 1 : 0) + (filterStatus !== 'all' ? 1 : 0);

  const isAdminOrOwner = user?.roles.includes('admin') || user?.roles.includes('owner');
  const isLeader = user?.roles.includes('leader');

  const filteredPelanggan = pelanggan.filter(p => {
    // 1. Scope Constraint (Sub-database logic)
    const effectiveSalesId = viewMode === 'me' ? (user?.id || 'all') : scopedSalesId;

    if (isAdminOrOwner) {
        if (effectiveSalesId !== 'all' && p.salesId !== effectiveSalesId) return false;
    } else if (p.cabangId !== user?.cabangId) {
        return false; // Branch isolation
    } else if (isLeader) {
        if (effectiveSalesId !== 'all' && p.salesId !== effectiveSalesId) return false;
    } else if (p.salesId !== user?.id) {
        // Normal sales always only see theirs
        return false;
    }

    // 2. Search Constraint
    const matchesSearch = p.nama.toLowerCase().includes(search.toLowerCase()) ||
           p.kode.toLowerCase().includes(search.toLowerCase()) ||
           p.alamat.toLowerCase().includes(search.toLowerCase());

    // 3. Category Filter
    const matchesCategory = filterKategori.length === 0 || filterKategori.includes(p.kategoriId);

    // 4. Status Filter
    const matchesStatus = filterStatus === 'all' 
        ? true 
        : filterStatus === 'active' ? p.isActive 
        : !p.isActive;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Infinite scroll observer


  return (
    <MainLayout title="Pelanggan">
      <div className="p-4 space-y-4">
        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari pelanggan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className={activeFiltersCount > 0 ? "border-primary text-primary relative" : ""}>
                    <Filter className="w-4 h-4" />
                    {activeFiltersCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                        </span>
                    )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                    <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium leading-none">Filter Pelanggan</h4>
                            {(filterKategori.length > 0 || filterStatus !== 'all') && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-auto p-0 text-destructive text-xs" 
                                    onClick={() => { setFilterKategori([]); setFilterStatus('all'); }}
                                >
                                    Reset
                                </Button>
                            )}
                        </div>

                        {/* Status Filter */}
                        <div className="space-y-3">
                            <Label>Status</Label>
                            <Select value={filterStatus} onValueChange={(val: 'all' | 'active' | 'inactive') => setFilterStatus(val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Status</SelectItem>
                                    <SelectItem value="active">Aktif</SelectItem>
                                    <SelectItem value="inactive">Non-Aktif</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Category Filter */}
                        <div className="space-y-3">
                            <Label>Kategori</Label>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                {kategoriPelanggan.map(cat => (
                                    <div key={cat.id} className="flex items-center space-x-2">
                                        <input 
                                            type="checkbox" 
                                            id={`cat-${cat.id}`}
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            checked={filterKategori.includes(cat.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setFilterKategori([...filterKategori, cat.id]);
                                                else setFilterKategori(filterKategori.filter(id => id !== cat.id));
                                            }}
                                        />
                                        <label htmlFor={`cat-${cat.id}`} className="text-sm leading-none cursor-pointer">
                                            {cat.nama}
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
          {user?.roles.includes('sales') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all">
                  <Plus className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate('/pelanggan/tambah')} className="cursor-pointer">
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Pelanggan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/pelanggan/mutasi')} className="cursor-pointer">
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  Mutasi Pelanggan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{filteredPelanggan.length}</p>
              <p className="text-xs text-muted-foreground">Total Pelanggan</p>
            </CardContent>
          </Card>
          <Card className="bg-success/5 border-success/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-success">
                {filteredPelanggan.filter(p => p.isActive).length}
              </p>
              <p className="text-xs text-muted-foreground">Aktif</p>
            </CardContent>
          </Card>
        </div>

        {/* Pelanggan List */}
        <div className="space-y-3">
          {filteredPelanggan.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground/50" />
                <p className="mt-3 text-muted-foreground">Tidak ada pelanggan ditemukan</p>
              </CardContent>
            </Card>
          ) : (
             <>
               {filteredPelanggan.slice(0, displayLimit).map((item, index) => {
                const kategori = kategoriPelanggan.find(k => k.id === item.kategoriId);
                const sales = users.find(u => u.id === item.salesId);
 
                const limitKredit = profilPerusahaan?.config?.useGlobalLimit 
                    ? (profilPerusahaan.config.globalLimitAmount || 0)
                    : (item.limitKredit + item.sisaKredit);

                const sisaPlafon = profilPerusahaan?.config?.useGlobalLimit
                    ? ((profilPerusahaan.config.globalLimitAmount || 0) - item.sisaKredit)
                    : item.limitKredit;

                return (
                  <Card 
                    key={item.id} 
                    elevated 
                    className="animate-slide-up cursor-pointer hover:border-primary/30"
                    style={{ animationDelay: `${index * 30}ms` }}
                    onClick={() => navigate(`/pelanggan/${item.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-bold text-primary">
                            {item.nama.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-sm">{item.nama}</p>
                              <p className="text-xs text-muted-foreground">{item.kode}</p>
                            </div>
                            <Badge variant={
                              kategori?.nama === 'Platinum' ? 'default' :
                              kategori?.nama === 'Gold' ? 'warning' :
                              kategori?.nama === 'Silver' ? 'secondary' : 'muted'
                            }>
                              {kategori?.nama}
                            </Badge>
                          </div>
                          <div className="mt-2 space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">{item.alamat}</span>
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Phone className="w-3 h-3" />
                              {item.telepon}
                            </p>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                              Sales: <span className="font-medium text-foreground">{sales?.nama}</span>
                            </span>
                          </div>
                           <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t bg-muted/20 -mx-4 -mb-4 px-4 py-2">
                                <div>
                                    <p className="text-[10px] text-muted-foreground">Limit (Max)</p>
                                    <p className="text-xs font-semibold">
                                        <span className="md:hidden">{formatCompactRupiah(limitKredit)}</span>
                                        <span className="hidden md:inline">{formatRupiah(limitKredit)}</span>
                                    </p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] text-muted-foreground">Sisa Plafon</p>
                                    <p className="text-xs font-semibold text-green-600">
                                        <span className="md:hidden">{formatCompactRupiah(sisaPlafon)}</span>
                                        <span className="hidden md:inline">{formatRupiah(sisaPlafon)}</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-muted-foreground">Total Hutang</p>
                                    <p className="text-xs font-bold text-red-600">
                                        <span className="md:hidden">{formatCompactRupiah(item.sisaKredit)}</span>
                                        <span className="hidden md:inline">{formatRupiah(item.sisaKredit)}</span>
                                    </p>
                                </div>
                           </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
                {filteredPelanggan.length > displayLimit && (
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
    </MainLayout>
  );
}
