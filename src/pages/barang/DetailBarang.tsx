import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatNumber as formatNum } from '@/lib/utils';
import { ArrowLeft, Package, Boxes, Activity, RefreshCw, ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import { MutasiItem, Persetujuan } from '@/lib/types';
import { useBarangManagement } from './hooks/useBarangManagement';
import { BarangFilterPopover } from './components/BarangFilterPopover';
import { StokDetailSection } from './components/StokDetailSection';

// Helper for number formatting
const formatNumber = (num: number) => {
    return num.toLocaleString('id-ID', { maximumFractionDigits: 2 });
};

interface PersetujuanData {
    barangId?: string;
    satuanId?: string;
    jumlah?: number;
    items?: {
        barangId: string;
        satuanId: string;
        jumlah: number;
    }[];
}

export default function DetailBarang() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { barang, penjualan, kategori: kategoriList, satuan: satuanList, pelanggan, persetujuan, mutasiBarang, users, stokPengguna, penyesuaianStok, cabang } = useDatabase();

    const product = barang.find(b => b.id === id);
    const [currentSatuanId, setCurrentSatuanId] = useState('');
    const [historyLimit, setHistoryLimit] = useState(10);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const {
        filterKategori, setFilterKategori,
        filterStok, setFilterStok,
        filterCabang, setFilterCabang,
        showInactive, setShowInactive,
        activeFiltersCount,
        cabangList
    } = useBarangManagement();

    useEffect(() => {
        if (product && !currentSatuanId) {
            setCurrentSatuanId(product.satuanId);
        }
    }, [product, currentSatuanId]);

    const isAdminOrOwner = user?.roles.includes('admin') || user?.roles.includes('owner');

    if (!product) {
        return (
            <MainLayout title="Detail Barang">
                <div className="p-4 text-center">
                    <p className="text-muted-foreground">Data barang tidak ditemukan</p>
                    <Button variant="link" onClick={() => navigate('/barang')}>Kembali</Button>
                </div>
            </MainLayout>
        );
    }

    const kategori = kategoriList.find(k => k.id === product.kategoriId);
    const mainSatuanDef = satuanList.find(s => s.id === product.satuanId);

    // Unit Logic
    const availableUnits = [
        {
            id: product.satuanId,
            nama: mainSatuanDef?.simbol || mainSatuanDef?.nama || 'Unit',
            konversi: 1,
            // hargaJual removed
        },
        ...(product.multiSatuan || []).map(m => {
            const s = satuanList.find(x => x.id === m.satuanId);
            return {
                id: m.satuanId,
                nama: s?.simbol || s?.nama || 'Unit',
                konversi: m.konversi,
                // hargaJual removed
            };
        })
    ];

    const toggleUnit = () => {
        const currentIndex = availableUnits.findIndex(u => u.id === currentSatuanId);
        const nextIndex = (currentIndex + 1) % availableUnits.length;
        setCurrentSatuanId(availableUnits[nextIndex].id);
    };

    const currentUnit = availableUnits.find(u => u.id === currentSatuanId) || availableUnits[0];

    // Calculate Stock based on Role & Filter
    // stokPengguna is available from the top-level useDatabase call
    let totalStock = 0;
    if (isAdminOrOwner) {
        let filteredStok = stokPengguna.filter(s => s.barangId === id);
        if (filterCabang.length > 0) {
            filteredStok = filteredStok.filter(s => {
                const userObj = users.find(u => u.id === s.userId);
                return userObj && filterCabang.includes(userObj.cabangId);
            });
        }
        totalStock = filteredStok.reduce((acc, curr) => acc + curr.jumlah, 0);
    } else {
        totalStock = stokPengguna.find(s => s.userId === user?.id && s.barangId === id)?.jumlah || 0;
    }

    const displayStock = totalStock / currentUnit.konversi;
    const productUnitName = mainSatuanDef?.simbol || 'Unit';

    // -- HISTORY FILTER HELPER --
    const isHistoryValidForBranch = (targetUserId: string | undefined, cabangIdField?: string | undefined) => {
        if (!isAdminOrOwner || filterCabang.length === 0) return true;
        if (cabangIdField && filterCabang.includes(cabangIdField)) return true;
        if (targetUserId) {
            const userObj = users.find(u => u.id === targetUserId);
            return userObj && filterCabang.includes(userObj.cabangId);
        }
        return false;
    };

    // -- HISTORY LOGIC (Sales, Restock, Mutasi) --
    const history = [
        // 1. Sales (OUT)
        ...penjualan.filter(p => {
            const hasItem = p.items.some(i => i.barangId === id);
            const validStatus = p.status !== 'batal';
            const userMatch = isAdminOrOwner ? true : p.salesId === user?.id; // Admin sees all, User sees own
            const branchMatch = isHistoryValidForBranch(p.salesId);
            return hasItem && validStatus && userMatch && branchMatch;
        }).map(p => {
            const item = p.items.find(i => i.barangId === id);
            let unitName = productUnitName;
            // Check for saved unit ID in item
            if (item?.satuanId) {
                const s = satuanList.find(x => x.id === item.satuanId);
                if (s) unitName = s.simbol || s.nama;
            }

            const salesperson = users.find(u => u.id === p.salesId)?.nama || 'Unknown Sales';
            const customer = pelanggan?.find(c => c.id === p.pelangganId)?.nama || 'Pelanggan Umum';

            return {
                id: p.id,
                date: new Date(p.tanggal),
                type: 'out' as const,
                source: isAdminOrOwner ? `Penjualan (Oleh: ${salesperson})` : 'Penjualan',
                detail: customer,
                qty: item?.jumlah || 0,
                unit: unitName
            };
        }),

        // 2. Restock (IN)
        ...persetujuan.filter(p => {
            const pData = p.data as PersetujuanData;
            const isRestock = p.jenis === 'restock' && p.status === 'disetujui' && pData?.barangId === id;
            const userMatch = isAdminOrOwner ? true : p.targetUserId === user?.id;
            const branchMatch = isHistoryValidForBranch(p.targetUserId);
            return isRestock && userMatch && branchMatch;
        }).map(p => {
            const pData = p.data as PersetujuanData;
            let unitName = productUnitName;
            if (pData?.satuanId) {
                const s = satuanList.find(x => x.id === pData.satuanId);
                if (s) unitName = s.simbol || s.nama;
            }
            const requesterName = users.find(u => u.id === p.diajukanOleh)?.nama || 'Unknown';
            const targetName = users.find(u => u.id === p.targetUserId)?.nama || 'Gudang';

            return {
                id: p.id,
                date: new Date(p.tanggalPersetujuan || p.tanggalPengajuan),
                type: 'in' as const,
                source: 'Restock',
                detail: isAdminOrOwner ? `Oleh: ${requesterName} -> ${targetName}` : 'Restock Stok',
                qty: Number(pData?.jumlah || 0),
                unit: unitName
            };
        }),

        // 3. Mutasi (Unified Logic)
        ...persetujuan.filter(p => {
            const isMutasi = (p.jenis === 'mutasi' || p.jenis === 'mutasi_stok') && p.status === 'disetujui';
            if (!isMutasi) return false;
            if (isAdminOrOwner) return true;
            return p.diajukanOleh === user?.id || p.targetUserId === user?.id;
        }).flatMap(p => {
            const mData = mutasiBarang.find(m => m.id === p.referensiId);
            const items = (mData?.items || []) as MutasiItem[];
            const item = items.find(i => i.barangId === id);
            if (!item) return [];

            let unitName = productUnitName;
            if (item.satuanId) {
                const s = satuanList.find(x => x.id === item.satuanId);
                if (s) unitName = s.simbol || s.nama;
            }

            const senderName = users.find(u => u.id === p.diajukanOleh)?.nama || 'Unknown';
            const receiverName = users.find(u => u.id === p.targetUserId)?.nama || 'Unknown';

            // ADMIN: Single Transfer Entry
            if (isAdminOrOwner) {
                return [{
                    id: p.id + '_transfer',
                    date: new Date(p.tanggalPersetujuan || p.tanggalPengajuan),
                    type: 'transfer' as const,
                    source: 'Mutasi Antar Pengguna',
                    detail: `${senderName} -> ${receiverName}`,
                    qty: item.jumlah,
                    unit: unitName
                }];
            }

            // USER: Split View
            const results = [];
            if (p.targetUserId === user?.id) {
                results.push({
                    id: p.id + '_in',
                    date: new Date(p.tanggalPersetujuan || p.tanggalPengajuan),
                    type: 'in' as const,
                    source: 'Mutasi Masuk',
                    detail: `Dari: ${senderName}`,
                    qty: item.jumlah,
                    unit: unitName
                });
            }
            if (p.diajukanOleh === user?.id) {
                results.push({
                    id: p.id + '_out',
                    date: new Date(p.tanggalPersetujuan || p.tanggalPengajuan),
                    type: 'out' as const,
                    source: 'Mutasi Keluar',
                    detail: `Ke: ${receiverName}`,
                    qty: item.jumlah,
                    unit: unitName
                });
            }
            return results;
        }),

        // 5. Permintaan (IN - for Requester)
        ...persetujuan.filter(p => {
            const isPermintaan = p.jenis === 'permintaan' && p.status === 'disetujui';
            const isRequester = p.diajukanOleh === user?.id;
            if (!isPermintaan) return false;
            if (!isAdminOrOwner && !isRequester) return false;

            const branchMatch = isHistoryValidForBranch(p.diajukanOleh);
            return branchMatch;
        }).flatMap(p => {
            const pData = p.data as PersetujuanData;
            const items = pData?.items || [];
            const myItem = items.find(i => i.barangId === id);
            if (!myItem) return [];

            let unitName = productUnitName;
            if (myItem.satuanId) {
                const s = satuanList.find(x => x.id === myItem.satuanId);
                if (s) unitName = s.simbol || s.nama;
            }

            return [{
                id: p.id + '_req_in',
                date: new Date(p.tanggalPersetujuan || p.tanggalPengajuan),
                type: 'in' as const,
                source: 'Permintaan (Masuk)',
                detail: `Dari: ${cabang.find(c => c.id === p.targetCabangId)?.nama || 'Gudang/Supplier'}`,
                qty: myItem.jumlah,
                unit: unitName
            }];
        }),

        // 6. Permintaan (OUT - for Supplier/Approver)
        ...persetujuan.filter(p => {
            const isPermintaan = p.jenis === 'permintaan' && p.status === 'disetujui';
            const isTarget = p.targetUserId === user?.id || (p.targetCabangId && p.targetCabangId === user?.cabangId);
            if (!isPermintaan) return false;
            if (!isAdminOrOwner && !isTarget) return false;

            const branchMatch = isHistoryValidForBranch(p.targetUserId, p.targetCabangId);
            return branchMatch;
        }).flatMap(p => {
            const pData = p.data as PersetujuanData;
            const items = pData?.items || [];
            const myItem = items.find(i => i.barangId === id);
            if (!myItem) return [];

            let unitName = productUnitName;
            if (myItem.satuanId) {
                const s = satuanList.find(x => x.id === myItem.satuanId);
                if (s) unitName = s.simbol || s.nama;
            }

            return [{
                id: p.id + '_req_out',
                date: new Date(p.tanggalPersetujuan || p.tanggalPengajuan),
                type: 'out' as const,
                source: 'Permintaan (Keluar)',
                detail: `Ke: ${users.find(u => u.id === p.diajukanOleh)?.nama || 'Requester'}`,
                qty: myItem.jumlah,
                unit: unitName
            }];
        }),

        // 7. Stok Opname (Adjustment)
        ...penyesuaianStok.filter(ps => {
            const isValid = ps.barangId === id && ps.status === 'disetujui';
            if (!isValid) return false;
            return isHistoryValidForBranch(undefined, ps.cabangId);
        }).map(ps => {
            return {
                id: ps.id,
                date: new Date(ps.updatedAt || ps.createdAt),
                type: ps.selisih >= 0 ? 'in' as const : 'out' as const,
                source: 'Stok Opname',
                detail: `${ps.alasan} (${ps.keterangan || '-'})`,
                qty: Math.abs(ps.selisih),
                unit: productUnitName
            };
        })
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return (
        <MainLayout title="Detail Produk">
            <div className="p-4 space-y-4 max-w-4xl mx-auto">
                {/* Header Actions */}
                <div className="flex justify-between items-center">
                    <Button variant="ghost" onClick={() => navigate('/barang')} className="pl-0">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Kembali
                    </Button>
                    <BarangFilterPopover
                        isFilterOpen={isFilterOpen}
                        setIsFilterOpen={setIsFilterOpen}
                        activeFiltersCount={activeFiltersCount}
                        filterKategori={filterKategori}
                        setFilterKategori={setFilterKategori}
                        filterStok={filterStok}
                        setFilterStok={setFilterStok}
                        filterCabang={filterCabang}
                        setFilterCabang={setFilterCabang}
                        showInactive={showInactive}
                        setShowInactive={setShowInactive}
                        kategoriList={kategoriList}
                        cabangList={cabangList}
                        isAdminOrOwner={isAdminOrOwner}
                    />
                </div>

                {/* Product Info Card */}
                <Card elevated>
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row gap-6 items-start">
                            <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 mx-auto md:mx-0">
                                {product.gambarUrl ? (
                                    <img src={product.gambarUrl} alt={product.nama} className="w-full h-full object-cover rounded-xl" />
                                ) : (
                                    <Package className="w-12 h-12 text-muted-foreground" />
                                )}
                            </div>

                            <div className="flex-1 space-y-4 w-full">
                                <div>
                                    <h2 className="text-2xl font-bold">{product.nama}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="font-mono bg-muted px-2 py-0.5 rounded text-sm">{product.kode}</span>
                                        <Badge variant={totalStock <= product.minStok ? 'warning' : 'outline'}>
                                            {totalStock <= product.minStok ? 'Stok Rendah' : 'Stok Aman'}
                                        </Badge>
                                        <Badge variant={product.isActive ? 'success' : 'secondary'}>
                                            {product.isActive ? 'Aktif' : 'Arsip'}
                                        </Badge>
                                        {availableUnits.length > 1 && (
                                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                                Multi-Satuan
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-lg">
                                                <Boxes className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Stok Saat Ini (Klik untuk Ubah)</p>
                                                <div
                                                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded -ml-1 transition-colors"
                                                    onClick={toggleUnit}
                                                >
                                                    <p className="font-bold text-lg">{formatNumber(displayStock)} <span className="text-sm font-normal text-muted-foreground">{currentUnit.nama}</span></p>
                                                    {availableUnits.length > 1 && <RefreshCw className="w-3 h-3 text-muted-foreground" />}
                                                </div>
                                                <p className="text-xs text-muted-foreground">Min. Stok: {product.minStok} {mainSatuanDef?.nama}</p>
                                            </div>
                                        </div>
                                        {/* Removed Price Display since columns are deleted */}

                                    </div>
                                    <div className="space-y-2 text-sm">
                                        <p className="text-muted-foreground">Kategori: <span className="font-medium text-foreground">{kategori?.nama || '-'}</span></p>
                                        <p className="text-muted-foreground">Satuan Utama: <span className="font-medium text-foreground">{mainSatuanDef?.nama || '-'}</span></p>
                                        {product.multiSatuan && product.multiSatuan.length > 0 && (
                                            <div className="mt-2 p-2 bg-muted/30 rounded border border-muted/50">
                                                <p className="text-xs font-semibold mb-1">Konversi Satuan:</p>
                                                <ul className="space-y-1">
                                                    {product.multiSatuan.map((ms, idx) => {
                                                        const sName = satuanList.find(s => s.id === ms.satuanId)?.nama;
                                                        return (
                                                            <li key={idx} className="text-xs text-muted-foreground">
                                                                1 {sName} = {ms.konversi} {mainSatuanDef?.nama}
                                                            </li>
                                                        )
                                                    })}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Branch / User Stock Breakdown */}
                <StokDetailSection
                    barangId={product.id}
                    item={product}
                    currentUnit={currentUnit}
                    isAdminOrOwner={isAdminOrOwner}
                    filterCabang={filterCabang}
                />

                {/* History Card (In/Out) */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Activity className="w-4 h-4" /> Riwayat Barang
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {history.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground py-4">Belum ada riwayat stok (Penjualan, Restock, Mutasi).</p>
                        ) : (
                            <div className="space-y-3">
                                {history.slice(0, historyLimit).map((h, idx) => (
                                    <div key={`${h.id}-${idx}`} className="flex justify-between items-center text-sm border-b last:border-0 pb-3 last:pb-0">
                                        <div className="flex items-start gap-3 min-w-0 flex-1 pr-2">
                                            <div className={`p-2 rounded-lg ${h.source.includes('Mutasi') ? 'bg-blue-100' :
                                                h.type === 'in' ? 'bg-success/10' :
                                                    'bg-destructive/10'
                                                } flex-shrink-0`}>
                                                {h.source.includes('Mutasi') ? <ArrowLeftRight className="w-4 h-4 text-blue-600" /> :
                                                    h.type === 'in' ? <ArrowUpRight className="w-4 h-4 text-success" /> :
                                                        <ArrowDownLeft className="w-4 h-4 text-destructive" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium truncate">{h.source}</p>
                                                <p className="text-xs text-muted-foreground truncate">{h.detail}</p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">{h.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold ${h.type === 'in' ? 'text-success' :
                                                h.type === 'transfer' ? 'text-blue-600' :
                                                    'text-destructive'
                                                }`}>
                                                {h.type === 'in' ? '+' : h.type === 'transfer' ? '' : '-'}{h.qty} {h.unit}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {history.length > historyLimit && (
                                    <Button
                                        variant="ghost"
                                        className="w-full mt-4 border-dashed text-muted-foreground"
                                        onClick={() => setHistoryLimit(prev => prev + 10)}
                                    >
                                        Lihat Lainnya
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>



            </div>
        </MainLayout>
    );
}
