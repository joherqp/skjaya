import { useRef, useState } from 'react';
import { Package, Plus, Trash, X, Upload, Image as ImageIcon, Search, Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsCrud } from '@/components/settings/SettingsCrud';
import { useDatabase } from '@/contexts/DatabaseContext';
import { Barang } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabase';
import imageCompression from 'browser-image-compression';
import { toast } from 'sonner';


export default function MasterProduk() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { barang, addBarang, updateBarang, deleteBarang, kategori, satuan } = useDatabase();

  const [activeTab, setActiveTab] = useState('aktif');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const filteredBarang = barang.filter(b => {
      // Tab Filter
      const matchTab = activeTab === 'all' ? true : 
                       activeTab === 'aktif' ? b.isActive : !b.isActive;
      
      // Search Filter
      const matchSearch = searchQuery === '' || 
                          b.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          b.kode.toLowerCase().includes(searchQuery.toLowerCase());

      return matchTab && matchSearch;
  });

  return (
    <SettingsCrud<Barang>
      title="Master Produk"
      icon={Package}
      items={filteredBarang}
      extraContent={
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                <TabsList>
                    <TabsTrigger value="aktif">Aktif</TabsTrigger>
                    <TabsTrigger value="nonaktif">Nonaktif</TabsTrigger>
                    <TabsTrigger value="all">Semua</TabsTrigger>
                </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-72">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Cari Nama / Kode Barang..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                />
            </div>
        </div>
      }
      columns={[
        { key: 'kode', label: 'Kode Barang' },
        { key: 'nama', label: 'Nama Barang' },
        { 
          key: 'kategoriId', 
          label: 'Kategori',
          render: (item) => kategori.find(k => k.id === item.kategoriId)?.nama || '-'
        },
        { 
            key: 'satuanId', 
            label: 'Satuan',
            render: (item) => satuan.find(s => s.id === item.satuanId)?.nama || '-'
        },
        {
          key: 'isActive',
          label: 'Status',
          render: (item) => (
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {item.isActive ? 'Aktif' : 'Nonaktif'}
            </span>
          )
        },
      ]}
      initialFormState={{
        kode: '',
        nama: '',
        kategoriId: '',
        satuanId: '',
        hargaBeli: 0,
        hargaJual: 0,
        isActive: true,
        multiSatuan: []
      }}
      onSave={(item) => {
        const exists = barang.find(b => b.id === item.id);
        const dataToSave = {
            ...item,
            ...item,
            multiSatuan: item.multiSatuan?.map(m => ({
                ...m,
                konversi: Number(m.konversi)
            })) || []
        };

        if (exists) {
          updateBarang(item.id, dataToSave);
        } else {
          addBarang(dataToSave);
        }
        
        // Auto switch tab to match status
        setActiveTab(item.isActive ? 'aktif' : 'nonaktif');
      }}
      onDelete={deleteBarang}
      renderForm={(formData, handleChange, setFormData) => {
        const addMultiSatuan = () => {
            const current = formData.multiSatuan || [];
            setFormData(prev => ({
                ...prev,
                multiSatuan: [...current, { satuanId: '', konversi: 1 }]
            }));
        };

        const removeMultiSatuan = (index: number) => {
            const current = formData.multiSatuan || [];
            if (!current) return;
            const updated = [...current];
            updated.splice(index, 1);
            setFormData(prev => ({ ...prev, multiSatuan: updated }));
        };

        const updateMultiSatuan = (index: number, field: string, value: string | number) => {
            const current = formData.multiSatuan || [];
            if (!current) return;
            const updated = [...current];
            updated[index] = { ...updated[index], [field]: value };
            setFormData(prev => ({ ...prev, multiSatuan: updated }));
        };



    return (
        <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kode Barang</Label>
                  <Input
                    name="kode"
                    value={formData.kode}
                    onChange={handleChange}
                    placeholder="BRG-001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nama Barang</Label>
                  <Input
                    name="nama"
                    value={formData.nama}
                    onChange={handleChange}
                    placeholder="Nama Produk"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Harga Beli</Label>
                  <Input
                    name="hargaBeli"
                    type="number"
                    value={formData.hargaBeli}
                    onChange={handleChange}
                    placeholder="0"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Harga Jual</Label>
                  <Input
                    name="hargaJual"
                    type="number"
                    value={formData.hargaJual}
                    onChange={handleChange}
                    placeholder="0"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Foto Produk</Label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-lg border border-dashed border-muted-foreground/50 flex items-center justify-center bg-muted/20 overflow-hidden relative group">
                     {formData.gambarUrl ? (
                        <>
                          <img src={formData.gambarUrl} alt="Preview" className="w-full h-full object-cover" />
                           <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer" onClick={() => setFormData(p => ({ ...p, gambarUrl: undefined }))}>
                              <Trash className="w-5 h-5 text-white" />
                           </div>
                        </>
                     ) : (
                        <ImageIcon className="w-10 h-10 text-muted-foreground/50" />
                     )}
                  </div>
                  <div className="space-y-2">
                     <input 
                       type="file" 
                       ref={fileInputRef} 
                       className="hidden" 
                       accept="image/*"
                       onChange={async (e) => {
                           const file = e.target.files?.[0];
                           if (file) {
                               setIsUploading(true);
                               try {
                                   // 1. Compress Image
                                   const options = {
                                       maxSizeMB: 0.5,
                                       maxWidthOrHeight: 800,
                                       useWebWorker: true
                                   };
                                   const compressedFile = await imageCompression(file, options);
                                   
                                   // 2. Upload to Supabase
                                   const fileExt = file.name.split('.').pop();
                                   const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
                                   const filePath = `${fileName}`;

                                   const { error: uploadError } = await supabase.storage
                                       .from('produk')
                                       .upload(filePath, compressedFile);

                                   if (uploadError) throw uploadError;

                                   // 3. Get Public URL
                                   const { data: { publicUrl } } = supabase.storage
                                       .from('produk')
                                       .getPublicUrl(filePath);

                                   setFormData(prev => ({ ...prev, gambarUrl: publicUrl }));
                                   toast.success("Foto berhasil diunggah");
                               } catch (error: unknown) {
                                   console.error("Upload Error:", error);
                                   toast.error("Gagal mengunggah foto: " + (error as Error).message);
                               } finally {
                                   setIsUploading(false);
                               }
                           }
                       }}
                     />
                     <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                     >
                       {isUploading ? (
                           <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                       ) : (
                           <Upload className="w-3 h-3 mr-2" />
                       )}
                       {isUploading ? "Mengunggah..." : "Upload Foto"}
                     </Button>
                     <p className="text-[10px] text-muted-foreground">Max 2MB. JPG/PNG.</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Kategori Produk</Label>
                    <Select 
                        value={formData.kategoriId} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, kategoriId: value }))}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih Kategori" />
                        </SelectTrigger>
                        <SelectContent>
                            {kategori.map(k => (
                                <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Satuan Utama</Label>
                    <Select 
                        value={formData.satuanId} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, satuanId: value }))}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih Satuan" />
                        </SelectTrigger>
                        <SelectContent>
                            {satuan.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
              </div>





              {/* Multi Satuan Section */}
              <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                        <Label>Multi Satuan (Opsional)</Label>
                        <Button type="button" size="sm" variant="outline" onClick={addMultiSatuan}>
                            <Plus className="w-3 h-3 mr-1" />
                            Tambah Satuan
                        </Button>
                    </div>
                    
                    {formData.multiSatuan && formData.multiSatuan.length > 0 ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-1">
                                <div className="col-span-6">Satuan</div>
                                <div className="col-span-1"></div>
                                <div className="col-span-4">Konversi (ke Satuan Utama)</div>
                                <div className="col-span-1"></div>
                            </div>
                            {formData.multiSatuan.map((ms, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-center animate-slide-up">
                                    <div className="col-span-6">
                                        <Select 
                                            value={ms.satuanId} 
                                            onValueChange={(value) => updateMultiSatuan(index, 'satuanId', value)}
                                        >
                                            <SelectTrigger className="h-8">
                                                <SelectValue placeholder="Pilih" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {satuan.filter(s => s.id !== formData.satuanId).map(s => (
                                                    <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-1 text-center text-sm">=</div>
                                    <div className="col-span-4 relative">
                                        <Input 
                                            type="number" 
                                            className="h-8 pl-8"
                                            value={ms.konversi}
                                            onChange={(e) => updateMultiSatuan(index, 'konversi', e.target.value)}
                                            placeholder="1"
                                            min={1}
                                        />
                                        <span className="absolute left-2 top-2 text-xs text-muted-foreground">x</span>
                                    </div>
                                    <div className="col-span-1 flex justify-end">
                                        <Button 
                                            type="button" 
                                            size="icon" 
                                            variant="ghost" 
                                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                            onClick={() => removeMultiSatuan(index)}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-xs text-center text-muted-foreground py-2 italic">
                            Belum ada satuan tambahan (Contoh: 1 Dus = 12 Pcs)
                        </div>
                    )}
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox 
                  id="isActive" 
                  checked={formData.isActive} 
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: !!checked }))}
                />
                <label htmlFor="isActive" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Produk Aktif
                </label>
              </div>

            </>
          );
      }}
    />
  );
}
