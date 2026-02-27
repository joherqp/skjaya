import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Users, BarChart, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatRupiah, formatNumber } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Barang, Pelanggan, Penjualan as PenjualanType, Satuan } from '@/lib/types';

export const StatsSlideshow = ({ data, pelanggan, barang, satuan }: { data: PenjualanType[], pelanggan: Pelanggan[], barang: Barang[], satuan: Satuan[] }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    // Filter Data for Current Month - Exclude 'batal' and 'draft'
    const currentMonthData = data.filter(p => {
        const d = new Date(p.tanggal);
        const now = new Date();
        const isCurrentMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        return isCurrentMonth && p.status !== 'batal' && p.status !== 'draft';
    });

    // 1. Top Sales (Value)
    const topSales = Object.values(currentMonthData.reduce((acc: Record<string, { id: string, total: number, count: number }>, curr) => {
        if (!acc[curr.pelangganId]) acc[curr.pelangganId] = { id: curr.pelangganId, total: 0, count: 0 };
        acc[curr.pelangganId].total += curr.total;
        acc[curr.pelangganId].count += 1;
        return acc;
    }, {}))
        .sort((a, b) => b.total - a.total)
        .slice(0, 3);

    // 2. Top Products (Qty)
    const topProducts = Object.values(currentMonthData.reduce((acc: Record<string, { id: string, qty: number }>, curr) => {
        curr.items.forEach((item) => {
            // Ensure we use a valid ID lookup key (Handle camelCase and snake_case)
            // item can be PenjualanItem (barangId) or raw DB JSON (barang_id)
            const id = item.barangId || (item as { barang_id?: string }).barang_id;
            if (!id) return;

            if (!acc[id]) acc[id] = { id: id, qty: 0 };
            // Use saved totalQty for accuracy
            const qty = (item.totalQty !== undefined) ? item.totalQty : (item.jumlah * (item.konversi || 1));
            acc[id].qty += qty;
        });
        return acc;
    }, {}))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

    // 3. Most Frequent Customers
    const topFrequency = Object.values(currentMonthData.reduce((acc: Record<string, { id: string, count: number }>, curr) => {
        if (!acc[curr.pelangganId]) acc[curr.pelangganId] = { id: curr.pelangganId, count: 0 };
        acc[curr.pelangganId].count += 1;
        return acc;
    }, {}))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // 4. Daily Sales Chart Data
    const dailySales = currentMonthData.reduce((acc: Record<number, number>, curr) => {
        const date = new Date(curr.tanggal).getDate();
        if (!acc[date]) acc[date] = 0;
        acc[date] += curr.total;
        return acc;
    }, {});

    const chartData = Object.keys(dailySales).map(key => ({
        day: key,
        total: dailySales[parseInt(key)]
    })).sort((a, b) => parseInt(a.day) - parseInt(b.day));

    const slides = [
        {
            title: "Top 3 Pelanggan (Omset)",
            icon: Trophy,
            color: "text-amber-500",
            bg: "bg-amber-50",
            content: (
                <div className="space-y-1">
                    {topSales.map((item, idx) => {
                        const p = pelanggan.find(c => c.id === item.id);
                        return (
                            <div key={idx} className="flex justify-between items-center text-sm border-b last:border-0 py-1.5 border-dashed">
                                <span className="truncate flex-1 font-medium text-muted-foreground">{idx + 1}. <span className="text-foreground">{p?.nama || 'Umum'}</span></span>
                                <span className="font-bold text-primary">{formatRupiah(item.total)}</span>
                            </div>
                        )
                    })}
                </div>
            )
        },
        {
            title: "Produk Terlaris (Qty)",
            icon: TrendingUp,
            color: "text-emerald-500",
            bg: "bg-emerald-50",
            content: (
                <div className="space-y-1">
                    {topProducts.map((item, idx) => {
                        const b = barang.find(x => x.id === item.id);
                        const unitName = satuan.find(s => s.id === b?.satuanId)?.simbol || 'Unit';
                        return (
                            <div key={idx} className="flex justify-between items-center text-sm border-b last:border-0 py-1.5 border-dashed">
                                <span className="truncate flex-1 font-medium text-muted-foreground mr-2">
                                    {idx + 1}. <span className={b ? "text-foreground font-semibold" : "text-destructive italic"}>{b?.nama || `(Item Terhapus: ${item.id.substring(0, 8)}...)`}</span>
                                </span>
                                <span className="font-bold whitespace-nowrap">{item.qty} {unitName}</span>
                            </div>
                        )
                    })}
                </div>
            )
        },
        {
            title: "Pelanggan Teraktif",
            icon: Users,
            color: "text-blue-500",
            bg: "bg-blue-50",
            content: (
                <div className="space-y-1">
                    {topFrequency.map((item, idx) => {
                        const p = pelanggan.find(c => c.id === item.id);
                        return (
                            <div key={idx} className="flex justify-between items-center text-sm border-b last:border-0 py-1.5 border-dashed">
                                <span className="truncate flex-1 font-medium text-muted-foreground">{idx + 1}. <span className="text-foreground">{p?.nama || 'Umum'}</span></span>
                                <span className="font-bold">{item.count} Trx</span>
                            </div>
                        )
                    })}
                </div>
            )
        },
        {
            title: "Grafik Penjualan Harian",
            icon: BarChart,
            color: "text-indigo-500",
            bg: "bg-indigo-50",
            content: (
                <div className="h-[140px] w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis
                                dataKey="day"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10, fill: '#6B7280' }}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                hide
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number) => [formatRupiah(value), 'Total']}
                                labelFormatter={(label) => `Tgl ${label}`}
                            />
                            <Line
                                type="monotone"
                                dataKey="total"
                                stroke="#6366f1"
                                strokeWidth={2}
                                dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )
        }
    ];

    // Navigation Handlers
    const handlePrev = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    };

    const handleNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % slides.length);
    };

    // Swipe Handlers
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
        setIsPaused(true);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;

        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            handleNext();
        } else if (isRightSwipe) {
            handlePrev();
        }
        setIsPaused(false);
    };

    useEffect(() => {
        if (isPaused) return; // Pause logic
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % slides.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [slides.length, isPaused]);

    const CurrentSlide = slides[currentIndex];

    return (
        <Card
            className="overflow-hidden h-[230px] relative select-none cursor-pointer hover:shadow-md transition-shadow group"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            <CardContent className="p-4 h-full flex flex-col">
                <div className={`flex items-center gap-2 mb-2 pb-2 border-b ${CurrentSlide.color}`}>
                    <CurrentSlide.icon className="w-5 h-5" />
                    <h3 className="font-bold text-sm tracking-wide uppercase">{CurrentSlide.title}</h3>
                    {isPaused && <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5 opacity-50">Paused</Badge>}
                </div>
                <div className="flex-1 overflow-hidden relative">
                    {/* Render content directly if arrays check passes or if chart */}
                    {CurrentSlide.content}
                </div>

                {/* Navigation Arrows (Visible on Hover/Touch) */}
                <button
                    onClick={handlePrev}
                    className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 md:opacity-0 md:group-hover:opacity-100 border text-muted-foreground hover:text-foreground"
                    aria-label="Previous Slide"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                    onClick={handleNext}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 md:opacity-0 md:group-hover:opacity-100 border text-muted-foreground hover:text-foreground"
                    aria-label="Next Slide"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>

                {/* Dots */}
                <div className="flex justify-center gap-1.5 mt-2 pt-1 absolute bottom-2 left-0 right-0">
                    {slides.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent pausing interference if needed, though clicking usually implies hover
                                setCurrentIndex(idx);
                            }}
                            className={`rounded-full transition-all duration-300 ${idx === currentIndex ? `w-4 h-1.5 bg-primary` : 'w-1.5 h-1.5 bg-gray-300'
                                }`}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
