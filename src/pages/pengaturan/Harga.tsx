import { ComponentType, useState } from 'react';
import { SettingsCrud } from '@/components/settings/SettingsCrud';
import { Plus, X, ListPlus, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { Harga } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function HargaManagement() {
  const { 
    harga, addHarga, updateHarga, deleteHarga, 
    barang, cabang, kategoriPelanggan, satuan, addPersetujuan 
  } = useDatabase();
  const { user, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('aktif');

  /* Logic from JadwalHargaPromo.tsx for consistency */
  const groupedHarga: Record<string, Harga[]> = {};
  
  // Grouping
  harga.forEach(h => {
     if (h.status === 'ditolak') return; // Exclude rejected from grouping logic logic, handled separately
     const key = `${h.barangId}-${h.satuanId}-${h.minQty || 0}-${h.cabangId || 'global'}-${(h.kategoriPelangganIds || []).sort().join(',')}`;
     if (!groupedHarga[key]) groupedHarga[key] = [];
     groupedHarga[key].push(h);
  });

  const now = new Date();
  const activeIds = new Set<string>();
  const pendingIds = new Set<string>();
  const expiredIds = new Set<string>();

  // Differentiate statuses
  Object.values(groupedHarga).forEach(group => {
     const sorted = group.sort((a, b) => {
        const dateA = new Date(a.tanggalEfektif || 0).getTime();
        const dateB = new Date(b.tanggalEfektif || 0).getTime();
        return dateB - dateA;
     });

     let foundActive = false;
     sorted.forEach(h => {
        const hDate = h.tanggalEfektif ? new Date(h.tanggalEfektif) : new Date();
        
        if (h.status === 'pending' || hDate > now) {
            pendingIds.add(h.id);
        } else if (!foundActive && h.status === 'disetujui') {
            activeIds.add(h.id);
            foundActive = true;
        } else {
            expiredIds.add(h.id);
        }
     });
  });

  // Also handle rejected items - they are just inactive/rejected
  harga.filter(h => h.status === 'ditolak').forEach(h => expiredIds.add(h.id));

  const filteredItems = [...harga].filter(h => {
    if (activeTab === 'aktif') {
        return activeIds.has(h.id);
    } else {
        // "Tidak Aktif" includes Pending, Expired, Rejected
        return !activeIds.has(h.id);
    }
  }).sort((a, b) => {
    // Sort logic: Disetujui (Active) top if mixed (not likely here due to filter), then by date
    if (activeTab === 'aktif') {
        const dateA = new Date(a.tanggalEfektif || 0).getTime();
        const dateB = new Date(b.tanggalEfektif || 0).getTime();
        return dateB - dateA;
    } else {
        // In "Tidak Aktif": Pending first, then Expired recent to old
        const getScore = (item: Harga) => {
             if (pendingIds.has(item.id)) return 3;
             if (item.status === 'ditolak') return 1;
             return 2; // Expired
        };
        const scoreA = getScore(a);
        const scoreB = getScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        
        const dateA = new Date(a.tanggalEfektif || 0).getTime();
        const dateB = new Date(b.tanggalEfektif || 0).getTime();
        return dateB - dateA;
    }
  });

  return (
    <SettingsCrud<Harga>
      title="Pembaharuan Harga"
      icon={Tag}
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
        { 
          key: 'barangId', 
          label: 'Produk',
          render: (item) => barang.find(b => b.id === item.barangId)?.nama || item.barangId
        },
        { 
          key: 'satuanId', 
          label: 'Satuan',
          render: (item) => satuan.find(s => s.id === item.satuanId)?.nama || '-'
        },
        { 
            key: 'harga', 
            label: 'Harga Baru',
            render: (item) => `Rp ${Number(item.harga).toLocaleString('id-ID')}`
        },
        { 
            key: 'tanggalEfektif', 
            label: 'Efektif',
            render: (item) => item.tanggalEfektif ? format(new Date(item.tanggalEfektif), 'dd MMM yyyy', { locale: id }) : '-'
        },
        {
            key: 'status',
            label: 'Status',
            render: (item) => (
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                    item.status === 'disetujui' ? 'bg-green-100 text-green-800' :
                    item.status === 'ditolak' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                }`}>
                    {item.status === 'disetujui' ? 'Disetujui' : item.status === 'ditolak' ? 'Ditolak' : 'Menunggu Approval'}
                </span>
            )
        }
      ]}
      initialFormState={{ 
        barangId: '', 
        satuanId: '',
        cabangId: '', 
        kategoriPelangganIds: [], 
        harga: 0,
        minQty: 1,
        tanggalEfektif: new Date(),
        status: 'pending',
        grosir: []
      }}
      onSave={(item) => {
        const exists = harga.find(i => i.id === item.id);
        const isOwner = hasRole(['owner']);
        
        const dataToSave: Harga = {
            ...item,
            harga: Number(item.harga),
            minQty: Number(item.minQty || 1),
            status: isOwner ? 'disetujui' : 'pending',
            disetujuiOleh: isOwner ? user?.id : undefined,
            tanggalEfektif: new Date(item.tanggalEfektif),
            grosir: item.grosir?.map(g => ({
                min: Number(g.min),
                max: Number(g.max),
                harga: Number(g.harga)
            })) || []
        };
        
        if (exists) {
          if (isOwner) {
              updateHarga(item.id, dataToSave);
          } else {
             // Non-owner: Create request only, DO NOT update data yet
             const newId = self.crypto.randomUUID();
             addPersetujuan({
                jenis: 'perubahan_harga',
                referensiId: item.id,
                status: 'pending',
                diajukanOleh: user?.id || 'system',
                tanggalPengajuan: new Date(),
                targetRole: 'owner',
                catatan: 'Pengajuan perubahan harga (update)',
                data: {
                    // Full payload for update
                    barangId: dataToSave.barangId,
                    satuanId: dataToSave.satuanId,
                    hargaBaru: dataToSave.harga,
                    hargaLama: exists.harga,
                    cabangId: dataToSave.cabangId,
                    grosir: dataToSave.grosir,
                    minQty: dataToSave.minQty,
                    tanggalEfektif: dataToSave.tanggalEfektif,
                    kategoriPelangganIds: dataToSave.kategoriPelangganIds
                }
             });
          }
        } else {
          if (isOwner) {
              const newId = self.crypto.randomUUID();
              addHarga({
                 ...dataToSave,
              });
          } else {
             // Non-owner: Create request only. NEW item.
             // referensiId is null/undefined because item doesn't exist yet.
             // Actually, we can generate a UUID and pass it as referensiId, but we won't create the record yet.
             // Or we can leave refId empty and handle creation in Persetujuan.
             const prospectiveId = self.crypto.randomUUID(); 
             
             addPersetujuan({
                jenis: 'perubahan_harga',
                referensiId: prospectiveId, // Use this ID when creating later
                status: 'pending',
                diajukanOleh: user?.id || 'system',
                tanggalPengajuan: new Date(),
                targetRole: 'owner',
                catatan: 'Pengajuan harga baru',
                data: {
                    // Full payload for creation
                    id: prospectiveId,
                    barangId: dataToSave.barangId,
                    satuanId: dataToSave.satuanId,
                    hargaBaru: dataToSave.harga,
                    cabangId: dataToSave.cabangId,
                    grosir: dataToSave.grosir,
                    minQty: dataToSave.minQty,
                    tanggalEfektif: dataToSave.tanggalEfektif,
                    kategoriPelangganIds: dataToSave.kategoriPelangganIds,
                    isNew: true // Flag to indicate new creation
                }
            });
          }
        }
      }}
      onDelete={deleteHarga}
      renderForm={(formData, handleChange, setFormData) => {
        const addGrosir = () => {
            const current = formData.grosir || [];
            setFormData(prev => ({
                ...prev,
                grosir: [...current, { min: 1, max: 999999, harga: 0, isMixMatch: false }]
            }));
        };

        const removeGrosir = (index: number) => {
            const current = formData.grosir || [];
            const updated = [...current];
            updated.splice(index, 1);
            setFormData(prev => ({ ...prev, grosir: updated }));
        };

        const updateGrosir = (index: number, field: string, value: string | number | boolean) => {
            const current = formData.grosir || [];
            const updated = [...current];
            updated[index] = { ...updated[index], [field]: value };
            setFormData(prev => ({ ...prev, grosir: updated }));
        };

        const handleKategoriChange = (val: string) => {
             // Simple toggle logic for multi-select simulation or just standard Select if we limit to one for now.
             // User asked "pilih multi kategori".
             // Implementing true multi-select dropdown is complex with standard Select.
             // I'll implementation a simple multi-checkbox area for categories.
        };

        const toggleKategori = (id: string, checked: boolean) => {
            const current = formData.kategoriPelangganIds || [];
            if (checked) {
                setFormData(prev => ({ ...prev, kategoriPelangganIds: [...current, id] }));
            } else {
                setFormData(prev => ({ ...prev, kategoriPelangganIds: current.filter(k => k !== id) }));
            }
        };

        return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label>Produk</Label>
                <Select 
                    value={formData.barangId} 
                    onValueChange={(value) => {
                        // Auto select primary unit
                        const product = barang.find(b => b.id === value);
                        setFormData(prev => ({ 
                            ...prev, 
                            barangId: value,
                            satuanId: product?.satuanId || ''
                        }));
                    }}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Pilih Produk" />
                    </SelectTrigger>
                    <SelectContent>
                        {barang.map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.nama}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            
            <div className="space-y-2">
                <Label>Satuan</Label>
                <Select 
                    value={formData.satuanId} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, satuanId: value }))}
                    disabled={!formData.barangId}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Pilih Satuan" />
                    </SelectTrigger>
                    <SelectContent>
                        {/* Show Main Unit + Multi Units of selected product */}
                        {formData.barangId && (() => {
                            const product = barang.find(b => b.id === formData.barangId);
                            if (!product) return null;
                            const mainSatuan = satuan.find(s => s.id === product.satuanId);
                            
                            const options = [];
                            if (mainSatuan) options.push({ id: mainSatuan.id, nama: mainSatuan.nama, type: 'Utama' });
                            
                            if (product.multiSatuan) {
                                product.multiSatuan.forEach(ms => {
                                    const s = satuan.find(x => x.id === ms.satuanId);
                                    if (s) options.push({ id: s.id, nama: s.nama, type: 'Multi' });
                                });
                            }
                            
                            return options.map(opt => (
                                <SelectItem key={opt.id} value={opt.id}>{opt.nama} ({opt.type})</SelectItem>
                            ));
                        })()}
                    </SelectContent>
                </Select>
            </div>
          </div>
          
          <div className="space-y-2">
             <Label>Target Cabang</Label>
             <Select 
                value={formData.cabangId || "all"} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, cabangId: value === "all" ? undefined : value }))}
            >
                <SelectTrigger>
                    <SelectValue placeholder="Semua Cabang" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Semua Cabang</SelectItem>
                    {cabang.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nama}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 border rounded-md p-3">
             <Label className="mb-2 block">Target Kategori Pelanggan</Label>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                 {kategoriPelanggan.map(k => (
                     <div key={k.id} className="flex items-center space-x-2">
                         <input 
                            type="checkbox"
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                            checked={(formData.kategoriPelangganIds || []).includes(k.id)}
                            onChange={(e) => toggleKategori(k.id, e.target.checked)}
                         />
                         <span className="text-sm">{k.nama}</span>
                     </div>
                 ))}
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label>Harga Baru (Rp)</Label>
                <Input 
                   type="number" 
                   inputMode="numeric"
                   onFocus={(e) => e.target.select()}
                   name="harga" 
                   value={formData.harga} 
                   onChange={handleChange}
                   placeholder="0"
                   min={0}
                   required
                />
             </div>
             <div className="space-y-2">
                <Label>Tanggal Penetapan/Efektif</Label>
                <Input 
                   type="date" 
                   name="tanggalEfektif"
                   value={formData.tanggalEfektif ? new Date(formData.tanggalEfektif).toISOString().split('T')[0] : ''} 
                   onChange={(e) => setFormData(prev => ({ ...prev, tanggalEfektif: new Date(e.target.value) }))}
                   required
                />
             </div>
          </div>
          
           <div className="space-y-2">
                <Label>Min. Qty (Opsional)</Label>
                <Input 
                   type="number" 
                   inputMode="numeric"
                   onFocus={(e) => e.target.select()}
                   name="minQty" 
                   value={formData.minQty} 
                   onChange={handleChange}
                   placeholder="1"
                   min={1}
                />
             </div>

               {/* Grosir Section */}
               <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                     <div className="flex items-center justify-between">
                         <Label>Tingkatan Harga (Opsional)</Label>
                         <Button type="button" size="sm" variant="outline" onClick={addGrosir}>
                             <Plus className="w-3 h-3 mr-1" />
                             Tambah Tingkatan
                         </Button>
                     </div>
                     
                     {formData.grosir && formData.grosir.length > 0 ? (
                         <div className="space-y-4">
                             <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-1">
                                 <div className="col-span-5">Min Qty ( &gt;= )</div>
                                 <div className="col-span-6">Harga Satuan</div>
                                 <div className="col-span-1"></div>
                             </div>
                             {formData.grosir.map((g, index) => (
                                 <div key={index} className="space-y-2 animate-slide-up border-b pb-4 last:border-0 last:pb-0">
                                   <div className="grid grid-cols-12 gap-2 items-center">
                                     <div className="col-span-5">
                                         <Input 
                                             type="number" 
                                             inputMode="numeric"
                                             onFocus={(e) => e.target.select()}
                                             className="h-8"
                                             value={g.min}
                                             onChange={(e) => updateGrosir(index, 'min', e.target.value)}
                                             placeholder="1"
                                             min={1}
                                         />
                                     </div>
                                     <div className="col-span-6">
                                         <Input 
                                             type="number" 
                                             inputMode="numeric"
                                             onFocus={(e) => e.target.select()}
                                             className="h-8"
                                             value={g.harga}
                                             onChange={(e) => updateGrosir(index, 'harga', e.target.value)}
                                             placeholder="0"
                                             min={0}
                                         />
                                     </div>
                                     <div className="col-span-1 flex justify-end">
                                         <Button 
                                             type="button" 
                                             size="icon" 
                                             variant="ghost" 
                                             className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                             onClick={() => removeGrosir(index)}
                                         >
                                             <X className="w-4 h-4" />
                                         </Button>
                                     </div>
                                   </div>
                                   
                                   <div className="flex items-center space-x-2 pl-1">
                                      <Checkbox 
                                        id={`mixmatch-${index}`}
                                        checked={g.isMixMatch || false}
                                        onCheckedChange={(checked) => updateGrosir(index, 'isMixMatch', checked)}
                                      />
                                      <label htmlFor={`mixmatch-${index}`} className="text-xs text-muted-foreground cursor-pointer select-none">
                                        Hitung Total Semua Produk (Mix Match)
                                      </label>
                                   </div>
                                 </div>
                             ))}
                         </div>
                     ) : (
                         <div className="text-xs text-center text-muted-foreground py-2 italic">
                             Belum ada tingkatan harga (Contoh: Beli &gt;= 10 @ Rp 9.000)
                         </div>
                     )}
               </div>
        </>
      )}}
    />
  );
}
