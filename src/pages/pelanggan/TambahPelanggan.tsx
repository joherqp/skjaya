import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { PelangganForm } from '@/components/forms/PelangganForm';

export default function TambahPelanggan() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/pelanggan')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Tambah Pelanggan</h1>
              <p className="text-muted-foreground">
                Input data pelanggan baru
              </p>
            </div>
          </div>
        </div>

        <PelangganForm onSuccess={() => navigate('/pelanggan')} />

      </div>
    </MainLayout>
  );
}
