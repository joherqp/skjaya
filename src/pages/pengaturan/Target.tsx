import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card as CardContainer } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatRupiah, formatTanggal } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Pencil, Trash2, Target, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { User, Cabang } from '@/lib/types';

// Define DB Row Interface
interface SalesTargetRow {
  id: string;
  jenis: 'bulanan' | 'mingguan' | 'harian';
  target_type: 'nominal' | 'qty';
  nilai: number;
  scope: 'cabang' | 'sales';
  cabang_id?: string;
  sales_id?: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  is_looping: boolean;
  sales?: { nama: string };
  cabang?: { nama: string };
}

// Form State Interface (keeping camelCase for internal form state)
interface TargetFormData {
  id?: string;
  jenis: 'bulanan' | 'mingguan' | 'harian';
  targetType: 'nominal' | 'qty';
  scope: 'cabang' | 'sales';
  nilai: number;
  isActive: boolean;
  isLooping: boolean;
  startDate: Date;
  endDate: Date;
  cabangId?: string;
  salesId?: string;
}

export default function TargetPage() {
  const { user } = useAuth();
  const [targets, setTargets] = useState<SalesTargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [salesList, setSalesList] = useState<User[]>([]);
  const [cabangList, setCabangList] = useState<Cabang[]>([]);

  // Adjustment State
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [selectedTargetAdjust, setSelectedTargetAdjust] = useState<SalesTargetRow | null>(null);
  const [newTargetValue, setNewTargetValue] = useState<number>(0);

  // Form State
  const [formData, setFormData] = useState<TargetFormData>({
    jenis: 'bulanan',
    targetType: 'nominal',
    scope: 'sales',
    nilai: 0,
    isActive: true,
    isLooping: false,
    startDate: new Date(),
    endDate: new Date(),
  });

  useEffect(() => {
    fetchTargets();
    fetchSalesAndCabang();
  }, []);

  const fetchTargets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales_targets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Manual Fetch (Fix for missing FK)
      const salesIds = [...new Set((data as SalesTargetRow[]).map(t => t.sales_id).filter(id => id))];
      const cabangIds = [...new Set((data as SalesTargetRow[]).map(t => t.cabang_id).filter(id => id))];

      const salesMap: Record<string, string> = {};
      const cabangMap: Record<string, string> = {};

      if (salesIds.length > 0) {
        const { data: users } = await supabase.from('users').select('id, nama').in('id', salesIds);
        users?.forEach((u: any) => salesMap[u.id] = u.nama);
      }
      if (cabangIds.length > 0) {
        const { data: cabangs } = await supabase.from('cabang').select('id, nama').in('id', cabangIds);
        cabangs?.forEach((c: any) => cabangMap[c.id] = c.nama);
      }

      const processedData = (data as SalesTargetRow[]).map(t => ({
        ...t,
        sales: t.sales_id ? { nama: salesMap[t.sales_id] || 'Unknown' } : undefined,
        cabang: t.cabang_id ? { nama: cabangMap[t.cabang_id] || 'Unknown' } : undefined
      }));

      setTargets(processedData || []);
    } catch (error) {
      console.error('Error fetching targets:', error);
      toast.error('Gagal memuat data target');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesAndCabang = async () => {
    try {
      // Fetch Sales
      const { data: salesData } = await supabase
        .from('users')
        .select('*')
        .contains('roles', ['sales'])
        .eq('is_active', true);

      if (salesData) setSalesList(salesData as User[]);

      // Fetch Cabang
      const { data: cabangData } = await supabase
        .from('cabang')
        .select('*');

      if (cabangData) setCabangList(cabangData);

    } catch (error) {
      console.error('Error fetching options:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      if (!formData.nilai || formData.nilai <= 0) {
        toast.error('Nilai target harus lebih dari 0');
        return;
      }

      if (formData.scope === 'sales' && !formData.salesId) {
        toast.error('Pilih sales');
        return;
      }

      if (formData.scope === 'cabang' && !formData.cabangId) {
        toast.error('Pilih cabang');
        return;
      }

      const payload = {
        jenis: formData.jenis,
        target_type: formData.targetType,
        scope: formData.scope,
        nilai: formData.nilai,
        is_active: formData.isActive,
        is_looping: formData.isLooping,
        start_date: formData.startDate.toISOString(), // Always save start_date
        end_date: formData.isLooping ? null : formData.endDate.toISOString(), // Only end_date is null for looping
        cabang_id: formData.scope === 'cabang' ? formData.cabangId : null,
        sales_id: formData.scope === 'sales' ? formData.salesId : null,
        target_amount: formData.nilai, // Required by DB
        created_by: user?.id,
      };

      if (formData.id) {
        // Update
        const { error } = await supabase
          .from('sales_targets')
          .update(payload)
          .eq('id', formData.id);
        if (error) throw error;
        toast.success('Target berhasil diperbarui');
      } else {
        // Create
        const { error } = await supabase
          .from('sales_targets')
          .insert([payload]);
        if (error) throw error;
        toast.success('Target berhasil dibuat');
      }

      setIsDialogOpen(false);
      fetchTargets();
      resetForm();
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error saving target:', err);
      toast.error('Gagal menyimpan target: ' + err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      jenis: 'bulanan',
      targetType: 'nominal',
      scope: 'sales',
      nilai: 0,
      isActive: true,
      isLooping: false,
      startDate: new Date(),
      endDate: new Date(),
    });
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus target ini?')) return;
    try {
      const { error } = await supabase.from('sales_targets').delete().eq('id', id);
      if (error) throw error;
      toast.success('Target berhasil dihapus');
      fetchTargets();
    } catch (error) {
      console.error('Error deleting target:', error);
      toast.error('Gagal menghapus target');
    }
  };

  const handleEdit = (target: SalesTargetRow) => {
    setFormData({
      id: target.id,
      jenis: target.jenis,
      targetType: target.target_type,
      scope: target.scope,
      nilai: target.nilai,
      isActive: target.is_active,
      isLooping: target.is_looping,
      startDate: target.start_date ? new Date(target.start_date) : new Date(),
      endDate: target.end_date ? new Date(target.end_date) : new Date(),
      cabangId: target.cabang_id,
      salesId: target.sales_id
    });
    setIsDialogOpen(true);
  }

  const handleOpenAdjust = (target: SalesTargetRow) => {
    setSelectedTargetAdjust(target);
    setNewTargetValue(target.nilai);
    setIsAdjustDialogOpen(true);
  };

  const handleSaveAdjust = async () => {
    if (!selectedTargetAdjust) return;
    try {
      // 1. Update Target
      const { error: updateError } = await supabase
        .from('sales_targets')
        .update({ nilai: newTargetValue })
        .eq('id', selectedTargetAdjust.id);

      if (updateError) throw updateError;

      // 2. Insert History
      const { error: historyError } = await supabase
        .from('sales_target_history')
        .insert([{
          target_id: selectedTargetAdjust.id,
          nilai_lama: selectedTargetAdjust.nilai,
          nilai_baru: newTargetValue,
          keterangan: 'Penyesuaian target berjalan',
          created_by: user?.id
        }]);

      if (historyError) {
        console.error('History record failed:', historyError);
        // Don't toast error for history if update was successful, 
        // but we should probably inform user history wasn't saved.
      }

      toast.success('Target berhasil disesuaikan');
      setIsAdjustDialogOpen(false);
      fetchTargets();
    } catch (error: unknown) {
      const err = error as Error;
      toast.error('Gagal menyesuaikan target: ' + err.message);
    }
  };

  return (
    <MainLayout title="Target Penjualan">
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari target..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Tambah Target
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{formData.id ? 'Edit Target' : 'Tambah Target Baru'}</DialogTitle>
                <DialogDescription>
                  {formData.id ? 'Perbarui informasi target penjualan.' : 'Buat target penjualan baru untuk periode tertentu.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Jenis Target</Label>
                    <Select
                      value={formData.jenis}
                      onValueChange={(val: 'bulanan' | 'mingguan' | 'harian') => setFormData({ ...formData, jenis: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="harian">Harian</SelectItem>
                        <SelectItem value="mingguan">Mingguan</SelectItem>
                        <SelectItem value="bulanan">Bulanan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipe Nilai</Label>
                    <Select
                      value={formData.targetType}
                      onValueChange={(val: 'nominal' | 'qty') => setFormData({ ...formData, targetType: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nominal">Nominal (Rp)</SelectItem>
                        <SelectItem value="qty">Quantity (Pcs)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Lingkup (Scope)</Label>
                  <Select
                    value={formData.scope}
                    onValueChange={(val: 'sales' | 'cabang') => setFormData({ ...formData, scope: val, cabangId: undefined, salesId: undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales Perorangan</SelectItem>
                      <SelectItem value="cabang">Seluruh Cabang</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.scope === 'sales' && (
                  <div className="space-y-2">
                    <Label>Pilih Sales</Label>
                    <Select
                      value={formData.salesId}
                      onValueChange={(val) => setFormData({ ...formData, salesId: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih sales..." />
                      </SelectTrigger>
                      <SelectContent>
                        {salesList.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.scope === 'cabang' && (
                  <div className="space-y-2">
                    <Label>Pilih Cabang</Label>
                    <Select
                      value={formData.cabangId}
                      onValueChange={(val) => setFormData({ ...formData, cabangId: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih cabang..." />
                      </SelectTrigger>
                      <SelectContent>
                        {cabangList.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Nilai Target</Label>
                  <Input
                    type="number"
                    value={formData.nilai || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, nilai: val === '' ? 0 : parseFloat(val) });
                    }}
                    placeholder="0"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="isLooping"
                    checked={formData.isLooping}
                    onChange={(e) => setFormData({ ...formData, isLooping: e.target.checked })}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="isLooping">Looping (Otomatis setiap periode)</Label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mulai Tanggal</Label>
                    <Input
                      type="date"
                      value={formData.startDate ? format(formData.startDate, 'yyyy-MM-dd') : ''}
                      onChange={(e) => setFormData({ ...formData, startDate: new Date(e.target.value) })}
                    />
                  </div>
                  {!formData.isLooping && (
                    <div className="space-y-2">
                      <Label>Sampai Tanggal</Label>
                      <Input
                        type="date"
                        value={formData.endDate ? format(formData.endDate, 'yyyy-MM-dd') : ''}
                        onChange={(e) => setFormData({ ...formData, endDate: new Date(e.target.value) })}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="isActive">Aktif</Label>
                </div>

                <Button className="w-full mt-4" onClick={handleSubmit}>
                  Simpan
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <CardContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jenis</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">Memuat...</TableCell>
                </TableRow>
              ) : targets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Belum ada data target</TableCell>
                </TableRow>
              ) : (
                targets.map((target) => (
                  <TableRow key={target.id}>
                    <TableCell className="capitalize">{target.jenis}</TableCell>
                    <TableCell>
                      {target.scope === 'sales' ? (
                        <div className="flex flex-col">
                          <span className="font-medium">Sales</span>
                          <span className="text-xs text-muted-foreground">{target.sales?.nama}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-medium">Cabang</span>
                          <span className="text-xs text-muted-foreground">{target.cabang?.nama}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {target.target_type === 'nominal' ? formatCurrency(target.nilai) : `${formatNumber(target.nilai)} Pcs`}
                    </TableCell>
                    <TableCell>
                      {target.is_looping ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] w-fit bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold uppercase">Looping</span>
                          <span className="text-xs text-muted-foreground">
                            Mulai: {target.start_date ? format(new Date(target.start_date), 'dd MMM yyyy') : '-'}
                          </span>
                        </div>
                      ) : (
                        <div className="text-sm">
                          {target.start_date ? format(new Date(target.start_date), 'dd MMM yyyy') : '-'} - <br />
                          {target.end_date ? format(new Date(target.end_date), 'dd MMM yyyy') : '-'}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${target.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {target.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="icon" variant="ghost" onClick={() => handleOpenAdjust(target)} title="Sesuaikan Target">
                        <TrendingUp className="w-4 h-4 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(target)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(target.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContainer>

        {/* Quick Adjust Dialog */}
        <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
          <DialogContent className="max-w-sm">
            {selectedTargetAdjust && (
              <>
                <DialogHeader>
                  <DialogTitle>Sesuaikan Target</DialogTitle>
                  <DialogDescription>
                    Ubah nilai target yang sedang berjalan.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2 text-center">
                    <p className="text-sm text-muted-foreground">
                      Target {selectedTargetAdjust.scope === 'sales' ? 'Sales' : 'Cabang'}: <br />
                      <span className="font-bold text-foreground">
                        {selectedTargetAdjust.scope === 'sales' ? selectedTargetAdjust.sales?.nama : selectedTargetAdjust.cabang?.nama}
                      </span>
                    </p>
                    <div className="bg-muted p-2 rounded-lg inline-block">
                      <p className="text-xs text-muted-foreground">Nilai Saat Ini</p>
                      <p className="font-bold">
                        {selectedTargetAdjust.target_type === 'nominal'
                          ? formatCurrency(selectedTargetAdjust.nilai)
                          : `${formatNumber(selectedTargetAdjust.nilai)} Pcs`}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Nilai Baru</Label>
                    <Input
                      type="number"
                      value={newTargetValue}
                      onChange={(e) => setNewTargetValue(parseFloat(e.target.value))}
                      placeholder="0"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => setNewTargetValue(v => v + (selectedTargetAdjust.target_type === 'nominal' ? 100000 : 10))}>
                      + {selectedTargetAdjust.target_type === 'nominal' ? '100rb' : '10 Pcs'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      const dec = selectedTargetAdjust.target_type === 'nominal' ? 100000 : 10;
                      setNewTargetValue(v => Math.max(0, v - dec));
                    }}>
                      - {selectedTargetAdjust.target_type === 'nominal' ? '100rb' : '10 Pcs'}
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsAdjustDialogOpen(false)}>Batal</Button>
                  <Button onClick={handleSaveAdjust}>Simpan Perubahan</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
