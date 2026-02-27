import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeftRight, Send, ArrowLeft, Check, Search, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '@/contexts/DatabaseContext';

import { useAuth } from '@/contexts/AuthContext';
import { SearchableSelect } from '@/components/ui/searchable-select';

export default function MutasiPelanggan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pelanggan, users, addPersetujuan, karyawan, cabang } = useDatabase();
  
  const [selectedPelangganIds, setSelectedPelangganIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    keSalesId: '',
    alasan: ''
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Filter Sales Users (Target)
  const salesUsers = users.filter(u => 
    (u.roles.includes('sales') || u.roles.includes('staff') || u.roles.includes('admin')) &&
    u.cabangId === user?.cabangId &&
    u.id !== user?.id && // Cannot mutate to self
    u.isActive !== false // Only active users
  );

  // Filter Customers: Only those owned by current user
  const myCustomers = pelanggan.filter(p => p.salesId === user?.id);
  
  // Filter by search query
  const filteredCustomers = myCustomers.filter(p => 
    p.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.kode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectAll = (checked: boolean) => {
      if (checked) {
          // Select only visible/filtered ones or all? Usually all visible.
          const idsToSelect = filteredCustomers.map(p => p.id);
          // Merge with existing
          const uniqueIds = Array.from(new Set([...selectedPelangganIds, ...idsToSelect]));
          setSelectedPelangganIds(uniqueIds);
      } else {
          // Deselect visible ones
          const visibleIds = filteredCustomers.map(p => p.id);
          setSelectedPelangganIds(prev => prev.filter(id => !visibleIds.includes(id)));
      }
  };

  const handleToggleCustomer = (id: string) => {
      setSelectedPelangganIds(prev => 
          prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
      );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPelangganIds.length === 0 || !formData.keSalesId) {
      toast.error('Pilih setidaknya satu pelanggan dan sales tujuan');
      return;
    }

    try {
        const targetSales = users.find(u => u.id === formData.keSalesId); 
        
        // Collect all selected customers
        const selectedCustomers = selectedPelangganIds.map(pid => {
             const cust = pelanggan.find(p => p.id === pid);
             return cust ? { id: cust.id, nama: cust.nama, kode: cust.kode } : null;
        }).filter(Boolean);

        if (selectedCustomers.length === 0) return;

        const persetujuanId = self.crypto.randomUUID();

        await addPersetujuan({
            id: persetujuanId,
            jenis: 'mutasi_pelanggan',
            referensiId: self.crypto.randomUUID(), // Unique Ref for Bulk (UUID required)
            status: 'pending',
            diajukanOleh: user?.id || 'system',
            targetUserId: formData.keSalesId,
            tanggalPengajuan: new Date(),
            catatan: formData.alasan,
            data: {
                count: selectedCustomers.length,
                items: selectedCustomers, // Array of { id, nama, kode }
                dariSalesId: user?.id,
                keSalesId: formData.keSalesId,
                keSalesNama: targetSales?.nama
            }
        });

        toast.success(`Pengajuan mutasi untuk ${selectedCustomers.length} pelanggan berhasil dikirim`);
        navigate('/pelanggan');
    } catch (error) {
        console.error(error);
        toast.error('Gagal mengajukan mutasi');
    }
  };

  return (
    <MainLayout title="Mutasi Pelanggan">
      <div className="p-4 max-w-xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/pelanggan')}
          className="mb-4 pl-0"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali
        </Button>

        <Card elevated>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <ArrowLeftRight className="w-6 h-6 text-orange-500" />
              </div>
              <CardTitle>Pindah Tangani / Mutasi Pelanggan</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Customer Selection Trigger */}
              <div className="space-y-2">
                <Label>Pilih Pelanggan</Label>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-auto py-3">
                         <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <div className="text-left">
                                <span className="block font-medium text-foreground">
                                    {selectedPelangganIds.length > 0 
                                        ? `${selectedPelangganIds.length} Pelanggan Dipilih` 
                                        : "Pilih Pelanggan Mutasi"}
                                </span>
                                <span className="text-xs text-muted-foreground font-normal">
                                    Total Pelanggan Anda: {myCustomers.length}
                                </span>
                            </div>
                         </div>
                         <div className="bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1 rounded text-xs font-semibold">
                            Pilih
                         </div>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[90vw] md:max-w-lg max-h-[90vh] flex flex-col p-4">
                    <DialogHeader>
                      <DialogTitle>Pilih Pelanggan</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Cari nama atau kode..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2 pb-2 border-b">
                             <input 
                                type="checkbox"
                                id="selectAllDialog"
                                className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                checked={filteredCustomers.length > 0 && filteredCustomers.every(p => selectedPelangganIds.includes(p.id))}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                             />
                             <label htmlFor="selectAllDialog" className="text-sm cursor-pointer select-none font-medium">
                                 Pilih Semua ({filteredCustomers.length})
                             </label>
                        </div>

                        <div className="overflow-y-auto flex-1 border rounded-md p-2 space-y-1">
                            {filteredCustomers.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">Tidak ada pelanggan ditemukan.</p>
                            ) : (
                                filteredCustomers.map((p) => (
                                    <div 
                                        key={p.id} 
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                            selectedPelangganIds.includes(p.id) 
                                                ? "bg-orange-50 border-orange-200" 
                                                : "hover:bg-muted border-transparent"
                                        }`}
                                        onClick={() => handleToggleCustomer(p.id)}
                                    >
                                        <div className={`p-1 rounded-full border ${selectedPelangganIds.includes(p.id) ? "bg-orange-600 border-orange-600 text-white" : "border-muted-foreground"}`}>
                                           <Check className={`w-3 h-3 ${selectedPelangganIds.includes(p.id) ? "opacity-100" : "opacity-0"}`} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">{p.nama}</p>
                                            <p className="text-xs text-muted-foreground">{p.kode} • {p.alamat || 'No Address'}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    
                    <DialogFooter className="pt-2">
                        <Button onClick={() => setIsDialogOpen(false)} className="w-full">
                            Selesai & Lanjutkan
                        </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-2">
                <Label>Sales Baru (Tujuan)</Label>
                <SearchableSelect
                  value={formData.keSalesId}
                  onChange={(val) => setFormData(prev => ({ ...prev, keSalesId: val }))}
                  placeholder="Pilih sales..."
                  searchPlaceholder="Cari sales..."
                  options={salesUsers.map(sales => {
                      const linkedEmp = karyawan.find(k => k.userAccountId === sales.id);
                      const displayName = linkedEmp?.nama || sales.nama || sales.username;
                      const branchName = cabang.find(c => c.id === sales.cabangId)?.nama || 'Unknown Branch';
                      return {
                          label: displayName,
                          value: sales.id,
                          description: branchName
                      };
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label>Alasan Mutasi</Label>
                <Textarea
                  placeholder="Contoh: Pindah wilayah, sales resign, dll..."
                  value={formData.alasan}
                  onChange={(e) => setFormData(prev => ({ ...prev, alasan: e.target.value }))}
                  required
                />
              </div>

              <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={selectedPelangganIds.length === 0}>
                <Send className="w-4 h-4 mr-2" />
                Ajukan Mutasi ({selectedPelangganIds.length})
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
