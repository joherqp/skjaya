import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDatabase } from '@/contexts/DatabaseContext';
import { formatRupiah } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRightLeft, LayoutGrid } from 'lucide-react';

type PivotField = 'tanggal' | 'bulan' | 'tahun' | 'kategori' | 'produk' | 'pelanggan' | 'sales' | 'cabang';
type AggregationType = 'sum_total' | 'sum_qty' | 'count_trx';

interface PivotDataItem {
    tanggal: string;
    bulan: string;
    tahun: string;
    kategori: string;
    produk: string;
    pelanggan: string;
    sales: string;
    cabang: string;
    total: number;
    qty: number;
    trx: number;
}

export default function AnalisaPivot() {
    const { penjualan, barang, kategori: kategoriList, pelanggan, users, cabang } = useDatabase();

    // Configuration State
    const [rowField, setRowField] = useState<PivotField>('kategori');
    const [colField, setColField] = useState<PivotField | 'none'>('bulan');
    const [valField, setValField] = useState<AggregationType>('sum_total');

    // 1. Flatten Data Source
    // Transform hierarchical sales data into a flat array of sales items
    const flatData = useMemo(() => {
        const data: PivotDataItem[] = [];
        penjualan.filter(p => p.status !== 'batal').forEach(p => {
            const date = new Date(p.tanggal);
            const custName = pelanggan.find(c => c.id === p.pelangganId)?.nama || 'Umum';
            const salesName = users.find(u => u.id === p.salesId)?.nama || 'Unknown';
            const cabangName = cabang.find(c => c.id === p.cabangId)?.nama || 'Unknown';

            p.items.forEach(item => {
                const product = barang.find(b => b.id === item.barangId);
                const catName = kategoriList.find(c => c.id === product?.kategoriId)?.nama || 'Lainnya';

                data.push({
                    tanggal: date.toLocaleDateString('id-ID'),
                    bulan: date.toLocaleString('id-ID', { month: 'long' }),
                    tahun: date.getFullYear().toString(),
                    kategori: catName,
                    produk: product?.nama || 'Unknown',
                    pelanggan: custName,
                    sales: salesName,
                    cabang: cabangName,
                    // Values
                    total: item.subtotal,
                    qty: item.jumlah,
                    trx: 1
                });
            });
        });
        return data;
    }, [penjualan, barang, kategoriList, pelanggan, users, cabang]);

    // 2. Compute Pivot Table
    const pivotData = useMemo(() => {
        const rowKeys = new Set<string>();
        const colKeys = new Set<string>();
        const valueMap = new Map<string, number>();

        flatData.forEach(item => {
            const rKey = item[rowField];
            const cKey = colField === 'none' ? 'Total' : item[colField];
            
            rowKeys.add(rKey);
            colKeys.add(cKey);

            const compoundKey = `${rKey}:::${cKey}`;
            
            let val = 0;
            if (valField === 'sum_total') val = item.total;
            if (valField === 'sum_qty') val = item.qty;
            if (valField === 'count_trx') val = 1; // Actually this counts items, distinct trx needs more logic. Simplified for now.

            valueMap.set(compoundKey, (valueMap.get(compoundKey) || 0) + val);
        });

        // Sort Keys
        const sortedRows = Array.from(rowKeys).sort();
        // Custom sort for mounts if needed, otherwise alpha
        const sortedCols = Array.from(colKeys).sort();

        return { rows: sortedRows, cols: sortedCols, values: valueMap };
    }, [flatData, rowField, colField, valField]);

    // Format Helper
    const formatValue = (val: number) => {
        if (valField === 'sum_total') return formatRupiah(val);
        return val.toLocaleString('id-ID');
    };

    return (
        <div className="space-y-6">
            {/* Configuration Panel */}
            <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                         <LayoutGrid className="w-4 h-4" />
                         Konfigurasi Pivot
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Baris (Rows)</label>
                            <Select value={rowField} onValueChange={(v) => setRowField(v as PivotField)}>
                                <SelectTrigger className="w-[180px] bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="kategori">Kategori Produk</SelectItem>
                                    <SelectItem value="produk">Produk</SelectItem>
                                    <SelectItem value="pelanggan">Pelanggan</SelectItem>
                                    <SelectItem value="sales">Sales / Karyawan</SelectItem>
                                    <SelectItem value="cabang">Cabang</SelectItem>
                                    <SelectItem value="bulan">Bulan</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <ArrowRightLeft className="w-4 h-4 text-muted-foreground mt-5 hidden md:block" />

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Kolom (Columns)</label>
                             <Select value={colField} onValueChange={(v) => setColField(v as PivotField | 'none')}>
                                <SelectTrigger className="w-[180px] bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Tidak Ada (Hanya Total)</SelectItem>
                                    <SelectItem value="bulan">Bulan</SelectItem>
                                    <SelectItem value="tahun">Tahun</SelectItem>
                                    <SelectItem value="kategori">Kategori Produk</SelectItem>
                                    <SelectItem value="cabang">Cabang</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="w-[1px] h-10 bg-border mx-2 hidden md:block" />

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Nilai (Values)</label>
                            <Select value={valField} onValueChange={(v) => setValField(v as AggregationType)}>
                                <SelectTrigger className="w-[180px] bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sum_total">Total Penjualan (Rp)</SelectItem>
                                    <SelectItem value="sum_qty">Total Barang Terjual (Qty)</SelectItem>
                                    <SelectItem value="count_trx">Frekuensi Transaksi</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Render Table */}
            <Card>
                <CardContent className="p-0">
                    <ScrollArea className="h-[500px] w-full">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="min-w-[200px] pl-4 font-bold text-black border-r">
                                        {rowField.toUpperCase()} \ {colField === 'none' ? '' : colField.toUpperCase()}
                                    </TableHead>
                                    {pivotData.cols.map(col => (
                                        <TableHead key={col} className="text-right min-w-[120px] font-semibold text-black">
                                            {col}
                                        </TableHead>
                                    ))}
                                    {colField !== 'none' && (
                                        <TableHead className="text-right min-w-[120px] font-bold text-black border-l bg-muted/20">Total</TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pivotData.rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={pivotData.cols.length + 2} className="h-24 text-center">
                                            Tidak ada data untuk ditampilkan.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    pivotData.rows.map(row => {
                                        let rowTotal = 0;
                                        return (
                                            <TableRow key={row} className="hover:bg-muted/50">
                                                <TableCell className="font-medium border-r pl-4">{row}</TableCell>
                                                {pivotData.cols.map(col => {
                                                    const val = pivotData.values.get(`${row}:::${col}`) || 0;
                                                    rowTotal += val;
                                                    return (
                                                        <TableCell key={col} className="text-right tabular-nums">
                                                            {val > 0 ? formatValue(val) : '-'}
                                                        </TableCell>
                                                    );
                                                })}
                                                {colField !== 'none' && (
                                                    <TableCell className="text-right font-bold tabular-nums border-l bg-muted/20">
                                                        {formatValue(rowTotal)}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })
                                )}
                                {/* Grand Total Row (Optional, maybe for V2) */}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
