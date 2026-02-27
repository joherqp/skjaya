import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download } from 'lucide-react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { getWeek, startOfWeek, endOfWeek, addWeeks, startOfYear, format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { createRoot } from 'react-dom/client';
import { PettyCashWeeklyPrintTemplate } from '@/components/laporan/PettyCashWeeklyPrintTemplate';

interface WeeklyPettyCashDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const WeeklyPettyCashDialog = ({ open, onOpenChange }: WeeklyPettyCashDialogProps) => {
    const { users, pettyCash, cabang, profilPerusahaan, viewMode } = useDatabase();
    const { user } = useAuth();
    
    const [reportYear, setReportYear] = useState(new Date().getFullYear());
    const [selectedWeekPC, setSelectedWeekPC] = useState(() => getWeek(new Date(), { weekStartsOn: 1 }));
    const [isGenerating, setIsGenerating] = useState(false);

    // Dynamic Data Availability
    const { availableYearsPC, availableWeeksPC } = useMemo(() => {
        const branchUsers = users.filter(u => {
            // Note: viewMode might need to be passed in or grabbed from context if it exists in useDatabase (it does in the original file)
            if (viewMode === 'me') return u.id === user?.id; // Assuming viewMode is available in useDatabase
            return u.cabangId === user?.cabangId;
        }).map(u => u.id);

        const relevantPC = pettyCash.filter(pc => branchUsers.includes(pc.createdBy));
        const allDates = relevantPC.map(pc => new Date(pc.tanggal));

        const years = Array.from(new Set(allDates.map(d => d.getFullYear()))).sort((a, b) => b - a);
        const weeks = Array.from(new Set(
            allDates
                .filter(d => d.getFullYear() === reportYear)
                .map(d => getWeek(d, { weekStartsOn: 1 }))
        )).sort((a, b) => b - a);

        return {
            availableYearsPC: years.length > 0 ? years : [new Date().getFullYear()],
            availableWeeksPC: weeks
        };
    }, [pettyCash, users, user, reportYear, viewMode]);

    // Update selection if invalid
    useEffect(() => {
        if (availableWeeksPC.length > 0 && !availableWeeksPC.includes(selectedWeekPC)) {
            setSelectedWeekPC(availableWeeksPC[0]);
        }
    }, [availableWeeksPC, selectedWeekPC]);

    const handleDownloadPettyCashPDF = async () => {
        setIsGenerating(true);
        try {
            // 1. Calculate Date Range for Annual Week
            const firstDayOfYear = startOfYear(new Date(reportYear, 0, 1));
            const sDate = startOfWeek(addWeeks(firstDayOfYear, selectedWeekPC - 1), { weekStartsOn: 1 });
            const eDate = endOfWeek(sDate, { weekStartsOn: 1 });
  
            // 2. Filter Transactions & Calculate Saldo Awal
            const branchUsers = users.filter(u => {
                if (viewMode === 'me') return u.id === user?.id;
                return u.cabangId === user?.cabangId;
            }).map(u => u.id);
            
            const filteredPC = pettyCash.filter(pc => {
                const d = new Date(pc.tanggal);
                const isOwner = branchUsers.includes(pc.createdBy);
                return d >= sDate && d <= eDate && isOwner;
            });
  
            const previousPC = pettyCash
              .filter(pc => {
                  const d = new Date(pc.tanggal);
                  const isOwner = branchUsers.includes(pc.createdBy);
                  return d < sDate && isOwner;
              })
              .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
            
            const saldoAwal = previousPC.length > 0 ? previousPC[0].saldoAkhir : 0;
  
            // 3. Render Template
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.top = '-9999px';
            container.style.left = '-9999px';
            document.body.appendChild(container);
  
            const root = createRoot(container);
            const currentCabang = cabang.find(c => c.id === user?.cabangId);
            const monthName = format(sDate, 'MMMM', { locale: localeId });
  
            await new Promise<void>((resolve) => {
                root.render(
                    <PettyCashWeeklyPrintTemplate 
                        id="pc-print-target"
                        week={selectedWeekPC}
                        monthName={monthName}
                        year={reportYear}
                        startDate={sDate}
                        endDate={eDate}
                        cabangName={currentCabang?.nama || 'Main Branch'}
                        companyProfile={profilPerusahaan}
                        transactions={filteredPC}
                        initialBalance={saldoAwal}
                    />
                );
                setTimeout(resolve, 1000); // Wait for images to load
            });
  
            const element = container.querySelector('#pc-print-target') as HTMLElement;
            if (element) {
                const canvas = await html2canvas(element, { scale: 1.5, useCORS: true, logging: false });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`Petty_Cash_W${selectedWeekPC}_${monthName}_${reportYear}.pdf`);
                toast.success('Laporan Petty Cash berhasil diunduh');
            } else {
                toast.error('Gagal merender laporan');
            }
  
            root.unmount();
            document.body.removeChild(container);
            onOpenChange(false); // Close dialog
        } catch (err) {
            console.error("PC Error:", err);
            toast.error('Terjadi kesalahan saat membuat laporan');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Laporan Mingguan Petty Cash</DialogTitle>
                    <DialogDescription>
                        Pilih tahun dan nomor minggu (1-52) yang ingin dicetak.
                        <br/>
                        <span className="text-[10px] text-muted-foreground">Catatan: Minggu berjalan belum bisa dicetak.</span>
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
                                    {availableYearsPC.map(y => (
                                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                         </div>
                         <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-400 flex justify-between">
                                <span>Pilih Week</span>
                                <span className="text-pink-600 font-black">W{selectedWeekPC}</span>
                            </label>
                            <div className="grid grid-cols-7 sm:grid-cols-9 gap-1 max-h-[160px] overflow-y-auto p-1 border rounded-md">
                                {availableWeeksPC.length === 0 ? (
                                    <div className="col-span-full py-4 text-center text-[10px] text-muted-foreground italic">
                                        Tidak ada data Petty Cash di tahun {reportYear}
                                    </div>
                                ) : (
                                    availableWeeksPC.map((w) => (
                                        <Button 
                                            key={w}
                                            variant={selectedWeekPC === w ? 'default' : 'outline'}
                                            size="sm"
                                            className="h-8 text-[9px] p-0"
                                            onClick={() => setSelectedWeekPC(w)}
                                        >
                                            {w}
                                        </Button>
                                    ))
                                )}
                            </div>
                         </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" className="text-xs h-9" onClick={() => onOpenChange(false)} disabled={isGenerating}>Batal</Button>
                    <Button className="text-xs h-9 bg-pink-600 hover:bg-pink-700" onClick={handleDownloadPettyCashPDF} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                        Cetak PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
