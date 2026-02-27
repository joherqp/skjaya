import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatRupiah } from '@/lib/utils';
import { ArrowLeft, Download, FileSpreadsheet, FileText, Calendar, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { createRoot } from 'react-dom/client';
import { LPPUPrintTemplate } from '@/components/laporan/LPPUPrintTemplate';

export default function LaporanPenjualan() {
    const navigate = useNavigate();
    const { user } = useAuth();

    interface PersetujuanData {
        barangId?: string;
        satuanId?: string;
        jumlah?: number;
        items?: Array<{
            barangId: string;
            jumlah: number;
            satuanId: string;
            konversi: number;
        }>;
    }

    const {
        penjualan, barang, pelanggan, profilPerusahaan, users, karyawan,
        stokPengguna, persetujuan, cabang: listCabang, kategoriPelanggan, satuan, setoran, saldoPengguna
    } = useDatabase();

    const [selectedDate, setSelectedDate] = useState<Date>(() => {
        const d = new Date();
        // Default to today
        return d;
    });

    const [isGenerating, setIsGenerating] = useState(false);

    // --- LPPU Logic (Migrated) ---
    const reportData = useMemo(() => {
        const dayStart = new Date(selectedDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(selectedDate);
        dayEnd.setHours(23, 59, 59, 999);

        // Sales for the day (Completed only, Scoped to User)
        const dailySales = penjualan.filter(p => {
            const pDate = new Date(p.tanggal);
            return pDate >= dayStart && pDate <= dayEnd && p.status === 'lunas' && p.salesId === user?.id;
        });

        // 1. Sales Summary
        const salesSummaryMap = new Map<string, {
            kategori: string,
            produk: string,
            qty: number,
            harga: number,
            potongan: number,
            total: number
        }>();

        dailySales.filter(p => p.metodePembayaran === 'tunai').forEach(p => {
            // Find customer category once per sale
            const customer = pelanggan.find(c => c.id === p.pelangganId);
            const customerCategory = kategoriPelanggan.find(k => k.id === customer?.kategoriId);
            const categoryName = customerCategory?.nama || 'UMUM';

            p.items.forEach(item => {
                const product = barang.find(b => b.id === item.barangId);

                const conversion = item.konversi || 1;
                const pricePerBaseUnit = item.harga / conversion;

                // Use product's BASE SATUAN for the display unit
                const baseSatuan = satuan.find(s => s.id === product?.satuanId);

                // Group by Category AND Product AND Price per BASE UNIT
                const key = `${categoryName}-${item.barangId}-${pricePerBaseUnit}`;

                if (!salesSummaryMap.has(key)) {
                    salesSummaryMap.set(key, {
                        kategori: categoryName,
                        produk: `${product?.nama || item.barangId} (${baseSatuan?.nama || '-'})`,
                        qty: 0,
                        harga: pricePerBaseUnit,
                        potongan: 0,
                        total: 0
                    });
                }
                const entry = salesSummaryMap.get(key)!;

                // Normalize Qty: multiply actual quantity by conversion factor
                entry.qty += item.jumlah * conversion;

                // Calculate nominal discount: (Qty * Unit Price) - Subtotal
                const nominalDiscount = (item.jumlah * item.harga) - item.subtotal;
                entry.potongan += nominalDiscount;

                entry.total += item.subtotal;
            });
        });
        const salesSummary = Array.from(salesSummaryMap.values());

        // 2. Notes
        const notes = dailySales
            .filter(p => p.metodePembayaran === 'tunai')
            .map((p, idx) => {
                const cust = pelanggan.find(c => c.id === p.pelangganId);
                return {
                    no: idx + 1,
                    toko: cust?.nama || 'UMUM',
                    faktur: p.nomorNota,
                    telp: cust?.telepon || '-',
                    area: cust?.alamat?.substring(0, 15) || '-',
                    catatan: p.catatan || '-',
                    total: p.total
                };
            });

        // 3. Stock History
        const stockHistoryMap = new Map<string, {
            produk: string,
            stockAwal: number,
            masuk: number,
            keluar: number,
            terjual: number,
            promo: number,
            stockAkhir: number
        }>();

        const userStock = stokPengguna.filter(sp => sp.userId === user?.id);

        const approvedRestocks = persetujuan?.filter(p => {
            const pDate = new Date(p.tanggalPersetujuan || '');
            const isToday = pDate >= dayStart && pDate <= dayEnd;
            return isToday &&
                p.status === 'disetujui' &&
                (p.jenis === 'restock' || p.jenis === 'permintaan') &&
                p.diajukanOleh === user?.id;
        }) || [];

        userStock.forEach(sp => {
            const product = barang.find(b => b.id === sp.barangId);
            if (!product) return;

            let masuk = 0;
            approvedRestocks.forEach(p => {
                const pData = p.data as PersetujuanData;
                if (pData && pData.items) {
                    const item = pData.items.find((i) => i.barangId === sp.barangId);
                    if (item) masuk += Number(item.jumlah);
                }
            });

            let terjual = 0;
            let promo = 0;
            dailySales.forEach(p => {
                p.items.filter(i => i.barangId === sp.barangId).forEach(i => {
                    // Normalize to base unit (stok unit)
                    const qtyNormalized = i.jumlah * (i.konversi || 1);
                    terjual += qtyNormalized;
                    if (i.harga === 0 || i.diskon === i.harga) {
                        promo += qtyNormalized;
                    }
                });
            });

            const keluar = 0;
            const stockAkhir = sp.jumlah;
            const stockAwal = stockAkhir - masuk + keluar + terjual;

            if (stockAwal !== 0 || stockAkhir !== 0 || masuk !== 0 || terjual !== 0) {
                stockHistoryMap.set(sp.barangId, {
                    produk: product.nama,
                    stockAwal,
                    masuk,
                    keluar,
                    terjual,
                    promo,
                    stockAkhir
                });
            }
        });
        const stockHistory = Array.from(stockHistoryMap.values());

        // 4. Bills
        const unpaidSales = penjualan.filter(p =>
            p.metodePembayaran === 'tempo' &&
            !p.isLunas &&
            p.status === 'lunas'
            // Should bills be scoped to user? Usually yes for salesman report.
            && p.salesId === user?.id
        );

        const bills = unpaidSales.map(p => {
            const cust = pelanggan.find(c => c.id === p.pelangganId);
            const productNames = p.items.map(i => {
                const b = barang.find(x => x.id === i.barangId);
                return b?.nama;
            }).join(', ');

            return {
                tanggal: new Date(p.tanggal).toLocaleDateString('id-ID'),
                toko: cust?.nama || 'Unknown',
                kategori: 'UMUM',
                produk: productNames.substring(0, 50),
                qty: p.items.reduce((s, i) => s + i.jumlah, 0),
                sisaTagihan: p.total
            };
        });

        // Totals & Settlements
        // 1. Total Penjualan Hari Ini (Only Tunai as this report focuses on cash reconciliation)
        const currentDailyTunaiSales = dailySales.filter(p => p.metodePembayaran === 'tunai');
        const totalPenjualanHariIni = currentDailyTunaiSales.reduce((acc, curr) => acc + curr.total, 0);

        // 2. Total Tunai yang diterima Hari Ini (Dari Penjualan Baru)
        // Only 'tunai' payments affect saldo_pengguna in TambahPenjualan.tsx
        const totalTunaiSales = dailySales
            .filter(p => p.metodePembayaran === 'tunai')
            .reduce((acc, curr) => acc + (curr.bayar || 0) - (curr.kembalian || 0), 0);

        // 3. Integrate Actual Setoran (Bank Settlements)
        const dailySetoran = setoran.filter(s => {
            const sDateStr = format(new Date(s.tanggal), 'yyyy-MM-dd');
            const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
            return sDateStr === selectedDateStr && ((s.salesId === user?.id) || (s.userId === user?.id));
        });

        const totalSetoranHariIni = dailySetoran
            .filter(s => s.status === 'disetujui' || s.status === 'diterima')
            .reduce((acc, curr) => acc + curr.jumlah, 0);

        const totalPendingSetoran = dailySetoran
            .filter(s => s.status === 'pending')
            .reduce((acc, curr) => acc + curr.jumlah, 0);

        // 4. Saldo Logic (Current vs Previous)
        const userSaldoRecord = saldoPengguna.find(s => s.userId === user?.id);
        const currentSaldo = userSaldoRecord?.saldo || 0;

        // Saldo Sebelumnya (Opening Balance of Selected Day)
        // To get balance at the START of selected day, we take CURRENT balance 
        // and reverse all activities from the selected day's start until now.
        const activitiesFromSelectedDayOnwards = penjualan.filter(p => {
            const pDate = new Date(p.tanggal);
            return pDate >= dayStart && p.status === 'lunas' && p.salesId === user?.id && p.metodePembayaran === 'tunai';
        });
        const cashInFromSelectedDayOnwards = activitiesFromSelectedDayOnwards.reduce((acc, curr) => acc + (curr.bayar || 0) - (curr.kembalian || 0), 0);

        const depositsFromSelectedDayOnwards = setoran.filter(s => {
            const sDate = new Date(s.tanggal);
            return sDate >= dayStart && (s.status === 'disetujui' || s.status === 'diterima') && ((s.salesId === user?.id) || (s.userId === user?.id));
        });
        const cashOutFromSelectedDayOnwards = depositsFromSelectedDayOnwards.reduce((acc, curr) => acc + curr.jumlah, 0);

        const saldoSebelumnya = currentSaldo - cashInFromSelectedDayOnwards + cashOutFromSelectedDayOnwards;

        // Saldo Akhir of the selected day (Opening + Today's In - Today's Out)
        // Using all non-rejected deposits for physical cash reconciliation
        const saldoAkhir = saldoSebelumnya + totalTunaiSales - totalSetoranHariIni;

        return {
            salesSummary,
            notes,
            stockHistory,
            bills,
            totals: {
                penjualanHariIni: totalPenjualanHariIni,
                setoranTunai: totalTunaiSales,
                totalSetoran: totalSetoranHariIni,
                pendingSetoran: totalPendingSetoran,
                saldoSebelumnya: saldoSebelumnya,
                saldoAkhir: saldoAkhir,
                currentSaldo: currentSaldo // Still keeping real-time current for reference if needed
            }
        };
    }, [selectedDate, penjualan, barang, pelanggan, user, stokPengguna, persetujuan, saldoPengguna, setoran]);


    // --- Export Handlers ---
    const handleDownloadPDF = async () => {
        setIsGenerating(true);
        try {
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.top = '-9999px';
            container.style.left = '-9999px';
            document.body.appendChild(container);

            const salesName = user?.nama || 'Admin';
            const root = createRoot(container);

            await new Promise<void>((resolve) => {
                root.render(
                    <LPPUPrintTemplate
                        id="lppu-print-target"
                        date={selectedDate}
                        salesName={salesName}
                        companyProfile={profilPerusahaan}
                        data={reportData}
                        cabangName={listCabang.find(c => c.id === user?.cabangId)?.nama}
                    />
                );
                setTimeout(resolve, 500);
            });

            const element = container.querySelector('#lppu-print-target') as HTMLElement;
            if (element) {
                const canvas = await html2canvas(element, { scale: 2, logging: false, useCORS: true });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`LPPU_${format(selectedDate, 'yyyy-MM-dd')}_${salesName}.pdf`);
                toast.success('LPPU PDF berhasil diunduh');
            } else {
                toast.error('Gagal merender laporan');
            }

            root.unmount();
            document.body.removeChild(container);
        } catch (err) {
            console.error("LPPU Error:", err);
            toast.error('Terjadi kesalahan saat membuat LPPU');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadExcel = () => {
        setIsGenerating(true);
        try {
            const { salesSummary, notes, stockHistory, bills, totals } = reportData;
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const salesName = user?.nama || 'Admin';

            const wb = XLSX.utils.book_new();

            // Sheet 1: Ringkasan
            const summaryData = [
                ["Laporan Ringkasan Penjualan Tunai"],
                ["Tanggal", dateStr],
                ["Salesman", salesName],
                [],
                ["Kategori", "Produk", "Qty", "Harga", "Potongan", "Total"],
                ...salesSummary.map(s => [s.kategori, s.produk, s.qty, s.harga, s.potongan, s.total]),
                [],
                ["Total Penjualan Hari Ini", totals.penjualanHariIni],
                [totals.saldoSebelumnya >= 0 ? "Saldo Sebelumnya (Hutang Setoran)" : "Saldo Sebelumnya (Lebih Setor)", totals.saldoSebelumnya],
                ["(+) Penjualan Hari Ini", totals.setoranTunai],
                ["(-) Sudah Disetorkan ke Finance", totals.totalSetoran],
                ["(=) Saldo Akhir", totals.saldoAkhir]
            ];
            const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

            // Sheet 2: Nota
            const notesData = [
                ["Daftar Nota Penjualan Tunai"],
                [],
                ["No", "Toko/Pelanggan", "Faktur", "Area", "Catatan", "Total"],
                ...notes.map(n => [n.no, n.toko, n.faktur, n.area, n.catatan, n.total])
            ];
            const wsNotes = XLSX.utils.aoa_to_sheet(notesData);
            XLSX.utils.book_append_sheet(wb, wsNotes, "Nota Tunai");

            // Sheet 3: Stok
            const stockData = [
                ["Riwayat Pergerakan Stok (Hari Ini)"],
                [],
                ["Produk", "Stok Awal", "Masuk", "Keluar", "Terjual", "Promo", "Stok Akhir"],
                ...stockHistory.map(s => [s.produk, s.stockAwal, s.masuk, s.keluar, s.terjual, s.promo, s.stockAkhir])
            ];
            const wsStock = XLSX.utils.aoa_to_sheet(stockData);
            XLSX.utils.book_append_sheet(wb, wsStock, "Stok");

            // Sheet 4: Tagihan
            const billsData = [
                ["Daftar Tagihan / Piutang Belum Lunas"],
                [],
                ["Tanggal", "Toko", "Produk", "Qty Total", "Sisa Tagihan"],
                ...bills.map(b => [b.tanggal, b.toko, b.produk, b.qty, b.sisaTagihan])
            ];
            const wsBills = XLSX.utils.aoa_to_sheet(billsData);
            XLSX.utils.book_append_sheet(wb, wsBills, "Tagihan");

            XLSX.writeFile(wb, `LPPU_${dateStr}_${salesName}.xlsx`);
            toast.success('LPPU Excel berhasil diunduh');

        } catch (err) {
            console.error("Excel Error:", err);
            toast.error('Gagal membuat file Excel');
        } finally {
            setIsGenerating(false);
        }
    };


    return (
        <MainLayout title="Laporan Harian (LPPU)">
            <div className="p-4 space-y-4">
                {/* Header & Controls */}
                <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center bg-white p-4 rounded-lg border shadow-sm">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={() => navigate('/laporan')} className="pl-0">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
                        </Button>
                        <div>
                            <h2 className="font-semibold text-lg">Laporan Harian</h2>
                            <p className="text-xs text-muted-foreground">Salesman: {user?.nama}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <div className="flex items-center gap-2 bg-muted/20 p-1.5 rounded-md border">
                            <Calendar className="w-4 h-4 text-muted-foreground ml-2" />
                            <Input
                                type="date"
                                value={format(selectedDate, 'yyyy-MM-dd')}
                                onChange={(e) => {
                                    if (e.target.value) setSelectedDate(new Date(e.target.value));
                                }}
                                className="h-8 w-[140px] border-none bg-transparent focus-visible:ring-0 text-sm"
                            />
                        </div>

                        <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={isGenerating}>
                            <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Excel
                        </Button>
                        <Button size="sm" onClick={handleDownloadPDF} disabled={isGenerating}>
                            <Printer className="w-4 h-4 mr-2" /> Print PDF
                        </Button>
                    </div>
                </div>

                {/* Content Tabs */}
                <Tabs defaultValue="ringkasan" className="w-full">
                    <TabsList className="w-full justify-start overflow-x-auto">
                        <TabsTrigger value="ringkasan">Ringkasan Penjualan</TabsTrigger>
                        <TabsTrigger value="nota">Nota Tunai</TabsTrigger>
                        <TabsTrigger value="stok">Pergerakan Stok</TabsTrigger>
                        <TabsTrigger value="tagihan">Tagihan/Piutang</TabsTrigger>
                    </TabsList>

                    <TabsContent value="ringkasan">
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Kategori</TableHead>
                                            <TableHead>Produk</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                            <TableHead className="text-right">Harga</TableHead>
                                            <TableHead className="text-right">Potongan</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reportData.salesSummary.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Tidak ada data penjualan hari ini</TableCell>
                                            </TableRow>
                                        ) : (
                                            reportData.salesSummary.map((item, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="text-xs text-muted-foreground">{item.kategori}</TableCell>
                                                    <TableCell className="font-medium">{item.produk}</TableCell>
                                                    <TableCell className="text-right">{item.qty}</TableCell>
                                                    <TableCell className="text-right">{formatRupiah(item.harga)}</TableCell>
                                                    <TableCell className="text-right text-red-500">{item.potongan > 0 ? `-${formatRupiah(item.potongan)}` : '-'}</TableCell>
                                                    <TableCell className="text-right font-bold">{formatRupiah(item.total)}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                        {reportData.salesSummary.length > 0 && (
                                            <TableRow className="bg-muted/30 font-bold">
                                                <TableCell colSpan={5} className="text-right uppercase text-[10px] tracking-wider text-muted-foreground">Total Penjualan Tunai</TableCell>
                                                <TableCell className="text-right text-primary">{formatRupiah(reportData.totals.penjualanHariIni)}</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Summary Block */}
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="bg-slate-50">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-center border-b pb-2">
                                        <span className={`text-xs font-bold uppercase tracking-wider ${reportData.totals.saldoSebelumnya >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                            {reportData.totals.saldoSebelumnya >= 0 ? 'Saldo Sebelumnya (Hutang Setoran)' : 'Saldo Sebelumnya (Lebih Setor)'}
                                        </span>
                                        <span className={`font-bold ${reportData.totals.saldoSebelumnya >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                            {formatRupiah(reportData.totals.saldoSebelumnya)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center border-b pb-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">(+) Penjualan Hari Ini</span>
                                        <span className="font-bold text-slate-800">{formatRupiah(reportData.totals.setoranTunai)}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b pb-2 text-green-600">
                                        <span className="text-xs font-bold uppercase tracking-wider">(-) Sudah Disetorkan ke Finance</span>
                                        <span className="font-bold">{formatRupiah(reportData.totals.totalSetoran)}</span>
                                    </div>
                                    {reportData.totals.pendingSetoran > 0 && (
                                        <div className="flex justify-between items-center border-b pb-2 text-amber-600 italic">
                                            <span className="text-xs font-bold uppercase tracking-wider">Setoran Menunggu Persetujuan (Pending)</span>
                                            <span className="font-bold">{formatRupiah(reportData.totals.pendingSetoran)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-1 mt-2 border-t-2 border-slate-200">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">(=) Saldo Akhir</span>
                                        <span className={`text-lg font-black ${reportData.totals.saldoAkhir >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                            {formatRupiah(reportData.totals.saldoAkhir)}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="nota">
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">No</TableHead>
                                            <TableHead>Toko</TableHead>
                                            <TableHead>Faktur</TableHead>
                                            <TableHead>Area</TableHead>
                                            <TableHead>Catatan</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reportData.notes.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Tidak ada nota tunai</TableCell>
                                            </TableRow>
                                        ) : (
                                            reportData.notes.map((item, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell>{item.no}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{item.toko}</span>
                                                            <span className="text-xs text-muted-foreground">{item.telp}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{item.faktur}</TableCell>
                                                    <TableCell>{item.area}</TableCell>
                                                    <TableCell className="text-muted-foreground italic text-xs">{item.catatan}</TableCell>
                                                    <TableCell className="text-right font-medium">{formatRupiah(item.total)}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="stok">
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Produk</TableHead>
                                            <TableHead className="text-right text-muted-foreground">Awal</TableHead>
                                            <TableHead className="text-right text-green-600">Masuk</TableHead>
                                            <TableHead className="text-right text-red-600">Terjual</TableHead>
                                            <TableHead className="text-right">Promo</TableHead>
                                            <TableHead className="text-right font-bold">Akhir</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reportData.stockHistory.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Tidak ada pergerakan stok</TableCell>
                                            </TableRow>
                                        ) : (
                                            reportData.stockHistory.map((item, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-medium">{item.produk}</TableCell>
                                                    <TableCell className="text-right text-muted-foreground">{item.stockAwal}</TableCell>
                                                    <TableCell className="text-right text-green-600">{item.masuk > 0 ? `+${item.masuk}` : '-'}</TableCell>
                                                    <TableCell className="text-right text-red-600">{item.terjual > 0 ? `-${item.terjual}` : '-'}</TableCell>
                                                    <TableCell className="text-right">{item.promo > 0 ? item.promo : '-'}</TableCell>
                                                    <TableCell className="text-right font-bold">{item.stockAkhir}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="tagihan">
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tanggal</TableHead>
                                            <TableHead>Toko</TableHead>
                                            <TableHead>Produk</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                            <TableHead className="text-right">Sisa Tagihan</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reportData.bills.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Tidak ada tagihan outstanding</TableCell>
                                            </TableRow>
                                        ) : (
                                            reportData.bills.map((item, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell>{item.tanggal}</TableCell>
                                                    <TableCell className="font-medium">{item.toko}</TableCell>
                                                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground" title={item.produk}>{item.produk}</TableCell>
                                                    <TableCell className="text-right font-mono">{item.qty}</TableCell>
                                                    <TableCell className="text-right font-medium">{formatRupiah(item.sisaTagihan)}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </MainLayout>
    );
}
