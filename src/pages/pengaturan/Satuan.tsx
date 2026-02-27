import { SettingsCrud } from '@/components/settings/SettingsCrud';
import { Ruler } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDatabase } from '@/contexts/DatabaseContext';
import { Satuan as SatuanType } from '@/lib/types';

export default function Satuan() {
  const { satuan, addSatuan, updateSatuan, deleteSatuan } = useDatabase();

  return (
    <SettingsCrud<SatuanType>
      title="Satuan Produk"
      icon={Ruler}
      items={satuan}
      columns={[
        { key: 'nama', label: 'Nama Satuan' },
        { key: 'simbol', label: 'Simbol' }
      ]}
      initialFormState={{ nama: '', simbol: '' }}
      onSave={(item) => {
        const exists = satuan.find(s => s.id === item.id);
        if (exists) {
          updateSatuan(item.id, item);
        } else {
          addSatuan({
            ...item,
            id: self.crypto.randomUUID()
          });
        }
      }}
      onDelete={(id) => deleteSatuan(id)}
      renderForm={(formData, handleChange) => (
        <>
          <div className="space-y-2">
            <Label>Nama Satuan</Label>
            <Input 
              name="nama" 
              value={formData.nama} 
              onChange={handleChange} 
              placeholder="Contoh: Karton"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Simbol</Label>
            <Input 
              name="simbol" 
              value={formData.simbol} 
              onChange={handleChange} 
              placeholder="Contoh: krt"
              required
            />
          </div>
        </>
      )}
    />
  );
}
