import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ShoppingCart, MapPin, Save, ArrowLeft, Plus, Trash2, Locate, Search, Check, ChevronsUpDown, AlertTriangle, Minus, Loader2, X, Tag, CalendarClock } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentLocation } from '@/lib/gps';
import { formatRupiah, formatTanggal } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Barang, Satuan, Penjualan } from '@/lib/types';
import { supabase } from '@/lib/supabase';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { PelangganForm } from '@/components/forms/PelangganForm';
import { Calculator } from 'lucide-react';
import { UnitCalculator } from './components/UnitCalculator';
import { CartItem } from './types';
import { usePricing } from './hooks/usePricing';



export default function TambahPenjualan() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const { pelanggan, barang, addPenjualan, satuan, stokPengguna, saldoPengguna, addSaldoPengguna, harga, promo, kategoriPelanggan, updateSaldoPengguna, penjualan, addPersetujuan, profilPerusahaan, absensi, addAbsensi } = useDatabase(); // Added addPersetujuan, absensi, addAbsensi
    const { getPriceDetailed, getPromo } = usePricing();
    const [loadingLoc, setLoadingLoc] = useState(false);

    const [location, setLocation] = useState({
        latitude: 0,
        longitude: 0,
        alamat: ''
    });

    const [formData, setFormData] = useState({
        pelangganId: searchParams.get('pelangganId') || '',
        tanggal: new Date().toLocaleDateString('sv').split('T')[0],
        catatan: ''
    });

    // Debt Blocking State
    // Debt Blocking State
    const [unpaidDebts, setUnpaidDebts] = useState<Penjualan[]>([]);
    const [showDebtDialog, setShowDebtDialog] = useState(false);

    // Check for Debt on Customer Selection
    useEffect(() => {
        // Config: Check if blocking is enabled
        const config = profilPerusahaan?.config;
        const shouldBlock = config?.blockOnDebt ?? true; // Default true if not set
        const blockMode = config?.blockMode || 'strict';

        if (formData.pelangganId && shouldBlock) {
            const debts = penjualan.filter(p =>
                p.pelangganId === formData.pelangganId &&
                p.metodePembayaran === 'tempo' &&
                p.status === 'lunas' &&
                (p.isLunas === false || ((p.bayar || 0) < p.total))
            );

            // Logic:
            // Strict: Block if ANY debt exists.
            // Limit Only: Do NOT block here (allow multi-invoice). Limit check happens at payment.
            if (debts.length > 0 && blockMode === 'strict') {
                setUnpaidDebts(debts);
                setShowDebtDialog(true);
            } else {
                setUnpaidDebts([]);
                setShowDebtDialog(false);
            }
        } else {
            // Reset if customer changes or blocking disabled
            setUnpaidDebts([]);
            setShowDebtDialog(false);
        }
    }, [formData.pelangganId, penjualan, profilPerusahaan.config]);

    useEffect(() => {
        const pid = searchParams.get('pelangganId');
        if (pid) {
            setFormData(prev => ({ ...prev, pelangganId: pid }));
        }

        // Auto-capture GPS
        const captureLocation = async () => {
            setLoadingLoc(true);
            try {
                const loc = await getCurrentLocation();
                setLocation({
                    ...loc,
                    alamat: loc.alamat || ''
                });
            } catch (error) {
                console.error("GPS Error", error);
                toast.error("Gagal mengambil lokasi GPS. Pastikan GPS aktif.");
            } finally {
                setLoadingLoc(false);
            }
        };
        captureLocation();
    }, [searchParams]);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isDraftConfirmOpen, setIsDraftConfirmOpen] = useState(false);
    const [stockWarnings, setStockWarnings] = useState<string[]>([]);
    const [showDoubleTxWarning, setShowDoubleTxWarning] = useState(false);

    // Automating Promo Removal on Insufficient Stock
    const [showPromoDropWarning, setShowPromoDropWarning] = useState(false);
    const [droppedPromoNames, setDroppedPromoNames] = useState<string[]>([]);
    const [pendingDroppedPromos, setPendingDroppedPromos] = useState<Set<string>>(new Set());

    const isClosed = useMemo(() => {
        const config = profilPerusahaan?.config;
        if (!config?.enableClosing || !config?.closingStartTime || !config?.closingEndTime) return false;

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        const [startH, startM] = config.closingStartTime.split(':').map(Number);
        const [endH, endM] = config.closingEndTime.split(':').map(Number);

        const startTime = startH * 60 + startM;
        const endTime = endH * 60 + endM;

        if (startTime > endTime) {
            // Overnight window (e.g., 21:00 to 08:00)
            return currentTime >= startTime || currentTime < endTime;
        } else {
            // Same day window (e.g., 08:00 to 20:00)
            return currentTime >= startTime && currentTime < endTime;
        }
    }, [profilPerusahaan?.config]);

    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCustomerOpen, setIsCustomerOpen] = useState(false);
    const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingQtyIdx, setEditingQtyIdx] = useState<number | null>(null);
    const [lastClick, setLastClick] = useState<{ idx: number; time: number }>({ idx: -1, time: 0 });

    const groupedCart = useMemo(() => {
        const groups: Record<string, {
            product?: Barang;
            items: { item: CartItem; idx: number }[];
            bonuses: CartItem[];
            availablePromos?: { id: string; nama: string; tipe: string; nilai: number; bonusProdukIds?: string[]; isBest?: boolean }[];
            selectedPromoId?: string;
        }> = {};

        cart.forEach((item, idx) => {
            if (item.isBonus) {
                const lastMain = cart.slice(0, idx).reverse().find(c => !c.isBonus);
                if (lastMain) {
                    if (!groups[lastMain.barangId]) groups[lastMain.barangId] = { items: [], bonuses: [] };
                    groups[lastMain.barangId].bonuses.push(item);
                }
            } else {
                if (!groups[item.barangId]) {
                    groups[item.barangId] = {
                        product: barang.find(b => b.id === item.barangId),
                        items: [],
                        bonuses: [],
                        availablePromos: item.availablePromos,
                        selectedPromoId: item.selectedPromoId
                    };
                }
                groups[item.barangId].items.push({ item, idx });
            }
        });

        return Object.entries(groups).map(([barangId, data]) => ({
            barangId,
            ...data
        }));
    }, [cart, barang]);

    const handleNewCustomerSuccess = (newId: string) => {
        setFormData(prev => ({ ...prev, pelangganId: newId }));
        setIsAddCustomerOpen(false);
        setIsCustomerOpen(false);
        setSearchTerm(''); // Clear search term
        toast.success('Pelanggan baru dipilih');
    };

    const resolveSatuan = (id?: string) => {
        if (!id) return null;
        return satuan.find(s => s.id === id);
    };

    const getUserStock = (barangId: string) => {
        if (!user?.id) return 0;
        // Fix: Ignore PENDING_BONUS checks
        if (barangId === 'PENDING_BONUS') return Infinity;

        const stockEntry = stokPengguna.find(s => s.userId === user.id && s.barangId === barangId);
        return stockEntry ? stockEntry.jumlah : 0;
    };




    /* New: Product Search & Add Logic */
    const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);

    // Payment States
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState<'tunai' | 'transfer'>('tunai');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const resolveItemDetails = (item: CartItem, currentCart: CartItem[], perNotaQuantities?: Map<string, number>): CartItem => {
        const totalMixMatchQty = currentCart
            .filter(c => !c.isBonus)
            .reduce((sum, c) => sum + (c.jumlah * (c.konversi || 1)), 0);

        const totalProductQtyBase = currentCart
            .filter(c => !c.isBonus && c.barangId === item.barangId)
            .reduce((sum, c) => sum + (c.jumlah * (c.konversi || 1)), 0);

        // Get Price & Tier Info
        const priceResult = getPriceDetailed(item.barangId, item.satuanId, item.jumlah, item.konversi, formData.pelangganId, totalMixMatchQty, totalProductQtyBase);
        item.harga = priceResult.price;
        item.hargaTier = priceResult.tier; // Snapshot applied tier
        item.totalQty = item.jumlah * (item.konversi || 1); // Calculate Total Qty

        const promoData = getPromo(item.barangId, item.harga, item.jumlah, item.konversi, totalProductQtyBase, item.selectedPromoId, perNotaQuantities);
        item.diskon = promoData.discount;
        item.availablePromos = promoData.availablePromos;
        item.promoId = promoData.appliedPromoId; // Track which promo is currently active
        // Note: we don't necessarily overwrite selectedPromoId here, but we could track applied

        return item;
    };

    const syncCart = (rawCart: CartItem[]) => {
        const manualItems = rawCart.filter(c => !c.isBonus && c.jumlah > 0);

        // Pre-calculate Per-Nota Quantities
        const perNotaQuantities = new Map<string, number>();
        const activePerNotaPromos = promo?.filter(p => {
            const isActive = p.aktif ?? p.isActive;
            // Date checks
            const now = new Date();
            const start = new Date((p as any).berlakuMulai || (p as any).berlaku_mulai || p.tanggalMulai);
            const end = ((p as any).berlakuSampai || (p as any).berlaku_sampai || p.tanggalBerakhir) ? new Date(((p as any).berlakuSampai || (p as any).berlaku_sampai || p.tanggalBerakhir)) : null;

            if (!isActive) return false;
            if (isNaN(start.getTime())) return false;
            if (start > now || (end && end < now)) return false;
            if (p.cabangId && p.cabangId !== user?.cabangId) return false;

            return (p as any).metodeKelipatan === 'per_nota' || p.metodeKelipatan === 'per_nota';
        }) || [];

        activePerNotaPromos.forEach(p => {
            const eligibleQty = manualItems.reduce((sum, item) => {
                if (p.scope === 'selected_products' && p.targetProdukIds && !p.targetProdukIds.includes(item.barangId)) return sum;
                // Add qty
                return sum + (item.jumlah * (item.konversi || 1));
            }, 0);
            perNotaQuantities.set(p.id, eligibleQty);
        });

        // 1. Recalculate Prices & Discounts for Manual Items
        const updatedManualItems = manualItems.map(item => {
            return resolveItemDetails({ ...item }, manualItems, perNotaQuantities);
        });

        const fullCart: CartItem[] = [];
        const bonusProcessed = new Set<string>(); // Process bonus per unique Product ID source (for per_item)
        const bonusPromoProcessed = new Set<string>(); // Process bonus per unique Promo ID (for per_nota)

        // 2. Add Manual Items First
        updatedManualItems.forEach(item => fullCart.push(item));

        // 3. Process Bonus Logic
        updatedManualItems.forEach(item => {
            const totalProductQtyBase = updatedManualItems
                .filter(c => c.barangId === item.barangId)
                .reduce((sum, c) => sum + (c.jumlah * (c.konversi || 1)), 0);

            const promoData = getPromo(item.barangId, item.harga, 1, 1, totalProductQtyBase, item.selectedPromoId, perNotaQuantities);

            if (promoData.bonus) {
                // Determine if this is a per_nota promo
                const isPerNota = promoData.availablePromos.find(p => p.id === promoData.bonus!.promoId)?.metodeKelipatan === 'per_nota';

                let shouldProcess = false;
                if (isPerNota) {
                    if (!bonusPromoProcessed.has(promoData.bonus.promoId)) {
                        bonusPromoProcessed.add(promoData.bonus.promoId);
                        shouldProcess = true;
                    }
                } else {
                    if (!bonusProcessed.has(item.barangId)) {
                        bonusProcessed.add(item.barangId);
                        shouldProcess = true;
                    }
                }

                if (shouldProcess) {
                    const { productIds, qty: targetQty, mechanism, promoId } = promoData.bonus;

                    if (mechanism === 'random') {
                        // AUTO: Pick first available
                        const candidateId = productIds.find(pid => getUserStock(pid) > 0) || productIds[0];
                        const bonusProduct = barang.find(b => b.id === candidateId);
                        if (bonusProduct) {
                            fullCart.push({
                                barangId: candidateId,
                                jumlah: targetQty,
                                satuanId: bonusProduct.satuanId,
                                harga: 0,
                                diskon: 0,
                                maxStok: getUserStock(candidateId),
                                konversi: 1,
                                isBonus: true,
                                promoId: promoId
                            });
                        }
                    } else {
                        // SINGLE or MIX: Check if user already picked bonuses
                        // We look for existing items in rawCart that are bonus=true AND have matching promoId (if we tracked it)
                        // Since we didn't track promoId before, we rely on implicit logic: 
                        // Items in rawCart that are isBonus are preserved if they match criteria.

                        const existingBonuses = rawCart.filter(c => c.isBonus && c.promoId === promoId);
                        const pickedQty = existingBonuses.reduce((sum, c) => sum + (c.jumlah * (c.konversi || 1)), 0);

                        // A. Add preserved valid selections
                        existingBonuses.forEach(b => {
                            // Validate if this product is still in options list? Optional but good.
                            if (productIds.includes(b.barangId)) {
                                fullCart.push({
                                    ...b,
                                    // Recalc max stock just in case
                                    maxStok: getUserStock(b.barangId)
                                });
                            }
                        });

                        // B. If deficit, add "Pending Bonus" placeholder
                        const deficit = targetQty - pickedQty;
                        if (deficit > 0) {
                            fullCart.push({
                                barangId: 'PENDING_BONUS', // Special marker
                                jumlah: deficit,
                                harga: 0,
                                diskon: 0,
                                maxStok: 9999,
                                konversi: 1,
                                isBonus: true,
                                promoId: promoId,
                                pendingBonus: {
                                    options: productIds,
                                    mechanism: mechanism, // 'single' or 'mix'
                                    maxQty: deficit // Only allow picking what's left
                                }
                            });
                        } else if (deficit < 0) {
                            // If surplus (user reduced purchase), we might need to TRIM the bonuses
                            // Simple strategy: The "deficit < 0" means picked > target.
                            // We just let the list rebuild. Assuming rawCart filter above took them all.
                            // Actually, we should slice the preserved bonuses if they exceed target.
                            // For now, let's just warn or let it be? Ideally trim.
                            // Implementing Trim:
                            // Re-loop existingBonuses and trim/exclude last ones until fit.
                            // (Skipping for brevity, assuming standard flow).
                        }
                    }
                }
                bonusProcessed.add(item.barangId);
            }
        });

        return fullCart;
    };

    const updateProductPromo = (barangId: string, promoId: string) => {
        setCart(prev => {
            const nextRaw = prev.map(item => {
                if (item.barangId === barangId && !item.isBonus) {
                    return { ...item, selectedPromoId: promoId === 'AUTO' ? undefined : promoId };
                }
                return item;
            });
            return syncCart(nextRaw);
        });
    };

    const [bonusDialogState, setBonusDialogState] = useState<{
        open: boolean;
        promoId?: string;
        mechanism?: 'single' | 'mix';
        options?: string[];
        maxQty?: number;
        currentPicks?: Record<string, number>; // itemId -> qty
    }>({ open: false });

    const openBonusDialog = (item: CartItem) => {
        if (!item.pendingBonus) return;
        // If MIX, we need to know what's already picked?
        // Actually pending item represents the DEFICIT. 
        // But user should see full context. 
        // Simplified: Just show selector for remaining necessary amount? 
        // Or show full slate and let them adjust (harder to sync).
        // Let's just allow picking the 'deficit' amount.

        setBonusDialogState({
            open: true,
            promoId: item.promoId,
            mechanism: item.pendingBonus.mechanism,
            options: item.pendingBonus.options,
            maxQty: item.jumlah, // The amount pending IS the max allowed to pick here
            currentPicks: {}
        });
    };

    const saveBonusSelection = () => {
        const { currentPicks, options, maxQty, promoId } = bonusDialogState;
        if (!currentPicks || !options) return;

        const newBonusItems: CartItem[] = [];
        Object.entries(currentPicks).forEach(([pid, qty]) => {
            if (qty > 0) {
                const product = barang.find(b => b.id === pid);
                if (product) {
                    newBonusItems.push({
                        barangId: pid,
                        jumlah: qty,
                        satuanId: product.satuanId,
                        harga: 0,
                        diskon: 0,
                        maxStok: getUserStock(pid),
                        konversi: 1,
                        isBonus: true,
                        promoId: promoId
                    });
                }
            }
        });

        // Add to cart. note: pending item will be auto-removed by syncCart as it's replaced by these concrete ones
        // We assume syncCart will see these new items and count them towards the quota.
        setCart(prev => syncCart([...prev, ...newBonusItems]));
        setBonusDialogState({ open: false });
    };



    const addProductToCart = (product: Barang, targetUnitId?: string) => {
        const userStock = getUserStock(product.id);

        const newItem: CartItem = {
            barangId: product.id,
            satuanId: targetUnitId || product.satuanId,
            jumlah: 1,
            harga: 0,
            diskon: 0,
            maxStok: userStock,
            konversi: 1,
            isBonus: false
        };

        if (targetUnitId && targetUnitId !== product.satuanId && product.multiSatuan) {
            const multi = product.multiSatuan.find(m => m.satuanId === targetUnitId);
            if (multi) newItem.konversi = multi.konversi;
        }

        setCart(prev => syncCart([...prev, newItem]));
        setIsProductSearchOpen(false);
        toast.success('Produk ditambahkan');
    };

    const removeItem = (index: number) => {
        const newCart = cart.filter((_, i) => i !== index);
        setCart(syncCart(newCart));
    };

    const updateItem = (index: number, field: keyof CartItem, value: string | number) => {
        const newCart = [...cart];
        newCart[index] = { ...newCart[index] };
        const currentItem = newCart[index];

        if (field === 'jumlah') {
            const newQty = Number(value);
            const currentMaxInUnit = Math.floor(currentItem.maxStok / (currentItem.konversi || 1));
            const validQty = newQty > currentMaxInUnit ? currentMaxInUnit : (newQty < 0 ? 0 : newQty);
            if (newQty > currentMaxInUnit) toast.error(`Maksimal stok: ${currentMaxInUnit}`);
            newCart[index].jumlah = validQty;
        } else if (field === 'satuanId') {
            const product = barang.find(b => b.id === currentItem.barangId);
            let newConv = 1;
            if (product && product.multiSatuan) {
                const multi = product.multiSatuan.find(m => m.satuanId === value);
                if (multi) newConv = multi.konversi;
                else if (value === product.satuanId) newConv = 1;
            }

            newCart[index].satuanId = value as string;
            newCart[index].konversi = newConv;

            const maxInNewUnit = Math.floor(currentItem.maxStok / newConv);
            if (currentItem.jumlah > maxInNewUnit) {
                newCart[index].jumlah = maxInNewUnit;
                toast.info('Qty disesuaikan dengan satuan baru');
            }
        } else {
            // @ts-expect-error dynamic access
            newCart[index][field] = value;
        }

        setCart(syncCart(newCart));
    };


    const calculateGrossUnit = (item: CartItem) => item.harga * item.jumlah;

    const calculateGross = () => {
        return cart.reduce((sum, item) => sum + calculateGrossUnit(item), 0);
    };

    const calculateTotalDiscount = () => {
        return cart.reduce((sum, item) => sum + (item.diskon || 0), 0);
    };

    const calculateTotal = () => {
        return calculateGross() - calculateTotalDiscount();
    };

    const handleConfirm = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.pelangganId || cart.length === 0) {
            toast.error('Pilih pelanggan dan minimal 1 produk');
            return;
        }

        const total = calculateTotal();
        if (total <= 0) {
            toast.error('Total transaksi tidak boleh 0');
            return;
        }

        // Check if any product in cart has 0 quantity (non-bonus)
        const zeroQtyItems = cart.filter(item => !item.isBonus && item.jumlah <= 0);
        if (zeroQtyItems.length > 0) {
            toast.error('Ada barang dengan jumlah 0. Silakan isi jumlah atau hapus barang tersebut.');
            return;
        }

        if (!user?.cabangId) {
            toast.error('Data user tidak valid: Cabang tidak ditemukan');
            return;
        }

        // GPS Validation
        if (location.latitude === 0 || location.longitude === 0) {
            toast.error('Lokasi (GPS) wajib aktif untuk melakukan transaksi');
            return;
        }

        // Final Validation (Check total pieces vs stock)
        // Group check by Product ID, separating normal cart usages and bonus usages.
        const regularUsage = new Map<string, number>();
        const bonusUsage = new Map<string, { qty: number; originPromos: Set<string> }>();

        cart.filter(c => c.barangId !== 'PENDING_BONUS').forEach(c => {
            if (c.barangId) {
                const qtyInBaseUnit = c.jumlah * c.konversi;
                if (c.isBonus) {
                    const current = bonusUsage.get(c.barangId) || { qty: 0, originPromos: new Set() };
                    current.qty += qtyInBaseUnit;
                    if (c.promoId) current.originPromos.add(c.promoId);
                    bonusUsage.set(c.barangId, current);
                } else {
                    const current = regularUsage.get(c.barangId) || 0;
                    regularUsage.set(c.barangId, current + qtyInBaseUnit);
                }
            }
        });

        const invalidItems: string[] = [];
        const promosToDropNames: string[] = [];
        const promosToDropIds = new Set<string>();

        // 1. Verify regular items (strictly block if out of stock, or allow warnings based on existing flow)
        regularUsage.forEach((totalQty, barangId) => {
            const stock = getUserStock(barangId);
            if (totalQty > stock) {
                const product = barang.find(b => b.id === barangId);
                invalidItems.push(`${product?.nama || 'Unknown'} (Reguler Sisa: ${(stock - totalQty).toLocaleString('id-ID')})`);
            }
        });

        // 2. Verify bonus items separately. If they exceed remaining stock AFTER regular items are served, drop the promo.
        bonusUsage.forEach((usageInfo, barangId) => {
            const stock = getUserStock(barangId);
            const regularUsed = regularUsage.get(barangId) || 0;
            const remainingForBonus = stock - regularUsed;

            if (usageInfo.qty > remainingForBonus) {
                // Not enough stock for bonus. Identify which promos caused this.
                usageInfo.originPromos.forEach(pId => {
                    promosToDropIds.add(pId);
                    const p = promo.find(pr => pr.id === pId);
                    if (p && !promosToDropNames.includes(p.nama)) {
                        promosToDropNames.push(p.nama);
                    }
                });
            }
        });

        if (promosToDropIds.size > 0) {
            setPendingDroppedPromos(promosToDropIds);
            setDroppedPromoNames(promosToDropNames);
            setShowPromoDropWarning(true);
            return; // Stop here, wait for user confirmation to drop promos
        }

        // Credit Limit Validation
        // Credit Limit Validation
        // Logic: Will be checked in Payment Dialog effectively if they pay less.
        // But we sort of need to know upfront? 
        // Let's defer this to Payment Dialog where we define the DEBT amount.
        /* 
        if (formData.metodePembayaran === 'kredit') {
            const currentTotal = calculateTotal();
            const futureDebt = customerDebt + currentTotal;
            
            if (futureDebt > creditLimit) {
                toast.error(`Limit Kredit Terlampaui! Sisa limit: ${formatRupiah(remainingCredit > 0 ? remainingCredit : 0)}`);
                return; // Block transaction
            }
        }
        */

        // Same-Day Transaction Warning
        const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const txDateStr = formData.tanggal ? new Date(formData.tanggal).toISOString().split('T')[0] : todayStr;

        // Only check if dates match (User performs TRX on specific Date)
        // Find existing sales for this customer on this date
        const sameDayTx = penjualan.find(p =>
            p.pelangganId === formData.pelangganId &&
            p.status !== 'batal' &&
            new Date(p.tanggal).toISOString().split('T')[0] === txDateStr
        );

        if (sameDayTx) {
            setShowDoubleTxWarning(true);
            return; // Stop here, wait for confirmation
        }

        // Proceed if no warning
        continueTransaction(invalidItems);
    };

    const confirmDropPromos = () => {
        // Strip out the promos that are pending to be dropped
        const updatedCart = cart.map(item => {
            if (!item.isBonus && item.promoId && pendingDroppedPromos.has(item.promoId)) {
                return { ...item, selectedPromoId: 'NONE' };
            }
            return item;
        });

        // Let state update trigger syncCart, or sync it right now so we don't have to wait for next render
        const newSyncedCart = syncCart(updatedCart);
        setCart(newSyncedCart);

        // Clean up warnings
        setShowPromoDropWarning(false);
        setPendingDroppedPromos(new Set());
        setDroppedPromoNames([]);

        // Unfortunately, if we call continueTransaction immediately, it might still see the old cart state in some ways unless we pass explicit stock issues.
        // We can just call handleConfirm again to re-evaluate the new cart. Better to just invoke it by simulating the click or extracting the logic.
        // Since we know we stripped the promos, we can just let it render, OR we can recalculate invalid items and continue.
        // To be safe and reuse logic, let's recalculate productUsage here.

        const productUsage = new Map<string, number>();
        newSyncedCart.filter(c => c.barangId !== 'PENDING_BONUS').forEach(c => {
            if (c.barangId) {
                const current = productUsage.get(c.barangId) || 0;
                productUsage.set(c.barangId, current + (c.jumlah * c.konversi));
            }
        });

        const invalidItems: string[] = [];
        productUsage.forEach((totalQty, barangId) => {
            const stock = getUserStock(barangId);
            if (totalQty > stock) {
                const product = barang.find(b => b.id === barangId);
                invalidItems.push(`${product?.nama || 'Unknown'} (Sisa: ${(stock - totalQty).toLocaleString('id-ID')})`);
            }
        });

        continueTransaction(invalidItems);
    };

    const continueTransaction = async (stockIssues: string[]) => {
        setStockWarnings(stockIssues);
        if (stockIssues.length > 0) {
            toast.warning('Peringatan: Beberapa barang melebihi stok');
        }

        if (!isTransactionConfirmed) {
            setIsDraftConfirmOpen(true);
        } else {
            setIsPaymentDialogOpen(true);
        }
    };







    const [isTransactionConfirmed, setIsTransactionConfirmed] = useState(false);

    const processTransaction = async (overridePayment?: number | React.MouseEvent) => {
        setIsProcessing(true);
        const total = calculateTotal();
        const currentPayment = typeof overridePayment === 'number' ? overridePayment : paymentAmount;

        // Date Validation
        const selectedDate = formData.tanggal ? new Date(formData.tanggal) : new Date();

        // Normalize to midnight for comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(selectedDate);
        targetDate.setHours(0, 0, 0, 0);

        const isBackDate = targetDate < today;
        const isFutureDate = targetDate > today;

        // Determine forced Draft status
        let finalStatus: 'lunas' | 'draft' = isTransactionConfirmed ? 'lunas' : 'draft';
        if (isBackDate || isFutureDate) {
            finalStatus = 'draft';
        }

        // Status Logic
        const isLunas = currentPayment >= total;
        const finalMetodePembayaran: 'tunai' | 'tempo' = isLunas ? 'tunai' : 'tempo';

        // Credit Limit Check (Strict)
        if (!isLunas && finalStatus !== 'draft') {
            const debtAmount = total - currentPayment;
            const availableLimit = selectedCustomer?.limitKredit || 0;

            if (debtAmount > availableLimit) {
                toast.error(`Limit Kredit Terlampaui! Maksimal hutang tambahan: ${formatRupiah(availableLimit)}`);
                setIsProcessing(false);
                return;
            }
        }

        const kembalianValue = Math.max(0, currentPayment - total);
        const netReceived = currentPayment - kembalianValue;

        const newPenjualanId = crypto.randomUUID();

        // Generate sequential invoice number for same customer on same day
        const dateStr = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const sameCustomerSameDayCount = penjualan.filter(p => {
            const pDateStr = new Date(p.tanggal).toISOString().split('T')[0];
            return p.pelangganId === formData.pelangganId && pDateStr === dateStr;
        }).length;
        const sequenceNumber = sameCustomerSameDayCount + 1;
        const invoiceNumber = `INV/${Date.now().toString().slice(-6)}-${sequenceNumber}`;

        const newPenjualan = {
            id: newPenjualanId,
            nomorNota: invoiceNumber,
            tanggal: selectedDate,
            pelangganId: formData.pelangganId,
            salesId: user?.id || 'sales-1',
            cabangId: user.cabangId,
            items: cart.filter(c => c.barangId !== 'PENDING_BONUS').map(c => ({
                id: crypto.randomUUID(),
                barangId: c.barangId,
                jumlah: c.jumlah,
                satuanId: c.satuanId,
                konversi: c.konversi,
                harga: c.harga,
                diskon: c.diskon,
                subtotal: c.harga * c.jumlah - c.diskon,
                promoId: c.promoId,
                isBonus: c.isBonus
            })),
            subtotal: calculateGross(),
            diskon: calculateTotalDiscount(),
            total: total,
            metodePembayaran: finalMetodePembayaran,
            status: finalStatus,
            isLunas: isLunas,
            tanggalPelunasan: isLunas ? new Date() : null, // Set date if paid
            lokasi: location,
            catatan: formData.catatan,
            createdAt: new Date(),
            createdBy: user?.id || 'system',
            updatedAt: new Date(),
            updatedBy: user?.id || 'system',
            bayar: currentPayment,
            kembalian: kembalianValue
        };

        try {
            await addPenjualan(newPenjualan);

            // Record Initial Payment (If Amount > 0)
            if (currentPayment > 0) {
                const { error: payError } = await supabase
                    .from('pembayaran_penjualan')
                    .insert({
                        penjualan_id: newPenjualanId,
                        jumlah: netReceived, // Only record the actual revenue in total paid
                        bayar: currentPayment, // Raw cash received
                        kembalian: kembalianValue,
                        metode_pembayaran: 'tunai', // Default to 'tunai' since selector removed (transfer/cash merged or just cash)
                        lokasi: location, // Reuse location
                        created_by: user?.id, // Explicitly attribute to cashier/salesman
                    });
                if (payError) console.error("Failed to record initial payment", payError);
            }

            // Update Customer Limit (Decrease Limit, Increase Sisa/Debt) if Credit Sale
            if (finalMetodePembayaran === 'tempo' && finalStatus === 'lunas' && formData.pelangganId) {
                const debtAmount = newPenjualan.total - Math.max(0, netReceived);

                try {
                    const { data: custData } = await supabase
                        .from('pelanggan')
                        .select('sisa_kredit, limit_kredit')
                        .eq('id', formData.pelangganId)
                        .single();

                    if (custData) {
                        const currentLimit = custData.limit_kredit || 0;
                        const currentDebt = custData.sisa_kredit || 0;

                        // New Logic: Limit decreases (Available), Sisa increases (Debt)
                        const newDebt = currentDebt + debtAmount;

                        let newLimit = 0;
                        const useGlobal = profilPerusahaan?.config?.useGlobalLimit;
                        const globalMax = profilPerusahaan?.config?.globalLimitAmount || 0;

                        if (useGlobal) {
                            // Available = GlobalMax - TotalDebt
                            newLimit = globalMax - newDebt;
                        } else {
                            // Standard: Available decreases by debtAmount
                            newLimit = currentLimit - debtAmount;
                        }

                        await supabase
                            .from('pelanggan')
                            .update({
                                sisa_kredit: newDebt,
                                limit_kredit: newLimit
                            })
                            .eq('id', formData.pelangganId);
                    }
                } catch (err) {
                    console.error("Failed to update customer debt", err);
                }
            }

            // Handle Backdate Approval
            if (isBackDate && isTransactionConfirmed) {
                await addPersetujuan({
                    jenis: 'penjualan',
                    referensiId: newPenjualan.id,
                    status: 'pending',
                    diajukanOleh: user?.id || '',
                    targetRole: 'admin',
                    tanggalPengajuan: new Date(),
                    catatan: 'Transaksi Tanggal Mundur (Backdate)',
                    data: {
                        nomorNota: newPenjualan.nomorNota,
                        tanggal: newPenjualan.tanggal
                    }
                });
                toast.info('Transaksi Backdate disimpan sebagai Draft & Menunggu Persetujuan Admin.');
            }
            else if (isFutureDate) {
                toast.info('Transaksi Masa Depan disimpan sebagai Draft.');
            }
            if (!isBackDate && !isFutureDate) {
                if (finalStatus === 'lunas') {
                    if ((paymentMethod === 'tunai' || paymentAmount > 0) && user?.id) {
                        try {
                            if (paymentMethod === 'tunai') {
                                const existingSaldo = saldoPengguna.find(s => s.userId === user.id);
                                if (existingSaldo) {
                                    await updateSaldoPengguna(existingSaldo.id, { saldo: existingSaldo.saldo + netReceived });
                                } else {
                                    await addSaldoPengguna({ userId: user.id, saldo: netReceived });
                                }
                            }
                        } catch (err) {
                            console.error("Update saldo failed", err);
                        }
                    }
                } else {
                    toast.info('Transaksi disimpan sebagai DRAFT');
                }
            }

            setIsSuccess(true);
            setIsProcessing(false);

            if (finalStatus === 'draft') {
                navigate('/penjualan');
            } else {
                // Hold and Close
                setTimeout(() => {
                    setIsPaymentDialogOpen(false);
                    setIsConfirmOpen(false);
                    navigate('/penjualan');

                    // --- AUTO ATTENDANCE CHECK-IN ---
                    // If user hasn't checked in today, do it now.
                    if (user?.id) {
                        const todayStr = new Date().toDateString();
                        const hasCheckedIn = absensi.some(a =>
                            a.userId === user.id &&
                            new Date(a.tanggal).toDateString() === todayStr
                        );

                        if (!hasCheckedIn) {
                            try {
                                addAbsensi({
                                    userId: user.id,
                                    tanggal: new Date(),
                                    checkIn: new Date(),
                                    lokasiCheckIn: location,
                                    status: 'hadir',
                                    keterangan: 'Auto Check-in via Penjualan'
                                });
                                toast.success("Absensi: Otomatis Check-In Berhasil!");
                            } catch (err) {
                                console.error("Auto check-in failed", err);
                                // Optional: silent fail or toast warning?
                                // toast.warning("Gagal melakukan auto check-in");
                            }
                        }
                    }
                    // --------------------------------

                }, 3000);
            }

        } catch (error) {
            toast.error('Gagal menyimpan transaksi');
            console.error(error);
            setIsProcessing(false);
        }
    };

    const selectedCustomer = pelanggan.find(p => p.id === formData.pelangganId);

    // Calculate Debt and Limits
    const customerDebt = selectedCustomer?.sisaKredit || 0;

    // Plafon representing the total ceiling limit
    const plafonLimit = (profilPerusahaan.config?.useGlobalLimit && profilPerusahaan.config?.globalLimitAmount)
        ? profilPerusahaan.config.globalLimitAmount
        : ((selectedCustomer?.limitKredit || 0) + (selectedCustomer?.sisaKredit || 0));

    // Future debt from current transaction
    const currentSaleDebt = Math.max(0, calculateTotal() - paymentAmount);

    // Sisa representing the available limit after accounting for existing debt and current sale
    const remainingCreditAfterSale = (profilPerusahaan.config?.useGlobalLimit && profilPerusahaan.config?.globalLimitAmount)
        ? (profilPerusahaan.config.globalLimitAmount - customerDebt - currentSaleDebt)
        : (selectedCustomer?.limitKredit || 0) - currentSaleDebt;

    const isOverLimit = remainingCreditAfterSale < 0;

    return (
        <MainLayout title="Buat Penjualan">
            <div className="p-2 md:p-4 w-full mx-auto space-y-4">
                {/* Hidden but functional GPS */}
                <div className="hidden">
                    <Label>Lokasi Transaksi</Label>
                    <p>{location.latitude}, {location.longitude}</p>
                </div>

                <Button
                    variant="ghost"
                    onClick={() => navigate('/penjualan')}
                    className="pl-0"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Kembali
                </Button>

                <form onSubmit={handleConfirm} className="space-y-4">
                    <Card elevated>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5" />
                                Info Transaksi
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Debt Blocking Dialog */}
                            <AlertDialog open={showDebtDialog} onOpenChange={setShowDebtDialog}>
                                <AlertDialogContent className="max-w-md">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                                            <AlertTriangle className="w-5 h-5" />
                                            Pelanggan Masih Memiliki Piutang
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="text-left">
                                            <div className="mb-4">
                                                <span className="font-bold text-foreground">
                                                    {pelanggan.find(p => p.id === formData.pelangganId)?.nama}
                                                </span> memiliki {unpaidDebts.length} transaksi yang belum lunas.
                                                <br />Harap selesaikan pembayaran terlebih dahulu.
                                            </div>

                                            <div className="border rounded-md max-h-[300px] overflow-y-auto bg-muted/20">
                                                {unpaidDebts.map((debt, idx) => (
                                                    <div key={idx} className="flex justify-between items-center p-3 border-b last:border-0 hover:bg-muted/50 transition-colors">
                                                        <div className="space-y-1">
                                                            <p className="font-semibold text-xs text-foreground">{debt.nomorNota}</p>
                                                            <p className="text-[10px] text-muted-foreground">{new Date(debt.tanggal).toLocaleDateString('id-ID')}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-bold text-red-600 text-xs">
                                                                {formatRupiah(debt.total - (debt.bayar || 0))}
                                                            </p>
                                                            <Button
                                                                variant="link"
                                                                size="sm"
                                                                className="h-auto p-0 text-[10px] text-primary"
                                                                onClick={() => navigate(`/penjualan/${debt.id}`)}
                                                            >
                                                                Lihat Detail &rarr;
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => {
                                            setFormData(prev => ({ ...prev, pelangganId: '' }));
                                            setShowDebtDialog(false);
                                        }}>
                                            Batal & Ganti Pelanggan
                                        </AlertDialogCancel>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <div className="space-y-2">
                                <Label>Pelanggan (Cari nama/toko)</Label>
                                <Popover open={isCustomerOpen} onOpenChange={setIsCustomerOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={isCustomerOpen}
                                            className="w-full justify-between"
                                        >
                                            {formData.pelangganId
                                                ? pelanggan.find((p) => p.id === formData.pelangganId)?.nama
                                                : "Pilih Pelanggan..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="start">
                                        <Command>
                                            <CommandInput
                                                placeholder="Cari pelanggan..."
                                                value={searchTerm}
                                                onValueChange={setSearchTerm}
                                            />
                                            <CommandEmpty className="py-2 px-2 text-center text-sm">
                                                <p className="text-muted-foreground mb-2">Pelanggan tidak ditemukan.</p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full h-8"
                                                    onClick={() => setIsAddCustomerOpen(true)}
                                                >
                                                    <Plus className="w-3 h-3 mr-1" /> Buat Baru
                                                </Button>
                                            </CommandEmpty>
                                            <CommandGroup className="max-h-60 overflow-y-auto">
                                                {pelanggan
                                                    .filter(p => {
                                                        const isGlobal = user?.roles.includes('admin') || user?.roles.includes('owner');
                                                        // If Global, show all. If Sales/Staff, show only assigned customers.
                                                        return isGlobal || p.salesId === user?.id;
                                                    })
                                                    .map((p) => (
                                                        <CommandItem
                                                            key={p.id}
                                                            value={p.nama}
                                                            onSelect={() => {
                                                                setFormData(prev => ({ ...prev, pelangganId: p.id }));
                                                                setIsCustomerOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    formData.pelangganId === p.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span>{p.nama}</span>
                                                                <span className="text-xs text-muted-foreground">{p.alamat}</span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                            </CommandGroup>
                                        </Command>
                                    </PopoverContent>
                                </Popover>

                                {selectedCustomer && (selectedCustomer.limitKredit > 0 || selectedCustomer.sisaKredit > 0) && (
                                    <div className={cn("text-xs mt-1 px-1 flex flex-wrap gap-x-4 gap-y-1", isOverLimit ? "text-destructive font-bold" : "text-muted-foreground")}>
                                        <span>Plafon: {formatRupiah(plafonLimit)}</span>
                                        <span>Hutang: {formatRupiah(customerDebt)}</span>
                                        <span className={cn(isOverLimit && "underline")}>
                                            Sisa: {formatRupiah(remainingCreditAfterSale)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Tanggal Transaksi</Label>
                                <Input
                                    type="date"
                                    value={formData.tanggal}
                                    onChange={(e) => setFormData(prev => ({ ...prev, tanggal: e.target.value }))}
                                    onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                                    className="bg-background cursor-pointer"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Catatan (Opsional)</Label>
                                <Textarea
                                    placeholder="Tambahkan catatan transaksi..."
                                    value={formData.catatan}
                                    onChange={(e) => setFormData(prev => ({ ...prev, catatan: e.target.value }))}
                                    className="bg-background resize-none"
                                    rows={2}
                                />
                            </div>

                        </CardContent>
                    </Card>

                    <Card elevated>
                        <CardHeader className="flex flex-row items-center justify-between py-4">
                            <CardTitle className="text-base">Keranjang Belanja</CardTitle>
                            {formData.pelangganId && (
                                <Popover open={isProductSearchOpen} onOpenChange={setIsProductSearchOpen}>
                                    <PopoverTrigger asChild>
                                        <Button type="button" size="sm" variant="outline">
                                            <Plus className="w-4 h-4 mr-1" /> Tambah Produk
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="end">
                                        <Command>
                                            <CommandInput placeholder="Cari produk aktif..." />
                                            <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                                            <CommandGroup className="max-h-60 overflow-y-auto">
                                                {barang
                                                    .filter(b => {
                                                        const price = getPriceDetailed(b.id, b.satuanId, 1, 1, formData.pelangganId, 0).price;
                                                        return b.isActive && !cart.some(c => c.barangId === b.id) && price > 0;
                                                    })
                                                    .sort((a, b) => getUserStock(b.id) - getUserStock(a.id))
                                                    .map(b => {
                                                        const stock = getUserStock(b.id);
                                                        return (
                                                            <CommandItem key={b.id} value={b.nama} onSelect={() => addProductToCart(b)} disabled={stock <= 0}>
                                                                <div className="flex flex-col w-full">
                                                                    <div className="flex justify-between items-center">
                                                                        <span>{b.nama}</span>
                                                                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full", stock > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                                                                            {stock}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center mt-1">
                                                                        <span className="text-xs font-semibold text-primary">{formatRupiah(getPriceDetailed(b.id, b.satuanId, 1, 1, formData.pelangganId, 0).price)}</span>
                                                                        <span className="text-[10px] text-muted-foreground">{resolveSatuan(b.satuanId)?.nama}</span>
                                                                    </div>

                                                                </div>
                                                            </CommandItem>
                                                        )
                                                    })
                                                }
                                            </CommandGroup>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-4 p-4 pt-0">
                            {groupedCart.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                                    Belum ada barang dipilih
                                </div>
                            ) : (
                                groupedCart.map((group) => {
                                    const { barangId, product, items, bonuses, availablePromos, selectedPromoId } = group;
                                    const totalSubtotal = items.reduce((sum, r) => sum + (r.item.harga * r.item.jumlah - r.item.diskon), 0);
                                    const totalOrig = items.reduce((sum, r) => sum + (r.item.harga * r.item.jumlah), 0);
                                    const hasDiscount = totalOrig > totalSubtotal;

                                    const totalInCartBase = items.reduce((sum, r) => sum + (r.item.jumlah * (r.item.konversi || 1)), 0);
                                    const userStock = getUserStock(barangId);

                                    // Units that can still be added
                                    const activeUnitIds = new Set(items.filter(r => r.item.jumlah > 0).map(r => r.item.satuanId));
                                    const availableUnits = !product ? [] : [
                                        { id: product.satuanId, nama: resolveSatuan(product.satuanId)?.nama || 'Pcs', konversi: 1 },
                                        ...(product.multiSatuan || []).map(m => ({ id: m.satuanId, nama: resolveSatuan(m.satuanId)?.nama || 'Unit', konversi: m.konversi }))
                                    ].filter(u => !activeUnitIds.has(u.id) && (totalInCartBase + u.konversi <= userStock));

                                    return (
                                        <div key={barangId} className="border rounded-xl bg-card overflow-hidden shadow-sm">
                                            {/* Product Header */}
                                            <div className="p-3 border-b bg-muted/10 flex justify-between items-start">
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <span className="truncate font-bold text-base block leading-tight">
                                                        {product?.nama || 'Unknown Item'}
                                                    </span>
                                                    <div className="space-y-0.5 mt-2">
                                                        <div className="text-[11px] flex items-center gap-1 text-muted-foreground">
                                                            <span className="min-w-[40px]">Stok:</span>
                                                            <span className="font-bold text-foreground">{getUserStock(barangId).toLocaleString('id-ID')} {resolveSatuan(product?.satuanId || '')?.nama || 'Pcs'}</span>
                                                        </div>
                                                        <div className="text-[11px] flex items-center gap-1 text-muted-foreground">
                                                            <span className="min-w-[40px]">Harga:</span>
                                                            <span className="font-bold text-primary">
                                                                {formatRupiah(getPriceDetailed(barangId, product?.satuanId, 1, 1, formData.pelangganId, 0, items.reduce((sum, r) => sum + (r.item.jumlah * (r.item.konversi || 1)), 0)).price)}
                                                            </span>
                                                        </div>
                                                        {/* Promo Selection UI */}
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {availablePromos && availablePromos.length > 0 ? (
                                                                <div className="flex items-center gap-2">
                                                                    <Tag className="w-3.5 h-3.5 text-green-600" />
                                                                    <Select
                                                                        value={selectedPromoId || 'AUTO'}
                                                                        onValueChange={(val) => updateProductPromo(barangId, val)}
                                                                    >
                                                                        <SelectTrigger className="h-7 text-xs border-green-200 bg-green-50 text-green-700 min-w-[140px] gap-1 px-2 focus:ring-0 focus:ring-offset-0">
                                                                            <SelectValue placeholder="Pilih Promo" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="AUTO" className="text-xs">
                                                                                ? Otomatis (Terbaik)
                                                                            </SelectItem>
                                                                            <SelectItem value="NONE" className="text-xs text-muted-foreground">
                                                                                ?? Tanpa Promo
                                                                            </SelectItem>
                                                                            {availablePromos.map(p => {
                                                                                const bonusNames = p.tipe === 'produk' && p.bonusProdukIds
                                                                                    ? p.bonusProdukIds.map(bid => barang.find(b => b.id === bid)?.nama).filter(Boolean).join(', ')
                                                                                    : '';
                                                                                return (
                                                                                    <SelectItem key={p.id} value={p.id} className="text-xs">
                                                                                        {p.tipe === 'produk' ? '??' : '???'} {p.nama}
                                                                                        {bonusNames && <span className="text-muted-foreground ml-1">({bonusNames})</span>}
                                                                                        {p.isBest && <span className="ml-1 text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded">Best</span>}
                                                                                    </SelectItem>
                                                                                );
                                                                            })}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] text-muted-foreground italic">Tidak ada promo tersedia</span>
                                                            )}
                                                        </div>

                                                        {(() => {
                                                            const parts: string[] = [];

                                                            // 1. Total Bonuses
                                                            if (bonuses && bonuses.length > 0) {
                                                                const bGroups: Record<string, { name: string, qty: number, unit: string }> = {};
                                                                bonuses.forEach(b => {
                                                                    if (!bGroups[b.barangId]) {
                                                                        const bProd = barang.find(x => x.id === b.barangId);
                                                                        const bSat = resolveSatuan(bProd?.satuanId);
                                                                        bGroups[b.barangId] = {
                                                                            name: bProd?.nama || '',
                                                                            qty: 0,
                                                                            unit: bSat?.nama || ''
                                                                        };
                                                                    }
                                                                    bGroups[b.barangId].qty += b.jumlah;
                                                                });
                                                                Object.values(bGroups).forEach(g => {
                                                                    parts.push(`Free ${g.name} ${g.qty} ${g.unit}`);
                                                                });
                                                            }

                                                            // 2. Total Nominal Discount
                                                            const totalDiscount = items.reduce((sum, r) => sum + r.item.diskon, 0);
                                                            if (totalDiscount > 0) {
                                                                parts.push(`Pot. -${formatRupiah(totalDiscount)}`);
                                                            }

                                                            if (parts.length === 0) return null;

                                                            return (
                                                                <div className="text-[11px] flex items-center gap-1 text-muted-foreground">
                                                                    <span className="min-w-[40px]">Promo:</span>
                                                                    <span className="font-bold text-green-600 line-clamp-1">
                                                                        {parts.join(' + ')}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                                <div className="text-right flex flex-col items-end">
                                                    <p className="font-bold text-base text-primary">
                                                        {formatRupiah(totalSubtotal)}
                                                    </p>
                                                    {hasDiscount && (
                                                        <p className="text-[10px] text-muted-foreground line-through decoration-muted-foreground/50">
                                                            {formatRupiah(totalOrig)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Unit Rows */}
                                            <div className="p-3 space-y-3">
                                                {items.filter(r => r.item.jumlah > 0).map((row) => {
                                                    const rowSatuan = resolveSatuan(row.item.satuanId);
                                                    return (
                                                        <div key={row.idx} className="flex items-center justify-between group">
                                                            <div className="flex items-center gap-2">
                                                                {(() => {
                                                                    const allUnits = !product ? [] : [
                                                                        { id: product.satuanId, nama: resolveSatuan(product.satuanId)?.nama || 'Pcs', konversi: 1 },
                                                                        ...(product.multiSatuan || []).map(m => ({ id: m.satuanId, nama: resolveSatuan(m.satuanId)?.nama || 'Unit', konversi: m.konversi }))
                                                                    ];
                                                                    const otherAvailableUnits = allUnits.filter(u => {
                                                                        const isAlreadyUsed = activeUnitIds.has(u.id);
                                                                        if (isAlreadyUsed) return false;

                                                                        const currentBase = row.item.jumlah * (row.item.konversi || 1);
                                                                        const targetBase = row.item.jumlah * u.konversi;
                                                                        const netChange = targetBase - currentBase;

                                                                        // Check if total pieces after switch exceeds user stock
                                                                        return totalInCartBase + netChange <= userStock;
                                                                    });

                                                                    if (editingQtyIdx === row.idx) {
                                                                        return (
                                                                            <Input
                                                                                type="number"
                                                                                inputMode="decimal"
                                                                                autoFocus
                                                                                className="h-8 w-20 text-center font-bold"
                                                                                defaultValue={row.item.jumlah}
                                                                                onBlur={(e) => {
                                                                                    const newVal = parseFloat(e.target.value) || 0;
                                                                                    if (newVal === row.item.jumlah) {
                                                                                        setEditingQtyIdx(null);
                                                                                        return;
                                                                                    }

                                                                                    const currentBase = row.item.jumlah * (row.item.konversi || 1);
                                                                                    const targetBase = newVal * (row.item.konversi || 1);
                                                                                    const netChange = targetBase - currentBase;

                                                                                    if (totalInCartBase + netChange <= userStock) {
                                                                                        updateItem(row.idx, 'jumlah', newVal);
                                                                                        setEditingQtyIdx(null);
                                                                                    } else {
                                                                                        toast.error(`Stok tidak cukup! Maksimal ${Math.floor(userStock / (row.item.konversi || 1))} ${rowSatuan?.nama || ''}`);
                                                                                        e.target.value = row.item.jumlah.toString();
                                                                                        setEditingQtyIdx(null);
                                                                                    }
                                                                                }}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') {
                                                                                        (e.target as HTMLInputElement).blur();
                                                                                    } else if (e.key === 'Escape') {
                                                                                        setEditingQtyIdx(null);
                                                                                    }
                                                                                }}
                                                                            />
                                                                        );
                                                                    }

                                                                    const handleTap = (idx: number) => {
                                                                        const now = Date.now();
                                                                        if (lastClick.idx === idx && now - lastClick.time < 300) {
                                                                            // Double tap detected
                                                                            setEditingQtyIdx(idx);
                                                                            setLastClick({ idx: -1, time: 0 }); // Reset
                                                                        } else {
                                                                            setLastClick({ idx, time: now });
                                                                        }
                                                                    };

                                                                    if (otherAvailableUnits.length === 0) {
                                                                        return (
                                                                            <span
                                                                                className="text-sm font-bold min-w-[3rem] text-center bg-muted/30 px-2 py-1 rounded-md cursor-pointer select-none"
                                                                                onClick={() => handleTap(row.idx)}
                                                                                onDoubleClick={() => setEditingQtyIdx(row.idx)}
                                                                                title="Double-tap to edit quantity"
                                                                            >
                                                                                {row.item.jumlah} {rowSatuan?.nama}
                                                                            </span>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <Popover>
                                                                            <PopoverTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    className="h-auto py-1 px-2 font-bold bg-muted/30 hover:bg-muted/50 rounded-md transition-all flex items-center gap-1.5"
                                                                                    onClick={() => handleTap(row.idx)}
                                                                                    onDoubleClick={(e) => {
                                                                                        e.preventDefault();
                                                                                        e.stopPropagation();
                                                                                        setEditingQtyIdx(row.idx);
                                                                                    }}
                                                                                    title="Click to change unit, Double-tap to edit quantity"
                                                                                >
                                                                                    {row.item.jumlah} {rowSatuan?.nama}
                                                                                    <ChevronsUpDown className="w-3 h-3 text-muted-foreground" />
                                                                                </Button>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent className="w-48 p-2" align="start">
                                                                                <p className="text-[10px] font-semibold mb-2 px-2 text-muted-foreground uppercase tracking-wider">Ganti Satuan:</p>
                                                                                <div className="grid grid-cols-1 gap-1">
                                                                                    {otherAvailableUnits.map(u => (
                                                                                        <Button
                                                                                            key={u.id}
                                                                                            variant="ghost"
                                                                                            className="h-9 justify-start text-xs"
                                                                                            onClick={() => updateItem(row.idx, 'satuanId', u.id)}
                                                                                        >
                                                                                            {u.nama}
                                                                                        </Button>
                                                                                    ))}
                                                                                </div>
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                    );
                                                                })()}
                                                            </div>

                                                            {/* Pending Bonus UI */}
                                                            {row.item.barangId === 'PENDING_BONUS' && (
                                                                <div className="flex-1 px-4">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="w-full border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300 animate-pulse"
                                                                        onClick={() => openBonusDialog(row.item)}
                                                                    >
                                                                        ?? Klaim {row.item.jumlah} Bonus {row.item.pendingBonus?.mechanism === 'mix' ? '(Mix)' : ''}
                                                                    </Button>
                                                                </div>
                                                            )}

                                                            <div className={cn("flex items-center gap-1.5", row.item.barangId === 'PENDING_BONUS' && "hidden")}>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-8 w-8 rounded-full border-muted-foreground/20"
                                                                    onClick={() => updateItem(row.idx, 'jumlah', Math.max(0, row.item.jumlah - 1))}
                                                                >
                                                                    <Minus className="w-3.5 h-3.5" />
                                                                </Button>
                                                                {totalInCartBase + (row.item.konversi || 1) <= userStock ? (
                                                                    <Button
                                                                        type="button"
                                                                        variant="default"
                                                                        size="icon"
                                                                        className="h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-all active:scale-95"
                                                                        onClick={() => updateItem(row.idx, 'jumlah', row.item.jumlah + 1)}
                                                                    >
                                                                        <Plus className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                ) : (
                                                                    <div className="w-8 h-8" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}


                                                {/* Actions Footer: +Unit & Remove Product */}
                                                <div className="pt-2 flex items-center gap-2">
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant={availableUnits.length > 0 ? "outline" : "secondary"}
                                                                size="sm"
                                                                className={cn(
                                                                    "flex-1 h-9 border-dashed rounded-lg transition-all",
                                                                    availableUnits.length > 0 ? "border-green-500/50 text-green-600 hover:bg-green-50 hover:border-green-500" : "bg-muted/50 text-muted-foreground opacity-50 cursor-not-allowed"
                                                                )}
                                                                disabled={availableUnits.length === 0}
                                                            >
                                                                +Unit
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-56 p-2" align="center">
                                                            <p className="text-[10px] font-semibold mb-2 px-2 text-muted-foreground uppercase tracking-wider">Pilih Satuan:</p>
                                                            <div className="grid grid-cols-1 gap-1">
                                                                {(!product ? [] : [
                                                                    { id: product.satuanId, nama: resolveSatuan(product.satuanId)?.nama || 'Pcs', konversi: 1 },
                                                                    ...(product.multiSatuan || []).map(m => ({ id: m.satuanId, nama: resolveSatuan(m.satuanId)?.nama || 'Unit', konversi: m.konversi }))
                                                                ]).filter(u => {
                                                                    // We show all units but disable those that are already used OR lack stock
                                                                    return true;
                                                                }).map(u => {
                                                                    const isAlreadyUsed = activeUnitIds.has(u.id);
                                                                    const hasStock = totalInCartBase + u.konversi <= userStock;
                                                                    const isDisabled = isAlreadyUsed || !hasStock;

                                                                    return (
                                                                        <Button
                                                                            key={u.id}
                                                                            variant="ghost"
                                                                            disabled={isDisabled}
                                                                            className={cn(
                                                                                "h-9 justify-start text-xs",
                                                                                isDisabled && "opacity-30 cursor-not-allowed"
                                                                            )}
                                                                            onClick={() => {
                                                                                if (isDisabled) return;
                                                                                const existingRow = items.find(r => r.item.satuanId === u.id);
                                                                                if (existingRow) {
                                                                                    updateItem(existingRow.idx, 'jumlah', 1);
                                                                                } else {
                                                                                    addProductToCart(product, u.id);
                                                                                }
                                                                            }}
                                                                        >
                                                                            {isAlreadyUsed ? (
                                                                                <Check className="w-3.5 h-3.5 mr-2 text-green-600" />
                                                                            ) : !hasStock ? (
                                                                                <AlertTriangle className="w-3.5 h-3.5 mr-2 text-destructive" />
                                                                            ) : (
                                                                                <div className="w-3.5 h-3.5 mr-2" />
                                                                            )}
                                                                            <div className="flex flex-col items-start">
                                                                                <span>{u.nama}</span>
                                                                                {!hasStock && !isAlreadyUsed && <span className="text-[9px] text-destructive leading-tight font-medium">Stok tidak cukup</span>}
                                                                            </div>
                                                                        </Button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>

                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className={cn("h-9 w-9 text-muted-foreground hover:text-destructive hover:border-destructive rounded-lg transition-colors", !items.some(r => r.item.jumlah >= 10) && "hidden")}
                                                        onClick={() => {
                                                            setCart(prev => syncCart(prev.filter(c => c.barangId !== barangId)));
                                                        }}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </CardContent>
                        <CardFooter className="bg-primary/5 p-4 flex justify-between items-center rounded-b-lg">
                            <span className="font-semibold">Total Tagihan</span>
                            <span className="text-xl font-bold text-primary">{formatRupiah(calculateTotal())}</span>
                        </CardFooter>
                    </Card>

                    <div className="flex items-center space-x-2 bg-white p-3 rounded-lg border">
                        <div
                            className={cn(
                                "w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors",
                                isTransactionConfirmed ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                            )}
                            onClick={() => setIsTransactionConfirmed(!isTransactionConfirmed)}
                        >
                            {isTransactionConfirmed && <Check className="w-3 h-3" />}
                        </div>
                        <Label onClick={() => setIsTransactionConfirmed(!isTransactionConfirmed)} className="cursor-pointer">
                            Saya sudah cek rinciannya dan datanya sudah sesuai
                        </Label>
                    </div>

                    <Button type="submit" className="w-full text-lg h-12">
                        <Save className="w-5 h-5 mr-2" />
                        {isTransactionConfirmed ? 'Selesaikan Transaksi' : 'Simpan Sebagai Draft'}
                    </Button>
                </form>

                <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                    <AlertDialogContent className="max-w-md">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Konfirmasi Transaksi</AlertDialogTitle>
                            <AlertDialogDescription>
                                Pastikan data transaksi berikut sudah benar:
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        <div className="space-y-3 my-2 text-sm">
                            {stockWarnings.length > 0 && (
                                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-xs border border-destructive/20">
                                    <div className="flex items-center gap-2 font-bold mb-1">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span>Stok Tidak Cukup!</span>
                                    </div>
                                    <ul className="list-disc pl-4 space-y-0.5">
                                        {stockWarnings.map((w, i) => <li key={i}>{w}</li>)}
                                    </ul>
                                    <p className="mt-1 font-semibold">Stok akan menjadi minus jika dilanjutkan.</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 border-b pb-2">
                                <span className="text-muted-foreground">Pelanggan</span>
                                <span className="font-medium text-right">{selectedCustomer?.nama || '-'}</span>

                                <span className="text-muted-foreground">Tanggal</span>
                                <span className="font-medium text-right">{new Date(formData.tanggal).toLocaleDateString('id-ID')}</span>

                                <span className="text-muted-foreground">Pembayaran</span>
                                <span className="font-medium text-right capitalize">{paymentAmount >= calculateTotal() ? 'tunai' : 'tempo'}</span>
                            </div>

                            <div className="space-y-1 max-h-40 overflow-y-auto bg-muted/20 p-2 rounded">
                                <p className="text-xs font-semibold text-muted-foreground mb-2">Rincian Barang:</p>
                                {cart.map((item, idx) => {
                                    const product = barang.find(b => b.id === item.barangId);
                                    const unit = resolveSatuan(item.satuanId);
                                    return (
                                        <div key={idx} className="flex justify-between text-xs py-1 border-b last:border-0 border-dashed">
                                            <div>
                                                <span className={item.isBonus ? "text-purple-600 font-medium" : ""}>
                                                    {item.barangId === 'PENDING_BONUS' ? 'Pilih Bonus' : product?.nama} {item.isBonus && '(Bonus)'}
                                                </span>
                                                <div className="text-[10px] text-muted-foreground">
                                                    {item.jumlah} {unit?.nama} x {item.harga > 0 ? formatRupiah(item.harga) : 'Free'}
                                                </div>
                                            </div>
                                            <div className="font-mono">
                                                {formatRupiah(item.harga * item.jumlah - (item.diskon || 0))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="space-y-1 pt-2 border-t mt-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>{formatRupiah(calculateGross())}</span>
                                </div>
                                <div className="flex justify-between text-xs text-red-600">
                                    <span className="">Diskon</span>
                                    <span>-{formatRupiah(calculateTotalDiscount())}</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground text-right italic pb-1">
                                    *Barang bonus tidak menambah total tagihan
                                </div>
                                <div className="flex justify-between items-center pt-1 border-t border-muted-foreground/10">
                                    <span className="font-bold">Total Tagihan</span>
                                    <span className="font-bold text-lg text-primary">{formatRupiah(calculateTotal())}</span>
                                </div>
                            </div>
                        </div>

                        <AlertDialogFooter>
                            <Button
                                onClick={() => { setIsPaymentDialogOpen(true); setIsConfirmOpen(false); }}
                                className={cn(stockWarnings.length > 0 && "bg-destructive hover:bg-destructive/90")}
                            >
                                {stockWarnings.length > 0 ? 'Lanjut ke Pembayaran (Minus)' : 'Lanjut ke Pembayaran'}
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={isDraftConfirmOpen} onOpenChange={setIsDraftConfirmOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Konfirmasi Simpan Draft</AlertDialogTitle>
                            <AlertDialogDescription>
                                Apakah Anda yakin ingin menyimpan transaksi ini sebagai draft? Transaksi draft tidak akan tercatat di laporan sampai diselesaikan.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => { setIsDraftConfirmOpen(false); processTransaction(0); }}>
                                Ya, Simpan Draft
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Bonus Selection Dialog */}
                <Dialog open={bonusDialogState.open} onOpenChange={(open) => !open && setBonusDialogState({ open: false })}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Pilih Produk Bonus</DialogTitle>
                            <DialogDescription>
                                Anda berhak mendapatkan <b>{bonusDialogState.maxQty}</b> produk bonus. Silakan pilih di bawah ini.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-2 space-y-2 max-h-[300px] overflow-y-auto">
                            {bonusDialogState.options?.map(pid => {
                                const product = barang.find(b => b.id === pid);
                                const stock = getUserStock(pid);
                                const currentQty = bonusDialogState.currentPicks?.[pid] || 0;
                                const totalPicked = Object.values(bonusDialogState.currentPicks || {}).reduce((a, b) => a + b, 0);
                                const remainingQuota = (bonusDialogState.maxQty || 0) - totalPicked;

                                if (!product) return null;

                                return (
                                    <div key={pid} className={cn("p-3 border rounded-lg flex justify-between items-center", stock <= 0 ? "opacity-50 bg-muted" : "bg-card")}>
                                        <div>
                                            <p className="font-medium text-sm">{product.nama}</p>
                                            <p className="text-xs text-muted-foreground">Stok: {stock} {resolveSatuan(product.satuanId)?.nama}</p>
                                        </div>

                                        {stock <= 0 ? (
                                            <span className="text-xs text-destructive font-bold">Stok Habis</span>
                                        ) : bonusDialogState.mechanism === 'single' ? (
                                            <Button
                                                size="sm"
                                                variant={currentQty > 0 ? "default" : "outline"}
                                                onClick={() => {
                                                    // Toggle: If single, clicking implies selecting THIS and only THIS
                                                    setBonusDialogState(prev => ({
                                                        ...prev,
                                                        currentPicks: { [pid]: prev.maxQty || 1 } // Set this to max immediately
                                                    }));
                                                }}
                                            >
                                                {currentQty > 0 ? 'Dipilih' : 'Pilih'}
                                            </Button>
                                        ) : (
                                            // Mix Mechanism
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="icon"
                                                    variant="outline"
                                                    className="h-7 w-7"
                                                    disabled={currentQty === 0}
                                                    onClick={() => setBonusDialogState(prev => ({
                                                        ...prev,
                                                        currentPicks: { ...prev.currentPicks, [pid]: Math.max(0, currentQty - 1) }
                                                    }))}
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </Button>
                                                <span className="w-6 text-center text-sm font-bold">{currentQty}</span>
                                                <Button
                                                    size="icon"
                                                    variant="outline"
                                                    className="h-7 w-7"
                                                    disabled={remainingQuota === 0 || currentQty >= stock}
                                                    onClick={() => setBonusDialogState(prev => ({
                                                        ...prev,
                                                        currentPicks: { ...prev.currentPicks, [pid]: currentQty + 1 }
                                                    }))}
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex justify-between items-center pt-2">
                            <div className="text-sm">
                                Terpilih: <b>{Object.values(bonusDialogState.currentPicks || {}).reduce((a, b) => a + b, 0)}</b> / {bonusDialogState.maxQty}
                            </div>
                            <Button
                                onClick={saveBonusSelection}
                                disabled={Object.values(bonusDialogState.currentPicks || {}).reduce((a, b) => a + b, 0) !== bonusDialogState.maxQty}
                            >
                                Simpan & Klaim
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* New Payment Dialog */}
                <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                    <DialogContent className="max-w-md [&>button]:hidden">
                        <DialogHeader className={cn(isSuccess && "hidden")}>
                            <DialogTitle>Pembayaran</DialogTitle>
                            <DialogDescription>Masukkan nominal yang dibayarkan pelanggan.</DialogDescription>
                        </DialogHeader>

                        {isSuccess ? (
                            <div className="flex flex-col items-center justify-center py-10 space-y-4 animate-in fade-in zoom-in duration-300">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                                    <Check className="w-10 h-10 text-green-600 animate-bounce" />
                                </div>
                                <div className="text-center space-y-2">
                                    <h3 className="text-xl font-bold text-green-700">Transaksi Berhasil!</h3>
                                    <p className="text-muted-foreground text-sm">Menyimpan data penjualan...</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-4 py-2">
                                    <div className="bg-muted/30 p-3 rounded-lg space-y-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground font-medium">Subtotal</span>
                                            <span className="font-semibold">{formatRupiah(calculateGross())}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground font-medium">Diskon</span>
                                            <span className="font-semibold text-red-600">-{formatRupiah(calculateTotalDiscount())}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-muted-foreground/20">
                                            <span className="font-medium">Total Tagihan</span>
                                            <span className="text-xl font-bold text-primary">{formatRupiah(calculateTotal())}</span>
                                        </div>
                                    </div>



                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <Label>Jumlah Bayar</Label>
                                            <button
                                                type="button"
                                                onClick={() => setPaymentAmount(calculateTotal())}
                                                className="text-xs text-primary font-medium px-2 py-1 bg-primary/10 rounded hover:bg-primary/20 transition-colors"
                                            >
                                                Uang Pas: {formatRupiah(calculateTotal())}
                                            </button>
                                        </div>
                                        <Input
                                            type="text"
                                            inputMode="numeric"
                                            className="text-right text-lg font-bold"
                                            placeholder="0"
                                            value={paymentAmount === 0 ? '' : paymentAmount.toLocaleString('id-ID')}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\./g, '');
                                                if (!isNaN(Number(val))) {
                                                    setPaymentAmount(Number(val));
                                                }
                                            }}
                                            autoFocus
                                        />
                                    </div>

                                    <div className="flex justify-between items-center pt-2 border-t">
                                        <span className="text-sm font-medium">
                                            {paymentAmount >= calculateTotal() ? 'Kembalian' : 'Sisa (Hutang)'}
                                        </span>
                                        <span className={cn("text-lg font-bold", paymentAmount >= calculateTotal() ? "text-green-600" : "text-destructive")}>
                                            {formatRupiah(Math.abs(paymentAmount - calculateTotal()))}
                                        </span>
                                    </div>
                                </div>

                                <DialogFooter className="mt-4 gap-2">
                                    <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)} className="sm:w-32">Kembali</Button>
                                    <Button onClick={processTransaction} disabled={isProcessing} className="flex-1">
                                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Selesaikan Transaksi"}
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            </div>

            <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Buat Pelanggan Baru</DialogTitle>
                        <DialogDescription>
                            Pendaftaran pelanggan baru untuk transaksi ini.
                        </DialogDescription>
                    </DialogHeader>
                    <PelangganForm
                        isDialog
                        initialName={searchTerm}
                        onSuccess={handleNewCustomerSuccess}
                        onCancel={() => setIsAddCustomerOpen(false)}
                    />
                </DialogContent>
            </Dialog>
            {/* Double Transaction Warning Dialog */}
            <AlertDialog open={showDoubleTxWarning} onOpenChange={setShowDoubleTxWarning}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Peringatan Transaksi Ganda</AlertDialogTitle>
                        <AlertDialogDescription>
                            Pelanggan ini sudah memiliki transaksi pada hari ini. Apakah Anda yakin ingin membuat transaksi baru lagi?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => {
                            setShowDoubleTxWarning(false);
                            // Need to re-calculate invalidItems or pass them? 
                            // Since this runs after validations, we can re-run check or simpler: just proceed.
                            // But handleConfirm calculated invalidItems. 
                            // Let's refactor handleConfirm to not lose that context or just recalculate.
                            // Recalculating is safer/easier than refactoring entire function into useCallback just for this.

                            // Re-calculating stock warnings for continueTransaction
                            const productUsage = new Map<string, number>();
                            cart.forEach(c => {
                                if (c.barangId) {
                                    const current = productUsage.get(c.barangId) || 0;
                                    productUsage.set(c.barangId, current + (c.jumlah * c.konversi));
                                }
                            });
                            const invalidItems: string[] = [];
                            productUsage.forEach((totalQty, barangId) => {
                                const stock = getUserStock(barangId);
                                if (totalQty > stock) {
                                    const product = barang.find(b => b.id === barangId);
                                    invalidItems.push(`${product?.nama || 'Unknown'} (Sisa: ${(stock - totalQty).toLocaleString('id-ID')})`);
                                }
                            });

                            continueTransaction(invalidItems);
                        }}>
                            Ya, Lanjutkan
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={showPromoDropWarning} onOpenChange={setShowPromoDropWarning}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Stok Bonus Tidak Mencukupi
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Stok untuk hadiah dari promo berikut tidak mencukupi:
                            <ul className="list-disc list-inside mt-2 font-medium text-foreground">
                                {droppedPromoNames.map((name, i) => (
                                    <li key={i}>{name}</li>
                                ))}
                            </ul>
                            <p className="mt-4">
                                Promo ini akan dibatalkan otomatis jika Anda melanjutkan transaksi. Lanjutkan tanpa promo?
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDropPromos} className="bg-destructive hover:bg-destructive/90">
                            Lanjutkan Tanpa Promo
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Closing Time Overlay */}
            {isClosed && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-500">
                    <Card className="max-w-md w-full shadow-2xl border-2 border-yellow-500/20">
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                                <CalendarClock className="w-8 h-8 text-yellow-600 animate-pulse" />
                            </div>
                            <CardTitle className="text-2xl font-bold text-slate-900">Input Ditutup</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center space-y-4">
                            <p className="text-slate-600 leading-relaxed">
                                Mohon maaf, pendaftaran penjualan saat ini sedang ditutup (Jam Closing).
                            </p>
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col items-center">
                                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Jam Operasional Input</span>
                                <span className="text-lg font-mono font-bold text-slate-700">
                                    {profilPerusahaan?.config?.closingEndTime} - {profilPerusahaan?.config?.closingStartTime}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 italic">
                                Silakan kembali lagi saat jam operasional dibuka.
                            </p>
                        </CardContent>
                        <CardFooter>
                            <Button variant="outline" className="w-full" onClick={() => navigate('/beranda')}>
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Kembali ke Beranda
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </MainLayout>
    );
}



