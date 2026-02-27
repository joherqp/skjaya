import { useState, useMemo } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from '@/components/ui/label';
import { Switch } from "@/components/ui/switch";
import { TableHeader, TableHead } from "@/components/ui/table"; // Added TableHeader/Head if needed or just Body as per original
import { Barang as BarangType } from '@/lib/types';

// Helper
const formatNumber = (num: number) => {
    return num.toLocaleString('id-ID', { maximumFractionDigits: 2 });
};

interface StokDetailSectionProps {
    barangId: string;
    item: BarangType;
    currentUnit: { nama: string, konversi: number };
    isAdminOrOwner: boolean;
    filterCabang?: string[];
}

export const StokDetailSection = ({ barangId, item, currentUnit, isAdminOrOwner, filterCabang = [] }: StokDetailSectionProps) => {
    const { stokPengguna, users, cabang } = useDatabase();
    const { user } = useAuth();

    // View Mode: 
    // Admin/Owner: 'global' (Branch Aggregate) | 'detail' (All Users)
    // Others: 'personal' (My Stock) | 'detail' (My Branch Users)
    const [viewMode, setViewMode] = useState<'global' | 'detail' | 'personal'>(isAdminOrOwner ? 'global' : 'personal');

    // Calculate Branch Mean (for non-admin label)
    const { branchName, branchTotal } = useMemo(() => {
        if (isAdminOrOwner) return { branchName: '', branchTotal: 0 };

        const myCabangId = user?.cabangId;
        const bName = cabang.find(c => c.id === myCabangId)?.nama || 'Cabang';

        const total = stokPengguna
            .filter(s => s.barangId === barangId && s.jumlah > 0)
            .filter(s => {
                const holder = users.find(u => u.id === s.userId);
                return holder?.cabangId === myCabangId;
            })
            .reduce((sum, s) => sum + s.jumlah, 0);

        return { branchName: bName, branchTotal: total };
    }, [stokPengguna, users, cabang, user, isAdminOrOwner, barangId]);

    // Filter Stock Holders based on Role & Branch
    const processedStock = useMemo(() => {
        // 1. Filter out relevant stokPengguna entries
        let relevantStocks = stokPengguna.filter(s => s.barangId === barangId && s.jumlah > 0);

        if (!isAdminOrOwner) {
            // Non-Admin: Only show users in SAME BRANCH
            const myCabangId = user?.cabangId;
            relevantStocks = relevantStocks.filter(s => {
                const holder = users.find(u => u.id === s.userId);
                return holder?.cabangId === myCabangId;
            });
        } else if (filterCabang.length > 0) {
            // Admin: Filter based on selected branches
            relevantStocks = relevantStocks.filter(s => {
                const holder = users.find(u => u.id === s.userId);
                return holder?.cabangId && filterCabang.includes(holder.cabangId);
            });
        }

        // 2. Process based on View Mode
        if (isAdminOrOwner) {
            if (viewMode === 'global') {
                // Aggregate by Branch
                const branchMap = new Map<string, number>();

                relevantStocks.forEach(s => {
                    const holder = users.find(u => u.id === s.userId);
                    const cabangId = holder?.cabangId || 'unknown';
                    const currentQty = branchMap.get(cabangId) || 0;
                    branchMap.set(cabangId, currentQty + s.jumlah);
                });

                // Convert to display format
                return Array.from(branchMap.entries()).map(([cabangId, qty]) => {
                    const cab = cabang.find(c => c.id === cabangId);
                    return {
                        name: cab?.nama || 'Unknown Branch',
                        role: 'Cabang',
                        cabang: '-',
                        qty
                    };
                }).sort((a, b) => b.qty - a.qty);
            } else {
                // Detail: Show All Users
                const details = relevantStocks.map(s => {
                    const holder = users.find(u => u.id === s.userId);
                    const holderCabang = cabang.find(c => c.id === holder?.cabangId);
                    return {
                        name: holder?.nama || 'Unknown User',
                        role: holder?.roles.join(', ') || 'N/A',
                        cabang: holderCabang?.nama || 'Unknown Branch',
                        qty: s.jumlah
                    };
                });
                return details.sort((a, b) => b.qty - a.qty);
            }
        } else {
            // Non-Admin
            if (viewMode === 'detail') {
                // Detail (Branch Level): Show all users in branch
                return relevantStocks.map(s => {
                    const holder = users.find(u => u.id === s.userId);
                    return {
                        name: (holder?.id === user?.id) ? `${holder?.nama} (Anda)` : (holder?.nama || 'Unknown User'),
                        role: holder?.roles.join(', ') || 'N/A',
                        cabang: 'Satu Cabang',
                        qty: s.jumlah
                    };
                }).sort((a, b) => b.qty - a.qty);
            } else {
                // Personal: Show ONLY my stock
                const myStock = relevantStocks.find(s => s.userId === user?.id);
                if (!myStock) return [];
                return [{
                    name: 'Anda',
                    role: 'Personal',
                    cabang: '-',
                    qty: myStock.jumlah
                }];
            }
        }
    }, [stokPengguna, users, cabang, user, isAdminOrOwner, viewMode, barangId]);

    return (
        <div className="w-full border-t border-dashed pt-2 mt-2 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between bg-muted/30 border rounded-md p-2 mb-2">
                <div className="flex-1 min-w-0 mr-4">
                    <h4 className="font-semibold text-xs truncate">Rincian Kepemilikan Stok</h4>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{item.nama}</p>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                    <Label htmlFor="view-mode" className="text-[10px] cursor-pointer">
                        {isAdminOrOwner
                            ? (viewMode === 'global' ? 'Global' : 'Detail')
                            : (viewMode === 'personal' ? 'Personal' : `${branchName} (${formatNumber(branchTotal / currentUnit.konversi)})`)}
                    </Label>
                    <Switch
                        id="view-mode"
                        checked={viewMode === 'detail'}
                        onCheckedChange={(c: boolean) => setViewMode(c ? 'detail' : (isAdminOrOwner ? 'global' : 'personal'))}
                        className="h-4 w-7 data-[state=checked]:bg-primary"
                        thumbClassName="h-3 w-3 data-[state=checked]:translate-x-3"
                    />
                </div>
            </div>

            <ScrollArea className="h-[200px] border rounded-md bg-background">
                <Table>
                    <TableBody>
                        {processedStock.map((holder, idx) => (
                            <TableRow key={idx} className="hover:bg-muted/50">
                                <TableCell className="py-2.5 pl-3 pr-1">
                                    <div className={`font-medium text-xs truncate max-w-[140px] ${holder.name.includes('(Anda)') || holder.name === 'Anda' ? 'text-primary' : ''}`}>{holder.name}</div>
                                    {holder.role !== 'Cabang' && holder.role !== 'Personal' && (
                                        <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">{holder.cabang !== '-' && viewMode === 'detail' && isAdminOrOwner ? `${holder.cabang} • ` : ''}{holder.role}</div>
                                    )}
                                </TableCell>
                                <TableCell className="text-right py-2.5 pr-3 pl-1 font-mono text-xs text-blue-600 font-medium whitespace-nowrap">
                                    {formatNumber(holder.qty / currentUnit.konversi)}
                                </TableCell>
                            </TableRow>
                        ))}

                        {processedStock.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center py-8 text-xs text-muted-foreground">
                                    Tidak ada data stok {viewMode === 'personal' ? 'pribadi' : ''}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
    );
};
