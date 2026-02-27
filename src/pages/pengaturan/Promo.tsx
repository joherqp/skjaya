import { useState } from 'react';
import { SettingsCrud } from '@/components/settings/SettingsCrud';
import { Percent } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { Promo as PromoType } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRupiah } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Promo() {
  const { promo, addPromo, updatePromo, deletePromo, barang, addPersetujuan } = useDatabase();
  const { user, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('aktif');

  const filteredItems = [...(promo || [])].map(p => ({
    ...p,
    // Map DB/Camel keys to Form keys for correct editing initialization
    isActive: p.aktif ?? p.isActive,
    tanggalMulai: (p as any).berlakuMulai || (p as any).berlaku_mulai || p.tanggalMulai,
    tanggalBerakhir: (p as any).berlakuSampai || (p as any).berlaku_sampai || p.tanggalBerakhir,
    metodeKelipatan: (p as any).metode_kelipatan || p.metodeKelipatan || 'per_item',
  })).filter(p => {
    const now = new Date();
    const start = new Date(p.tanggalMulai);
    const end = p.tanggalBerakhir ? new Date(p.tanggalBerakhir) : null;

    // Determine status logic similarly to Report
    // Active = isActive AND start <= now AND (no end OR end >= now)
    const isActuallyActive = p.isActive && start <= now && (!end || end >= now);

    if (activeTab === 'aktif') return isActuallyActive;

    // Tidak Aktif = !Active (Expired, Pending, or manually Disabled)
    return !isActuallyActive;
  }).sort((a, b) => {
    // Sort logic
    const dateA = new Date(a.tanggalMulai || 0).getTime();
    const dateB = new Date(b.tanggalMulai || 0).getTime();

    // For Active tab, simple date sort
    if (activeTab === 'aktif') return dateB - dateA;

    // For Inactive: Pending (future) first, then Expired recent to old
    const now = new Date();
    const startA = new Date(a.tanggalMulai);
    const startB = new Date(b.tanggalMulai);
    const isPendingA = startA > now;
    const isPendingB = startB > now;

    if (isPendingA && !isPendingB) return -1;
    if (!isPendingA && isPendingB) return 1;

    return dateB - dateA;
  });

  return (
    <SettingsCrud<PromoType>
      title="Promo & Diskon"
      icon={Percent}
      items={filteredItems}
      extraContent={
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="aktif">Aktif</TabsTrigger>
            <TabsTrigger value="tidak">Tidak Aktif</TabsTrigger>
          </TabsList>
        </Tabs>
      }
      columns={[
        { key: 'nama', label: 'Nama Promo' },
        { key: 'kode', label: 'Kode' },
        {
          key: 'tipe',
          label: 'Tipe',
          render: (item) => (
            <span className="capitalize">{item.tipe}</span>
          )
        },
        {
          key: 'nilai',
          label: 'Nilai',
          render: (item) => {
            let display = '';
            if (item.tipe === 'produk') {
              const pIds = item.bonusProdukIds && item.bonusProdukIds.length > 0 ? item.bonusProdukIds : (item.bonusProdukId ? [item.bonusProdukId] : []);
              const names = pIds.map(id => barang.find(b => b.id === id)?.nama).filter(Boolean).join(', ');
              display = names ? `Free: ${names.length > 30 ? names.substring(0, 30) + '...' : names}` : 'Free Item';
            } else {
              display = item.tipe === 'persen' ? `${item.nilai}%` : formatRupiah(item.nilai);
            }

            if (item.isKelipatan && item.maxApply) {
              display += ` (Max ${item.maxApply}x)`;
            }
            return display;
          }
        },
        {
          key: 'isActive',
          label: 'Status',
          render: (item) => (
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {item.isActive ? 'Aktif' : 'Nonaktif'}
            </span>
          )
        }
      ]}
      initialFormState={{
        nama: '',
        kode: '',
        tipe: 'nominal',
        nilai: 0,
        scope: 'all',
        isActive: true,
        tanggalMulai: new Date(),
        targetProdukIds: [],
        minQty: 1,
        metodeKelipatan: 'per_item'
      }}
      onSave={async (item) => {
        const isOwner = hasRole(['owner']);
        const exists = item.id && !item.id.startsWith('new-');

        // Prepare Payload with Mapping
        const { isActive, tanggalMulai, tanggalBerakhir, metodeKelipatan, isNew, ...rest } = item as any;
        const payloadToSave = {
          ...rest,
          aktif: isActive,
          berlaku_mulai: tanggalMulai,
          berlaku_sampai: tanggalBerakhir,
          metode_kelipatan: metodeKelipatan
        };

        console.log('Promo saving Payload:', payloadToSave);

        if (isOwner) {
          if (exists) {
            await updatePromo(item.id, payloadToSave as Partial<PromoType>);
          } else {
            const { id: _, ...newItem } = payloadToSave;
            await addPromo(newItem as Omit<PromoType, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>);
          }
        } else {
          // Non-Owner: Create Approval Request
          // Note: useApprovalAction expects the camelCase keys (isActive, tanggalMulai) to map them again.
          // OR we can send the pre-mapped keys? The current useApprovalAction logic maps isActive -> aktif.
          // If we send 'aktif', it won't map it (rest covers it).
          // But useApprovalAction explicitly destructures isActive.
          // Let's send the original 'item' which has camelKeys, so useApprovalAction works as designed.

          const prospectiveId = exists ? item.id : self.crypto.randomUUID();

          await addPersetujuan({
            jenis: 'promo',
            referensiId: prospectiveId,
            status: 'pending',
            diajukanOleh: user?.id || 'system',
            tanggalPengajuan: new Date(),
            targetRole: 'owner',
            catatan: exists ? `Update Promo: ${item.nama}` : `Promo Baru: ${item.nama}`,
            data: {
              ...item,
              id: prospectiveId,
              isNew: !exists
            }
          });
        }
      }}
      onDelete={deletePromo}
      renderForm={(formData, handleChange, setFormData) => (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nama Promo</Label>
              <Input
                name="nama"
                value={formData.nama}
                onChange={handleChange}
                placeholder="Contoh: Diskon Merdeka"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Kode Promo</Label>
              <Input
                name="kode"
                value={formData.kode}
                onChange={handleChange}
                placeholder="MERDEKA45"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipe Promo</Label>
              <Select
                value={formData.tipe}
                onValueChange={(value) => setFormData(prev => ({ ...prev, tipe: value as PromoType['tipe'] }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nominal">Nominal (Rp)</SelectItem>
                  <SelectItem value="persen">Persen (%)</SelectItem>
                  <SelectItem value="produk">Bonus Produk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {formData.tipe === 'persen' ? 'Nilai Persen (%)' :
                  formData.tipe === 'produk' ? 'Qty Bonus (Per Kelipatan)' :
                    'Nilai Potongan (Rp)'}
              </Label>
              <Input
                name="nilai"
                type="number"
                inputMode="numeric"
                onFocus={(e) => e.target.select()}
                value={formData.nilai}
                onChange={handleChange}
                required
              />
            </div>

            {formData.tipe === 'produk' && (
              <div className="col-span-2 space-y-4 border p-4 rounded-lg bg-slate-50">
                <h4 className="font-medium text-sm text-slate-900 border-b pb-2 mb-2">Konfigurasi Bonus Produk</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mekanisme Bonus</Label>
                    <Select
                      value={formData.mekanismeBonus || 'random'}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, mekanismeBonus: value as 'random' | 'single' | 'mix' }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Mekanisme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="random">Random (Otomatis)</SelectItem>
                        <SelectItem value="single">Pilih Satu (Single)</SelectItem>
                        <SelectItem value="mix">Campur (Mix)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      {formData.mekanismeBonus === 'random' ? 'Sistem memilih otomatis berdasarkan stok.' :
                        formData.mekanismeBonus === 'single' ? 'Pelanggan memilih 1 varian produk.' :
                          'Pelanggan bisa mencampur beberapa produk sesuai jumlah bonus.'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Produk Bonus (Bisa pilih &gt; 1)</Label>
                    <div className="border rounded-md p-2 h-40 overflow-y-auto bg-white">
                      {barang
                        .filter(b => b.isActive)
                        .map(product => {
                          const isChecked = (formData.bonusProdukIds || []).includes(product.id) || formData.bonusProdukId === product.id;
                          return (
                            <div key={product.id} className="flex items-center space-x-2 mb-1 pl-1">
                              <Checkbox
                                id={`b-${product.id}`}
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  const currentIds = new Set(formData.bonusProdukIds || []);
                                  if (formData.bonusProdukId) currentIds.add(formData.bonusProdukId); // Ensure legacy included

                                  if (checked) {
                                    currentIds.add(product.id);
                                  } else {
                                    currentIds.delete(product.id);
                                  }

                                  const newIds = Array.from(currentIds);
                                  setFormData(prev => ({
                                    ...prev,
                                    bonusProdukIds: newIds,
                                    bonusProdukId: newIds.length > 0 ? newIds[0] : undefined // Sync primary for legacy
                                  }));
                                }}
                              />
                              <label htmlFor={`b-${product.id}`} className="text-sm cursor-pointer select-none truncate">
                                {product.nama}
                              </label>
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>
                {formData.tipe === 'produk' ? 'Berlaku Setiap Kelipatan Qty' : 'Syarat Minimum Qty'}
              </Label>
              <Input
                name="minQty"
                type="number"
                inputMode="numeric"
                onFocus={(e) => e.target.select()}
                value={formData.minQty || 1}
                onChange={handleChange}
                min={1}
                placeholder="1"
              />
              <p className="text-[10px] text-muted-foreground">
                {formData.tipe === 'produk'
                  ? 'Contoh: Setiap beli 10 dapat 1. Masukkan 10 disini.'
                  : 'Jika pembelian mencapai jumlah ini, promo akan berlaku.'}
              </p>
            </div>
          </div>

          {(formData.tipe === 'nominal' || formData.tipe === 'produk') && (
            <div className="grid grid-cols-2 gap-4 pb-4">
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="isKelipatan"
                  checked={formData.isKelipatan}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isKelipatan: !!checked }))}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="isKelipatan"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Berlaku Kelipatan
                  </label>
                  <p className="text-[10px] text-muted-foreground">
                    Jika dicentang, promo akan dihitung setiap kelipatan jumlah minimum.
                  </p>
                </div>
              </div>

              {formData.isKelipatan && (
                <div className="space-y-2">
                  <Label>Metode Kelipatan</Label>
                  <Select
                    value={formData.metodeKelipatan || 'per_item'}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, metodeKelipatan: value as 'per_item' | 'per_nota' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Metode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_item">Per Item (Default)</SelectItem>
                      <SelectItem value="per_nota">Per Nota (Total Qty)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    {formData.metodeKelipatan === 'per_nota'
                      ? 'Total jumlah semua produk yang memenuhi syarat akan dihitung.'
                      : 'Setiap produk dihitung masing-masing.'}
                  </p>
                </div>
              )}

              {formData.isKelipatan && (
                <div className="space-y-2">
                  <Label>Batasi Maksimal Kelipatan (Opsional)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    onFocus={(e) => e.target.select()}
                    placeholder="Contoh: 3 (Maks 3x Bonus)"
                    value={formData.maxApply || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxApply: e.target.value ? parseInt(e.target.value) : undefined }))}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Biarkan kosong jika tidak ada batasan.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Lingkup Promo</Label>
            <Select
              value={formData.scope}
              onValueChange={(value) => setFormData(prev => ({ ...prev, scope: value as PromoType['scope'] }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih Lingkup" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Produk</SelectItem>
                <SelectItem value="selected_products">Produk Tertentu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.scope === 'selected_products' && (
            <div className="space-y-2 border p-3 rounded-md max-h-40 overflow-y-auto">
              <Label className="mb-2 block">Pilih Target Produk</Label>
              {barang
                .filter(b => b.isActive) // Filter inactive
                .map(product => (
                  <div key={product.id} className="flex items-center space-x-2 mb-1">
                    <Checkbox
                      id={`p-${product.id}`}
                      checked={formData.targetProdukIds?.includes(product.id)}
                      onCheckedChange={(checked) => {
                        const currentIds = formData.targetProdukIds || [];
                        if (checked) {
                          setFormData(prev => ({ ...prev, targetProdukIds: [...currentIds, product.id] }));
                        } else {
                          setFormData(prev => ({ ...prev, targetProdukIds: currentIds.filter(id => id !== product.id) }));
                        }
                      }}
                    />
                    <label htmlFor={`p-${product.id}`} className="text-sm cursor-pointer">{product.nama}</label>
                  </div>
                ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tanggal Mulai</Label>
              <Input
                type="date"
                name="tanggalMulai"
                value={formData.tanggalMulai ? new Date(formData.tanggalMulai).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData(prev => ({ ...prev, tanggalMulai: e.target.value ? new Date(e.target.value) : new Date() }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Berakhir (Opsional)</Label>
              <Input
                type="date"
                name="tanggalBerakhir"
                value={formData.tanggalBerakhir ? new Date(formData.tanggalBerakhir).toISOString().split('T')[0] : ''}
                onChange={(e) => setFormData(prev => ({ ...prev, tanggalBerakhir: e.target.value ? new Date(e.target.value) : undefined }))}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: !!checked }))}
            />
            <label htmlFor="isActive" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Promo Aktif
            </label>
          </div>
        </>
      )
      }
    />
  );
}
