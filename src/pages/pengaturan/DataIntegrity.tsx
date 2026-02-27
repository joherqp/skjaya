
import { MainLayout } from '@/components/layout/MainLayout';
import DataIntegrityCheck from './components/DataIntegrityCheck';

export default function DataIntegrityPage() {
  return (
    <MainLayout title="Cek Integritas Data">
      <div className="p-4">
        <DataIntegrityCheck />
      </div>
    </MainLayout>
  );
}
