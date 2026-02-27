
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Barang, Satuan } from '@/lib/types';

interface UnitCalculatorProps {
    product: Barang;
    satuanList: Satuan[];
    onApply: (totalBaseQty: number) => void;
}

export function UnitCalculator({ product, satuanList, onApply }: UnitCalculatorProps) {
    const [qtyMap, setQtyMap] = useState<Record<string, number>>({});

    const resolveName = (id?: string) => satuanList.find(s => s.id === id)?.nama || 'Unit';

    const handleInputChange = (satuanId: string, val: string) => {
        const num = parseInt(val) || 0;
        setQtyMap(prev => ({ ...prev, [satuanId]: num }));
    };

    const totalBase = useMemo(() => {
        let sum = 0;
        // Base
        sum += (qtyMap[product.satuanId] || 0);
        // Multi
        product.multiSatuan.forEach(m => {
            sum += (qtyMap[m.satuanId] || 0) * m.konversi;
        });
        return sum;
    }, [qtyMap, product]);

    return (
        <div className="space-y-3 pt-2 w-64">
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {/* Base Unit */}
                <div className="flex items-center gap-2">
                    <div className="w-16 bg-muted/40 p-1 rounded text-center text-xs font-bold truncate shrink-0">
                        {resolveName(product.satuanId)}
                    </div>
                    <Input 
                        type="number" 
                        min="0"
                        placeholder="0"
                        className="h-8 md:text-sm"
                        value={qtyMap[product.satuanId] || ''}
                        onChange={(e) => handleInputChange(product.satuanId, e.target.value)}
                    />
                </div>
                
                {/* Multi Units */}
                {product.multiSatuan.map((m, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                        <div className="w-16 bg-muted/40 p-1 rounded text-center text-xs font-bold truncate shrink-0" title={`1 ${resolveName(m.satuanId)} = ${m.konversi} ${resolveName(product.satuanId)}`}>
                            {resolveName(m.satuanId)}
                        </div>
                        <Input 
                            type="number" 
                            min="0"
                            placeholder="0"
                            className="h-8 md:text-sm"
                            value={qtyMap[m.satuanId] || ''}
                            onChange={(e) => handleInputChange(m.satuanId, e.target.value)}
                        />
                        <span className="text-[10px] text-muted-foreground w-12 shrink-0">
                            x{m.konversi}
                        </span>
                    </div>
                ))}
            </div>

            <div className="pt-2 border-t flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm font-medium">
                    <span>Total (Base):</span>
                    <span>{totalBase} {resolveName(product.satuanId)}</span>
                </div>
                <Button 
                    size="sm" 
                    className="w-full" 
                    onClick={() => onApply(totalBase)} 
                    disabled={totalBase <= 0}
                >
                    Terapkan & Konversi ke Base
                </Button>
            </div>
        </div>
    );
}
