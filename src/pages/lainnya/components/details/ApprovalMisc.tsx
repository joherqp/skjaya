import { Badge } from '@/components/ui/badge';
import { PersetujuanPayload, Barang, Cabang } from '@/lib/types';
import { formatRupiah } from '@/lib/utils';
import { ArrowLeftRight } from 'lucide-react';

export function ApprovalOpname({ 
    data, 
    barang 
}: { 
    data: PersetujuanPayload; 
    barang: Barang[]; 
}) {
    const b = barang.find(x => x.id === data.barangId);
    
    return (
        <div className="space-y-4">
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-lg">
                 <h4 className="font-semibold text-rose-900 mb-3 text-sm uppercase tracking-wide">Hasil Stock Opname</h4>
                 <p className="font-medium text-lg mb-3">{b?.nama || 'Unknown Item'}</p>
                 
                 <div className="grid grid-cols-3 gap-3 text-sm">
                     <div className="bg-white p-2 rounded border text-center">
                         <span className="block text-xs text-muted-foreground mb-1">Stok Sistem</span>
                         <span className="font-mono font-bold text-lg">{data.stokTercatat}</span>
                     </div>
                     <div className="bg-white p-2 rounded border text-center">
                         <span className="block text-xs text-muted-foreground mb-1">Stok Fisik</span>
                         <span className="font-bold text-lg text-rose-700">{data.stokFisik}</span>
                     </div>
                     <div className={`p-2 rounded border text-center flex flex-col justify-center ${(data.selisih || 0) < 0 ? 'bg-red-100 px-1 border-red-200 text-red-700' : 'bg-green-100 border-green-200 text-green-700'}`}>
                         <span className="block text-xs opacity-70 mb-1">Selisih</span>
                         <span className="font-bold text-lg">{(data.selisih || 0) > 0 ? '+' : ''}{data.selisih}</span>
                     </div>
                 </div>
                 {data.catatan && (
                    <div className="mt-3 text-sm italic text-muted-foreground bg-white/50 p-2 rounded">
                        "{data.catatan}"
                    </div>
                 )}
            </div>
        </div>
    );
}

export function ApprovalSetoran({ data }: { data: PersetujuanPayload }) {
    if (data.startDate && data.endDate) {
        // Rencana Setoran
        return (
             <div className="space-y-4">
                 <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                     <h4 className="font-semibold text-indigo-900 mb-4 text-center border-b border-indigo-200 pb-2">
                         Laporan Realisasi Setoran
                     </h4>
                     
                     <div className="flex justify-between items-end mb-4">
                         <div>
                             <p className="text-xs text-muted-foreground">Periode</p>
                             <p className="font-medium text-sm">
                                 {new Date(data.startDate).toLocaleDateString()} - {new Date(data.endDate).toLocaleDateString()}
                             </p>
                         </div>
                         <div className="text-right">
                             <p className="text-xs text-muted-foreground">Total Disetor</p>
                             <p className="font-bold text-2xl text-indigo-700">{formatRupiah(data.amount || 0)}</p>
                         </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4 bg-white p-3 rounded border border-indigo-100 mb-4">
                         <div className="text-center">
                             <span className="text-xs text-muted-foreground block">Tunai (Cash)</span>
                             <span className="font-medium text-indigo-900">{formatRupiah(data.cashAmount || 0)}</span>
                         </div>
                         <div className="text-center border-l">
                             <span className="text-xs text-muted-foreground block">Transfer</span>
                             <span className="font-medium text-indigo-900">{formatRupiah(data.transferAmount || 0)}</span>
                         </div>
                     </div>

                     {data.transfers && data.transfers.length > 0 && (
                         <div className="space-y-2">
                             <p className="text-xs font-semibold text-indigo-900">Bukti Transfer ({data.transfers.length}):</p>
                             <div className="flex gap-2 chat-scroll overflow-x-auto pb-2">
                                 {data.transfers.map((t, i) => (
                                     <a key={i} href={t.proofUrl} target="_blank" rel="noreferrer" className="block w-16 h-16 shrink-0 border rounded overflow-hidden">
                                         <img src={t.proofUrl} className="w-full h-full object-cover" alt="Bukti" />
                                     </a>
                                 ))}
                             </div>
                         </div>
                     )}
                 </div>
             </div>
        );
    }

    // Regular Setoran
    return (
        <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-center">
                 <h4 className="font-semibold text-blue-900 mb-2">Setoran Saldo</h4>
                 <p className="text-3xl font-bold text-blue-700 mb-2">{formatRupiah(data.amount || 0)}</p>
                 {data.rekeningNama && (
                     <Badge variant="outline" className="bg-white">
                         Ke: {data.rekeningNama} {data.rekeningNomor ? `(${data.rekeningNomor})` : ''}
                     </Badge>
                 )}
                 {data.buktiGambar && (
                     <div className="mt-4 flex justify-center">
                         <a href={data.buktiGambar} target="_blank" rel="noreferrer" className="block w-32 max-h-32 rounded overflow-hidden border">
                             <img src={data.buktiGambar} className="w-full h-full object-cover" alt="Bukti Setor" />
                         </a>
                     </div>
                 )}
            </div>
        </div>
    );
}

