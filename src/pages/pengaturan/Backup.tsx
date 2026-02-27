import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, Download, Upload, Users, ShoppingCart, FileSpreadsheet, CheckSquare, Square, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Helper to convert camelCase to snake_case for DB
const toSnake = (obj: unknown): unknown => {
  if (Array.isArray(obj)) return obj.map(toSnake) as unknown;
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      acc[snakeKey] = toSnake((obj as Record<string, unknown>)[key]);
      return acc;
    }, {} as Record<string, unknown>);
  }
  return obj;
};

// Helper to convert snake_case to camelCase (for consistency if needed, though mostly we use context)
// Context data is already camelCase.

export default function Backup() {
  const navigate = useNavigate();
  const dbContext = useDatabase();
  const [isLoading, setIsLoading] = useState(false);
  
  const [selectedFormat, setSelectedFormat] = useState<'json' | 'excel' | 'excel-single' | 'excel-flat' | 'csv'>('excel');
  const [pendingImportData, setPendingImportData] = useState<Record<string, unknown[]> | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  
  // Available tables mapping: key (context/export key) -> label
  const availableTables = {
    // Master
    kategori: "Kategori Produk",
    satuan: "Satuan Unit",
    kategoriPelanggan: "Kategori Pelanggan",
    rekeningBank: "Rekening Bank",
    area: "Area / Wilayah",
    cabang: "Cabang",
    profilPerusahaan: "Profil Perusahaan",
    // Data
    barang: "Data Barang",
    pelanggan: "Data Pelanggan",
    karyawan: "Data Karyawan",
    users: "Data Users",
    harga: "Harga",
    promo: "Data Promo",
    stokPengguna: "Stok Pengguna (Mobile)",
    // Transaksi
    penjualan: "Penjualan",
    setoran: "Setoran",
    absensi: "Absensi",
    permintaanBarang: "Permintaan Barang",
    mutasiBarang: "Mutasi Barang",
    penyesuaianStok: "Penyesuaian Stok",
    persetujuan: "Log Persetujuan",
    pettyCash: "Kas Kecil (Petty Cash)",
    reimburse: "Reimbursement",
    notifikasi: "Notifikasi",
  };

  const [selectedTables, setSelectedTables] = useState<Record<string, boolean>>(
    Object.keys(availableTables).reduce((acc, key) => ({ ...acc, [key]: true }), {})
  );

  const toggleSelectAll = () => {
    const allSelected = Object.values(selectedTables).every(Boolean);
    const newState = Object.keys(availableTables).reduce((acc, key) => ({ ...acc, [key]: !allSelected }), {});
    setSelectedTables(newState);
  };

  const handleTableToggle = (key: string) => {
    setSelectedTables(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // --- EXPORT LOGIC ---
  const handleAdvancedExport = async () => {
    setIsLoading(true);
    try {
      const tablesToExport = Object.keys(selectedTables).filter(key => selectedTables[key]);
      
      if (tablesToExport.length === 0) {
        toast.warning("Pilih setidaknya satu tabel untuk diexport");
        setIsLoading(false);
        return;
      }

      const dataMap: Record<string, unknown> = {};
      
      // Collect data directly from context
      // Note: dbContext is typed, so we cast to Record<string, unknown> to access by string key
      const contextAny = dbContext as unknown as Record<string, unknown>;
      
      tablesToExport.forEach(key => {
        dataMap[key] = contextAny[key] || [];
      });

      const timestamp = new Date().toISOString().split('T')[0];
      const fileNameBase = `cvskj_export_${timestamp}`;

      if (selectedFormat === 'json') {
        const backupData = {
          version: "1.0",
          timestamp: new Date().toISOString(),
          tables: dataMap
        };
        const dataStr = JSON.stringify(backupData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', `${fileNameBase}.json`);
        linkElement.click();
        
      } else if (selectedFormat === 'excel') {
        const wb = XLSX.utils.book_new();
        
        tablesToExport.forEach(key => {
          const data = dataMap[key] as Record<string, unknown>[];
          // Determine sheet name (max 31 chars in Excel)
          // Use key or shortened key
          const sheetName = key.length > 30 ? key.substring(0, 30) : key;
          
          let ws;
          if (data && data.length > 0) {
              // Flatten data if needed? XLSX handles objects relatively well but nested objects become stringified or skipped.
              // For 'penjualan', 'items' is nested. We might want to separate or stringify.
              // For simplicity, we trust XLSX json_to_sheet default behavior for now (it usually ignores deep nesting or explicitly needs flattening).
              // Ideally, we flatten 'items' or leave them as JSON strings.
              const cleanData = data.map((item: Record<string, unknown>) => {
                  const copy = { ...item };
                  // Prevent circular structure errors if any (though context data usually plain JSON from DB)
                  // Stringify arrays/objects for cell compatibility
                  Object.keys(copy).forEach(k => {
                      let val = copy[k];
                      if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
                          val = JSON.stringify(val);
                      }
                      
                      // Truncate to avoid XLSX error (max 32767 chars)
                      if (typeof val === 'string' && val.length > 32000) {
                          val = val.substring(0, 32000) + '... [TRUNCATED]';
                      }
                      
                      copy[k] = val;
                  });
                  return copy;
              });
              ws = XLSX.utils.json_to_sheet(cleanData);
          } else {
              ws = XLSX.utils.json_to_sheet([]);
          }
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });
        
        XLSX.writeFile(wb, `${fileNameBase}.xlsx`);

        XLSX.writeFile(wb, `${fileNameBase}.xlsx`);

      } else if (selectedFormat === 'excel-single') {
          // Universal Single Sheet Backup
          const universalData: Record<string, unknown>[] = [];
          
          tablesToExport.forEach(key => {
              const data = dataMap[key] as Record<string, unknown>[];
              if (data && data.length > 0) {
                  data.forEach((row: unknown) => {
                      // Serialize row to JSON string to preserve structure
                      universalData.push({
                          table_name: key,
                          data: JSON.stringify(row)
                      });
                  });
              }
          });

          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.json_to_sheet(universalData);
          
          // Add basic metadata as first row or separate sheet? 
          // Single sheet requirement -> Everything in one sheet.
          
          XLSX.utils.book_append_sheet(wb, ws, "DATABASE_FULL");
          XLSX.writeFile(wb, `${fileNameBase}_universal.xlsx`);

      } else if (selectedFormat === 'excel-flat') {
         // Flattened Export (Extract Nested JSON)
         const wb = XLSX.utils.book_new();
         
         tablesToExport.forEach(key => {
             const rawData = dataMap[key];
             const sheetName = key.length > 30 ? key.substring(0, 30) : key;
             
             // Ensure data is array
             const data = Array.isArray(rawData) ? rawData : (rawData ? [rawData] : []);

             const flattenedData: Record<string, unknown>[] = [];
             
             if (data.length > 0) {
                 data.forEach((row: unknown) => {
                     if (!row) return;
                     const r = row as Record<string, unknown>; // Intermediate cast for flexible access

                     let hasArrayExpansion = false;

                     // Target specific array columns known in the schema
                     if (r.items && Array.isArray(r.items) && r.items.length > 0) {
                         hasArrayExpansion = true;
                         r.items.forEach((item: unknown, index: number) => {
                             // Create a base object with non-array props
                             const flatRow: Record<string, unknown> = {};
                             
                             // 1. Copy Parent Fields
                             Object.keys(r).forEach(k => {
                                 // Skip specific array being flattened
                                 if (k === 'items') return;

                                 const val = r[k];
                                 if (val !== null && typeof val === 'object') {
                                     // Stringify other objects/arrays to keep in one cell
                                     flatRow[`parent_${k}`] = JSON.stringify(val);
                                 } else {
                                     flatRow[`parent_${k}`] = val;
                                 }
                             });

                             // 2. Add Child Item Fields with prefix
                             if (item && typeof item === 'object') {
                                const it = item as Record<string, unknown>;
                                Object.keys(it).forEach(k => {
                                    const val = it[k];
                                    if (typeof val !== 'object' || val === null) {
                                        flatRow[`item_${k}`] = val;
                                    } else {
                                        flatRow[`item_${k}`] = JSON.stringify(val);
                                    }
                                });
                             }
                             
                             // Add index for reference
                             flatRow['item_index'] = index + 1;

                             flattenedData.push(flatRow);
                         });
                     }

                     // If no array to expand, add row as is (but stringify objects)
                     if (!hasArrayExpansion) {
                         const flatRow: Record<string, unknown> = {};
                         Object.keys(r).forEach(k => {
                             const val = r[k];
                             if (typeof val === 'object' && val !== null) {
                                  flatRow[k] = JSON.stringify(val);
                             } else {
                                  flatRow[k] = val;
                             }
                         });
                         flattenedData.push(flatRow);
                     }
                 });
             }

             // Only append if we have data or force empty sheet
             const ws = XLSX.utils.json_to_sheet(flattenedData.length > 0 ? flattenedData : []);
             XLSX.utils.book_append_sheet(wb, ws, sheetName);
         });
         
         XLSX.writeFile(wb, `${fileNameBase}_extracted.xlsx`);

      } else if (selectedFormat === 'csv') {
        if (tablesToExport.length > 1) {
            // Warn about multi-table CSV
            // Best approach: Just export the first one or create separate downloads?
            // User requested "export/import semua tabel", CSV for all tables usually implies Zip or just separate files.
            // Let's restrict CSV to single table OR warn that strictly Multi-sheet Excel is better.
            // We will stick to Excel recommendation in UI, but if they insist on CSV:
            // We can download multiple files sequentially.
            let count = 0;
            for (const key of tablesToExport) {
                const data = dataMap[key] as Record<string, unknown>[];
                const ws = XLSX.utils.json_to_sheet(data);
                const csv = XLSX.utils.sheet_to_csv(ws);
                
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.setAttribute("download", `cvskj_${key}_${timestamp}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Small delay to prevent browser blocking multiple downloads
                await new Promise(r => setTimeout(r, 500));
                count++;
            }
            toast.success(`${count} file CSV diunduh.`);
            setIsLoading(false);
            return;
        } else {
            // Single table
            const key = tablesToExport[0];
            const data = dataMap[key] as Record<string, unknown>[];
            const ws = XLSX.utils.json_to_sheet(data);
            const csv = XLSX.utils.sheet_to_csv(ws);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `cvskj_${key}_${timestamp}.csv`);
            link.click();
        }
      }

      toast.success('Export berhasil!');
    } catch (error) {
      console.error("Export Error:", error);
      toast.error('Gagal melakukan export');
    }
    setIsLoading(false);
  };

  // --- IMPORT LOGIC ---
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const fileName = file.name.toLowerCase();
    
    try {
        let tablesToImport: Record<string, unknown[]> = {};

        if (fileName.endsWith('.json')) {
            const text = await file.text();
            const json = JSON.parse(text);
            
            if (json.tables) {
                tablesToImport = json.tables;
            } else if (json.data && json.type) {
                tablesToImport[json.type] = json.data; 
            } else {
                throw new Error("Format JSON tidak dikenali. Gunakan file hasil Export dari aplikasi ini.");
            }
        } 
        else if (fileName.endsWith('.xlsx')) {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array' });
            
            // CHECK FOR UNIVERSAL SINGLE SHEET
            const firstSheetName = wb.SheetNames[0];
            const firstSheet = wb.Sheets[firstSheetName];
            const rawData = XLSX.utils.sheet_to_json(firstSheet);
            
            // Check if this looks like our universal format
            const isUniversal = rawData.length > 0 && 'table_name' in (rawData[0] as Record<string, unknown>) && 'data' in (rawData[0] as Record<string, unknown>);

            if (isUniversal) {
                 rawData.forEach((row: unknown) => {
                     const r = row as Record<string, unknown>;
                     const tableName = r.table_name as string;
                     const rowDataStr = r.data as string;
                     
                     if (availableTables[tableName as keyof typeof availableTables]) {
                         if (!tablesToImport[tableName]) tablesToImport[tableName] = [];
                         try {
                             const parsedRow = JSON.parse(rowDataStr);
                             tablesToImport[tableName].push(parsedRow);
                         } catch (e) {
                             console.warn("Failed to parse universal row", row);
                         }
                     }
                 });
            } else {
                // Standard Multi-Sheet
                wb.SheetNames.forEach(sheetName => {
                    const ws = wb.Sheets[sheetName];
                    const data = XLSX.utils.sheet_to_json(ws);
                    
                    const parsedData = data.map((item: unknown) => {
                        const it = item as Record<string, unknown>;
                        Object.keys(it).forEach(k => {
                            const val = it[k];
                            // Try parsing JSON-looking strings (for nested objects in multi-sheet export)
                            if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                                try {
                                    item[k] = JSON.parse(val);
                                } catch (e) {
                                    // Ignore parse errors, keep original string
                                }
                            }
                        });
                        return item;
                    });

                    if (availableTables[sheetName as keyof typeof availableTables]) {
                        tablesToImport[sheetName] = parsedData;
                    }
                });
            }
        }
        else if (fileName.endsWith('.csv')) {
            let targetTable = '';
            const enabledTables = Object.keys(selectedTables).filter(k => selectedTables[k]);
            if (enabledTables.length === 1) {
                targetTable = enabledTables[0];
            } else {
                const found = Object.keys(availableTables).find(k => fileName.includes(k));
                if (found) targetTable = found;
            }

            if (!targetTable) {
                throw new Error("Tidak dapat menentukan target tabel untuk file CSV ini. Pilih hanya satu tabel di daftar sebelum import.");
            }

            const text = await file.text();
            const wb = XLSX.read(text, { type: 'string' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws);
             const parsedData = data.map((item: unknown) => {
                 const it = item as Record<string, unknown>;
                 Object.keys(it).forEach(k => {
                        const val = it[k];
                        if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                            try {
                                item[k] = JSON.parse(val);
                            } catch (e) { 
                                 // Ignore parse errors
                            }
                        }
                    });
                    return item;
            });
            
            tablesToImport[targetTable] = parsedData;
        }

        if (Object.keys(tablesToImport).length === 0) {
            throw new Error("Tidak ada data valid yang ditemukan untuk diimport.");
        }

        // Open Confirmation
        setPendingImportData(tablesToImport);
        setIsConfirmOpen(true);

    } catch (err: unknown) {
        console.error(err);
        const e = err as Error;
        toast.error(e.message || "Gagal memproses file import");
    } finally {
        setIsLoading(false);
        if (event.target) event.target.value = '';
    }
  };

  const executeRestore = async () => {
        if (!pendingImportData) return;
        setIsLoading(true);
        setIsConfirmOpen(false); // Close dialog

        try {
            const tablesToImport = pendingImportData;
            let successCount = 0;
            let failCount = 0;

            const priorityOrder = ['cabang', 'area', 'profilPerusahaan', 'kategori', 'satuan', 'kategoriPelanggan', 'rekeningBank'];
            const secondOrder = ['users', 'karyawan', 'barang', 'pelanggan', 'harga', 'promo'];
            const tertiaryOrder = ['penjualan', 'setoran', 'absensi', 'permintaanBarang', 'mutasiBarang', 'penyesuaianStok', 'pettyCash', 'reimburse', 'persetujuan', 'notifikasi'];
            
            const orderedKeys = [
                ...priorityOrder.filter(k => tablesToImport[k]),
                ...secondOrder.filter(k => tablesToImport[k]),
                ...tertiaryOrder.filter(k => tablesToImport[k]),
                ...Object.keys(tablesToImport).filter(k => !priorityOrder.includes(k) && !secondOrder.includes(k) && !tertiaryOrder.includes(k))
            ];

            toast.info(`Memulai proses Restore dari ${orderedKeys.length} tabel...`);

            for (const tableName of orderedKeys) {
            const data = tablesToImport[tableName];
            if (!data || data.length === 0) continue;

            const dbData = toSnake(data) as Record<string, unknown>[];
            const dbTableName = tableName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            
            toast.info(`Memproses ${availableTables[tableName as keyof typeof availableTables] || tableName}...`, { id: 'import-status' });

                const BATCH_SIZE = 50;
                for (let i = 0; i < dbData.length; i += BATCH_SIZE) {
                    const chunk = dbData.slice(i, i + BATCH_SIZE);
                    
                    const { error } = await supabase
                        .from(dbTableName)
                        .upsert(chunk, { onConflict: 'id' }); 
                    
                    if (error) {
                        console.error(`Gagal restore ${tableName} batch ${i}:`, error);
                        failCount += chunk.length;
                    } else {
                        successCount += chunk.length;
                        const progress = Math.min(100, Math.round(((i + chunk.length) / dbData.length) * 100));
                        toast.info(`Mengimport ${tableName}: ${progress}%`, { id: 'import-status' });
                    }
                }
            }

            toast.dismiss('import-status');

            if (failCount > 0) {
                toast.warning(`Import selesai: ${successCount} berhasil, ${failCount} gagal. Lihat console untuk detail.`);
            } else {
                toast.success(`Berhasil memproses ${successCount} baris data!`, { duration: 5000 });
                setTimeout(() => window.location.reload(), 2000); 
            }
        } catch (err: unknown) {
            console.error("Restore Execution Error:", err);
            toast.error("Terjadi kesalahan saat menulis ke database.");
        } finally {
            setIsLoading(false);
            setPendingImportData(null);
        }
  };

  return (
    <MainLayout title="Backup & Restore">
      <div className="p-4 max-w-5xl mx-auto space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/pengaturan')}
          className="pl-0 hover:bg-transparent hover:text-primary"
        >
          ← Kembali ke Pengaturan
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
            
            {/* LEFT COLUMN: SELECTION */}
            <div className="lg:col-span-2 space-y-6">
                <Card elevated>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <CheckSquare className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <CardTitle>Pilih Tabel Data</CardTitle>
                                <p className="text-sm text-muted-foreground">Pilih data yang ingin diproses ({Object.values(selectedTables).filter(Boolean).length})</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                           {Object.values(selectedTables).every(Boolean) ? 'Deselect All' : 'Select All'}
                        </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Object.entries(availableTables).map(([key, label]) => (
                            <div key={key} className="flex items-center space-x-2 border p-3 rounded-md hover:bg-muted/30 transition-colors">
                                <Checkbox 
                                    id={key} 
                                    checked={selectedTables[key]}
                                    onCheckedChange={() => handleTableToggle(key)}
                                />
                                <Label htmlFor={key} className="cursor-pointer flex-1 font-normal text-sm">
                                    {label}
                                </Label>
                            </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
            </div>

            {/* RIGHT COLUMN: ACTIONS */}
            <div className="space-y-6">
                
                {/* SETTINGS CARD */}
                <Card elevated>
                    <CardHeader>
                        <CardTitle className="text-base">Format & Aksi</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        
                        <div className="space-y-3">
                            <Label>Pilih Format File</Label>
                            <RadioGroup value={selectedFormat} onValueChange={(v: 'json' | 'excel' | 'excel-single' | 'excel-flat' | 'csv') => setSelectedFormat(v)} className="flex flex-col space-y-1">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="excel" id="fmt-excel" />
                                    <Label htmlFor="fmt-excel" className="flex items-center gap-2 cursor-pointer">
                                        <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel Multipel Sheet <span className="text-xs text-muted-foreground">(Standar)</span>
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="excel-single" id="fmt-excel-single" />
                                    <Label htmlFor="fmt-excel-single" className="flex items-center gap-2 cursor-pointer">
                                        <FileSpreadsheet className="w-4 h-4 text-green-700" /> Excel Satu Sheet <span className="text-xs text-muted-foreground">(Gabungan)</span>
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="excel-flat" id="fmt-excel-flat" />
                                    <Label htmlFor="fmt-excel-flat" className="flex items-center gap-2 cursor-pointer">
                                        <FileSpreadsheet className="w-4 h-4 text-purple-600" /> Excel Extract <span className="text-xs text-muted-foreground">(Detail Item)</span>
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="json" id="fmt-json" />
                                    <Label htmlFor="fmt-json" className="flex items-center gap-2 cursor-pointer">
                                        <Database className="w-4 h-4 text-blue-600" /> JSON <span className="text-xs text-muted-foreground">(Backup Lengkap)</span>
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="csv" id="fmt-csv" />
                                    <Label htmlFor="fmt-csv" className="flex items-center gap-2 cursor-pointer">
                                        <FileSpreadsheet className="w-4 h-4 text-orange-600" /> CSV <span className="text-xs text-muted-foreground">(Tabel Tunggal)</span>
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>
                        
                        <div className="pt-2">
                            <Button className="w-full" size="lg" onClick={handleAdvancedExport} disabled={isLoading}>
                                <Download className="w-4 h-4 mr-2" /> 
                                Export Data
                            </Button>
                        </div>

                    </CardContent>
                </Card>

                {/* IMPORT CARD */}
                <Card elevated className="border-dashed border-2 bg-muted/10">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Upload className="w-4 h-4" /> Import / Restore
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground mb-4">
                            Mendukung file .xlsx (Excel), .json, dan .csv. 
                            <br/>Pastikan struktur kolom sesuai database.
                        </p>
                        
                        <div className="relative">
                            <input 
                                type="file" 
                                id="adv-import" 
                                accept=".json,.xlsx,.csv" 
                                className="hidden" 
                                onChange={handleFileSelect}
                            />
                            <Button 
                                variant="outline" 
                                className="w-full"
                                onClick={() => document.getElementById('adv-import')?.click()}
                                disabled={isLoading}
                            >
                                Pilih File Backup
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            
            </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Konfirmasi Restore Database</AlertDialogTitle>
                <AlertDialogDescription>
                    Anda akan melakukan restore data untuk tabel berikut:
                </AlertDialogDescription>
                <div className="text-sm text-muted-foreground">
                    <ul className="list-disc pl-5 my-2 max-h-[200px] overflow-y-auto text-xs">
                        {pendingImportData && Object.keys(pendingImportData).map((key) => (
                            <li key={key}>
                                <span className="font-semibold">{availableTables[key as keyof typeof availableTables] || key}</span>
                                <span className="ml-1 text-muted-foreground">({pendingImportData[key].length} baris)</span>
                            </li>
                        ))}
                    </ul>
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-2 rounded text-xs mt-3">
                        <span className="font-bold">PERINGATAN:</span> Data yang ada dengan ID yang sama akan ditimpa (Update). Data baru akan ditambahkan (Insert). Proses ini tidak dapat dibatalkan.
                    </div>
                </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPendingImportData(null)}>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={executeRestore} className="bg-red-600 hover:bg-red-700">
                    Lanjutkan Restore
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
