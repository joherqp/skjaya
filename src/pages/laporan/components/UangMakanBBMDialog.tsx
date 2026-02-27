import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download, CreditCard, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { getWeek, startOfWeek, endOfWeek, addWeeks, startOfYear, eachDayOfInterval, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { createRoot } from 'react-dom/client';
import { UangMakanBBMPrintTemplate } from '@/components/laporan/UangMakanBBMPrintTemplate';
import { formatRupiah } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface UangMakanBBMDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const UangMakanBBMDialog = ({ open, onOpenChange }: UangMakanBBMDialogProps) => {
    const { 
        absensi, reimburse, updateReimburse, addPettyCash,
        users, karyawan, pettyCash,
        viewMode, cabang, profilPerusahaan
    } = useDatabase();
    const { user } = useAuth();
    
    const [rateUangMakan, setRateUangMakan] = useState('30.000');
    const [isPaymentConfirmOpen, setIsPaymentConfirmOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'pettycash' | 'pusat'>('pettycash');
    
    const [selectedWeekUM, setSelectedWeekUM] = useState(() => getWeek(new Date(), { weekStartsOn: 1 }));
    const [reportYear, setReportYear] = useState(new Date().getFullYear());
    const [isGenerating, setIsGenerating] = useState(false);

    // Dynamic Data Availability
    const { availableYearsUM, availableWeeksUM } = useMemo(() => {
        const branchUsers = users.filter(u => {
            if (viewMode === 'me') return u.id === user?.id;
            return u.cabangId === user?.cabangId;
        }).map(u => u.id);
        
        const relevantAbsensi = absensi.filter(a => branchUsers.includes(a.userId) && a.status === 'hadir');
        const relevantReimburse = reimburse.filter(r => branchUsers.includes(r.userId) && (r.status === 'disetujui' || r.status === 'dibayar' || r.status === 'pending'));

        const allDates = [
            ...relevantAbsensi.map(a => new Date(a.tanggal)),
            ...relevantReimburse.map(r => new Date(r.tanggal))
        ];

        const years = Array.from(new Set(allDates.map(d => d.getFullYear()))).sort((a, b) => b - a);
        const weeks = Array.from(new Set(
            allDates
                .filter(d => d.getFullYear() === reportYear)
                .map(d => getWeek(d, { weekStartsOn: 1 }))
        )).sort((a, b) => b - a);

        return { 
            availableYearsUM: years.length > 0 ? years : [new Date().getFullYear()], 
            availableWeeksUM: weeks 
        };
    }, [absensi, reimburse, users, user, reportYear, viewMode]);

    // Update selections if invalid
    useEffect(() => {
        if (!availableYearsUM.includes(reportYear)) {
            setReportYear(availableYearsUM[0]);
        }
    }, [availableYearsUM, reportYear]);

    useEffect(() => {
        if (availableWeeksUM.length > 0 && !availableWeeksUM.includes(selectedWeekUM)) {
            setSelectedWeekUM(availableWeeksUM[0]);
        }
    }, [availableWeeksUM, selectedWeekUM]);

    // Check if paid
    const isAlreadyPaid = useMemo(() => {
        const branchUsers = users.filter(u => {
            if (viewMode === 'me') return u.id === user?.id;
            return u.cabangId === user?.cabangId;
        }).map(u => u.id);
        
        // Method 1: Check Petty Cash Entry
        const hasPCEntry = pettyCash.some(pc => {
            const pcYear = new Date(pc.tanggal).getFullYear();
            const weekRegex = new RegExp(`Week ${selectedWeekUM}\\b`);
            return branchUsers.includes(pc.createdBy) && 
                   pc.tipe === 'keluar' && 
                   pc.kategori === 'Gaji/Uang Makan' && 
                   weekRegex.test(pc.keterangan) &&
                   pcYear === reportYear;
        });

        if (hasPCEntry) return true;

        // Method 2: Check Paid Reimbursements
        const firstDayOfYear = startOfYear(new Date(reportYear, 0, 1));
        const sDate = startOfWeek(addWeeks(firstDayOfYear, selectedWeekUM - 1), { weekStartsOn: 1 });
        const eDate = endOfWeek(sDate, { weekStartsOn: 1 });

        const hasPaidReimburse = reimburse.some(r => {
            const d = new Date(r.tanggal);
            return d >= sDate && d <= eDate && 
                   branchUsers.includes(r.userId) && 
                   r.status === 'dibayar';
        });

        return hasPaidReimburse;
    }, [pettyCash, users, user, selectedWeekUM, reportYear, reimburse, viewMode]);

    // Check if has data
    const hasDataToPay = useMemo(() => {
        const firstDayOfYear = startOfYear(new Date(reportYear, 0, 1));
        const sDate = startOfWeek(addWeeks(firstDayOfYear, selectedWeekUM - 1), { weekStartsOn: 1 });
        const eDate = endOfWeek(sDate, { weekStartsOn: 1 });
        
        const branchUsers = users.filter(u => {
            if (viewMode === 'me') return u.id === user?.id;
            return u.cabangId === user?.cabangId;
        });
        
        const hasAbsensi = absensi.some(a => {
            const d = new Date(a.tanggal);
            return d >= sDate && d <= eDate && branchUsers.some(bu => bu.id === a.userId) && a.status === 'hadir';
        });

        const hasReimburse = reimburse.some(r => {
            const d = new Date(r.tanggal);
            return d >= sDate && d <= eDate && branchUsers.some(bu => bu.id === r.userId) && r.status === 'disetujui';
        });

        return hasAbsensi || hasReimburse;
    }, [reportYear, selectedWeekUM, users, user, absensi, reimburse, viewMode]);

    const getUangMakanBBMData = (sDate: Date, eDate: Date, rate: number) => {
        const branchUsers = users.filter(u => {
            if (viewMode === 'me') return u.id === user?.id;
            return u.cabangId === user?.cabangId;
        });
        const days = eachDayOfInterval({ start: sDate, end: eDate });
    
        const summary = branchUsers.map(u => {
          const emp = karyawan.find(k => k.id === u.karyawanId || k.nama === u.nama);
    
          const userAbsensi = absensi.filter(a => {
            const d = new Date(a.tanggal);
            return d >= sDate && d <= eDate && a.userId === u.id && a.status === 'hadir';
          });
    
          const userReimburse = reimburse.filter(r => {
            const d = new Date(r.tanggal);
            return d >= sDate && d <= eDate && r.userId === u.id && r.status === 'disetujui';
          });
    
          const totalReimburse = userReimburse.reduce((sum, r) => sum + r.jumlah, 0);
          const totalUangMakan = userAbsensi.length * rate;
    
          return {
            userId: u.id,
            nama: u.nama,
            posisi: emp?.posisi || 'Staff',
            hariKerja: userAbsensi.length,
            nominalUangMakan: totalUangMakan,
            nominalReimburse: totalReimburse,
            total: totalUangMakan + totalReimburse,
            reimburseIds: userReimburse.map(r => r.id)
          };
        }).filter(item => item.total > 0);
    
        const attendanceRecap = branchUsers.map(u => {
          const uAbs = absensi.filter(a => {
            const d = new Date(a.tanggal);
            return d >= sDate && d <= eDate && a.userId === u.id;
          });
    
          const statuses = days.map(d => {
            const record = uAbs.find(a => isSameDay(new Date(a.tanggal), d));
            if (!record) return '-';
            return record.status === 'hadir' ? 'M' : 'I';
          });
    
          return {
            nama: u.nama,
            statuses,
            total: statuses.filter(s => s === 'M').length
          };
        }).filter(row => row.total > 0);
    
        const reimburseLogs = reimburse.filter(r => {
          const d = new Date(r.tanggal);
          return d >= sDate && d <= eDate && 
                 (r.status === 'disetujui' || r.status === 'dibayar' || r.status === 'pending') &&
                 branchUsers.some(bu => bu.id === r.userId);
        }).map(r => ({
          tanggal: new Date(r.tanggal),
          nama: users.find(u => u.id === r.userId)?.nama || 'Unknown',
          kategori: r.kategori,
          keterangan: r.keterangan,
          jumlah: r.jumlah,
          status: r.status,
          buktiUrl: r.buktiUrl
        }));
    
        return { summary, attendanceRecap, reimburseLogs };
    };

    const handleDownloadUangMakanBBMPDF = async () => {
        setIsGenerating(true);
        try {
            const firstDayOfYear = startOfYear(new Date(reportYear, 0, 1));
            const sDate = startOfWeek(addWeeks(firstDayOfYear, selectedWeekUM - 1), { weekStartsOn: 1 });
            const eDate = endOfWeek(sDate, { weekStartsOn: 1 });
            const rate = parseInt(rateUangMakan.replace(/\D/g, '')) || 0;
  
            const data = getUangMakanBBMData(sDate, eDate, rate);
            if (data.summary.length === 0) {
                toast.info("Tidak ada data pengajuan untuk periode ini.");
                return;
            }
  
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.top = '-9999px';
            container.style.left = '-9999px';
            document.body.appendChild(container);
  
            const root = createRoot(container);
            const currentCabang = cabang.find(c => c.id === user?.cabangId);
            const days = eachDayOfInterval({ start: sDate, end: eDate });
  
            await new Promise<void>((resolve) => {
                root.render(
                    <UangMakanBBMPrintTemplate 
                        id="umbbm-print-target"
                        week={selectedWeekUM}
                        year={reportYear}
                        startDate={sDate}
                        endDate={eDate}
                        cabangName={currentCabang?.nama || 'Main Branch'}
                        companyProfile={profilPerusahaan!}
                        data={data.summary}
                        rateUangMakan={rate}
                        attendanceRecap={data.attendanceRecap}
                        reimburseLogs={data.reimburseLogs}
                        daysOfWeek={days}
                    />
                );
                setTimeout(resolve, 1000);
            });
  
            const element = container.querySelector('#umbbm-print-target') as HTMLElement;
            if (element) {
                const canvas = await html2canvas(element, { scale: 1.5, useCORS: true, logging: false });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`Pengajuan_UM_BBM_W${selectedWeekUM}_${reportYear}.pdf`);
                toast.success('Pengajuan Uang Makan & BBM berhasil diunduh');
            }
  
            root.unmount();
            document.body.removeChild(container);
        } catch (err) {
            console.error("UM BBM Error:", err);
            toast.error('Gagal membuat laporan');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleProcessUangMakanBBMPayment = async () => {
        setIsGenerating(true);
        try {
            const firstDayOfYear = startOfYear(new Date(reportYear, 0, 1));
            const sDate = startOfWeek(addWeeks(firstDayOfYear, selectedWeekUM - 1), { weekStartsOn: 1 });
            const eDate = endOfWeek(sDate, { weekStartsOn: 1 });
            const rate = parseInt(rateUangMakan.replace(/\D/g, '')) || 0;
  
            const data = getUangMakanBBMData(sDate, eDate, rate);
            
            let totalDisbursement = 0;
            let reimburseCount = 0;
  
            for (const item of data.summary) {
                // 1. Mark Reimbursements as Paid
                for (const rid of item.reimburseIds) {
                    await updateReimburse(rid, { 
                        status: 'dibayar', 
                        dibayarPada: new Date(),
                        metodePembayaran: paymentMethod === 'pettycash' ? 'pettycash' : 'transfer'
                    });
                    reimburseCount++;
                }
                totalDisbursement += item.total;
            }
  
            if (totalDisbursement > 0) {
                if (paymentMethod === 'pettycash') {
                    // 2. Add Petty Cash Expense
                    await addPettyCash({
                        tanggal: new Date(),
                        tipe: 'keluar',
                        kategori: 'Gaji/Uang Makan',
                        keterangan: `Bayar Uang Makan & Reimburse Week ${selectedWeekUM} (${data.summary.length} Orang)`,
                        jumlah: totalDisbursement,
                        createdBy: user?.id || 'system'
                    });
                }
  
                toast.success(`Berhasil memproses pembayaran ${formatRupiah(totalDisbursement)} untuk ${data.summary.length} karyawan via ${paymentMethod === 'pettycash' ? 'Kas Kecil' : 'Pusat Langsung'}.`);
                setIsPaymentConfirmOpen(false);
                onOpenChange(false);
            } else {
                toast.info("Tidak ada transaksi untuk diproses.");
                setIsPaymentConfirmOpen(false);
            }
        } catch (err) {
            console.error("Payment Error:", err);
            toast.error('Gagal memproses pembayaran');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Pengajuan Uang Makan & BBM</DialogTitle>
                        <DialogDescription>
                            Integrasi data Absensi (Uang Makan) dan Reimburse (BBM).
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        <div className="flex flex-col gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-slate-400">Pilih Tahun</label>
                                <Select value={reportYear.toString()} onValueChange={(v) => setReportYear(parseInt(v))}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Pilih Tahun" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableYearsUM.map(y => (
                                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-slate-400 flex justify-between">
                                    <span>Pilih Week</span>
                                    <span className="text-orange-600 font-black">W{selectedWeekUM}</span>
                                </label>
                                <div className="grid grid-cols-7 sm:grid-cols-9 gap-1 max-h-[160px] overflow-y-auto p-1 border rounded-md">
                                    {availableWeeksUM.length === 0 ? (
                                        <div className="col-span-full py-4 text-center text-[10px] text-muted-foreground italic">
                                            Tidak ada data pengajuan di tahun {reportYear}
                                        </div>
                                    ) : (
                                        availableWeeksUM.map((w) => (
                                            <Button 
                                                key={w}
                                                variant={selectedWeekUM === w ? 'default' : 'outline'}
                                                size="sm"
                                                className="h-8 text-[9px] p-0"
                                                onClick={() => setSelectedWeekUM(w)}
                                            >
                                                {w}
                                            </Button>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="rate-um" className="text-xs font-bold uppercase text-slate-400">Rate Uang Makan (Rp/Hari)</Label>
                            <Input 
                                id="rate-um"
                                type="text"
                                inputMode="numeric"
                                value={rateUangMakan}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    const formatted = val ? new Intl.NumberFormat('id-ID').format(Number(val)) : '';
                                    setRateUangMakan(formatted);
                                }}
                            />
                        </div>

                        {/* Payment Status Indicator */}
                        {isAlreadyPaid && (
                            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md text-green-700">
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="text-xs font-medium">Periode ini sudah dibayarkan.</span>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button 
                            variant="secondary" 
                            className="text-xs h-9 w-full sm:w-auto" 
                            onClick={() => setIsPaymentConfirmOpen(true)}
                            disabled={!hasDataToPay || isAlreadyPaid || isGenerating}
                        >
                            <CreditCard className="w-4 h-4 mr-2" />
                            Bayar
                        </Button>
                        <div className="flex gap-2 w-full sm:w-auto">
                           <Button variant="outline" className="text-xs h-9 flex-1" onClick={() => onOpenChange(false)} disabled={isGenerating}>Batal</Button>
                           <Button className="text-xs h-9 bg-orange-600 hover:bg-orange-700 flex-1" onClick={handleDownloadUangMakanBBMPDF} disabled={isGenerating}>
                                {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                PDF
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Payment Confirmation Dialog */}
            <AlertDialog open={isPaymentConfirmOpen} onOpenChange={setIsPaymentConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Konfirmasi Pembayaran</AlertDialogTitle>
                        <AlertDialogDescription>
                            Anda akan memproses pembayaran Uang Makan & BBM untuk <strong>Week {selectedWeekUM}</strong>.
                            <br/><br/>
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-xs flex gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                    Aksi ini akan:
                                    <ul className="list-disc ml-4 mt-1 space-y-1">
                                        <li>Mengubah status Reimburse menjadi 'Dibayar'</li>
                                        <li>Mencatat pengeluaran di Kas Kecil (jika pilih Kas Kecil)</li>
                                        <li>Tidak dapat dibatalkan secara otomatis</li>
                                    </ul>
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-4">
                        <Label className="mb-2 block">Metode Pembayaran</Label>
                        <RadioGroup value={paymentMethod} onValueChange={(v: 'pettycash' | 'pusat') => setPaymentMethod(v)}>
                            <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                                <RadioGroupItem value="pettycash" id="pc" />
                                <Label htmlFor="pc" className="flex items-center gap-2 cursor-pointer flex-1">
                                    <Wallet className="w-4 h-4 text-pink-500" />
                                    <span>Kas Kecil Cabang</span>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                                <RadioGroupItem value="pusat" id="pusat" />
                                <Label htmlFor="pusat" className="flex items-center gap-2 cursor-pointer flex-1">
                                    <CreditCard className="w-4 h-4 text-blue-500" />
                                    <span>Transfer Pusat</span>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isGenerating}>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); handleProcessUangMakanBBMPayment(); }} disabled={isGenerating} className="bg-green-600 hover:bg-green-700">
                            {isGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Proses Pembayaran
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
