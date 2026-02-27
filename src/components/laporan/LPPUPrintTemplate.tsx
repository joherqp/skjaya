import { formatRupiah } from '@/lib/utils';
import { ProfilPerusahaan } from '@/lib/types';

export interface LPPUData {
  salesSummary: {
    kategori: string;
    produk: string;
    qty: number;
    harga: number;
    potongan: number;
    total: number;
  }[];
  notes: {
    no: number;
    toko: string;
    faktur: string;
    telp: string;
    area: string;
    catatan: string;
    total: number;
  }[];
  stockHistory: {
    produk: string;
    stockAwal: number;
    masuk: number;
    keluar: number;
    terjual: number;
    promo: number;
    stockAkhir: number;
  }[];
  bills: {
    tanggal: string;
    kategori: string;
    toko: string;
    produk: string;
    qty: number;
    sisaTagihan: number;
  }[];
  totals: {
    penjualanHariIni: number;
    setoranTunai: number;
    totalSetoran: number;
    pendingSetoran: number;
    saldoSebelumnya: number;
    saldoAkhir: number;
    currentSaldo: number;
  };
}

interface LPPUPrintTemplateProps {
  id: string;
  date: Date;
  salesName: string;
  companyProfile: ProfilPerusahaan;
  data: LPPUData;
  cabangName?: string;
}

