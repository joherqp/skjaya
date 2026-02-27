import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Switch } from "@/components/ui/switch";
import { Filter } from 'lucide-react';
import { Cabang, Kategori } from '@/lib/types';

interface BarangFilterPopoverProps {
    isFilterOpen: boolean;
    setIsFilterOpen: (open: boolean) => void;
    activeFiltersCount: number;
    filterKategori: string[];
    setFilterKategori: (val: string[]) => void;
    filterStok: string[];
    setFilterStok: (val: string[]) => void;
    filterCabang: string[];
    setFilterCabang: (val: string[]) => void;
    showInactive: boolean;
    setShowInactive: (val: boolean) => void;
    kategoriList: Kategori[];
    cabangList: Cabang[];
    isAdminOrOwner: boolean;
}

export function BarangFilterPopover({
    isFilterOpen, setIsFilterOpen,
    activeFiltersCount,
    filterKategori, setFilterKategori,
    filterStok, setFilterStok,
    filterCabang, setFilterCabang,
    showInactive, setShowInactive,
    kategoriList, cabangList, isAdminOrOwner
}: BarangFilterPopoverProps) {
    return (
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className={activeFiltersCount > 0 ? "border-primary text-primary relative" : ""}>
                    <Filter className="w-4 h-4" />
                    {activeFiltersCount > 0 && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span></span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium leading-none">Filter Barang</h4>
                        {(filterKategori.length > 0 || filterStok.length > 0 || filterCabang.length > 0) && (
                            <Button variant="ghost" size="sm" className="h-auto p-0 text-destructive text-xs" onClick={() => { setFilterKategori([]); setFilterStok([]); setFilterCabang([]); }}>
                                Reset
                            </Button>
                        )}
                    </div>

                    {/* Kategori Filter (Multi) */}
                    <div className="space-y-3">
                        <Label>Kategori</Label>
                        <div className="space-y-2">
                            {kategoriList.map(cat => (
                                <div key={cat.id} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id={`cat-${cat.id}`}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={filterKategori.includes(cat.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) setFilterKategori([...filterKategori, cat.id]);
                                            else setFilterKategori(filterKategori.filter(id => id !== cat.id));
                                        }}
                                    />
                                    <label htmlFor={`cat-${cat.id}`} className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        {cat.nama}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Cabang Filter (Multi) - Admin Only */}
                    {isAdminOrOwner && (
                        <div className="space-y-3 pt-3 border-t">
                            <Label>Cabang</Label>
                            <div className="space-y-2">
                                {cabangList.filter(c => !c.nama.toLowerCase().includes('pusat')).map(c => (
                                    <div key={c.id} className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            id={`branch-${c.id}`}
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            checked={filterCabang.includes(c.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setFilterCabang([...filterCabang, c.id]);
                                                else setFilterCabang(filterCabang.filter(id => id !== c.id));
                                            }}
                                        />
                                        <label htmlFor={`branch-${c.id}`} className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            {c.nama}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Stock Status */}
                    <div className="space-y-3 pt-3 border-t">
                        <Label>Status Stok</Label>
                        <div className="space-y-2">
                            {['Aman', 'Rendah'].map(status => (
                                <div key={status} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id={`stok-${status}`}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={filterStok.includes(status.toLowerCase())}
                                        onChange={(e) => {
                                            const val = status.toLowerCase();
                                            if (e.target.checked) setFilterStok([...filterStok, val]);
                                            else setFilterStok(filterStok.filter(s => s !== val));
                                        }}
                                    />
                                    <label htmlFor={`stok-${status}`} className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        {status}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Inactive Toggle */}
                    <div className="flex items-center justify-between pt-3 border-t">
                        <Label htmlFor="inactive-mode" className="text-sm cursor-pointer">Tampilkan Non-Aktif</Label>
                        <Switch id="inactive-mode" checked={showInactive} onCheckedChange={setShowInactive} />
                    </div>

                </div>
            </PopoverContent>
        </Popover>
    );
}
