import { SettingsCrud } from '@/components/settings/SettingsCrud';
import { User, Lock, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDatabase } from '@/contexts/DatabaseContext';
import { User as UserType, UserRole } from '@/lib/types'; // Updated import
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { useState } from 'react';

// Local UserRole removed, using imported one


// Module augmentation removed as types.ts is updated


export default function Pengguna() {
  const { users, addUser, updateUser, deleteUser, addKaryawan, karyawan } = useDatabase();

  const roleLabels: Record<UserRole, string> = {
    admin: 'Administrator',
    owner: 'Owner',
    gudang: 'Gudang',
    leader: 'Leader',
    sales: 'Sales',
    staff: 'Staff',
    finance: 'Finance',
    driver: 'Driver',
  };

  const [activeTab, setActiveTab] = useState('aktif');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter(user => {
    const matchTab = activeTab === 'all' ? true : 
                     activeTab === 'aktif' ? user.isActive : !user.isActive;
    
    const matchSearch = searchQuery === '' || 
                        user.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        user.email.toLowerCase().includes(searchQuery.toLowerCase());
                        
    return matchTab && matchSearch;
  });

  return (
    <SettingsCrud<UserType>
      title="Pengelolaan Pengguna Login"
      icon={User}
      items={filteredUsers}
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
                    placeholder="Cari Username / Email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                />
            </div>
        </div>
      }
      columns={[
        { key: 'username', label: 'Username' },
        { key: 'email', label: 'Email' },
        { 
          key: 'karyawanId', 
          label: 'Terhubung ke Karyawan',
          render: (item) => {
             const linked = karyawan.find(k => k.id === item.karyawanId);
             return linked ? (
               <div className="flex items-center gap-1 text-xs">
                 <UserCheck className="w-3 h-3 text-green-600" />
                 <span className="font-medium text-green-700">{linked.nama}</span>
               </div>
             ) : (
               <span className="text-muted-foreground text-xs italic">Tidak terhubung</span>
             );
          }
        },
        {
          key: 'roles',
          label: 'Peran',
          render: (item) => (
            <div className="flex flex-wrap gap-1">
              {item.roles && item.roles.map(r => (
                <span key={r} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                  {roleLabels[r] || r}
                </span>
              ))}
            </div>
          )
        }
      ]}
      initialFormState={{ username: '', email: '', roles: ['staff'], cabangId: '', isActive: true, startDate: undefined, endDate: undefined } as unknown as UserType}
      onSave={(item) => {
        const exists = users.find(u => u.id === item.id);
        if (exists) {
          updateUser(item.id, item);
        } else {
          // Auto-create Karyawan logic
          const newUserId = self.crypto.randomUUID();
          const newKaryawanId = self.crypto.randomUUID();
          
          // Default Branch (Pusat)
          const defaultCabangId = '550e8400-e29b-41d4-a716-446655440002'; 

          // Create User linked to Karyawan
          const { id: _ignored, ...userData } = item;
          addUser({
            ...userData,
            id: newUserId,
            // Ensure mandatory fields for users table
            nama: item.username, // Default name to username if not provided
            telepon: '-',
            cabangId: defaultCabangId,
            isActive: true,
            karyawanId: newKaryawanId
          } as any); // eslint-disable-line @typescript-eslint/no-explicit-any



          // Create Karyawan linked to User
          addKaryawan({
            id: newKaryawanId,
            nama: item.username, 
            posisi: 'Staff', 
            telepon: '-', 
            status: 'aktif',
            cabangId: defaultCabangId, 
            userAccountId: newUserId // Linking to users.id
          } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        }
        
        // Auto switch tab to match status
        setActiveTab(item.isActive ? 'aktif' : 'nonaktif');
      }}
      onDelete={(id) => deleteUser(id)}
      renderForm={(formData, handleChange) => {
        const handleRoleChange = (role: UserRole, checked: boolean) => {
          const currentRoles = formData.roles || [];
          const newRoles = checked
            ? [...currentRoles, role]
            : currentRoles.filter((r: UserRole) => r !== role);
          handleChange({
            target: {
              name: 'roles',
              value: newRoles,
              type: 'checkbox-group'
            }
          } as unknown as React.ChangeEvent<HTMLInputElement>);
        };

        return (
          <>
            <div className="bg-yellow-50 p-3 rounded-md mb-4 border border-yellow-200">
              <p className="text-sm text-yellow-800">
                <strong>Penting:</strong> Setelah menambah pengguna di sini, Anda 
                <strong> WAJIB</strong> membuat akun login dengan email yang sama di 
                <strong> Supabase Dashboard {'>'} Authentication</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Username (contoh: sales1)"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email Login</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email || ''}
                onChange={handleChange}
                placeholder="Email untuk login (contoh: sales1@cvskj.com)"
                required
              />
              <p className="text-xs text-muted-foreground">
                Email ini harus sama persis dengan yang didaftarkan di Supabase Auth.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Peran (Bisa lebih dari satu)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 border rounded-md p-3">
                {(Object.keys(roleLabels) as UserRole[]).map((roleKey) => (
                  <div key={roleKey} className="flex items-center space-x-2">
                    <Checkbox
                      id={`role-${roleKey}`}
                      checked={formData.roles?.includes(roleKey)}
                      onCheckedChange={(checked) => handleRoleChange(roleKey, checked as boolean)}
                    />
                    <Label htmlFor={`role-${roleKey}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {roleLabels[roleKey]}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2 border p-3 rounded-md bg-muted/20">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => handleChange({
                  target: { name: 'isActive', value: checked, type: 'checkbox', checked: checked }
                } as unknown as React.ChangeEvent<HTMLInputElement>)}
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Status Akun Aktif {formData.isActive ? '(Bisa Login)' : '(Tidak Bisa Login)'}
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label>Tanggal Masuk / Mulai Aktif</Label>
                  <Input 
                    type="date" 
                    value={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => handleChange({ target: { name: 'startDate', value: e.target.value ? new Date(e.target.value) : null } } as unknown as React.ChangeEvent<HTMLInputElement>)}
                  />
               </div>
               <div className="space-y-2">
                  <Label>Tanggal Keluar / Nonaktif (Opsional)</Label>
                  <Input 
                    type="date"
                    value={formData.endDate ? new Date(formData.endDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => handleChange({ target: { name: 'endDate', value: e.target.value ? new Date(e.target.value) : null } } as unknown as React.ChangeEvent<HTMLInputElement>)}
                  />
               </div>
            </div>
          </>
        );
      }}
    />
  );
}
