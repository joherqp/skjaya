import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PersetujuanPayload, Persetujuan as PersetujuanType, User, Cabang, Barang, Satuan, KategoriPelanggan, Pelanggan, Reimburse } from '@/lib/types';
import { formatRupiah } from '@/lib/utils';
import { ArrowLeftRight, ArrowRight, Calendar, CheckCircle, Clock, Coins, Eye, FileText, PackagePlus, User as UserIcon, Users } from 'lucide-react';

// Helper to get icon based on approval type
export const getIcon = (jenis: string) => {
    switch (jenis) {
        case 'diskon_manual': return <FileText className="text-orange-500" />;
        case 'edit_harga': return <FileText className="text-yellow-500" />;
        case 'hapus_transaksi': return <FileText className="text-red-500" />;
        case 'permintaan': return <PackagePlus className="text-blue-500" />;
        case 'mutasi_stok': return <ArrowLeftRight className="text-indigo-500" />;
        case 'mutasi': return <ArrowLeftRight className="text-indigo-500" />;
        case 'restock': return <PackagePlus className="text-emerald-500" />;
        case 'penjualan': return <FileText className="text-green-500" />;
        case 'perubahan_data_pelanggan': return <Users className="text-blue-500" />;
        case 'perubahan_harga': return <FileText className="text-orange-500" />;
        case 'promo': return <FileText className="text-purple-500" />;
        case 'rencana_setoran': return <FileText className="text-indigo-500" />;
        case 'setoran': return <FileText className="text-blue-500" />;
        case 'reimburse': return <FileText className="text-pink-500" />;
        case 'mutasi_karyawan': return <ArrowLeftRight className="text-cyan-500" />;
        case 'opname': return <FileText className="text-rose-500" />;
        case 'mutasi_pelanggan': return <ArrowLeftRight className="text-orange-500" />;
        default: return <FileText className="text-gray-500" />;
    }
};

interface ApprovalCardProps {
    item: PersetujuanType;
    isHistory: boolean;
    users: User[];
    cabang: Cabang[];
    barang: Barang[];
    satuan: Satuan[];
    kategoriPelanggan: KategoriPelanggan[];
    pelanggan: Pelanggan[];
    reimburse: Reimburse[];
    mutasiData?: PersetujuanPayload;
    onViewDetail: (item: PersetujuanType) => void;
}

