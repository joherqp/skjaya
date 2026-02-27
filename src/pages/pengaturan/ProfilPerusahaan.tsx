import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Building2, Save, CreditCard, Shield, AlertTriangle, CalendarClock, Activity, CheckCircle, XCircle, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '@/contexts/DatabaseContext';
import { supabase } from '@/lib/supabase';

export default function ProfilPerusahaan() {
  const navigate = useNavigate();
  const { profilPerusahaan, updateProfilPerusahaan } = useDatabase();
  const [isLoading, setIsLoading] = useState(false);

  // Company Data State
  const [formData, setFormData] = useState({
    nama: '',
    alamat: '',
    telepon: '',
    email: '',
    website: '',
    deskripsi: ''
  });

  // Sales Settings State
  const [settings, setSettings] = useState({
    enableCredit: true,
    defaultCreditTerms: 0,
    useGlobalLimit: false,
    globalLimitAmount: 0,
    blockOnDebt: true,
    blockMode: 'strict' as 'strict' | 'limit_only' | 'soft' | 'hard',
    daysToFetch: 30,
    enableClosing: false,
    closingStartTime: '21:00',
    closingEndTime: '08:00',
    isMaintenance: false,
    maintenanceMessage: 'Aplikasi sedang dalam perbaikan rutin. Silakan coba lagi nanti.'
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'optimal' | 'moderate' | 'heavy';
    count: number;
    message: string;
  } | null>(null);

  const handleTestPerformance = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const days = settings.daysToFetch || 30;
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - days);
      limitDate.setHours(0, 0, 0, 0);

      // Check main transaction table (penjualan)
      const { count, error } = await supabase
        .from('penjualan')
        .select('*', { count: 'exact', head: true })
        .gte('tanggal', limitDate.toISOString());

      if (error) throw error;

      const totalRecords = count || 0;
      let status: 'optimal' | 'moderate' | 'heavy' = 'optimal';
      let message = "Aplikasi akan berjalan sangat lancar.";

      if (totalRecords > 5000) {
        status = 'heavy';
        message = "Jumlah data sangat besar. Disarankan untuk memeperpendek periode data agar aplikasi tidak lambat.";
      } else if (totalRecords > 1000) {
        status = 'moderate';
        message = "Jumlah data cukup banyak. Aplikasi mungkin terasa sedikit lambat saat memuat data awal.";
      }

      setTestResult({
        status,
        count: totalRecords,
        message
      });

    } catch (err) {
      console.error("Test failed", err);
      toast.error("Gagal melakukan tes performa");
    } finally {
      setIsTesting(false);
    }
  };

  // Load data from context
  useEffect(() => {
    if (profilPerusahaan) {
      setFormData({
        nama: profilPerusahaan.nama,
        alamat: profilPerusahaan.alamat,
        telepon: profilPerusahaan.telepon,
        email: profilPerusahaan.email,
        website: profilPerusahaan.website,
        deskripsi: profilPerusahaan.deskripsi || ''
      });

      if (profilPerusahaan.config) {
        setSettings(prev => ({ ...prev, ...profilPerusahaan.config }));
      }
    }
  }, [profilPerusahaan]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);

    try {
      // Update context with both company data and sales config
      await updateProfilPerusahaan({
        ...formData,
        config: settings
      });

      // Simulate short delay for UX
      await new Promise(resolve => setTimeout(resolve, 500));

      toast.success('Profil dan pengaturan berhasil disimpan!');
    } catch (error) {
      toast.error('Gagal menyimpan perubahan');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout title="Profil Perusahaan">
      <div className="p-4 max-w-2xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/pengaturan')}
          className="pl-0 hover:bg-transparent hover:text-primary"
        >
          ← Kembali ke Pengaturan
        </Button>

        {/* --- Card 1: Data Perusahaan --- */}
        <Card elevated>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Data Perusahaan</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nama">Nama Perusahaan</Label>
              <Input
                id="nama"
                name="nama"
                value={formData.nama}
                onChange={handleChange}
                placeholder="Masukkan nama perusahaan"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="alamat">Alamat Lengkap</Label>
              <Textarea
                id="alamat"
                name="alamat"
                value={formData.alamat}
                onChange={handleChange}
                placeholder="Masukkan alamat perusahaan"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telepon">Nomor Telepon</Label>
                <Input
                  id="telepon"
                  name="telepon"
                  value={formData.telepon}
                  onChange={handleChange}
                  placeholder="Contoh: 021-1234567"
                  type="tel"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="email@perusahaan.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="www.perusahaan.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deskripsi">Deskripsi Singkat</Label>
              <Textarea
                id="deskripsi"
                name="deskripsi"
                value={formData.deskripsi}
                onChange={handleChange}
                placeholder="Deskripsi singkat tentang perusahaan"
              />
            </div>
          </CardContent>
        </Card>

        {/* --- Card 2: Metode Pembayaran --- */}
        <Card elevated>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Metode Pembayaran
            </CardTitle>
            <CardDescription>Atur metode pembayaran yang diizinkan saat transaksi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Izinkan Pembayaran Kredit (Tempo)</Label>
                <p className="text-sm text-muted-foreground">Aktifkan opsi "Kredit" di halaman penjualan.</p>
              </div>
              <Switch
                checked={settings.enableCredit}
                onCheckedChange={(c) => setSettings(s => ({
                  ...s,
                  enableCredit: c,
                  // If disabling credit, also disable dependent settings
                  ...(c === false ? {
                    useGlobalLimit: false,
                    blockOnDebt: false,
                    globalLimitAmount: 0 // Reset limit 0
                  } : {})
                }))}
              />
            </div>

            {settings.enableCredit && (
              <div className="pl-4 border-l-2 border-primary/20 ml-2 animate-slide-down">
                <Label>Termin Pembayaran Default (Hari)</Label>
                <Input
                  type="number"
                  min={0}
                  value={settings.defaultCreditTerms}
                  onChange={(e) => setSettings(s => ({ ...s, defaultCreditTerms: Number(e.target.value) }))}
                  className="mt-1.5 w-32"
                  placeholder="Contoh: 30"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Jatuh tempo otomatis dihitung sekian hari dari tanggal transaksi.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* --- Card 3: Limit & Proteksi Kredit --- */}
        <Card elevated className={!settings.enableCredit ? "opacity-50 pointer-events-none grayscale" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Limit & Proteksi Kredit
            </CardTitle>
            <CardDescription>Atur batasan hutang dan proteksi penjualan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Global Limit section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Gunakan Limit Kredit Global</Label>
                  <p className="text-sm text-muted-foreground">Terapkan satu limit yang sama untuk SEMUA pelanggan (mengabaikan limit per-pelanggan).</p>
                </div>
                <Switch
                  checked={settings.useGlobalLimit}
                  disabled={!settings.enableCredit}
                  onCheckedChange={(c) => setSettings(s => ({ ...s, useGlobalLimit: c }))}
                />
              </div>

              {settings.useGlobalLimit && (
                <div className="pl-4 border-l-2 border-primary/20 ml-2 animate-slide-down">
                  <Label>Nominal Limit Global (Rp)</Label>
                  <Input
                    type="number"
                    value={settings.globalLimitAmount}
                    onChange={(e) => setSettings(s => ({ ...s, globalLimitAmount: Number(e.target.value) }))}
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Pelanggan tidak bisa hutang jika total hutang melebihi angka ini.
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Blocking Logic */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Blokir Penjualan Jika Ada Hutang</Label>
                  <p className="text-sm text-muted-foreground">
                    Cegah pembuatan nota baru jika pelanggan masih memiliki tanggungan.
                  </p>
                </div>
                <Switch
                  checked={settings.blockOnDebt}
                  disabled={!settings.enableCredit}
                  onCheckedChange={(c) => setSettings(s => ({ ...s, blockOnDebt: c }))}
                />
              </div>

              {settings.blockOnDebt && (
                <div className="pl-4 border-l-2 border-primary/20 ml-2 space-y-4 animate-slide-down">
                  <div className="space-y-2">
                    <Label>Mode Pemblokiran</Label>
                    <Select
                      value={settings.blockMode}
                      onValueChange={(v: 'strict' | 'limit_only') => setSettings(s => ({ ...s, blockMode: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="strict">Semua Produk (Ketat)</SelectItem>
                        <SelectItem value="limit_only">Multi / Sisa Limit (Longgar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {settings.blockMode === 'strict' && (
                    <div className="p-3 bg-red-50 text-red-800 text-sm rounded-md flex gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <p>Pelanggan <strong>TIDAK BISA</strong> belanja lagi jika ada 1 nota pun yang belum lunas, berapapun nominalnya.</p>
                    </div>
                  )}

                  {settings.blockMode === 'limit_only' && (
                    <div className="p-3 bg-blue-50 text-blue-800 text-sm rounded-md flex gap-2">
                      <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                      <p>Pelanggan <strong>BISA</strong> belanja lagi (Multiple Invoice) selama total hutang masih di bawah Limit Kredit.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* --- Card 4: Pengaturan Data & Sistem --- */}
        <Card elevated>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary" />
              Batas Waktu Data
            </CardTitle>
            <CardDescription>
              Atur seberapa lama data transaksi ditampilkan di aplikasi utama.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Periode Data Transaksi</Label>
                <p className="text-sm text-muted-foreground">
                  Data yang lebih lama dari periode ini akan masuk ke Arsip.
                </p>
              </div>
              <Select
                value={settings.daysToFetch?.toString() || '30'}
                onValueChange={(v) => setSettings(s => ({ ...s, daysToFetch: parseInt(v) }))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 Hari (Default)</SelectItem>
                  <SelectItem value="60">60 Hari (2 Bulan)</SelectItem>
                  <SelectItem value="90">90 Hari (3 Bulan)</SelectItem>
                  <SelectItem value="180">180 Hari (6 Bulan)</SelectItem>
                  <SelectItem value="365">1 Tahun</SelectItem>
                  <SelectItem value="730">2 Tahun</SelectItem>
                  <SelectItem value="1095">3 Tahun</SelectItem>
                  <SelectItem value="1460">4 Tahun</SelectItem>
                  <SelectItem value="1825">5 Tahun</SelectItem>
                </SelectContent>
              </Select>
            </div>


            {/* Performance Test Section */}
            <div className="pt-2 border-t mt-4">
              <div className="flex items-center justify-between mb-4">
                <Label>Estimasi Performa</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestPerformance}
                  disabled={isTesting}
                  className="gap-2"
                >
                  {isTesting ? (
                    <Activity className="w-4 h-4 animate-spin" />
                  ) : (
                    <Activity className="w-4 h-4" />
                  )}
                  Cek Performa
                </Button>
              </div>

              {testResult && (
                <div className={`p-4 rounded-lg border ${testResult.status === 'optimal' ? 'bg-green-50 border-green-200 text-green-900' :
                  testResult.status === 'moderate' ? 'bg-yellow-50 border-yellow-200 text-yellow-900' :
                    'bg-red-50 border-red-200 text-red-900'
                  } space-y-2 animate-in slide-in-from-top-2`}>
                  <div className="flex items-center gap-2 font-semibold">
                    {testResult.status === 'optimal' ? <CheckCircle className="w-5 h-5 text-green-600" /> :
                      testResult.status === 'moderate' ? <AlertTriangle className="w-5 h-5 text-yellow-600" /> :
                        <XCircle className="w-5 h-5 text-red-600" />}

                    {testResult.status === 'optimal' ? 'Performa Optimal' :
                      testResult.status === 'moderate' ? 'Performa Sedang' :
                        'Performa Berat'}
                  </div>

                  <div className="text-sm">
                    <p>Estimasi Data: <strong>{testResult.count.toLocaleString()} transaksi</strong> dalam {settings.daysToFetch} hari terakhir.</p>
                    <p className="mt-1">{testResult.message}</p>
                  </div>
                </div>
              )}

              {!testResult && (
                <div className="p-3 bg-blue-50 text-blue-800 text-xs rounded-md flex gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>
                    Catatan: Semakin lama periode data, semakin banyak data yang dimuat saat aplikasi dibuka.
                    Gunakan Arsip Penjualan untuk melihat data yang sangat lama agar performa aplikasi tetap cepat.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* --- Card 5: Operasional & Maintenance --- */}
        <Card elevated>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              Operasional & Maintenance
            </CardTitle>
            <CardDescription>
              Atur jam operasional input data dan mode pemeliharaan aplikasi.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Closing Time section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Aktifkan Jam Closing</Label>
                  <p className="text-sm text-muted-foreground text-xs">Batasi input penjualan pada jam tertentu saja.</p>
                </div>
                <Switch
                  checked={settings.enableClosing}
                  onCheckedChange={(c) => setSettings(s => ({ ...s, enableClosing: c }))}
                />
              </div>

              {settings.enableClosing && (
                <div className="pl-4 border-l-2 border-primary/20 ml-2 space-y-4 animate-slide-down">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Mulai Closing (Tutup)</Label>
                      <Input
                        type="time"
                        value={settings.closingStartTime}
                        onChange={(e) => setSettings(s => ({ ...s, closingStartTime: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Selesai Closing (Buka)</Label>
                      <Input
                        type="time"
                        value={settings.closingEndTime}
                        onChange={(e) => setSettings(s => ({ ...s, closingEndTime: e.target.value }))}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    * Selama jam closing, menu 'Tambah Penjualan' tidak dapat diakses untuk mencegah input di luar jam kerja.
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Maintenance Mode section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-destructive font-bold">Mode Perbaikan (Maintenance)</Label>
                  <p className="text-xs text-muted-foreground text-destructive/80">
                    Aktifkan jika aplikasi sedang dalam pemeliharaan. Hanya Admin yang bisa login.
                  </p>
                </div>
                <Switch
                  checked={settings.isMaintenance}
                  onCheckedChange={(c) => setSettings(s => ({ ...s, isMaintenance: c }))}
                />
              </div>

              {settings.isMaintenance && (
                <div className="pl-4 border-l-2 border-red-500/20 ml-2 space-y-2 animate-slide-down">
                  <Label className="text-xs">Pesan Maintenance</Label>
                  <Textarea
                    value={settings.maintenanceMessage}
                    onChange={(e) => setSettings(s => ({ ...s, maintenanceMessage: e.target.value }))}
                    placeholder="Tuliskan pesan untuk pengguna..."
                    rows={3}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* --- Floating Save Button --- */}
        <div className="sticky bottom-4 z-40 bg-background/80 backdrop-blur-sm p-4 border rounded-xl shadow-lg flex justify-end animate-in slide-in-from-bottom-5">
          <Button onClick={() => handleSubmit()} disabled={isLoading} size="lg" className="w-full sm:w-auto shadow-primary/20 shadow-lg">
            {isLoading ? 'Menyimpan...' : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Simpan Semua Perubahan
              </>
            )}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
