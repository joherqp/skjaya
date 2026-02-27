import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { UserPlus, MapPin, Save, Locate } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PelangganFormProps {
  onSuccess?: (newPelangganId: string) => void;
  onCancel?: () => void;
  className?: string;
  isDialog?: boolean;
  initialName?: string;
}

export function PelangganForm({ onSuccess, onCancel, className, isDialog = false, initialName = '' }: PelangganFormProps) {
  const { user } = useAuth();
  const { addPelanggan, kategoriPelanggan, pelanggan, profilPerusahaan } = useDatabase();
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [formData, setFormData] = useState({
    nama: initialName,
    namaPemilik: '',
    kode: `CUST-${Date.now().toString().slice(-4)}`,
    alamat: '',
    telepon: '',
    email: '',
    namaBank: '',
    noRekening: '',
    kategoriId: '',
    limitKredit: '0',
    latitude: 0,
    longitude: 0
  });

  useEffect(() => {
    if (kategoriPelanggan.length > 0 && !formData.kategoriId) {
      const retailCategory = kategoriPelanggan.find(k => k.nama.toLowerCase() === 'retail');
      if (retailCategory) {
        setFormData(prev => ({ ...prev, kategoriId: retailCategory.id }));
      } else {
        setFormData(prev => ({ ...prev, kategoriId: kategoriPelanggan[0].id }));
      }
    }
  }, [kategoriPelanggan, formData.kategoriId]);

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
        toast.warning('Koordinat GPS berhasil tersimpan, namun nama alamat tidak ditemukan. Silakan isi alamat manual.');
      }
    } catch (error) {
      console.error('GPS Error:', error);
      toast.error('Gagal mendapatkan lokasi. Pastikan GPS aktif.');
    }
    setLoadingLoc(false);
  };

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama || !formData.kategoriId) {
      toast.error('Nama dan Kategori wajib diisi');
      return;
    }
    if (!formData.alamat) {
      toast.error('Alamat wajib diisi');
      return;
    }

    // Check Coordinates
    if (formData.latitude === 0 || formData.longitude === 0) {
      toast.error('Titik koordinat (GPS) wajib diambil. Klik tombol lokasi pada kolom alamat.');
      return;
    }

    // Check duplicates
    if (formData.telepon) {
      const duplicatePhone = pelanggan.find(p => p.telepon === formData.telepon);
      if (duplicatePhone) {
        toast.error(`Nomor telepon sudah digunakan oleh pelanggan: ${duplicatePhone.nama}`);
        return;
      }
    }

    if (formData.noRekening) {
      const duplicateRek = pelanggan.find(p => p.noRekening === formData.noRekening);
      if (duplicateRek) {
        toast.error(`Nomor rekening sudah digunakan oleh pelanggan: ${duplicateRek.nama}`);
        return;
      }
    }

    setShowConfirm(true);
  };

  const isAdminOrOwner = user?.roles.includes('admin') || user?.roles.includes('owner');

  const handleExecuteSubmit = async () => {
    try {
      const { latitude, longitude, ...rest } = formData;

      if (!user) {
        toast.error('User data not found');
        return;
      }

      const newPelangganData = {
        ...rest,
        limitKredit: Number(formData.limitKredit),
        sisaKredit: 0,
        salesId: user.id,
        cabangId: user.cabangId,
        isActive: isAdminOrOwner ? true : false,
        lokasi: {
          latitude,
          longitude,
          alamat: formData.alamat
        },
        namaPemilik: formData.namaPemilik,
        namaBank: formData.namaBank,
        noRekening: formData.noRekening
      };

      const createdPelanggan = await addPelanggan(newPelangganData);

      toast.success(isAdminOrOwner ? 'Pelanggan berhasil ditambahkan dan disetujui (Admin)' : 'Pelanggan berhasil ditambahkan');

      if (onSuccess && createdPelanggan?.id) {
        setTimeout(() => {
          onSuccess(createdPelanggan.id);
        }, 100);
      }

    } catch (error) {
      console.error('Error adding pelanggan:', error);
      toast.error('Gagal menambahkan pelanggan');
    } finally {
      setShowConfirm(false);
    }
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

  return (
    <>
      <Card className={isDialog ? "border-0 shadow-none" : ""}>
        {!isDialog && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Form Pelanggan
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className={isDialog ? "p-0" : ""}>

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
                <Label>Kategori Pelanggan <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.kategoriId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, kategoriId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {kategoriPelanggan.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nama Pelanggan <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.nama}
                  onChange={(e) => setFormData(prev => ({ ...prev, nama: e.target.value }))}
                  placeholder="Nama lengkap/toko..."
                  required
                />
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
                  type="text"
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
              <Label>Alamat Lengkap & Titik GPS <span className="text-red-500">*</span></Label>
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

            <Button type="submit" className="w-full">
              <Save className="w-4 h-4 mr-2" />
              Simpan Pelanggan
            </Button>
          </form>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Simpan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menyimpan data pelanggan ini?
              Pastikan data yang dimasukkan sudah benar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirm(false)}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleExecuteSubmit}>Simpan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
