import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { toast } from 'sonner';
import { Save, ArrowLeft, Plus, Trash2, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
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

interface PermintaanBarangFormProps {
  embedded?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PermintaanBarangForm({ embedded, onSuccess, onCancel }: PermintaanBarangFormProps) {
  const { user } = useAuth();
  const { barang, addPermintaanBarang, addPersetujuan, cabang, satuan: satuanList, users } = useDatabase();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [formData, setFormData] = useState({
    keCabangId: '',
    targetUserId: '',
    catatan: ''
  });

  const [cart, setCart] = useState<{ barangId: string; jumlah: number; satuanId: string }[]>([]);

  const addItem = () => {
    setCart([...cart, { barangId: '', jumlah: 1, satuanId: '' }]);
  };

  const removeItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: 'barangId' | 'jumlah' | 'satuanId', value: string | number) => {
    const newCart = [...cart];
    // @ts-expect-error dynamic access
    newCart[index][field] = value;

    // Auto-select default unit if product changed
    if (field === 'barangId') {
      const product = barang.find(b => b.id === value);
      if (product) {
        newCart[index].satuanId = product.satuanId;
      }
    }
    setCart(newCart);
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.keCabangId) {
      toast.error('Pilih cabang tujuan');
      return;
    }
    if (!formData.targetUserId) {
      toast.error('Pilih pengguna tujuan di cabang tersebut');
      return;
    }
    if (cart.length === 0 || cart.some(c => !c.barangId)) {
      toast.error('Lengkapi daftar barang');
      return;
    }
    setIsConfirmOpen(true);
  };

  const executeSubmit = async () => {
    try {
      const itemPayload = cart.map(c => {
        const product = barang.find(b => b.id === c.barangId);
        let conversion = 1;
        if (product && c.satuanId) {
          const multi = product.multiSatuan?.find(m => m.satuanId === c.satuanId);
          if (multi) conversion = multi.konversi;
        }
        return {
          ...c,
          konversi: conversion,
          totalQty: c.jumlah * conversion
        };
      });

      const newReq = await addPermintaanBarang({
        nomorPermintaan: `REQ/${Date.now().toString().slice(-6)}`,
        tanggal: new Date(),
        dariCabangId: user?.cabangId || 'cab-1',
        keCabangId: formData.keCabangId,
        items: itemPayload,
        status: 'pending',
        dibuatOleh: user?.id || 'system',
        catatan: formData.catatan
      });

      await addPersetujuan({
        jenis: 'permintaan',
        referensiId: (newReq as { id: string })?.id,
        status: 'pending',
        diajukanOleh: user?.id || 'system',
        targetCabangId: formData.keCabangId,
        targetRole: undefined,
        targetUserId: formData.targetUserId,
        tanggalPengajuan: new Date(),
        catatan: formData.catatan,
        data: {
          items: itemPayload,
          dariCabangId: user?.cabangId,
          keCabangId: formData.keCabangId,
        }
      });

      toast.success('Permintaan barang berhasil dibuat');
      setIsConfirmOpen(false);

      if (onSuccess) {
        onSuccess();
        setCart([]);
        setFormData(prev => ({ ...prev, catatan: '' }));
      }
    } catch (err) {
      console.error("Gagal membuat permintaan", err);
      toast.error('Gagal membuat permintaan barang');
    }
  };

  return (
    <div className={embedded ? "w-full" : "p-4 max-w-2xl mx-auto space-y-4"}>
      {!embedded && (
        <Button variant="ghost" onClick={onCancel} className="pl-0">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali
        </Button>
      )}

      <Card elevated={!embedded} className={embedded ? "border-0 shadow-none" : ""}>
        {!embedded && (
          <CardHeader>
            <CardTitle>Form Permintaan Barang</CardTitle>
          </CardHeader>
        )}
        <CardContent className={embedded ? "p-0" : ""}>
          <form onSubmit={handlePreSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tujuan Cabang (Gudang)</Label>
              <Select
                value={formData.keCabangId}
                onValueChange={(val) => setFormData(prev => ({ ...prev, keCabangId: val, targetUserId: '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Cabang (Gudang/Outlet)" />
                </SelectTrigger>
                <SelectContent>
                  {cabang.filter(c => c.id !== user?.cabangId && c.id !== 'cab-pusat' && !c.nama.toLowerCase().includes('pusat')).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.keCabangId && (
              <div className="space-y-2">
                <Label>Pilih Pengguna Cabang</Label>
                <SearchableSelect
                  value={formData.targetUserId}
                  onChange={(val) => setFormData(prev => ({ ...prev, targetUserId: val }))}
                  placeholder="Pilih pengguna untuk dituju..."
                  options={users
                    .filter(u => u.cabangId === formData.keCabangId && u.isActive !== false)
                    .map(u => ({ label: `${u.nama} (${u.roles.join(', ')})`, value: u.id }))
                  }
                />
              </div>
            )}

            <div className="bg-muted/20 p-4 rounded-lg space-y-4">
              <div className="flex justify-between items-center">
                <Label>Daftar Barang</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="w-4 h-4 mr-1" /> Tambah
                </Button>
              </div>

              {cart.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:items-end border-b sm:border-0 pb-3 sm:pb-0 border-dashed">
                  <div className="flex-1 space-y-1 w-full">
                    <Label className="text-xs">Barang</Label>
                    <SearchableSelect
                      value={item.barangId}
                      onChange={(val) => updateItem(idx, 'barangId', val)}
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

                  <div className="flex gap-2 items-end w-full sm:w-auto">
                    <div className="flex-1 sm:w-24 space-y-1">
                      <Label className="text-xs">Satuan</Label>
                      <Select
                        value={item.satuanId}
                        disabled={!item.barangId}
                        onValueChange={(val) => updateItem(idx, 'satuanId', val)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const product = barang.find(b => b.id === item.barangId);
                            if (!product) return null;

                            const units = [
                              { id: product.satuanId, nama: satuanList.find(s => s.id === product.satuanId)?.nama || 'Unit' },
                              ...(product.multiSatuan?.map(m => ({
                                id: m.satuanId,
                                nama: satuanList.find(s => s.id === m.satuanId)?.nama || 'Unit'
                              })) || [])
                            ];

                            return units.map(u => (
                              <SelectItem key={u.id} value={u.id}>{u.nama}</SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-20 space-y-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        className="h-8"
                        value={item.jumlah || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          updateItem(idx, 'jumlah', isNaN(val) ? 0 : val);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive flex-shrink-0"
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Input
                value={formData.catatan}
                onChange={(e) => setFormData(prev => ({ ...prev, catatan: e.target.value }))}
              />
            </div>

            <Button type="submit" className="w-full">
              <Save className="w-4 h-4 mr-2" /> Kirim Permintaan
            </Button>
          </form>
        </CardContent>
      </Card>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Permintaan Barang</AlertDialogTitle>
            <AlertDialogDescription>
              Periksa kembali daftar permintaan barang berikut sebelum dikirim.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="text-sm bg-muted/50 p-3 rounded-md space-y-2">
              <p><strong>Tujuan:</strong> {cabang.find(c => c.id === formData.keCabangId)?.nama || '-'}</p>
              {formData.targetUserId && (
                <p><strong>Pengguna:</strong> {users.find(u => u.id === formData.targetUserId)?.nama}</p>
              )}
              <p><strong>Catatan:</strong> {formData.catatan || '-'}</p>
            </div>
            <div className="border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Barang</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-left font-medium">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cart.map((item, idx) => {
                    const b = barang.find(x => x.id === item.barangId);
                    const u = satuanList.find(s => s.id === item.satuanId);
                    return (
                      <tr key={idx}>
                        <td className="px-3 py-2">{b?.nama}</td>
                        <td className="px-3 py-2 text-right">{item.jumlah}</td>
                        <td className="px-3 py-2">{u?.simbol || u?.nama || 'Unit'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={executeSubmit} className="bg-blue-600 hover:bg-blue-700">
              Ya, Kirim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function PermintaanBarangHistory() {
  const { permintaanBarang, cabang, satuan: satuanList, barang } = useDatabase();
  const [displayLimit, setDisplayLimit] = useState(10);

  // Sort by Date Descending
  const sortedRequests = [...permintaanBarang].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  const displayRequests = sortedRequests.slice(0, displayLimit);

  // Helper to get unit name
  const getUnitName = (barangId: string, satuanId?: string) => {
    if (!satuanId) return '';
    const s = satuanList.find(x => x.id === satuanId);
    return s?.nama || 'Unit';
  };

  return (
    <div className="space-y-3">
      {sortedRequests.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Belum ada riwayat permintaan</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {displayRequests.map(req => (
            <Card key={req.id} elevated>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">{req.nomorPermintaan}</p>
                    <p className="text-sm text-muted-foreground">{new Date(req.tanggal).toLocaleDateString()}</p>
                    <p className="text-sm mt-1">Ke: {cabang.find(c => c.id === req.keCabangId)?.nama || req.keCabangId}</p>
                  </div>
                  <Badge variant={req.status === 'pending' ? 'warning' : 'success'}>
                    {req.status}
                  </Badge>
                </div>
                <div className="mt-3 pt-3 border-t text-sm">
                  <p>{req.items.length} Item diminta</p>
                  <p className="text-muted-foreground truncate max-w-xs">{req.catatan}</p>
                </div>
              </CardContent>
            </Card>
          ))}

          {sortedRequests.length > displayLimit && (
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
  )
}

export default function PermintaanBarangPage() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return (
      <MainLayout title="Buat Permintaan Stok">
        <PermintaanBarangForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
      </MainLayout>
    )
  }

  return (
    <MainLayout title="Permintaan Barang">
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
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Buat Permintaan
          </Button>
        </div>

        <PermintaanBarangHistory />
      </div>
    </MainLayout>
  );
}
