import { supabase } from '@/lib/supabase';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { PersetujuanPayload, Karyawan } from '@/lib/types';
import { formatRupiah } from '@/lib/utils';
import { Persetujuan as PersetujuanType, Setoran, Reimburse, MutasiBarang, Barang, StokPengguna } from '@/lib/types';

export const useApprovalAction = () => {
    const { user } = useAuth();
    const {
        persetujuan, updatePersetujuan,
        setoran, updateSetoran,
        mutasiBarang, updateMutasiBarang,
        barang, updateBarang,
        updateKaryawan, karyawan,
        addHarga, updateHarga,
        stokPengguna, addStokPengguna, updateStokPengguna,
        satuan: satuanList, users, addNotifikasi,
        updatePelanggan, pelanggan, updateUser,
        addPromo, updatePromo,
        updateSaldoPengguna, saldoPengguna, addSaldoPengguna,
        reimburse, updateReimburse, addPettyCash,
        penjualan, updatePenjualan, cabang, rekeningBank,
        permintaanBarang, updatePermintaanBarang,
        penyesuaianStok, updatePenyesuaianStok
    } = useDatabase();

    const getUnitName = (id?: string) => satuanList.find(s => s.id === id)?.nama || 'Unit';
    const formatUserDetail = (id?: string) => users.find(u => u.id === id)?.nama || 'Unknown';

    const executeApprove = async (id: string, type: string, refId: string, data?: PersetujuanPayload): Promise<{ success: boolean; reason?: string }> => {
        // --- 0. PRE-FLIGHT STOCK VALIDATION ---
        if (type === 'mutasi' || type === 'permintaan') {
            const approvalItem = persetujuan.find(p => p.id === id);
            if (!approvalItem || !approvalItem.data) return { success: false, reason: 'not_found' };

            const isApproverGlobal = user?.roles.includes('admin') || user?.roles.includes('owner') || user?.roles.includes('gudang');
            const items = (approvalItem.data as PersetujuanPayload).items as { barangId: string; jumlah: number; konversi?: number; satuanId?: string }[];

            if (items && items.length > 0) {
                // Determine supplier branch
                // For permintaan, targetCabangId is the branch we are requesting from
                // For mutasi, the sender is usually the one approving or the one who made the request. 
                // Let's refine based on the action type later, but fundamentally we must ensure the source has stock.

                for (const item of items) {
                    const product = barang.find(b => b.id === item.barangId);
                    if (!product) continue;

                    let qtyToDeduct = item.jumlah;
                    // Only use fallback conversion for permintaan if konversi is not present
                    if (type === 'permintaan' && !item.konversi) {
                        if (item.satuanId && item.satuanId !== product.satuanId) {
                            const multiSatuan = product.multiSatuan?.find(ms => ms.satuanId === item.satuanId);
                            if (multiSatuan) {
                                qtyToDeduct = item.jumlah * multiSatuan.konversi;
                            }
                        }
                    } else if (item.konversi) {
                        qtyToDeduct = item.jumlah * item.konversi;
                    }

                    let availableStock = 0;
                    if (isApproverGlobal) {
                        const supplierBranchId = type === 'permintaan' ? approvalItem.targetCabangId : null; // Mutasi usually deducts from sender
                        const sourceUserId = type === 'mutasi' ? approvalItem.diajukanOleh : null;

                        if (supplierBranchId && type === 'permintaan') {
                            const branchUsersInfo = users.filter(u => u.cabangId === supplierBranchId).map(u => u.id);
                            availableStock = stokPengguna.filter(s => branchUsersInfo.includes(s.userId) && s.barangId === product.id)
                                .reduce((sum, s) => sum + s.jumlah, 0);
                        } else if (sourceUserId) {
                            const supplierStock = stokPengguna.find(s => s.userId === sourceUserId && s.barangId === product.id);
                            availableStock = supplierStock?.jumlah || 0;
                        } else {
                            // Global fallback - assume admin has enough or check admin stock
                            const adminStock = stokPengguna.find(s => s.userId === user?.id && s.barangId === product.id);
                            availableStock = adminStock?.jumlah || 0;
                        }
                    } else {
                        // Personal stock
                        const supplierStock = stokPengguna.find(s => s.userId === user?.id && s.barangId === product.id);
                        availableStock = supplierStock?.jumlah || 0;
                    }

                    if (availableStock < qtyToDeduct) {
                        return { success: false, reason: 'insufficient_stock' };
                    }
                }
            }
        }

        // 1. Handle Forward to Pusat
        if (data?.forwardToPusat) {
            const PUSAT_CABANG_ID = '550e8400-e29b-41d4-a716-446655440002';

            await updatePersetujuan(id, {
                targetCabangId: PUSAT_CABANG_ID,
                targetRole: 'finance',
                catatan: ((data?.catatan as string) || '') + `\n(Diteruskan ke Pusat oleh ${user?.nama} pada ${new Date().toLocaleString('id-ID')})`
            });

            // Notify Pusat Finance
            const pusatFinance = users.filter(u =>
                u.roles.includes('finance') &&
                (u.cabangId === PUSAT_CABANG_ID || !u.cabangId)
            );

            await Promise.all(pusatFinance.map(fUser =>
                addNotifikasi({
                    userId: fUser.id,
                    judul: 'Reimburse Diteruskan ke Pusat',
                    pesan: `${user?.nama} meneruskan pengajuan reimburse senilai ${formatRupiah((data?.amount as number) || 0)} ke Pusat.`,
                    jenis: 'info',
                    dibaca: false,
                    tanggal: new Date(),
                    link: '/persetujuan'
                })
            ));

            toast.info("Berhasil meneruskan pengajuan ke Finance Pusat.");
            return { success: true };
        }

        // 2. Update Persetujuan (Final Approval)
        await updatePersetujuan(id, {
            status: 'disetujui',
            disetujuiOleh: user?.id,
            tanggalPersetujuan: new Date()
        });

        // 3. Execute Specific Logic based on Type
        try {
            switch (type) {
                case 'setoran': {
                    const st = setoran.find(s => s.id === refId);
                    if (st) {
                        // Guard: Don't re-process if already approved
                        if (st.status === 'disetujui') {
                            toast.warning("Setoran ini sudah disetujui sebelumnya.");
                            return;
                        }

                        // Update setoran with persetujuan_id for bidirectional sync
                        await updateSetoran(refId, {
                            status: 'disetujui',
                            disetujuiOleh: user?.id,
                            persetujuanId: id
                        });

                        try {
                            // 1. Deduct saldo from Sales (Sender)
                            if (st.salesId) {
                                const salesSaldo = saldoPengguna.find(s => s.userId === st.salesId);
                                if (salesSaldo) {
                                    // Use absolute amount for consistency
                                    const amount = Number(st.jumlah);
                                    await updateSaldoPengguna(salesSaldo.id, {
                                        saldo: Number(salesSaldo.saldo) - amount,
                                        updatedAt: new Date()
                                    });
                                } else {
                                    await addSaldoPengguna({
                                        userId: st.salesId,
                                        saldo: -Number(st.jumlah),
                                        updatedAt: new Date()
                                    });
                                }
                            }

                            // 2. Add saldo to Recipient
                            const approvalItem = persetujuan.find(p => p.id === id);
                            const receiverId = approvalItem?.targetUserId || user?.id;

                            if (receiverId) {
                                const receiverSaldo = saldoPengguna.find(s => s.userId === receiverId);
                                const amount = Number(st.jumlah);
                                if (receiverSaldo) {
                                    await updateSaldoPengguna(receiverSaldo.id, {
                                        saldo: Number(receiverSaldo.saldo) + amount,
                                        updatedAt: new Date()
                                    });
                                } else {
                                    await addSaldoPengguna({
                                        userId: receiverId,
                                        saldo: amount,
                                        updatedAt: new Date()
                                    });
                                }
                                toast.success("Setoran disetujui: Saldo Sales dipotong, Saldo Penerima bertambah.");
                            } else {
                                toast.warning("Setoran disetujui, namun gagal menentukan penerima saldo.");
                            }
                        } catch (e) {
                            console.error("Gagal update saldo setoran", e);
                            toast.error("Setoran disetujui tapi gagal update saldo");
                        }
                    }
                    break;
                }

                case 'reimburse': {
                    const currentR = reimburse.find(r => r.id === refId);
                    const isAlreadyApproved = currentR?.status === 'disetujui';

                    if (!isAlreadyApproved && currentR?.status !== 'dibayar') {
                        await updateReimburse(refId, {
                            status: 'disetujui',
                            disetujuiOleh: user?.id,
                            disetujuiPada: new Date()
                        });
                    }

                    if (data?.payNow) {
                        await updateReimburse(refId, {
                            status: 'dibayar',
                            dibayarPada: new Date(),
                            metodePembayaran: 'pettycash'
                        });

                        // Create Petty Cash Expense
                        await addPettyCash({
                            tanggal: new Date(),
                            keterangan: `Bayar Reimburse: ${data?.keterangan || currentR?.keterangan || 'Pengeluaran'} (Ref: ${refId})`,
                            jumlah: Number(data?.amount || currentR?.jumlah || 0),
                            tipe: 'keluar',
                            kategori: 'Reimburse',
                            buktiUrl: data?.buktiUrl || currentR?.buktiUrl,
                            reimburseId: refId,
                            createdBy: user?.id || 'system',
                        });
                        toast.success(isAlreadyApproved ? "Pembayaran reimburse berhasil (Kas Kecil)." : "Reimburse disetujui & dibayar (masuk Kas Kecil).");
                    } else if (!isAlreadyApproved) {
                        toast.success("Reimburse disetujui (Menunggu Pembayaran).");
                    }
                    break;
                }

                case 'mutasi':
                case 'mutasi_stok': {
                    const approvalItem = persetujuan.find(p => p.id === id);
                    if (approvalItem && (approvalItem.data as PersetujuanPayload)?.items) {
                        const senderId = approvalItem.diajukanOleh;
                        const receiverId = approvalItem.targetUserId;

                        if (receiverId) {
                            const payload = approvalItem.data as { items?: { barangId: string, jumlah: number, konversi?: number }[] };
                            const itemsToProcess = payload?.items || [];
                            const senderName = users.find(u => u.id === senderId)?.nama || 'Pengirim';
                            const receiverName = users.find(u => u.id === receiverId)?.nama || 'Penerima';

                            for (const mItem of itemsToProcess) {
                                const qtyBase = mItem.jumlah * (mItem.konversi || 1);

                                // 1. Decrement Sender
                                const senderStock = stokPengguna.find(s => s.userId === senderId && s.barangId === mItem.barangId);
                                if (senderStock) {
                                    const newQty = Math.max(0, senderStock.jumlah - qtyBase);
                                    await updateStokPengguna(senderStock.id, { jumlah: newQty });
                                }

                                // 2. Increment Receiver
                                const receiverStock = stokPengguna.find(s => s.userId === receiverId && s.barangId === mItem.barangId);
                                if (receiverStock) {
                                    await updateStokPengguna(receiverStock.id, { jumlah: receiverStock.jumlah + qtyBase });
                                } else {
                                    await addStokPengguna({
                                        userId: receiverId,
                                        barangId: mItem.barangId,
                                        jumlah: qtyBase
                                    });
                                }
                            }

                            // 3. Update Mutasi Barang Status with persetujuan_id
                            // Database trigger will sync status back to persetujuan
                            if (approvalItem.referensiId) {
                                const mutasi = mutasiBarang.find(m => m.id === approvalItem.referensiId);
                                if (mutasi) {
                                    await updateMutasiBarang(approvalItem.referensiId, {
                                        status: 'disetujui',
                                        persetujuanId: id // Link for bidirectional sync
                                    });
                                }
                            }

                            toast.success(`Mutasi diterima. Stok berpindah dari ${senderName} ke ${receiverName}.`);
                        } else {
                            toast.warning('Penerima tidak spesifik, stok hanya dicatat secara administratif.');
                        }
                    }
                    break;
                }

                case 'restock': {
                    const approvalItemRestock = persetujuan.find(p => p.id === id);
                    const targetUserId = approvalItemRestock?.targetUserId || approvalItemRestock?.diajukanOleh;

                    if (data && data.barangId && data.jumlah && targetUserId) {
                        const currentItem = barang.find(b => b.id === data.barangId);
                        if (currentItem) {
                            let quantityToAdd = Number(data.jumlah);

                            // Handle Unit Conversion
                            if (data.satuanId && data.satuanId !== currentItem.satuanId) {
                                const multiSatuan = currentItem.multiSatuan?.find(ms => ms.satuanId === data.satuanId);
                                if (multiSatuan) {
                                    quantityToAdd = quantityToAdd * multiSatuan.konversi;
                                }
                            }

                            // Removed Master Stock logic

                            // Update User Stock (StokPengguna)
                            const existingStok = stokPengguna.find(s => s.userId === targetUserId && s.barangId === data.barangId);

                            if (existingStok) {
                                await updateStokPengguna(existingStok.id, {
                                    jumlah: existingStok.jumlah + quantityToAdd
                                });
                            } else {
                                await addStokPengguna({
                                    userId: targetUserId,
                                    barangId: data.barangId,
                                    jumlah: quantityToAdd
                                });
                            }

                            toast.success(`Restock disetujui. Stok ${currentItem.nama} bertambah ${quantityToAdd} unit`);
                        } else {
                            toast.error('Barang tidak ditemukan');
                        }
                    } else {
                        toast.error('Data restock tidak lengkap atau user target tidak ditemukan');
                    }
                }
                    break;
                case 'mutasi_karyawan':
                    // Logic for Employee Update
                    if (data) {
                        const d = data as PersetujuanPayload;
                        const { isCabangChanged, isStatusChanged, oldCabangId, oldStatus, ...employeeData } = d as Record<string, unknown>;
                        await updateKaryawan(refId, employeeData as Partial<Karyawan>);

                        // If Cabang changed, update linked User too
                        if (isCabangChanged) {
                            const linkedUser = users.find(u => u.karyawanId === refId);
                            if (linkedUser) {
                                await updateUser(linkedUser.id, { cabangId: String(employeeData.cabangId) });
                                toast.success(`User linked to employee updated to new branch.`);
                            }
                        }
                        toast.success('Mutasi karyawan disetujui');
                    }
                    break;
                case 'pembatalan_penjualan': {
                    const trx = penjualan.find(t => t.id === refId);
                    if (trx) {
                        await updatePenjualan(refId, { status: 'batal' });

                        // Return Stock logic
                        if (trx.items && Array.isArray(trx.items)) {
                            const sellerId = trx.salesId || trx.createdBy;
                            // Process sequentially
                            for (const item of trx.items) {
                                const qtyBase = item.jumlah * (item.konversi || 1);
                                const sellerStock = stokPengguna.find(s => s.userId === sellerId && s.barangId === item.barangId);

                                if (sellerStock) {
                                    await updateStokPengguna(sellerStock.id, { jumlah: sellerStock.jumlah + qtyBase });
                                } else {
                                    await addStokPengguna({
                                        userId: sellerId,
                                        barangId: item.barangId,
                                        jumlah: qtyBase
                                    });
                                }
                            }
                        }

                        // 1. Fetch payments for this transaction
                        const { data: payments, error: fetchPayErr } = await supabase
                            .from('pembayaran_penjualan')
                            .select('jumlah')
                            .eq('penjualan_id', refId);

                        if (!fetchPayErr && payments) {
                            const totalPaid = payments.reduce((sum, p) => sum + Number(p.jumlah), 0);

                            if (totalPaid > 0) {
                                try {
                                    const sellerId = trx.salesId || trx.createdBy;
                                    const currentSaldoRecord = saldoPengguna.find(s => s.userId === sellerId);
                                    if (currentSaldoRecord) {
                                        await updateSaldoPengguna(currentSaldoRecord.id, {
                                            saldo: currentSaldoRecord.saldo - totalPaid
                                        });
                                    } else {
                                        await addSaldoPengguna({ userId: sellerId, saldo: -totalPaid });
                                    }
                                } catch (e) {
                                    console.error("Failed to update saldo during cancellation", e);
                                }
                            }

                            // 2. Delete payments
                            const { error: delPayErr } = await supabase
                                .from('pembayaran_penjualan')
                                .delete()
                                .eq('penjualan_id', refId);

                            if (delPayErr) console.error("Failed to delete payments", delPayErr);
                        }

                        toast.success('Penjualan dibatalkan, stok dikembalikan, saldo dan pembayaran disesuaikan.');
                    }
                    break;
                }

                case 'mutasi_pelanggan':
                    if (data) {
                        const d = data as PersetujuanPayload;
                        // Check for Bulk items
                        if (d.items && Array.isArray(d.items)) {
                            for (const cust of d.items as { id: string }[]) {
                                if (cust.id && d.keSalesId) {
                                    await updatePelanggan(cust.id, { salesId: d.keSalesId });
                                }
                            }
                            toast.success(`Mutasi ${d.items.length} pelanggan berhasil diproses`);
                        } else if (d.keSalesId) {
                            // Fallback for single legacy
                            await updatePelanggan(refId as string, { salesId: d.keSalesId });
                            toast.success('Mutasi pelanggan berhasil diproses');
                        }
                    }
                    break;

                case 'perubahan_harga':
                    if (data) {
                        const d = data as PersetujuanPayload;
                        // Check if it's a new item or update
                        if (d.isNew || !refId || (typeof refId === 'string' && refId.length === 0)) {
                            // CREATE NEW
                            const newId = d.id || self.crypto.randomUUID();
                            await addHarga({
                                id: newId,
                                barangId: d.barangId as string,
                                satuanId: d.satuanId as string,
                                harga: d.hargaBaru as number,
                                minQty: d.minQty || 1,
                                cabangId: d.cabangId as string,
                                kategoriPelangganIds: d.kategoriPelangganIds || [],
                                grosir: d.grosir || [],
                                tanggalEfektif: d.tanggalEfektif ? new Date(d.tanggalEfektif as string) : new Date(),
                                status: 'disetujui',
                                disetujuiOleh: user?.id
                            });
                        } else {
                            // UPDATE EXISTING
                            await updateHarga(refId, {
                                barangId: d.barangId as string,
                                satuanId: d.satuanId as string,
                                harga: d.hargaBaru as number,
                                minQty: d.minQty as number,
                                cabangId: d.cabangId as string,
                                kategoriPelangganIds: d.kategoriPelangganIds || [],
                                grosir: d.grosir || [],
                                tanggalEfektif: d.tanggalEfektif ? new Date(d.tanggalEfektif as string) : undefined,
                                status: 'disetujui',
                                disetujuiOleh: user?.id
                            });
                        }
                        toast.success('Perubahan harga disetujui & diterapkan');
                    } else {
                        // Fallback for old requests
                        await updateHarga(refId, {
                            status: 'disetujui',
                            disetujuiOleh: user?.id
                        });
                        toast.success('Perubahan harga disetujui');
                    }
                    break;

                case 'promo':
                    if (data) {
                        const payload = data as PersetujuanPayload;
                        const { isNew, ...promoData } = payload as Record<string, unknown>;

                        if (isNew || !refId || (typeof refId === 'string' && refId.startsWith('new-'))) {
                            // CREATE NEW
                            // Map isActive (frontend) to aktif (db), maxApply to max_apply
                            const { isActive, maxApply, minQty, isKelipatan, tanggalMulai, tanggalBerakhir, targetProdukIds, ...rest } = promoData;
                            const finalPayload = {
                                ...rest,
                                aktif: (isActive !== undefined ? isActive : true) as unknown,
                                max_apply: maxApply as unknown,
                                min_qty: minQty as unknown,
                                is_kelipatan: isKelipatan as unknown,
                                berlaku_mulai: tanggalMulai ? new Date(tanggalMulai as string) : undefined as unknown,
                                berlaku_sampai: tanggalBerakhir ? new Date(tanggalBerakhir as string) : undefined as unknown,
                                target_produk_ids: targetProdukIds as unknown
                            };

                            await addPromo(finalPayload as unknown as import('@/lib/types').Promo);
                        } else {
                            // UPDATE EXISTING
                            const { isActive, maxApply, minQty, isKelipatan, tanggalMulai, tanggalBerakhir, targetProdukIds, ...rest } = promoData;
                            const finalPayload = {
                                ...rest,
                                aktif: (isActive !== undefined ? isActive : true) as unknown,
                                max_apply: maxApply as unknown,
                                min_qty: minQty as unknown,
                                is_kelipatan: isKelipatan as unknown,
                                berlaku_mulai: tanggalMulai ? new Date(tanggalMulai as string) : undefined as unknown,
                                berlaku_sampai: tanggalBerakhir ? new Date(tanggalBerakhir as string) : undefined as unknown,
                                target_produk_ids: targetProdukIds as unknown
                            };

                            await updatePromo(refId, finalPayload as unknown as import('@/lib/types').Promo);
                        }
                        toast.success('Promo disetujui & diterapkan');
                    } else {
                        // Basic fallback
                        await updatePromo(refId, { aktif: true } as unknown as import('@/lib/types').Promo);
                        toast.success('Promo disetujui');
                    }
                    break;
                case 'permintaan': {
                    const approvalItemRequest = persetujuan.find(p => p.id === id);
                    if (!approvalItemRequest || !approvalItemRequest.data) return;

                    const requesterUserId = approvalItemRequest.diajukanOleh;
                    const isApproverGlobal = user?.roles.includes('admin') || user?.roles.includes('owner') || user?.roles.includes('gudang');
                    const targetUserId = approvalItemRequest.targetUserId;

                    const items = (approvalItemRequest.data as PersetujuanPayload).items as { barangId: string; jumlah: number; satuanId?: string }[];

                    // PRE-VALIDATION LOOP: Check if approver has enough stock
                    // Special case: If this is directed to a specific user (targetUserId exists and matches current user or approver is that user), Validate their stock.
                    // Or if they are acting as a Non-Global approver, check their personal stock.
                    if (!isApproverGlobal || (targetUserId && targetUserId === user?.id)) {
                        for (const item of items) {
                            const product = barang.find(b => b.id === item.barangId);
                            if (!product) continue;

                            let qtyInBaseUnit = item.jumlah;
                            if (item.satuanId && item.satuanId !== product.satuanId) {
                                const multiSatuan = product.multiSatuan?.find(ms => ms.satuanId === item.satuanId);
                                if (multiSatuan) qtyInBaseUnit = item.jumlah * multiSatuan.konversi;
                            }

                            const approverStockInfo = stokPengguna.find(s => s.userId === user?.id && s.barangId === product.id);
                            const currentStock = approverStockInfo ? approverStockInfo.jumlah : 0;

                            if (currentStock < qtyInBaseUnit) {
                                throw new Error(`Stok Anda tidak mencukupi untuk barang ${product.nama}. Diminta: ${qtyInBaseUnit}, Tersedia: ${currentStock}`);
                            }
                        }
                    }

                    for (const item of items) {
                        const product = barang.find(b => b.id === item.barangId);
                        if (!product) continue;

                        let qtyInBaseUnit = item.jumlah;

                        // Convert to Base Unit if needed
                        if (item.satuanId && item.satuanId !== product.satuanId) {
                            const multiSatuan = product.multiSatuan?.find(ms => ms.satuanId === item.satuanId);
                            if (multiSatuan) {
                                qtyInBaseUnit = item.jumlah * multiSatuan.konversi;
                            }
                        }

                        // A. DEDUCT STOCK FROM SUPPLIER (Approver Context)
                        if (isApproverGlobal && !targetUserId) {
                            const supplierBranchId = approvalItemRequest.targetCabangId;
                            let remainingToDeduct = qtyInBaseUnit;
                            const supplierBranchUsers = users.filter(u => u.cabangId === supplierBranchId);

                            // distribute deduction among branch users with stock
                            for (const supplierUser of supplierBranchUsers) {
                                if (remainingToDeduct <= 0) break;
                                const supplierStock = stokPengguna.find(s => s.userId === supplierUser.id && s.barangId === product.id);
                                if (supplierStock && supplierStock.jumlah > 0) {
                                    const deductAmount = Math.min(supplierStock.jumlah, remainingToDeduct);
                                    await updateStokPengguna(supplierStock.id, { jumlah: supplierStock.jumlah - deductAmount });
                                    remainingToDeduct -= deductAmount;
                                }
                            }

                            // if branch doesn't have enough, force deduct from the first branch member or current admin
                            if (remainingToDeduct > 0) {
                                const fallbackUserId = supplierBranchUsers.length > 0 ? supplierBranchUsers[0].id : user?.id;
                                if (fallbackUserId) {
                                    const fallbackStock = stokPengguna.find(s => s.userId === fallbackUserId && s.barangId === product.id);
                                    if (fallbackStock) {
                                        await updateStokPengguna(fallbackStock.id, { jumlah: fallbackStock.jumlah - remainingToDeduct });
                                    } else {
                                        await addStokPengguna({
                                            userId: fallbackUserId,
                                            barangId: product.id,
                                            jumlah: -remainingToDeduct
                                        });
                                    }
                                }
                            }
                        } else {
                            // Deduct Personal Stock of Target Approver (could be themselves if they are the target)
                            const deductFromUserId = targetUserId || user?.id;
                            const supplierStock = stokPengguna.find(s => s.userId === deductFromUserId && s.barangId === product.id);

                            if (supplierStock) {
                                const newStok = Math.max(0, supplierStock.jumlah - qtyInBaseUnit);
                                await updateStokPengguna(supplierStock.id, { jumlah: newStok });
                            } else if (deductFromUserId) {
                                // Technically this shouldn't be reached if validation is passed, but just in case
                                await addStokPengguna({
                                    userId: deductFromUserId,
                                    barangId: product.id,
                                    jumlah: -qtyInBaseUnit
                                });
                            }
                        }

                        // B. ADD STOCK TO REQUESTER (Source)
                        const requesterStock = stokPengguna.find(s => s.userId === requesterUserId && s.barangId === product.id);
                        if (requesterStock) {
                            await updateStokPengguna(requesterStock.id, { jumlah: requesterStock.jumlah + qtyInBaseUnit });
                        } else {
                            await addStokPengguna({
                                userId: requesterUserId,
                                barangId: product.id,
                                jumlah: qtyInBaseUnit
                            });
                        }
                    }

                    // Update Permintaan Barang Status with persetujuan_id
                    // Database trigger will sync status back to persetujuan
                    if (approvalItemRequest.referensiId) {
                        await updatePermintaanBarang(approvalItemRequest.referensiId, {
                            status: 'selesai',
                            persetujuanId: id // Link for bidirectional sync
                        });
                    }

                    toast.success('Permintaan Barang disetujui');
                    break;
                }
                case 'perubahan_data_pelanggan':
                    if (data) {
                        await updatePelanggan(refId, data);
                        toast.success('Data pelanggan berhasil diperbarui');
                    }
                    break;
                case 'opname':
                case 'penyesuaian_stok': {
                    const approvalItemPenyesuaian = persetujuan.find(p => p.id === id);
                    if (approvalItemPenyesuaian?.referensiId) {
                        const penyesuaian = penyesuaianStok.find(ps => ps.id === approvalItemPenyesuaian.referensiId);
                        if (penyesuaian) {
                            // Update Penyesuaian Stok status with persetujuan_id
                            // Database trigger will sync status back to persetujuan
                            await updatePenyesuaianStok(approvalItemPenyesuaian.referensiId, {
                                status: 'disetujui',
                                persetujuanId: id // Link for bidirectional sync
                            });

                            // Apply stock adjustment to barang
                            // Get stokFisik from persetujuan data payload since PenyesuaianStok uses 'selisih'
                            const payload = approvalItemPenyesuaian.data as PersetujuanPayload;
                            const stokFisik = payload?.stokFisik;
                            const requesterId = approvalItemPenyesuaian.diajukanOleh;

                            const product = barang.find(b => b.id === penyesuaian.barangId);
                            if (product && stokFisik !== undefined) {
                                // 1. Global Stock removal

                                // 2. Update Personal Stock of Requester
                                const personalStock = stokPengguna.find(s => s.userId === requesterId && s.barangId === product.id);
                                if (personalStock) {
                                    await updateStokPengguna(personalStock.id, { jumlah: stokFisik });
                                } else {
                                    await addStokPengguna({
                                        userId: requesterId,
                                        barangId: product.id,
                                        jumlah: stokFisik
                                    });
                                }
                                toast.success(`Penyesuaian stok disetujui. Stok ${product.nama} disesuaikan menjadi ${stokFisik}`);
                            } else if (product) {
                                // Fallback logic doesn't use master stock anymore

                                // 2. Update Personal Stock of Requester
                                const personalStock = stokPengguna.find(s => s.userId === requesterId && s.barangId === product.id);
                                if (personalStock) {
                                    await updateStokPengguna(personalStock.id, { jumlah: personalStock.jumlah + penyesuaian.selisih });
                                } else {
                                    await addStokPengguna({
                                        userId: requesterId,
                                        barangId: product.id,
                                        jumlah: personalStock ? personalStock.jumlah + penyesuaian.selisih : penyesuaian.selisih
                                    });
                                }
                                toast.success(`Penyesuaian stok disetujui. Stok ${product.nama} disesuaikan sebesar ${penyesuaian.selisih > 0 ? '+' : ''}${penyesuaian.selisih}`);
                            } else {
                                toast.success('Penyesuaian stok disetujui');
                            }
                        } else {
                            toast.success('Penyesuaian stok disetujui');
                        }
                    } else if (data) {
                        // Fallback for opname via data payload
                        const d = data as { barangId: string, fisik: number, satuanId: string };
                        const product = barang.find(b => b.id === d.barangId);
                        if (product && d.fisik !== undefined) {
                            // No master stock update
                            toast.success(`Opname disetujui. Stok ${product.nama} disesuaikan menjadi ${d.fisik}`);
                        }
                    }
                    break;
                }

                // Rencana Setoran (Setor Pusat)
                case 'rencana_setoran': {
                    const approvalItem = persetujuan.find(p => p.id === id);
                    if (approvalItem && approvalItem.data) {
                        const payload = approvalItem.data as PersetujuanPayload;
                        const amount = Number(payload.amount || 0);
                        const senderId = approvalItem.diajukanOleh;

                        if (amount > 0 && senderId) {
                            try {
                                const senderSaldo = saldoPengguna.find(s => s.userId === senderId);
                                if (senderSaldo) {
                                    await updateSaldoPengguna(senderSaldo.id, {
                                        saldo: Number(senderSaldo.saldo) - amount,
                                        updatedAt: new Date()
                                    });
                                } else {
                                    // Fallback: create record with negative balance if not exists
                                    await addSaldoPengguna({
                                        userId: senderId,
                                        saldo: -amount,
                                        updatedAt: new Date()
                                    });
                                }
                                toast.success(`Rencana setoran disetujui. Saldo terpotong ${formatRupiah(amount)}.`);
                            } catch (e) {
                                console.error("Gagal update saldo rencana_setoran", e);
                                toast.error("Rencana setoran disetujui tapi gagal update saldo");
                            }
                        } else {
                            toast.success('Rencana setoran disetujui');
                        }
                    } else {
                        toast.success('Rencana setoran disetujui');
                    }
                    break;
                }
            }
        } catch (err) {
            console.error("Error executing approval logic", err);
            toast.error("Gagal memproses logika bisnis");
            return { success: false, reason: 'error_processing' }; // Don't proceed to notification
        }

        const item = persetujuan.find(p => p.id === id);
        if (item) {
            const formattedType = type === 'rencana_setoran' ? 'Setoran ke Pusat' : type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            let rincian = '';
            let extraInfo = '';

            if (type === 'setoran') {
                const st = setoran.find(s => s.id === refId);
                const bankName = rekeningBank.find(r => r.id === st?.rekeningId)?.namaBank || 'Bank';
                rincian = st ? `sebesar ${formatRupiah(st.jumlah)}` : '';
                extraInfo = st ? ` ke rekening ${bankName}` : '';
            } else if (type === 'restock' && data) {
                const d = data as PersetujuanPayload;
                rincian = `${d.jumlah} ${getUnitName(d.satuanId)} ${d.namaBarang}`;
            } else if (type === 'mutasi' && data) {
                const d = data as PersetujuanPayload;
                const receiverName = users.find(u => u.id === item.targetUserId)?.nama || 'Penerima';
                const details = (d.items || []).map((mItem) => {
                    const typedItem = mItem as { barangId: string; jumlah: number; satuanId?: string };
                    const b = barang.find(x => x.id === typedItem.barangId);
                    const s = satuanList.find(x => x.id === typedItem.satuanId);
                    return `${b?.nama || 'Barang'} ${typedItem.jumlah} ${s?.simbol || ''}`;
                }).join(', ');
                rincian = `${details} yang kamu kirim ke ${receiverName}`;
            }
            // ... Add other description builders here if critical, or keep simple generic message

            addNotifikasi({
                userId: item.diajukanOleh,
                judul: `Hore! ${formattedType} Berhasil Disetujui`,
                pesan: `Selamat! Pengajuan ${formattedType} kamu ${rincian}${extraInfo} sudah disetujui sama ${user?.nama || 'Admin'}. Cek riwayatnya ya!`,
                jenis: 'success',
                dibaca: false,
                tanggal: new Date(),
                link: '/persetujuan?tab=riwayat'
            });
        }
        return { success: true };
    };

    const executeReject = async (id: string, type: string, refId: string, reason?: string) => {
        // Update persetujuan status
        await updatePersetujuan(id, {
            status: 'ditolak',
            disetujuiOleh: user?.id,
            tanggalPersetujuan: new Date(),
            catatan: reason
        });

        // Database triggers will automatically sync status to related tables
        // We only need to handle special rejection logic that's NOT just status updates

        // Note: Most status updates (setoran, reimburse, mutasi, etc.) are now handled by triggers
        // Only keep logic that requires additional business rules beyond status sync

        const item = persetujuan.find(p => p.id === id);
        if (item) {
            const formattedType = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            addNotifikasi({
                userId: item.diajukanOleh,
                judul: `Yah, ${formattedType} Ditolak`,
                pesan: `Maaf ya, pengajuan ${formattedType} kamu ditolak sama ${user?.nama || 'Admin'}. ${reason ? `Alasannya: "${reason}"` : ''} Coba cek lagi atau tanya langsung ya!`,
                jenis: 'warning',
                dibaca: false,
                tanggal: new Date(),
                link: '/persetujuan?tab=riwayat'
            });
        }
        toast.info("Pengajuan telah ditolak");
    };

    return { executeApprove, executeReject };
};
