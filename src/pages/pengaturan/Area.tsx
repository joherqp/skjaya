import { SettingsCrud } from '@/components/settings/SettingsCrud';
import { Map } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDatabase } from '@/contexts/DatabaseContext';
import { Area as AreaType } from '@/lib/types';

export default function Area() {
  const { area, addArea, updateArea, deleteArea } = useDatabase();

  return (
    <SettingsCrud<AreaType>
      title="Pengaturan Area"
      icon={Map}
      items={area}
      columns={[
        { key: 'nama', label: 'Nama Area' },
        { key: 'kota', label: 'Kota/Kabupaten' }
      ]}
      initialFormState={{ nama: '', kota: '' }}
      onSave={(item) => {
        const exists = area.find(a => a.id === item.id);
        if (exists) {
          updateArea(item.id, item);
        } else {
          addArea({
            ...item,
            id: self.crypto.randomUUID()
          });
        }
      }}
      onDelete={(id) => deleteArea(id)}
      renderForm={(formData, handleChange) => (
        <>
          <div className="space-y-2">
            <Label>Nama Area</Label>
            <Input 
              name="nama" 
              value={formData.nama} 
              onChange={handleChange} 
              placeholder="Contoh: Jakarta Selatan"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Kota / Kabupaten</Label>
            <Input 
              name="kota" 
              value={formData.kota} 
              onChange={handleChange} 
              placeholder="Contoh: Jakarta"
              required
            />
          </div>
        </>
      )}
    />
  );
}
