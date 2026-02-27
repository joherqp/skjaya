import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { toast } from 'sonner';
import { Save, ArrowLeft, Plus, Trash2, ArrowLeftRight } from 'lucide-react';
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

interface MutasiBarangFormProps {
  embedded?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function MutasiBarangForm({ embedded, onSuccess, onCancel }: MutasiBarangFormProps) {
  const { user } = useAuth();
  const { barang, addMutasiBarang, addPersetujuan, addNotifikasi, users, cabang, karyawan, satuan, stokPengguna, persetujuan } = useDatabase();
  
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [formData, setFormData] = useState({
    keCabangId: user?.cabangId || '', // Default to Same Branch
    receiverId: '',
    keterangan: ''
  });

  // Filter potential receivers based on SAME BRANCH logic
  const potentialReceivers = users.filter(u => {
      const myCabangId = user?.cabangId;
      if (!myCabangId) return false;

      let userCabangId = u.cabangId;
      if (u.karyawanId) {
          const linkedKaryawan = karyawan.find(k => k.id === u.karyawanId);
          if (linkedKaryawan) {
              userCabangId = linkedKaryawan.cabangId;
          }
      }

      // STRICT: Same branch only
      const isCabangMatch = userCabangId === myCabangId;
      
      // Filter out self as receiver
      const isNotSelf = u.id !== user?.id;

      // Allow ALL roles in same branch
      return isCabangMatch && isNotSelf && u.isActive !== false;
  });

  const [cart, setCart] = useState<{ barangId: string; jumlah: number; satuanId: string; konversi: number }[]>([]);

  const addItem = () => {
    setCart([...cart, { barangId: '', jumlah: 1, satuanId: '', konversi: 1 }]);
  };

  const removeItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: 'barangId' | 'jumlah' | 'satuanId', value: string | number) => {
    const newCart = [...cart];
    // @ts-expect-error dynamic access
    newCart[index][field] = value;

    // Handle Unit Logic on Product Change
    if (field === 'barangId') {
        const product = barang.find(b => b.id === value);
        if (product) {
            newCart[index].satuanId = product.satuanId;
            newCart[index].konversi = 1;
        }
    }

    // Handle Conversion on Unit Change
    if (field === 'satuanId') {
        const product = barang.find(b => b.id === newCart[index].barangId);
        if (product) {
             if (value === product.satuanId) {
                 newCart[index].konversi = 1;
             } else {
                 const multi = product.multiSatuan?.find(m => m.satuanId === value);
                 newCart[index].konversi = multi ? multi.konversi : 1;
             }
        }
    }

    setCart(newCart);
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || cart.some(c => !c.barangId)) {
      toast.error('Lengkapi daftar barang');
      return;
    }
    if (!formData.receiverId) {
        toast.error('Pilih penerima mutasi');
        return;
    }

