import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { Wallet, Upload, ArrowLeft, Save, ArrowUpCircle, ArrowDownCircle, Info } from 'lucide-react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/imageCompression';

export default function TambahPettyCash() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type') as 'masuk' | 'keluar' || 'keluar';
  
  const { user } = useAuth();
  const { addPettyCash } = useDatabase();
  
  const [formData, setFormData] = useState({
    keterangan: '',
    jumlah: '',
    kategori: 'umum',
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
            const fileName = `pettycash-${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('bukti-petty-cash')
                .upload(filePath, selectedFile);

            if (uploadError) {
                console.error('Upload proof error:', uploadError);
                toast.error('Gagal mengupload bukti transaksi');
                setUploading(false);
                return;
            }

            const { data: urlData } = supabase.storage
                .from('bukti-petty-cash')
                .getPublicUrl(filePath);
            
            finalBuktiUrl = urlData.publicUrl;
        }

        await addPettyCash({
            tanggal: new Date(formData.tanggal),
            keterangan: formData.keterangan,
            jumlah: parseFloat(formData.jumlah.replace(/\./g, '')),
            tipe: typeParam,
            kategori: formData.kategori,
            buktiUrl: finalBuktiUrl,
            createdBy: user.id
        });
        
        toast.success('Transaksi berhasil dicatat');
        navigate('/petty-cash');
    } catch (error) {
        console.error('Petty cash error:', error);
        toast.error('Gagal mencatat transaksi');
    } finally {
        setUploading(false);
    }
  };

  return (
    <MainLayout title={typeParam === 'masuk' ? 'Tambah Dana' : 'Catat Pengeluaran'}>
      <div className="p-3 w-full max-w-md mx-auto space-y-4 pb-20">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/petty-cash')}
            className="pl-0 h-auto hover:bg-transparent"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-base font-medium">Kembali</span>
          </Button>
        </div>

        <Card className="border-none shadow-sm sm:border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${typeParam === 'masuk' ? 'bg-green-100' : 'bg-red-100'}`}>
                {typeParam === 'masuk' ? (
                  <ArrowUpCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <ArrowDownCircle className="w-5 h-5 text-red-600" />
                )}
              </div>
              <CardTitle className="text-lg">
                {typeParam === 'masuk' ? 'Input Pemasukan' : 'Input Pengeluaran'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-5">
            <div className={`border rounded-xl p-3 flex gap-3 items-start ${typeParam === 'masuk' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
              <Info className={`w-5 h-5 mt-0.5 shrink-0 ${typeParam === 'masuk' ? 'text-green-600' : 'text-red-600'}`} />
              <p className={`text-xs leading-relaxed ${typeParam === 'masuk' ? 'text-green-700' : 'text-red-700'}`}>
                {typeParam === 'masuk' 
                  ? 'Gunakan form ini untuk mencatat penambahan saldo kas kecil (petty cash).' 
                  : 'Gunakan form ini untuk mencatat pengeluaran operasional yang menggunakan kas kecil.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-sm">Keterangan</Label>
                <Textarea 
                  placeholder={typeParam === 'masuk' ? "Contoh: Penarikan dari Bank" : "Contoh: Beli kopi tamu"}
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
                  <Label className="text-sm">Tanggal & Waktu</Label>
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
                  <Select value={formData.kategori} onValueChange={(val) => setFormData({...formData, kategori: val})}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="umum">Umum</SelectItem>
                      <SelectItem value="konsumsi">Konsumsi</SelectItem>
                      <SelectItem value="transport">Transport</SelectItem>
                      <SelectItem value="atk">ATK</SelectItem>
                      <SelectItem value="lainnya">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Bukti (Opsional)</Label>
                <div 
                    className="border border-dashed border-input rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-accent/50 transition-colors bg-background relative overflow-hidden"
                    onClick={() => document.getElementById('bukti-upload-pc')?.click()}
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
                    id="bukti-upload-pc"
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
                className={`w-full h-12 text-base font-semibold mt-4 shadow-lg rounded-xl ${
                  typeParam === 'masuk' 
                    ? 'bg-green-600 hover:bg-green-700 shadow-green-200' 
                    : 'bg-red-600 hover:bg-red-700 shadow-red-200'
                }`}
              >
                <Save className={`w-5 h-5 mr-2 ${uploading ? 'animate-spin' : ''}`} />
                {uploading ? 'Menyimpan...' : 'Simpan Transaksi'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
