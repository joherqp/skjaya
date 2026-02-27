import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDatabase } from '@/contexts/DatabaseContext';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
    BarChart, Bar, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { formatRupiah } from '@/lib/utils';
import { Calendar, Plus, Trash2, Settings2, BarChart3, PieChart as PieIcon, LineChart as LineIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ff7c7c', '#8dd1e1'];

type ChartType = 'line' | 'bar' | 'pie' | 'area';
type DataSource = 'daily' | 'monthly' | 'kategori' | 'produk' | 'sales' | 'pelanggan';
type DataMetric = 'total_omzet' | 'total_qty' | 'total_trx';
type ChartDataPoint = {
    name: string;
    value: number;
};

interface WidgetConfig {
    id: string;
    title: string;
    type: ChartType;
    source: DataSource;
    metric: DataMetric;
    color?: string;
}

// Default Dashboard
const DEFAULT_WIDGETS: WidgetConfig[] = [
    { id: '1', title: 'Tren Penjualan (Harian)', type: 'area', source: 'daily', metric: 'total_omzet', color: '#00C49F' },
    { id: '2', title: 'Kontribusi Kategori', type: 'pie', source: 'kategori', metric: 'total_omzet' },
    { id: '3', title: 'Top 10 Produk', type: 'bar', source: 'produk', metric: 'total_qty', color: '#3b82f6' },
];

export default function AnalisaVisual() {
    const { penjualan, barang, kategori: listKategori, users, pelanggan } = useDatabase();
    const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'year'>('30d');
    
    // Dashboard State
    const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
        const saved = localStorage.getItem('analisa_dashboard_config');
        return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
    });

    // Save on Change
    useEffect(() => {
        localStorage.setItem('analisa_dashboard_config', JSON.stringify(widgets));
    }, [widgets]);

    // Dialog State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);
    const [tempConfig, setTempConfig] = useState<Partial<WidgetConfig>>({
        title: '', type: 'bar', source: 'kategori', metric: 'total_omzet', color: '#8884d8'
    });

    // 1. Global Filter Logic
    const filteredSales = useMemo(() => {
        const now = new Date();
        const past = new Date();
        
        if (dateRange === '7d') past.setDate(now.getDate() - 7);
        if (dateRange === '30d') past.setDate(now.getDate() - 30);
        if (dateRange === '90d') past.setDate(now.getDate() - 90);
        if (dateRange === 'year') past.setFullYear(now.getFullYear() - 1);

        return penjualan.filter(p => {
             const d = new Date(p.tanggal);
             return d >= past && d <= now && p.status !== 'batal';
        });
    }, [penjualan, dateRange]);

    // 2. Dynamic Data Aggregator
    const getChartData = (source: DataSource, metric: DataMetric) => {
        const map = new Map<string, number>();

        filteredSales.forEach(p => {
            // Determine Metric Value for this transaction
            let val = 0;
            if (metric === 'total_omzet') val = p.total;
            if (metric === 'total_qty') val = p.items.reduce((acc, i) => acc + i.jumlah, 0);
            if (metric === 'total_trx') val = 1;

            // Determine Group Key(s) and distribute value
            if (source === 'daily') {
                const key = new Date(p.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
                 map.set(key, (map.get(key) || 0) + val);
            } else if (source === 'monthly') {
                const key = new Date(p.tanggal).toLocaleString('id-ID', { month: 'long', year: '2-digit' });
                map.set(key, (map.get(key) || 0) + val);
            } else if (source === 'sales') {
                const name = users.find(u => u.id === p.salesId)?.nama || 'Unknown';
                map.set(name, (map.get(name) || 0) + val);
            } else if (source === 'pelanggan') {
                const name = pelanggan.find(c => c.id === p.pelangganId)?.nama || 'Umum';
                map.set(name, (map.get(name) || 0) + val);
            } else {
                // Item level grouping (Product/Kategori) requires creating separate entries per item
                // Use a different loop logic or standard distribution?
                // For simplicity, we re-loop items here only if source is Item-Level
                if (source === 'kategori' || source === 'produk') {
                     // Reset val because we sum from items
                } else {
                     // Transaction level grouping done above
                }
            }
        });

        // Loop again for Item Level sources if needed (Correct Logic)
        if (source === 'kategori' || source === 'produk') {
            filteredSales.forEach(p => {
                 p.items.forEach(item => {
                    let itemVal = 0;
                    if (metric === 'total_omzet') itemVal = item.subtotal;
                    if (metric === 'total_qty') itemVal = item.jumlah;
                    if (metric === 'total_trx') itemVal = 1; // Count per item line? or 1 per trx? Contextual. Let's say 1 per item line presence.

                    let key = 'Unknown';
                    const prod = barang.find(b => b.id === item.barangId);
                    
                    if (source === 'produk') key = prod?.nama || 'Unknown';
                    if (source === 'kategori') {
                        key = listKategori.find(c => c.id === prod?.kategoriId)?.nama || 'Lainnya';
                    }

                    map.set(key, (map.get(key) || 0) + itemVal);
                 });
            });
        }

        const res = Array.from(map.entries()).map(([name, value]) => ({ name, value }));

        // Sorting
        // Date based sorting
        if (source === 'daily' || source === 'monthly') {
            // Keep insertion order or specific sort? 
            // Map keys iterate in insertion order usually, lets assume chronological if built chronologically
            // For now generic sort by value desc for categories, or index for dates?
            // Simple: Return as is (assuming Map order) or sort by Value for ranking
        } else {
            res.sort((a, b) => b.value - a.value);
        }
        
        // Limit top 20 for readability
        return res.slice(0, 20);
    };

    // CRUD Handlers
    const handleAddWidget = () => {
        if (!tempConfig.title) {
            toast.error("Judul wajib diisi");
            return;
        }
        const newWidget: WidgetConfig = {
            id: Date.now().toString(),
            title: tempConfig.title!,
            type: tempConfig.type || 'bar',
            source: tempConfig.source || 'kategori',
            metric: tempConfig.metric || 'total_omzet',
            color: tempConfig.color
        };
        setWidgets([...widgets, newWidget]);
        setIsAddOpen(false);
        setTempConfig({ title: '', type: 'bar', source: 'kategori', metric: 'total_omzet', color: '#8884d8' });
        toast.success("Widget berhasil ditambahkan");
    };

    const handleRemoveWidget = (id: string) => {
        setWidgets(widgets.filter(w => w.id !== id));
        toast.success("Widget dihapus");
    };

    // Render Helpers
    const renderChart = (w: WidgetConfig, data: ChartDataPoint[]) => {
        const commonProps = { width: "100%", height: "100%" };
        
        switch (w.type) {
            case 'line':
                return (
                    <ResponsiveContainer {...commonProps}>
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{fontSize: 11}} />
                            <YAxis tickFormatter={(val) => val >= 1000 ? `${val/1000}k` : val} tick={{fontSize: 11}} width={40} />
                            <RechartsTooltip formatter={(val: number) => w.metric === 'total_omzet' ? formatRupiah(val) : val} />
                            <Line type="monotone" dataKey="value" stroke={w.color || '#8884d8'} strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                );
            case 'area':
                return (
                    <ResponsiveContainer {...commonProps}>
                        <AreaChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{fontSize: 11}} />
                            <YAxis tickFormatter={(val) => val >= 1000 ? `${val/1000}k` : val} tick={{fontSize: 11}} width={40} />
                            <RechartsTooltip formatter={(val: number) => w.metric === 'total_omzet' ? formatRupiah(val) : val} />
                            <Area type="monotone" dataKey="value" stroke={w.color || '#00C49F'} fill={w.color || '#00C49F'} fillOpacity={0.2} />
                        </AreaChart>
                    </ResponsiveContainer>
                );
            case 'pie':
                return (
                    <ResponsiveContainer {...commonProps}>
                        <PieChart>
                            <Pie 
                                data={data} 
                                cx="50%" cy="50%" 
                                innerRadius={40} 
                                outerRadius={80} 
                                fill="#8884d8" 
                                paddingAngle={2}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <RechartsTooltip formatter={(val: number) => w.metric === 'total_omzet' ? formatRupiah(val) : val} />
                            <Legend wrapperStyle={{fontSize: '11px'}} />
                        </PieChart>
                    </ResponsiveContainer>
                );
            default: // bar
                return (
                    <ResponsiveContainer {...commonProps}>
                        <BarChart data={data} layout={w.source === 'produk' || w.source === 'pelanggan' ? 'vertical' : 'horizontal'}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            {w.source === 'produk' || w.source === 'pelanggan' ? (
                                <>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                                </>
                            ) : (
                                <>
                                    <XAxis dataKey="name" tick={{fontSize: 11}} />
                                    <YAxis tickFormatter={(val) => val >= 1000 ? `${val/1000}k` : val} tick={{fontSize: 11}} width={40} />
                                </>
                            )}
                            <RechartsTooltip formatter={(val: number) => w.metric === 'total_omzet' ? formatRupiah(val) : val} />
                            <Bar dataKey="value" fill={w.color || '#3b82f6'} radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                );
        }
    };

    const totals = {
        omzet: filteredSales.reduce((acc, p) => acc + p.total, 0),
        trx: filteredSales.length
    };

    return (
        <div className="space-y-6">
             {/* Header Controls */}
             <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-full md:w-auto">
                            <Select value={dateRange} onValueChange={(v) => setDateRange(v as '7d' | '30d' | '90d' | 'year')}>
                        <SelectTrigger className="w-[180px]">
                            <Calendar className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Pilih Periode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d">7 Hari Terakhir</SelectItem>
                            <SelectItem value="30d">30 Hari Terakhir</SelectItem>
                            <SelectItem value="90d">3 Bulan Terakhir</SelectItem>
                            <SelectItem value="year">1 Tahun Terakhir</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                
                <Button onClick={() => setIsAddOpen(true)} className="w-full md:w-auto">
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Grafik
                </Button>
             </div>

             {/* KPIs */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <Card className="bg-primary/5 border-primary/20">
                     <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Omzet</CardTitle></CardHeader>
                     <CardContent className="p-4 pt-0"><div className="text-xl font-bold text-primary">{formatRupiah(totals.omzet)}</div></CardContent>
                 </Card>
                 <Card>
                     <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Transaksi</CardTitle></CardHeader>
                     <CardContent className="p-4 pt-0"><div className="text-xl font-bold">{totals.trx}</div></CardContent>
                 </Card>
             </div>

             {/* Dashboard Grid */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                 {widgets.map((widget) => {
                     const data = getChartData(widget.source, widget.metric);
                     return (
                         <Card key={widget.id} className="relative group hover:shadow-md transition-all">
                             <CardHeader className="flex flex-row items-center justify-between pb-2">
                                 <div>
                                    <CardTitle className="text-base">{widget.title}</CardTitle>
                                    <CardDescription className="text-xs">
                                        by {widget.source} • {widget.metric.replace('total_', '')}
                                    </CardDescription>
                                 </div>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveWidget(widget.id)}>
                                     <Trash2 className="w-4 h-4 text-destructive" />
                                 </Button>
                             </CardHeader>
                             <CardContent className="h-[250px] w-full">
                                 {data.length > 0 ? renderChart(widget, data) : (
                                     <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                         Tidak ada data
                                     </div>
                                 )}
                             </CardContent>
                         </Card>
                     );
                 })}
             </div>

             {/* Add Widget Dialog */}
             <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                 <DialogContent>
                     <DialogHeader>
                         <DialogTitle>Tambah Grafik Baru</DialogTitle>
                         <DialogDescription>
                             Konfigurasi grafik kustom untuk dashboard analisa Anda.
                         </DialogDescription>
                     </DialogHeader>
                     <div className="grid gap-4 py-4">
                         <div className="grid gap-2">
                             <Label>Judul Grafik</Label>
                             <Input 
                                placeholder="Contoh: Penjualan per Sales" 
                                value={tempConfig.title}
                                onChange={(e) => setTempConfig({...tempConfig, title: e.target.value})}
                             />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div className="grid gap-2">
                                 <Label>Tipe Grafik</Label>
                                 <Select value={tempConfig.type} onValueChange={(v) => setTempConfig({...tempConfig, type: v as ChartType})}>
                                     <SelectTrigger><SelectValue /></SelectTrigger>
                                     <SelectContent>
                                         <SelectItem value="bar">Bar Chart</SelectItem>
                                         <SelectItem value="line">Line Chart</SelectItem>
                                         <SelectItem value="area">Area Chart</SelectItem>
                                         <SelectItem value="pie">Pie Chart</SelectItem>
                                     </SelectContent>
                                 </Select>
                             </div>
                             <div className="grid gap-2">
                                 <Label>Warna</Label>
                                 <div className="flex gap-2 mt-2">
                                     {['#3b82f6', '#00C49F', '#FFBB28', '#8884d8'].map(c => (
                                         <div 
                                            key={c} 
                                            className={`w-6 h-6 rounded-full cursor-pointer ring-offset-2 ${tempConfig.color === c ? 'ring-2 ring-black' : ''}`}
                                            style={{ backgroundColor: c }}
                                            onClick={() => setTempConfig({...tempConfig, color: c})}
                                         />
                                     ))}
                                 </div>
                             </div>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div className="grid gap-2">
                                 <Label>Sumber Data (X-Axis)</Label>
                                 <Select value={tempConfig.source} onValueChange={(v) => setTempConfig({...tempConfig, source: v as DataSource})}>
                                     <SelectTrigger><SelectValue /></SelectTrigger>
                                     <SelectContent>
                                         <SelectItem value="daily">Harian</SelectItem>
                                         <SelectItem value="monthly">Bulanan</SelectItem>
                                         <SelectItem value="kategori">Kategori</SelectItem>
                                         <SelectItem value="produk">Produk</SelectItem>
                                         <SelectItem value="pelanggan">Pelanggan</SelectItem>
                                         <SelectItem value="sales">Salesman</SelectItem>
                                     </SelectContent>
                                 </Select>
                             </div>
                             <div className="grid gap-2">
                                 <Label>Metrik (Y-Axis)</Label>
                                 <Select value={tempConfig.metric} onValueChange={(v) => setTempConfig({...tempConfig, metric: v as DataMetric})}>
                                     <SelectTrigger><SelectValue /></SelectTrigger>
                                     <SelectContent>
                                         <SelectItem value="total_omzet">Total Omzet</SelectItem>
                                         <SelectItem value="total_qty">Total Quantity</SelectItem>
                                         <SelectItem value="total_trx">Total Transaksi</SelectItem>
                                     </SelectContent>
                                 </Select>
                             </div>
                         </div>
                     </div>
                     <DialogFooter>
                         <Button variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
                         <Button onClick={handleAddWidget}>Simpan Grafik</Button>
                     </DialogFooter>
                 </DialogContent>
             </Dialog>
        </div>
    );
}
