import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { formatRupiah, formatCompactRupiah } from '@/lib/utils';
import { ArrowLeft, Download, Search, Loader2, Eye, Receipt } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';
import { PenjualanItem } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


interface ArchiveItem extends PenjualanItem {
  nama?: string;
  barang?: { nama: string };
  satuan?: string;
}

interface ArchiveSale {
  id: string;
  nomor_nota: string;
  tanggal: string;
  total: number;
  metode_pembayaran: string;
  catatan?: string;
  pelanggan?: { nama: string };
  sales?: { nama: string };
  items: ArchiveItem[];
}

export default function LaporanArsipPenjualan() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ArchiveSale[]>([]);
  const [selectedTx, setSelectedTx] = useState<ArchiveSale | null>(null);
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1); // Default 1 month ago
    return d.toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const handleSearch = async () => {
      setLoading(true);
      try {
          // Fetch directly from Supabase to bypass Context Cache Limit
          const { data: result, error } = await supabase
              .from('penjualan')
              .select(`
                  *,
                  pelanggan:pelanggan(nama),
                  sales:users!sales_id(nama)
              `)
              .eq('status', 'lunas')
              .gte('tanggal', startDate)
              .lte('tanggal', endDate + 'T23:59:59')
              .order('tanggal', { ascending: false });

          if (error) throw error;

          if (result) {
              setData(result);
              toast.success(`${result.length} data ditemukan.`);
          }
      } catch (err) {
          console.error("Error fetching archive:", err);
          toast.error("Gagal memuat data arsip.");
      } finally {
          setLoading(false);
      }
  };

  const handleDownloadExcel = () => {
    try {
        const exportData = data.map(item => {
            // Format items into a string
            const itemsString = item.items.map(i => {
                // Try to get name from partial data if available, or just ID/Code if not joined
                // Since items jsonb usually stores snapshot info, we might need 'nama' if stored there.
                // Standard PenjualanItem structure might not have 'nama' directly if it's just ID. 
                // However, typical implementation stores snapshot. Let's rely on typical query result pattern or schema.
                // If the JSONB 'items' contains 'nama', great. If not, we might only have IDs. 
                // NOTE: The 'items' column in Supabase usually stores the full snapshot including name.
                const name = i.nama || i.barang?.nama || 'Item';
                const unit = i.satuan || 'pcs';
                return `${name} (${i.jumlah} ${unit})`;
            }).join(', ');

            return {
                'Tanggal': new Date(item.tanggal).toLocaleDateString('id-ID'),
                'No Nota': item.nomor_nota,
                'Pelanggan': item.pelanggan?.nama || 'UMUM',
                'Sales': item.sales?.nama || 'Unknown',
                'Metode': item.metode_pembayaran,
                'Detail Barang': itemsString,
                'Total': item.total,
                'Catatan': item.catatan || '-'
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, "Arsip Penjualan");
        XLSX.writeFile(wb, `Arsip_Penjualan_${startDate}_sd_${endDate}.xlsx`);
        toast.success("File Excel berhasil diunduh");
    } catch (err) {
        console.error("Export Error:", err);
        toast.error("Gagal membuat file Excel");
    }
  };

  const totalOmzet = data.reduce((sum, item) => sum + item.total, 0);

  return (
    <MainLayout title="Arsip Penjualan">
       <div className="p-4 space-y-4">
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center bg-white p-4 rounded-lg border shadow-sm">
             <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => navigate('/laporan')} className="pl-0">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
                </Button>
                <div>
                     <h2 className="font-semibold text-lg">Arsip Penjualan</h2>
                     <p className="text-xs text-muted-foreground">Cari & download data lama (Direct Database)</p>
                </div>
             </div>
             
             <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 w-full md:w-auto">
                 <div className="flex items-center gap-2">
                    <div className="grid gap-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Dari</label>
                        <Input 
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="h-9 w-[130px]"
                        />
                    </div>
                    <div className="grid gap-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Sampai</label>
                        <Input 
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="h-9 w-[130px]"
                        />
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-2 mt-4 sm:mt-0">
                    <Button size="sm" onClick={handleSearch} disabled={loading} className="h-9 bg-blue-600 hover:bg-blue-700">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                        Cari Data
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={data.length === 0} className="h-9">
                        <Download className="w-4 h-4 mr-2 text-green-600" /> Excel
                    </Button>
                 </div>
             </div>
        </div>

        {/* Results */}
        <Card className="border-none shadow-sm md:border md:shadow-sm">
            <CardContent className="p-0">
                <div className="p-4 border-b flex justify-between items-center bg-muted/20">
                    <h3 className="font-medium text-sm">Hasil Pencarian</h3>
                    <div className="text-right">
                        <span className="text-xs text-muted-foreground mr-2">Total Omzet:</span>
                        <span className="font-bold text-lg text-primary">{formatRupiah(totalOmzet)}</span>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>No Nota</TableHead>
                            <TableHead>Pelanggan</TableHead>
                            <TableHead>Sales</TableHead>
                            <TableHead>Metode</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center h-40">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">Mengambil data dari server...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center h-32 text-muted-foreground">
                                    Belum ada data ditampilkan. Silakan cari berdasarkan tanggal.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((item, idx) => (
                                <TableRow key={idx} className="hover:bg-muted/50">
                                    <TableCell className="whitespace-nowrap">
                                        {new Date(item.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </TableCell>
                                    <TableCell className="font-medium font-mono text-xs">{item.nomor_nota}</TableCell>
                                    <TableCell>{item.pelanggan?.nama || 'UMUM'}</TableCell>
                                    <TableCell>{item.sales?.nama || '-'}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="uppercase text-[10px]">{item.metode_pembayaran}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-bold">{formatCompactRupiah(item.total)}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedTx(item)}>
                                            <Eye className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
       </div>

       {/* Detail Dialog */}
       <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
           <DialogContent className="max-w-md">
               <DialogHeader>
                   <DialogTitle className="flex items-center gap-2">
                       <Receipt className="w-5 h-5 text-primary" />
                       Detail Transaksi
                   </DialogTitle>
               </DialogHeader>
               
               {selectedTx && (
                   <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-2 text-sm">
                           <div className="text-muted-foreground">No. Nota</div>
                           <div className="font-mono font-bold text-right">{selectedTx.nomor_nota}</div>
                           
                           <div className="text-muted-foreground">Tanggal</div>
                           <div className="text-right">{new Date(selectedTx.tanggal).toLocaleString('id-ID')}</div>
                           
                           <div className="text-muted-foreground">Pelanggan</div>
                           <div className="text-right font-medium">{selectedTx.pelanggan?.nama || 'UMUM'}</div>
                           
                           <div className="text-muted-foreground">Sales</div>
                           <div className="text-right">{selectedTx.sales?.nama || '-'}</div>

                           <div className="text-muted-foreground">Metode</div>
                           <div className="text-right uppercase font-semibold">{selectedTx.metode_pembayaran}</div>
                       </div>

                       <div className="border-t border-b py-2 space-y-2">
                           <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Item Pembelian</div>
                           {selectedTx.items.map((item, idx) => (
                               <div key={idx} className="flex justify-between text-sm">
                                   <div className="flex-1">
                                       <div className="font-medium">{item.nama || item.barang?.nama || 'Item'}</div>
                                       <div className="text-xs text-muted-foreground">
                                           {item.jumlah} {item.satuan || 'pcs'} x {formatCompactRupiah(item.harga)}
                                       </div>
                                   </div>
                                   <div className="font-mono">
                                       {formatCompactRupiah(item.subtotal)}
                                   </div>
                               </div>
                           ))}
                       </div>

                       <div className="flex justify-between items-center text-lg font-bold pt-2">
                           <span>Total</span>
                           <span>{formatRupiah(selectedTx.total)}</span>
                       </div>
                   </div>
               )}
           </DialogContent>
       </Dialog>
    </MainLayout>
  );
}
