import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import { Barang as BarangType, Satuan, Kategori } from '@/lib/types';
import { BarangListItem } from './BarangListItem';

interface BarangListProps {
    items: (BarangType & { stok: number })[];
    displayLimit: number;
    setDisplayLimit: React.Dispatch<React.SetStateAction<number>>;
    navigate: (path: string) => void;
    isAdminOrOwner: boolean;
    getStockHealth: (id: string, stok: number) => { avgDailySales: number; daysCoverage: number; status: 'aman' | 'warning' | 'critical'; demandLevel: string };
    satuanList: Satuan[];
    kategoriList: Kategori[];
    filterCabang: string[];
}

export const BarangList = ({
    items,
    displayLimit,
    setDisplayLimit,
    navigate,
    isAdminOrOwner,
    getStockHealth,
    satuanList,
    kategoriList,
    filterCabang
}: BarangListProps) => {

    if (items.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Package className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">Belum ada stok barang</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                    {isAdminOrOwner
                        ? "Belum ada data barang di database."
                        : "Stok barang yang Anda miliki akan muncul di sini."}
                    <br />
                    {isAdminOrOwner
                        ? "Tambahkan barang baru untuk memulai."
                        : "Lakukan Restock atau terima Mutasi untuk menambah stok."}
                </p>
            </div>
        );
    }

    return (
        <>
            {items.slice(0, displayLimit).map(item => (
                <BarangListItem
                    key={item.id}
                    item={item}
                    navigate={navigate}
                    isAdminOrOwner={isAdminOrOwner}
                    getStockHealth={getStockHealth}
                    satuanList={satuanList}
                    kategori={kategoriList.find(k => k.id === item.kategoriId)}
                    filterCabang={filterCabang}
                />
            ))}
            {items.length > displayLimit && (
                <Button
                    variant="ghost"
                    className="w-full mt-4 border-dashed text-muted-foreground"
                    onClick={() => setDisplayLimit(prev => prev + 10)}
                >
                    Lihat Lainnya
                </Button>
            )}
        </>
    );
};
