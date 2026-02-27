import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { FileText, Upload, ArrowLeft, Save, Info } from 'lucide-react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/imageCompression';
import { formatCurrency } from '@/lib/utils';

export default function TambahReimburse() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addReimburse, addPersetujuan, users, addNotifikasi } = useDatabase();
  
  const [formData, setFormData] = useState({
    keterangan: '',
    jumlah: '',
    kategori: 'Lainnya' as 'BBM' | 'Makan' | 'Parkir' | 'Tol' | 'Operasional' | 'Lainnya',
    tanggal: new Date().toISOString().slice(0, 16), // datetime-local format
    bukti: '' 
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Ukuran file maksimal 10MB');
        return;
      }
      
      try {
          toast.info('Mengompresi gambar...');
          const compressedFile = await compressImage(file);
          setSelectedFile(compressedFile);
          setPreviewUrl(URL.createObjectURL(compressedFile));
          toast.dismiss();
      } catch (error) {
          console.error('Compression error:', error);
          toast.error('Gagal mengompresi gambar, menggunakan file asli.');
          setSelectedFile(file);
          setPreviewUrl(URL.createObjectURL(file));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!formData.keterangan || !formData.jumlah) {
        toast.error('Mohon lengkapi data');
        return;
    }

    try {
        setUploading(true);
        let finalBuktiUrl = formData.bukti;

        if (selectedFile) {
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `reimburse-${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('bukti-reimburse')
                .upload(filePath, selectedFile);

            if (uploadError) {
                console.error('Upload proof error:', uploadError);
                toast.error('Gagal mengupload bukti pembayaran');
                setUploading(false);
                return;
            }

            const { data: urlData } = supabase.storage
                .from('bukti-reimburse')
                .getPublicUrl(filePath);
            
            finalBuktiUrl = urlData.publicUrl;
        }
        
        const rawAmount = parseFloat(formData.jumlah.replace(/\./g, ''));
        const newReimburse = await addReimburse({
            userId: user.id,
            keterangan: formData.keterangan,
            jumlah: rawAmount,
            status: 'pending',
            tanggal: new Date(formData.tanggal),
            buktiUrl: finalBuktiUrl || undefined,
            kategori: formData.kategori 
        });

        await addPersetujuan({
            jenis: 'reimburse',
            referensiId: newReimburse.id,
            diajukanOleh: user.id,
            tanggalPengajuan: new Date(),
            status: 'pending',
            catatan: `Reimburse: ${formData.keterangan}`,
            targetRole: 'finance', 
            data: {
                amount: rawAmount,
                keterangan: formData.keterangan,
                kategori: formData.kategori,
                tanggalNota: formData.tanggal,
                buktiUrl: finalBuktiUrl
            }
        });

        const targetUsers = users.filter(u => 
            u.cabangId === user.cabangId && 
            (u.roles.includes('finance') || u.roles.includes('admin') || u.roles.includes('owner')) &&
            u.id !== user.id 
        );

        if (targetUsers.length > 0) {
            await Promise.all(targetUsers.map(tUser => 
                addNotifikasi({
                    userId: tUser.id,
                    judul: 'Pengajuan Reimburse Baru',
                    pesan: `${user.nama} mengajukan reimburse senilai ${formatCurrency(rawAmount)} untuk ${formData.keterangan}. Mohon segera diproses.`,
                    jenis: 'info',
                    tanggal: new Date(),
                    dibaca: false,
                    link: '/persetujuan'
                })
            ));
        }

        toast.success('Pengajuan reimburse berhasil dikirim');
        navigate('/reimburse');
    } catch (error) {
        console.error('Submit reimburse error:', error);
        toast.error('Gagal mengajukan reimburse');
    } finally {
        setUploading(false);
    }
  };

  return (
    <MainLayout title="Ajukan Reimbursement">
      <div className="p-3 w-full max-w-md mx-auto space-y-4 pb-20">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/reimburse')}
            className="pl-0 h-auto hover:bg-transparent"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-base font-medium">Kembali</span>
          </Button>
        </div>

        <Card className="border-none shadow-sm sm:border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Form Reimburse</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-5">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-3 items-start">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 leading-relaxed">
                Silakan isi detail pengeluaran dan upload bukti nota/struk. Pengajuan akan diproses oleh staf Finance.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-sm">Keterangan Pengeluaran</Label>
                <Textarea 
                  placeholder="Contoh: Bensin perjalanan dinas ke supplier X"
                  value={formData.keterangan}
                  onChange={e => setFormData({...formData, keterangan: e.target.value})}
                  required
                  className="resize-none h-20"
                />
              </div>

              <div className="space-y-2 bg-muted/30 p-3 rounded-lg border border-dashed">
                <Label className="text-sm">Jumlah (Rp)</Label>
                <Input 
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formData.jumlah}
                  onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      const formatted = value ? new Intl.NumberFormat('id-ID').format(Number(value)) : '';
                      setFormData({...formData, jumlah: formatted});
                  }}
                  required
                  className="text-xl font-bold h-12 text-right tracking-wide"
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Tanggal Nota/Struk</Label>
                  <Input 
                    type="datetime-local"
                    value={formData.tanggal}
                    onChange={(e) => setFormData(prev => ({ ...prev, tanggal: e.target.value }))}
                    required
                    className="h-11"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-sm">Kategori</Label>
                  <Select 
                    value={formData.kategori} 
                    onValueChange={(v) => setFormData({...formData, kategori: v as 'BBM' | 'Makan' | 'Parkir' | 'Tol' | 'Operasional' | 'Lainnya'})}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Pilih Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BBM">BBM</SelectItem>
                      <SelectItem value="Makan">Makan</SelectItem>
                      <SelectItem value="Parkir">Parkir</SelectItem>
                      <SelectItem value="Tol">Tol</SelectItem>
                      <SelectItem value="Operasional">Operasional</SelectItem>
                      <SelectItem value="Lainnya">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Bukti (Struk/Nota)</Label>
                <div 
                    className="border border-dashed border-input rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-accent/50 transition-colors bg-background relative overflow-hidden"
                    onClick={() => document.getElementById('bukti-upload-re')?.click()}
                >
                  {previewUrl ? (
                      <div className="relative w-full h-48">
                          <img 
                            src={previewUrl} 
                            alt="Preview Bukti" 
                            className="w-full h-full object-contain rounded-lg"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                              <p className="text-white font-medium">Klik untuk ganti</p>
                          </div>
                      </div>
                  ) : (
                      <>
                        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Upload Foto/Bukti</p>
                        <p className="text-xs text-muted-foreground mt-1">Hanya gambar (Max 10MB)</p>
                      </>
                  )}
                  <Input 
                    id="bukti-upload-re"
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={uploading} 
                className="w-full h-12 text-base font-semibold mt-4 shadow-lg shadow-primary/20 rounded-xl"
              >
                <Save className={`w-5 h-5 mr-2 ${uploading ? 'animate-spin' : ''}`} />
                {uploading ? 'Mengirim...' : 'Kirim Pengajuan'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
