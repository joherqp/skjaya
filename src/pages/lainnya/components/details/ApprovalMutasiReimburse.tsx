import { Badge } from '@/components/ui/badge';
import { PersetujuanPayload, Barang, Satuan, Reimburse } from '@/lib/types';
import { formatRupiah } from '@/lib/utils';

export function ApprovalMutasi({ 
    data, 
    barang, 
    satuan 
}: { 
    data: PersetujuanPayload; 
    barang: Barang[]; 
    satuan: Satuan[];
}) {
    const items = (data.items || []) as { barangId: string; jumlah: number; satuanId?: string }[];
    
    const getUnitName = (id?: string) => satuan.find(s => s.id === id)?.nama || '';

    return (
        <div className="space-y-4">
            <div className="bg-muted p-2 font-medium text-sm rounded">Daftar Barang Mutasi</div>
            <div className="max-h-[300px] overflow-y-auto border rounded-md">
                {items.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Tidak ada item.</p>}
                {items.map((it, idx) => {
                    const b = barang.find(x => x.id === it.barangId);
                    const unit = getUnitName(it.satuanId || b?.satuanId);
                    return (
                        <div key={idx} className="flex justify-between items-center p-2 border-b last:border-0 hover:bg-muted/50 text-sm">
                            <span className="font-medium">{b?.nama || it.barangId}</span>
                            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{it.jumlah} {unit}</span>
                        </div>
                    );
                })}
            </div>
            {data.catatan && (
                <div className="p-3 bg-blue-50 text-blue-800 text-sm italic rounded border border-blue-100">
                    Catatan: "{data.catatan}"
                </div>
            )}
        </div>
    );
}

export function ApprovalReimburse({ 
    data,
    reference
}: { 
    data: PersetujuanPayload;
    reference?: Reimburse;
}) {
    return (
        <div className="space-y-4">
             <div className="p-4 bg-pink-50 border border-pink-100 rounded-lg">
                 <div className="flex justify-between items-start mb-2">
                     <span className="text-sm font-semibold text-pink-900 uppercase">Total Reimburse</span>
                     <span className="text-xl font-bold text-pink-700">{formatRupiah(data.amount || 0)}</span>
                 </div>
                 
                 <div className="space-y-2 mt-4">
                     <div>
                         <span className="text-xs text-muted-foreground block">Keterangan/Keperluan</span>
                         <p className="text-sm text-slate-800 bg-white p-2 rounded border border-pink-100 min-h-[60px]">
                             {data.keterangan || reference?.keterangan || '-'}
                         </p>
                     </div>
                     
                     {reference?.bukti && (
                        <div>
                             <span className="text-xs text-muted-foreground block mb-1">Bukti Transaksi</span>
                             <div className="flex gap-2 overflow-x-auto pb-2">
                                 <a href={reference.bukti} target="_blank" rel="noreferrer" className="block w-20 h-20 shrink-0 border rounded overflow-hidden hover:opacity-80">
                                     <img src={reference.bukti} alt="Bukti" className="w-full h-full object-cover" />
                                 </a>
                             </div>
                        </div>
                     )}
                 </div>
             </div>
        </div>
    );
}
