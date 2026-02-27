import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Wallet, Upload, Save, ArrowLeft, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Switch } from '@/components/ui/switch';


import { compressImage } from '@/lib/imageCompression';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Setoran } from '@/lib/types';

export default function TambahSetoran() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addSetoran, addPersetujuan, rekeningBank, users, saldoPengguna, cabang } = useDatabase();
  
  const currentUserSaldo = saldoPengguna.find(s => s.userId === user?.id)?.saldo || 0;

  const [formData, setFormData] = useState({
    rekeningId: '',
    metode: '',
    jumlah: '',
    tanggal: new Date().toISOString().slice(0, 16), // datetime-local format
    keterangan: '',
    buktiFotoUrl: '',
    recipientUserId: '',
    sumberDana: 'global' // 'global' or 'cabang_id'
  });

  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filterFinanceOnly, setFilterFinanceOnly] = useState(true);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Ukuran file maksimal 10MB');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Hanya file gambar yang diperbolehkan');
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

  const handleSetAllSaldo = () => {
      const formattedValue = new Intl.NumberFormat('id-ID').format(currentUserSaldo);
      setFormData(prev => ({ ...prev, jumlah: formattedValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.metode || !formData.jumlah) {
      toast.error('Pilih metode setoran dan masukkan jumlah');
      return;
    }

    const amount = parseInt(formData.jumlah.replace(/\./g, ''));
    if (isNaN(amount) || amount <= 0) {
      toast.error('Jumlah setoran tidak valid');
      return;
    }
    
    
    // Check balance limit
    // Allow exemptions for certain roles to deposit more than recorded balance
    const isExemptCheck = user?.roles.includes('finance') || user?.roles.includes('sales') || user?.roles.includes('admin') || user?.roles.includes('owner');
    
    if (amount > currentUserSaldo && !isExemptCheck) {
        toast.error('Saldo tidak mencukupi');
        return;
    }

    // Resolve Rekening/Kas Destination
    let destinationRekeningId = '';
    
    // Filter accounts for the target recipient
    const recipientAccounts = rekeningBank.filter(b => {
        if (formData.recipientUserId === 'admin_pusat') {
             // For admin, check if no assigned user OR assigned to admin/finance
             const owner = users.find(u => u.id === b.assignedUserId);
             return !b.assignedUserId || (owner && (owner.roles.includes('admin') || owner.roles.includes('owner') || owner.roles.includes('finance')));
        } else {
             return b.assignedUserId === formData.recipientUserId;
        }
    });

    // Find match for method
    const isTunaiMethod = formData.metode === 'tunai';
    const matchedAccount = recipientAccounts.find(b => b.isTunai === isTunaiMethod);

    if (matchedAccount) {
        destinationRekeningId = matchedAccount.id;
    } else {
        const recipientName = formData.recipientUserId === 'admin_pusat' ? 'Pusat' : (users.find(u => u.id === formData.recipientUserId)?.nama || 'Penerima');
        toast.error(`${recipientName} tidak memiliki akun ${isTunaiMethod ? 'Kas Tunai' : 'Bank'} yang terdaftar.`);
        return;
    }

    try {
        setUploading(true);
        let finalBuktiUrl = formData.buktiFotoUrl;

        // Upload File if selected
        if (selectedFile) {
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `setoran-${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('bukti-setoran')
                .upload(filePath, selectedFile);

            if (uploadError) {
                console.error('Upload error:', uploadError);
                toast.error('Gagal mengupload bukti payment. Lanjutkan tanpa bukti?');
                // Optional: return; to stop, or continue without image. 
                // Let's stop to be safe implies user wanted image.
                setUploading(false);
                return;
            }

            const { data: urlData } = supabase.storage
                .from('bukti-setoran')
                .getPublicUrl(filePath);
                
            finalBuktiUrl = urlData.publicUrl;
        }

        const setoranId = self.crypto.randomUUID();
        const persetujuanId = self.crypto.randomUUID();

        // Use current user's branch or fallback to a default if absolutely necessary (though ideally user should have one)
        // Assuming '550e8400-e29b-41d4-a716-446655440002' is Pusat/Default if undefined, or handle error.
        // Use selected source branch if not global, otherwise user's branch
        const cabangId = formData.sumberDana === 'global' 
          ? (user?.cabangId || '550e8400-e29b-41d4-a716-446655440002') 
          : formData.sumberDana; 

        await addSetoran({
          id: setoranId,
          nomorSetoran: `DEP/${Date.now().toString().slice(-6)}`,
          salesId: user?.id || 'sales-1', // Ideally should be real user ID
          cabangId: cabangId,
          rekeningId: destinationRekeningId,
          jumlah: amount,
          tanggal: new Date(formData.tanggal),
          buktiUrl: finalBuktiUrl || 'https://placehold.co/400x600?text=Bukti+Transfer',
          status: 'pending',
          catatan: formData.keterangan || 'Setoran Penjualan', 
          createdAt: new Date(),
          createdBy: user?.id || 'system',
          updatedBy: user?.id || 'system'
        } as unknown as Setoran);

        // Create Approval Notification
        // Determine Target for Approval
        // If specific user selected -> Target that User
        // If 'admin_pusat' -> Target 'admin' role
        const isDirectToPusat = formData.recipientUserId === 'admin_pusat';
        const targetUserId = isDirectToPusat ? null : formData.recipientUserId;
        const targetRole = isDirectToPusat ? 'admin' : null; // If user selected, role is secondary/null
        // If direct to pusat, targetCabangId should be null (global) ??
        // User said "search name in same branch". So if I select a user, it's a branch approval.
        // If I select 'admin_pusat', it's global? Or just skipped to stage 2?
        // Let's assume standard flow:
        // If User Selected -> Stage 1 (Branch Level) targeting that User.
        // If Admin Pusat -> Stage 2 (Central Level) targeting Admin.

        await addPersetujuan({
          id: persetujuanId,
          jenis: 'setoran',
          referensiId: setoranId,
          status: 'pending',
          targetRole: targetRole, 
          targetUserId: targetUserId,
          targetCabangId: isDirectToPusat ? null : cabangId, 
          diajukanOleh: user?.id || 'system',
          tanggalPengajuan: new Date(),
          catatan: formData.keterangan || 'Setoran Penjualan',
          data: {
              amount: amount,
              rekeningTujuanId: destinationRekeningId,
              buktiUrl: finalBuktiUrl,
              tanggal: formData.tanggal,
              senderCabangId: user?.cabangId
          }
        });

        // NOTIFICATION LOGIC
        // Send Notification to recipient
        // Helper to find recipient users
        let notificationTargets: string[] = [];
        
        if (targetUserId) {
            notificationTargets.push(targetUserId);
        } else if (targetRole) {
            // Find all users with this role in the target scope
            // If admin, global
            if (targetRole === 'admin' || targetRole === 'owner') {
                 notificationTargets = users
                    .filter(u => u.roles.includes('admin') || u.roles.includes('owner'))
                    .map(u => u.id);
            }
        }

        // Send to each target
        const amountFormatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);

        const senderName = user?.nama || 'Seseorang';
        
        // We need to use addNotifikasi from context, but we can't await inside loop if we want speed, 
        // but here it's fine.
        // To avoid bringing `addNotifikasi` into dependency array if not needed, we assume it's stable.
        
        // HACK: Use direct supabase or just fire and forget? 
        // We have `addSetoran` etc, we should have `addNotifikasi` in context?
        // Checked file content earlier, `addNotifikasi` is present in `useDatabase`.
        // BUT we didn't destructure it in line 20. Need to add it.
        // WAIT, line 20: `const { addSetoran, addPersetujuan, ... } = useDatabase();`
        // I need to add `addNotifikasi` to destructure in a separate edit or just trust I added it? 
        // No, I must add it to the component.
        // Since this is a ReplaceFileContent of the submit handler, I can't easily change line 20.
        // I will use `supabase` directly for notifications here to avoid changing the component signature in this block
        // OR I can use a multi-step approach.
        // Actually, `supabase` is imported.

        const notifPromises = notificationTargets.map(targetId => {
             return supabase.from('notifikasi').insert({
                 user_id: targetId,
                 judul: 'Setoran Baru Masuk',
                 pesan: `${senderName} menyetor ${amountFormatted}. Harap verifikasi.`,
                 jenis: 'info',
                 link: '/persetujuan'
             });
        });
        
        await Promise.all(notifPromises);


        toast.success('Permintaan setoran berhasil dikirim');
        navigate('/setoran');
        
    } catch (err) {
        console.error('Submit error:', err);
        toast.error('Gagal mengirim setoran');
    } finally {
        setUploading(false);
    }
  };

  return (
    <MainLayout title="Buat Setoran">
      <div className="p-3 w-full max-w-md mx-auto space-y-4 pb-20"> {/* Added pb-20 and reduced padding for mobile */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/setoran')}
            className="pl-0 h-auto hover:bg-transparent"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="text-base font-medium">Kembali</span>
          </Button>

          {(user?.roles.includes('finance') || user?.roles.includes('admin') || user?.roles.includes('owner')) && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/setoran/rencana')}
              className="w-full sm:w-auto text-indigo-600 border-indigo-200 bg-indigo-50/50"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Setor ke Pusat
            </Button>
          )}
        </div>

        <Card elevated className="border-none shadow-sm sm:border">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Form Setoran</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-5">
             <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-3 items-start">
               <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
               <p className="text-xs text-blue-700 leading-relaxed">
                 Pastikan Anda sudah melakukan transfer sebelum mengisi form. Setoran akan diverifikasi.
               </p>
             </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Sumber Dana (Mobile Friendly) */}
              {(user?.roles.includes('admin') || user?.roles.includes('owner')) && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Sumber Dana</Label>
                  <Select 
                    value={formData.sumberDana}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, sumberDana: val }))}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Pilih Sumber Dana..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Saldo Global (Gabungan)</SelectItem>
                      {cabang.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Penerima */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Penerima</Label>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="finance-only" 
                      checked={filterFinanceOnly} 
                      onCheckedChange={setFilterFinanceOnly}
                      className="scale-75"
                    />
                    <Label htmlFor="finance-only" className="text-[10px] font-medium text-muted-foreground uppercase cursor-pointer">
                      Finance Only
                    </Label>
                  </div>
                </div>
                <SearchableSelect 
                  options={users
                    .filter(u => {
                      if (!u.isActive || u.id === user?.id) return false;
                      if (filterFinanceOnly && !u.roles.includes('finance')) return false;
                      return !user?.cabangId || u.cabangId === user.cabangId;
                    })
                    .map(u => ({ value: u.id, label: u.nama }))
                  }
                  value={formData.recipientUserId}
                  onChange={(val) => setFormData(prev => ({ ...prev, recipientUserId: val }))}
                  placeholder={filterFinanceOnly ? "Cari Finance..." : "Cari Nama Penerima..."}
                />
              </div>

              {/* Metode Setoran */}
              <div className="space-y-1.5">
                <Label className="text-sm">Metode</Label>
                <Select 
                  value={formData.metode}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, metode: val }))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Metode Transfer/Tunai" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="transfer">Transfer Bank</SelectItem>
                     <SelectItem value="tunai">Tunai (Cash)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 bg-muted/30 p-3 rounded-lg border border-dashed">
                <div className="flex justify-between items-center">
                    <Label className="text-sm">Jumlah Setoran (Rp)</Label>
                    <button 
                        type="button" 
                        onClick={handleSetAllSaldo}
                        className="text-xs text-primary font-medium px-2 py-1 bg-primary/10 rounded hover:bg-primary/20 transition-colors"
                    >
                        Max: {new Intl.NumberFormat('id-ID').format(currentUserSaldo)}
                    </button>
                </div>
                <Input 
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formData.jumlah}
                  onChange={(e) => {
                    const cleanValue = e.target.value.replace(/\D/g, '');
                    const formattedValue = new Intl.NumberFormat('id-ID').format(Number(cleanValue || 0));
                    setFormData(prev => ({ 
                      ...prev, 
                      jumlah: cleanValue === '' ? '' : formattedValue 
                    }));
                  }}
                  required
                  className="text-xl font-bold h-12 text-right tracking-wide"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Waktu Transfer</Label>
                <Input 
                  type="datetime-local"
                  value={formData.tanggal}
                  onChange={(e) => setFormData(prev => ({ ...prev, tanggal: e.target.value }))}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Bukti (Opsional)</Label>
                <div 
                    className="border border-dashed border-input rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-accent/50 transition-colors bg-background relative overflow-hidden"
                    onClick={() => document.getElementById('bukti-upload')?.click()}
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
                        <p className="text-xs text-muted-foreground mt-1">Hanya gambar (Max 5MB)</p>
                      </>
                  )}
                  <Input 
                    id="bukti-upload"
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Catatan</Label>
                <Textarea 
                  placeholder="Keterangan..."
                  className="resize-none h-20"
                  value={formData.keterangan}
                  onChange={(e) => setFormData(prev => ({ ...prev, keterangan: e.target.value }))}
                />
              </div>

              <Button type="submit" disabled={uploading} className="w-full h-12 text-base font-semibold mt-4 shadow-lg shadow-primary/20 rounded-xl">
                <Save className={`w-5 h-5 mr-2 ${uploading ? 'animate-spin' : ''}`} />
                {uploading ? 'Mengirim...' : 'Kirim Setoran'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
