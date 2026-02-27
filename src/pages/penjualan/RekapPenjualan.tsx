import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDatabase } from '@/contexts/DatabaseContext';
import { formatRupiah, formatCompactRupiah } from '@/lib/utils';
import { BarChart, TrendingUp, Calendar, ArrowLeft, Wallet, CreditCard, Receipt, User, Coins, Package, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useAuth } from '@/contexts/AuthContext';

export default function RekapPenjualan() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { penjualan, pelanggan, users, cabang, karyawan, viewMode, profilPerusahaan, barang } = useDatabase();
    const [isSingleDate, setIsSingleDate] = useState(true);
    const [singleDate, setSingleDate] = useState(() => {
        return new Date().toLocaleDateString('sv').split('T')[0];
    });

    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1); // First day of the month
        return d.toLocaleDateString('sv').split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        return new Date().toLocaleDateString('sv').split('T')[0];
    });

    const [showDetailed, setShowDetailed] = useState(false);

    // Scope Filtering: "Sub-database" logic
    const isAdminOrOwner = user?.roles.includes('admin') || user?.roles.includes('owner');
    const isLeader = user?.roles.includes('leader');

    const [filterCabang, setFilterCabang] = useState<string>(() => {
        if (isAdminOrOwner) {
            return 'all';
        }
        return user?.cabangId || '';
    });
    const [filterUser, setFilterUser] = useState<string>('all');

    const relevantUsers = useMemo(() => {
        let candidates = users.filter(u => u.cabangId !== 'cab-pusat');

        if (isAdminOrOwner) {
            if (filterCabang !== 'all') {
                candidates = candidates.filter(u => u.cabangId === filterCabang);
            }
        } else {
            candidates = candidates.filter(u => u.cabangId === user?.cabangId);
        }

        return candidates;
    }, [users, filterCabang, isAdminOrOwner, user]);

    const scopedPenjualan = penjualan.filter(p => {
        const pSalesId = p.salesId || p.createdBy;
        // 1. Base access check
        let hasAccess = false;
        if (isAdminOrOwner) {
            hasAccess = viewMode === 'me' ? (pSalesId === user?.id) : true;
        } else if (isLeader) {
            hasAccess = p.cabangId === user?.cabangId && (viewMode === 'me' ? (pSalesId === user?.id) : true);
        } else {
            hasAccess = pSalesId === user?.id; // Sales only see their own data
        }

        if (!hasAccess) return false;

        // 2. Specific Filters Check
        if (filterCabang !== 'all' && p.cabangId !== filterCabang) return false;
        if (filterUser !== 'all' && pSalesId !== filterUser) return false;

        return true;
    });

    const filtered = scopedPenjualan.filter(p => {
        const d = new Date(p.tanggal).toISOString().split('T')[0];
        if (isSingleDate) {
            return d === singleDate && p.status !== 'batal' && p.status !== 'draft';
        }
        return d >= startDate && d <= endDate && p.status !== 'batal' && p.status !== 'draft';
    });

    const totalOmzet = filtered.reduce((sum, p) => sum + p.total, 0);
    const totalTrx = filtered.length;
    // Calculate Total Qty with conversion (Regular items only)
    const totalQty = filtered.reduce((sum, p) => {
        const transactionQty = p.items
            .filter(item => !item.isBonus && item.subtotal > 0) // Exclude bonus/free items
            .reduce((acc, item) => acc + (item.jumlah * (item.konversi || 1)), 0);
        return sum + transactionQty;
    }, 0);

    // Calculate Total Promo Qty (Bonus & Free items)
    const totalPromoQty = filtered.reduce((sum, p) => {
        const transactionPromoQty = p.items
            .filter(item => item.isBonus || item.subtotal === 0) // Include bonus/free
            .reduce((acc, item) => acc + (item.jumlah * (item.konversi || 1)), 0);
        return sum + transactionPromoQty;
    }, 0);

    const tunai = filtered.filter(p => p.metodePembayaran === 'tunai').reduce((sum, p) => sum + p.total, 0);
    const kredit = filtered.filter(p => p.metodePembayaran === 'tempo').reduce((sum, p) => sum + p.total, 0);

    // Sales Performance Aggregation
    const salesPerformance = useMemo(() => {
        const stats: Record<string, { name: string; omzet: number; qty: number; promo: number; count: number }> = {};
        filtered.forEach(p => {
            const sId = p.salesId || p.createdBy;
            if (!stats[sId]) {
                const u = users.find(user => user.id === sId);
                const k = karyawan.find(k => k.userAccountId === sId);
                stats[sId] = { name: k?.nama || u?.nama || 'Sales', omzet: 0, qty: 0, promo: 0, count: 0 };
            }
            stats[sId].omzet += p.total;
            stats[sId].count += 1;
            p.items.forEach(item => {
                const q = item.jumlah * (item.konversi || 1);
                if (item.isBonus || item.subtotal === 0) {
                    stats[sId].promo += q;
                } else {
                    stats[sId].qty += q;
                }
            });
        });
        return Object.values(stats).sort((a, b) => b.omzet - a.omzet);
    }, [filtered, users, karyawan]);

    // Category Performance Aggregation
    const categoryPerformance = useMemo(() => {
        const stats: Record<string, { name: string; omzet: number; qty: number; count: number }> = {};
        filtered.forEach(p => {
            const customer = pelanggan.find(c => c.id === p.pelangganId);
            const catId = customer?.kategoriId || 'unknown';
            if (!stats[catId]) {
                const cat = useDatabase().kategoriPelanggan.find(k => k.id === catId);
                stats[catId] = { name: cat?.nama || 'Umum', omzet: 0, qty: 0, count: 0 };
            }
            stats[catId].omzet += p.total;
            stats[catId].count += 1;
            p.items.forEach(item => {
                if (!item.isBonus && item.subtotal > 0) {
                    stats[catId].qty += (item.jumlah * (item.konversi || 1));
                }
            });
        });
        return Object.values(stats).sort((a, b) => b.omzet - a.omzet);
    }, [filtered, pelanggan]);

    // Product Performance Aggregation
    const productPerformance = useMemo(() => {
        const stats: Record<string, { name: string; code: string; qty: number; total: number }> = {};
        filtered.forEach(p => {
            p.items.forEach(item => {
                const prodId = item.barangId;
                if (!stats[prodId]) {
                    const b = barang.find(prod => prod.id === prodId);
                    stats[prodId] = { name: b?.nama || item.barangId, code: b?.kode || '-', qty: 0, total: 0 };
                }
                stats[prodId].qty += (item.jumlah * (item.konversi || 1));
                stats[prodId].total += item.subtotal;
            });
        });
        return Object.values(stats).sort((a, b) => b.total - a.total);
    }, [filtered, barang]);

    const formatCurrency = (amount: number) => {
        return showDetailed ? formatRupiah(amount) : formatCompactRupiah(amount);
    };

    // Helper for formatting quantity
    const formatQty = (qty: number) => {
        return new Intl.NumberFormat('id-ID').format(qty);
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFontSize(18);
        doc.text('LAPORAN REKAP PENJUALAN', pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(11);
        doc.text(profilPerusahaan.nama, pageWidth / 2, 22, { align: 'center' });

        // Filter Info
        doc.setFontSize(9);
        const periodText = isSingleDate ? `Tanggal: ${new Date(singleDate).toLocaleDateString('id-ID')}` : `Periode: ${new Date(startDate).toLocaleDateString('id-ID')} s/d ${new Date(endDate).toLocaleDateString('id-ID')}`;
        const branchText = `Cabang: ${filterCabang === 'all' ? 'Semua Cabang' : cabang.find(c => c.id === filterCabang)?.nama}`;
        const userText = `Pengguna: ${filterUser === 'all' ? 'Semua Pengguna' : users.find(u => u.id === filterUser)?.nama}`;

        doc.text(periodText, 14, 32);
        doc.text(branchText, 14, 37);
        doc.text(userText, 14, 42);

        // Summary Table
        autoTable(doc, {
            startY: 48,
            head: [['RINGKASAN LAPORAN', 'NILAI']],
            body: [
                ['Total Omzet', formatRupiah(totalOmzet)],
                ['Total Transaksi', `${totalTrx} Nota`],
                ['Total Qty (Bks)', `${formatQty(totalQty)} Bks`],
                ['Total Promo/Bonus (Pcs)', `${formatQty(totalPromoQty)} Pcs`],
                ['Penjualan Tunai', formatRupiah(tunai)],
                ['Piutang (Tempo)', formatRupiah(kredit)],
            ],
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] },
        });

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['#', 'Nama Sales', 'Omzet', 'Qty', 'Promo']],
            body: salesPerformance.map((s, i) => [i + 1, s.name, formatRupiah(s.omzet), formatQty(s.qty), formatQty(s.promo)]),
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] },
        });

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['#', 'Produk', 'Qty Terjual', 'Nilai Total']],
            body: productPerformance.map((p, i) => [i + 1, p.name, formatQty(p.qty), formatRupiah(p.total)]),
            theme: 'grid',
            headStyles: { fillColor: [13, 148, 136] },
        });

        // Detail Table
        const tableBody = filtered.map((item, index) => {
            const customer = pelanggan.find(c => c.id === item.pelangganId);
            const salesId = item.salesId || item.createdBy;
            const salesPerson = users.find(u => u.id === salesId);
            return [
                index + 1,
                item.nomorNota,
                new Date(item.tanggal).toLocaleDateString('id-ID'),
                customer?.nama || 'Umum',
                salesPerson?.nama || 'Sales',
                item.metodePembayaran.toUpperCase(),
                formatRupiah(item.total)
            ];
        });

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['#', 'No. Nota', 'Tanggal', 'Pelanggan', 'Sales', 'Metode', 'Total']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [31, 41, 55] },
            styles: { fontSize: 8 },
        });

        doc.save(`Rekap_Penjualan_${new Date().getTime()}.pdf`);
    };

    return (
        <MainLayout title="Rekap Penjualan">
            <div className="p-4 max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/penjualan')}
                        className="-ml-2 text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Kembali
                    </Button>

                    <Button
                        size="sm"
                        onClick={handleDownloadPDF}
                        disabled={filtered.length === 0}
                        className="bg-primary hover:bg-primary/90"
                    >
                        <BarChart className="w-4 h-4 mr-2" />
                        Unduh PDF
                    </Button>
                </div>

                {/* Filter Section */}
                <Card className="border-none shadow-sm bg-background/50 backdrop-blur-sm">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                            {/* Branch Filter (Admin Only) */}
                            <div className="flex flex-col gap-1 w-full sm:w-auto">
                                <span className="text-[10px] text-muted-foreground ml-1">Cabang</span>
                                <Select
                                    value={filterCabang}
                                    onValueChange={(val) => { setFilterCabang(val); setFilterUser('all'); }}
                                    disabled={!isAdminOrOwner}
                                >
                                    <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs bg-background">
                                        <SelectValue placeholder="Pilih Cabang" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Cabang</SelectItem>
                                        {cabang.filter(c => c.id !== 'cab-pusat').map(c => <SelectItem key={c.id} value={c.id}>{c.nama}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* User Filter */}
                            <div className="flex flex-col gap-1 w-full sm:w-auto">
                                <span className="text-[10px] text-muted-foreground ml-1">Pengguna</span>
                                <SearchableSelect
                                    value={filterUser}
                                    onChange={setFilterUser}
                                    placeholder="Pilih Pengguna"
                                    searchPlaceholder="Cari pengguna..."
                                    options={[
                                        { label: "Semua Pengguna", value: "all" },
                                        ...relevantUsers.map(u => ({ label: u.nama, value: u.id }))
                                    ]}
                                    className="w-full sm:w-[160px] h-8 text-xs bg-transparent border-input"
                                />
                            </div>
                            <div className="flex flex-col gap-1 w-full sm:w-auto">
                                <div className="flex items-center justify-between gap-2 max-w-sm">
                                    <div className="flex items-center gap-2 text-primary font-medium">
                                        <Calendar className="w-4 h-4" />
                                        <span>Periode Laporan</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="text-[10px] text-primary hover:underline cursor-pointer ml-auto"
                                        onClick={() => setIsSingleDate(!isSingleDate)}
                                    >
                                        {isSingleDate ? 'Pilih Rentang' : 'Pilih 1 Hari'}
                                    </button>
                                </div>

                                {isSingleDate ? (
                                    <div className="w-full max-w-sm">
                                        <Input
                                            type="date"
                                            value={singleDate}
                                            onChange={e => setSingleDate(e.target.value)}
                                            onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                                            className="h-8 text-xs w-full sm:w-[160px] bg-background cursor-pointer"
                                        />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2 max-w-sm">
                                        <Input
                                            type="date"
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                            onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                                            className="h-8 text-xs bg-background cursor-pointer"
                                        />
                                        <Input
                                            type="date"
                                            value={endDate}
                                            onChange={e => setEndDate(e.target.value)}
                                            onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                                            className="h-8 text-xs bg-background cursor-pointer"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center space-x-2 bg-background border rounded-lg p-2 h-8 self-end">
                                <Switch
                                    id="currency-mode"
                                    checked={showDetailed}
                                    onCheckedChange={setShowDetailed}
                                />
                                <Label htmlFor="currency-mode" className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
                                    <Coins className="w-3.5 h-3.5 text-muted-foreground" />
                                    {showDetailed ? 'Detail' : 'Singkat'}
                                </Label>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">

                    {/* Total Omzet */}
                    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <TrendingUp className="w-12 h-12 sm:w-16 sm:h-16" />
                        </div>
                        <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full relative z-10">
                            <div>
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Omzet</p>
                                <p className={`font-bold text-primary mt-1 tracking-tight ${showDetailed ? 'text-lg sm:text-l' : 'text-lg sm:text-2xl'}`}>
                                    {formatCurrency(totalOmzet)}
                                </p>
                            </div>
                            <div className="mt-2 w-6 sm:w-8 h-1 bg-primary/20 rounded-full" />
                        </CardContent>
                    </Card>

                    {/* Total Transaksi */}
                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <Receipt className="w-12 h-12 sm:w-16 sm:h-16 text-blue-600" />
                        </div>
                        <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full relative z-10">
                            <div>
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Transaksi</p>
                                <p className="text-lg sm:text-2xl font-bold text-blue-700 mt-1 tracking-tight">{totalTrx} <span className="text-xs sm:text-sm font-normal text-muted-foreground">Nota</span></p>
                            </div>
                            <div className="mt-2 w-6 sm:w-8 h-1 bg-blue-500/20 rounded-full" />
                        </CardContent>
                    </Card>

                    {/* Total Qty */}
                    <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <Package className="w-12 h-12 sm:w-16 sm:h-16 text-purple-600" />
                        </div>
                        <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full relative z-10">
                            <div>
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Qty (Bks)</p>
                                <p className="text-lg sm:text-2xl font-bold text-purple-700 mt-1 tracking-tight">{formatQty(totalQty)} <span className="text-xs sm:text-sm font-normal text-muted-foreground">Bks</span></p>
                            </div>
                            <div className="mt-2 w-6 sm:w-8 h-1 bg-purple-500/20 rounded-full" />
                        </CardContent>
                    </Card>

                    {/* Total Promo Qty */}
                    <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <Coins className="w-12 h-12 sm:w-16 sm:h-16 text-orange-600" />
                        </div>
                        <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full relative z-10">
                            <div>
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Promo Qty</p>
                                <p className="text-lg sm:text-2xl font-bold text-orange-700 mt-1 tracking-tight">{formatQty(totalPromoQty)} <span className="text-xs sm:text-sm font-normal text-muted-foreground">Pcs</span></p>
                            </div>
                            <div className="mt-2 w-6 sm:w-8 h-1 bg-orange-500/20 rounded-full" />
                        </CardContent>
                    </Card>

                    {/* Tunai */}
                    <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <Wallet className="w-12 h-12 sm:w-16 sm:h-16 text-emerald-600" />
                        </div>
                        <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full relative z-10">
                            <div>
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Tunai</p>
                                <p className={`font-bold text-emerald-700 mt-1 tracking-tight ${showDetailed ? 'text-lg sm:text-l' : 'text-lg sm:text-2xl'}`}>
                                    {formatCurrency(tunai)}
                                </p>
                            </div>
                            <div className="mt-2 w-6 sm:w-8 h-1 bg-emerald-500/20 rounded-full" />
                        </CardContent>
                    </Card>

                    {/* Kredit */}
                    <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <CreditCard className="w-12 h-12 sm:w-16 sm:h-16 text-amber-600" />
                        </div>
                        <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full relative z-10">
                            <div>
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Piutang</p>
                                <p className={`font-bold text-amber-700 mt-1 tracking-tight ${showDetailed ? 'text-lg sm:text-l' : 'text-lg sm:text-2xl'}`}>
                                    {formatCurrency(kredit)}
                                </p>
                            </div>
                            <div className="mt-2 w-6 sm:w-8 h-1 bg-amber-500/20 rounded-full" />
                        </CardContent>
                    </Card>
                </div>

                {/* Breakdown Tabs */}
                <Tabs defaultValue="transactions" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-muted/50">
                        <TabsTrigger value="transactions" className="text-[10px] sm:text-xs py-2">Transaksi</TabsTrigger>
                        <TabsTrigger value="sales" className="text-[10px] sm:text-xs py-2">Sales</TabsTrigger>
                        <TabsTrigger value="categories" className="text-[10px] sm:text-xs py-2">Kategori</TabsTrigger>
                        <TabsTrigger value="products" className="text-[10px] sm:text-xs py-2">Produk</TabsTrigger>
                    </TabsList>

                    <TabsContent value="transactions" className="mt-4 space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="font-semibold text-lg tracking-tight">Rincian Penjualan</h3>
                            <Badge variant="outline" className="text-xs font-normal">
                                {filtered.length} Transaksi Ditemukan
                            </Badge>
                        </div>
                        <Card className="border-none shadow-sm overflow-hidden">
                            <div className="divide-y divide-border/50">
                                {filtered.length === 0 ? (
                                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                                        <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center">
                                            <Receipt className="w-8 h-8 text-muted-foreground/40" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium text-muted-foreground">Tidak ada data penjualan</p>
                                            <p className="text-xs text-muted-foreground/60">Coba atur ulang filter tanggal diatas</p>
                                        </div>
                                    </div>
                                ) : (
                                    filtered.map(item => {
                                        const customer = pelanggan.find(c => c.id === item.pelangganId);
                                        const customerName = (customer?.nama || 'Umum').toUpperCase();

                                        const salesId = item.salesId || item.createdBy;
                                        const linkedEmployee = karyawan.find(k => k.userAccountId === salesId);
                                        const salesPerson = users.find(u => u.id === salesId);
                                        const salesName = linkedEmployee?.nama || salesPerson?.nama || 'Sales';

                                        return (
                                            <div key={item.id} onClick={() => navigate(`/penjualan/${item.id}`)} className="group p-3 sm:p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 cursor-pointer">
                                                <div className="flex items-center gap-3 min-w-[140px]">
                                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                                        <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm">{item.nomorNota}</p>
                                                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                                                            {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </p>
                                                    </div>
                                                    <div className="sm:hidden ml-auto text-right">
                                                        <p className="font-bold text-sm text-foreground">{formatRupiah(item.total)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex-1 grid grid-cols-2 gap-2 sm:gap-4 w-full pl-11 sm:pl-0">
                                                    <div className="space-y-0.5 sm:space-y-1">
                                                        <p className="text-[9px] sm:text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Pelanggan</p>
                                                        <p className="text-xs sm:text-sm font-medium truncate">{customerName}</p>
                                                    </div>
                                                    <div className="space-y-0.5 sm:space-y-1">
                                                        <p className="text-[9px] sm:text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Sales</p>
                                                        <div className="flex items-center gap-1">
                                                            <User className="w-3 h-3 text-muted-foreground" />
                                                            <p className="text-xs sm:text-sm truncate">{salesName}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between sm:block sm:text-right min-w-[120px] self-end sm:self-center pl-11 sm:pl-0 w-full sm:w-auto mt-1 sm:mt-0">
                                                    <p className="hidden sm:block font-bold text-base text-foreground">{formatRupiah(item.total)}</p>
                                                    <Badge variant={item.metodePembayaran === 'tunai' ? 'success' : 'warning'} className="text-[10px] uppercase px-2 h-5">
                                                        {item.metodePembayaran}
                                                    </Badge>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </Card>
                    </TabsContent>

                    <TabsContent value="sales" className="mt-4">
                        <Card className="border-none shadow-sm overflow-hidden">
                            <div className="p-0 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 border-b">
                                        <tr>
                                            <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider">Nama Sales</th>
                                            <th className="p-4 text-center font-bold uppercase text-[10px] tracking-wider">Nota</th>
                                            <th className="p-4 text-right font-bold uppercase text-[10px] tracking-wider">Omzet</th>
                                            <th className="p-4 text-right font-bold uppercase text-[10px] tracking-wider text-primary">Qty</th>
                                            <th className="p-4 text-right font-bold uppercase text-[10px] tracking-wider text-orange-600">Promo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {salesPerformance.map((s, idx) => (
                                            <tr key={idx} className="hover:bg-muted/20 transition-colors">
                                                <td className="p-4 font-bold">{s.name}</td>
                                                <td className="p-4 text-center text-muted-foreground">{s.count}</td>
                                                <td className="p-4 text-right font-bold">{formatCurrency(s.omzet)}</td>
                                                <td className="p-4 text-right font-mono text-primary font-bold">{formatQty(s.qty)}</td>
                                                <td className="p-4 text-right font-mono text-orange-600 font-bold">{formatQty(s.promo)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </TabsContent>

                    <TabsContent value="categories" className="mt-4">
                        <Card className="border-none shadow-sm overflow-hidden">
                            <div className="p-0 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 border-b">
                                        <tr>
                                            <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider">Kategori Pelanggan</th>
                                            <th className="p-4 text-center font-bold uppercase text-[10px] tracking-wider">Nota</th>
                                            <th className="p-4 text-right font-bold uppercase text-[10px] tracking-wider">Omzet</th>
                                            <th className="p-4 text-right font-bold uppercase text-[10px] tracking-wider">Qty Terjual</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {categoryPerformance.map((c, idx) => (
                                            <tr key={idx} className="hover:bg-muted/20 transition-colors">
                                                <td className="p-4 font-bold uppercase">{c.name}</td>
                                                <td className="p-4 text-center text-muted-foreground">{c.count}</td>
                                                <td className="p-4 text-right font-bold">{formatCurrency(c.omzet)}</td>
                                                <td className="p-4 text-right font-mono font-bold">{formatQty(c.qty)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </TabsContent>

                    <TabsContent value="products" className="mt-4">
                        <Card className="border-none shadow-sm overflow-hidden">
                            <div className="p-0 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 border-b">
                                        <tr>
                                            <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider">Nama Produk</th>
                                            <th className="p-4 text-right font-bold uppercase text-[10px] tracking-wider">Qty Terjual</th>
                                            <th className="p-4 text-right font-bold uppercase text-[10px] tracking-wider">Total Nilai</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {productPerformance.map((p, idx) => (
                                            <tr key={idx} className="hover:bg-muted/20 transition-colors">
                                                <td className="p-4">
                                                    <div className="font-bold uppercase">{p.name}</div>
                                                    <div className="text-[10px] text-muted-foreground font-mono">{p.code}</div>
                                                </td>
                                                <td className="p-4 text-right font-mono font-bold text-primary">{formatQty(p.qty)}</td>
                                                <td className="p-4 text-right font-bold">{formatCurrency(p.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </MainLayout>
    );
}
