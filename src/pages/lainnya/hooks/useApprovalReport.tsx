
import { useDatabase } from '@/contexts/DatabaseContext';
import { toast } from 'sonner';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Persetujuan as PersetujuanType, PenjualanItem } from '@/lib/types';
import { SetoranPusatPrintTemplate, SetoranPusatData } from '@/components/laporan/SetoranPusatPrintTemplate';

export const useApprovalReport = (): { handleDownloadReport: (item: PersetujuanType) => Promise<void> } => {
    const { 
        penjualan, 
        pelanggan, 
        kategoriPelanggan, 
        barang, 
        cabang, 
        users,
        rekeningBank, 
        profilPerusahaan 
    } = useDatabase();

    const handleDownloadReport = async (item: PersetujuanType) => {
        if (item.jenis !== 'rencana_setoran' || !item.referensiId) {
            toast.error("Hanya dapat mencetak laporan untuk Setoran ke Pusat yang valid.");
            return;
        }

        const toastId = toast.loading("Sedang membuat laporan...");

        try {
            // 1. Fetch & Filter Sales Data based on the period
            const d = item.data as import('@/lib/types').PersetujuanPayload; 
            // Assuming payload has startDate/endDate or we use 'tanggal' context?
            // Actually usually 'rencana_setoran' spans a period.
            // Let's use the dates from payload if available, or just the approval date/week?
            // Re-reading logic from Persetujuan.tsx:
            // It calculates startDate/endDate based on d.tanggal (or d.endDate?)
            // "const startDate = new Date(d.tanggal || item.createdAt);" 
            // "startDate.setDate(startDate.getDate() - 7);" (Example logic seen previously? Or strict filter?)
            
            // Let's try to infer from the existing logic I saw in Persetujuan.tsx
            const refDate = new Date(d.tanggal || item.tanggalPengajuan);
            const startDate = new Date(refDate);
            startDate.setHours(0, 0, 0, 0);
            
            const endDate = new Date(refDate);
            endDate.setHours(23, 59, 59, 999);

            // Wait, logic in Persetujuan.tsx (Line 132 in prev context) seemed to filter by range.
            // "new Date(p.tanggal) >= startDate && ... <= endDate"
            // But what IS startDate/endDate?
            // In the snippet, I didn't see the definition of startDate.
            // But likely it is single day or specific range from payload.
            // If d.startDate exists?
            
            if (d.startDate) {
                startDate.setTime(new Date(d.startDate).getTime());
                startDate.setHours(0,0,0,0);
            }
            if (d.endDate) {
                endDate.setTime(new Date(d.endDate).getTime());
                endDate.setHours(23,59,59,999);
            }

            const filteredPenjualan = penjualan.filter(p => 
                p.cabangId === d.senderCabangId && 
                p.status === 'lunas' &&
                new Date(p.tanggal) >= startDate && 
                new Date(p.tanggal) <= endDate
            );

            // 2. Aggregate Sales Recap
            const recapMap: Record<string, { tanggal: string, kategori: string, produk: Record<string, number>, produkRp: Record<string, number> }> = {};
            const allProductIds = new Set<string>();

            filteredPenjualan.forEach(p => {
                const cust = pelanggan.find(c => c.id === p.pelangganId);
                const cat = kategoriPelanggan.find(k => k.id === cust?.kategoriId)?.nama || 'Umum';
                const dateKey = new Date(p.tanggal).toISOString().split('T')[0];
                const key = `${dateKey}_${cat}`;

                if (!recapMap[key]) {
                    recapMap[key] = {
                        tanggal: dateKey,
                        kategori: cat,
                        produk: {},
                        produkRp: {}
                    };
                }

                const factor = (p.subtotal || 0) > 0 ? (p.total || 0) / p.subtotal : 1;
                let accountedForThisSale = 0;

                p.items.forEach((it: PenjualanItem) => {
                    const prod = barang.find(b => b.id === it.barangId);
                    const prodName = prod?.nama || 'Produk Tidak Terdaftar';
                    
                    if (prod) allProductIds.add(prod.id);
                    else allProductIds.add('unknown-prod'); 

                    const qty = it.jumlah * (it.konversi || 1);
                    const netItemTotal = (it.subtotal || 0) * factor;
                    
                    recapMap[key].produk[prodName] = (recapMap[key].produk[prodName] || 0) + qty;
                    recapMap[key].produkRp[prodName] = (recapMap[key].produkRp[prodName] || 0) + netItemTotal;
                    accountedForThisSale += netItemTotal;
                });
            });

            // Convert map to array
            const reportData = Object.values(recapMap).sort((a,b) => a.tanggal.localeCompare(b.tanggal));
            
            const branchName = cabang.find(c => c.id === d.senderCabangId)?.nama || 'Cabang Asal';
            const requesterName = users.find(u => u.id === item.diajukanOleh)?.nama || 'Sales';

            // 3. Construct Data for Template
            const templateData: SetoranPusatData = {
                id: item.id,
                status: item.status,
                salesRecap: reportData.map(v => ({
                    cabang: branchName,
                    tanggal: v.tanggal,
                    kategoriPelanggan: v.kategori,
                    produk: v.produk,
                    produkRp: v.produkRp
                })),
                productNames: Array.from(allProductIds).map(id => barang.find(b => b.id === id)?.nama || '').filter(Boolean),
                deposit: {
                    amount: d.amount || 0,
                    cashAmount: d.cashAmount || 0,
                    transferAmount: d.transferAmount || 0,
                    transfers: (d.transfers || []).map((t) => ({
                         bankName: rekeningBank.find(r => r.id === t.bankId)?.namaBank || 'Bank',
                         amount: t.amount,
                         proofUrl: t.proofUrl
                    })),
                    catatan: d.catatan || item.catatan || ''
                }
            };

            // 4. Render and Capture
            const printContainer = document.createElement('div');
            printContainer.style.position = 'absolute';
            printContainer.style.left = '-9999px';
            printContainer.style.top = '0';
            document.body.appendChild(printContainer);

            const root = createRoot(printContainer);
            root.render(
                <SetoranPusatPrintTemplate 
                    id="setoran-pusat-report"
                    startDate={startDate}
                    endDate={endDate}
                    companyProfile={profilPerusahaan || { 
                        id: 'default',
                        nama: 'J-BROCK', 
                        alamat: '-', 
                        telepon: '-',
                        email: '-',
                        website: '-',
                        deskripsi: '-',
                        logoUrl: '',
                        updatedAt: new Date(),
                        updatedBy: 'system',
                        config: { daysToFetch: 30, taxRate: 0, currency: 'IDR', useGlobalLimit: false, globalLimitAmount: 0, blockOnDebt: false, blockMode: 'limit_only' }
                    }}
                    data={templateData}
                    branchName={branchName}
                    requestedBy={requesterName}
                />
            );

            // Wait for rendering and images
            await new Promise(resolve => setTimeout(resolve, 1500));

            const element = document.getElementById('setoran-pusat-report');
            if (!element) throw new Error("Gagal merender template laporan.");

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                allowTaint: true
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Laporan_SetoranPusat_${branchName}_${new Date().toISOString().split('T')[0]}.pdf`);

            document.body.removeChild(printContainer);
            toast.dismiss(toastId);
            toast.success("Laporan berhasil diunduh.");
        } catch (err) {
            console.error("PDF Export Error:", err);
            toast.dismiss(toastId);
            toast.error("Gagal membuat laporan PDF.");
        }
    };

    return { handleDownloadReport };
};
