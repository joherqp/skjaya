import { SettingsCrud } from '@/components/settings/SettingsCrud';
import { UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { Karyawan as KaryawanType } from '@/lib/types';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { useState } from 'react';


export default function Karyawan() {
  const {
    karyawan, addKaryawan, updateKaryawan, deleteKaryawan,
    users, updateUser,
    addPersetujuan, cabang
  } = useDatabase();
  const { user } = useAuth();

  // Get list of all users, sorting available ones first
  const getAvailableUsers = (currentUserId?: string) => {
    return [...users].sort((a, b) => {
      const aTaken = a.karyawanId && a.id !== currentUserId;
      const bTaken = b.karyawanId && b.id !== currentUserId;
      if (aTaken === bTaken) return 0;
      return aTaken ? 1 : -1;
    });
  };

  const [activeTab, setActiveTab] = useState('aktif');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredKaryawan = karyawan.filter(k => {
    // Tab Filter
    const matchTab = activeTab === 'all' ? true : k.status === activeTab;

    // Search Filter
    const matchSearch = searchQuery === '' ||
      k.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.posisi.toLowerCase().includes(searchQuery.toLowerCase());

    return matchTab && matchSearch;
  });

  return (
    <SettingsCrud<KaryawanType>
      title="Data Karyawan"
      icon={UserCheck}
      items={filteredKaryawan}
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
              placeholder="Cari Nama / Posisi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      }
      columns={[
        {
          key: 'nama',
          label: 'Nama Lengkap',
          render: (item) => (
            <div className="flex items-center gap-2">
              <span className="font-medium">{item.nama}</span>
              {item.userAccountId && (
                <div className="flex items-center text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100" title="Memiliki Akun Login">
                  <UserCheck className="w-3 h-3 mr-1" />
                  Login
                </div>
              )}
            </div>
          )
        },
        {
          key: 'cabangId',
          label: 'Cabang',
          render: (item) => {
            const c = cabang.find(c => c.id === item.cabangId);
            return c ? c.nama : '-';
          }
        },
        { key: 'posisi', label: 'Posisi' },
        { key: 'telepon', label: 'Telepon' },
        {
          key: 'status',
          label: 'Status',
          render: (item) => (
            <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.status === 'aktif'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
              }`}>
              {item.status === 'aktif' ? 'Aktif' : 'Non-aktif'}
            </span>
          )
        }
      ]}
      initialFormState={{
        nama: '', posisi: '', telepon: '', status: 'aktif', cabangId: '',
        alamat: '', provinsi: '', kota: '', kecamatan: '', kelurahan: '', kodePos: '',
        koordinat: ''
      }}
      onSave={(item) => {
        const exists = karyawan.find(k => k.id === item.id);
        const karyawanId = exists ? item.id : self.crypto.randomUUID();

        // Critical: EVERY change by Admin requires Owner approval
        if (exists && user?.roles.includes('admin') && !user?.roles.includes('owner')) {
          // Create Approval Request for ANY change
          addPersetujuan({
            id: self.crypto.randomUUID(),
            jenis: 'mutasi_karyawan',
            referensiId: exists.id,
            status: 'pending',
            diajukanOleh: user.id,
            targetRole: 'owner',
            tanggalPengajuan: new Date(),
            catatan: `Perubahan data karyawan: ${exists.nama}`,
            data: {
              ...item, // Send all pending changes
              isCabangChanged: item.cabangId !== exists.cabangId,
              isStatusChanged: item.status !== exists.status,
              oldCabangId: exists.cabangId,
              oldStatus: exists.status
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
          toast.success('Permintaan persetujuan dikirim ke Owner');
          return; // STOP execution
        }

        // Normal update flow
        if (exists) {
          // Check if userAccountId (now refers to user_id) changed
          const oldUserId = exists.userAccountId;

          // Remove old link if changed
          if (oldUserId && oldUserId !== item.userAccountId) {
            updateUser(oldUserId, { karyawanId: undefined });
          }

          updateKaryawan(item.id, item);
        } else {
          addKaryawan({
            ...item,
            id: karyawanId
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
        }

        // Update bidirectional link in Users
        if (item.userAccountId) {
          // Check if target User is already linked to ANOTHER employee (Steal it!)
          const targetUser = users.find(u => u.id === item.userAccountId);
          if (targetUser && targetUser.karyawanId && targetUser.karyawanId !== karyawanId) {
            // 1. Unlink the OTHER employee
            const otherKaryawan = karyawan.find(k => k.id === targetUser.karyawanId);
            if (otherKaryawan) {
              updateKaryawan(otherKaryawan.id, { userAccountId: undefined });
              toast.info(`Akun login dilepas dari karyawan: ${otherKaryawan.nama}`);
            }
          }

          updateUser(item.userAccountId, {
            karyawanId,
            cabangId: item.cabangId // SYNC: Ensure User branch matches Karyawan branch
          });
        }
      }}
      onDelete={(id) => {
        const karyawanToDelete = karyawan.find(k => k.id === id);

        // Remove link from user
        if (karyawanToDelete?.userAccountId) {
          updateUser(karyawanToDelete.userAccountId, { karyawanId: undefined });
        }

        deleteKaryawan(id);
      }}
      renderForm={(formData, handleChange) => (
        <>
          <div className="space-y-2">
            <Label>Nama Lengkap</Label>
            <Input
              name="nama"
              value={formData.nama}
              onChange={handleChange}
              placeholder="Nama Karyawan"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Posisi / Jabatan</Label>
            <Input
              name="posisi"
              value={formData.posisi}
              onChange={handleChange}
              placeholder="Contoh: Sales"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Nomor Telepon</Label>
            <Input
              name="telepon"
              value={formData.telepon}
              onChange={handleChange}
              placeholder="08..."
              required
              type="tel"
              inputMode="numeric"
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <Label className="text-base font-semibold mb-4 block">Detail Alamat & Lokasi</Label>

            <div className="space-y-2 mb-4">
              <Label>Alamat Lengkap</Label>
              <Input
                name="alamat"
                value={formData.alamat || ''}
                onChange={handleChange}
                placeholder="Jl. Contoh No. 123"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Provinsi</Label>
                <Input
                  name="provinsi"
                  value={formData.provinsi || ''}
                  onChange={handleChange}
                  placeholder="Jawa Barat"
                />
              </div>
              <div className="space-y-2">
                <Label>Kota / Kabupaten</Label>
                <Input
                  name="kota"
                  value={formData.kota || ''}
                  onChange={handleChange}
                  placeholder="Bandung"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Kecamatan</Label>
                <Input
                  name="kecamatan"
                  value={formData.kecamatan || ''}
                  onChange={handleChange}
                  placeholder="Cicendo"
                />
              </div>
              <div className="space-y-2">
                <Label>Kelurahan</Label>
                <Input
                  name="kelurahan"
                  value={formData.kelurahan || ''}
                  onChange={handleChange}
                  placeholder="Arjuna"
                />
              </div>
              <div className="space-y-2">
                <Label>Kode Pos</Label>
                <Input
                  name="kodePos"
                  value={formData.kodePos || ''}
                  onChange={handleChange}
                  placeholder="40172"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Titik Koordinat (Latitude, Longitude)</Label>
              <Input
                name="koordinat"
                value={(() => {
                  const k = formData.koordinat;
                  if (!k) return '';
                  if (typeof k === 'string') return k;
                  const loc = k as import('@/lib/types').Lokasi;
                  const lat = loc.lat ?? loc.latitude ?? '';
                  const lng = loc.lng ?? loc.longitude ?? '';
                  return `${lat}, ${lng}`;
                })() as string}
                onChange={handleChange}
                placeholder="-6.123456, 107.123456"
              />
              <p className="text-xs text-muted-foreground">
                Salin koordinat dari Google Maps. Contoh: -6.917464, 107.619122
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Non-aktif</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Cabang Penempatan</Label>
            <select
              name="cabangId"
              value={formData.cabangId || ''}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            >
              <option value="">-- Pilih Cabang --</option>
              {cabang.map(c => (
                <option key={c.id} value={c.id}>{c.nama}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Link ke Akun Pengguna (Opsional)</Label>
            <select
              name="userAccountId"
              value={formData.userAccountId || ''}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">-- Tidak ada akun --</option>
              {getAvailableUsers(formData.userAccountId).map(u => {
                const isTaken = u.karyawanId && u.id !== formData.userAccountId;
                const takenBy = isTaken ? karyawan.find(k => k.id === u.karyawanId)?.nama : null;

                return (
                  <option key={u.id} value={u.id} className={isTaken ? "text-red-500" : ""}>
                    {u.username} ({u.email || '-'}) - {u.roles ? u.roles.join(', ') : '-'}
                    {isTaken ? ` (Dipakai: ${takenBy || 'Lain'})` : ''}
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-muted-foreground">
              Pilih akun pengguna untuk memberikan akses login ke karyawan ini
            </p>
          </div>
          {formData.userAccountId && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                🔗 Terhubung ke akun: <strong>{users.find(u => u.id === formData.userAccountId)?.username || 'N/A'}</strong> <br />
                <span className="text-xs text-blue-600">Email: {users.find(u => u.id === formData.userAccountId)?.email || '-'}</span>
              </p>
            </div>
          )}
        </>
      )}
    />
  );
}
