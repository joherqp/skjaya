import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PembayaranPenjualan, Penjualan, PenjualanItem } from '@/lib/types';
import { formatRupiah, formatTanggal, formatWaktu, cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Share2, Printer, ArrowLeft, Calendar, Loader2, DollarSign, History, CreditCard, MapPin, User, ShoppingBag, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { QRCodeCanvas } from 'qrcode.react';

export default function DetailPenjualan() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const {
        penjualan,
        updatePenjualan,
        pelanggan,
        users,
        updateSaldoPengguna,
        saldoPengguna,
        addStokPengguna,
        updateStokPengguna,
        stokPengguna,
        barang,
        satuan,
        cabang,
        profilPerusahaan,
        addPembayaranPenjualan,
        isAdminOrOwner,
        addPersetujuan,
        addSaldoPengguna
    } = useDatabase();
    const { user: currentUser } = useAuth();

    const [trx, setTrx] = useState<Penjualan | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRepaymentOpen, setIsRepaymentOpen] = useState(false);
    const [isRepaymentConfirmOpen, setIsRepaymentConfirmOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isFinalizeOpen, setIsFinalizeOpen] = useState(false);
    const [cancellationReason, setCancellationReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const [paymentHistory, setPaymentHistory] = useState<PembayaranPenjualan[]>([]);
    const [showPrintReceipt, setShowPrintReceipt] = useState(false);
    const [showPrintInvoice, setShowPrintInvoice] = useState(false);
    const [isPrintTypeOpen, setIsPrintTypeOpen] = useState(false);

    const fetchTrx = useCallback(() => {
        if (!id) return;
        const found = penjualan.find(p => p.id === id);
        if (found) {
            setTrx(found);
        }
        setLoading(false);
    }, [id, penjualan]);

    useEffect(() => {
        fetchTrx();
    }, [fetchTrx]);

    const fetchPaymentHistory = useCallback(async () => {
        if (!id) return;
        try {
            const { data, error } = await supabase
                .from('pembayaran_penjualan')
                .select('*')
                .eq('penjualan_id', id)
                .order('tanggal', { ascending: false });
            if (error) throw error;
            setPaymentHistory(data || []);
        } catch (err) {
            console.error(err);
        }
    }, [id]);

    useEffect(() => {
        if (id) fetchPaymentHistory();
    }, [id, fetchPaymentHistory]);

    const handleRepayment = async () => {
        if (!trx || paymentAmount <= 0) return;
        setIsSubmittingPayment(true);
        try {
            await addPembayaranPenjualan({
                penjualanId: trx.id,
                jumlah: paymentAmount,
                metodePembayaran: 'transfer', // Default or pickable
                tanggal: new Date(),
                createdBy: currentUser?.id || 'system'
            });
            toast.success("Pembayaran berhasil disimpan");
            setIsRepaymentOpen(false);
            setIsRepaymentConfirmOpen(false);
            setPaymentAmount(0);
            fetchPaymentHistory();
        } catch (err) {
            console.error(err);
            toast.error("Gagal menyimpan pembayaran");
        } finally {
            setIsSubmittingPayment(false);
        }
    };

    const handleAjukanPembatalan = async () => {
        if (!trx || !cancellationReason.trim()) return;

        setIsSubmitting(true);
        try {
            if (trx.status === 'draft') {
                // Return stock to seller
                if (trx.items && Array.isArray(trx.items)) {
                    const sellerId = trx.salesId || trx.createdBy;
                    for (const item of trx.items) {
                        const qtyBase = item.jumlah * (item.konversi || 1);
                        const sellerStock = stokPengguna.find(s => s.userId === sellerId && s.barangId === item.barangId);

                        if (sellerStock) {
                            await updateStokPengguna(sellerStock.id, {
                                jumlah: sellerStock.jumlah + qtyBase
                            });
                        } else {
                            // Fallback: create record if not exists
                            await addStokPengguna({
                                userId: sellerId as string,
                                barangId: item.barangId,
                                jumlah: qtyBase
                            });
                        }
                    }
                }

                // 1. Fetch payments for this transaction to revert saldo
                const { data: payments, error: fetchPayErr } = await supabase
                    .from('pembayaran_penjualan')
                    .select('jumlah')
                    .eq('penjualan_id', trx.id);

                if (!fetchPayErr && payments) {
                    const totalPaid = payments.reduce((sum, p) => sum + Number(p.jumlah), 0);
                    if (totalPaid > 0) {
                        const sellerId = trx.salesId || trx.createdBy;
                        const currSaldo = saldoPengguna.find(s => s.userId === sellerId);
                        if (currSaldo) {
                            await updateSaldoPengguna(currSaldo.id, { saldo: currSaldo.saldo - totalPaid });
                        } else {
                            await addSaldoPengguna({ userId: sellerId, saldo: -totalPaid });
                        }
                    }

                    // 2. Delete payments
                    await supabase
                        .from('pembayaran_penjualan')
                        .delete()
                        .eq('penjualan_id', trx.id);
                }

                // Direct cancel for drafts
                await updatePenjualan(trx.id, {
                    status: 'batal',
                    catatan: (trx.catatan ? trx.catatan + '\n' : '') + `Dibatalkan: ${cancellationReason}`
                });
                toast.success('Transaksi draft berhasil dibatalkan, stok dikembalikan, dan pembayaran dihapus');
                navigate('/penjualan/rekap');
            } else {
                // Submit approval request for others
                await addPersetujuan({
                    jenis: 'pembatalan_penjualan',
                    referensiId: trx.id,
                    targetRole: 'admin',
                    diajukanOleh: currentUser?.id,
                    tanggalPengajuan: new Date(),
                    status: 'pending',
                    data: {
                        reason: cancellationReason,
                        invoiceNo: trx.nomorNota,
                        total: trx.total,
                        customerName: pelanggan.find(p => p.id === trx.pelangganId)?.nama || 'Pelanggan'
                    }
                });
                toast.success('Permintaan pembatalan telah diajukan ke Admin/Owner');
                setIsConfirmOpen(false);
                setCancellationReason('');
            }
        } catch (error) {
            console.error('Error cancelling sale:', error);
            toast.error('Gagal memproses pembatalan');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFinalize = async (useToday: boolean) => {
        if (!trx) return;
        setIsSubmitting(true);
        try {
            const updates: Partial<Penjualan> = {
                status: 'lunas',
            };
            if (useToday) {
                updates.tanggal = new Date();
            }
            await updatePenjualan(trx.id, updates);
            toast.success('Transaksi draft berhasil diselesaikan (LUNAS).');
            setIsFinalizeOpen(false);
            fetchTrx(); // Refresh the current view
        } catch (error) {
            console.error('Error finalizing draft:', error);
            toast.error('Gagal menyelesaikan draft');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleShare = async () => {
        if (!trx) return;

        const customerInfo = pelanggan.find(p => p.id === trx.pelangganId);
        const items = trx.items.map(item => {
            const product = barang.find(b => b.id === item.barangId);
            const unit = satuan.find(s => s.id === item.satuanId);
            return `• ${product?.nama || 'Item'} (${item.jumlah} ${unit?.simbol || 'pcs'}) - ${formatRupiah(item.subtotal)}`;
        }).join('\n');

        const statusText = trx.status === 'lunas' ? '✅ LUNAS' :
            trx.status === 'batal' ? '❌ BATAL' :
                trx.status === 'draft' ? '⏳ DRAFT' :
                    trx.status === 'pending' ? '⏳ PENDING' : (trx.status as string).toUpperCase();

        const shareStatus = `${statusText}${trx.metodePembayaran === 'tempo' ? (trx.isLunas ? ' (LUNAS)' : ' (BELUM LUNAS)') : ''}`;

        const shareText = `📄 *NOTA PENJUALAN*
━━━━━━━━━━━━━━━━━━
📌 No: ${trx.nomorNota}
📅 Tanggal: ${formatTanggal(trx.tanggal)}
👤 Pelanggan: ${customerInfo?.nama || 'Umum'}

📦 *Rincian Barang:*
${items}

━━━━━━━━━━━━━━━━━━
💰 *Total: ${formatRupiah(trx.total)}*
💵 Bayar: ${formatRupiah(trx.bayar || 0)}
📊 Status: ${shareStatus}
━━━━━━━━━━━━━━━━━━
${profilPerusahaan.nama}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Nota ${trx.nomorNota}`,
                    text: shareText,
                });
                toast.success('Berhasil dibagikan');
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    console.error('Share failed:', err);
                }
            }
        } else {
            // Fallback: Copy to clipboard
            try {
                await navigator.clipboard.writeText(shareText);
                toast.success('Teks nota disalin ke clipboard');
            } catch (err) {
                toast.error('Gagal menyalin teks');
                console.error(err);
            }
        }
    };

    const salesName = users.find(u => u.id === trx?.salesId)?.nama || 'Unknown';
    const customer = pelanggan.find(p => p.id === trx?.pelangganId);
    const branch = cabang.find(c => c.id === trx?.cabangId);
    const isAssociatedUser = isAdminOrOwner || trx?.salesId === currentUser?.id;

    if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Memuat nota...</div>;
    if (!trx) return <div className="p-8 text-center text-destructive">Nota tidak ditemukan.</div>;

    return (
        <MainLayout title={`Nota ${trx.nomorNota}`}>
            {/* Printable Receipt */}
            <div className={cn("hidden print:fixed print:top-0 print:left-0 print:w-full print:h-full print:bg-white print:z-[99999] print:p-0", showPrintReceipt ? 'print:block block' : 'hidden')}>
                <div className="w-[58mm] mx-auto p-4 text-black font-mono text-[10px] leading-tight">
                    <div className="text-center mb-4">
                        <h1 className="font-bold text-sm uppercase">{profilPerusahaan.nama}</h1>
                        <p className="text-[9px] leading-snug">{branch?.alamat || profilPerusahaan.alamat}</p>
                        <p className="text-[9px]">{branch?.telepon || profilPerusahaan.telepon}</p>
                    </div>

                    <div className="border-t border-black border-dashed my-2" />

                    <div className="space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>NOTA: {trx.nomorNota}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>TGL: {new Date(trx.tanggal).toLocaleDateString('id-ID')}</span>
                            <span>{new Date(trx.tanggal).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="flex justify-between uppercase">
                            <span>CS: {customer?.nama || 'UMUM'}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                            <span>STATUS:</span>
                            <span className="border border-black px-1">{trx.status.toUpperCase()}</span>
                        </div>
                    </div>

                    <div className="border-t border-black border-dashed my-2" />

                    <table className="w-full text-[10px]">
                        <tbody>
                            {trx.items.map((item, idx) => {
                                const product = barang.find(b => b.id === item.barangId);
                                const unit = satuan.find(s => s.id === item.satuanId);
                                return (
                                    <tr key={idx} className="align-top">
                                        <td colSpan={2} className="py-1">
                                            <div className="font-bold uppercase">{product?.nama || item.barangId}</div>
                                            <div className="flex justify-between pl-2">
                                                <span>{item.jumlah} {unit?.simbol} x {formatRupiah(item.harga).replace('Rp', '')}</span>
                                                <span className="font-bold">{formatRupiah(item.subtotal).replace('Rp', '')}</span>
                                            </div>
                                            {item.isBonus && <div className="text-[8px] font-bold italic pl-2">*** ITEM BONUS ***</div>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <div className="border-t border-black border-dashed my-2" />

                    <div className="space-y-1">
                        <div className="flex justify-between mt-1">
                            <span>SUBTOTAL</span>
                            <span>{formatRupiah(trx.total).replace('Rp', '')}</span>
                        </div>
                        <div className="flex justify-between font-bold text-xs">
                            <span>TOTAL</span>
                            <span>{formatRupiah(trx.total).replace('Rp', '')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>BAYAR ({trx.metodePembayaran.toUpperCase()})</span>
                            <span>{formatRupiah(paymentHistory.reduce((sum, p) => sum + Number(p.jumlah), 0)).replace('Rp', '')}</span>
                        </div>
                        {trx.metodePembayaran === 'tempo' && (
                            <div className="flex justify-between font-bold border-t border-black pt-1 mt-1">
                                <span>SISA PIUTANG</span>
                                <span>{formatRupiah(Math.max(0, trx.total - paymentHistory.reduce((sum, p) => sum + Number(p.jumlah), 0))).replace('Rp', '')}</span>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-black border-dashed my-4" />

                    <div className="flex flex-col items-center gap-3 text-center">
                        <div className="bg-white p-1 border border-black inline-block">
                            <QRCodeCanvas
                                value={`${trx.nomorNota}`}
                                size={60}
                                level="M"
                                includeMargin={false}
                            />
                        </div>
                        <div className="text-[8px] leading-tight uppercase">
                            <p className="font-bold">Terima kasih atas kunjungan Anda</p>
                            <p>Barang yang sudah dibeli tidak dapat dikembalikan</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Printable Invoice (A4/A5) */}
            <div className={cn("hidden print:fixed print:top-0 print:left-0 print:w-full print:h-full print:bg-white print:z-[99999] print:p-8", showPrintInvoice ? 'print:block block' : 'hidden')}>
                <div className="max-w-4xl mx-auto text-black font-sans text-xs relative">
                    {/* Invoice QR Code Top Right */}
                    <div className="absolute top-0 right-0 p-2 border bg-white flex flex-col items-center gap-1">
                        <QRCodeCanvas
                            value={`${trx.nomorNota}`}
                            size={70}
                            level="H"
                        />
                        <span className="text-[8px] font-bold text-gray-400 font-mono">{trx.nomorNota}</span>
                    </div>

                    <div className="flex justify-between items-start mb-8 pr-24">
                        <div>
                            <h1 className="text-3xl font-black text-primary uppercase mb-1">{profilPerusahaan.nama}</h1>
                            <p className="text-gray-600 max-w-sm leading-relaxed">{branch?.alamat || profilPerusahaan.alamat}</p>
                            <p className="text-gray-600 font-bold mt-1">Telp: {branch?.telepon || profilPerusahaan.telepon}</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-5xl font-black text-gray-100 uppercase mb-2">INVOICE</h2>
                            <div className="space-y-0.5">
                                <p className="font-black text-xl text-primary">{trx.nomorNota}</p>
                                <p className="text-gray-500 font-bold">{formatTanggal(trx.tanggal)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-12 mb-8">
                        <div>
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">PELANGGAN</h3>
                            <p className="text-sm font-black uppercase mb-1">{customer?.nama || 'UMUM'}</p>
                            <p className="text-gray-600">{customer?.alamat || '-'}</p>
                            <p className="text-gray-600">{customer?.telepon || '-'}</p>
                        </div>
                        <div className="text-right">
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">STATUS TRANSAKSI</h3>
                            <div className="space-y-1">
                                <p className="text-sm font-black uppercase">
                                    {trx.status} {trx.metodePembayaran === 'tempo' && (trx.isLunas ? '(LUNAS)' : '(BELUM LUNAS)')}
                                </p>
                                <p className="text-gray-600 uppercase">Metode: {trx.metodePembayaran}</p>
                            </div>
                        </div>
                    </div>

                    <table className="w-full mb-8 border-collapse">
                        <thead>
                            <tr className="border-y-2 border-black bg-gray-50">
                                <th className="py-3 text-left w-12 font-bold uppercase tracking-wider">#</th>
                                <th className="py-3 text-left font-bold uppercase tracking-wider">Deskripsi Produk</th>
                                <th className="py-3 text-center w-24 font-bold uppercase tracking-wider">Qty</th>
                                <th className="py-3 text-right w-32 font-bold uppercase tracking-wider">Harga</th>
                                <th className="py-3 text-right w-32 font-bold uppercase tracking-wider">Jumlah</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y border-b-2 border-black">
                            {trx.items.map((item, idx) => {
                                const product = barang.find(b => b.id === item.barangId);
                                const unit = satuan.find(s => s.id === item.satuanId);
                                return (
                                    <tr key={idx} className={item.isBonus ? "italic text-gray-500" : ""}>
                                        <td className="py-3 align-top">{idx + 1}</td>
                                        <td className="py-3">
                                            <p className="font-bold">{product?.nama || item.barangId}</p>
                                            <p className="text-[10px] text-gray-500">{product?.kode}</p>
                                            {item.isBonus && <p className="text-[9px] font-black text-blue-600 uppercase">*** ITEM BONUS PROMO ***</p>}
                                        </td>
                                        <td className="py-3 text-center">{item.jumlah} {unit?.simbol}</td>
                                        <td className="py-3 text-right">{formatRupiah(item.harga)}</td>
                                        <td className="py-3 text-right font-bold">{formatRupiah(item.subtotal)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <div className="flex justify-end gap-12">
                        <div className="w-64 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500 uppercase">Total Keseluruhan</span>
                                <span className="font-bold">{formatRupiah(trx.total)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 uppercase">Sudah Dibayar</span>
                                <span className="font-bold text-green-600">{formatRupiah(paymentHistory.reduce((sum, p) => sum + Number(p.jumlah), 0))}</span>
                            </div>
                            <div className="flex justify-between border-t-2 border-black pt-2 text-lg font-black">
                                <span className="uppercase">Sisa Piutang</span>
                                <span className="text-red-600">{formatRupiah(Math.max(0, trx.total - paymentHistory.reduce((sum, p) => sum + Number(p.jumlah), 0)))}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-20 grid grid-cols-2 gap-12 text-center">
                        <div className="space-y-20">
                            <p className="uppercase font-bold tracking-widest text-gray-400 text-[10px]">PENERIMA / PELANGGAN</p>
                            <p className="border-b border-black w-48 mx-auto"></p>
                        </div>
                        <div className="space-y-20">
                            <p className="uppercase font-bold tracking-widest text-gray-400 text-[10px]">HORMAT KAMI,</p>
                            <p className="border-b border-black w-48 mx-auto font-bold uppercase">{profilPerusahaan.nama}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Overlay Controls (Internal usage for auto-close) */}
            {(showPrintReceipt || showPrintInvoice) && (
                <div className="fixed inset-0 z-[10000] bg-white flex flex-col items-center justify-center p-8 print:hidden">
                    <div className="text-center space-y-4 max-w-xs">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Printer className="w-8 h-8 text-primary animate-pulse" />
                        </div>
                        <h2 className="text-xl font-bold">Menyiapkan Dokumen</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Sedang menyiapkan dokumen untuk dicetak. Dialog sistem akan muncul otomatis.
                        </p>
                        <div className="pt-4">
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                    setShowPrintReceipt(false);
                                    setShowPrintInvoice(false);
                                }}
                            >
                                Tutup / Batal
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 space-y-4 print:hidden max-w-4xl mx-auto">
                <Card className="overflow-hidden shadow-lg border-primary/20">
                    <CardHeader className="bg-gradient-to-br from-primary/10 via-background to-background pb-8 relative border-b">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="space-y-3 flex-1 w-full">
                                <div className="flex items-center gap-3">
                                    <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-primary">{trx.nomorNota}</h1>
                                    <div className={cn("px-4 py-1.5 rounded-full text-sm font-bold uppercase",
                                        trx.status === 'lunas' ? 'bg-green-100 text-green-700' :
                                            trx.status === 'batal' ? 'bg-red-100 text-red-700' :
                                                trx.status === 'draft' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-orange-100 text-orange-700'
                                    )}>
                                        {trx.status}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground text-sm">
                                    <div className="flex items-center gap-2 font-medium">
                                        <Calendar className="w-4 h-4 text-primary/60" />
                                        <span>{formatTanggal(trx.tanggal)}</span>
                                        <span className="opacity-60">{formatWaktu(trx.tanggal)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 font-medium">
                                        <User className="w-4 h-4 text-primary/60" />
                                        <span>{salesName}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                                <div className="flex flex-col items-end gap-1">
                                    {trx.metodePembayaran === 'tempo' && (
                                        <div className={cn("px-3 py-1 rounded text-xs font-black uppercase border",
                                            trx.isLunas ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'
                                        )}>
                                            {trx.isLunas ? 'Lunas' : 'Belum Lunas'}
                                        </div>
                                    )}
                                    <div className="text-2xl font-black text-right text-primary">
                                        {formatRupiah(trx.total)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="grid grid-cols-1 md:grid-cols-2">
                            <div className="p-6 border-b md:border-b-0 md:border-r space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Informasi Pelanggan</h3>
                                <div className="space-y-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <User className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold">{customer?.nama || 'UMUM'}</p>
                                            <p className="text-xs text-muted-foreground">{customer?.telepon || '-'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <MapPin className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-foreground/80 leading-relaxed">{customer?.alamat || '-'}</p>
                                            {trx.lokasi && (
                                                <a
                                                    href={`https://www.google.com/maps?q=${trx.lokasi.latitude},${trx.lokasi.longitude}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 text-[10px] text-blue-500 font-bold hover:underline mt-1 uppercase"
                                                >
                                                    <MapPin className="w-3 h-3" /> Lokasi Transaksi
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 space-y-4 bg-muted/5">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Status & Pembayaran</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Metode</p>
                                        <div className="flex items-center gap-2">
                                            <CreditCard className="w-4 h-4 text-primary" />
                                            <span className="text-sm font-bold uppercase">{trx.metodePembayaran}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Status</p>
                                        <Badge variant={trx.status === 'lunas' ? 'success' : trx.status === 'draft' ? 'warning' : 'destructive'} className="uppercase font-black animate-pulse-subtle">
                                            {trx.status}
                                        </Badge>
                                    </div>
                                </div>
                                <Separator />
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Total Item</span>
                                        <span className="font-bold">{trx.items.length} Macam</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Qty Keseluruhan</span>
                                        <span className="font-bold">{trx.items.reduce((s, i) => s + i.jumlah, 0)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mobile view for items */}
                        <div className="md:hidden divide-y">
                            {trx.items.map((item, idx) => {
                                const product = barang.find(b => b.id === item.barangId);
                                const unit = satuan.find(s => s.id === item.satuanId);
                                return (
                                    <div key={idx} className={cn("p-4 space-y-2", item.isBonus && "bg-blue-50/50")}>
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm">
                                                    {product?.nama || item.barangId}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground font-mono">
                                                    {product?.kode || '-'}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-sm">{formatRupiah(item.subtotal)}</div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="outline" className="h-5 px-1.5 font-bold">
                                                    {item.jumlah} {unit?.simbol}
                                                </Badge>
                                                <span className="text-muted-foreground">@ {formatRupiah(item.harga)}</span>
                                            </div>
                                            {item.diskon > 0 && (
                                                <span className="text-red-500 font-medium">Pot. {formatRupiah(item.diskon)}</span>
                                            )}
                                        </div>
                                        {item.isBonus && (
                                            <div className="text-[9px] font-black text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full w-fit uppercase flex items-center gap-1">
                                                <ShoppingBag className="w-3 h-3" /> Bonus Promo
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop view for items */}
                        <div className="hidden md:block overflow-x-auto border-y">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-[50px] text-center pl-6">#</TableHead>
                                        <TableHead>Nama Barang</TableHead>
                                        <TableHead className="text-center">Qty</TableHead>
                                        <TableHead className="text-right">Harga</TableHead>
                                        <TableHead className="text-right">Potongan</TableHead>
                                        <TableHead className="text-right pr-6">Subtotal</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {trx.items.map((item, idx) => {
                                        const product = barang.find(b => b.id === item.barangId);
                                        const unit = satuan.find(s => s.id === item.satuanId);
                                        return (
                                            <TableRow key={idx} className={cn("group", item.isBonus && "bg-blue-50/50")}>
                                                <TableCell className="text-center text-muted-foreground font-mono pl-6">{idx + 1}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold group-hover:text-primary transition-colors">
                                                            {product?.nama || item.barangId}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground font-mono bg-muted inline-block px-1 rounded w-fit">
                                                            {product?.kode || '-'}
                                                        </span>
                                                        {item.isBonus && (
                                                            <span className="text-[10px] font-black text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full mt-1 w-fit uppercase flex items-center gap-1">
                                                                <ShoppingBag className="w-3 h-3" /> Bonus Promo
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className="font-bold">{item.jumlah}</span>
                                                    <span className="text-xs text-muted-foreground ml-1">{unit?.simbol}</span>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs">{formatRupiah(item.harga)}</TableCell>
                                                <TableCell className="text-right font-mono text-xs text-red-500">
                                                    {item.diskon > 0 ? `-${formatRupiah(item.diskon)}` : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-bold pr-6 font-mono">{formatRupiah(item.subtotal)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="p-6 bg-muted/5">
                            <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                                <div className="flex-1 w-full max-w-sm space-y-4">
                                    {trx.catatan && (
                                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                                            <p className="text-[10px] font-bold text-yellow-800 uppercase mb-1 tracking-wider">Catatan</p>
                                            <p className="text-xs italic text-yellow-700 leading-relaxed">"{trx.catatan}"</p>
                                        </div>
                                    )}
                                </div>

                                <div className="w-full md:w-80 space-y-3">
                                    <div className="flex justify-between text-sm py-1">
                                        <span className="text-muted-foreground">Total Penjualan</span>
                                        <span className="font-bold font-mono">{formatRupiah(trx.total)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm py-1 border-t border-dashed">
                                        <span className="text-muted-foreground">Sudah Dibayar</span>
                                        <span className="font-bold font-mono text-green-600">
                                            {formatRupiah(paymentHistory.reduce((sum, p) => sum + Number(p.jumlah), 0))}
                                        </span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between items-center py-2">
                                        <span className="text-base font-black uppercase text-primary">Sisa Hutang</span>
                                        <span className="text-xl font-black font-mono text-red-600">
                                            {formatRupiah(Math.max(0, trx.total - paymentHistory.reduce((sum, p) => sum + Number(p.jumlah), 0)))}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4 bg-muted/30 border-t pt-6">
                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full justify-center">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 min-w-[100px]"
                                onClick={() => navigate('/penjualan')}
                            >
                                <ArrowLeft className="w-4 h-4 mr-2 sm:inline hidden" /> Kembali
                            </Button>

                            {trx.metodePembayaran === 'tempo' && !trx.isLunas && isAssociatedUser && (
                                <Button
                                    variant="default"
                                    size="sm"
                                    className="flex-1 min-w-[100px] bg-green-600 hover:bg-green-700"
                                    onClick={() => setIsRepaymentOpen(true)}
                                >
                                    <DollarSign className="w-4 h-4 mr-2 sm:inline hidden" /> Bayar Sisa
                                </Button>
                            )}

                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 min-w-[100px]"
                                onClick={handleShare}
                            >
                                <Share2 className="w-4 h-4 mr-2 sm:inline hidden" /> Bagikan
                            </Button>

                            <Button
                                variant="default"
                                size="sm"
                                className="flex-1 min-w-[100px]"
                                onClick={() => setIsPrintTypeOpen(true)}
                            >
                                <Printer className="w-4 h-4 mr-2 sm:inline hidden" /> Cetak
                            </Button>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end print:hidden gap-3 w-full">
                            {trx.status === 'draft' && (
                                <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90 order-1 sm:order-none" onClick={() => setIsFinalizeOpen(true)}>
                                    Selesaikan (Bukan Draft)
                                </Button>
                            )}
                            {trx.status !== 'batal' && isAssociatedUser && (
                                <Button variant="destructive" className="w-full sm:w-auto order-2 sm:order-none" onClick={() => setIsConfirmOpen(true)}>
                                    {trx.status === 'draft' ? "Batalkan Draft" : "Ajukan Pembatalan"}
                                </Button>
                            )}
                        </div>
                    </CardFooter>
                </Card>

                <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Riwayat Pembayaran</DialogTitle>
                        </DialogHeader>
                        <div className="py-2">
                            <div className="bg-muted/30 p-3 rounded-lg flex justify-between items-center mb-4">
                                <span className="text-sm text-muted-foreground">Total Tagihan</span>
                                <span className="font-bold">{formatRupiah(trx.total)}</span>
                            </div>
                            <h4 className="text-sm font-semibold mb-2">Daftar Pembayaran</h4>
                            <ScrollArea className="h-[200px] border rounded-md p-2">
                                {paymentHistory.length === 0 ? (
                                    <p className="text-center text-xs text-muted-foreground py-4">Belum ada pembayaran.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {paymentHistory.map((ph, idx) => (
                                            <div key={ph.id || idx} className="text-sm flex justify-between items-start border-b pb-2 last:border-0 border-dashed">
                                                <div>
                                                    <div className="flex items-center gap-1.5 font-medium">
                                                        <span>{formatTanggal(ph.tanggal)}</span>
                                                        <span className="text-xs text-muted-foreground font-normal">{formatWaktu(ph.tanggal)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5 capitalize">
                                                        {ph.metodePembayaran || 'Transfer'}
                                                    </div>
                                                </div>
                                                <span className="font-bold text-green-600">+{formatRupiah(ph.jumlah)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                            <div className="flex justify-between items-center mt-4 pt-2 border-t font-semibold">
                                <span>Total Terbayar</span>
                                <span className="text-green-600">{formatRupiah(paymentHistory.reduce((sum, p) => sum + Number(p.jumlah), 0) + (trx.bayar || 0))}</span>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog open={isRepaymentOpen} onOpenChange={setIsRepaymentOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Bayar Cicilan / Lunas</DialogTitle>
                            <DialogDescription>
                                Masukkan nominal pembayaran untuk pelunasan nota ini.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg">
                                <Label>Nominal Pembayaran</Label>
                                <Input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                                    className="w-40 text-right font-bold"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsRepaymentOpen(false)}>Batal</Button>
                            <Button onClick={() => setIsRepaymentConfirmOpen(true)} disabled={paymentAmount <= 0}>
                                Simpan Pembayaran
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <AlertDialog open={isRepaymentConfirmOpen} onOpenChange={setIsRepaymentConfirmOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Konfirmasi Pembayaran</AlertDialogTitle>
                            <AlertDialogDescription>
                                Simpan pembayaran sebesar {formatRupiah(paymentAmount)}?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={handleRepayment}>Ya, Simpan</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Konfirmasi Pembatalan</AlertDialogTitle>
                            <AlertDialogDescription>
                                Apakah Anda yakin ingin membatalkan transaksi ini?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-2 space-y-2">
                            <Label>Alasan Pembatalan</Label>
                            <Textarea
                                value={cancellationReason}
                                onChange={(e) => setCancellationReason(e.target.value)}
                                placeholder="Masukkan alasan..."
                            />
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleAjukanPembatalan}
                                disabled={isSubmitting || !cancellationReason.trim()}
                                className="bg-destructive text-destructive-foreground"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Ya, Batalkan
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={isFinalizeOpen} onOpenChange={setIsFinalizeOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Selesaikan Transaksi</AlertDialogTitle>
                            <AlertDialogDescription>
                                Pilih opsi tanggal untuk menyelesaikan transaksi draft ini.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                            <Button variant="outline" onClick={() => setIsFinalizeOpen(false)} className="w-full sm:w-auto">Batal</Button>
                            <Button variant="secondary" onClick={() => handleFinalize(false)} className="w-full sm:w-auto">Gunakan Tgl Draft</Button>
                            <Button onClick={() => handleFinalize(true)} className="w-full sm:w-auto">Ubah ke Hari Ini</Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <Dialog open={isPrintTypeOpen} onOpenChange={setIsPrintTypeOpen}>
                    <DialogContent className="max-w-[350px]">
                        <DialogHeader>
                            <DialogTitle>Pilih Format Cetak</DialogTitle>
                            <DialogDescription>Pilih jenis dokumen yang ingin Anda cetak.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 gap-3 py-4">
                            <Button
                                variant="outline"
                                className="h-20 flex flex-col gap-2 justify-center items-center border-2 hover:border-primary hover:bg-primary/5 transition-all"
                                onClick={() => {
                                    setIsPrintTypeOpen(false);
                                    setShowPrintReceipt(true);
                                    setTimeout(() => {
                                        window.print();
                                        setShowPrintReceipt(false);
                                    }, 300);
                                }}
                            >
                                <Printer className="w-6 h-6 text-primary" />
                                <div className="text-center">
                                    <p className="font-bold">Cetak Struk</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">Format Thermal 58mm</p>
                                </div>
                            </Button>
                            <Button
                                variant="outline"
                                className="h-20 flex flex-col gap-2 justify-center items-center border-2 hover:border-primary hover:bg-primary/5 transition-all"
                                onClick={() => {
                                    setIsPrintTypeOpen(false);
                                    setShowPrintInvoice(true);
                                    setTimeout(() => {
                                        window.print();
                                        setShowPrintInvoice(false);
                                    }, 300);
                                }}
                            >
                                <Receipt className="w-6 h-6 text-primary" />
                                <div className="text-center">
                                    <p className="font-bold">Cetak Invoice</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">Format Resmi A4/A5</p>
                                </div>
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </MainLayout>
    );
}
