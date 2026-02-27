import { SettingsCrud } from '@/components/settings/SettingsCrud';
import { Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDatabase } from '@/contexts/DatabaseContext';
import { KategoriPelanggan as KategoriPelangganType } from '@/lib/types';

export default function KategoriPelanggan() {
  const { kategoriPelanggan, addKategoriPelanggan, updateKategoriPelanggan, deleteKategoriPelanggan } = useDatabase();

  return (
    <SettingsCrud<KategoriPelangganType>
      title="Kategori Pelanggan"
      icon={Users}
      items={kategoriPelanggan}
      columns={[
        { key: 'nama', label: 'Nama Kategori' },
        { key: 'diskon', label: 'Diskon Default (%)' }
      ]}
      initialFormState={{ nama: '', diskon: 0 }}
      onSave={(item) => {
        const exists = kategoriPelanggan.find(kp => kp.id === item.id);
        if (exists) {
          updateKategoriPelanggan(item.id, item);
        } else {
          addKategoriPelanggan({
            ...item,
            id: self.crypto.randomUUID()
          });
        }
      }}
      onDelete={(id) => deleteKategoriPelanggan(id)}
      renderForm={(formData, handleChange) => (
        <>
          <div className="space-y-2">
            <Label>Nama Kategori</Label>
            <Input 
              name="nama" 
              value={formData.nama} 
              onChange={handleChange} 
              placeholder="Contoh: Platinum"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Default Diskon (%)</Label>
            <Input 
              name="diskon" 
              type="number"
              value={formData.diskon} 
              onChange={handleChange} 
              placeholder="0"
              min="0"
              max="100"
            />
          </div>
        </>
      )}
    />
  );
}
