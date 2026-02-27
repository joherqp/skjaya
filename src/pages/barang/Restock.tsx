import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { PackagePlus, Save, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
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

interface RestockFormProps {
  embedded?: boolean;
  onSuccess?: () => void;
}

export function RestockForm({ embedded, onSuccess }: RestockFormProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const {
    barang, updateBarang, addPersetujuan, addNotifikasi,
    users, cabang, satuan: satuanList, karyawan
  } = useDatabase();
  const { user, hasRole } = useAuth();

  const [formData, setFormData] = useState({
    barangId: '',
    cabangId: '',
    receiverId: '',
    satuanId: '',
    jumlah: '',
    keterangan: 'Barang masuk dari pusat'
  });

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const selectedBarang = barang.find(b => b.id === formData.barangId);
  const isOwner = hasRole(['owner', 'admin']);

  const targetCabangId = isOwner && formData.cabangId ? formData.cabangId : (user?.cabangId || '');

  // Filter potential receivers
  const potentialReceivers = users.filter(u => {
    // Only show active users
    if (!u.isActive) return false;

    // Check linked employee branch if exists, otherwise user branch
    let userCabangId = u.cabangId;
    if (u.karyawanId) {
      const linkedKaryawan = karyawan.find(k => k.id === u.karyawanId);
      if (linkedKaryawan) {
        userCabangId = linkedKaryawan.cabangId;
      }
    }

    const isCabangMatch = userCabangId === targetCabangId;
    const isRoleMatch = (u.roles.includes('gudang') || u.roles.includes('driver') || u.roles.includes('leader') || u.roles.includes('admin') || u.roles.includes('staff') || u.roles.includes('sales'));

    // Strict branch match, no global admin bypass
    return isCabangMatch && isRoleMatch;
  });

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBarang || !formData.jumlah) return;
    if (!user) return;
    if (!targetCabangId) {
      toast.error('Pilih cabang tujuan');
      return;
    }
    if (!formData.receiverId) {
      toast.error('Pilih penerima barang (Wajib)');
      return;
    }
    setIsConfirmOpen(true);
  };

  const executeSubmit = () => {
    const jumlahRestock = parseInt(formData.jumlah);

    addPersetujuan({
      jenis: 'restock',
      referensiId: selectedBarang!.id,
      status: 'pending',
      diajukanOleh: user!.id,
      targetRole: 'gudang',
      targetCabangId: targetCabangId,
      targetUserId: formData.receiverId,
      tanggalPengajuan: new Date(),
      catatan: formData.keterangan,
      data: {
        barangId: selectedBarang!.id,
        jumlah: jumlahRestock,
        satuanId: formData.satuanId,
        namaBarang: selectedBarang!.nama,
        konversi: (() => {
          if (formData.satuanId === selectedBarang!.satuanId) return 1;
          const multi = selectedBarang!.multiSatuan?.find(m => m.satuanId === formData.satuanId);
          return multi ? multi.konversi : 1;
        })(),
        totalQty: (() => {
          let k = 1;
          if (formData.satuanId !== selectedBarang!.satuanId) {
            const multi = selectedBarang!.multiSatuan?.find(m => m.satuanId === formData.satuanId);
            if (multi) k = multi.konversi;
          }
          return jumlahRestock * k;
        })()
      }
    });

    const notifTargets = users.filter(u => u.id === formData.receiverId);

    notifTargets.forEach(targetUser => {
      addNotifikasi({
        userId: targetUser.id,
        judul: 'Ada Barang Masuk Nih!',
        pesan: `${user?.nama || 'Seseorang'} ngirim ${jumlahRestock} ${satuanList.find(s => s.id === formData.satuanId)?.simbol || 'Unit'} ${selectedBarang!.nama} ke kamu. Yuk dicek dan diterima!`,
        jenis: 'info',
        dibaca: false,
        tanggal: new Date(),
        link: '/persetujuan'
      });
    });

    if (notifTargets.length === 0) {
      toast.info('Info: Tidak ada user target ditemukan untuk notifikasi.');
    }

    toast.success('Permintaan Barang Masuk terkirim.');
    setIsConfirmOpen(false);

    if (onSuccess) {
      onSuccess();
      setFormData(prev => ({ ...prev, barangId: '', jumlah: '', keterangan: '' }));
    } else {
      if (returnTo) {
        navigate(returnTo);
      } else {
        navigate('/barang');
      }
    }
  };

  return (
    <div className={embedded ? "w-full" : "p-4 max-w-xl mx-auto"}>
      {!embedded && (
        <Button
          variant="ghost"
          onClick={() => returnTo ? navigate(returnTo) : navigate('/barang')}
          className="mb-4 pl-0"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali
        </Button>
      )}

      <Card elevated={!embedded} className={embedded ? "border-0 shadow-none" : ""}>
        {!embedded && (
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <PackagePlus className="w-6 h-6 text-success" />
              </div>
              <CardTitle>Form Barang Masuk / Restock</CardTitle>
            </div>
          </CardHeader>
        )}
        <CardContent className={embedded ? "p-0" : ""}>
          <form onSubmit={handlePreSubmit} className="space-y-4">

            {isOwner && (
              <div className="space-y-2">
                <Label>Cabang Tujuan</Label>
                <Select
                  value={formData.cabangId}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, cabangId: val, receiverId: '' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih cabang..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cabang.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Penerima (Wajib)</Label>
              <SearchableSelect
                value={formData.receiverId}
                onChange={(val) => setFormData(prev => ({ ...prev, receiverId: val }))}
                disabled={!targetCabangId && isOwner}
                placeholder="Pilih penerima"
                searchPlaceholder="Cari nama penerima..."
                emptyMessage="Tidak ada user di cabang ini"
                options={potentialReceivers.map(u => ({
                  value: u.id,
                  label: u.nama,
                  description: u.roles.join(', ')
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Pilih Produk</Label>
              <Select
                value={formData.barangId}
                onValueChange={(val) => {
                  const b = barang.find(x => x.id === val);
                  setFormData(prev => ({ ...prev, barangId: val, satuanId: b?.satuanId || '' }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih barang..." />
                </SelectTrigger>
                <SelectContent>
                  {barang
                    .filter(b => b.isActive) // Filter inactive products
                    .map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nama}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jumlah</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.jumlah}
                  onChange={(e) => setFormData(prev => ({ ...prev, jumlah: e.target.value }))}
                  required
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label>Satuan</Label>
                <Select
                  value={formData.satuanId}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, satuanId: val }))}
                  disabled={!formData.barangId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Satuan" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedBarang && (() => {
                      const mainSatuan = satuanList.find(s => s.id === selectedBarang.satuanId);
                      const options = [];
                      if (mainSatuan) options.push({ id: mainSatuan.id, nama: mainSatuan.nama, type: 'Utama' });
                      if (selectedBarang.multiSatuan) {
                        selectedBarang.multiSatuan.forEach(ms => {
                          const s = satuanList.find(x => x.id === ms.satuanId);
                          if (s) options.push({ id: s.id, nama: s.nama, type: 'Multi' });
                        });
                      }
                      return options.map(opt => (
                        <SelectItem key={opt.id} value={opt.id}>{opt.nama}</SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Textarea
                placeholder="Catatan barang masuk..."
                value={formData.keterangan}
                onChange={(e) => setFormData(prev => ({ ...prev, keterangan: e.target.value }))}
              />
            </div>

            <Button type="submit" className="w-full bg-success hover:bg-success/90">
              <Save className="w-4 h-4 mr-2" />
              Update Stok (Kirim ke Penerima)
            </Button>
          </form>
        </CardContent>
      </Card>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Restock</AlertDialogTitle>
            <AlertDialogDescription>
              Pastikan data barang masuk berikut sudah benar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-3 bg-muted/50 p-4 rounded-md text-sm">
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold text-muted-foreground">Penerima</span>
              <span className="col-span-2 font-medium">: {users.find(u => u.id === formData.receiverId)?.nama || '-'}</span>

              <span className="font-semibold text-muted-foreground">Barang</span>
              <span className="col-span-2 font-medium">: {selectedBarang?.nama}</span>

              <span className="font-semibold text-muted-foreground">Jumlah</span>
              <span className="col-span-2 font-bold text-success">
                : {formData.jumlah} {satuanList.find(s => s.id === formData.satuanId)?.simbol || 'Unit'}
              </span>

              <span className="font-semibold text-muted-foreground">Catatan</span>
              <span className="col-span-2 italic">: "{formData.keterangan}"</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={executeSubmit} className="bg-success hover:bg-success/90">
              Ya, Kirim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function RestockPage() {
  return (
    <MainLayout title="Barang Masuk / Restock">
      <RestockForm />
    </MainLayout>
  )
}
