
import { useState } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, CheckCircle2, RotateCcw, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { formatRupiah } from '@/lib/utils';
import { Progress } from "@/components/ui/progress";
import { PersetujuanPayload, Penjualan } from '@/lib/types';
import { supabase } from '@/lib/supabase';

type IntegrityStatus = 'pending' | 'disetujui' | 'ditolak' | 'lunas' | 'dibayar' | 'selesai' | 'batal' | 'draft' | 'diterima';

interface RawPembayaran {
    id: string;
    penjualan_id: string;
    jumlah: number;
    metode_pembayaran: string;
    created_by: string | null;
    tanggal: string;
}

type Discrepancy = {
    id: string; // User ID or Stock ID
    name: string;
    type: 'Stock' | 'Balance' | 'MutasiStatus' | 'StatusMismatch' | 'PaymentAttribution';
    expected: number;
    actual: number;
    details?: string;
    referenceId?: string; // e.g. Stock ID for fixing
    targetStatus?: IntegrityStatus;
    targetTable?: 'setoran' | 'reimburse' | 'mutasi_barang' | 'permintaan_barang' | 'penyesuaian_stok' | 'penjualan' | 'pembayaran_penjualan'; // For StatusMismatch fix
    userId?: string;
    barangId?: string;
    suggestion?: string;
    paymentId?: string;
};

type StockItemPayload = {
    barangId: string;
    jumlah: number;
    satuanId?: string;
    konversi?: number;
};