export function ApprovalEmployeeMutation({ 
    data, 
    cabang 
}: { 
    data: PersetujuanPayload; 
    cabang: Cabang[];
}) {
    const oldCabang = cabang.find(c => c.id === data.oldCabangId)?.nama || '-';
    const newCabang = cabang.find(c => c.id === data.cabangId)?.nama || '-';

    return (
        <div className="space-y-4">
            <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">Detail Mutasi Karyawan</h4>
                
                {data.isCabangChanged && (
                    <div className="flex items-center justify-between p-3 bg-white rounded border border-gray-200 mb-2">
                        <div className="text-center flex-1">
                            <p className="text-xs text-muted-foreground">Cabang Asal</p>
                            <p className="font-medium text-red-500">{oldCabang}</p>
                        </div>
                        <ArrowLeftRight className="text-gray-400 mx-2" />
                         <div className="text-center flex-1">
                            <p className="text-xs text-muted-foreground">Cabang Baru</p>
                            <p className="font-bold text-green-600">{newCabang}</p>
                        </div>
                    </div>
                )}
                
                {data.isStatusChanged && (
                     <div className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                        <div className="text-center flex-1">
                            <p className="text-xs text-muted-foreground">Status Lama</p>
                            <p className="font-medium text-red-500 capitalize">{data.oldStatus}</p>
                        </div>
                        <ArrowLeftRight className="text-gray-400 mx-2" />
                         <div className="text-center flex-1">
                            <p className="text-xs text-muted-foreground">Status Baru</p>
                            <p className="font-bold text-green-600 capitalize">{data.status}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export function ApprovalManualDiscount({ data }: { data: PersetujuanPayload }) {
    return (
        <div className="space-y-4">
             <div className="p-4 bg-orange-50 border border-orange-100 rounded-lg">
                 <h4 className="font-semibold text-orange-900 mb-3">Diskon Manual</h4>
                 <div className="flex justify-between items-center mb-2">
                     <span className="text-sm text-muted-foreground">Nilai Transaksi</span>
                     <span className="font-mono">{formatRupiah(data.amount || 0)}</span>
                 </div>
                 <div className="flex justify-between items-center mb-2">
                     <span className="text-sm text-muted-foreground">Diskon Diajukan</span>
                     <span className="font-bold text-lg text-orange-700">{formatRupiah(data.nilai || 0)}</span>
                 </div>
                 {data.keterangan && (
                     <div className="mt-2 text-sm italic text-muted-foreground bg-white p-2 rounded border">
                         "{data.keterangan}"
                     </div>
                 )}
             </div>
        </div>
    );
}
