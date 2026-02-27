
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';

export function usePricing() {
    const { pelanggan, barang, harga, promo } = useDatabase();
    const { user } = useAuth();

    const getPriceDetailed = (
        productId: string,
        unitId: string | undefined,
        qty: number,
        conversion: number,
        customerId: string,
        totalMixMatchQty: number,
        productQtyBase?: number
    ): { price: number, tier?: { min: number; max: number; harga: number; isMixMatch?: boolean } } => {
        const selectedCustomer = pelanggan.find(p => p.id === customerId);
        const product = barang.find(b => b.id === productId);

        const findRule = (targetUnitId: string | undefined) => {
            if (!targetUnitId) return undefined;
            const rules = harga.filter(h =>
                h.barangId === productId &&
                h.satuanId === targetUnitId &&
                h.status === 'disetujui' &&
                new Date(h.tanggalEfektif) <= new Date() &&
                (!h.kategoriPelangganIds || (selectedCustomer && h.kategoriPelangganIds.includes(selectedCustomer.kategoriId))) &&
                (!h.cabangId || h.cabangId === user?.cabangId)
            );
            rules.sort((a, b) => (b.cabangId ? 1 : 0) - (a.cabangId ? 1 : 0));
            return rules[0];
        };

        let matchedRule = findRule(unitId);
        let usingBaseRule = false;

        if (!matchedRule && product && unitId !== product.satuanId) {
            matchedRule = findRule(product.satuanId);
            usingBaseRule = true;
        }

        if (matchedRule) {
            let price = matchedRule.harga;
            let tierVal: { min: number; max: number; harga: number; isMixMatch?: boolean } | undefined;

            if (matchedRule.grosir && matchedRule.grosir.length > 0) {
                const sortedTiers = [...matchedRule.grosir].sort((a, b) => b.min - a.min);
                // Logic: use total combined qty of this product in cart for tier calculation
                const totalQtyInBaseForTier = productQtyBase !== undefined ? productQtyBase : (qty * conversion);

                tierVal = sortedTiers.find(g => {
                    const quantityToCheck = g.isMixMatch ? totalMixMatchQty : totalQtyInBaseForTier;
                    return quantityToCheck >= g.min;
                });

                if (tierVal) price = tierVal.harga;
            }
            if (usingBaseRule) return { price: price * conversion, tier: tierVal };
            return { price, tier: tierVal };
        }
        return { price: 0 };
    };

    const getPromo = (
        productId: string,
        price: number,
        qty: number,
        conversion: number,
        productQtyBase?: number,
        selectedPromoId?: string,
        perNotaQuantities?: Map<string, number>
    ): {
        discount: number,
        bonus?: {
            productIds: string[],
            qty: number,
            mechanism: 'random' | 'single' | 'mix',
            promoId: string
        },
        availablePromos: { id: string; nama: string; tipe: string; nilai: number; bonusProdukIds?: string[]; isBest?: boolean; metodeKelipatan?: 'per_item' | 'per_nota' }[],
        appliedPromoId?: string
    } => {
        const now = new Date();
        const totalInBase = productQtyBase !== undefined ? productQtyBase : (qty * conversion);
        const currentRowInBase = qty * conversion;



        const activePromos = promo.filter(p => {
            // Check active status
            const isPromoActive = p.aktif !== undefined ? p.aktif : p.isActive;
            if (!isPromoActive) return false;

            // Check dates
            const startDateRaw = (p as any).berlakuMulai || (p as any).berlaku_mulai || p.tanggalMulai;
            const endDateRaw = (p as any).berlakuSampai || (p as any).berlaku_sampai || p.tanggalBerakhir;

            const start = startDateRaw ? new Date(startDateRaw) : new Date();
            const end = endDateRaw ? new Date(endDateRaw) : null;

            if (isNaN(start.getTime())) return false;

            if (start > now || (end && end < now)) return false;
            if (p.scope === 'selected_products' && p.targetProdukIds && !p.targetProdukIds.includes(productId)) return false;
            if (p.cabangId && p.cabangId !== user?.cabangId) return false;

            const isPerNota = p.metodeKelipatan === 'per_nota';
            const basisQty = (isPerNota && perNotaQuantities) ? (perNotaQuantities.get(p.id) || 0) : totalInBase;
            if (p.minQty && basisQty < p.minQty) return false;

            return true;
        });

        // Calculate potential of EACH promo
        const candidates = activePromos.map(p => {
            let potentialDiscount = 0;
            let potentialBonus = undefined;

            const isPerNota = p.metodeKelipatan === 'per_nota';
            const calculationBasis = (isPerNota && perNotaQuantities) ? (perNotaQuantities.get(p.id) || 0) : totalInBase;

            if (p.tipe === 'persen') {
                const gross = price * qty;
                potentialDiscount = gross * (p.nilai / 100);
            } else if (p.tipe === 'nominal') {
                const maxApply = p.maxApply || p.max_apply || Infinity;
                if (p.isKelipatan) {
                    const effectiveMinQty = p.minQty && p.minQty > 0 ? p.minQty : 1;
                    let multiplier = Math.floor(calculationBasis / effectiveMinQty);

                    if (maxApply && maxApply > 0) {
                        multiplier = Math.min(multiplier, maxApply);
                    }

                    const totalDiscountGlobal = multiplier * p.nilai;

                    if (isPerNota) {
                        // Proportional share: (ItemQty / TotalQty) * GlobalDiscount
                        potentialDiscount = calculationBasis > 0 ? totalDiscountGlobal * (currentRowInBase / calculationBasis) : 0;
                    } else {
                        // Per Item: simple calculation
                        potentialDiscount = multiplier * p.nilai; // logic mismatch in original?
                        // Original logic: 
                        // const totalDiscount = multiplier * p.nilai;
                        // potentialDiscount = totalInBase > 0 ? totalDiscount * (currentRowInBase / totalInBase) : 0;
                        // If per_item, totalInBase IS the basis. so currentRowInBase/totalInBase is 1 (if no conversion mess).
                        // Let's keep specific logic:
                        potentialDiscount = totalDiscountGlobal * (currentRowInBase / calculationBasis);
                    }
                } else {
                    // Not Kelipatan
                    if (isPerNota) {
                        // Flat nominal once per transaction?
                        // "Jika pembelian mencapai jumlah ini, promo berlaku."
                        // e.g. Buy 10 get 10k off. Total 10. Discount 10k.
                        // Share proportionally.
                        potentialDiscount = calculationBasis > 0 ? p.nilai * (currentRowInBase / calculationBasis) : 0;
                    } else {
                        potentialDiscount = p.nilai; // Per item flat discount? "Potongan Harga" usually per item.
                        // But logic above used proportional? 
                        // "potentialDiscount = totalInBase > 0 ? p.nilai * (currentRowInBase / totalInBase) : 0;"
                        // If totalInBase == currentRowInBase, it's p.nilai.
                        // I'll keep p.nilai for per_item non-kelipatan.
                        // Wait, previous code: p.nilai * (currentRowInBase / totalInBase).
                        // If conversion=1, this is p.nilai.
                        potentialDiscount = p.nilai * (currentRowInBase / totalInBase);
                    }
                }
            } else if (p.tipe === 'produk') {
                const maxApply = p.maxApply || p.max_apply || Infinity;
                const effectiveMinQty = p.minQty && p.minQty > 0 ? p.minQty : 1;
                let bonusCount = 0;

                if (p.isKelipatan) {
                    let multiplier = Math.floor(calculationBasis / effectiveMinQty);
                    if (maxApply && maxApply > 0) {
                        multiplier = Math.min(multiplier, maxApply);
                    }
                    bonusCount = multiplier * (p.nilai && p.nilai > 0 ? p.nilai : 1);
                } else {
                    bonusCount = (p.nilai && p.nilai > 0 ? p.nilai : 1);
                }

                if (bonusCount > 0) {
                    const productOptions = p.bonusProdukIds && p.bonusProdukIds.length > 0 ? p.bonusProdukIds : (p.bonusProdukId ? [p.bonusProdukId] : []);
                    if (productOptions.length > 0) {
                        potentialBonus = {
                            productIds: productOptions,
                            qty: bonusCount,
                            mechanism: p.mekanismeBonus || 'random',
                            promoId: p.id
                        };
                    }
                }
            }

            // Evaluate value for "Best" determination (approximate value of bonus?)
            // For now, we mainly compare discount. For bonus, we might prioritize it if discount is 0.
            const valueScore = potentialDiscount > 0 ? potentialDiscount : (potentialBonus ? 999999 : 0); // Bonus is considered "high value"

            return { p, potentialDiscount, potentialBonus, valueScore };
        });

        // Sort by value score desc
        candidates.sort((a, b) => b.valueScore - a.valueScore);

        const availablePromos = candidates.map((c, idx) => ({
            id: c.p.id,
            nama: c.p.nama,
            tipe: c.p.tipe,
            nilai: c.p.nilai,
            bonusProdukIds: c.p.bonusProdukIds || (c.p.bonusProdukId ? [c.p.bonusProdukId] : []),
            isBest: idx === 0,
            metodeKelipatan: c.p.metodeKelipatan
        }));

        // Determine Which to Apply
        let selectedCandidate = candidates[0]; // Default to best

        if (selectedPromoId === 'NONE') {
            return { discount: 0, availablePromos };
        }

        if (selectedPromoId) {
            const found = candidates.find(c => c.p.id === selectedPromoId);
            if (found) {
                selectedCandidate = found;
            } else {
                // Selected promo no longer valid? Fallback to Best or None?
                // Let's fallback to Best for continuity, or None? Best is safer.
            }
        }

        if (!selectedCandidate) {
            return { discount: 0, availablePromos };
        }

        return {
            discount: selectedCandidate.potentialDiscount,
            bonus: selectedCandidate.potentialBonus,
            availablePromos,
            appliedPromoId: selectedCandidate.p.id
        };
    };

    return { getPriceDetailed, getPromo };
}
