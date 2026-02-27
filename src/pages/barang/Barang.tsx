import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, PackagePlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Switch } from "@/components/ui/switch";
import { BarangList } from './components/BarangList';
import { BarangFilterPopover } from './components/BarangFilterPopover';
import { useBarangManagement } from './hooks/useBarangManagement';

export default function Barang() {
    const navigate = useNavigate();
    const [displayLimit, setDisplayLimit] = useState(10);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const {
        // State
        search, setSearch,
        filterKategori, setFilterKategori,
        filterStok, setFilterStok,
        filterCabang, setFilterCabang,
        showInactive, setShowInactive,
        activeFiltersCount,

        // Data
        displayedItems,
        kategoriList,
        satuanList,
        cabangList,

        // Utils
        isAdminOrOwner,
        getStockHealth
    } = useBarangManagement();

    return (
        <MainLayout title="Barang">
            <div className="p-4 space-y-4 max-w-6xl mx-auto">

                {/* Top Controls */}
                <div className="flex gap-3 items-center justify-between">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari nama barang atau kode..."
                            className="pl-9 bg-background/50 backdrop-blur"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2 shrink-0">
                        <BarangFilterPopover
                            isFilterOpen={isFilterOpen}
                            setIsFilterOpen={setIsFilterOpen}
                            activeFiltersCount={activeFiltersCount}
                            filterKategori={filterKategori}
                            setFilterKategori={setFilterKategori}
                            filterStok={filterStok}
                            setFilterStok={setFilterStok}
                            filterCabang={filterCabang}
                            setFilterCabang={setFilterCabang}
                            showInactive={showInactive}
                            setShowInactive={setShowInactive}
                            kategoriList={kategoriList}
                            cabangList={cabangList}
                            isAdminOrOwner={isAdminOrOwner}
                        />

                        {isAdminOrOwner && (
                            <Button onClick={() => navigate('/barang/new')} className="bg-primary hover:bg-primary/90">
                                <PackagePlus className="w-4 h-4 mr-2" />
                                Baru
                            </Button>
                        )}

                        <Button onClick={() => navigate('/barang/update-stok')} variant="secondary" className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10">
                            <PackagePlus className="w-4 h-4 mr-2" />
                            Update
                        </Button>
                    </div>
                </div>

                {/* Barang List */}
                <BarangList
                    items={displayedItems}
                    displayLimit={displayLimit}
                    setDisplayLimit={setDisplayLimit}
                    navigate={navigate}
                    isAdminOrOwner={isAdminOrOwner || false}
                    getStockHealth={getStockHealth}
                    satuanList={satuanList}
                    kategoriList={kategoriList}
                    filterCabang={filterCabang}
                />

            </div>
        </MainLayout>
    );
}
