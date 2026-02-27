import { formatRupiah, formatNumber } from '@/lib/utils';
import { ProfilPerusahaan } from '@/lib/types';
import { QRCodeCanvas } from 'qrcode.react';

export interface SalesRecapItem {
  cabang: string;
  tanggal: string;
  kategoriPelanggan: string;
  produk: { [namaProduk: string]: number };
  produkRp: { [namaProduk: string]: number };
}

export interface SetoranPusatData {
  id: string;
  status: string;
  salesRecap: SalesRecapItem[];
  productNames: string[];
  deposit: {
    amount: number;
    cashAmount: number;
    transferAmount: number;
    transfers: {
      bankName: string;
      amount: number;
      proofUrl?: string;
    }[];
    pecahan?: { [denom: string]: number };
    generalProofUrl?: string;
    catatan?: string;
  };
}

interface SetoranPusatPrintTemplateProps {
  id: string;
  startDate: Date;
  endDate: Date;
  companyProfile: ProfilPerusahaan;
  data: SetoranPusatData;
  branchName: string;
  requestedBy: string;
}

export function SetoranPusatPrintTemplate({ 
  id, 
  startDate, 
  endDate, 
  companyProfile, 
  data, 
  branchName,
  requestedBy 
}: SetoranPusatPrintTemplateProps) {
  const formatTableDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div id={id} className="bg-white text-slate-900 font-sans text-[10px] leading-tight p-8" style={{ width: '210mm', minHeight: '297mm' }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-slate-200">
        <div className="space-y-2">
          <h1 className="text-xl font-bold uppercase tracking-tight text-slate-800">Laporan Setoran Pusat</h1>
          <div className="grid grid-cols-[80px_1fr] gap-y-1 text-xs">
            <span className="text-slate-500">Cabang</span>
            <span className="font-semibold">: {branchName}</span>
            <span className="text-slate-500">Periode</span>
            <span className="font-semibold">: {startDate.toLocaleDateString('id-ID')} - {endDate.toLocaleDateString('id-ID')}</span>
            <span className="text-slate-500">Penyetor</span>
            <span className="font-semibold">: {requestedBy}</span>
          </div>
        </div>

        <div className="text-right flex flex-col items-end">
          <div className={`px-3 py-1 rounded text-xs font-bold uppercase mb-2 ${
            data.status === 'disetujui' ? 'bg-green-100 text-green-700' :
            data.status === 'ditolak' ? 'bg-red-100 text-red-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {data.status === 'disetujui' ? 'DITERIMA / TERCATAT' : data.status}
          </div>
          <h2 className="text-lg font-black text-slate-800">{companyProfile.nama}</h2>
          <p className="text-[9px] text-slate-500 max-w-[200px] ml-auto">
            {companyProfile.alamat}
          </p>
          {companyProfile.logoUrl && (
            <img src={companyProfile.logoUrl} alt="Logo" className="w-12 h-12 object-contain ml-auto mt-2" />
          )}
        </div>
      </div>

      {/* Rekap Penjualan Section */}
      <div className="mb-8">
        <div className="bg-slate-100 p-2 font-bold text-xs uppercase mb-2 border-l-4 border-indigo-600">
          I. Rekap Penjualan (Berdasarkan Kategori & Produk)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[8px] text-left border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-50 uppercase font-bold text-slate-600">
                <th className="border border-slate-200 p-2">Produk</th>
                {data.salesRecap.map((row, idx) => (
                  <th key={idx} className="border border-slate-200 p-1 text-center min-w-[60px]">
                    {formatTableDate(row.tanggal)}<br/>
                    <span className="text-[7px] text-slate-400">{row.kategoriPelanggan}</span>
                  </th>
                ))}
                <th className="border border-slate-200 p-2 text-center bg-slate-100 min-w-[80px]">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              {data.productNames.map((name, pIdx) => {
                let rowQty = 0;
                let rowRp = 0;
                return (
                  <tr key={pIdx} className="text-slate-700">
                    <td className="border border-slate-200 p-2 font-medium bg-slate-50">{name}</td>
                    {data.salesRecap.map((row, rIdx) => {
                      const qty = row.produk[name] || 0;
                      const rp = row.produkRp[name] || 0;
                      rowQty += qty;
                      rowRp += rp;
                      return (
                        <td key={rIdx} className="border border-slate-200 p-1 text-center">
                          <div className="font-bold">{qty > 0 ? formatNumber(qty) : '-'}</div>
                          {rp > 0 && <div className="text-[7px] text-slate-500">{formatRupiah(rp)}</div>}
                        </td>
                      );
                    })}
                    <td className="border border-slate-200 p-1 text-center font-bold bg-slate-100">
                      <div>{formatNumber(rowQty)}</div>
                      <div className="text-[7px] text-indigo-600">{formatRupiah(rowRp)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold">
                <td className="border border-slate-200 p-2 text-right uppercase text-[8px]">Grand Total</td>
                {data.salesRecap.map((row, rIdx) => {
                  const colQty = Object.values(row.produk).reduce((a, b) => a + b, 0);
                  const colRp = Object.values(row.produkRp).reduce((a, b) => a + b, 0);
                  return (
                    <td key={rIdx} className="border border-slate-200 p-1 text-center bg-slate-200">
                    <div>{formatNumber(colQty)}</div>
                    <div className="text-[7px] text-indigo-700">{formatRupiah(colRp)}</div>
                  </td>
                  );
                })}
                <td className="border border-slate-200 p-1 text-center bg-slate-300">
                  <div className="text-xs">
                    {formatNumber(data.salesRecap.reduce((sum, row) => sum + Object.values(row.produk).reduce((a, b) => a + b, 0), 0))}
                  </div>
                  <div className="text-[8px] text-indigo-800">
                    {formatRupiah(data.salesRecap.reduce((sum, row) => sum + Object.values(row.produkRp).reduce((a, b) => a + b, 0), 0))}
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Rincian Setoran Section */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <div className="bg-slate-100 p-2 font-bold text-xs uppercase mb-2 border-l-4 border-green-600">
            II. Rincian Setoran
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-slate-500 uppercase tracking-wider text-[9px]">Total Penjualan (Tabel)</span>
              <span className="font-semibold text-slate-600">{formatRupiah(data.salesRecap.reduce((sum, row) => sum + Object.values(row.produkRp).reduce((a, b) => a + b, 0), 0))}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-indigo-100">
              <span className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">Total Setoran</span>
              <span className="font-bold text-lg text-indigo-700">{formatRupiah(data.deposit.amount)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Tunai</span>
              <span className="font-semibold">{formatRupiah(data.deposit.cashAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Transfer</span>
              <span className="font-semibold">{formatRupiah(data.deposit.transferAmount)}</span>
            </div>
            
            {data.deposit.pecahan && Object.keys(data.deposit.pecahan).length > 0 && (
              <div className="mt-4 border rounded p-2 bg-emerald-50/50">
                <p className="text-[9px] font-bold text-emerald-600 uppercase mb-2">Rincian Tunai:</p>
                <div className="space-y-1">
                  {Object.entries(data.deposit.pecahan)
                    .sort(([a], [b]) => Number(b) - Number(a))
                    .map(([denom, count]) => (
                      <div key={denom} className="flex justify-between text-[8px]">
                        <span>{formatRupiah(Number(denom))} x {formatNumber(count)}</span>
                        <span className="font-medium">{formatRupiah(Number(denom) * count)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
            
            {data.deposit.transfers.length > 0 && (
              <div className="mt-4 border rounded p-2 bg-slate-50/50">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Detail Transfer:</p>
                <div className="space-y-2">
                  {data.deposit.transfers.map((t, i) => (
                    <div key={i} className="flex justify-between text-[10px]">
                      <span>{t.bankName}</span>
                      <span className="font-medium">{formatRupiah(t.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
           <div className="bg-slate-100 p-2 font-bold text-xs uppercase mb-2 border-l-4 border-yellow-600">
            III. Catatan & Validasi Sistem
          </div>
          <div className="border rounded p-3 h-24 mb-4 text-slate-600 italic">
            {data.deposit.catatan || 'Tidak ada catatan.'}
          </div>
          <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
            <QRCodeCanvas 
              value={`CVSKJ-PST-${data.id}`} 
              size={80}
              level="H"
              includeMargin={false}
            />
            <p className="text-[8px] text-slate-400 mt-2 font-mono uppercase tracking-tighter">
              VALIDATED BY CVSKJ SYSTEM • {new Date().toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </div>

      {/* Proof Section */}
      {(data.deposit.transfers.some(t => t.proofUrl) || data.deposit.generalProofUrl) && (
        <div className="page-break-before-always mt-8">
          <div className="bg-slate-100 p-2 font-bold text-xs uppercase mb-4 border-l-4 border-blue-600">
            IV. Lampiran Bukti Transaksi
          </div>
          <div className="grid grid-cols-2 gap-4">
            {data.deposit.generalProofUrl && (
              <div className="border rounded-lg p-2 bg-slate-50 space-y-2">
                <div className="text-[9px] font-bold text-slate-500 uppercase border-b pb-1">
                  Bukti Setoran Umum / Tunai
                </div>
                <img 
                  src={data.deposit.generalProofUrl} 
                  alt="Bukti Umum" 
                  className="w-full h-auto object-contain rounded border"
                  style={{ maxHeight: '350px' }}
                />
              </div>
            )}
            {data.deposit.transfers.filter(t => t.proofUrl).map((t, i) => (
              <div key={i} className="border rounded-lg p-2 bg-slate-50 space-y-2">
                <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase border-b pb-1">
                  <span>Bukti #{i + 1}</span>
                  <span>{t.bankName} - {formatRupiah(t.amount)}</span>
                </div>
                <img 
                  src={t.proofUrl} 
                  alt={`Bukti ${i + 1}`} 
                  className="w-full h-auto object-contain rounded border"
                  style={{ maxHeight: '250px' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
