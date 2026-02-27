import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Barang, Cabang, KategoriPelanggan, Pelanggan, Penjualan, Persetujuan as PersetujuanType, PersetujuanPayload, Reimburse, Satuan, User } from '@/lib/types';
import { ArrowLeftRight, Download, User as UserIcon } from 'lucide-react';
import { ApprovalCustomerEdit, ApprovalCustomerMutation, ApprovalPromo } from './details/ApprovalCustomerPromo';
import { ApprovalEmployeeMutation, ApprovalManualDiscount, ApprovalOpname, ApprovalSetoran } from './details/ApprovalMisc';
import { ApprovalMutasi, ApprovalReimburse } from './details/ApprovalMutasiReimburse';
import { ApprovalPrice, ApprovalTransaction } from './details/ApprovalTransactionPrice';

interface ApprovalDetailDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    item: PersetujuanType | null;
    onApprove: (item: PersetujuanType) => void;
    onReject: (item: PersetujuanType) => void;
    onPrintReport: (item: PersetujuanType) => void;
    user: User | null;
    users: User[];
    cabang: Cabang[];
    barang: Barang[];
    satuan: Satuan[];
    pelanggan: Pelanggan[];
    reimburse: Reimburse[];
    penjualan: Penjualan[];
    mutasiData?: PersetujuanPayload;
}

export function ApprovalDetailDialog({
    isOpen,
    onOpenChange,
    item,
    onApprove,
    onReject,
    onPrintReport,
    user,
    users,
    cabang,
    barang,
    satuan,
    pelanggan,
    reimburse,
    penjualan,
    mutasiData
}: ApprovalDetailDialogProps) {
    if (!item) return null;
    
    const data = item.data as PersetujuanPayload;
    if (!data) return null;

    const renderDetailContent = () => {
        switch (item.jenis) {
            case 'mutasi':
            case 'permintaan':
            case 'restock':
            case 'mutasi_stok': {
               // Combine data items or mutasiData (pending items)
               const mData = item.data ? item.data as PersetujuanPayload : mutasiData;
               const finalData = { ...data, ...mData };
               
               return (
                    <div className="space-y-4">
                        <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 mb-4 text-xs md:text-sm">
                              <div className='flex justify-between items-center mb-2'>
                                  <div className="flex flex-col">
                                      <span className="text-xs text-muted-foreground">Dari Cabang</span>
                                      <span className="font-semibold text-slate-700">
                                          {cabang.find(c => c.id === (finalData.dariCabangId || item.diajukanOleh))?.nama || 'Pusat/Gudang'}
                                      </span>
                                  </div>
                                  <ArrowLeftRight className="text-indigo-300 w-5 h-5 mx-2" />
                                  <div className="flex flex-col text-right">
                                      <span className="text-xs text-muted-foreground">Ke Cabang</span>
                                      <span className="font-semibold text-indigo-700">
                                          {cabang.find(c => c.id === (finalData.keCabangId))?.nama || '-'}
                                      </span>
                                  </div>
                              </div>
                              <div className='pt-2 border-t border-indigo-200 flex justify-between items-center'>
                                   <span className="text-xs text-muted-foreground">Terima Barang Dari:</span>
                                   <span className="text-sm font-medium text-foreground">
                                       {users.find(u => u.id === item.diajukanOleh)?.nama || 'Unknown'}
                                   </span>
                              </div>
                        </div>
                        <ApprovalMutasi data={finalData} barang={barang} satuan={satuan} />
                    </div>
               );
             }

            case 'reimburse':
                return <ApprovalReimburse data={data} reference={reimburse.find(r => r.id === item.referensiId)} />;
            
            case 'perubahan_harga':
                return <ApprovalPrice data={data} barang={barang} satuan={satuan} />;
            
            case 'hapus_transaksi':
            case 'pembatalan_penjualan':
                return <ApprovalTransaction 
                            data={data} 
                            transaction={penjualan.find(p => p.id === item.referensiId)} 
                            barang={barang} 
                        />;
            
            case 'diskon_manual':
                return <ApprovalManualDiscount data={data} />;

            case 'mutasi_pelanggan':
                return <ApprovalCustomerMutation data={data} users={users} pelanggan={pelanggan} />;
            
            case 'perubahan_data_pelanggan':
                return <ApprovalCustomerEdit data={data} />;
            
            case 'promo':
                return <ApprovalPromo data={data} />;
            
            case 'opname':
                return <ApprovalOpname data={data} barang={barang} />;
            
            case 'setoran':
            case 'rencana_setoran':
                return <ApprovalSetoran data={data} />;
            
            case 'mutasi_karyawan':
                return <ApprovalEmployeeMutation data={data} cabang={cabang} />;

            default:
                return (
                    <div className="p-4 border rounded bg-slate-50 italic text-center">
                        Detail tidak tersedia untuk item ini.
                    </div>
                );
        }
    };

    // Footer Logic
    const isReimburse = item.jenis === 'reimburse';
    const rData = isReimburse ? reimburse.find(r => r.id === item.referensiId) : null;
    const isWaitingPayment = isReimburse && item.status === 'disetujui' && rData?.status === 'disetujui';
    const canProcess = (item.status === 'pending' && item.diajukanOleh !== user?.id) || isWaitingPayment;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 capitalize">
                        {item.jenis.replace(/_/g, ' ')}
                        <span className="text-xs font-normal text-muted-foreground px-2 py-0.5 bg-slate-100 rounded-full">
                            {new Date(item.tanggalPengajuan).toLocaleDateString()}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <div className="py-2">
                    {renderDetailContent()}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
                    
                    {canProcess && (
                         <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
                            <Button variant="destructive" onClick={() => onReject(item)}>
                                Tolak
                            </Button>
                            <Button 
                                className="bg-pink-600 hover:bg-pink-700 text-white font-bold"
                                onClick={() => onApprove(item)}
                            >
                                {isWaitingPayment ? 'Bayar Sekarang' : 'Setujui'}
                            </Button>
                        </div>
                    )}

                    {item.jenis === 'rencana_setoran' && (
                        <Button 
                          variant="secondary" 
                          className="bg-indigo-600 hover:bg-indigo-700 text-white"
                          onClick={() => onPrintReport(item)}
                        >
                            <Download className="w-4 h-4 mr-2" /> Cetak Laporan
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
