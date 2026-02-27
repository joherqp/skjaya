import { useState, useMemo } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, AlertTriangle, RefreshCw, ChevronDown } from 'lucide-react';
import { Barang as BarangType, Satuan, Kategori } from '@/lib/types';
import { StokDetailSection } from './StokDetailSection';

// Helper
const formatNumber = (num: number) => {
    return num.toLocaleString('id-ID', { maximumFractionDigits: 2 });
};

interface BarangListItemProps {
    item: BarangType;
    navigate: (path: string) => void;
    isAdminOrOwner: boolean;
    getStockHealth: (id: string, stok: number) => { avgDailySales: number; daysCoverage: number; status: 'aman' | 'warning' | 'critical'; demandLevel: string };
    satuanList: Satuan[];
    kategori: Kategori | undefined;
    filterCabang: string[];
}

export const BarangListItem = ({ item, navigate, isAdminOrOwner, getStockHealth, satuanList, kategori, filterCabang }: BarangListItemProps) => {
    const { stokPengguna } = useDatabase(); // Removed users import as it might not be needed here if logic is cleaner? actually used below? no.
    const { user } = useAuth();
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [currentSatuanId, setCurrentSatuanId] = useState(item.satuanId);

    // Prepare Units List: Main + Multis
    const mainSatuanDef = satuanList.find(s => s.id === item.satuanId);
    const availableUnits = [
        {
            id: item.satuanId,
            nama: mainSatuanDef?.simbol || mainSatuanDef?.nama || 'Unit',
            konversi: 1,
        },
        ...(item.multiSatuan || []).map(m => {
            const s = satuanList.find(x => x.id === m.satuanId);
            return {
                id: m.satuanId,
                nama: s?.simbol || s?.nama || 'Unit',
                konversi: m.konversi,
            };
        })
    ];

    const toggleUnit = (e: React.MouseEvent) => {
        e.stopPropagation();
        const currentIndex = availableUnits.findIndex(u => u.id === currentSatuanId);
        const nextIndex = (currentIndex + 1) % availableUnits.length;
        setCurrentSatuanId(availableUnits[nextIndex].id);
    };

    const currentUnit = availableUnits.find(u => u.id === currentSatuanId) || availableUnits[0];

    // Gunakan stok yang sudah dikalkulasi dengan filter cabang oleh useBarangManagement
    const totalDisplayStock = item.stok || 0;

    const displayStock = totalDisplayStock / currentUnit.konversi;
    const health = getStockHealth(item.id, totalDisplayStock);

    return (
        <Card
            elevated
            className="animate-slide-up cursor-pointer hover:border-primary/30 group relative"
            onClick={() => navigate(`/barang/${item.id}`)}
        >
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                        {item.gambarUrl ? (
                            <img src={item.gambarUrl} alt={item.nama} className="w-full h-full object-cover" />
                        ) : (
                            <Package className="w-7 h-7 text-muted-foreground" />
                        )}
                        {health.status !== 'aman' && (
                            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${health.status === 'critical' ? 'bg-destructive' : 'bg-warning'}`} />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold text-sm truncate">{item.nama}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">{item.kode}</p>
                            </div>
                            {health.status !== 'aman' && (
                                <Badge variant={health.status === 'critical' ? 'destructive' : 'warning'} className="flex-shrink-0">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    {health.status === 'critical' ? 'Kritis' : 'Menipis'}
                                </Badge>
                            )}
                        </div>

                        <div className="flex flex-wrap items-end justify-between gap-3 mt-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="muted" className="hidden sm:inline-flex">{kategori?.nama}</Badge>

                                {/* Interactive Stock & Unit Display */}
                                <div
                                    className="flex items-center gap-1 text-xs bg-primary/5 px-2 py-1 rounded-md hover:bg-primary/10 cursor-pointer transition-colors border border-primary/10"
                                    onClick={toggleUnit}
                                    title="Klik untuk ganti satuan"
                                >
                                    <span className="text-muted-foreground whitespace-nowrap">Sisa:</span>
                                    <span className="font-bold text-primary text-sm whitespace-nowrap">{formatNumber(displayStock)}</span>
                                    <span className="font-medium whitespace-nowrap">{currentUnit.nama}</span>
                                    {availableUnits.length > 1 && <RefreshCw className="w-3 h-3 ml-1 text-muted-foreground opacity-50 flex-shrink-0" />}
                                </div>

                            </div>
                        </div>
                    </div>
                </div>

                {/* Stock Detail Section (Expandable) */}
                <div onClick={e => e.stopPropagation()} className="mt-3 pt-2 border-t border-dashed">
                    <div className="flex justify-center">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-16 rounded-full bg-muted/30 hover:bg-muted text-muted-foreground flex items-center justify-center p-0 transition-colors"
                            onClick={() => setIsDetailOpen(!isDetailOpen)}
                        >
                            <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isDetailOpen ? 'rotate-180' : ''}`} />
                        </Button>
                    </div>

                    {isDetailOpen && (
                        <StokDetailSection barangId={item.id} item={item} currentUnit={currentUnit} isAdminOrOwner={isAdminOrOwner} filterCabang={filterCabang} />
                    )}
                </div>

            </CardContent>
        </Card>
    );
};
