import { Badge } from '@/components/ui/badge';
import { PersetujuanPayload, User, Pelanggan } from '@/lib/types';
import { formatRupiah } from '@/lib/utils';
import { UserCog, User as UserIcon, Users, Tag } from 'lucide-react';

export function ApprovalCustomerMutation({ 
    data, 
    users, 
    pelanggan 
}: { 
    data: PersetujuanPayload; 
    users: User[]; 
    pelanggan: Pelanggan[];
}) {
    const items = data.items && Array.isArray(data.items) ? data.items : [];
    
    return (
         <div className="space-y-4">
             <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                 <h4 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                     <UserCog className="w-5 h-5" /> Detail Mutasi Pelanggan
                 </h4>
                 
                 <div className="flex bg-white py-3 px-4 rounded border mb-4 text-sm">
                     <div className="flex-1 border-r pr-4">
                         <p className="text-xs text-muted-foreground uppercase mb-1">Dari Sales (Asal)</p>
                         <div className="font-medium text-slate-800 flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                             {users.find(u => u.id === (data.dariSalesId))?.nama || 'Unknown'}
                         </div>
                     </div>
                     <div className="flex-1 pl-4">
                         <p className="text-xs text-muted-foreground uppercase mb-1">Ke Sales (Tujuan)</p>
                         <div className="font-medium text-orange-700 font-bold flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                             {users.find(u => u.id === data.keSalesId)?.nama || 'Unknown'}
                         </div>
                     </div>
                 </div>

                 <div className="bg-white rounded border">
                     <div className="p-2 bg-muted/30 border-b font-medium text-xs uppercase flex justify-between items-center">
                         <span>Daftar Pelanggan ({items.length || data.count || 1})</span>
                     </div>
                     <div className="max-h-[300px] overflow-y-auto">
                        {items.length > 0 ? (
                            (items as unknown as Pelanggan[]).map((cust: Pelanggan, idx: number) => (
                                <div key={idx} className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-orange-50/50">
                                    <div className="bg-orange-100 text-orange-600 p-1.5 rounded-full">
                                        <UserIcon size={14} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm text-slate-800">{cust.nama}</p>
                                        <p className="text-[10px] text-muted-foreground font-mono">{cust.kode || '-'}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex items-center gap-3 p-3 hover:bg-orange-50/50">
                                <div className="bg-orange-100 text-orange-600 p-1.5 rounded-full">
                                    <UserIcon size={14} />
                                </div>
                                <div>
                                    <p className="font-medium text-sm text-slate-800">{data.pelangganNama}</p>
                                    <p className="text-[10px] text-muted-foreground text-orange-600 font-medium">Single Customer Mutation</p>
                                </div>
                            </div>
                        )}
                     </div>
                 </div>
                 
                 {data.catatan && (
                    <div className="mt-3 text-xs italic text-muted-foreground">
                        Catatan: "{data.catatan}"
                    </div>
                 )}
             </div>
         </div>
    );
}

export function ApprovalCustomerEdit({ data }: { data: PersetujuanPayload }) {
    return (
        <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                     <Users className="w-5 h-5" /> Detail Perubahan Pelanggan
                </h4>
                 {'isActive' in data && (
                    <div className="flex items-center justify-between p-3 bg-white rounded border border-blue-100 mb-2 text-sm">
                        <span className="text-muted-foreground">Status Aktif:</span>
                        <Badge variant={data.isActive ? 'success' : 'destructive'}>
                            {data.isActive ? 'Aktif' : 'Non-Aktif'}
                        </Badge>
                    </div>
                )}
                {data.limitKredit !== undefined && (
                    <div className="flex items-center justify-between p-3 bg-white rounded border border-blue-100 text-sm">
                        <span className="text-muted-foreground">Limit Kredit Baru:</span>
                        <span className="font-mono font-bold text-lg">{formatRupiah(data.limitKredit)}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export function ApprovalPromo({ data }: { data: PersetujuanPayload }) {
    return (
        <div className="space-y-4">
            <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg">
                <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                     <Tag className="w-5 h-5" /> Detail Promo
                </h4>
                <div className="bg-white p-3 rounded border border-purple-100 space-y-2 text-sm">
                    <div className="flex justify-between">
                         <span className="text-muted-foreground">Nama Promo:</span>
                         <span className="font-medium">{data.nama}</span>
                    </div>
                    <div className="flex justify-between">
                         <span className="text-muted-foreground">Kode:</span>
                         <span className="font-mono bg-purple-100 px-1 rounded text-purple-700">{data.kode}</span>
                    </div>
                    <div className="flex justify-between">
                         <span className="text-muted-foreground">Benefit:</span>
                         <span className="font-bold text-purple-700">
                             {data.tipe === 'produk' 
                                 ? `Produk Gratis (${data.mekanismeBonus})`
                                 : `Diskon ${data.tipe === 'persen' ? data.nilai + '%' : formatRupiah(Number(data.nilai))}`
                             }
                         </span>
                    </div>
                    <div className="pt-2 border-t mt-2">
                        <p className="text-xs text-muted-foreground mb-1">Target Produk:</p>
                        <p className="font-medium">
                            {data.scope === 'all' ? 'Semua Produk' : `${data.targetProdukIds?.length || 0} Produk Terpilih`}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
