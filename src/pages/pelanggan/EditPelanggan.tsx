import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { UserCog, MapPin, Save, ArrowLeft, Locate, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentLocation } from '@/lib/gps';
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
import { LocationPicker, extractAddressFromCoordinates } from '@/components/map/LocationPicker';

export default function EditPelanggan() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { pelanggan, addPersetujuan, updatePelanggan, kategoriPelanggan, profilPerusahaan } = useDatabase();
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [formData, setFormData] = useState({
    nama: '',
    namaPemilik: '',
    kode: '',
    alamat: '',
    telepon: '',
    email: '',
    namaBank: '',
    noRekening: '',
    kategoriId: '',
    limitKredit: '0',
    latitude: 0,
    longitude: 0,
    salesId: '',
    cabangId: ''
  });

  useEffect(() => {
    if (id && pelanggan.length > 0) {
      const customer = pelanggan.find(p => p.id === id);
      if (customer) {
        setFormData({
          nama: customer.nama,
          namaPemilik: customer.namaPemilik || '',
          kode: customer.kode,
          alamat: customer.alamat,
          telepon: customer.telepon,
          email: customer.email || '',
          namaBank: customer.namaBank || '',
          noRekening: customer.noRekening || '',
          kategoriId: customer.kategoriId,
          limitKredit: customer.limitKredit.toString(),
          latitude: customer.lokasi?.latitude || 0,
          longitude: customer.lokasi?.longitude || 0,
          salesId: customer.salesId,
          cabangId: customer.cabangId
        });
      } else {
        toast.error('Data pelanggan tidak ditemukan');
        navigate('/pelanggan');
      }
    }
  }, [id, pelanggan, navigate]);

  const handleGetLocation = async () => {
    setLoadingLoc(true);
    try {
      const loc = await getCurrentLocation();
      const address = loc.alamat;

      setFormData(prev => ({
        ...prev,
        latitude: loc.latitude,
        longitude: loc.longitude,
        alamat: address ? address : prev.alamat,
      }));

      if (address) {
        toast.success('Lokasi berhasil ditemukan');
      } else {
        toast.warning('Koordinat GPS berhasil tersimpan.');
      }
    } catch (error) {
      console.error('GPS Error:', error);
      toast.error('Gagal mendapatkan lokasi. Pastikan GPS aktif.');
    }
    setLoadingLoc(false);
  };

  const handleMapLocationSelect = async (lat: number, lng: number) => {
    setLoadingLoc(true);
    setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
    try {
      const address = await extractAddressFromCoordinates(lat, lng);
      if (address) {
        setFormData(prev => ({ ...prev, alamat: address }));
        toast.success('Alamat diperbarui dari peta');
      }
    } catch (error) {
      console.error(error);
    }
    setLoadingLoc(false);
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!formData.nama || !formData.kategoriId) {
      toast.error('Nama dan Kategori wajib diisi');
      return;
    }
    if (!formData.alamat) {
      toast.error('Alamat wajib diisi');
      return;
    }

    // Check duplicates (exclude current user)
    if (formData.telepon) {
      const duplicatePhone = pelanggan.find(p => p.telepon === formData.telepon && p.id !== id);
      if (duplicatePhone) {
        toast.error(`Nomor telepon sudah digunakan oleh pelanggan: ${duplicatePhone.nama}`);
        return;
      }
    }

    if (formData.noRekening) {
      const duplicateRek = pelanggan.find(p => p.noRekening === formData.noRekening && p.id !== id);
      if (duplicateRek) {
        toast.error(`Nomor rekening sudah digunakan oleh pelanggan: ${duplicateRek.nama}`);
        return;
      }
    }

    setShowConfirm(true);
  };

  const isAdminOrOwner = user?.roles.includes('admin') || user?.roles.includes('owner');

  const handleExecuteSubmit = async () => {
    if (!id) return;

    try {
      if (!formData.nama || !formData.kategoriId) {
        toast.error('Nama dan Kategori wajib diisi');
        return;
      }

      const { latitude, longitude, ...rest } = formData;

      // Request Approval instead of direct update
      const changes = {
        ...rest,
        limitKredit: Number(formData.limitKredit),
        lokasi: {
          latitude,
          longitude,
          alamat: formData.alamat
        },
        namaPemilik: formData.namaPemilik,
        namaBank: formData.namaBank,
        noRekening: formData.noRekening
      };

      if (isAdminOrOwner) {
        // Direct update for admin/owner
        await updatePelanggan(id, changes);
        toast.success('Data pelanggan berhasil diperbarui (Otomatis Disetujui).');
      } else {
        // Send approval for non-admin
        await addPersetujuan({
          jenis: 'perubahan_data_pelanggan',
          referensiId: id,
          status: 'pending',
          diajukanOleh: user?.id || 'unknown',
          targetRole: 'admin',
          tanggalPengajuan: new Date(),
          data: changes
        });

        toast.success('Permintaan perubahan data dikirim. Menunggu persetujuan Admin.');
      }
      navigate('/pelanggan');
    } catch (error) {
      console.error('Error requesting update:', error);
      toast.error('Gagal mengirim/memperbarui data');
    } finally {
      setShowConfirm(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/pelanggan/' + id)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Edit Pelanggan</h1>
              <p className="text-muted-foreground">
                Perbarui data pelanggan
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Form Edit Pelanggan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleConfirmSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kode Pelanggan</Label>
                  <Input
                    value={formData.kode}
                    readOnly
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nama Pelanggan / Toko <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.nama}
                    onChange={(e) => setFormData(prev => ({ ...prev, nama: e.target.value }))}
                    placeholder="Nama lengkap/toko..."
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nomor Telepon / WA</Label>
                  <Input
                    value={formData.telepon}
                    onChange={(e) => setFormData(prev => ({ ...prev, telepon: e.target.value }))}
                    placeholder="08..."
                    type="tel"
                    inputMode="numeric"
                  />
                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nama Bank</Label>
                  <Input
                    value={formData.namaBank}
                    onChange={(e) => setFormData(prev => ({ ...prev, namaBank: e.target.value }))}
                    placeholder="Contoh: BCA, Mandiri..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nomor Rekening</Label>
                  <Input
                    value={formData.noRekening}
                    onChange={(e) => setFormData(prev => ({ ...prev, noRekening: e.target.value }))}
                    placeholder="Nomor rekening..."
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nama Pemilik (Sesuai Rekening)</Label>
                <Input
                  value={formData.namaPemilik}
                  onChange={(e) => setFormData(prev => ({ ...prev, namaPemilik: e.target.value }))}
                  placeholder="Nama lengkap sesuai buku tabungan..."
                />
                <p className="text-[10px] text-muted-foreground italic">
                  *Pastikan nama ini sama dengan nama pada rekening bank.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Alamat Lengkap <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Textarea
                    value={formData.alamat}
                    onChange={(e) => setFormData(prev => ({ ...prev, alamat: e.target.value }))}
                    placeholder="Alamat lengkap..."
                    className="min-h-[80px] pr-12"
                    required
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-2 text-primary hover:bg-primary/10"
                    onClick={handleGetLocation}
                    disabled={loadingLoc}
                    title="Ambil Lokasi GPS"
                  >
                    <Locate className={`h-4 w-4 ${loadingLoc ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                {formData.latitude !== 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Koordinat: {formData.latitude}, {formData.longitude}
                  </p>
                )}
                {isAdminOrOwner && (
                  <div className="mt-4">
                    <Label className="mb-2 block text-sm text-muted-foreground">Peta Lokasi (Khusus Admin/Owner - Klik Peta untuk pin lokasi)</Label>
                    <LocationPicker
                      position={{ lat: formData.latitude, lng: formData.longitude }}
                      onLocationSelect={handleMapLocationSelect}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select
                    value={formData.kategoriId}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, kategoriId: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {kategoriPelanggan.length > 0 ? (
                        kategoriPelanggan.map(k => (
                          <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="default" disabled>Belum ada kategori</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

              </div>
              <div className="space-y-2">
                <Label>Limit Kredit (Rp.)</Label>
                <Input
                  value={profilPerusahaan?.config?.useGlobalLimit ? profilPerusahaan.config.globalLimitAmount : formData.limitKredit}
                  onChange={(e) => setFormData(prev => ({ ...prev, limitKredit: e.target.value }))}
                  placeholder="0"
                  type="number"
                  inputMode="numeric"
                  disabled={profilPerusahaan?.config?.useGlobalLimit}
                  className={profilPerusahaan?.config?.useGlobalLimit ? "bg-muted font-semibold text-primary" : ""}
                />
                {profilPerusahaan?.config?.useGlobalLimit && (
                  <p className="text-[10px] text-primary font-medium animate-pulse">
                    *Menggunakan Limit Global Aktif
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Simpan Perubahan
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Simpan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menyimpan perubahan data pelanggan ini?
              Perubahan akan dievaluasi oleh Admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleExecuteSubmit}>Simpan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