    // Validate Stock Availability
    for (const item of cart) {
        const product = barang.find(b => b.id === item.barangId);
        const stockEntry = stokPengguna.find(s => s.userId === user?.id && s.barangId === item.barangId);
        const currentStock = stockEntry ? stockEntry.jumlah : 0;
        
        // Calculate PENDING stock from other pending approvals
        const pendingStock = persetujuan
            .filter(p => p.status === 'pending' && p.diajukanOleh === user?.id && (p.jenis === 'mutasi_stok' || p.jenis === 'permintaan'))
            .reduce((sum, p) => {
                const pData = p.data as { items?: { barangId: string; jumlah: number; konversi?: number }[] };
                const pendingItems = pData?.items || [];
                const matchingItem = pendingItems.find(pi => pi.barangId === item.barangId);
                if (matchingItem) {
                    return sum + (Number(matchingItem.jumlah) * (Number(matchingItem.konversi) || 1));
                }
                return sum;
            }, 0);

        const availableStock = currentStock - pendingStock;
        const requestedQty = item.jumlah * (item.konversi || 1);
        
        if (requestedQty > availableStock) {
            toast.error(
                `Stok tidak cukup untuk ${product?.nama || 'Item'}. ` + 
                `Tersedia: ${availableStock} (Stok: ${currentStock}, Pending: ${pendingStock})`
            );
            return;
        }
    }
    setIsConfirmOpen(true);
  };

  const executeSubmit = () => {
    const timestamp = Date.now();
    const mutasiId = crypto.randomUUID();

    // Mutasi within same branch (Transfer Ownership)
    // Mutasi within same branch (Transfer Ownership)
    addMutasiBarang({
      id: mutasiId,
      nomorMutasi: `MUT/${timestamp.toString().slice(-6)}`,
      tanggal: new Date(),
      dariCabangId: user?.cabangId || 'unknown',
      keCabangId: user?.cabangId || 'unknown', // Same Branch
      items: cart.map(c => ({
        barangId: c.barangId,
        jumlah: c.jumlah,
        satuanId: c.satuanId,
        konversi: c.konversi,
        totalQty: c.jumlah * (c.konversi || 1)
      })),
      status: 'pending',
      keterangan: formData.keterangan
    });

    // Create Approval Notification
    addPersetujuan({
      // id let DB generate
      jenis: 'mutasi_stok',
      referensiId: mutasiId,
      status: 'pending',
      diajukanOleh: user?.id || 'system',
      targetCabangId: user?.cabangId || 'unknown',
      targetUserId: formData.receiverId,
      tanggalPengajuan: new Date(),
      targetRole: 'admin',
      data: {
        nomorMutasi: mutasiId,
        items: cart.map(i => ({
          barangId: i.barangId,
          jumlah: i.jumlah,
          satuanId: i.satuanId, // FIX: Include unit for display
          konversi: i.konversi,
          dariCabangId: user?.cabangId,
          keCabangId: user?.cabangId
        }))
      }
    });  // Notify Specific User
    const targetUsers = users.filter(u => u.id === formData.receiverId);

    targetUsers.forEach(targetUser => {
      const itemDetails = cart.map(item => {
        const b = barang.find(x => x.id === item.barangId);
        const s = satuan.find(x => x.id === item.satuanId);
        return `${b?.nama || 'Barang'} ${item.jumlah} ${s?.simbol || ''}`;
      }).join(', ');

      addNotifikasi({
        userId: targetUser.id,
        judul: 'Ada Kiriman Barang!',
        pesan: `${user?.nama || 'Seseorang'} ngirim ${itemDetails} ke kamu nih. Yuk dicek di menu persetujuan.`,
        jenis: 'warning',
        dibaca: false,
        tanggal: new Date(),
        link: '/persetujuan'
      });
    });

    if (targetUsers.length === 0) {
      toast.info('Info: Penerima tidak ditemukan.');
    }

    toast.success('Pengajuan Mutasi berhasil dikirim');
    setIsConfirmOpen(false);
    
    if (onSuccess) {
        onSuccess();
        setCart([]);
        setFormData(prev => ({ ...prev, keterangan: '' }));
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
                    <CardTitle className="flex items-center gap-2">
                        <ArrowLeftRight className="w-5 h-5" />
                        Mutasi Barang (Internal Cabang)
                    </CardTitle>
                </CardHeader>
            )}
            <CardContent className={embedded ? "p-0" : ""}>
                <form onSubmit={handlePreSubmit} className="space-y-4">
                    
                    {/* Removed Destination Branch Select - Enforced Same Branch */}

                    <div className="space-y-2">
                        <Label>Penerima (Satu Cabang)</Label>
                        <SearchableSelect
                            value={formData.receiverId}
                            onChange={(val) => setFormData(prev => ({ ...prev, receiverId: val }))}
                            options={potentialReceivers.map(u => ({
                                value: u.id,
                                label: `${u.nama} (${u.roles.join(', ')})`
                            }))}
                            placeholder="Pilih penerima barang..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Keterangan</Label>
                        <Input 
                            placeholder="Contoh: Stok operan untuk tim sales" 
                            value={formData.keterangan}
                            onChange={(e) => setFormData(prev => ({ ...prev, keterangan: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                        <div className="flex justify-between items-center mb-4">
                            <Label className="text-base font-semibold">Daftar Barang</Label>
                            <Button type="button" variant="outline" size="sm" onClick={addItem}>
                                <Plus className="w-4 h-4 mr-2" />
                                Tambah Item
                            </Button>
                        </div>

                        {/* Header Row (Desktop) */}
                        <div className="hidden md:grid grid-cols-12 gap-4 px-2 mb-2 font-medium text-sm text-muted-foreground">
                            <div className="col-span-5">Nama Barang</div>
                            <div className="col-span-3">Satuan</div>
                            <div className="col-span-3">Jumlah</div>
                            <div className="col-span-1"></div>
                        </div>
                        
                        <div className="space-y-4">
                        {cart.map((item, index) => {
                            const selectedBarang = barang.find(b => b.id === item.barangId);
                            const availableUnits = selectedBarang ? [
                                { id: selectedBarang.satuanId, nama: satuan.find(s => s.id === selectedBarang.satuanId)?.simbol || 'Unit' },
                                ...(selectedBarang.multiSatuan || []).map(m => ({
                                    id: m.satuanId,
                                    nama: satuan.find(s => s.id === m.satuanId)?.simbol || 'Unit'
                                }))
                            ] : [];
                            
                            // Calculate stok availability in SELECTED unit
                            const userStockBase = stokPengguna.find(s => s.userId === user?.id && s.barangId === item.barangId)?.jumlah || 0;
                            const maxQtyInUnit = Math.floor(userStockBase / (item.konversi || 1));
                            const selectedUnitName = availableUnits.find(u => u.id === item.satuanId)?.nama || 'Unit';

                            return (
                                <div key={index} className="p-4 border rounded-lg bg-gray-50/50 md:bg-transparent md:border-0 md:p-0">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-end md:items-start">
                                        <div className="md:col-span-5 space-y-1.5">
                                            <Label className="md:hidden text-xs text-muted-foreground">Nama Barang</Label>
                                            <SearchableSelect 
                                                value={item.barangId}
                                                onChange={(val) => updateItem(index, 'barangId', val)}
                                                placeholder="Pilih Barang"
                                                options={barang
                                                    .filter(b => b.isActive) // Filter inactive products
                                                    .filter(b => {
                                                        // Hide if already in cart (unless it's the current row's value)
                                                        const isSelected = cart.some(c => c.barangId === b.id);
                                                        return !isSelected || b.id === item.barangId;
                                                    })
                                                    .map(b => {
                                                        const userStock = stokPengguna.find(s => s.userId === user?.id && s.barangId === b.id)?.jumlah || 0;
                                                        const unitName = satuan.find(s => s.id === b.satuanId)?.simbol || 'Unit';
                                                        return {
                                                            value: b.id,
                                                            label: b.nama,
                                                            description: `Stok: ${userStock} ${unitName}`
                                                        };
                                                    })
                                                }
                                            />
                                        </div>
                                        
                                        <div className="md:col-span-3 space-y-1.5">
                                             <Label className="md:hidden text-xs text-muted-foreground">Satuan</Label>
                                             <Select 
                                                value={item.satuanId}
                                                onValueChange={(val) => updateItem(index, 'satuanId', val)}
                                                disabled={!item.barangId}
                                            >
                                                <SelectTrigger className="w-full bg-white">
                                                    <SelectValue placeholder="Pilih Unit" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableUnits.map(u => (
                                                        <SelectItem key={u.id} value={u.id}>
                                                            {u.nama}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {item.barangId && item.satuanId && (
                                                <p className="text-[10px] text-muted-foreground">
                                                    Stok: {maxQtyInUnit} {selectedUnitName}
                                                </p>
                                            )}
                                        </div>

                                        <div className="md:col-span-3 space-y-1.5">
                                            <Label className="md:hidden text-xs text-muted-foreground">Jumlah</Label>
                                            <Input 
                                                type="number" 
                                                min="1"
                                                className="bg-white"
                                                placeholder="0"
                                                value={item.jumlah || ''}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    updateItem(index, 'jumlah', isNaN(val) ? 0 : val);
                                                }}
                                                onFocus={(e) => e.target.select()}
                                            />
                                            {selectedBarang && (
                                                <p className="text-[10px] text-muted-foreground">
                                                    Konversi: {item.konversi} (Total: {item.jumlah * (item.konversi || 1)} {satuan.find(s => s.id === selectedBarang.satuanId)?.simbol})
                                                </p>
                                            )}
                                        </div>

                                        <div className="md:col-span-1 flex justify-end md:justify-center pt-2 md:pt-0">
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon" 
                                                className="text-muted-foreground hover:text-red-500 hover:bg-red-50"
                                                onClick={() => removeItem(index)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        </div>
                    </div>

                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 mt-6">
                        <Save className="w-4 h-4 mr-2" />
                        Kirim Mutasi
                    </Button>
                </form>
        </CardContent>
      </Card>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Konfirmasi Mutasi Barang</AlertDialogTitle>
                <AlertDialogDescription>
                    Mohon periksa kembali daftar mutasi barang berikut sebelum dikirim.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="text-sm bg-muted/50 p-3 rounded-md space-y-2">
                    <p><strong>Penerima:</strong> {users.find(u => u.id === formData.receiverId)?.nama || '-'}</p>
                    <p><strong>Keterangan:</strong> {formData.keterangan || '-'}</p>
                </div>
                <div className="border rounded-md">
                    <table className="w-full text-sm">
                        <thead className="bg-muted text-muted-foreground">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium">Barang</th>
                                <th className="px-3 py-2 text-right font-medium">Qty</th>
                                <th className="px-3 py-2 text-left font-medium">Unit</th>
                                <th className="px-3 py-2 text-right font-medium">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {cart.map((item, idx) => {
                                const b = barang.find(x => x.id === item.barangId);
                                const u = satuan.find(s => s.id === b?.satuanId);
                                const currentUnitName = [
                                     { id: b?.satuanId, nama: u?.simbol },
                                     ...(b?.multiSatuan || []).map(m => ({ id: m.satuanId, nama: satuan.find(s => s.id === m.satuanId)?.simbol }))
                                ].find(x => x.id === item.satuanId)?.nama || '-';

                                return (
                                    <tr key={idx}>
                                        <td className="px-3 py-2">{b?.nama}</td>
                                        <td className="px-3 py-2 text-right">{item.jumlah}</td>
                                        <td className="px-3 py-2">{currentUnitName}</td>
                                        <td className="px-3 py-2 text-right">
                                            {item.jumlah * (item.konversi || 1)} {u?.simbol}
                                        </td>
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

export default function MutasiBarang() {
  const navigate = useNavigate();
  const { mutasiBarang } = useDatabase();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(10);

  if (showForm) {
      return (
          <MainLayout title="Buat Mutasi Barang">
              <MutasiBarangForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
          </MainLayout>
      )
  }

  // Sort by Date Descending
  const sortedMutasi = [...mutasiBarang].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  const displayMutasi = sortedMutasi.slice(0, displayLimit);

  return (
    <MainLayout title="Mutasi Barang">
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
          {(user?.roles.includes('admin') || user?.roles.includes('owner') || user?.roles.includes('gudang')) && (
            <Button onClick={() => setShowForm(true)} className="bg-orange-500 hover:bg-orange-600">
              <Plus className="w-4 h-4 mr-2" />
              Buat Mutasi
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {sortedMutasi.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <ArrowLeftRight className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Belum ada riwayat mutasi</p>
              </CardContent>
            </Card>
          ) : (
            <>
            {displayMutasi.map(mut => (
              <Card key={mut.id} elevated>
                <CardContent className="p-4">
                   <div className="flex justify-between items-start">
                     <div>
                       <p className="font-bold">{mut.nomorMutasi}</p>
                       <p className="text-sm text-muted-foreground">{new Date(mut.tanggal).toLocaleDateString()}</p>
                       {mut.keterangan && <p className="text-xs text-muted-foreground mt-1 italic">"{mut.keterangan}"</p>}
                     </div>
                     <Badge variant={mut.status === 'pending' ? 'warning' : 'success'}>
                       {mut.status}
                     </Badge>
                   </div>
                   <div className="mt-3 text-sm">
                      <p>Ke: {mut.keCabangId === 'cab-1' ? 'Pusat' : mut.keCabangId}</p>
                      <p className="text-muted-foreground">{(mut.items as import('@/lib/types').MutasiItem[]).length} Barang</p>
                   </div>
                </CardContent>
              </Card>
            ))}
            
            {sortedMutasi.length > displayLimit && (
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
