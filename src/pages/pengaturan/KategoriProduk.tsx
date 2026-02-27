import { SettingsCrud } from '@/components/settings/SettingsCrud';
import { Tags } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDatabase } from '@/contexts/DatabaseContext';
import { Kategori } from '@/lib/types';

export default function KategoriProduk() {
  const { kategori, addKategori, updateKategori, deleteKategori } = useDatabase();

  return (
    <SettingsCrud<Kategori>
      title="Kategori Produk"
      icon={Tags}
      items={kategori}
      columns={[
        { key: 'nama', label: 'Nama Kategori' },
        { key: 'deskripsi', label: 'Deskripsi' }
      ]}
      initialFormState={{ nama: '', deskripsi: '' }}
      onSave={(item) => {
        const exists = kategori.find(k => k.id === item.id);
        if (exists) {
          updateKategori(item.id, item);
        } else {
          addKategori({
            ...item,
            id: self.crypto.randomUUID()
          });
        }
      }}
      onDelete={(id) => deleteKategori(id)}
      renderForm={(formData, handleChange) => (
        <>
          <div className="space-y-2">
            <Label>Nama Kategori</Label>
            <Input 
              name="nama" 
              value={formData.nama} 
              onChange={handleChange} 
              placeholder="Contoh: Minuman"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Deskripsi</Label>
            <Textarea 
              name="deskripsi" 
              value={formData.deskripsi || ''} 
              onChange={handleChange} 
              placeholder="Deskripsi kategori (opsional)"
              rows={3}
            />
          </div>
        </>
      )}
    />
  );
}
