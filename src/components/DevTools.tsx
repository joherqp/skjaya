import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, Download, Upload, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

/**
 * Developer Tools Component
 * Provides utilities for managing Supabase data
 * Only visible in development mode
 */
export function DevTools() {
  const [isOpen, setIsOpen] = useState(false);

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  const handleExportData = async () => {
    try {
      // Export all data from all tables
      const tables = [
        'area', 'cabang', 'users', 'kategori', 'satuan', 
        'barang', 'kategori_pelanggan', 'pelanggan', 
        'rekening_bank', 'penjualan', 'setoran'
      ];
      
      const exportData: Record<string, unknown> = {};
      
      for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
          console.error(`Error exporting ${table}:`, error);
        } else {
          exportData[table] = data;
        }
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cvskj-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  };

  const handleCheckConnection = async () => {
    try {
      const { data, error } = await supabase.from('profil_perusahaan').select('nama').limit(1);
      
      if (error) {
        toast.error(`Connection failed: ${error.message}`);
      } else {
        toast.success(`✅ Connected to Supabase! Company: ${data?.[0]?.nama || 'CVSKJ'}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Connection error: ${errorMessage}`);
    }
  };

  const handleShowSetupInfo = () => {
    toast.info(
      'Setup Instructions:\n' +
      '1. Create Supabase project at supabase.com\n' +
      '2. Copy credentials to .env.local\n' +
      '3. Run SQL migration in Supabase SQL Editor\n' +
      '4. Restart dev server',
      { duration: 10000 }
    );
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen ? (
        <Button
          size="icon"
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="rounded-full shadow-lg bg-background border-primary/30"
        >
          <Database className="w-4 h-4" />
        </Button>
      ) : (
        <Card className="shadow-xl w-80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="w-4 h-4" />
                Dev Tools (Supabase)
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0"
              >
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start text-xs"
              onClick={handleCheckConnection}
            >
              <Database className="w-3 h-3 mr-2" />
              Test Connection
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start text-xs"
              onClick={handleExportData}
            >
              <Download className="w-3 h-3 mr-2" />
              Export Data (Backup)
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start text-xs"
              onClick={handleShowSetupInfo}
            >
              <Info className="w-3 h-3 mr-2" />
              Setup Instructions
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
