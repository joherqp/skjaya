import { useState, useRef, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { Search, Plus, Wallet, Filter, Clock, CheckCircle, XCircle, Users, AlertCircle } from 'lucide-react';
import { formatRupiah, formatCompactRupiah, formatTanggal } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';

// Helper Component for Toggleable Amount
const ToggleAmount = ({ amount, className }: { amount: number, className?: string }) => {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setShowDetail(!showDetail);
      }}
      className={`cursor-pointer hover:underline decoration-dashed underline-offset-4 decoration-primary/50 transition-all ${className}`}
      title={showDetail ? "Klik untuk menyingkat" : "Klik untuk melihat detail"}
    >
      {showDetail ? formatRupiah(amount) : formatCompactRupiah(amount)}
    </span>
  );
};

export default function Setoran() {
  const { user } = useAuth();
  const {
    setoran, penjualan, saldoPengguna, rekeningBank,
    users, cabang, viewMode, persetujuan
  } = useDatabase();
  const [search, setSearch] = useState('');
  const [filterCabang, setFilterCabang] = useState<string>('all');
  const navigate = useNavigate();
  const [displayLimit, setDisplayLimit] = useState(10);

  // Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const activeFiltersCount =
    (filterStartDate ? 1 : 0) +
    (filterEndDate ? 1 : 0) +
    (filterStatus.length > 0 ? 1 : 0);



  const isAdminOrOwner = user?.roles.includes('admin') || user?.roles.includes('owner');
  const isFinance = user?.roles.includes('finance') || isAdminOrOwner;

  // 2. Determine Target Users based on Role & Filter
  // If Admin/Owner: Filter users by selected branch (or all)
  // If Sales: Only self
  const targetUsers = isAdminOrOwner
    ? users.filter(u => {
      if (viewMode === 'me') return u.id === user?.id;
      return filterCabang === 'all' ? true : u.cabangId === filterCabang;
    })
    : users.filter(u => {
      if (viewMode === 'me') return u.id === user?.id;
      // Leaders can see branch in 'all' mode
      const isUserLeader = user?.roles.includes('leader');
      if (isUserLeader) return u.cabangId === user?.cabangId;
      return u.id === user?.id;
    });

  const targetUserIds = targetUsers.map(u => u.id);

  // 3. Current Saldo Calculation
  // Sum of saldoPengguna for all target users
  const currentSaldo = saldoPengguna
    .filter(s => targetUserIds.includes(s.userId))
    .reduce((sum, s) => sum + s.saldo, 0);

  // 4. Setoran Data
  // Get all deposits for target users
  const basicSetoran = setoran.filter(s => targetUserIds.includes(s.salesId));

  // Get Setoran Pusat (rencana_setoran)
  const setoranPusat = persetujuan
    .filter(p => p.jenis === 'rencana_setoran' && targetUserIds.includes(p.diajukanOleh))
    .map(p => {
      const pData = p.data as { amount?: number; rekeningTujuanId?: string };
      return {
        id: p.id,
        nomorSetoran: `SP/${new Date(p.tanggalPengajuan).getFullYear()}/${p.id.substring(0, 4).toUpperCase()}`,
        tanggal: p.tanggalPengajuan,
        jumlah: pData?.amount || 0,
        status: p.status,
        salesId: p.diajukanOleh,
        rekeningId: pData?.rekeningTujuanId,
        isPusat: true
      };
    });

  // Merge and sort newest first
  const relevantSetoran = [...basicSetoran, ...setoranPusat].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

  // Filter by Search Query
  // Filter by Search & Advanced Filters
  const filteredSetoran = relevantSetoran.filter(s => {
    // 1. Search
    const matchesSearch = s.nomorSetoran.toLowerCase().includes(search.toLowerCase());

    // 2. Date Filter
    let matchesDate = true;
    if (filterStartDate || filterEndDate) {
      const sDate = new Date(s.tanggal);
      sDate.setHours(0, 0, 0, 0);

      if (filterStartDate) {
        const start = new Date(filterStartDate);
        start.setHours(0, 0, 0, 0);
        if (sDate < start) matchesDate = false;
      }
      if (filterEndDate && matchesDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        if (sDate > end) matchesDate = false;
      }
    }

    // 3. Status Filter
    const matchesStatus = filterStatus.length === 0 || filterStatus.includes(s.status);

    return matchesSearch && matchesDate && matchesStatus;
  });

  // Infinite scroll observer


  // 5. Calculate Stats from Relevant Setoran
  const totalPending = relevantSetoran
    .filter(s => s.status === 'pending')
    .reduce((sum, s) => sum + s.jumlah, 0);

  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);

  const totalDisetujui = relevantSetoran
    .filter(s => {
      if (s.status !== 'disetujui') return false;
      const setoranDate = new Date(s.tanggal);
      setoranDate.setHours(0, 0, 0, 0);
      return setoranDate.getTime() === hariIni.getTime();
    })
    .reduce((sum, s) => sum + s.jumlah, 0);

  // 6. Finance Monitoring Data (Team Balances)
  const teamBalances = isFinance ? users
    .filter(u => {
      if (viewMode === 'me') return u.id === user?.id;
      if (isAdminOrOwner) {
        // If filter is active, check branch
        if (filterCabang !== 'all') return u.cabangId === filterCabang;
        return true; // Show all for Global
      }
      // If finance, see same branch
      return u.cabangId === user?.cabangId;
    })
    .map(u => {
      const saldo = saldoPengguna.find(s => s.userId === u.id)?.saldo || 0;
      return { user: u, saldo };
    })
    .filter(item => item.saldo !== 0) // Show both positive and negative
    .sort((a, b) => b.saldo - a.saldo)
    : [];

  // Calculate Summaries for Finance Monitoring
  const totalSaldoTeam = teamBalances.reduce((acc, curr) => acc + curr.saldo, 0);
  const mySaldo = teamBalances.find(t => t.user.id === user?.id)?.saldo || 0;
  const totalLebihSetor = teamBalances
    .filter(t => t.saldo < 0)
    .reduce((acc, curr) => acc + Math.abs(curr.saldo), 0);

  // Formula: Saldo Team - Saldo Finance (Me) + Saldo Lebih Setor (Absolute)
  // Logic: Net Team Balance - My Holding + Overpayments = Gross Outstanding from Others
  const totalBelumSetor = totalSaldoTeam - mySaldo + totalLebihSetor;

  return (
    <MainLayout title="Setoran">
      <div className="p-3 md:p-4 space-y-3 md:space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <Card className="bg-primary/5 border-primary/20 col-span-2 md:col-span-2">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {user?.roles.includes('admin') || user?.roles.includes('owner') ? 'Saldo Global' : 'Saldo (Belum Setor)'}
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-primary">
                    <ToggleAmount amount={currentSaldo} />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-warning/5 border-warning/20">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 rounded-lg bg-warning/10 shrink-0">
                  <Clock className="w-4 h-4 md:w-5 md:h-5 text-warning" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] md:text-xs text-muted-foreground truncate">Menunggu</p>
                  <p className="text-base md:text-lg font-bold text-warning truncate">
                    <ToggleAmount amount={totalPending} />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-success/5 border-success/20">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 rounded-lg bg-success/10 shrink-0">
                  <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-success" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] md:text-xs text-muted-foreground truncate">Disetujui</p>
                  <p className="text-base md:text-lg font-bold text-success truncate">
                    <ToggleAmount amount={totalDisetujui} />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Finance Monitoring Section */}
        {isFinance && (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 px-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">Monitoring Saldo Tim</h3>
                {isAdminOrOwner && (
                  <div className="w-[160px] md:w-[200px]">
                    <Select value={filterCabang} onValueChange={setFilterCabang}>
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
                )}
              </div>

              {/* Summary Cards for Team */}
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-3 md:p-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="p-1.5 md:p-2 rounded-lg bg-primary/10 shrink-0">
                        <Users className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] md:text-xs text-muted-foreground truncate">Saldo Team</p>
                        <p className="text-base md:text-lg font-bold text-primary truncate">
                          <ToggleAmount amount={totalSaldoTeam} />
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="p-3 md:p-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="p-1.5 md:p-2 rounded-lg bg-orange-100 shrink-0">
                        <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] md:text-xs text-muted-foreground truncate">Belum Setor (Tim)</p>
                        <p className="text-base md:text-lg font-bold text-orange-600 truncate">
                          <ToggleAmount amount={totalBelumSetor} />
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                {teamBalances.slice(0, 5).map((item, idx) => (
                  <Card key={item.user.id} className="animate-slide-up" style={{ animationDelay: `${idx * 50}ms` }}>
                    <CardContent className="p-2.5 md:p-3 flex items-center justify-between gap-2 md:gap-3">
                      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] md:text-xs font-bold text-primary shrink-0">
                          {item.user.nama.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs md:text-sm font-medium truncate">{item.user.nama}</p>
                          <p className="text-[10px] text-muted-foreground uppercase truncate">{item.user.roles[0]}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs md:text-sm font-bold ${item.saldo > 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                          {formatRupiah(item.saldo)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.saldo > 0 ? 'Belum Setor' : 'Lebih Setor'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {teamBalances.length > 5 && (
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate('/pengaturan/users')}>
                    Lihat Semua ({teamBalances.length})
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search & Actions */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari setoran..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 md:h-10 text-sm"
            />
          </div>
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className={`h-9 w-9 md:h-10 md:w-10 ${activeFiltersCount > 0 ? "border-primary text-primary relative" : ""}`}>
                <Filter className="w-4 h-4" />
                {activeFiltersCount > 0 && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span></span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium leading-none">Filter Setoran</h4>
                  {(activeFiltersCount > 0) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-destructive text-xs"
                      onClick={() => {
                        setFilterStartDate('');
                        setFilterEndDate('');
                        setFilterStatus([]);
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
                    {['pending', 'disetujui', 'ditolak'].map(status => (
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
              </div>
            </PopoverContent>
          </Popover>
          <Button size="icon" variant="glow" onClick={() => navigate('/setoran/buat')} className="h-9 w-9 md:h-10 md:w-10">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Setoran List */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">Riwayat Setoran</h3>

          {filteredSetoran.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Wallet className="w-12 h-12 mx-auto text-muted-foreground/50" />
                <p className="mt-3 text-muted-foreground">Tidak ada setoran ditemukan</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {filteredSetoran.slice(0, displayLimit).map((item, index) => {
                const isPusat = (item as { isPusat?: boolean }).isPusat;
                const rekening = rekeningBank.find(r => r.id === item.rekeningId);
                const recipientUser = rekening?.assignedUserId ? users.find(u => u.id === rekening.assignedUserId) : null;

                return (
                  <Card
                    key={item.id}
                    elevated
                    className="animate-slide-up cursor-pointer hover:border-primary/30"
                    style={{ animationDelay: `${index * 30}ms` }}
                    onClick={() => navigate(`/setoran/${item.id}`)}
                  >
                    <CardContent className="p-3 md:p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 md:gap-3 min-w-0">
                          <div className={`p-1.5 md:p-2 rounded-lg shrink-0 ${item.status === 'pending' ? 'bg-warning/10' :
                            item.status === 'disetujui' ? 'bg-success/10' : 'bg-destructive/10'
                            }`}>
                            {item.status === 'pending' ? (
                              <Clock className="w-4 h-4 md:w-5 md:h-5 text-warning" />
                            ) : item.status === 'disetujui' ? (
                              <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-success" />
                            ) : (
                              <XCircle className="w-4 h-4 md:w-5 md:h-5 text-destructive" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-xs md:text-sm truncate">
                              {item.nomorSetoran} {isPusat && <span className="ml-1 text-[10px] bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded">Pusat</span>}
                            </p>
                            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 truncate">
                              {isPusat ? 'Tujuan: Pusat / Finance' : (rekening?.namaBank ? `${rekening.namaBank} ${recipientUser ? `- ${recipientUser.username}` : (rekening.isTunai ? '' : `- ${rekening.atasNama}`)}` : 'Setoran Tunai')}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {formatTanggal(new Date(item.tanggal))}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base md:text-lg font-bold">
                            <ToggleAmount amount={item.jumlah} />
                          </p>
                          <Badge variant={
                            item.status === 'pending' ? 'warning' :
                              item.status === 'disetujui' ? 'success' : 'destructive'
                          } className="mt-1 text-[10px] md:text-xs">
                            {item.status === 'pending' ? 'Menunggu' :
                              item.status === 'disetujui' ? 'Disetujui' : 'Ditolak'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {filteredSetoran.length > displayLimit && (
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
