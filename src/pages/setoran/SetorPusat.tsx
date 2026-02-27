import { useState, useMemo, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  ArrowLeft,
  Calendar as CalendarIcon, Banknote, CreditCard, 
  Plus, Trash2, Upload, X, Save, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatRupiah, cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, isSameDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DateRange } from 'react-day-picker';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/imageCompression';

const PECAHAN = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];

type TransferItem = {
  id: string;
  bankId: string;
  amount: number;
  proofFile: File | null;
  proofPreview: string | null;
};

type CashItem = {
  denom: number;
  count: number;
};

export default function SetorPusat() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addPersetujuan, rekeningBank, users, penjualan, addNotifikasi, persetujuan } = useDatabase();
  
  // DATE STATE
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // TRANSACTION STATE
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [cashItems, setCashItems] = useState<CashItem[]>([]);
  const [notes, setNotes] = useState('');
  const [generalProof, setGeneralProof] = useState<{ url: string; preview: string; file: File | null } | null>(null);
  const [isGeneralUploading, setIsGeneralUploading] = useState(false);
  
  // DIALOG STATE
  const [isAddCashOpen, setIsAddCashOpen] = useState(false);
  const [tempCashDenom, setTempCashDenom] = useState<string>('');
  
  // Use string for inputs to handle "1.000" formatting
  const [tempCashCountDisplay, setTempCashCountDisplay] = useState<string>('');

  const [isAddTransferOpen, setIsAddTransferOpen] = useState(false);
  const [tempTransferBank, setTempTransferBank] = useState<string>('');
  const [tempTransferAmountDisplay, setTempTransferAmountDisplay] = useState<string>('');

  // HELPER: Number Formatter
  const handleAmountChange = (value: string, setter: (val: string) => void) => {
      // Remove non-digits
      const raw = value.replace(/\D/g, '');
      if (!raw) {
          setter('');
          return;
      }
      const num = parseInt(raw, 10);
      setter(num.toLocaleString('id-ID'));
  };

  const getRawNumber = (formatted: string) => {
      return parseInt(formatted.replace(/\./g, ''), 10) || 0;
  };

  // 1. DATA PREPARATION: SALES & DATES
  const { availableDates, branchSales } = useMemo(() => {
     if (!user?.cabangId) return { availableDates: [], branchSales: [] };

     // Filter "Global Cabang" sales
     const filtered = penjualan.filter(p => 
        p.cabangId === user.cabangId &&
        p.status === 'lunas' // Match report: only finished sales
     );

     // Group by Date for Logic
     const salesByDate = new Map<string, number>();
     filtered.forEach(p => {
         const d = new Date(p.tanggal).toISOString().split('T')[0];
         salesByDate.set(d, (salesByDate.get(d) || 0) + p.total);
     });

     const datesWithSales = Array.from(salesByDate.keys()).map(d => new Date(d));
     
     return { availableDates: datesWithSales, branchSales: filtered };
  }, [penjualan, user?.cabangId]);

  // 2. DATA PREPARATION: SETTLED DATES (APPROVED or PENDING)
  const settledDates = useMemo(() => {
    if (!user?.cabangId || !persetujuan) return new Set<string>();

    const settled = new Set<string>();
    
     // Filter persetujuan for relevant central deposits (RE-ENABLE IF REJECTED)
     const relevantPersetujuan = (persetujuan || []).filter(p => {
        const pData = p.data as { senderCabangId?: string };
        return p.jenis === 'rencana_setoran' && 
        p.status !== 'ditolak' && 
        pData?.senderCabangId === user.cabangId;
     });

    relevantPersetujuan.forEach(p => {
       const pData = p.data as { startDate?: string | Date; endDate?: string | Date };
       if (pData?.startDate && pData?.endDate) {
          const start = new Date(pData.startDate);
          const end = new Date(pData.endDate);
          
          // Normalize
          const current = new Date(start);
          current.setHours(0,0,0,0);
          const stop = new Date(end);
          stop.setHours(0,0,0,0);

          while (current <= stop) {
             settled.add(current.toISOString().split('T')[0]);
             current.setDate(current.getDate() + 1);
          }
       }
    });

    return settled;
  }, [persetujuan, user?.cabangId]);

  // 3. CALCULATE TARGET TOTAL
  const targetTotal = useMemo(() => {
      if (!dateRange?.from) return 0;
      
      const start = dateRange.from;
      const end = dateRange.to || dateRange.from; // Single day fallback

      // Normalize
      const s = new Date(start); s.setHours(0,0,0,0);
      const e = new Date(end); e.setHours(23,59,59,999);

      const relevantSales = branchSales.filter(p => {
          const d = new Date(p.tanggal);
          return d >= s && d <= e;
      });

      return relevantSales.reduce((sum, p) => sum + p.total, 0);
  }, [dateRange, branchSales]);

  // 4. TOTALS
  const totalTransfer = transferItems.reduce((sum, item) => sum + item.amount, 0);
  const totalCash = cashItems.reduce((sum, item) => sum + (item.denom * item.count), 0);
  const currentTotal = totalTransfer + totalCash;
  const variance = currentTotal - targetTotal;

  // HANDLERS
  const handleAddTransfer = () => {
      const amount = getRawNumber(tempTransferAmountDisplay);
      if (!tempTransferBank || amount <= 0) return;

      const newItem: TransferItem = {
          id: crypto.randomUUID(),
          bankId: tempTransferBank,
          amount: amount,
          proofFile: null,
          proofPreview: null
      };
      setTransferItems([...transferItems, newItem]);
      setTempTransferBank('');
      setTempTransferAmountDisplay('');
      setIsAddTransferOpen(false);
  };

  const handleRemoveTransfer = (id: string) => {
      setTransferItems(prev => prev.filter(i => i.id !== id));
  };

  const handleUploadProof = (id: string, file: File) => {
      const url = URL.createObjectURL(file);
      if (id === 'general') {
          setGeneralProof({ url: '', preview: url, file: file });
          return;
      }
      setTransferItems(prev => prev.map(item => {
          if (item.id === id) {
              return { ...item, proofFile: file, proofPreview: url };
          }
          return item;
      }));
  };

  const handleAddCash = () => {
      const denom = Number(tempCashDenom);
      const count = getRawNumber(tempCashCountDisplay);
      
      if (!tempCashDenom || count <= 0) return;

      setCashItems(prev => {
          // Merge if existing
          const existing = prev.find(i => i.denom === denom);
          if (existing) {
              return prev.map(i => i.denom === denom ? { ...i, count: i.count + count } : i);
          }
          return [...prev, { denom, count }].sort((a,b) => b.denom - a.denom);
      });
      
      setTempCashDenom('');
      setTempCashCountDisplay('');
      setIsAddCashOpen(false);
  };

  const handleRemoveCash = (denom: number) => {
       setCashItems(prev => prev.filter(i => i.denom !== denom));
  };

  const pusatAccounts = rekeningBank.filter(b => {
      const owner = users.find(u => u.id === b.assignedUserId);
      return owner && (owner.roles.includes('admin') || owner.roles.includes('owner'));
  });

  /* CONFIRMATION DIALOG STATE */
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Validate and Open Dialog
  const handleSubmit = () => {
      if (variance !== 0) {
          toast.error("Total setoran tidak sesuai dengan total penjualan");
          return;
      }
      if (currentTotal === 0) {
           toast.error("Belum ada nominal setoran");
           return;
      }
      setIsConfirmOpen(true);
  };

  // 2. Process Final Submission
  const handleFinalSubmit = async () => {
      setIsSubmitting(true);
      
      try {
          // 1. UPLOAD PROOFS (Transfer & General)
          const uploadImage = async (file: File) => {
              const compressed = await compressImage(file);
              const fileExt = compressed.name.split('.').pop();
              const fileName = `setoran-pusat-${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
              const { error } = await supabase.storage.from('bukti-setoran').upload(fileName, compressed);
              if (error) throw error;
              const { data: { publicUrl } } = supabase.storage.from('bukti-setoran').getPublicUrl(fileName);
              return publicUrl;
          };

          const transferWithUrls = await Promise.all(transferItems.map(async (t) => {
              let url = t.proofPreview || '';
              if (t.proofFile) {
                  url = await uploadImage(t.proofFile);
              }
              return { bankId: t.bankId, amount: t.amount, proofUrl: url };
          }));

          let generalUrl = generalProof?.url || '';
          if (generalProof?.file) {
              generalUrl = await uploadImage(generalProof.file);
          }

          // 2. CONSTRUCT PAYLOAD
          const payload = {
              startDate: dateRange?.from,
              endDate: dateRange?.to || dateRange?.from,
              totalSales: targetTotal,
              amount: currentTotal,
              transferAmount: totalTransfer,
              cashAmount: totalCash,
              pecahan: cashItems.reduce((acc, curr) => ({ ...acc, [curr.denom]: curr.count }), {} as Record<number,number>),
              rekeningTujuanId: transferItems[0]?.bankId, 
              transfers: transferWithUrls,
              generalProofUrl: generalUrl,
              senderCabangId: user?.cabangId,
          };

          // 3. SUBMIT TO DATABASE
          await addPersetujuan({
              id: crypto.randomUUID(),
              jenis: 'rencana_setoran', 
              referensiId: crypto.randomUUID(),
              status: 'pending',
              targetRole: 'admin',
              diajukanOleh: user?.id || 'system',
              tanggalPengajuan: new Date(),
              catatan: notes,
              data: payload
          });

          // 4. NOTIFICATIONS
          const admins = users.filter(u => u.roles.includes('admin') || u.roles.includes('owner'));
          if (admins.length > 0) {
              const notifPromises = admins.map(admin => 
                  addNotifikasi({
                      judul: 'Setoran Baru (Pusat)',
                      pesan: `${user?.nama || 'Sales'} mengajukan setoran ke pusat sebesar ${formatRupiah(currentTotal)}`,
                      jenis: 'info',
                      userId: admin.id,
                      dibaca: false,
                      tanggal: new Date(),
                      link: '/persetujuan'
                  })
              );
              await Promise.all(notifPromises);
          }

          toast.success("Setoran ke pusat telah diajukan");
          setIsConfirmOpen(false);
          navigate('/setoran');

      } catch (error: unknown) {
          console.error("Submission error:", error);
          const message = error instanceof Error ? error.message : "Terjadi kesalahan";
          toast.error("Gagal mengajukan setoran: " + message);
      } finally {
          setIsSubmitting(false);
      }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);

  const triggerUpload = (id: string) => {
      setActiveUploadId(id);
      fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0] && activeUploadId) {
          handleUploadProof(activeUploadId, e.target.files[0]);
      }
      setActiveUploadId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };


  return (
    <MainLayout title="Setor ke Pusat">
      <div className="p-4 max-w-3xl mx-auto space-y-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/setoran')}
            className="-ml-2 pl-0 text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>

          <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={onFileChange} 
          />

          <div className="grid gap-6 md:grid-cols-[1fr,320px]">
             {/* LEFT COLUMN */}
             <div className="space-y-6">
                 
                 {/* 1. DATE PICKER */}
                 <Card>
                     <CardHeader className="pb-3 border-b">
                         <CardTitle className="text-base flex items-center gap-2">
                             <CalendarIcon className="w-4 h-4 text-primary" />
                             Periode Penjualan
                         </CardTitle>
                     </CardHeader>
                     <CardContent className="p-4">
                         <div className="flex flex-col gap-4">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("justify-start text-left font-normal", !dateRange?.from && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>
                                                 {format(dateRange.from, "d MMM yyyy", { locale: id })} -{" "}
                                                 {format(dateRange.to, "d MMM yyyy", { locale: id })}
                                                </>
                                            ) : format(dateRange.from, "d MMM yyyy", { locale: id })
                                        ) : <span>Pilih Tanggal</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="range"
                                        defaultMonth={dateRange?.from}
                                        selected={dateRange}
                                        onSelect={(range) => setDateRange(range || undefined)}
                                        numberOfMonths={1}
                                        disabled={(date) => {
                                             // Normalize current date for comparison
                                             const dateStr = date.toISOString().split('T')[0];
                                             
                                             // Disable if date is not in availableDates list (No Sales)
                                             const isHasSales = availableDates.some(d => isSameDay(d, date));
                                             // Also disable future dates
                                             const isFuture = date > new Date();
                                             // Disable if already settled/pending
                                             const isSettled = settledDates.has(dateStr);
                                             
                                             return !isHasSales || isFuture || isSettled;
                                        }}
                                    />
                                </PopoverContent>
                            </Popover>
                            
                            {targetTotal > 0 && (
                                <div className="bg-primary/5 p-3 rounded-md border border-primary/10 flex justify-between items-center">
                                    <span className="text-sm font-medium">Total Penjualan</span>
                                    <span className="text-lg font-bold text-primary">{formatRupiah(targetTotal)}</span>
                                </div>
                            )}
                         </div>
                     </CardContent>
                 </Card>

                 {/* 2. UANG TUNAI (Now Second/First of data) */}
                 <Card>
                     <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                         <CardTitle className="text-base flex items-center gap-2">
                             <Banknote className="w-4 h-4 text-emerald-600" />
                             Uang Tunai
                         </CardTitle>
                         <Dialog open={isAddCashOpen} onOpenChange={setIsAddCashOpen}>
                             <DialogTrigger asChild>
                                 <Button size="sm" variant="outline" className="h-8 gap-1">
                                     <Plus className="w-3.5 h-3.5" /> Tambah
                                 </Button>
                             </DialogTrigger>
                             <DialogContent>
                                 <DialogHeader>
                                     <DialogTitle>Tambah Pecahan</DialogTitle>
                                     <DialogDescription>
                                         Masukkan jumlah lembar atau keping untuk pecahan mata uang tertentu.
                                     </DialogDescription>
                                 </DialogHeader>
                                 <div className="space-y-4 py-2">
                                     <div className="space-y-2">
                                         <Label>Pecahan</Label>
                                         <Select value={tempCashDenom} onValueChange={setTempCashDenom}>
                                             <SelectTrigger>
                                                 <SelectValue placeholder="Pilih Nominal..." />
                                             </SelectTrigger>
                                             <SelectContent>
                                                 {PECAHAN.map(p => (
                                                     <SelectItem key={p} value={p.toString()}>
                                                         {formatRupiah(p)}
                                                     </SelectItem>
                                                 ))}
                                             </SelectContent>
                                         </Select>
                                     </div>
                                     <div className="space-y-2">
                                         <Label>Jumlah Lembar/Keping</Label>
                                         <Input 
                                             type="text" 
                                             inputMode="numeric"
                                             placeholder="0" 
                                             value={tempCashCountDisplay} 
                                             onChange={e => handleAmountChange(e.target.value, setTempCashCountDisplay)} 
                                         />
                                     </div>
                                 </div>
                                 <DialogFooter>
                                     <Button onClick={handleAddCash} disabled={!tempCashDenom || !tempCashCountDisplay}>Simpan</Button>
                                 </DialogFooter>
                             </DialogContent>
                         </Dialog>
                     </CardHeader>
                     <CardContent className="p-4 space-y-3">
                         {cashItems.length === 0 ? (
                             <p className="text-sm text-muted-foreground text-center py-4 italic">Belum ada pecahan tunai</p>
                         ) : (
                             <div className="space-y-2">
                                 {cashItems.map((item) => (
                                     <div key={item.denom} className="flex items-center justify-between p-2 rounded bg-muted/20 text-sm">
                                         <div className="flex items-center gap-3">
                                             <span className="font-medium min-w-[80px]">{formatRupiah(item.denom)}</span>
                                             <span className="text-muted-foreground">x {item.count}</span>
                                         </div>
                                         <div className="flex items-center gap-3">
                                             <span className="font-semibold">{formatRupiah(item.denom * item.count)}</span>
                                             <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveCash(item.denom)}>
                                                 <X className="w-3.5 h-3.5" />
                                             </Button>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         )}
                          {cashItems.length > 0 && (
                             <div className="pt-2 flex justify-between font-medium border-t mt-2">
                                 <span>Subtotal Tunai</span>
                                 <span>{formatRupiah(totalCash)}</span>
                             </div>
                         )}
                     </CardContent>
                 </Card>

                 {/* 3. TRANSAKSI TRANSFER */}
                 <Card>
                     <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                         <CardTitle className="text-base flex items-center gap-2">
                             <CreditCard className="w-4 h-4 text-blue-600" />
                             Transfer Bank
                         </CardTitle>
                         <Dialog open={isAddTransferOpen} onOpenChange={setIsAddTransferOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="h-8 gap-1">
                                    <Plus className="w-3.5 h-3.5" /> Tambah
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                 <DialogHeader>
                                     <DialogTitle>Tambah Transfer</DialogTitle>
                                     <DialogDescription>
                                         Masukkan detail transfer bank ke rekening tujuan pusat.
                                     </DialogDescription>
                                 </DialogHeader>
                                <div className="space-y-4 py-2">
                                     <div className="space-y-2">
                                         <Label>Rekening Tujuan</Label>
                                         <Select value={tempTransferBank} onValueChange={setTempTransferBank}>
                                             <SelectTrigger>
                                                 <SelectValue placeholder="Pilih Bank..." />
                                             </SelectTrigger>
                                             <SelectContent>
                                                 {pusatAccounts.map((acc) => (
                                                     <SelectItem key={acc.id} value={acc.id}>
                                                         {acc.namaBank} - {acc.atasNama}
                                                     </SelectItem>
                                                 ))}
                                             </SelectContent>
                                         </Select>
                                     </div>
                                     <div className="space-y-2">
                                         <div className="flex justify-between items-center">
                                            <Label>Nominal (Rp)</Label>
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-6 text-xs text-blue-600 hover:text-blue-800 px-2"
                                                onClick={() => {
                                                    const remaining = Math.max(0, targetTotal - currentTotal);
                                                    setTempTransferAmountDisplay(remaining.toLocaleString('id-ID'));
                                                }}
                                            >
                                                Max: {formatRupiah(Math.max(0, targetTotal - currentTotal))}
                                            </Button>
                                         </div>
                                         <Input 
                                             type="text" 
                                             inputMode="numeric"
                                             placeholder="0" 
                                             value={tempTransferAmountDisplay} 
                                             onChange={e => handleAmountChange(e.target.value, setTempTransferAmountDisplay)} 
                                         />
                                     </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleAddTransfer} disabled={!tempTransferBank || !tempTransferAmountDisplay}>Simpan</Button>
                                </DialogFooter>
                            </DialogContent>
                         </Dialog>
                     </CardHeader>
                     <CardContent className="p-4 space-y-3">
                         {transferItems.length === 0 ? (
                             <p className="text-sm text-muted-foreground text-center py-4 italic">Belum ada data transfer</p>
                         ) : (
                             transferItems.map((item, idx) => {
                                 const bank = rekeningBank.find(r => r.id === item.bankId);
                                 return (
                                     <div key={item.id} className="flex flex-col gap-3 p-3 border rounded-lg bg-muted/20">
                                         <div className="flex justify-between items-start">
                                             <div>
                                                 <p className="font-semibold text-sm">{bank?.namaBank} - {bank?.atasNama}</p>
                                                 <p className="text-blue-600 font-bold">{formatRupiah(item.amount)}</p>
                                             </div>
                                             <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveTransfer(item.id)}>
                                                 <Trash2 className="w-3.5 h-3.5" />
                                             </Button>
                                         </div>
                                         
                                         {/* PROOF UPLOAD */}
                                         <div className="flex items-center gap-3 mt-1">
                                             {item.proofPreview ? (
                                                 <div className="relative group w-16 h-16 rounded overflow-hidden border">
                                                     <img src={item.proofPreview} alt="Bukti" className="w-full h-full object-cover" />
                                                     <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center cursor-pointer" onClick={() => triggerUpload(item.id)}>
                                                         <Upload className="w-4 h-4 text-white" />
                                                     </div>
                                                 </div>
                                             ) : (
                                                 <Button variant="outline" size="sm" className="h-8 gap-2 w-full border-dashed" onClick={() => triggerUpload(item.id)}>
                                                     <Upload className="w-3.5 h-3.5" /> Upload Bukti
                                                 </Button>
                                             )}
                                         </div>
                                     </div>
                                 );
                             })
                         )}
                         {transferItems.length > 0 && (
                             <div className="pt-2 flex justify-between font-medium border-t">
                                 <span>Subtotal Transfer</span>
                                 <span>{formatRupiah(totalTransfer)}</span>
                             </div>
                         )}
                     </CardContent>
                 </Card>

                 <div className="space-y-4 pt-4 border-t">
                     <div className="space-y-2">
                         <Label>Catatan</Label>
                         <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Tambahkan catatan jika perlu..." />
                     </div>

                     <div className="space-y-2">
                         <Label>Bukti Setoran Umum (Optional)</Label>
                         <div className="flex items-center gap-4">
                             {generalProof ? (
                                 <div className="relative group w-24 h-24 rounded-lg overflow-hidden border shadow-sm">
                                     <img src={generalProof.preview} alt="General Proof" className="w-full h-full object-cover" />
                                     <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center cursor-pointer" onClick={() => setGeneralProof(null)}>
                                         <X className="w-5 h-5 text-white" />
                                     </div>
                                 </div>
                             ) : (
                                 <Button 
                                    variant="outline" 
                                    className="h-24 w-full border-dashed flex flex-col gap-2 text-muted-foreground"
                                    onClick={() => triggerUpload('general')}
                                    disabled={isGeneralUploading}
                                 >
                                    <Upload className="w-6 h-6" />
                                    <span>{isGeneralUploading ? "Uploading..." : "Upload Bukti Umum (Nota/Tunai)"}</span>
                                 </Button>
                             )}
                         </div>
                     </div>
                 </div>
             </div>

             {/* SUMMARY COLUMN */}
             <div className="space-y-6">
                 <Card className="sticky top-4 border-2 border-primary/10 shadow-lg">
                     <CardHeader className="bg-primary/5 pb-4">
                         <CardTitle className="text-lg">Ringkasan</CardTitle>
                     </CardHeader>
                     <CardContent className="p-4 space-y-4">
                         <div className="space-y-2 text-sm">
                             <div className="flex justify-between">
                                 <span className="text-muted-foreground">Total Penjualan</span>
                                 <span className="font-medium">{formatRupiah(targetTotal)}</span>
                             </div>
                             <div className="flex justify-between">
                                 <span className="text-muted-foreground">Total Setoran</span>
                                 <span className="font-bold">{formatRupiah(currentTotal)}</span>
                             </div>
                             <div className="h-px bg-border my-2"/>
                             <div className="flex justify-between items-center">
                                 <span className="font-medium text-muted-foreground">Selisih</span>
                                 <span className={cn(
                                     "font-bold px-2 py-0.5 rounded text-xs",
                                     variance === 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                     )}>
                                     {variance === 0 ? "LUNAS" : formatRupiah(variance)}
                                 </span>
                             </div>
                         </div>
                         
                         <Button 
                             className="w-full h-12 text-lg font-bold shadow-md hover:shadow-lg transition-all" 
                             onClick={handleSubmit}
                             disabled={currentTotal === 0 || variance !== 0}
                         >
                             <Save className="w-5 h-5 mr-2" />
                             Kirim Setoran
                         </Button>
                         
                         {variance !== 0 && (
                             <p className="text-xs text-red-500 text-center">Pastikan jumlah setoran sama dengan total penjualan.</p>
                         )}
                     </CardContent>
                 </Card>
             </div>
          </div>
      </div>

      {/* CONFIRMATION DIALOG */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-blue-600" />
                    Konfirmasi Setoran ke Pusat
                </DialogTitle>
                <DialogDescription>
                    Pastikan semua rincian setoran sudah sesuai sebelum dikirim ke pusat.
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
                
                 {/* Period Info */}
                 <div className="bg-muted/30 p-3 rounded-lg border">
                    <p className="text-sm text-muted-foreground">Periode Penjualan</p>
                    <p className="font-semibold">
                        {dateRange?.from ? format(dateRange.from, 'dd MMMM yyyy', { locale: id }) : '-'} 
                        {dateRange?.to && !isSameDay(dateRange.from!, dateRange.to) ? ` - ${format(dateRange.to, 'dd MMMM yyyy', { locale: id })}` : ''}
                    </p>
                 </div>

                 {/* Financial Summary */}
                 <div className="grid grid-cols-3 gap-2 text-center bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                    <div>
                        <p className="text-xs text-muted-foreground uppercase">Total Penjualan</p>
                        <p className="font-bold text-gray-800">{formatRupiah(targetTotal)}</p>
                    </div>
                    <div>
                         <p className="text-xs text-muted-foreground uppercase">Total Setoran</p>
                         <p className="font-bold text-blue-600">{formatRupiah(currentTotal)}</p>
                    </div>
                    <div>
                         <p className="text-xs text-muted-foreground uppercase">Selisih</p>
                         <p className={cn("font-bold", variance === 0 ? "text-green-600" : "text-red-600")}>
                             {formatRupiah(variance)}
                         </p>
                    </div>
                 </div>

                 {/* Cash Details */}
                 {cashItems.length > 0 && (
                     <div className="border rounded-lg overflow-hidden">
                         <div className="bg-gray-50 px-3 py-2 border-b font-medium text-sm flex justify-between">
                            <span>Rincian Tunai</span>
                            <span>{formatRupiah(totalCash)}</span>
                         </div>
                         <div className="p-2 space-y-1 bg-white">
                             {cashItems.map(item => (
                                 <div key={item.denom} className="flex justify-between text-sm">
                                     <span className="text-muted-foreground">{formatRupiah(item.denom)} x {item.count}</span>
                                     <span>{formatRupiah(item.denom * item.count)}</span>
                                 </div>
                             ))}
                         </div>
                     </div>
                 )}

                 {/* Transfer Details */}
                 {transferItems.length > 0 && (
                     <div className="border rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-3 py-2 border-b font-medium text-sm flex justify-between">
                            <span>Rincian Transfer</span>
                            <span>{formatRupiah(totalTransfer)}</span>
                         </div>
                         <div className="p-2 space-y-2 bg-white">
                             {transferItems.map((item, idx) => {
                                 const bank = rekeningBank.find(r => r.id === item.bankId);
                                 return (
                                     <div key={idx} className="flex justify-between items-start text-sm border-b last:border-0 pb-1 last:pb-0">
                                         <div>
                                             <span className="block font-medium">{bank?.namaBank} - {bank?.atasNama}</span>
                                             {item.proofPreview && <span className="text-[10px] text-green-600 italic">Bukti terlampir</span>}
                                         </div>
                                         <span>{formatRupiah(item.amount)}</span>
                                     </div>
                                 )
                             })}
                         </div>
                     </div>
                 )}

                 {/* Notes */}
                 <div className="space-y-1">
                     <p className="text-sm font-medium">Catatan</p>
                     <div className="p-3 bg-yellow-50 text-sm italic rounded border border-yellow-100 min-h-[60px]">
                         {notes || "Tidak ada catatan"}
                     </div>
                 </div>

                 <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-800 rounded text-xs">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>
                        Pastikan data di atas sudah benar. Pengajuan ini akan dikirim ke Pusat untuk diverifikasi.
                        Notifikasi akan dikirim ke Admin/Owner.
                    </p>
                 </div>

            </div>

            <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setIsConfirmOpen(false)} disabled={isSubmitting}>
                    Batal
                </Button>
                <Button onClick={handleFinalSubmit} disabled={isSubmitting}>
                    {isSubmitting ? "Mengirim..." : "Ya, Kirim Setoran"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </MainLayout>
  );
}
