import { useState, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatRupiah, formatNumber } from '@/lib/utils';
import {
    ArrowLeft,
    Printer,
    Calendar,
    BarChart3,
    Package,
    DollarSign,
    TrendingDown,
    TrendingUp,
    History,
    Download,
    AlertCircle,
    Users,
    ChevronDown,
    Search,
    RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay, isAfter } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QRCodeCanvas } from 'qrcode.react';
import { useRef } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Progress } from '@/components/ui/progress';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

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
}

const fmt = (num: number) => {
    if (num === 0) return '0';
    if (num % 1 === 0) return num.toString();
    return num.toFixed(2);
};

export default function LaporanHarian() {
    const navigate = useNavigate();
    const qrRef = useRef<HTMLDivElement>(null);
    const { user: currentUser } = useAuth();
    const {
        penjualan, barang, profilPerusahaan, users,
        cabang, stokPengguna, persetujuan, setoran, saldoPengguna, satuan,
        mutasiBarang, penyesuaianStok, pelanggan, kategoriPelanggan
    } = useDatabase();

    const [pembayaran, setPembayaran] = useState<any[]>([]);
    const [isRefreshingPayments, setIsRefreshingPayments] = useState(false);
    const [activeTargets, setActiveTargets] = useState<SalesTargetDB[]>([]);
    const [isRefreshingTargets, setIsRefreshingTargets] = useState(false);

    const [selectedDate, setSelectedDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
    const [filterCabang, setFilterCabang] = useState<string>(() => currentUser?.cabangId || 'all');
    const [isGenerating, setIsGenerating] = useState(false);

    const isAdminOrOwner = currentUser?.roles.some(r => ['admin', 'owner'].includes(r));

    useEffect(() => {
        const fetchPayments = async () => {
            const dayStart = startOfDay(new Date(selectedDate)).toISOString();
            const dayEnd = endOfDay(new Date(selectedDate)).toISOString();

            setIsRefreshingPayments(true);
            try {
                const { data, error } = await supabase
                    .from('pembayaran_penjualan')
                    .select('*')
                    .gte('tanggal', dayStart)
                    .lte('tanggal', dayEnd);

                if (error) throw error;
                setPembayaran(data || []);
            } catch (err) {
                console.error("Fetch payments error:", err);
            } finally {
                setIsRefreshingPayments(false);
            }
        };
        fetchPayments();
    }, [selectedDate]);

    useEffect(() => {
        const fetchTargets = async () => {
            setIsRefreshingTargets(true);
            try {
                const { data, error } = await supabase
                    .from('sales_targets')
                    .select('*')
                    .eq('is_active', true);

                if (error) throw error;
                setActiveTargets(data || []);
            } catch (err) {
                console.error("Fetch targets error:", err);
            } finally {
                setIsRefreshingTargets(false);
            }
        };
        fetchTargets();
    }, []);

    const reportData = useMemo(() => {
        const date = new Date(selectedDate);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);

        // Filter sales for the day and branch
        const filteredSales = penjualan.filter(p => {
            const pDate = new Date(p.tanggal);
            const inDate = pDate >= dayStart && pDate <= dayEnd;
            const inBranch = filterCabang === 'all' || p.cabangId === filterCabang;
            return inDate && inBranch && p.status !== 'batal' && p.status !== 'draft';
        });

        // 1. Sales Summary
        const tunaiSales = filteredSales.filter(p => p.metodePembayaran === 'tunai');
        const tempoSales = filteredSales.filter(p => p.metodePembayaran === 'tempo');

        const totalOmzet = filteredSales.reduce((acc, curr) => acc + curr.total, 0);
        const totalTunai = tunaiSales.reduce((acc, curr) => acc + curr.total, 0);
        const totalTempo = tempoSales.reduce((acc, curr) => acc + curr.total, 0);

        const totalQty = filteredSales.reduce((acc, p) =>
            acc + p.items.reduce((s, i) => s + (i.isBonus ? 0 : (i.jumlah * (i.konversi || 1))), 0)
            , 0);

        const totalPromoQty = filteredSales.reduce((acc, p) =>
            acc + p.items.reduce((s, i) => s + (i.isBonus || i.subtotal === 0 ? (i.jumlah * (i.konversi || 1)) : 0), 0)
            , 0);
        // 1b. Category Summary
        const categorySummaryMap = new Map<string, {
            nama: string,
            count: number,
            qty: number,
            total: number
        }>();

        filteredSales.forEach(p => {
            const customer = pelanggan.find(pl => pl.id === p.pelangganId);
            const categoryId = customer?.kategoriId || 'unknown';
            const categoryName = kategoriPelanggan.find(k => k.id === categoryId)?.nama || 'Umum';

            const pQty = p.items.reduce((s, i) => s + (i.isBonus ? 0 : (i.jumlah * (i.konversi || 1))), 0);

            if (!categorySummaryMap.has(categoryName)) {
                categorySummaryMap.set(categoryName, {
                    nama: categoryName,
                    count: 1,
                    qty: pQty,
                    total: p.total
                });
            } else {
                const existing = categorySummaryMap.get(categoryName)!;
                existing.count += 1;
                existing.qty += pQty;
                existing.total += p.total;
            }
        });

        // 2. Stock Movement Summary
        const stockMovementMap = new Map<string, {
            nama: string,
            awal: number,
            masuk: number,
            keluar: number,
            terjual: number,
            promo: number,
            akhir: number,
            satuan: string
        }>();

        // Get relevant userIds for stock check (based on branch)
        const branchUserIds = filterCabang === 'all'
            ? users.map(u => u.id)
            : users.filter(u => u.cabangId === filterCabang).map(u => u.id);

        barang.forEach(item => {
            // Current Stock for selected users
            const currentStock = stokPengguna
                .filter(s => s.barangId === item.id && branchUserIds.includes(s.userId))
                .reduce((sum, s) => sum + s.jumlah, 0);

            let masuk = 0;
            let keluar = 0;
            let terjual = 0;
            let promo = 0;

            let afterIn = 0;
            let afterOut = 0;
            let afterSold = 0;
            let afterPromo = 0;

            // Transactions AFTER selected day (for backward calculation)
            // Sales
            penjualan.forEach(p => {
                if (p.status === 'batal' || p.status === 'draft') return;
                const pDate = new Date(p.tanggal);
                const isRelevantUser = branchUserIds.includes(p.salesId);
                if (!isRelevantUser) return;

                p.items.filter(pi => pi.barangId === item.id).forEach(pi => {
                    const qty = pi.jumlah * (pi.konversi || 1);
                    if (isAfter(pDate, dayEnd)) {
                        if (pi.isBonus || pi.subtotal === 0) afterPromo += qty;
                        else afterSold += qty;
                    } else if (pDate >= dayStart && pDate <= dayEnd) {
                        if (pi.isBonus || pi.subtotal === 0) promo += qty;
                        else terjual += qty;
                    }
                });
            });

            // Mutasi Barang
            mutasiBarang.forEach(m => {
                if (m.status !== 'disetujui') return;
                const mDate = new Date(m.tanggal);

                // Scope Checks (Align with LaporanStok.tsx)
                const isOriginScope = filterCabang === 'all' ? true : (m.dariCabangId === filterCabang);
                const isDestScope = filterCabang === 'all' ? true : (m.keCabangId === filterCabang);

                // Skip if movement is internal to the current scope
                if (isOriginScope && isDestScope) return;

                const items = Array.isArray(m.items) ? m.items : [];
                items.forEach((mi: any) => {
                    const bId = mi.barangId || mi.barang_id;
                    if (bId === item.id) {
                        const qty = mi.totalQty !== undefined ? mi.totalQty : (mi.total_qty !== undefined ? mi.total_qty : mi.jumlah);
                        if (isAfter(mDate, dayEnd)) {
                            if (isOriginScope) afterOut += qty;
                            if (isDestScope) afterIn += qty;
                        } else if (mDate >= dayStart && mDate <= dayEnd) {
                            if (isOriginScope) keluar += qty;
                            if (isDestScope) masuk += qty;
                        }
                    }
                });
            });

            // Process Persetujuan (Restock)
            persetujuan.forEach(p => {
                if (p.jenis !== 'restock' || p.status !== 'disetujui' || !p.data) return;
                const pData = p.data as any;
                const pDate = new Date(p.tanggalPersetujuan || p.tanggalPengajuan);
                const isRelevant = filterCabang === 'all' || p.targetCabangId === filterCabang || (p.targetUserId && users.find(u => u.id === p.targetUserId)?.cabangId === filterCabang);
                if (!isRelevant) return;

                const items = pData.items || (pData.barangId ? [{ barangId: pData.barangId, jumlah: pData.jumlah }] : []);
                items.forEach((pi: any) => {
                    if (pi.barangId === item.id) {
                        const qty = pi.jumlah;
                        if (isAfter(pDate, dayEnd)) afterIn += qty;
                        else if (pDate >= dayStart && pDate <= dayEnd) masuk += qty;
                    }
                });
            });

            // Penyesuaian Stok
            penyesuaianStok?.forEach(adj => {
                if (adj.status !== 'disetujui' || adj.barangId !== item.id) return;
                const isRelevant = filterCabang === 'all' || adj.cabangId === filterCabang;
                if (!isRelevant) return;

                const aDate = new Date(adj.tanggal);
                const diff = adj.selisih;

                if (isAfter(aDate, dayEnd)) {
                    if (diff > 0) afterIn += diff;
                    else afterOut += Math.abs(diff);
                } else if (aDate >= dayStart && aDate <= dayEnd) {
                    if (diff > 0) masuk += diff;
                    else keluar += Math.abs(diff);
                }
            });

            // Calculate historical stock
            // Final = Current - AfterIn + AfterOut + AfterSold + AfterPromo
            const stockAkhir = currentStock - afterIn + afterOut + afterSold + afterPromo;
            // Initial = Final - In + Out + Sold + Promo
            const stockAwal = stockAkhir - masuk + keluar + terjual + promo;

            if (stockAwal !== 0 || stockAkhir !== 0 || masuk !== 0 || keluar !== 0 || terjual !== 0 || promo !== 0) {
                const sItem = satuan.find(s => s.id === item.satuanId);
                stockMovementMap.set(item.id, {
                    nama: item.nama,
                    awal: stockAwal,
                    masuk,
                    keluar,
                    terjual,
                    promo,
                    akhir: stockAkhir,
                    satuan: sItem?.simbol || ''
                });
            }
        });

        // 3. Financial Summary (Cash Reconciliation)
        const dailySetoran = setoran.filter(s => {
            const sDate = new Date(s.tanggal);
            const inDate = sDate >= dayStart && sDate <= dayEnd;
            const inBranch = filterCabang === 'all' || (users.find(u => u.id === (s.salesId || s.userId))?.cabangId === filterCabang);
            return inDate && inBranch;
        });

        const totalSetoranValid = dailySetoran
            .filter(s => s.status === 'disetujui' || s.status === 'diterima')
            .reduce((acc, curr) => acc + curr.jumlah, 0);

        const totalSetoranPending = dailySetoran
            .filter(s => s.status === 'pending')
            .reduce((acc, curr) => acc + curr.jumlah, 0);

        // USER FEEDBACK: Ensure cancelled transactions are filtered out from payments
        const validPembayaranToday = pembayaran.filter(p => {
            const sale = penjualan.find(s => s.id === p.penjualanId);
            return sale && sale.status !== 'batal';
        });

        // Cash collection today from all sources
        const cashCollectionToday = validPembayaranToday.reduce((acc, curr) => acc + Number(curr.jumlah), 0);

        // 5. Detailed Summaries
        const productSummaryMap = new Map<string, { nama: string; qty: number; total: number; satuan: string }>();
        const salesSummaryMap = new Map<string, {
            nama: string;
            qty: number;
            total: number;
            cash: number;
            setoran: number;
            selisih: number;
            targets: {
                id: string;
                name: string;
                type: 'nominal' | 'qty';
                target: number;
                actual: number;
                percentage: number;
            }[]
        }>();

        filteredSales.forEach(p => {
            // Per Sales
            const sId = p.salesId;
            const existingSales = salesSummaryMap.get(sId) || {
                nama: users.find(u => u.id === sId)?.nama || 'Unknown',
                qty: 0,
                total: 0,
                cash: 0,
                setoran: 0,
                selisih: 0,
                targets: []
            };

            p.items.forEach(pi => {
                const qty = pi.jumlah * (pi.konversi || 1);
                existingSales.qty += qty;

                // Per Product
                const prodId = pi.barangId;
                const existingProd = productSummaryMap.get(prodId) || {
                    nama: barang.find(b => b.id === prodId)?.nama || 'Unknown',
                    qty: 0,
                    total: 0,
                    satuan: satuan.find(s => s.id === (barang.find(b => b.id === prodId)?.satuanId))?.simbol || ''
                };
                existingProd.qty += qty;
                existingProd.total += pi.subtotal;
                productSummaryMap.set(prodId, existingProd);
            });

            existingSales.total += p.total;
            salesSummaryMap.set(sId, existingSales);
        });

        // Add cash & setoran to sales summary
        const salesSummaryList = Array.from(salesSummaryMap.values()).map(s => {
            const userId = users.find(u => u.nama === s.nama)?.id;
            const userCash = userId ? validPembayaranToday
                .filter(p => p.createdBy === userId)
                .reduce((acc, curr) => acc + Number(curr.jumlah), 0) : 0;

            const userSetoran = userId ? dailySetoran
                .filter(s => (s.salesId === userId || s.userId === userId) && (s.status === 'disetujui' || s.status === 'diterima'))
                .reduce((acc, curr) => acc + curr.jumlah, 0) : 0;

            // Target Calculation
            const userTargets = activeTargets.filter(t => {
                if (t.scope === 'sales') return t.sales_id === userId;
                if (t.scope === 'cabang') return t.cabang_id === (users.find(u => u.id === userId)?.cabangId);
                return false;
            }).map(t => {
                let startDate: Date;
                let endDate: Date;

                if (t.is_looping) {
                    if (t.jenis === 'harian') {
                        startDate = startOfDay(date);
                        endDate = endOfDay(date);
                    } else if (t.jenis === 'mingguan') {
                        startDate = startOfWeek(date, { weekStartsOn: 1 });
                        endDate = endOfWeek(date, { weekStartsOn: 1 });
                    } else { // bulanan
                        startDate = startOfMonth(date);
                        endDate = endOfMonth(date);
                    }
                } else {
                    startDate = new Date(t.start_date!);
                    endDate = new Date(t.end_date!);
                }

                // Relevant Sales for this specific target period
                const targetSales = penjualan.filter(p => {
                    const pDate = new Date(p.tanggal);
                    const isPaid = p.isLunas === true || (p.metodePembayaran !== 'tempo' && p.status === 'lunas');
                    const inDate = pDate >= startDate && pDate <= endDate && isPaid;
                    if (!inDate) return false;

                    if (t.scope === 'sales') return p.salesId === userId;
                    if (t.scope === 'cabang') return p.cabangId === t.cabang_id;
                    return false;
                });

                const actual = t.target_type === 'nominal'
                    ? targetSales.reduce((sum, p) => sum + p.total, 0)
                    : targetSales.reduce((sum, p) => sum + p.items
                        .filter(i => i.harga > 0 && !i.promoId && !i.isBonus)
                        .reduce((s, i) => s + (i.jumlah * (i.konversi || 1)), 0), 0);

                return {
                    id: t.id,
                    name: `${t.jenis.charAt(0).toUpperCase() + t.jenis.slice(1)} (${t.target_type === 'nominal' ? 'Rp' : 'Qty'})`,
                    type: t.target_type,
                    target: t.nilai,
                    actual,
                    percentage: Math.min(100, Math.round((actual / t.nilai) * 100))
                };
            });

            return {
                ...s,
                cash: userCash,
                setoran: userSetoran,
                selisih: userCash - userSetoran,
                targets: userTargets
            };
        }).filter(item => item.qty > 0 || item.total > 0 || item.cash > 0 || item.setoran > 0);

        return {
            date: selectedDate,
            branchName: filterCabang === 'all' ? 'Semua Cabang' : cabang.find(c => c.id === filterCabang)?.nama || '-',
            sales: {
                totalOmzet,
                totalTunai,
                totalTempo,
                totalQty,
                totalPromoQty,
                count: filteredSales.length
            },
            stock: Array.from(stockMovementMap.values()),
            productSummary: Array.from(productSummaryMap.values()).sort((a, b) => b.qty - a.qty),
            salesSummary: salesSummaryList.sort((a, b) => b.total - a.total),
            categorySummary: Array.from(categorySummaryMap.values()).sort((a, b) => b.total - a.total),
            finance: {
                cashIn: cashCollectionToday,
                cashOut: totalSetoranValid,
                pending: totalSetoranPending,
                net: cashCollectionToday - totalSetoranValid
            }
        };
    }, [selectedDate, filterCabang, penjualan, barang, users, stokPengguna, persetujuan, setoran, satuan, mutasiBarang, penyesuaianStok, pembayaran, pelanggan, kategoriPelanggan]);

    const handleDownloadPDF = async () => {
        setIsGenerating(true);
        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();

            // Header
            doc.setFontSize(18);
            doc.setTextColor(40, 40, 40);
            doc.text('LAPORAN HARIAN KONSOLIDASI', 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`${profilPerusahaan.nama || 'CV. SEKAWAN JAYA'}`, 14, 26);
            doc.text(`Tanggal: ${format(new Date(reportData.date), 'EEEE, dd MMMM yyyy', { locale: localeId })}`, 14, 31);
            doc.text(`Cabang: ${reportData.branchName}`, 14, 36);

            // QR Code from canvas
            const canvas = qrRef.current?.querySelector('canvas');
            if (canvas) {
                const qrDataUrl = canvas.toDataURL('image/png');
                doc.addImage(qrDataUrl, 'PNG', pageWidth - 40, 10, 30, 30);
                doc.setFontSize(7);
                doc.text('Scan to verify', pageWidth - 25, 42, { align: 'center' });
            }

            // 1. Ringkasan Penjualan & Produk
            doc.setFontSize(12);
            doc.setTextColor(40, 40, 40);
            doc.text('1. RINGKASAN PENJUALAN & DETAIL PRODUK', 14, 48);

            autoTable(doc, {
                startY: 52,
                head: [['Kategori Pelanggan', 'Jumlah Transaksi', 'Total Qty', 'Total Omzet']],
                body: [
                    ...reportData.categorySummary.map(c => [
                        c.nama,
                        c.count,
                        formatNumber(c.qty),
                        formatRupiah(c.total)
                    ]),
                    ['TOTAL', reportData.sales.count, formatNumber(reportData.sales.totalQty), formatRupiah(reportData.sales.totalOmzet)]
                ],
                theme: 'striped',
                headStyles: { fillColor: [51, 122, 183] },
                styles: { fontSize: 9 }
            });

            // Add Product Summary as second table in Section 1
            if (reportData.productSummary.length > 0) {
                const finalY_summary = (doc as any).lastAutoTable.finalY + 4;
                autoTable(doc, {
                    startY: finalY_summary,
                    head: [['Detail Produk Terjual', 'Qty', 'Total Omzet']],
                    body: reportData.productSummary.map(p => [
                        p.nama,
                        `${formatNumber(p.qty)} ${p.satuan}`,
                        formatRupiah(p.total)
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [52, 152, 219] },
                    styles: { fontSize: 8 },
                    columnStyles: {
                        1: { halign: 'right' },
                        2: { halign: 'right' }
                    }
                });
            }

            // 2. Ringkasan Keuangan
            const finalY1 = (doc as any).lastAutoTable.finalY + 10;
            doc.text('2. PENERIMAAN & SETORAN KAS', 14, finalY1);

            autoTable(doc, {
                startY: finalY1 + 4,
                body: [
                    ['Total Omzet Penjualan (Billing)', formatRupiah(reportData.sales.totalOmzet)],
                    ['Total Kas Masuk (Actual Penerimaan)', formatRupiah(reportData.finance.cashIn)],
                    ['Total Sudah Disetorkan (Bank/Finance)', formatRupiah(reportData.finance.cashOut)],
                    ['Selisih Kas di Tangan (Net Today)', formatRupiah(reportData.finance.net)],
                    ['Setoran Masih Pending (Menunggu)', formatRupiah(reportData.finance.pending)]
                ],
                theme: 'grid',
                styles: { fontSize: 9 },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 80 },
                    1: { halign: 'right' }
                }
            });

            // 3. Pergerakan Stok
            const finalY2 = (doc as any).lastAutoTable.finalY + 10;
            doc.text('3. PERGERAKAN STOK BARANG', 14, finalY2);

            autoTable(doc, {
                startY: finalY2 + 4,
                head: [['Produk', 'Awal', 'Masuk', 'Keluar', 'Terjual', 'Promo', 'Akhir']],
                body: reportData.stock.map(s => [
                    s.nama,
                    formatNumber(s.awal),
                    formatNumber(s.masuk),
                    formatNumber(s.keluar),
                    formatNumber(s.terjual),
                    formatNumber(s.promo),
                    formatNumber(s.akhir)
                ]),
                theme: 'striped',
                headStyles: { fillColor: [243, 156, 18] },
                styles: { fontSize: 8 }
            });

            // 4. Daftar Sales Ringkasan (Optional)
            if (reportData.salesSummary.length > 0) {
                const finalY_stock = (doc as any).lastAutoTable.finalY + 10;
                if (finalY_stock > 250) doc.addPage();
                const startY_sales = finalY_stock > 250 ? 20 : finalY_stock;

                doc.setFontSize(12);
                doc.text('4. RINGKASAN PERFORMANCE SALES', 14, startY_sales);

                autoTable(doc, {
                    startY: startY_sales + 4,
                    head: [['Salesman', 'Qty / Omzet', 'Achievement', 'Kas / Setor', 'Selisih']],
                    body: reportData.salesSummary.map(s => [
                        s.nama,
                        `${formatNumber(s.qty)} Pcs\n${formatRupiah(s.total)}`,
                        s.targets.map(t => `${t.name}: ${t.percentage}%`).join('\n') || '-',
                        `${formatRupiah(s.cash)}\n${formatRupiah(s.setoran)}`,
                        s.selisih > 0 ? formatRupiah(s.selisih) : '-'
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [230, 126, 34] },
                    styles: { fontSize: 7 },
                    columnStyles: {
                        1: { halign: 'right', cellWidth: 25 },
                        2: { halign: 'center', cellWidth: 35 },
                        3: { halign: 'right', cellWidth: 25 },
                        4: { halign: 'right', fontStyle: 'bold', textColor: [180, 0, 0], cellWidth: 25 }
                    }
                });
            }


            doc.save(`Laporan_Harian_${reportData.date}.pdf`);
            toast.success('Laporan PDF berhasil diunduh');
        } catch (err) {
            console.error("PDF Error:", err);
            toast.error('Gagal membuat PDF');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <MainLayout title="Laporan Harian Konsolidasi">
            <div className="p-4 space-y-4">
                {/* Filters */}
                <div className="flex flex-col md:flex-row justify-between gap-4 bg-white p-4 rounded-lg border shadow-sm">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" onClick={() => navigate('/laporan')} className="pr-2">
                            <ArrowLeft className="w-4 h-4 mr-1" /> Kembali
                        </Button>
                        <div>
                            <h2 className="font-bold text-lg leading-tight uppercase tracking-tight">Laporan Harian</h2>
                            <p className="text-xs text-muted-foreground uppercase font-medium mt-0.5">Stok • Penjualan • Kas</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Hidden QR for PDF */}
                        <div ref={qrRef} className="hidden">
                            <QRCodeCanvas
                                value={`DAILY REPORT | ${reportData.date} | ${reportData.branchName} | Omzet: ${reportData.sales.totalOmzet}`}
                                size={128}
                            />
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-md border text-sm">
                            <Calendar className="w-4 h-4 text-slate-500" />
                            <Input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="border-none bg-transparent h-6 w-32 focus-visible:ring-0 p-0 text-sm font-semibold"
                            />
                        </div>

                        {isAdminOrOwner && (
                            <Select value={filterCabang} onValueChange={setFilterCabang}>
                                <SelectTrigger className="w-[180px] h-9 bg-slate-50 border-slate-200">
                                    <SelectValue placeholder="Semua Cabang" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Cabang</SelectItem>
                                    {cabang.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.nama}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        <Button
                            className="h-9 px-4 shadow-sm bg-primary hover:bg-primary/90"
                            onClick={handleDownloadPDF}
                            disabled={isGenerating}
                        >
                            <Printer className="w-4 h-4 mr-2" />
                            {isGenerating ? 'Memproses...' : 'Cetak Laporan'}
                        </Button>
                    </div>
                </div>

                {/* Dashboard Summary Widgets */}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <Card className="border-l-4 border-l-blue-500 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-bold text-blue-600 uppercase tracking-widest flex justify-between items-center pr-1">
                            Omzet (Billing)
                            <DollarSign className="w-4 h-4 text-blue-200 group-hover:text-blue-500 transition-colors" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-black text-slate-800 tracking-tight">{formatRupiah(reportData.sales.totalOmzet)}</div>
                        <div className="mt-1 text-[10px] font-bold text-blue-600 uppercase tracking-wide">
                            {reportData.sales.count} Transaksi Valid
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-bold text-green-600 uppercase tracking-widest flex justify-between items-center pr-1">
                            Kas Masuk (Actual)
                            <TrendingUp className="w-4 h-4 text-green-200 group-hover:text-green-500 transition-colors" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-black text-slate-800 tracking-tight">{formatRupiah(reportData.finance.cashIn)}</div>
                        <div className="mt-1 text-[10px] font-bold text-green-600 uppercase tracking-wide">
                            Tunai Hari Ini + Bayar Piutang
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-500 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-bold text-orange-600 uppercase tracking-widest flex justify-between items-center pr-1">
                            Stok Terjual
                            <Package className="w-4 h-4 text-orange-200 group-hover:text-orange-500 transition-colors" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-black text-slate-800 tracking-tight">{formatNumber(reportData.sales.totalQty)} <span className="text-xs font-medium text-slate-400">Pcs</span></div>
                        <div className="mt-1 text-[10px] font-bold text-orange-600 uppercase tracking-wide">
                            Promo/Bonus: {formatNumber(reportData.sales.totalPromoQty)} Pcs
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Ringkasan Per Produk */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b p-3 px-4">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            <Package className="w-3.5 h-3.5 text-blue-500" />
                            Ringkasan Penjualan Per Produk
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-slate-50/30">
                                <TableRow>
                                    <TableHead className="text-[10px] h-8 font-bold text-slate-500">Produk</TableHead>
                                    <TableHead className="text-[10px] h-8 font-bold text-slate-500 text-right">Qty</TableHead>
                                    <TableHead className="text-[10px] h-8 font-bold text-slate-500 text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportData.productSummary.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-[10px] text-center text-slate-400 italic py-4">Tidak ada data</TableCell>
                                    </TableRow>
                                ) : (
                                    reportData.productSummary.map((p, idx) => (
                                        <TableRow key={idx} className="hover:bg-slate-50/50">
                                            <TableCell className="text-[11px] py-1.5 font-medium">{p.nama}</TableCell>
                                            <TableCell className="text-[11px] py-1.5 text-right font-bold text-slate-900">{formatNumber(p.qty)} <span className="text-[9px] font-normal text-slate-400">{p.satuan}</span></TableCell>
                                            <TableCell className="text-[11px] py-1.5 text-right font-bold text-blue-600">{formatRupiah(p.total)}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Ringkasan Per Sales */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b p-3 px-4">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-orange-500" />
                            Ringkasan Performance Sales
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-slate-50/30">
                                <TableRow>
                                    <TableHead className="text-[10px] h-8 font-bold text-slate-500">Salesman</TableHead>
                                    <TableHead className="text-[10px] h-8 font-bold text-slate-500 text-right">Qty / Omzet</TableHead>
                                    <TableHead className="text-[10px] h-8 font-bold text-slate-500 text-right">Target Achievement</TableHead>
                                    <TableHead className="text-[10px] h-8 font-bold text-slate-500 text-right">Kas / Setor</TableHead>
                                    <TableHead className="text-[10px] h-8 font-bold text-slate-500 text-right px-4">Selisih</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportData.salesSummary.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-[10px] text-center text-slate-400 italic py-4">Tidak ada data</TableCell>
                                    </TableRow>
                                ) : (
                                    reportData.salesSummary.map((s, idx) => (
                                        <TableRow key={idx} className="hover:bg-slate-50/50">
                                            <TableCell className="text-[11px] py-1.5 font-bold text-slate-700">{s.nama}</TableCell>
                                            <TableCell className="text-[11px] py-1.5 text-right">
                                                <div className="font-bold">{formatNumber(s.qty)}</div>
                                                <div className="text-[9px] text-blue-500">{formatRupiah(s.total)}</div>
                                            </TableCell>
                                            <TableCell className="text-[11px] py-1.5 text-right">
                                                <div className="space-y-1 w-32 ml-auto">
                                                    {s.targets.length === 0 ? (
                                                        <div className="text-[9px] text-slate-400 italic">No target</div>
                                                    ) : (
                                                        s.targets.map(t => (
                                                            <div key={t.id} className="space-y-0.5">
                                                                <div className="flex justify-between text-[8px] font-bold uppercase tracking-tighter">
                                                                    <span>{t.name}</span>
                                                                    <span className={t.percentage >= 100 ? 'text-green-600' : 'text-orange-600'}>{t.percentage}%</span>
                                                                </div>
                                                                <Progress value={t.percentage} className="h-1" />
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-[11px] py-1.5 text-right">
                                                <div className="text-green-600 font-medium">{formatRupiah(s.cash)}</div>
                                                <div className="text-[9px] text-slate-400">{formatRupiah(s.setoran)}</div>
                                            </TableCell>
                                            <TableCell className="text-[11px] py-1.5 text-right font-black text-red-600 px-4">
                                                {s.selisih > 0 ? formatRupiah(s.selisih) : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left details */}
                <div className="space-y-6">
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50/50 border-b p-3">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider">Rincian Keuangan Hari Ini</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-center py-1 border-b border-dashed">
                                <span className="text-xs text-slate-500 font-medium">Kas Masuk (Actual)</span>
                                <span className="text-sm font-bold text-slate-700">{formatRupiah(reportData.finance.cashIn)}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-dashed">
                                <span className="text-xs text-slate-500 font-medium text-green-600">(-) Sudah Setor (Bank)</span>
                                <span className="text-sm font-bold text-green-600">{formatRupiah(reportData.finance.cashOut)}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 bg-slate-50 px-2 rounded -mx-2">
                                <span className="text-xs font-black uppercase text-slate-800">Sisa Kas (Net)</span>
                                <span className="text-sm font-black text-primary">{formatRupiah(reportData.finance.net)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-slate-50/50 border-b p-3">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider">Penjualan Tempo</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500 font-medium uppercase tracking-tight">Nilai Piutang Baru</span>
                                <span className="text-sm font-bold text-red-600">{formatRupiah(reportData.sales.totalTempo)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right stock table */}
                <div className="lg:col-span-2">
                    <Card className="shadow-sm border-slate-200 h-full">
                        <CardHeader className="bg-slate-50/50 border-b p-3 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                <History className="w-3.5 h-3.5 text-orange-500" />
                                Pergerakan Stok Konsolidasi
                            </CardTitle>
                            <span className="text-[9px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded uppercase">
                                {reportData.stock.length} Produk
                            </span>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/30 text-[10px] uppercase font-black text-slate-500 border-b">
                                        <TableHead className="h-9">Produk</TableHead>
                                        <TableHead className="h-9 text-right">Awal</TableHead>
                                        <TableHead className="h-9 text-right text-green-600">In</TableHead>
                                        <TableHead className="h-9 text-right text-red-600">Out</TableHead>
                                        <TableHead className="h-9 text-right text-blue-600">Sold</TableHead>
                                        <TableHead className="h-9 text-right font-black text-slate-900 pr-4">Akhir</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.stock.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center h-24 text-slate-400 italic text-[10px]">No data</TableCell>
                                        </TableRow>
                                    ) : (
                                        reportData.stock.map((item, idx) => (
                                            <TableRow key={idx} className="hover:bg-slate-50/50">
                                                <TableCell className="py-2 text-[11px] font-medium text-slate-700">{item.nama}</TableCell>
                                                <TableCell className="text-right text-[10px] text-slate-500">{formatNumber(item.awal)}</TableCell>
                                                <TableCell className="text-right text-[10px] text-green-600 font-bold">{item.masuk > 0 ? `+${formatNumber(item.masuk)}` : '-'}</TableCell>
                                                <TableCell className="text-right text-[10px] text-red-600 font-bold">{item.keluar > 0 ? `-${formatNumber(item.keluar)}` : '-'}</TableCell>
                                                <TableCell className="text-right text-[10px] text-blue-600 font-bold">
                                                    {item.terjual > 0 ? `-${formatNumber(item.terjual)}` : '-'}
                                                    {item.promo > 0 && <span className="text-[9px] ml-1 text-orange-400 font-normal">(P:${formatNumber(item.promo)})</span>}
                                                </TableCell>
                                                <TableCell className="text-right text-[11px] font-black text-slate-900 pr-4">{formatNumber(item.akhir)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </MainLayout>
    );
}