export function LPPUPrintTemplate({ id, date, salesName, companyProfile, data, cabangName }: LPPUPrintTemplateProps) {
  return (
    <div id={id} className="bg-white text-slate-900 font-sans text-[10px] leading-tight p-8" style={{ width: '210mm', minHeight: '297mm' }}>
      {/* Modern Header */}
      <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-100">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-slate-800">Laporan Penjualan</h1>
            <p className="text-sm text-slate-500 font-medium uppercase tracking-widest">& Penerimaan Uang (LPPU)</p>
          </div>

          <div className="grid grid-cols-[110px_1fr] gap-y-1.5 text-xs">
            <span className="text-slate-400 font-medium uppercase tracking-wider text-[9px]">Hari, Tanggal</span>
            <span className="font-semibold text-slate-700 uppercase">
              {date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>

            <span className="text-slate-400 font-medium uppercase tracking-wider text-[9px]">Salesman</span>
            <span className="font-semibold text-slate-700 uppercase">{salesName}</span>

            <span className="text-slate-400 font-medium uppercase tracking-wider text-[9px]">Area Coverage</span>
            <span className="font-medium text-slate-600 uppercase">{cabangName || 'General'}</span>
          </div>
        </div>

        <div className="text-right space-y-2">
          <div className="flex flex-col items-end">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">{companyProfile.nama || 'CV. SKJ'}</h2>
            <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed mt-1">
              {companyProfile.alamat} <br />
              {companyProfile.telepon} | {companyProfile.email}
            </p>
          </div>
          {companyProfile.logoUrl && (
            <div className="mt-2">
              <img src={companyProfile.logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
            </div>
          )}
        </div>
      </div>

      {/* PENJUALAN TUNAI */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Penjualan Tunai</h3>
        </div>

        <table className="w-full text-left">
          <thead className="border-b border-slate-200">
            <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-2 pl-2">Kategori</th>
              <th className="py-2">Produk</th>
              <th className="py-2 text-center">Qty</th>
              <th className="py-2 text-right">Harga</th>
              <th className="py-2 text-right">Potongan</th>
              <th className="py-2 text-right pr-2">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.salesSummary.length > 0 ? (
              data.salesSummary.map((item, idx) => (
                <tr key={idx} className="group text-slate-600">
                  <td className="py-2 pl-2 font-medium">{item.kategori}</td>
                  <td className="py-2 font-semibold text-slate-800">{item.produk}</td>
                  <td className="py-2 text-center">
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-bold">{item.qty}</span>
                  </td>
                  <td className="py-2 text-right text-slate-500">{formatRupiah(item.harga).replace('Rp', '')}</td>
                  <td className="py-2 text-right text-red-400">{item.potongan > 0 ? `-${formatRupiah(item.potongan).replace('Rp', '')}` : '-'}</td>
                  <td className="py-2 text-right pr-2 font-bold text-slate-800">{formatRupiah(item.total).replace('Rp', '')}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-300 italic">Tidak ada penjualan tunai</td>
              </tr>
            )}
            <tr className="bg-blue-50/50 font-bold border-t border-blue-100">
              <td colSpan={5} className="py-2 text-right px-4 text-blue-800 uppercase text-[9px] tracking-wider">Total Penjualan Tunai</td>
              <td className="py-2 text-right pr-2 text-blue-800">
                {formatRupiah(data.salesSummary.reduce((acc, curr) => acc + curr.total, 0)).replace('Rp', '')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* NOTA PENJUALAN TUNAI */}
      <div className="mb-8 pl-1">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-1 bg-indigo-500 rounded-full"></div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Daftar Nota Transaksi</h3>
        </div>
        <table className="w-full text-left">
          <thead className="border-b border-slate-200 bg-slate-50/50">
            <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-2 pl-2 w-8 text-center">No</th>
              <th className="py-2">Toko / Pelanggan</th>
              <th className="py-2">Faktur</th>
              <th className="py-2">Lokasi / Area</th>
              <th className="py-2">Catatan</th>
              <th className="py-2 text-right pr-2">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.notes.length > 0 ? (
              data.notes.map((item, idx) => (
                <tr key={idx} className="text-slate-600">
                  <td className="py-2 pl-2 text-center text-slate-400 font-medium">{idx + 1}</td>
                  <td className="py-2 font-bold text-slate-700 uppercase">{item.toko}</td>
                  <td className="py-2 font-mono text-[9px] text-slate-500">{item.faktur}</td>
                  <td className="py-2 uppercase text-[9px]">{item.area} <span className="text-slate-300 mx-1">|</span> {item.telp}</td>
                  <td className="py-2 italic text-slate-400">{item.catatan}</td>
                  <td className="py-2 text-right pr-2 font-medium text-slate-800">
                    {formatRupiah(item.total).replace('Rp', '')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-300 italic">Tidak ada data nota</td>
              </tr>
            )}
            <tr className="bg-slate-50 font-bold border-t border-slate-200">
              <td colSpan={5} className="py-2 text-right px-4 text-slate-600 text-[9px] uppercase tracking-wider">Grand Total</td>
              <td className="py-2 text-right pr-2 text-slate-800">
                {formatRupiah(data.notes.reduce((acc, curr) => acc + curr.total, 0)).replace('Rp', '')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* TOTAL SUMMARY SECTION */}
      <div className="mb-8 grid grid-cols-2 gap-8">
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="flex justify-between items-center mb-1.5 pb-1.5 border-b border-slate-200">
            <span className="font-bold text-slate-500 uppercase text-[8px] tracking-wider">Penjualan Hari Ini</span>
            <span className="font-bold text-base text-slate-800">{formatRupiah(data.totals.penjualanHariIni)}</span>
          </div>
          <div className="flex justify-between items-center mb-1.5 pb-1.5 border-b border-slate-200">
            <span className={`font-bold uppercase text-[8px] tracking-wider ${data.totals.saldoSebelumnya >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
              {data.totals.saldoSebelumnya >= 0 ? 'Saldo Sebelumnya (Hutang Setoran)' : 'Saldo Sebelumnya (Lebih Setor)'}
            </span>
            <span className={`font-bold text-base ${data.totals.saldoSebelumnya >= 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatRupiah(data.totals.saldoSebelumnya)}</span>
          </div>
          <div className="flex justify-between items-center mb-1.5 pb-1.5 border-b border-slate-200">
            <span className="font-bold text-slate-500 uppercase text-[8px] tracking-wider">(+) Penjualan Hari Ini</span>
            <span className="font-bold text-base text-slate-800">{formatRupiah(data.totals.setoranTunai)}</span>
          </div>
          <div className="flex justify-between items-center mb-1.5 pb-1.5 border-b border-slate-200">
            <span className="font-bold text-slate-500 uppercase text-[8px] tracking-wider">(-) Sudah Disetorkan ke Finance</span>
            <span className="font-bold text-base text-green-600">{formatRupiah(data.totals.totalSetoran)}</span>
          </div>
          {data.totals.pendingSetoran > 0 && (
            <div className="flex justify-between items-center mb-1.5 pb-1.5 border-b border-slate-200">
              <span className="font-bold text-amber-600 uppercase text-[8px] tracking-wider">Setoran Menunggu Persetujuan (Pending)</span>
              <span className="font-bold text-base text-amber-600">{formatRupiah(data.totals.pendingSetoran)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1 mt-1 border-t border-slate-300">
            <span className="font-bold text-slate-500 uppercase text-[8px] tracking-wider">(=) Saldo Akhir</span>
            <span className={`font-bold text-base ${data.totals.saldoAkhir >= 0 ? 'text-red-500' : 'text-blue-600'}`}>
              {formatRupiah(data.totals.saldoAkhir)}
            </span>
          </div>
        </div>

        <div className="flex items-end justify-end">
          <div className="text-right">
            <p className="text-[10px] text-slate-400 mb-8">Disetujui Oleh,</p>
            <div className="border-b border-slate-300 w-32 mb-1"></div>
            <p className="font-bold text-slate-700 uppercase">Admin / Finance</p>
          </div>
        </div>
      </div>

      {/* RIWAYAT STOK BARANG */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-1 bg-orange-500 rounded-full"></div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Pergerakan Stok Barang</h3>
        </div>
        <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-100 text-center font-bold uppercase text-[9px] text-slate-500">
            <tr>
              <th className="py-2 border-r border-slate-200">Produk</th>
              <th className="py-2 border-r border-slate-200">Awal</th>
              <th className="py-2 border-r border-slate-200 text-green-600">Masuk</th>
              <th className="py-2 border-r border-slate-200 text-red-500">Keluar</th>
              <th className="py-2 border-r border-slate-200 text-blue-600">Terjual</th>
              <th className="py-2 border-r border-slate-200 text-orange-500">Promo</th>
              <th className="py-2 font-black text-slate-800">Akhir</th>
            </tr>
          </thead>
          <tbody className="text-center divide-y divide-slate-100">
            {data.stockHistory.length > 0 ? (
              data.stockHistory.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 text-slate-600">
                  <td className="py-1.5 px-2 text-left font-bold text-slate-700 border-r border-slate-100">{item.produk}</td>
                  <td className="py-1.5 border-r border-slate-100">{item.stockAwal.toLocaleString('id-ID')}</td>
                  <td className="py-1.5 border-r border-slate-100 bg-green-50/30 text-green-700 font-medium">{item.masuk !== 0 ? item.masuk.toLocaleString('id-ID') : '-'}</td>
                  <td className="py-1.5 border-r border-slate-100 text-red-600/70">{item.keluar !== 0 ? item.keluar.toLocaleString('id-ID') : '-'}</td>
                  <td className="py-1.5 border-r border-slate-100 text-blue-600/70">{item.terjual !== 0 ? item.terjual.toLocaleString('id-ID') : '-'}</td>
                  <td className="py-1.5 border-r border-slate-100 text-orange-600/70">{item.promo !== 0 ? item.promo.toLocaleString('id-ID') : '-'}</td>
                  <td className="py-1.5 font-bold bg-slate-50 text-slate-900">{item.stockAkhir.toLocaleString('id-ID')}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-300 italic">Tidak ada pergerakan stok hari ini</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* LIST TAGIHAN / TUNGGAKAN */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-1 bg-red-500 rounded-full"></div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Tagihan Belum Lunas (Sales Ini)</h3>
        </div>

        <table className="w-full text-left bg-red-50/30 rounded-lg overflow-hidden border border-red-100">
          <thead className="bg-red-100/50 text-red-800 text-center font-bold uppercase text-[9px]">
            <tr>
              <th className="py-2 px-2 text-left">Tanggal</th>
              <th className="py-2 px-2 text-left">Toko</th>
              <th className="py-2 px-2 text-left w-1/3">Produk</th>
              <th className="py-2 px-2">Qty</th>
              <th className="py-2 px-2 text-right">Sisa Tagihan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-red-100">
            {data.bills.length > 0 ? (
              data.bills.map((item, idx) => (
                <tr key={idx} className="text-red-900/80">
                  <td className="py-1.5 px-2 text-left whitespace-nowrap">{item.tanggal}</td>
                  <td className="py-1.5 px-2 text-left font-bold uppercase">{item.toko}</td>
                  <td className="py-1.5 px-2 text-left text-[9px] leading-tight">{item.produk}</td>
                  <td className="py-1.5 px-2 text-center font-medium">{item.qty}</td>
                  <td className="py-1.5 px-2 text-right font-bold">{formatRupiah(item.sisaTagihan).replace('Rp', '')}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-4 text-center text-red-300 italic">Tidak ada tagihan outstanding</td>
              </tr>
            )}
            <tr className="bg-red-200/50 font-bold text-red-900 border-t border-red-200">
              <td colSpan={4} className="py-2 px-2 text-right uppercase text-[9px] tracking-wider">Total Outstanding</td>
              <td className="py-2 px-2 text-right text-lg">
                {formatRupiah(data.bills.reduce((acc, curr) => acc + curr.sisaTagihan, 0)).replace('Rp', '')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
