import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PersetujuanPayload, Reimburse, User } from '@/lib/types';
import { formatRupiah } from '@/lib/utils';
import { Building2, Clock, Coins } from 'lucide-react';

import { Textarea } from '@/components/ui/textarea';

interface ApprovalConfirmDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    confirmDialog: {
        action: 'approve' | 'reject';
        id: string;
        type: string;
        refId: string;
        data?: Record<string, unknown>;
    };
    onConfirm: () => void;
    reimburseMode: 'pay_now' | 'pay_later' | 'forward';
    setReimburseMode: (mode: 'pay_now' | 'pay_later' | 'forward') => void;
    users: User[];
    reimburse: Reimburse[];
    rejectionReason: string;
    setRejectionReason: (reason: string) => void;
}

export function ApprovalConfirmDialog({
    isOpen,
    onOpenChange,
    confirmDialog,
    onConfirm,
    reimburseMode,
    setReimburseMode,
    users,
    reimburse,
    rejectionReason,
    setRejectionReason
}: ApprovalConfirmDialogProps) {

    return (
        <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {confirmDialog.action === 'approve' 
                            ? (['mutasi', 'permintaan', 'restock'].includes(confirmDialog.type) ? 'Konfirmasi Terima Barang' 
                              : confirmDialog.type === 'setoran' ? 'Konfirmasi Terima Uang' 
                              : 'Konfirmasi Persetujuan')
                            : 'Konfirmasi Penolakan'}
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="mt-4 text-sm text-muted-foreground">
                            Apakah Anda yakin ingin {
                                confirmDialog.data?.forwardToPusat 
                                ? 'meneruskan pengajuan ini ke Pusat' 
                                : confirmDialog.action === 'approve' ? 'menyetujui pengajuan ini' : 'menolak pengajuan ini'
                            }?
                            Tindakan ini tidak dapat dibatalkan.

                            {/* Added Summary Context */}
                            <div className="mt-3 p-3 bg-slate-50 border rounded-lg text-slate-700 text-xs text-left">
                                {(() => {
                                    const type = confirmDialog.type;
                                    const data = confirmDialog.data as PersetujuanPayload;
                                    if (!data) return <p className="italic">Data tidak tersedia</p>;

                                    switch (type) {
                                        case 'reimburse':
                                            return (
                                                <div className="space-y-1">
                                                    <p>Jenis: <span className="font-semibold">Reimbursement</span></p>
                                                    <p>Jumlah: <span className="font-bold text-pink-700">{formatRupiah(Number(data.amount || 0))}</span></p>
                                                    <p className="line-clamp-2">Ket: {String(data.keterangan || 'Tanpa keterangan')}</p>
                                                </div>
                                            );
                                        case 'setoran':
                                            return (
                                                <div className="space-y-1">
                                                    <p>Jenis: <span className="font-semibold">Setoran Saldo</span></p>
                                                    <p>Jumlah: <span className="font-bold text-blue-700">{formatRupiah(Number(data.amount || 0))}</span></p>
                                                    {data.rekeningNama && <p>Ke: {String(data.rekeningNama)}</p>}
                                                </div>
                                            );
                                        case 'rencana_setoran':
                                            return (
                                                <div className="space-y-1">
                                                    <p>Jenis: <span className="font-semibold">Setoran ke Pusat</span></p>
                                                    <p>Total Realisasi: <span className="font-bold text-indigo-700">{formatRupiah(Number(data.amount || 0))}</span></p>
                                                    <p className="text-[10px] text-muted-foreground">Periode: {String(data.startDate)} s/d {String(data.endDate)}</p>
                                                </div>
                                            );
                                         case 'permintaan':
                                             return (
                                                 <div className="space-y-1">
                                                     <p>Jenis: <span className="font-semibold">Permintaan Stok</span></p>
                                                     <p>Total: <span className="font-bold">{(data.items as unknown[])?.length || 0} Jenis Barang</span></p>
                                                 </div>
                                             );
                                        case 'mutasi':
                                            return (
                                                <div className="space-y-1">
                                                    <p>Jenis: <span className="font-semibold">Mutasi Barang</span></p>
                                                    <p>Total: <span className="font-bold">{(data.items as unknown[])?.length || 0} Jenis Barang</span></p>
                                                    <p>Pengaju: <span className="font-medium text-indigo-700">{users.find(u => u.id === confirmDialog.id)?.nama || 'Unknown'}</span></p>
                                                </div>
                                            );
                                        case 'promo':
                                            return (
                                                <div className="space-y-1">
                                                    <p>Jenis: <span className="font-semibold">Promo</span></p>
                                                    <p className="font-bold text-purple-700">{data.nama}</p>
                                                    <p className="text-xs">
                                                        {data.tipe === 'produk' 
                                                          ? `Bonus Produk (${data.mekanismeBonus === 'single' ? 'Pilih 1' : data.mekanismeBonus === 'mix' ? 'Campur' : 'Random'})`
                                                          : `Diskon ${data.tipe === 'persen' ? data.nilai + '%' : formatRupiah(Number(data.nilai))}`}
                                                    </p>
                                                </div>
                                            );
                                        default:
                                            return (
                                                <p className="capitalize">Pengajuan {type.replace(/_/g, ' ')}</p>
                                            );
                                    }
                                })()}
                            </div>
                        </div>
                    </AlertDialogDescription>

                    {/* Rejection Reason Input */}
                    {confirmDialog.action === 'reject' && (
                        <div className="mt-4">
                            <label className="text-sm font-medium mb-1.5 block">Alasan Penolakan</label>
                            <Textarea 
                                placeholder="Tuliskan alasan penolakan..." 
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="min-h-[80px]"
                            />
                        </div>
                    )}

                    {/* Reimburse Payment Options Selection */}
                    {confirmDialog.action === 'approve' && confirmDialog.type === 'reimburse' && !reimburse.find(r => r.id === confirmDialog.refId)?.disetujuiPada && (
                        <div className="mt-4 space-y-3">
                            <p className="text-sm font-semibold text-slate-700 mb-2 px-1 text-left">Pilih Metode Penyelesaian:</p>
                            
                            <div className="grid gap-2">
                                {/* Pay Now Option */}
                                <div 
                                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${reimburseMode === 'pay_now' ? 'bg-pink-50 border-pink-500 ring-1 ring-pink-500' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                    onClick={() => setReimburseMode('pay_now')}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${reimburseMode === 'pay_now' ? 'border-pink-500' : 'border-slate-300'}`}>
                                        {reimburseMode === 'pay_now' && <div className="w-2 h-2 rounded-full bg-pink-500" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Coins className="w-4 h-4 text-pink-600" />
                                            <p className="font-semibold text-sm">SETUJUI & BAYAR</p>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Disetujui dan langsung mengurangi saldo Kas Kecil (Petty Cash).</p>
                                    </div>
                                </div>

                                {/* Pay Later Option */}
                                <div 
                                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${reimburseMode === 'pay_later' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                    onClick={() => setReimburseMode('pay_later')}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${reimburseMode === 'pay_later' ? 'border-blue-500' : 'border-slate-300'}`}>
                                        {reimburseMode === 'pay_later' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-blue-600" />
                                            <p className="font-semibold text-sm">HANYA SETUJUI</p>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Status menjadi 'Disetujui', pembayaran dilakukan nanti.</p>
                                    </div>
                                </div>

                                {/* Forward Option (Only for branches if needed, but logic seems general) */}
                                {confirmDialog.data?.forwardToPusat !== true && (
                                     <div 
                                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${reimburseMode === 'forward' ? 'bg-orange-50 border-orange-500 ring-1 ring-orange-500' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                        onClick={() => setReimburseMode('forward')}
                                    >
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${reimburseMode === 'forward' ? 'border-orange-500' : 'border-slate-300'}`}>
                                            {reimburseMode === 'forward' && <div className="w-2 h-2 rounded-full bg-orange-500" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-orange-600" />
                                                <p className="font-semibold text-sm">TERUSKAN KE PUSAT</p>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">Reimburse diteruskan untuk persetujuan Manajemen Pusat.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => onOpenChange(false)}>Batal</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={(e) => {
                            e.preventDefault(); // Prevent auto close
                            onConfirm(); 
                        }}
                        disabled={confirmDialog.action === 'reject' && !rejectionReason.trim()}
                        className={confirmDialog.action === 'approve' 
                            ? (reimburseMode === 'pay_now' ? 'bg-pink-600 hover:bg-pink-700' : 'bg-blue-600 hover:bg-blue-700') 
                            : 'bg-red-600 hover:bg-red-700'}
                    >
                        {confirmDialog.action === 'approve' 
                            ? (reimburseMode === 'pay_now' ? 'Setujui & Bayar' : 'Ya, Setujui') 
                            : 'Ya, Tolak'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
