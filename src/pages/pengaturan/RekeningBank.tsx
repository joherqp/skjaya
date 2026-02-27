import { SettingsCrud } from '@/components/settings/SettingsCrud';
import { CreditCard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
// Select imports removed as they were unused
import { useDatabase } from '@/contexts/DatabaseContext';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { RekeningBank as RekeningBankType } from '@/lib/types';
import { toast } from 'sonner';

export default function RekeningBank() {
  const { rekeningBank, addRekeningBank, updateRekeningBank, deleteRekeningBank, users } = useDatabase();

  return (
    <SettingsCrud<RekeningBankType>
      title="Rekening Bank & Kas"
      icon={CreditCard}
      items={rekeningBank}
      columns={[
        { key: 'namaBank', label: 'Bank' },
        { key: 'nomorRekening', label: 'No. Rekening' },
        { key: 'atasNama', label: 'Atas Nama' }
      ]}
      initialFormState={{ namaBank: '', nomorRekening: '', atasNama: '', isTunai: false, assignedUserId: '' }}
      onSave={(item) => {
        const exists = rekeningBank.find(r => r.id === item.id);
        if (exists) {
          updateRekeningBank(item.id, item);
        } else {
          const { id, ...newItem } = item;
          addRekeningBank(newItem);
        }
      }}
      onDelete={async (id) => {
          try {
              await deleteRekeningBank(id);
          } catch (error: unknown) {
              const err = error as { code?: string; message?: string };
              if (err?.code === '23503' || (err?.message && err.message.includes('violate foreign key constraint'))) {
                  toast.error("Gagal menghapus: Rekening ini masih memiliki riwayat transaksi (setoran).", { duration: 5000 });
              } else {
                  toast.error("Gagal menghapus rekening");
              }
              // Rethrow to stop UI removal if crud component handles optimistic updates? 
              // SettingsCrud likely handles local state remove on success only if we don't throw?
              // Actually, if we throw, SettingsCrud might show generic error. 
              // Let's ensure we return or throw in a way SettingsCrud expects.
              // Assuming SettingsCrud calls this and waits. If it fails, we should let it know.
              throw error; 
          }
      }}
      renderForm={(formData, handleChange) => (
        <>
          <div className="flex items-center justify-between pb-2">
            <Label>Jenis Akun ({formData.isTunai ? 'Tunai / Kas' : 'Bank Transfer'})</Label>
            <Switch 
              checked={formData.isTunai}
              onCheckedChange={(checked) => handleChange({ target: { name: 'isTunai', type: 'checkbox', checked } } as unknown as React.ChangeEvent<HTMLInputElement>)}
            />
          </div>
          
          <div className="space-y-2">
             <Label>Dikelola Oleh / Penerima Persetujuan (Opsional)</Label>
             <SearchableSelect
                value={formData.assignedUserId || "none"}
                onChange={(val) => handleChange({ target: { name: 'assignedUserId', value: val === "none" ? null : val } } as React.ChangeEvent<HTMLInputElement>)}
                placeholder="Pilih User Penanggung Jawab..."
                searchPlaceholder="Cari User..."
                options={[
                    { label: "-- Tidak Ada / Default --", value: "none" },
                    ...users.filter(u => u.isActive !== false).map(u => ({
                        label: u.nama,
                        value: u.id,
                        description: u.roles.join(', ')
                    }))
                ]}
             />
             <p className="text-[10px] text-muted-foreground">User yang dipilih akan menjadi tujuan persetujuan setoran untuk rekening ini.</p>
          </div>

          <div className="space-y-2">
            <Label>Nama Bank / Akun</Label>
            <Input 
              name="namaBank" 
              value={formData.namaBank} 
              onChange={handleChange} 
              placeholder="Contoh: BCA atau KAS HARIAN"
              required
            />
          </div>
          {!formData.isTunai && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nomor Rekening</Label>
                <Input 
                  name="nomorRekening" 
                  value={formData.nomorRekening} 
                  onChange={handleChange} 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Atas Nama</Label>
                <Input 
                  name="atasNama" 
                  value={formData.atasNama} 
                  onChange={handleChange} 
                  required
                />
              </div>
            </div>
          )}
        </>
      )}
    />
  );
}
