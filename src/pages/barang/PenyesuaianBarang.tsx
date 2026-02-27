import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { toast } from 'sonner';
import { Save, ArrowLeft, Plus, FileDiff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';

interface PenyesuaianBarangFormProps {
  embedded?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function PenyesuaianBarangForm({ embedded, onSuccess, onCancel }: PenyesuaianBarangFormProps) {
  const { user } = useAuth();
  const { barang, stokPengguna, addPenyesuaianStok, addPersetujuan } = useDatabase();
  
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [formData, setFormData] = useState({
    barangId: '',
    stokFisik: '',
    alasan: 'rusak',
    keterangan: ''
  });

  const getStokSistem = () => {
    if (!user || !formData.barangId) return 0;
    const userStock = stokPengguna.find(s => s.userId === user.id && s.barangId === formData.barangId);
    if (userStock) return userStock.jumlah;
    return 0;
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.barangId) return;
    setIsConfirmOpen(true);
  };

  const executeSubmit = async () => {
    const stokSistem = getStokSistem();
    const fisik = parseInt(formData.stokFisik) || 0;
    const selisih = fisik - stokSistem;

    const nomorAdj = `ADJ/${Date.now().toString().slice(-6)}`;
    
    try {
        const newAdj = await addPenyesuaianStok({
          nomorPenyesuaian: nomorAdj,
          tanggal: new Date(),
          cabangId: user?.cabangId || 'cab-1',
          barangId: formData.barangId,
          stokTercatat: stokSistem,
          stokFisik: fisik,
          selisih: selisih,
          alasan: formData.alasan as 'rusak' | 'hilang' | 'ditemukan' | 'lainnya',
          keterangan: formData.keterangan,
          status: 'pending'
        });

        // Create Approval Request
        await addPersetujuan({
          jenis: 'opname',
          referensiId: (newAdj as { id: string }).id, 
          status: 'pending',
          diajukanOleh: user?.id || 'system',
          targetRole: 'admin',
          tanggalPengajuan: new Date(),
          catatan: formData.keterangan,
          data: {
            barangId: formData.barangId,
            stokTercatat: stokSistem,
            stokFisik: fisik,
            selisih: selisih,
            alasan: formData.alasan,
            nomorPenyesuaian: nomorAdj
          }
        });

        toast.success('Penyesuaian stok diajukan');
        setIsConfirmOpen(false);
        
        if (onSuccess) {
            onSuccess();
            setFormData({
                barangId: '',
                stokFisik: '',
                alasan: 'rusak',
                keterangan: ''
            });
        }
    } catch (error) {
        toast.error('Gagal mengajukan penyesuaian');
        console.error(error);
    }
  };



  return (
    <div className={embedded ? "w-full" : "p-4 max-w-xl mx-auto space-y-4"}>
       {!embedded && (
          <Button variant="ghost" onClick={onCancel} className="pl-0">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
       )}

      <Card elevated={!embedded} className={embedded ? "border-0 shadow-none" : ""}>
        {!embedded && (
            <CardHeader>
              <CardTitle>Form Stock Opname / Penyesuaian</CardTitle>
            </CardHeader>
        )}
        <CardContent className={embedded ? "p-0" : ""}>
          <form onSubmit={handlePreSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Barang</Label>
              <SearchableSelect 
                value={formData.barangId}
                onChange={(val) => setFormData(prev => ({ ...prev, barangId: val }))}
                placeholder="Pilih Barang"
                options={barang
                  .filter(b => b.isActive)
                  .map(b => ({
                    value: b.id,
                    label: b.nama,
                    description: b.kode
                  }))
                }
              />
            </div>

            {formData.barangId && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                Stok Tercatat di Sistem: <span className="font-bold">{getStokSistem()}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label>Stok Fisik (Aktual)</Label>
              <Input 
                type="number"
                value={formData.stokFisik}
                onChange={(e) => setFormData(prev => ({ ...prev, stokFisik: e.target.value }))}
                placeholder="Masukkan jumlah fisik..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Alasan</Label>
              <Select 
                value={formData.alasan} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, alasan: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rusak">Barang Rusak</SelectItem>
                  <SelectItem value="hilang">Barang Hilang</SelectItem>
                  <SelectItem value="ditemukan">Barang Ditemukan (Lebih)</SelectItem>
                  <SelectItem value="lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Input 
                value={formData.keterangan}
                onChange={(e) => setFormData(prev => ({ ...prev, keterangan: e.target.value }))}
              />
            </div>

            <Button type="submit" className="w-full">
              <Save className="w-4 h-4 mr-2" /> Simpan
            </Button>
          </form>
        </CardContent>
      </Card>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Konfirmasi Penyesuaian Stok</AlertDialogTitle>
                <AlertDialogDescription>
                    Pastikan data stok opname sudah benar sebelum disimpan.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-3">
                <div className="text-sm bg-muted/50 p-3 rounded-md space-y-2">
                    <p><strong>Barang:</strong> {barang.find(b => b.id === formData.barangId)?.nama || '-'}</p>
                    <p><strong>Alasan:</strong> <span className="capitalize">{formData.alasan}</span></p>
                    <p><strong>Keterangan:</strong> {formData.keterangan || '-'}</p>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center text-sm border p-2 rounded-md bg-slate-50">
                    <div>
                        <p className="text-xs text-muted-foreground">Sistem</p>
                        <p className="font-bold text-lg">{getStokSistem()}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Fisik</p>
                        <p className="font-bold text-lg">{formData.stokFisik || 0}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Selisih</p>
                        <p className={`font-bold text-lg ${((parseInt(formData.stokFisik) || 0) - getStokSistem()) < 0 ? 'text-destructive' : 'text-success'}`}>
                            {((parseInt(formData.stokFisik) || 0) - getStokSistem()) > 0 ? '+' : ''}
                            {(parseInt(formData.stokFisik) || 0) - getStokSistem()}
                        </p>
                    </div>
                </div>
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={executeSubmit} className="bg-purple-600 hover:bg-purple-700">
                    Ya, Simpan
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function PenyesuaianBarang() {
  const navigate = useNavigate();
  const { barang, penyesuaianStok } = useDatabase();
  const [showForm, setShowForm] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(10);

  if (showForm) {
      return (
          <MainLayout title="Buat Penyesuaian Stok">
              <PenyesuaianBarangForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
          </MainLayout>
      )
  }

  // Sort by Date Descending
  const sortedAdjustments = [...penyesuaianStok].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  const displayAdjustments = sortedAdjustments.slice(0, displayLimit);

  return (
    <MainLayout title="Penyesuaian Stok">
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/barang')}
            className="pl-0"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <Button onClick={() => setShowForm(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-2" />
            Buat Penyesuaian
          </Button>
        </div>

        <div className="space-y-3">
          {sortedAdjustments.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <FileDiff className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Belum ada riwayat penyesuaian</p>
              </CardContent>
            </Card>
          ) : (
            <>
            {displayAdjustments.map(adj => {
              const item = barang.find(b => b.id === adj.barangId);
              return (
                <Card key={adj.id} elevated>
                  <CardContent className="p-4">
                     <div className="flex justify-between items-start">
                       <div>
                         <p className="font-bold">{adj.nomorPenyesuaian}</p>
                         <p className="text-sm font-semibold">{item?.nama || 'Unknown Item'}</p>
                         <p className="text-xs text-muted-foreground">{new Date(adj.tanggal).toLocaleDateString()}</p>
                       </div>
                       <Badge variant={adj.status === 'pending' ? 'warning' : 'success'}>
                         {adj.status}
                       </Badge>
                     </div>
                     <div className="mt-3 pt-3 border-t text-sm flex justify-between">
                        <div>
                          <span className="text-muted-foreground">Selisih: </span>
                          <span className={adj.selisih < 0 ? 'text-destructive font-bold' : 'text-success font-bold'}>
                            {adj.selisih > 0 ? '+' : ''}{adj.selisih}
                          </span>
                        </div>
                        <span className="capitalize px-2 py-0.5 bg-muted rounded text-xs">
                          {adj.alasan}
                        </span>
                     </div>
                  </CardContent>
                </Card>
              );
            })}

            {sortedAdjustments.length > displayLimit && (
                 <Button 
                     variant="ghost" 
                     className="w-full mt-4 border-dashed text-muted-foreground"
                     onClick={() => setDisplayLimit(prev => prev + 10)}
                 >
                     Lihat Lainnya
                 </Button>
             )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
