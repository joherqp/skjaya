import { Badge } from '@/components/ui/badge';
import { PersetujuanPayload, Barang, Satuan, Penjualan, PenjualanItem } from '@/lib/types';
import { formatRupiah } from '@/lib/utils';
import { Tag, XCircle } from 'lucide-react';

export function ApprovalTransaction({ 
    data, 
    transaction,
    barang 
}: { 
    data: PersetujuanPayload; 
    transaction?: Penjualan;
    barang: Barang[];
}) {
    // For 'hapus_transaksi' or 'pembatalan_penjualan'
    return (
        <div className="space-y-4">
           <div className="p-3 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
               <p className="font-semibold flex items-center gap-2">
                   <XCircle className="w-5 h-5" />
                   Permintaan Pembatalan Transaksi
               </p>
           </div>
           <div className="grid grid-cols-2 gap-4 text-sm">
               <div>
                   <p className="text-muted-foreground">No. Nota</p>
                   <p className="font-bold text-lg">{transaction?.nomorNota || data.nomorNota || '-'}</p>
               </div>
               <div>
                   <p className="text-muted-foreground">Total Nota</p>
                   <p className="font-bold">{transaction ? formatRupiah(transaction.total) : formatRupiah(data.amount || 0)}</p>
               </div>
               <div className="col-span-2">
                   <p className="text-muted-foreground">Alasan Pembatalan</p>
                   <p className="italic">"{data.keterangan || data.catatan}"</p>
               </div>
           </div>
           {transaction && (
               <div className="border rounded-md p-2 max-h-40 overflow-y-auto bg-slate-50">
                   <p className="text-xs font-semibold text-muted-foreground mb-2">Rincian Barang:</p>
                   <ul className="text-sm space-y-1">
                       {transaction.items.map((i: PenjualanItem, idx: number) => {
                           const b = barang.find(x => x.id === i.barangId);
                           return (
                               <li key={idx} className="flex justify-between border-b last:border-0 py-1">
                                   <span className="truncate max-w-[200px]">{b?.nama || i.barangId}</span>
                                   <span>{i.jumlah} x {formatRupiah(i.harga)}</span>
                               </li>
                           )
                       })}
                   </ul>
               </div>
           )}
       </div>
    );
}

export function ApprovalPrice({ 
    data, 
    barang, 
    satuan 
}: { 
    data: PersetujuanPayload; 
    barang: Barang[]; 
    satuan: Satuan[];
}) {
    const getUnitName = (id?: string) => satuan.find(s => s.id === id)?.nama || '';
    
    return (
        <div className="space-y-4">
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <h4 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                    <Tag className="w-5 h-5" /> Detail Perubahan Harga
                </h4>
                
                <div className="flex justify-between items-center mb-4 p-3 bg-white/50 rounded-md">
                     <div>
                        <p className="text-xs text-muted-foreground">Produk</p>
                        <p className="font-medium text-lg">
                            {barang.find(b => b.id === data.barangId)?.nama || data.barangId}
                        </p>
                     </div>
                     <Badge variant="outline" className="text-sm px-3 py-1 bg-white">
                        {getUnitName(data.satuanId)}
                     </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-red-50 rounded border border-red-100 text-center">
                        <p className="text-xs text-red-600 font-medium uppercase">Harga Lama</p>
                        <p className="text-xl font-bold text-red-700 line-through decoration-red-400/50 mt-1">
                            {data.hargaLama ? formatRupiah(data.hargaLama) : 'Rp -'}
                        </p>
                    </div>
                    <div className="p-3 bg-green-50 rounded border border-green-100 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-green-200 text-green-800 text-[10px] px-1.5 py-0.5 rounded-bl">Baru</div>
                        <p className="text-xs text-green-600 font-medium uppercase">Harga Baru</p>
                        <p className="text-xl font-bold text-green-700 mt-1">
                            {formatRupiah(data.hargaBaru || 0)}
                        </p>
                    </div>
                </div>

                {data.grosir && data.grosir.length > 0 ? (
                    <div className="mt-4 border-t border-orange-200 pt-3">
                        <p className="text-sm font-semibold text-orange-900 mb-2">Tingkatan Harga Grosir:</p>
                        <div className="bg-white rounded-md border text-sm overflow-hidden">
                            <div className="grid grid-cols-3 bg-muted/50 p-2 font-medium text-xs">
                                <div>Min Qty</div>
                                <div>Tipe Hitung</div>
                                <div className="text-right">Harga</div>
                            </div>
                            {data.grosir.map((g: { min: number, harga: number, isMixMatch?: boolean }, idx: number) => (
                                <div key={idx} className="grid grid-cols-3 p-2 border-t last:border-0 hover:bg-orange-50/30">
                                    <div className="font-medium">{g.min}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {g.isMixMatch ? (
                                            <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-100">Mix Match Total</Badge>
                                        ) : (
                                            <span className="text-slate-500">Per Item</span>
                                        )}
                                    </div>
                                    <div className="text-right font-mono font-medium text-green-700">{formatRupiah(g.harga)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground italic text-center mt-2">Tidak ada harga grosir untuk produk ini.</p>
                )}
            </div>
            {data.catatan && (
               <div className="p-3 bg-muted rounded text-sm italic border text-muted-foreground">
                   <span className="font-semibold not-italic mr-1">Catatan:</span> "{data.catatan}"
               </div>
            )}
        </div>
    );
}