export function ApprovalCard({ 
    item, 
    isHistory, 
    users, 
    cabang, 
    barang, 
    satuan,
    pelanggan,
    reimburse,
    mutasiData,
    onViewDetail 
}: ApprovalCardProps) {
    
    // Derived Data
    const reimburseData = item.jenis === 'reimburse' ? reimburse.find(r => r.id === item.referensiId) : null;
    const setoranData = item.jenis === 'setoran' && item.data ? (item.data as PersetujuanPayload) : null;
    const customer = item.jenis === 'perubahan_data_pelanggan' && item.referensiId 
        ? pelanggan?.find(p => p.id === item.referensiId)
        : (item.data as PersetujuanPayload)?.pelangganId 
            ? pelanggan?.find(p => p.id === (item.data as PersetujuanPayload).pelangganId)
            : null;

    const formatUserDetail = (userId?: string) => {
        if (!userId) return '-';
        const u = users.find(u => u.id === userId);
        return u ? `${u.nama} (${u.roles[0]})` : 'Unknown User';
    };

    const formatDateTime = (date: Date | string) => {
        if (!date) return '-';
        return new Date(date).toLocaleString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const getUnitName = (id?: string) => {
        if (!id) return '';
        return satuan.find(s => s.id === id)?.nama || '';
    };

    // Render Status Logic
    const renderStatus = () => {
        if (!isHistory) {
            const isWaitingPayment = item.jenis === 'reimburse' && item.status === 'disetujui' && reimburseData?.status === 'disetujui';
            if (isWaitingPayment) {
                return (
                    <div className="flex flex-col items-end gap-1">
                        <Badge variant="success" className="text-[10px] py-0">Disetujui</Badge>
                        <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200">
                            <Coins className="w-3 h-3" /> Siap Bayar
                        </div>
                    </div>
                );
            }
            return (
                <div className="flex items-center gap-1 text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded text-xs font-medium">
                    <Clock className="w-3 h-3" /> Menunggu
                </div>
            );
        } else {
            if (item.jenis === 'reimburse' && item.status === 'disetujui') {
                if (reimburseData?.status === 'disetujui') {
                    return (
                        <div className="flex flex-col items-end gap-1">
                            <Badge variant="success" className="text-[10px] py-0">Disetujui</Badge>
                            <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200">
                                <Clock className="w-3 h-3" /> Menunggu Pembayaran
                            </div>
                        </div>
                    );
                }
                if (reimburseData?.status === 'dibayar') {
                    return <Badge variant="success">Dibayar</Badge>;
                }
            }
            return (
                <Badge variant={item.status === 'disetujui' ? 'success' : item.status === 'pending' ? 'warning' : 'destructive'}>
                    {item.status}
                </Badge>
            );
        }
    };

    return (
        <Card className={`overflow-hidden transition-all duration-200 mb-4 ${isHistory ? 'opacity-80 hover:opacity-100' : 'border-l-4 border-l-blue-500 shadow-sm hover:shadow-md'}`}>
             <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                      <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                          {getIcon(item.jenis)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                          {/* Header Info */}
                          <div className="flex justify-between items-start mb-2">
                              <div className="min-w-0 pr-2">
                                  <p className="font-semibold capitalize truncate">Pengajuan {item.jenis.replace(/_/g, ' ')}</p>
                                  {customer && (
                                     <div className="flex items-center gap-1 mt-0.5 text-blue-700 bg-blue-50 w-fit px-1.5 py-0.5 rounded text-xs font-medium border border-blue-200">
                                         <UserIcon size={12} />
                                         {customer.nama} ({customer.kode})
                                     </div>
                                  )}
                                  <div className="mt-1 space-y-0.5">
                                      <p className="text-sm text-muted-foreground truncate">
                                         Oleh: <span className="font-medium text-foreground">{formatUserDetail(item.diajukanOleh)}</span>
                                      </p>
                                      {item.targetUserId && (
                                          <p className="text-xs text-muted-foreground truncate">
                                              Kepada: <span className="font-medium text-foreground">{formatUserDetail(item.targetUserId)}</span>
                                          </p>
                                      )}
                                      <p className="text-xs text-muted-foreground">{formatDateTime(item.tanggalPengajuan)}</p>
                                  </div>
                              </div>
                              
                              <div className="text-right shrink-0">
                                  {renderStatus()}
                                  
                                  {isHistory && item.tanggalPersetujuan && (
                                      <div className='mt-1 space-y-0.5 text-right'>
                                          <p className="text-[10px] text-muted-foreground">
                                              {formatDateTime(item.tanggalPersetujuan)}
                                          </p>
                                          {item.disetujuiOleh && (
                                              <p className="text-[10px] text-muted-foreground">
                                                  Disetujui: {formatUserDetail(item.disetujuiOleh)}
                                              </p>
                                          )}
                                          {reimburseData?.status === 'dibayar' && (
                                              <div className="mt-1 pt-1 border-t border-border/50">
                                                  <p className="text-[10px] text-green-600 font-medium">
                                                      Dibayar pada: {reimburseData.dibayarPada ? formatDateTime(reimburseData.dibayarPada) : '-'}
                                                  </p>
                                                  <p className="text-[10px] text-muted-foreground italic">
                                                      Via: <span className="capitalize">{reimburseData.metodePembayaran || '-'}</span>
                                                  </p>
                                              </div>
                                          )}
                                      </div>
                                  )}
                              </div>
                          </div>

                          {/* Dynamic Content */}
                          {setoranData && (
                              <div className="mt-2 p-3 bg-muted/50 rounded text-sm">
                                  <p>Jumlah Setoran: <span className="font-bold">{formatRupiah(setoranData.jumlah || 0)}</span></p>
                                  <p className="text-xs text-muted-foreground mt-1">Ref: {setoranData.nomorSetoran}</p>
                              </div>
                          )}

                          {renderContent()}

                          <div className="flex gap-2 mt-4 justify-end">
                              <Button 
                                size="sm" 
                                variant={isHistory ? "outline" : "default"} 
                                className={!isHistory ? "bg-blue-600 hover:bg-blue-700" : ""}
                                onClick={() => onViewDetail(item)}
                              >
                                  <Eye className="w-4 h-4 mr-1" /> 
                                  {isHistory ? 'Lihat Detail' : 'Tinjau & Setujui'}
                              </Button>
                          </div>
                      </div>
                  </div>
              </CardContent>
        </Card>
    );

    function renderContent() {
        if (!item.data) return null;
        const d = item.data as PersetujuanPayload;
        
        switch (item.jenis) {
            case 'diskon_manual':
                return (
                    <div className="mt-2 space-y-1 text-sm border p-3 rounded bg-orange-50/50 border-orange-100">
                         <div className="flex justify-between items-start">
                              <span className="text-muted-foreground">Total Transaksi (Draft):</span>
                              <span className="font-mono font-medium">{formatRupiah(d.amount || 0)}</span>
                         </div>
                         <div className="flex justify-between items-center p-2 bg-orange-50 rounded border border-orange-100 mt-2">
                              <span className="text-orange-800 font-medium">Diskon Diajukan:</span>
                              <span className="font-bold text-lg text-orange-600">{formatRupiah(d.nilai || 0)}</span>
                         </div>
                         {item.keterangan && <p className="text-xs text-muted-foreground mt-2 italic">"{item.keterangan}"</p>}
                    </div>
                );

            case 'hapus_transaksi':
                return (
                    <div className="mt-2 space-y-1 text-sm border p-3 rounded bg-red-50/50 border-red-100">
                        <p className="text-red-800 font-medium flex items-center gap-2">
                             Penghapusan Transaksi
                        </p>
                        <p className="font-mono bg-white p-1 px-2 rounded border border-red-100 w-fit">{d.nomorNota}</p>
                        <div className="flex justify-between mt-1 text-xs">
                             <span className="text-muted-foreground">Nilai:</span>
                             <span className="font-bold">{formatRupiah(d.amount || 0)}</span>
                        </div>
                        {d.keterangan && <p className="text-xs text-muted-foreground mt-1 italic">Alasan: "{d.keterangan}"</p>}
                    </div>
                );
            
            case 'restock':
                return (
                    <div className="mt-2 p-3 bg-emerald-50/30 rounded text-sm border border-emerald-100">
                        <p className="font-medium text-emerald-900">{d.namaBarang}</p>
                        <div className="flex justify-between items-center mt-1">
                            <p>
                               Jumlah: <span className="font-bold">{(d.jumlah || 0).toLocaleString('id-ID')}</span> 
                               {' '}<span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">{getUnitName(d.satuanId)}</span>
                            </p>
                        </div>
                        {item.catatan && <p className="text-xs text-muted-foreground mt-1 italic">"{item.catatan}"</p>}
                    </div>
                );

            case 'perubahan_data_pelanggan':
                return (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded text-sm space-y-1">
                        <p className="font-semibold text-blue-800 text-xs uppercase tracking-wide">Ringkasan Perubahan</p>
                        {'isActive' in d && (
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground w-20 text-xs">Status:</span>
                                <Badge variant={d.isActive ? 'success' : 'destructive'} className="text-[10px] px-1.5 py-0">
                                    {d.isActive ? 'Aktif' : 'Non-Aktif'}
                                </Badge>
                            </div>
                        )}
                        {d.limitKredit !== undefined && (
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground w-20 text-xs">Limit Baru:</span>
                                <span className="font-mono font-bold">{formatRupiah(d.limitKredit)}</span>
                            </div>
                        )}
                    </div>
                );

            case 'mutasi_karyawan':
                return (
                    <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded text-sm">
                        <p className="font-semibold text-indigo-800 text-xs uppercase mb-1">Perubahan Data Karyawan</p>
                        {d.isCabangChanged && (
                            <p>Cabang: <span className="line-through text-red-400 mr-2">{cabang.find(c => c.id === d.oldCabangId)?.nama || '-'}</span> 
                            <ArrowLeftRight className="inline w-3 h-3 mx-1"/> 
                            <span className="font-bold text-green-600">{cabang.find(c => c.id === d.cabangId)?.nama || '-'}</span></p>
                        )}
                        {d.isStatusChanged && (
                            <p>Status: <span className="line-through text-red-400 mr-2 capitalize">{d.oldStatus}</span> 
                            <ArrowLeftRight className="inline w-3 h-3 mx-1"/> 
                            <span className="font-bold text-green-600 capitalize">{d.status}</span></p>
                        )}
                    </div>
                );

            case 'mutasi': {
                const items = (d.items || mutasiData?.items || []) as { barangId: string; jumlah: number; satuanId?: string }[];
                if (!items.length) return null;
                
                const mItem = items[0];
                const barangInfo = barang.find(b => b.id === mItem.barangId);
                const unitName = getUnitName(mItem.satuanId || barangInfo?.satuanId);
                const totalItems = items.length;

                return (
                    <div className="p-3 bg-muted/30 rounded text-sm border border-border/50 mt-2">
                        <div className="flex justify-between items-start mb-1">
                             <p className="font-medium text-foreground">{barangInfo?.nama || mItem.barangId}</p>
                        </div>
                         <div className="flex items-center gap-2 text-xs">
                             <span className="font-bold">{mItem.jumlah.toLocaleString('id-ID')}</span> 
                             <span className="text-[10px] bg-secondary px-1 rounded">{unitName}</span>
                         </div>
                         {totalItems > 1 && (
                             <p className="text-[10px] text-muted-foreground mt-1 italic">...dan {totalItems - 1} barang lainnya</p>
                         )}
                    </div>
                );
            }

            case 'permintaan':
                 return (
                    <div className="mt-2 text-sm border border-blue-200 rounded-lg w-full bg-blue-50/50">
                        <div className="p-2 flex justify-between items-center border-b border-blue-100">
                            <span className="font-semibold text-blue-800 text-xs">Permintaan Stok</span>
                            <span className="text-[10px] text-blue-600">{cabang.find(c => c.id === d.dariCabangId)?.nama || 'Cabang Asal'}</span>
                        </div>
                        <div className="p-2">
                            <p className="text-xs text-muted-foreground italic">{(d.items as Record<string, unknown>[])?.length || 0} Barang diminta</p>
                        </div>
                    </div>
                 );

            case 'perubahan_harga':
                return (
                    <div className="mt-2 text-sm border border-orange-200 rounded-lg w-full bg-orange-50/50 p-3">
                        <p className="font-semibold text-orange-800 text-xs uppercase tracking-wide mb-2">Rincian Perubahan Harga</p>
                        <div className="flex justify-between items-center mb-1">
                                <span className="font-medium">{barang.find(b => b.id === d.barangId)?.nama || d.barangId}</span>
                                <Badge variant="outline" className="text-[10px]">{getUnitName(d.satuanId)}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1">
                                <p className="text-[10px] text-muted-foreground">Harga Lama</p>
                                <p className="font-mono text-muted-foreground line-through">
                                    {d.hargaLama ? formatRupiah(d.hargaLama) : '-'}
                                </p>
                            </div>
                            <ArrowRight className="text-orange-400 w-4 h-4" />
                            <div className="flex-1 text-right">
                                <p className="text-[10px] text-muted-foreground">Harga Baru</p>
                                <p className="font-mono font-bold text-green-700">
                                    {formatRupiah(d.hargaBaru)}
                                </p>
                            </div>
                        </div>
                        {d.grosir && d.grosir.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-orange-200">
                                <p className="text-[10px] text-orange-800 font-medium">+ {d.grosir.length} Tier Grosir</p>
                            </div>
                        )}
                    </div>
                );

            case 'promo':
                return (
                    <div className="mt-2 text-sm border border-purple-200 rounded-lg w-full bg-purple-50/50 p-3">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="font-semibold text-purple-900">{d.nama}</p>
                                <p className="text-xs font-mono text-purple-700 bg-purple-100 px-1 rounded inline-block mt-0.5">{d.kode}</p>
                            </div>
                            <Badge variant={d.isActive ? 'success' : 'secondary'} className="text-[10px]">
                                {d.isActive ? 'Aktif' : 'Non-Aktif'}
                            </Badge>
                        </div>
                        <div className="flex flex-col gap-1 text-xs mb-2">
                            <div className="flex items-center gap-2">
                                <span className="capitalize font-medium text-purple-800 bg-purple-100/50 px-2 py-0.5 rounded">{d.tipe}</span>
                                <ArrowRight className="w-3 h-3 text-purple-300" />
                                <span className="font-bold text-purple-700">
                                    {['nomimal', 'nominal'].includes(d.tipe || '')
                                        ? formatRupiah(d.nilai || 0) 
                                        : d.tipe === 'persen' 
                                            ? `${d.nilai}%` 
                                            : `Free Bonus`}
                                </span>
                            </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground flex flex-col gap-1 border-t border-purple-100 pt-2 mt-2">
                            <div className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                <span>
                                    Target: {d.scope === 'all' ? 'Semua Produk' : `${d.targetProdukIds?.length || 0} Produk Terpilih`}
                                </span>
                            </div>
                            {(d.tanggalMulai || d.tanggalBerakhir) && (
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    <span>
                                        {d.tanggalMulai ? new Date(d.tanggalMulai).toLocaleDateString('id-ID') : 'Now'} 
                                        {' - '} 
                                        {d.tanggalBerakhir ? new Date(d.tanggalBerakhir).toLocaleDateString('id-ID') : 'Seterusnya'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'mutasi_pelanggan':
                 return (
                    <div className="mt-2 text-sm border border-orange-200 rounded-lg w-full bg-orange-50/50 p-3">
                        <p className="font-semibold text-orange-800 text-xs uppercase tracking-wide mb-2">Mutasi Pelanggan</p>
                        
                        {d.items && Array.isArray(d.items) ? (
                            <div className="mb-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <Users size={16} className="text-orange-600" />
                                    <span className="font-medium text-lg">{d.items.length} Pelanggan</span>
                                </div>
                                <div className="pl-6 text-xs text-muted-foreground">
                                    {(d.items || []).slice(0, 3).map((c: { nama: string }) => c.nama).join(', ')}
                                    {d.items.length > 3 && `, +${d.items.length - 3} lainnya`}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 mb-2">
                                    <UserIcon size={16} className="text-orange-600" />
                                    <span className="font-medium text-lg">{d.pelangganNama}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-2 text-xs">
                            <div className="flex-1 p-2 bg-white rounded border border-orange-100">
                                <p className="text-muted-foreground">Dari Sales</p>
                                <p className="font-medium">{formatUserDetail(d.dariSalesId)}</p>
                            </div>
                            <ArrowRight className="text-orange-400 w-4 h-4" />
                            <div className="flex-1 p-2 bg-white rounded border border-orange-100">
                                <p className="text-muted-foreground">Ke Sales</p>
                                <p className="font-medium font-bold text-orange-700">{formatUserDetail(d.keSalesId)}</p>
                            </div>
                        </div>
                        {d.catatan && (
                            <div className="mt-2 pt-2 border-t border-orange-200">
                                <p className="text-xs text-muted-foreground italic">"{d.catatan}"</p>
                            </div>
                        )}
                    </div>
                 );
            
            case 'opname': {
                 const b = barang.find(x => x.id === d.barangId);
                 return (
                    <div className="mt-2 p-3 bg-rose-50 border border-rose-100 rounded text-sm space-y-1">
                        <p className="font-semibold text-rose-800 text-xs uppercase tracking-wide">Hasil Opname</p>
                        <p className="font-medium">{b?.nama || 'Unknown Item'}</p>
                        <div className="grid grid-cols-3 gap-2 text-xs mt-1">
                            <div className="bg-white p-1 rounded border text-center">
                                <span className="block text-[10px] text-muted-foreground">Sistem</span>
                                <span className="font-mono font-bold">{d.stokTercatat}</span>
                            </div>
                            <div className="bg-white p-1 rounded border text-center">
                                <span className="block text-[10px] text-muted-foreground">Fisik</span>
                                <span className="font-bold">{d.stokFisik}</span>
                            </div>
                            <div className={`p-1 rounded border text-center ${(d.selisih || 0) < 0 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                                <span className="block text-[10px] opacity-70">Selisih</span>
                                <span className="font-bold">{(d.selisih || 0) > 0 ? '+' : ''}{d.selisih}</span>
                            </div>
                        </div>
                            {item.catatan && <p className="text-xs text-muted-foreground mt-1 italic">"{item.catatan}"</p>}
                    </div>
                 );
            }

            case 'rencana_setoran':
                return (
                    <div className="mt-2 text-sm border border-indigo-200 rounded-lg w-full bg-indigo-50/50 p-3">
                        <div className="flex justify-between items-center mb-2">
                                <span className="font-semibold text-indigo-800 text-xs uppercase tracking-wide">Penerimaan Uang Setoran</span>
                                <Badge variant="outline" className="bg-white text-indigo-700 border-indigo-200">Ke Pusat</Badge>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-muted-foreground mr-2">Total</span>
                            <span className="font-bold text-lg text-indigo-700">{formatRupiah(d.amount)}</span>
                        </div>
                        
                        {/* Breakdown Mini View */}
                        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                            <div className="bg-white/60 p-1.5 rounded border border-indigo-100/50">
                                <span className="block text-[10px] text-muted-foreground">Tunai</span>
                                <span className="font-medium text-indigo-900">{formatRupiah(d.cashAmount || 0)}</span>
                            </div>
                            <div className="bg-white/60 p-1.5 rounded border border-indigo-100/50">
                                <span className="block text-[10px] text-muted-foreground">Transfer</span>
                                <span className="font-medium text-indigo-900">{formatRupiah(d.transferAmount || 0)}</span>
                            </div>
                        </div>

                        {(d.transfers && d.transfers.length > 1) && (
                                <div className="text-[10px] text-right text-indigo-500 italic">
                                    {d.transfers.length} Bukti Transfer terlampir
                                </div>
                        )}
                    </div>
                );

            case 'reimburse':
                return (
                    <div className="mt-2 text-sm p-3 bg-pink-50 border border-pink-100 rounded-lg">
                         <div className="flex justify-between items-start">
                             <span className="font-semibold text-pink-900 uppercase text-xs">Reimbursement</span>
                             <span className="font-bold text-pink-700">{formatRupiah(d.amount || 0)}</span>
                         </div>
                         <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.keterangan || 'Tanpa keterangan'}</p>
                    </div>
                );

            default:
                return null;
        }
    }
}