export default function DataIntegrityCheck() {
    const {
        users, barang, stokPengguna,
        updateStokPengguna, updateSaldoPengguna, addSaldoPengguna, addStokPengguna,
        updateMutasiBarang, updateSetoran, updateReimburse,
        updatePermintaanBarang, updatePenyesuaianStok, updatePenjualan
    } = useDatabase();

    const [isScanning, setIsScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);

    // HELPER: Get Conversions
    const getBaseQty = (barangId: string, unitId: string, qty: number) => {
        const item = barang.find(b => b.id === barangId);
        if (!item) return qty;
        if (item.satuanId === unitId) return qty;
        const conv = item.multiSatuan?.find(m => m.satuanId === unitId)?.konversi;
        return qty * (conv || 1);
    };

    const runCheck = async () => {
        setIsScanning(true);
        setProgress(0);
        setDiscrepancies([]);
        const issues: Discrepancy[] = [];

        try {
            // FETCH FULL HISTORY
            const fetchAll = async (table: string) => {
                const { data, error } = await supabase.from(table).select('*');
                if (error) throw error;
                return data || [];
            };

            setProgress(10);
            const [
                allPenjualan,
                allSetoran,
                allPersetujuan,
                allMutasi,
                allStok,
                allSaldo,
                allReimburse,
                allPermintaan,
                allPenyesuaian,
                allBarangData, // Fetch Barang explicitly
                allPembayaran
            ] = await Promise.all([
                fetchAll('penjualan'),
                fetchAll('setoran'),
                fetchAll('persetujuan'),
                fetchAll('mutasi_barang'),
                fetchAll('stok_pengguna'),
                fetchAll('saldo_pengguna'),
                fetchAll('reimburse'),
                fetchAll('permintaan_barang'),
                fetchAll('penyesuaian_stok'),
                fetchAll('barang'),
                fetchAll('pembayaran_penjualan')
            ]);

            const rawBarang = allBarangData as { id: string; nama: string }[];

            const totalSteps = users.length * 2;
            let currentStep = 0;

            // Define Raw Types locally
            interface RawPersetujuan {
                id: string;
                jenis: string;
                status: 'pending' | 'disetujui' | 'ditolak';
                target_user_id: string | null;
                diajukan_oleh: string | null;
                disetujui_oleh: string | null;
                data: PersetujuanPayload;
                referensi_id?: string;
            }

            interface RawPenjualan {
                id: string;
                sales_id: string | null;
                created_by: string | null;
                status: 'pending' | 'lunas' | 'batal' | 'draft';
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                items: any[];
                metode_pembayaran: string;
                dibayar: number;
                total: number;
                bayar: number;
                kembalian: number;
                is_lunas: boolean;
                nomor_nota?: string;
            }

            interface RawSetoran {
                id: string;
                user_id: string;
                status: 'pending' | 'disetujui' | 'ditolak' | 'diterima';
                jumlah: number;
            }

            interface RawStok {
                id: string;
                user_id: string;
                barang_id: string;
                jumlah: number;
            }

            interface RawSaldo {
                id: string;
                user_id: string;
                saldo: number;
            }

            interface RawReimburse {
                id: string;
                status: string;
                user_id: string;
                jumlah: number;
            }

            interface RawPermintaan {
                id: string;
                status: string;
                nomor_permintaan?: string;
            }

            interface RawPenyesuaian {
                id: string;
                status: string;
                nomor_penyesuaian?: string;
            }

            interface RawMutasi {
                id: string;
                status: 'pending' | 'disetujui' | 'ditolak';
                nomor_mutasi?: string;
                referensi_id?: string;
            }

            interface RawPembayaran {
                id: string;
                penjualan_id: string;
                created_by: string | null;
                jumlah: number;
                diterima_oleh?: string;
                metode_pembayaran?: string;
            }

            const rawPersetujuan = allPersetujuan as RawPersetujuan[];
            const rawPenjualan = allPenjualan as RawPenjualan[];
            const rawSetoran = allSetoran as RawSetoran[];
            const rawStok = allStok as RawStok[];
            const rawSaldo = allSaldo as RawSaldo[];
            const rawReimburse = allReimburse as RawReimburse[];
            const rawPermintaan = allPermintaan as RawPermintaan[];
            const rawPenyesuaian = allPenyesuaian as RawPenyesuaian[];
            const rawMutasiBarang = allMutasi as RawMutasi[];
            const rawPembayaran = allPembayaran as RawPembayaran[];


            // 1. CHECK STOCK & BALANCE INTEGRITY
            for (const user of users) {
                currentStep++;
                setProgress(10 + (currentStep / totalSteps) * 80);

                const expectedStock = new Map<string, number>();

                // A. Restock (Persetujuan)
                const restocks = rawPersetujuan.filter((p) => {
                    if (p.jenis !== 'restock' || p.status !== 'disetujui') return false;
                    const recipientId = p.target_user_id || p.diajukan_oleh;
                    return recipientId === user.id;
                });

                restocks.forEach((r) => {
                    type ExtendedPayload = PersetujuanPayload & { konversi?: number };
                    const d = r.data as ExtendedPayload;

                    if (d.barangId && d.jumlah) {
                        const conversion = d.konversi || 1;
                        let finalQty = 0;
                        if (d.konversi) {
                            finalQty = Number(d.jumlah) * conversion;
                        } else {
                            const unitId = d.satuanId || '';
                            finalQty = getBaseQty(d.barangId, unitId, Number(d.jumlah));
                        }
                        const curr = expectedStock.get(d.barangId) || 0;
                        expectedStock.set(d.barangId, curr + finalQty);
                    }
                });

                // B. Mutasi (Persetujuan)
                const mutations = rawPersetujuan.filter((p) =>
                    (p.jenis === 'mutasi' || p.jenis === 'mutasi_stok') &&
                    p.status === 'disetujui'
                );

                mutations.forEach((m) => {
                    const d = m.data as unknown as { items: StockItemPayload[] }; // Correct casting
                    const senderId = m.diajukan_oleh;
                    const receiverId = m.target_user_id; // Mutasi stok usually has target user
                    const items = Array.isArray(d.items) ? d.items : [];

                    if (senderId === user.id) {
                        items.forEach((item) => {
                            if (!item.barangId) return; // SKIP IF NO ID
                            const qty = item.jumlah * (item.konversi || 1);
                            const curr = expectedStock.get(item.barangId) || 0;
                            expectedStock.set(item.barangId, curr - qty);
                        });
                    }
                    if (receiverId === user.id) {
                        items.forEach((item) => {
                            if (!item.barangId) return; // SKIP IF NO ID
                            const qty = item.jumlah * (item.konversi || 1);
                            const curr = expectedStock.get(item.barangId) || 0;
                            expectedStock.set(item.barangId, curr + qty);
                        });
                    }
                });

                // C. Sales
                const userSales = rawPenjualan.filter((p) =>
                    (p.sales_id === user.id || p.created_by === user.id) &&
                    p.status !== 'batal'
                );

                userSales.forEach((s) => {
                    const items = s.items || [];
                    items.forEach((item) => {
                        if (!item.barangId) return; // SKIP IF NO ID
                        const qty = item.jumlah * (item.konversi || 1);
                        const curr = expectedStock.get(item.barangId) || 0;
                        expectedStock.set(item.barangId, curr - qty);
                    });
                });

                // D. Requests (Permintaan)
                const requests = rawPersetujuan.filter((p) =>
                    p.jenis === 'permintaan' &&
                    p.status === 'disetujui'
                );

                requests.forEach((r) => {
                    const d = r.data as PersetujuanPayload;
                    const requesterId = r.diajukan_oleh;
                    const supplierId = r.disetujui_oleh;
                    const items = d.items as StockItemPayload[] || [];

                    // 1. ADD to Requester
                    if (requesterId === user.id) {
                        items.forEach((item) => {
                            if (!item.barangId) return; // SKIP IF NO ID
                            const qty = item.jumlah * (item.konversi || 1);
                            const curr = expectedStock.get(item.barangId) || 0;
                            expectedStock.set(item.barangId, curr + qty);
                        });
                    }

                    // 2. DEDUCT from Supplier (Approver) 
                    // Only if supplier is NOT a global role (Admin/Owner/Gudang)
                    if (supplierId === user.id) {
                        const supplierUser = users.find(u => u.id === supplierId);
                        const isGlobal = supplierUser?.roles.some(r => ['admin', 'owner', 'gudang'].includes(r));

                        if (!isGlobal) {
                            items.forEach((item) => {
                                if (!item.barangId) return; // SKIP IF NO ID
                                const qty = item.jumlah * (item.konversi || 1);
                                const curr = expectedStock.get(item.barangId) || 0;
                                expectedStock.set(item.barangId, curr - qty);
                            });
                        }
                    }
                });

                // E. Opname (Penyesuaian Stok)
                const adjs = rawPersetujuan.filter((p) =>
                    p.jenis === 'opname' &&
                    p.status === 'disetujui' &&
                    p.diajukan_oleh === user.id
                );

                adjs.forEach((a) => {
                    const d = a.data as PersetujuanPayload;
                    if (d.barangId && d.selisih !== undefined) {
                        const curr = expectedStock.get(d.barangId) || 0;
                        expectedStock.set(d.barangId, curr + (d.selisih as number));
                    }
                });

                // COMPARE with DB STOK
                expectedStock.forEach((val, barangId) => {
                    const actualRecord = rawStok.find((s) => s.user_id === user.id && s.barang_id === barangId);
                    const actual = actualRecord?.jumlah || 0;

                    if (Math.abs(val - actual) > 0.01) {
                        const bObj = rawBarang.find(b => b.id === barangId);
                        const bName = bObj ? bObj.nama : `Unknown Item (${barangId})`;
                        issues.push({
                            id: actualRecord?.id || `NEW-STOK-${user.id}-${barangId}`,
                            name: `${user.nama} - ${bName}`,
                            type: 'Stock',
                            expected: val,
                            actual: actual,
                            details: `Selisih: ${val - actual}. (Sistem: ${val}, DB: ${actual})`,
                            referenceId: actualRecord?.id,
                            userId: user.id,
                            barangId: barangId,
                            suggestion: actualRecord
                                ? "Sesuaikan saldo stok agar selaras dengan total riwayat transaksi (Restock + Mutasi - Penjualan)."
                                : "Record stok belum ada. Gunakan tombol 'Perbaiki' untuk membuat record stok awal."
                        });
                    }
                });
            }

            // 2. CHECK BALANCE
            for (const user of users) {
                currentStep++;
                setProgress(10 + (currentStep / totalSteps) * 80);

                let expectedBalance = 0;

                // A. CASH IN (Uang Masuk)
                // All Payments (Initial + Repayments) are recorded in pembayaran_penjualan
                const cashRepayments = rawPembayaran.filter((p) => {
                    if (p.created_by === user.id) return true;
                    // Fallback to linked sales_id if created_by is missing (legacy data)
                    if (!p.created_by && p.penjualan_id) {
                        const linkedSale = rawPenjualan.find(s => s.id === p.penjualan_id);
                        return linkedSale && linkedSale.sales_id === user.id;
                    }
                    return false;
                });

                const totalRepayments = cashRepayments.reduce((sum, p) => sum + (p.jumlah || 0), 0);
                expectedBalance += totalRepayments;

                // B. CASH OUT (Uang Keluar / Setoran - Approved)
                const deposits = rawSetoran.filter((s) =>
                    s.user_id === user.id &&
                    (s.status === 'disetujui' || s.status === 'diterima')
                );

                const totalDeposits = deposits.reduce((sum, d) => sum + (d.jumlah || 0), 0);

                // Setoran Pusat (Rencana Setoran)
                const pusatDeposits = rawPersetujuan.filter((p) =>
                    p.diajukan_oleh === user.id &&
                    p.jenis === 'rencana_setoran' &&
                    p.status === 'disetujui'
                );

                const totalPusatDeposits = pusatDeposits.reduce((sum, d) => {
                    const data = d.data as { amount?: number };
                    return sum + (data?.amount || 0);
                }, 0);

                expectedBalance -= (totalDeposits + totalPusatDeposits);

                // COMPARE
                const actualRecord = rawSaldo.find((s) => s.user_id === user.id);
                const actual = actualRecord?.saldo || 0;

                if (Math.abs(expectedBalance - actual) > 500) {
                    issues.push({
                        id: actualRecord?.id || `NEW-SALDO-${user.id}`,
                        name: `${user.nama}`,
                        type: 'Balance',
                        expected: expectedBalance,
                        actual: actual,
                        details: `Selisih: ${formatRupiah(expectedBalance - actual)} (Cash In: ${formatRupiah(totalRepayments)}, Cash Out: ${formatRupiah(totalDeposits + totalPusatDeposits)})`,
                        referenceId: actualRecord?.id,
                        userId: user.id,
                        suggestion: "Hutang/Piutang tunai user ini tidak sinkron. Gunakan tombol 'Perbaiki' untuk menyetel ulang saldo sesuai riwayat Cash Flow."
                    });
                }
            }

            // 3. CHECK MUTASI STATUS
            for (const m of rawMutasiBarang) {
                if (m.referensi_id) {
                    const p = rawPersetujuan.find(p => p.id === m.referensi_id);
                    if (p && p.status !== m.status) {
                        issues.push({
                            id: m.id,
                            name: `Mutasi ${m.nomor_mutasi || m.id}`,
                            type: 'MutasiStatus',
                            expected: 0,
                            actual: 0,
                            details: `Status tidak sinkron. Mutasi: ${m.status}, Persetujuan: ${p.status}`,
                            referenceId: m.id,
                            targetStatus: p.status as IntegrityStatus,
                            suggestion: "Sinkronkan status transaksi mutasi dengan status persetujuannya agar stok terhitung dengan benar."
                        });
                    }
                }
            }

            // 4. CHECK PERSETUJUAN INTEGRITY
            for (const p of rawPersetujuan) {
                if (p.status === 'disetujui' && p.referensi_id) {
                    if (p.jenis === 'setoran') {
                        const s = rawSetoran.find(x => x.id === p.referensi_id);
                        if (s && s.status !== 'disetujui') {
                            issues.push({
                                id: s.id,
                                name: `Setoran ${p.referensi_id}`,
                                type: 'StatusMismatch',
                                expected: 0,
                                actual: 0,
                                details: `Status mismatch. Persetujuan: disetujui, Setoran: ${s.status}`,
                                referenceId: s.id,
                                targetStatus: 'disetujui',
                                targetTable: 'setoran',
                                suggestion: "Status setoran di tabel transaksi tidak sesuai dengan status persetujuannya."
                            });
                        }
                    } else if (p.jenis === 'reimburse') {
                        const r = rawReimburse.find(x => x.id === p.referensi_id);
                        if (r && r.status !== 'disetujui' && r.status !== 'dibayar') {
                            issues.push({
                                id: r.id,
                                name: `Reimburse ${p.referensi_id}`,
                                type: 'StatusMismatch',
                                expected: 0,
                                actual: 0,
                                details: `Status mismatch. Persetujuan: disetujui, Reimburse: ${r.status}`,
                                referenceId: r.id,
                                targetStatus: 'disetujui',
                                targetTable: 'reimburse',
                                suggestion: "Status reimburse di tabel transaksi tidak sesuai dengan status persetujuannya."
                            });
                        }
                    } else if (p.jenis === 'mutasi_stok') {
                        const m = rawMutasiBarang.find(x => x.id === p.referensi_id);
                        if (m && m.status !== 'disetujui') {
                            issues.push({
                                id: m.id,
                                name: `Mutasi Stok ${m.nomor_mutasi || m.id}`,
                                type: 'StatusMismatch',
                                expected: 0,
                                actual: 0,
                                details: `Status mismatch. Persetujuan: disetujui, Mutasi: ${m.status}`,
                                referenceId: m.id,
                                targetStatus: 'disetujui',
                                targetTable: 'mutasi_barang',
                                suggestion: "Status mutasi stok di tabel transaksi tidak sesuai dengan status persetujuannya."
                            });
                        }
                    } else if (p.jenis === 'permintaan') {
                        const req = rawPermintaan.find(x => x.id === p.referensi_id);
                        if (req && req.status !== 'disetujui' && req.status !== 'selesai') {
                            issues.push({
                                id: req.id,
                                name: `Permintaan ${req.nomor_permintaan || req.id}`,
                                type: 'StatusMismatch',
                                expected: 0,
                                actual: 0,
                                details: `Status mismatch. Persetujuan: disetujui, Permintaan: ${req.status}`,
                                referenceId: req.id,
                                targetStatus: 'disetujui',
                                targetTable: 'permintaan_barang',
                                suggestion: "Status permintaan barang di tabel transaksi tidak sesuai dengan status persetujuannya."
                            });
                        }
                    } else if (p.jenis === 'opname') {
                        const adj = rawPenyesuaian.find(x => x.id === p.referensi_id);
                        if (adj && adj.status !== 'disetujui') {
                            issues.push({
                                id: adj.id,
                                name: `Penyesuaian ${adj.nomor_penyesuaian || adj.id}`,
                                type: 'StatusMismatch',
                                expected: 0,
                                actual: 0,
                                details: `Status mismatch. Persetujuan: disetujui, Penyesuaian: ${adj.status}`,
                                referenceId: adj.id,
                                targetStatus: 'disetujui',
                                targetTable: 'penyesuaian_stok',
                                suggestion: "Status penyesuaian stok (opname) di tabel transaksi tidak sesuai dengan status persetujuannya."
                            });
                        }
                    }
                }
            }

            // 5. CHECK PENJUALAN LUNAS CONSISTENCY
            for (const s of rawPenjualan) {
                const total = s.total || 0;
                const paidAmount = s.dibayar || 0;
                if (paidAmount >= total && !s.is_lunas && (s.status === 'lunas')) {
                    issues.push({
                        id: s.id,
                        name: `Penjualan ${s.nomor_nota || s.id}`,
                        type: 'StatusMismatch',
                        expected: 0,
                        actual: 0,
                        details: `Sudah dibayar (${formatRupiah(paidAmount)}) tapi bendera 'Lunas' belum aktif.`,
                        referenceId: s.id,
                        targetStatus: 'lunas',
                        targetTable: 'penjualan',
                        suggestion: "Aktifkan bendera 'Lunas' dan sinkronkan status penjualan agar laporan piutang akurat."
                    });
                }
            }

            // 6. CHECK FOR CORRUPTED STATUS
            // 6. CHECK FOR CORRUPTED STATUS
            const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
            for (const m of rawMutasiBarang) {
                if (m.status && isUUID(m.status)) {
                    const linkedP = rawPersetujuan.find(p => p.id === m.status || p.referensi_id === m.id);
                    const correctStatus = linkedP?.status || 'pending';
                    issues.push({
                        id: m.id,
                        name: `Mutasi ${m.nomor_mutasi || m.id} (Corrupted)`,
                        type: 'StatusMismatch',
                        expected: 0,
                        actual: 0,
                        details: `Status korup (UUID). Seharusnya: "${correctStatus}"`,
                        referenceId: m.id,
                        targetStatus: correctStatus as IntegrityStatus,
                        targetTable: 'mutasi_barang',
                        suggestion: "Pulihkan status transaksi yang korup berdasarkan data di tabel persetujuan."
                    });
                }
            }

            // 7. CHECK PEMBAYARAN ATTRIBUTION (Created By NULL)
            for (const pay of rawPembayaran) {
                if (!pay.created_by && pay.penjualan_id) {
                    const parentSale = rawPenjualan.find(p => p.id === pay.penjualan_id);
                    if (parentSale && parentSale.sales_id) {
                        const salesUser = users.find(u => u.id === parentSale.sales_id);
                        const salesName = salesUser ? salesUser.nama : 'Unknown Sales';
                        issues.push({
                            id: pay.id,
                            name: `Pembayaran ${formatRupiah(pay.jumlah)}`,
                            type: 'PaymentAttribution',
                            expected: 0,
                            actual: 0,
                            details: `Pembayaran tidak memiliki atribut 'Created By'. Seharusnya: ${salesName}`,
                            referenceId: pay.id,
                            userId: parentSale.sales_id, // Target attribution
                            targetTable: 'pembayaran_penjualan',
                            suggestion: `Hubungkan pembayaran ini ke sales ${salesName} (ID: ${parentSale.sales_id})`
                        });
                    }
                }
            }

            setDiscrepancies(issues);
            if (issues.length === 0) {
                toast.success("Data integritas aman! (Scan Full History)");
            } else {
                toast.warning(`Ditemukan ${issues.length} ketidaksesuaian data (Full History).`);
            }

        } catch (err) {
            console.error(err);
            toast.error("Gagal melakukan scan database.");
        } finally {
            setIsScanning(false);
            setProgress(100);
        }
    };
    const handleFix = async (issue: Discrepancy) => {
        try {
            if (issue.type === 'Stock') {
                // Check if record still exists before updating
                const existingRecord = stokPengguna.find(s => s.id === issue.referenceId);

                if (issue.referenceId && existingRecord) {
                    await updateStokPengguna(issue.referenceId, { jumlah: issue.expected });
                } else if (issue.userId && issue.barangId) {
                    // Record doesn't exist or ID is invalid, create new one
                    await addStokPengguna({
                        userId: issue.userId,
                        barangId: issue.barangId,
                        jumlah: issue.expected
                    });
                } else {
                    toast.error("Metadata tidak lengkap untuk perbaikan otomatis.");
                    return;
                }
            } else if (issue.type === 'Balance') {
                if (issue.referenceId) {
                    await updateSaldoPengguna(issue.referenceId, { saldo: issue.expected });
                } else if (issue.userId) {
                    await addSaldoPengguna({
                        userId: issue.userId,
                        saldo: issue.expected,
                        updatedAt: new Date()
                    });
                }
            } else if (issue.type === 'MutasiStatus') {
                if (issue.referenceId && issue.targetStatus) {
                    await updateMutasiBarang(issue.referenceId, {
                        status: issue.targetStatus as 'pending' | 'disetujui' | 'ditolak'
                    });
                }
            } else if (issue.type === 'StatusMismatch') {
                if (issue.referenceId && issue.targetStatus && issue.targetTable) {
                    const ts = issue.targetStatus;
                    switch (issue.targetTable) {
                        case 'setoran':
                            await updateSetoran(issue.referenceId, { status: ts as 'pending' | 'disetujui' | 'ditolak' | 'diterima' });
                            break;
                        case 'reimburse':
                            await updateReimburse(issue.referenceId, { status: ts as 'pending' | 'disetujui' | 'ditolak' | 'dibayar' });
                            break;
                        case 'mutasi_barang':
                            await updateMutasiBarang(issue.referenceId, { status: ts as 'pending' | 'disetujui' | 'ditolak' });
                            break;
                        case 'permintaan_barang':
                            await updatePermintaanBarang(issue.referenceId, { status: ts as 'pending' | 'disetujui' | 'ditolak' | 'selesai' });
                            break;
                        case 'penyesuaian_stok':
                            await updatePenyesuaianStok(issue.referenceId, { status: ts as 'pending' | 'disetujui' | 'ditolak' });
                            break;
                        case 'penjualan': {
                            const updateData: { status: 'pending' | 'lunas' | 'batal' | 'draft'; is_lunas?: boolean } = {
                                status: ts as 'pending' | 'lunas' | 'batal' | 'draft'
                            };
                            if (ts === 'lunas') updateData.is_lunas = true;
                            await updatePenjualan(issue.referenceId, updateData as Partial<Penjualan>);
                            break;
                        }
                    }
                }
            } else if (issue.type === 'PaymentAttribution') {
                if (issue.referenceId && issue.userId) {
                    const { error } = await supabase
                        .from('pembayaran_penjualan')
                        .update({ created_by: issue.userId })
                        .eq('id', issue.referenceId);

                    if (error) throw error;
                }
            }

            toast.success("Berhasil memperbaiki data!");
            setDiscrepancies(prev => prev.filter(d => d.id !== issue.id));
        } catch (error) {
            console.error(error);
            toast.error("Gagal memperbaiki data.");
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-primary" />
                    Cek Integritas Data
                </CardTitle>
                <CardDescription>
                    Pindai dan verifikasi kesesuaian data Stok dan Saldo pengguna berdasarkan riwayat transaksi.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <Button onClick={runCheck} disabled={isScanning} className="w-full sm:w-auto h-11 sm:h-auto">
                            {isScanning ? (
                                <>
                                    <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                                    Memindai...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Mulai Pindai
                                </>
                            )}
                        </Button>
                        {isScanning && <Progress value={progress} className="w-full" />}
                    </div>

                    {!isScanning && discrepancies.length > 0 && (
                        <div className="rounded-md border border-red-200 bg-red-50 p-3 sm:p-4">
                            <div className="flex items-center gap-2 text-red-700 font-semibold mb-3 sm:mb-4">
                                <AlertCircle className="w-5 h-5" />
                                <span className="text-sm sm:text-base border-0">Ditemukan {discrepancies.length} Masalah</span>
                            </div>

                            {/* Mobile View: Cards */}
                            <div className="grid grid-cols-1 gap-3 md:hidden">
                                {discrepancies.map((item) => (
                                    <div key={`m-${item.id}`} className="bg-white rounded-lg p-3 sm:p-4 border border-red-100 shadow-sm flex flex-col gap-3">
                                        <div className="flex justify-between items-start gap-3 border-b border-red-50 pb-3">
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-sm line-clamp-2 leading-tight">{item.name}</h4>
                                                <span className="text-[10px] sm:text-xs uppercase bg-muted/30 px-2 py-0.5 rounded text-muted-foreground mt-1.5 inline-block">{item.type}</span>
                                            </div>
                                            <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs bg-white text-gray-900 border-gray-200 hover:bg-gray-100 hover:text-gray-900" onClick={() => handleFix(item)}>
                                                Perbaiki
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-red-50/70 p-2 sm:p-2.5 rounded-md border border-red-100/50 flex flex-col justify-center">
                                                <span className="block text-[10px] sm:text-xs text-muted-foreground mb-1 uppercase tracking-wider">Aktual</span>
                                                <span className="font-mono text-red-600 font-medium text-xs sm:text-sm break-words">
                                                    {item.type === 'Balance' ? formatRupiah(item.actual) : item.actual.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="bg-green-50/70 p-2 sm:p-2.5 rounded-md border border-green-100/50 flex flex-col justify-center">
                                                <span className="block text-[10px] sm:text-xs text-muted-foreground mb-1 uppercase tracking-wider">Seharusnya</span>
                                                <span className="font-mono text-green-600 font-bold text-xs sm:text-sm break-words">
                                                    {item.type === 'Balance' ? formatRupiah(item.expected) : item.expected.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>

                                        {item.suggestion && (
                                            <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground bg-slate-50/80 p-2.5 rounded border border-slate-100 italic">
                                                {item.suggestion}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Desktop View: Table */}
                            <div className="hidden md:block overflow-x-auto bg-white rounded-md border border-red-100">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nama</TableHead>
                                            <TableHead>Tipe</TableHead>
                                            <TableHead>Aktual</TableHead>
                                            <TableHead>Seharusnya</TableHead>
                                            <TableHead>Saran Perbaikan</TableHead>
                                            <TableHead>Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {discrepancies.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">{item.name}</TableCell>
                                                <TableCell className="text-xs uppercase text-muted-foreground">{item.type}</TableCell>
                                                <TableCell className="text-red-600 font-mono text-xs">
                                                    {item.type === 'Balance' ? formatRupiah(item.actual) : item.actual.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-green-600 font-mono text-xs font-bold">
                                                    {item.type === 'Balance' ? formatRupiah(item.expected) : item.expected.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground italic max-w-[200px]">
                                                    {item.suggestion || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Button size="sm" variant="outline" onClick={() => handleFix(item)}>
                                                        Perbaiki
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    {!isScanning && discrepancies.length === 0 && progress === 100 && (
                        <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
                            <p className="font-medium text-lg text-gray-900">Semua Data Sinkron</p>
                            <p>Tidak ditemukan selisih antara riwayat transaksi dan data saat ini.</p>
                        </div>
                    )}
                </div>

            </CardContent>
        </Card>
    );
}
