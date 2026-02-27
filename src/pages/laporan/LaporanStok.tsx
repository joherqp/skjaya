import { useState, useMemo, useRef, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatRupiah } from '@/lib/utils';
import { ArrowLeft, Download, Search, FileSpreadsheet, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Barang, User } from '@/lib/types';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { addDays, startOfMonth, endOfMonth, isWithinInterval, isAfter, isBefore, format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface PersetujuanData {
    barangId?: string;
    barang_id?: string;
    satuanId?: string;
    jumlah?: number;
    items?: {
        barangId: string;
        satuanId: string;
        jumlah: number;
    }[];
}

export default function LaporanStok() {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const {
        barang,
        kategori,
        satuan,
        stokPengguna,
        users,
        cabang,
        penjualan,
        mutasiBarang,
        persetujuan, // For Restock
        penyesuaianStok
    } = useDatabase();

    // Filters
    const [filterCabang, setFilterCabang] = useState<string>(() => {
        if (currentUser?.roles.includes('admin') || currentUser?.roles.includes('owner')) {
            return 'all';
        }
        // Access Leak Fix: If user has no branch, do NOT default to 'all'. Default to empty string (no view).
        return currentUser?.cabangId || '';
    });
    const [filterUser, setFilterUser] = useState<string>('all');
    const [search, setSearch] = useState('');

    // Date Filters
    const [isSingleDate, setIsSingleDate] = useState(true);
    const [singleDate, setSingleDate] = useState<Date>(new Date());
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: new Date(),
    });

    const effectiveDateRange = useMemo(() => {
        if (isSingleDate) {
            return { from: singleDate, to: singleDate };
        }
        return dateRange;
    }, [isSingleDate, singleDate, dateRange]);

    const [displayLimit, setDisplayLimit] = useState(20);

    type SortKey = 'nama' | 'stokAwal' | 'masuk' | 'keluar' | 'terjual' | 'promo' | 'stokAkhir';
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'nama', direction: 'asc' });

    const isAdminOrOwner = currentUser?.roles.includes('admin') || currentUser?.roles.includes('owner');

    // Filter Users based on selected Branch and Role, considering Date Range for inactive users
    const relevantUsers = useMemo(() => {
        const { from, to } = effectiveDateRange || {};
        const checkActiveInPeriod = (u: User) => {
            // Always include currently active users
            if (u.isActive !== false) return true;

            // For inactive users, check if their service period overlaps with report range
            // If no dates set, maybe include them to be safe? Or exclude? 
            // Let's include if unsure to avoid hiding data.
            if (!u.startDate && !u.endDate) return true; // Legacy inactive

            const reportStart = from || new Date(0);
            const reportEnd = to || new Date();

            const userStart = u.startDate ? new Date(u.startDate) : new Date(0);
            // If isActive=false and no endDate, it's ambiguous. Assume they ended "sometime"? 
            // But logically if isActive=false, they should have endDate. If not, include them.

            // Overlap: UserStart <= ReportEnd AND UserEnd >= ReportStart
            return userStart <= reportEnd && (u.endDate ? new Date(u.endDate) >= reportStart : true);
        };


        // Filter by existence in stokPengguna
        const userIdsWithStock = new Set(stokPengguna.map(s => s.userId));

        let candidates = users;

        // 1. Admin/Owner: Full access, respect UI filter
        if (currentUser?.roles.includes('admin') || currentUser?.roles.includes('owner')) {
            if (filterCabang !== 'all') {
                candidates = users.filter(u => u.cabangId === filterCabang);
            }
        } else {
            // 2. Others (Leader/Sales/Staff): Restricted to their branch
            candidates = users.filter(u => u.cabangId === currentUser?.cabangId);
        }

        return candidates.filter(u => checkActiveInPeriod(u) && userIdsWithStock.has(u.id));
    }, [users, filterCabang, currentUser, effectiveDateRange, stokPengguna]);

    // Extract calculation logic to a reusable function so we can calculate per-user
    const calculateStockReport = (specFilterUser: string) => {
        if (!effectiveDateRange?.from || !effectiveDateRange?.to) return [];

        const startDate = effectiveDateRange.from;
        const endDate = effectiveDateRange.to;

        // Normalize StartDate to start of day
        const startDateStartOfDay = new Date(startDate);
        startDateStartOfDay.setHours(0, 0, 0, 0);

        // Normalize EndDate to end of day
        const endDateEndOfDay = new Date(endDate);
        endDateEndOfDay.setHours(23, 59, 59, 999);

        return barang.map(item => {
            // 1. Current Stock (Now)
            let currentStock = 0;

            // Filter users to consider for stock
            const isGlobalView = filterCabang === 'all';

            let targetUsers = users;
            if (specFilterUser !== 'all') {
                targetUsers = users.filter(u => u.id === specFilterUser);
            } else if (!isGlobalView && filterCabang) {
                // Branch Scope
                targetUsers = users.filter(u => u.cabangId === filterCabang);
            } else if (!isGlobalView && !filterCabang) {
                // No Branch ID selected/available -> No users
                targetUsers = [];
            } else {
                // Global (filterCabang === 'all')
                targetUsers = users;
            }

            const targetUserIds = targetUsers.map(u => u.id);

            currentStock = stokPengguna
                .filter(s => s.barangId === item.id && targetUserIds.includes(s.userId))
                .reduce((sum, s) => sum + s.jumlah, 0);

            // 2. Backward Calculation to find Final Stock at EndDate and Initial Stock at StartDate
            // We need to look at transactions AFTER the EndDate to reverse them from CurrentStock
            // And transactions BETWEEN Start and End to separate Flow.

            let inRangeIn = 0;
            let inRangeOut = 0;
            let inRangeSold = 0;
            let inRangePromo = 0;

            let afterRangeIn = 0;
            let afterRangeOut = 0;
            let afterRangeSold = 0;
            let afterRangePromo = 0;

            // --- Process Penjualan (Sales) ---
            penjualan.forEach(p => {
                if (p.status !== 'lunas') return; // Changed from selesai to lunas
                // Check if this sale is relevant to our scope
                const isRelevant = specFilterUser !== 'all'
                    ? p.salesId === specFilterUser
                    : filterCabang !== 'all'
                        ? p.cabangId === filterCabang
                        : true;

                if (!isRelevant) return;

                const pDate = new Date(p.tanggal);

                p.items.forEach(pi => {
                    if (pi.barangId === item.id) {
                        // Convert to base unit if necessary (Assuming db stores in base or we handle conversion)
                        // Use stored totalQty if available for historical accuracy, otherwise calc
                        const qty = (pi.totalQty !== undefined) ? pi.totalQty : (pi.jumlah * (pi.konversi || 1));

                        if (pi.isBonus || pi.harga === 0) {
                            if (isAfter(pDate, endDateEndOfDay)) {
                                afterRangePromo += qty;
                            } else if (pDate >= startDateStartOfDay && pDate <= endDateEndOfDay) {
                                inRangePromo += qty;
                            }
                        } else {
                            if (isAfter(pDate, endDateEndOfDay)) {
                                afterRangeSold += qty;
                            } else if (pDate >= startDateStartOfDay && pDate <= endDateEndOfDay) {
                                inRangeSold += qty;
                            }
                        }
                    }
                });
            });

            // --- Process Mutasi (Transfers) ---
            mutasiBarang.forEach(m => {
                if (m.status !== 'disetujui') return;
                const mDate = new Date(m.tanggal);

                // Scope Checks
                let isOriginScope = filterCabang !== 'all' ? m.dariCabangId === filterCabang : true;
                let isDestScope = filterCabang !== 'all' ? m.keCabangId === filterCabang : true;

                // User Scope Checks
                if (specFilterUser !== 'all') {
                    const relatedPersetujuan = persetujuan.find(p => p.id === m.persetujuanId);
                    const mutasiCreatorId = (m as any).createdBy || relatedPersetujuan?.diajukanOleh;
                    const mutasiTargetId = relatedPersetujuan?.targetUserId;

                    // Origin matches if the specFilterUser created the mutasi
                    isOriginScope = isOriginScope && (mutasiCreatorId === specFilterUser);

                    // Desc matches if the specFilterUser is the target
                    isDestScope = isDestScope && (mutasiTargetId === specFilterUser);

                    // If user is neither origin nor dest, skip
                    if (!isOriginScope && !isDestScope) return;
                }

                // If the mutasi is internal to the current scope (e.g. within the same branch),
                // skip inflating Masuk and Keluar as they cancel out and confuse the report.
                if (isOriginScope && isDestScope) return;

                const items = Array.isArray(m.items) ? m.items : [];
                items.forEach((mi: any) => {
                    const bId = mi.barangId || mi.barang_id;
                    if (bId === item.id) {
                        const qty = mi.totalQty !== undefined ? mi.totalQty : (mi.total_qty !== undefined ? mi.total_qty : mi.jumlah);
                        if (isAfter(mDate, endDateEndOfDay)) {
                            if (isOriginScope) afterRangeOut += qty; // We lost it after range
                            if (isDestScope) afterRangeIn += qty;   // We got it after range
                        } else if (mDate >= startDateStartOfDay && mDate <= endDateEndOfDay) {
                            if (isOriginScope) inRangeOut += qty;
                            if (isDestScope) inRangeIn += qty;
                        }
                    }
                });
            });

            // --- Process Persetujuan (Restock) ---
            // Assuming Restock adds to User/Branch stock
            persetujuan.forEach(p => {
                if (p.jenis !== 'restock' || p.status !== 'disetujui' || !p.data) return;

                // Use type 'any' or an extended interface here to cleanly access both structures
                const pData = p.data as any;
                const itemsToProcess = pData.items || [];

                // Handle single item restock where data is not in an array
                if (!pData.items && (pData.barangId || pData.barang_id)) {
                    itemsToProcess.push({
                        barangId: pData.barangId || pData.barang_id,
                        jumlah: pData.jumlah || 0,
                    });
                }

                if (itemsToProcess.length === 0) return;

                const pDate = new Date(p.tanggalPersetujuan || p.tanggalPengajuan);

                const isRelevant = specFilterUser !== 'all'
                    ? p.targetUserId === specFilterUser
                    : filterCabang !== 'all'
                        ? p.targetCabangId === filterCabang || (p.targetUserId && users.find(u => u.id === p.targetUserId)?.cabangId === filterCabang)
                        : true;

                if (!isRelevant) return;

                itemsToProcess.forEach((pi: any) => {
                    if (pi.barangId === item.id) {
                        const qty = pi.jumlah;
                        if (isAfter(pDate, endDateEndOfDay)) {
                            afterRangeIn += qty;
                        } else if (pDate >= startDateStartOfDay && pDate <= endDateEndOfDay) {
                            inRangeIn += qty;
                        }
                    }
                });
            });

            // --- Process Penyesuaian Stok (Adjustments) ---
            penyesuaianStok.forEach(adj => {
                if (adj.status !== 'disetujui' || adj.barangId !== item.id) return;

                const isRelevant = filterCabang !== 'all' ? adj.cabangId === filterCabang : true;
                if (!isRelevant) return; // Skip if filtered out
                if (specFilterUser !== 'all') return; // Skip for user specific

                const aDate = new Date(adj.tanggal);
                const diff = adj.selisih; // + means found (In), - means lost (Out)

                if (isAfter(aDate, endDateEndOfDay)) {
                    if (diff > 0) afterRangeIn += diff;
                    else afterRangeOut += Math.abs(diff);
                } else if (aDate >= startDateStartOfDay && aDate <= endDateEndOfDay) {
                    if (diff > 0) inRangeIn += diff;
                    else inRangeOut += Math.abs(diff);
                }
            });


            // CALCULATION
            // CurrentStock (Now) = FinalStock (At EndDate) + AfterIn - AfterOut - AfterSold - AfterPromo
            // => FinalStock = CurrentStock - AfterIn + AfterOut + AfterSold + AfterPromo
            const stokAkhir = currentStock - afterRangeIn + afterRangeOut + afterRangeSold + afterRangePromo;

            // FinalStock = InitialStock + RangeIn - RangeOut - RangeSold - RangePromo
            // => InitialStock = FinalStock - RangeIn + RangeOut + RangeSold + RangePromo
            const stokAwal = stokAkhir - inRangeIn + inRangeOut + inRangeSold + inRangePromo;

            return {
                ...item,
                stokAwal,
                masuk: inRangeIn,
                keluar: inRangeOut,
                terjual: inRangeSold,
                promo: inRangePromo,
                stokAkhir
            };
        });
    };

    const stockReport = useMemo(() => {
        return calculateStockReport(filterUser);
    }, [barang, stokPengguna, penjualan, mutasiBarang, persetujuan, penyesuaianStok, effectiveDateRange, filterCabang, filterUser, users]);

    const filteredStockReport = useMemo(() => {
        let result = stockReport;

        if (search) {
            const key = search.toLowerCase();
            result = result.filter(item => item.nama.toLowerCase().includes(key) || item.kode.toLowerCase().includes(key));
        }

        result = [...result].sort((a, b) => {
            const { key, direction } = sortConfig;
            let aVal: any = a[key as keyof typeof a];
            let bVal: any = b[key as keyof typeof b];

            if (key === 'nama') {
                return direction === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
            } else {
                return direction === 'asc' ? (Number(aVal) - Number(bVal)) : (Number(bVal) - Number(aVal));
            }
        });

        return result;
    }, [stockReport, search, sortConfig]);

    const handleSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };



    // Helper: Format Number with Separator
    const fmt = (num: number) => num.toLocaleString('id-ID');

    // Helper: Multi-Unit Formatter
    const formatMultiSatuan = (qty: number, item: Barang) => {
        const baseSymbol = satuan.find(s => s.id === item.satuanId)?.simbol || 'Unit';

        // If no multi-unit or qty is small, return base
        if (!item.multiSatuan || item.multiSatuan.length === 0 || qty === 0) {
            return `${fmt(qty)}${baseSymbol}`;
        }

        // Sort conversions descending (largest unit first)
        const sortedUnits = [...item.multiSatuan]
            .sort((a, b) => b.konversi - a.konversi);

        let remaining = qty;
        const parts: string[] = [];

        sortedUnits.forEach(u => {
            if (remaining >= u.konversi) {
                const count = Math.floor(remaining / u.konversi);
                remaining = remaining % u.konversi;
                const unitSymbol = satuan.find(s => s.id === u.satuanId)?.simbol || '?';
                parts.push(`${fmt(count)}${unitSymbol}`);
            }
        });

        if (remaining > 0 || parts.length === 0) {
            parts.push(`${fmt(remaining)}${baseSymbol}`);
        }

        return parts.join(' ');
    };

    // Export CSV
    const handleExportCSV = () => {
        if (!filteredStockReport.length) return;

        const csvHeader = ["Kode", "Nama", "Satuan", "Stok Awal", "Masuk", "Keluar", "Terjual", "Promo", "Stok Akhir"];
        const csvRows = filteredStockReport.map(item => {
            const satuanSymbol = satuan.find(s => s.id === item.satuanId)?.simbol || 'Unit';

            // Helper to get simple text representation for CSV
            const fmtCsv = (qty: number) => {
                if (qty === 0) return "0";
                if (item.multiSatuan?.length) {
                    return formatMultiSatuan(qty, item);
                }
                return `${qty}`;
            };

            return [
                `"${item.kode}"`,
                `"${item.nama}"`,
                `"${satuanSymbol}"`,
                fmtCsv(item.stokAwal),
                fmtCsv(item.masuk),
                fmtCsv(item.keluar),
                fmtCsv(item.terjual),
                fmtCsv(item.promo),
                fmtCsv(item.stokAkhir)
            ].join(",");
        });

        const csvContent = [csvHeader.join(","), ...csvRows].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.setAttribute("href", url);
        link.setAttribute("download", `Laporan_Stok_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Export Excel
    const handleExportExcel = () => {
        if (!filteredStockReport.length) return;

        try {
            const data = filteredStockReport.map(item => {
                const satuanSymbol = satuan.find(s => s.id === item.satuanId)?.simbol || 'Unit';

                // Helper to get simple text representation
                const fmtTxt = (qty: number) => {
                    if (qty === 0) return "0";
                    if (item.multiSatuan?.length) {
                        return formatMultiSatuan(qty, item);
                    }
                    return `${qty}`;
                };

                return {
                    "Kode": item.kode,
                    "Nama Barang": item.nama,
                    "Satuan Dasar": satuanSymbol,
                    "Stok Awal": fmtTxt(item.stokAwal),
                    "Masuk": fmtTxt(item.masuk),
                    "Keluar": fmtTxt(item.keluar),
                    "Terjual": fmtTxt(item.terjual),
                    "Stok Akhir": fmtTxt(item.stokAkhir),
                    // Raw values for calculation if needed in Excel
                    "_raw_awal": item.stokAwal,
                    "_raw_akhir": item.stokAkhir
                };
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);

            // Auto-width
            const calcWidth = (header: string, key: string) => {
                const maxContent = Math.max(...data.map(d => (d[key as keyof typeof d] || '').toString().length));
                return Math.max(header.length, maxContent) + 2;
            };

            ws['!cols'] = [
                { wch: calcWidth("Kode", "Kode") },
                { wch: 30 }, // Nama Barang
                { wch: 10 }, // Satuan
                { wch: 15 }, // Awal
                { wch: 10 }, // Masuk
                { wch: 10 }, // Keluar
                { wch: 10 }, // Terjual
                { wch: 15 }, // Akhir
                { hidden: true }, // Raw column hidden
                { hidden: true }
            ];

            XLSX.utils.book_append_sheet(wb, ws, "Laporan Stok");
            XLSX.writeFile(wb, `Laporan_Stok_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
            toast.success('Excel stok berhasil diunduh');
        } catch (err) {
            console.error("Export Error:", err);
            toast.error("Gagal export Excel");
        }
    };

    // Export PDF
    const handleExportPDF = () => {
        if (!filteredStockReport.length) return;

        const doc = new jsPDF('landscape');

        doc.setFontSize(16);
        doc.text('Laporan Arus Stok', 14, 15);
        doc.setFontSize(10);
        doc.text(`Periode: ${isSingleDate ? format(singleDate, 'dd/MM/yyyy') : `${format(dateRange?.from || new Date(), 'dd/MM/yyyy')} - ${format(dateRange?.to || new Date(), 'dd/MM/yyyy')}`}`, 14, 22);

        const namaCabang = filterCabang === 'all' ? 'Semua Cabang' : (cabang.find(c => c.id === filterCabang)?.nama || '-');
        doc.text(`Cabang: ${namaCabang}`, 14, 27);

        const tableColumn = ["Nama", "Satuan", "Stok Awal", "Masuk", "Keluar", "Terjual", "Promo", "Stok Akhir"];
        const tableRows: any[] = [];

        // Generate main table rows
        filteredStockReport.forEach(item => {
            const satuanSymbol = satuan.find(s => s.id === item.satuanId)?.simbol || 'Unit';
            const rowData = [
                item.nama,
                satuanSymbol,
                item.stokAwal.toLocaleString('id-ID'),
                item.masuk.toLocaleString('id-ID'),
                item.keluar.toLocaleString('id-ID'),
                item.terjual.toLocaleString('id-ID'),
                item.promo.toLocaleString('id-ID'),
                item.stokAkhir.toLocaleString('id-ID')
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 32,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] }
        });

        // 2. Breakdown table per User (If 'Semua Pengguna' is chosen)
        if (filterUser === 'all' && relevantUsers.length > 0) {
            const reportsPerUser = relevantUsers.map(u => ({
                user: u,
                report: calculateStockReport(u.id)
            }));

            const breakdownColumn = [
                "Nama Barang",
                "Satuan",
                ...relevantUsers.map(u => {
                    const userCabang = cabang.find(c => c.id === u.cabangId);
                    return `${u.nama}\n(${userCabang ? userCabang.nama : 'Pusat'})`;
                }),
                "Total"
            ];

            const breakdownRows: any[] = [];

            filteredStockReport.forEach(item => {
                const satuanSymbol = satuan.find(s => s.id === item.satuanId)?.simbol || 'Unit';
                const row = [item.nama, satuanSymbol];
                let rowTotal = 0;

                reportsPerUser.forEach(({ report }) => {
                    const userItem = report.find(r => r.id === item.id);
                    const finalStock = userItem ? userItem.stokAkhir : 0;
                    row.push(finalStock.toLocaleString('id-ID'));
                    rowTotal += finalStock;
                });

                row.push(rowTotal.toLocaleString('id-ID'));
                breakdownRows.push(row);
            });

            const finalY = (doc as any).lastAutoTable.finalY || 30;

            doc.setFontSize(14);
            doc.text('Rincian Stok Akhir per Pengguna', 14, finalY + 15);

            autoTable(doc, {
                head: [breakdownColumn],
                body: breakdownRows,
                startY: finalY + 20,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [46, 204, 113] }
            });
        }

        doc.save(`Laporan_Stok_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    if (!currentUser) return null;

    return (
        <MainLayout title="Laporan Arus Stok">
            <div className="p-4 space-y-4">
                {/* Header & Filters */}
                <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center bg-white p-4 rounded-lg border shadow-sm">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={() => navigate('/laporan')} className="pl-0">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
                        </Button>
                        <div className="flex flex-col">
                            <h2 className="font-semibold text-lg hidden md:block">Laporan Arus Stok</h2>
                            <p className="text-xs text-muted-foreground hidden md:block">Pantau pergerakan stok multi-gudang & multi-satuan</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        {/* Branch Filter (Admin Only) */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-muted-foreground ml-1">Cabang</span>
                            <Select
                                value={filterCabang}
                                onValueChange={(val) => { setFilterCabang(val); setFilterUser('all'); }}
                                disabled={!isAdminOrOwner}
                            >
                                <SelectTrigger className="w-[160px] h-8 text-xs">
                                    <SelectValue placeholder="Pilih Cabang" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Cabang</SelectItem>
                                    {cabang.map(c => <SelectItem key={c.id} value={c.id}>{c.nama}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* User Filter */}
                        <div className="flex flex-col gap-1">
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
                                className="w-[160px] h-8 text-xs bg-transparent border-input"
                            />
                        </div>

                        {/* Date Range */}
                        <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-center ml-1">
                                <span className="text-[10px] text-muted-foreground ml-1">Periode</span>
                                <button
                                    className="text-[10px] text-primary hover:underline cursor-pointer"
                                    onClick={() => setIsSingleDate(!isSingleDate)}
                                >
                                    {isSingleDate ? 'Pilih Rentang' : 'Pilih 1 Hari'}
                                </button>
                            </div>

                            {isSingleDate ? (
                                <Input
                                    type="date"
                                    value={format(singleDate, 'yyyy-MM-dd')}
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setSingleDate(new Date(e.target.value));
                                        }
                                    }}
                                    className="h-8 text-xs w-[160px]"
                                />
                            ) : (
                                <DatePickerWithRange date={dateRange} setDate={setDateRange} className="w-[240px]" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Search & Export */}
                <div className="flex justify-between items-center bg-muted/20 p-2 rounded-md">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Cari barang (Kode / Nama)..."
                            className="pl-8 h-9 bg-white"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" size="sm" className="bg-white" onClick={handleExportExcel}>
                            <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Excel
                        </Button>
                        <Button variant="outline" size="sm" className="bg-white" onClick={handleExportCSV}>
                            <FileText className="w-4 h-4 mr-2" /> CSV
                        </Button>
                        <Button variant="outline" size="sm" className="bg-white" onClick={handleExportPDF}>
                            <Download className="w-4 h-4 mr-2 text-red-600" /> PDF
                        </Button>
                    </div>
                </div>

                {/* Table */}
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[250px] cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('nama')}>
                                        <div className="flex items-center gap-1">
                                            Barang
                                            {sortConfig.key === 'nama' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('stokAwal')}>
                                        <div className="flex items-center justify-end gap-1">
                                            Stok Awal
                                            {sortConfig.key === 'stokAwal' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right text-green-600 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('masuk')}>
                                        <div className="flex items-center justify-end gap-1">
                                            Masuk
                                            {sortConfig.key === 'masuk' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right text-red-600 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('keluar')}>
                                        <div className="flex items-center justify-end gap-1">
                                            Keluar
                                            {sortConfig.key === 'keluar' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right text-blue-600 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('terjual')}>
                                        <div className="flex items-center justify-end gap-1">
                                            Terjual
                                            {sortConfig.key === 'terjual' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right text-fuchsia-600 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('promo')}>
                                        <div className="flex items-center justify-end gap-1">
                                            Promo
                                            {sortConfig.key === 'promo' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right font-bold bg-muted/30 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('stokAkhir')}>
                                        <div className="flex items-center justify-end gap-1">
                                            Stok Akhir
                                            {sortConfig.key === 'stokAkhir' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                        </div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStockReport.slice(0, displayLimit).map((item) => {
                                    // Hide if no movement and no stock
                                    if (item.stokAwal === 0 && item.masuk === 0 && item.keluar === 0 && item.terjual === 0 && item.promo === 0 && item.stokAkhir === 0) return null;

                                    const satuanSymbol = satuan.find(s => s.id === item.satuanId)?.simbol || 'Unit';

                                    return (
                                        <TableRow key={item.id} className="hover:bg-muted/10">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-sm">{item.nama}</span>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <span className="bg-muted px-1 rounded">{item.kode}</span>
                                                        <span>•</span>
                                                        <span>{satuanSymbol}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs">
                                                <div className="flex flex-col items-end">
                                                    <span>{formatMultiSatuan(item.stokAwal, item)}</span>
                                                    {item.multiSatuan?.length ? <span className="text-[10px] text-muted-foreground">({fmt(item.stokAwal)})</span> : null}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-green-600 font-mono text-xs">
                                                <div className="flex flex-col items-end">
                                                    <span>{item.masuk > 0 ? `+${formatMultiSatuan(item.masuk, item)}` : '-'}</span>
                                                    {item.masuk > 0 && item.multiSatuan?.length ? <span className="text-[10px] opacity-70">({fmt(item.masuk)})</span> : null}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-red-600 font-mono text-xs">
                                                <div className="flex flex-col items-end">
                                                    <span>{item.keluar > 0 ? `-${formatMultiSatuan(item.keluar, item)}` : '-'}</span>
                                                    {item.keluar > 0 && item.multiSatuan?.length ? <span className="text-[10px] opacity-70">({fmt(item.keluar)})</span> : null}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-blue-600 font-medium font-mono text-xs">
                                                <div className="flex flex-col items-end">
                                                    <span>{item.terjual > 0 ? `-${formatMultiSatuan(item.terjual, item)}` : '-'}</span>
                                                    {item.terjual > 0 && item.multiSatuan?.length ? <span className="text-[10px] opacity-70">({fmt(item.terjual)})</span> : null}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-fuchsia-600 font-medium font-mono text-xs">
                                                <div className="flex flex-col items-end">
                                                    <span>{item.promo > 0 ? `-${formatMultiSatuan(item.promo, item)}` : '-'}</span>
                                                    {item.promo > 0 && item.multiSatuan?.length ? <span className="text-[10px] opacity-70">({fmt(item.promo)})</span> : null}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-bold bg-muted/30 font-mono text-xs">
                                                <div className="flex flex-col items-end">
                                                    <span>{formatMultiSatuan(item.stokAkhir, item)}</span>
                                                    {item.multiSatuan?.length ? <span className="text-[10px] text-muted-foreground font-normal">({fmt(item.stokAkhir)})</span> : null}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {filteredStockReport.length > displayLimit && (
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
                                {filteredStockReport.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                            Tidak ada data stok untuk periode ini.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
