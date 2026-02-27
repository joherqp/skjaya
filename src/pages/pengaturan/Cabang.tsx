import { SettingsCrud } from '@/components/settings/SettingsCrud';
import { Store, Locate, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useDatabase } from '@/contexts/DatabaseContext';
import { Cabang as CabangType } from '@/lib/types';
import { getCurrentLocation } from '@/lib/gps';
import { toast } from 'sonner';
import { useState } from 'react';

export default function Cabang() {
  const { cabang, addCabang, updateCabang, deleteCabang, area } = useDatabase();
  const [loadingLoc, setLoadingLoc] = useState(false);

  return (
    <SettingsCrud<CabangType>
      title="Daftar Cabang"
      icon={Store}
      items={cabang}
      columns={[
        { key: 'nama', label: 'Nama Cabang' },
        {
          key: 'areaId',
          label: 'Area',
          render: (item) => area.find(a => a.id === item.areaId)?.nama || '-'
        },
        { key: 'kota', label: 'Kota' }
      ]}
      initialFormState={{ nama: '', alamat: '', kota: '', telepon: '', areaId: '', koordinat: '' }}
      onSave={(item) => {
        const exists = cabang.find(c => c.id === item.id);
        if (exists) {
          updateCabang(item.id, item);
        } else {
          const { id, ...rest } = item;
          addCabang(rest);
        }
      }}
      onDelete={(id) => deleteCabang(id)}
      renderForm={(formData, handleChange, setFormData) => (
        <>
          <div className="space-y-2">
            <Label>Nama Cabang</Label>
            <Input
              name="nama"
              value={formData.nama}
              onChange={handleChange}
              placeholder="Contoh: Cabang Bekasi"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Area / Wilayah</Label>
            <select
              name="areaId"
              value={formData.areaId || ''}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            >
              <option value="">-- Pilih Area --</option>
              {area.map(a => (
                <option key={a.id} value={a.id}>{a.nama} ({a.kota})</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Alamat Lengkap & Koordinat GPS</Label>
            <div className="relative">
              <Input
                name="alamat"
                value={formData.alamat}
                onChange={handleChange}
                placeholder="Alamat cabang"
                className="pr-12"
                required
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute right-2 top-2 text-primary hover:bg-primary/10"
                onClick={async () => {
                  setLoadingLoc(true);
                  try {
                    const loc = await getCurrentLocation();
                    setFormData(prev => ({
                      ...prev,
                      koordinat: `${loc.latitude}, ${loc.longitude}`,
                      alamat: loc.alamat || prev.alamat
                    }));
                    toast.success('Lokasi berhasil diambil');
                  } catch (err: unknown) {
                    const e = err as Error;
                    toast.error(e.message || 'Gagal mengambil lokasi');
                  } finally {
                    setLoadingLoc(false);
                  }
                }}
                disabled={loadingLoc}
              >
                <Locate className={`w-4 h-4 ${loadingLoc ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kota</Label>
              <Input
                name="kota"
                value={formData.kota}
                onChange={handleChange}
                placeholder="Nama kota"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Koordinat (Lat, Lng)</Label>
              <div className="relative">
                <Input
                  name="koordinat"
                  value={formData.koordinat}
                  onChange={handleChange}
                  placeholder="-6.xxx, 106.xxx"
                  className="pl-9"
                />
                <MapPin className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Telepon</Label>
            <Input
              name="telepon"
              value={formData.telepon}
              onChange={handleChange}
              placeholder="No. telepon"
              required
              type="tel"
              inputMode="numeric"
            />
          </div>
        </>
      )}
    />
  );
}
