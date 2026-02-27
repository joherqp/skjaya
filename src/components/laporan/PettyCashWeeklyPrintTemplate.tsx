import { formatRupiah, formatTanggal, formatWaktu } from '@/lib/utils';
import { ProfilPerusahaan, PettyCash } from '@/lib/types';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface PettyCashWeeklyPrintTemplateProps {
  id: string;
  week: number;
  monthName: string;
  year: number;
  startDate: Date;
  endDate: Date;
  cabangName: string;
  companyProfile: ProfilPerusahaan;
  transactions: PettyCash[];
  initialBalance: number;
}

export function PettyCashWeeklyPrintTemplate({ 
  id, week, monthName, year, startDate, endDate, cabangName, companyProfile, transactions, initialBalance 
}: PettyCashWeeklyPrintTemplateProps) {
  const incomes = transactions.filter(t => t.tipe === 'masuk');
  const expenses = transactions.filter(t => t.tipe === 'keluar');
  
  const totalIn = incomes.reduce((acc, curr) => acc + curr.jumlah, 0);
  const totalOut = expenses.reduce((acc, curr) => acc + curr.jumlah, 0);

  const sortedTransactions = [...transactions].sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

  return (
    <div id={id} className="bg-white text-slate-900 font-sans text-[10px] leading-tight p-8" style={{ width: '210mm', minHeight: '297mm' }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-100">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-slate-800">Laporan Petty Cash Mingguan</h1>
            <p className="text-sm text-slate-500 font-medium uppercase tracking-widest">Periode: Week {week} | {monthName} {year}</p>
          </div>
          
          <div className="grid grid-cols-[100px_1fr] gap-y-1.5 text-xs">
            <span className="text-slate-400 font-medium uppercase tracking-wider text-[9px]">Rentang Waktu</span>
            <span className="font-semibold text-slate-700 uppercase">
                {format(startDate, 'dd MMM', { locale: localeId })} - {format(endDate, 'dd MMM yyyy', { locale: localeId })}
            </span>
            
            <span className="text-slate-400 font-medium uppercase tracking-wider text-[9px]">Cabang</span>
            <span className="font-semibold text-slate-700 uppercase">{cabangName}</span>
          </div>
        </div>

        <div className="text-right flex flex-col items-end">
             <h2 className="text-xl font-black text-slate-800 tracking-tight">{companyProfile.nama || 'CVSKJ'}</h2>
             <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed mt-1">
                {companyProfile.alamat}
             </p>
             {companyProfile.logoUrl && (
                <img src={companyProfile.logoUrl} alt="Logo" className="w-12 h-12 mt-2 object-contain" />
             )}
        </div>
      </div>

      {/* Main Table */}
      <div className="mb-8 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3 pl-4 w-24 text-center">Tanggal</th>
              <th className="py-3 px-4">Keterangan / Kategori</th>
              <th className="py-3 px-4 text-right w-32">Masuk (+)</th>
              <th className="py-3 px-4 text-right w-32">Keluar (-)</th>
              <th className="py-3 pr-4 text-right w-32">Saldo Akhir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* SALDO AWAL ROW */}
            <tr className="bg-slate-50/50">
                <td className="py-3 text-center text-[8px] font-bold text-slate-400">START</td>
                <td className="py-3 px-4">
                    <p className="font-bold text-slate-700 uppercase tracking-tight">Saldo Awal Periode</p>
                    <p className="text-[8px] text-slate-400">Saldo sebelum {format(startDate, 'dd MMMM yyyy')}</p>
                </td>
                <td className="py-3 px-4 text-right text-slate-300">-</td>
                <td className="py-3 px-4 text-right text-slate-300">-</td>
                <td className="py-3 pr-4 text-right font-black text-slate-800 bg-slate-100/30">
                    {formatRupiah(initialBalance).replace('Rp', '')}
                </td>
            </tr>

            {sortedTransactions.length > 0 ? (
                sortedTransactions.map((item, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 text-center border-r border-slate-50">
                            <p className="font-bold text-slate-800">{format(new Date(item.tanggal), 'dd/MM')}</p>
                            <p className="text-[8px] text-slate-400">{formatWaktu(item.tanggal)}</p>
                        </td>
                        <td className="py-3 px-4">
                            <p className="font-semibold text-slate-800 leading-tight mb-1">{item.keterangan}</p>
                            <span className="inline-flex items-center bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-[4px] text-[7px] font-black uppercase tracking-widest">{item.kategori}</span>
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${item.tipe === 'masuk' ? 'text-green-600' : 'text-slate-300'}`}>
                            {item.tipe === 'masuk' ? `+ ${formatRupiah(item.jumlah).replace('Rp', '')}` : '-'}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${item.tipe === 'keluar' ? 'text-red-500' : 'text-slate-300'}`}>
                            {item.tipe === 'keluar' ? `- ${formatRupiah(item.jumlah).replace('Rp', '')}` : '-'}
                        </td>
                        <td className="py-3 pr-4 text-right font-bold text-slate-900 bg-slate-50/30 border-l border-slate-50">
                            {formatRupiah(item.saldoAkhir).replace('Rp', '')}
                        </td>
                    </tr>
                ))
            ) : (
                <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-300 italic">
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-2xl">📋</span>
                            <p>Tidak ada transaksi pergerakan kas pada periode ini</p>
                        </div>
                    </td>
                </tr>
            )}
          </tbody>
          <tfoot className="bg-slate-100/80 font-bold border-t-2 border-slate-200">
              <tr>
                  <td colSpan={2} className="py-4 text-right px-6 text-slate-500 uppercase text-[9px] tracking-widest">Rekapitulasi Mingguan</td>
                  <td className="py-4 px-4 text-right text-green-700 text-sm">
                      <span className="text-[8px] block font-medium text-slate-400">TOTAL MASUK</span>
                      {formatRupiah(totalIn).replace('Rp', '')}
                  </td>
                  <td className="py-4 px-4 text-right text-red-600 text-sm">
                      <span className="text-[8px] block font-medium text-slate-400">TOTAL KELUAR</span>
                      {formatRupiah(totalOut).replace('Rp', '')}
                  </td>
                  <td className="py-4 pr-4 text-right text-slate-900 bg-slate-200/50 text-sm">
                       <span className="text-[8px] text-slate-500 block font-black uppercase tracking-tighter">SALDO AKHIR</span>
                       {formatRupiah(sortedTransactions.length > 0 ? sortedTransactions[sortedTransactions.length - 1].saldoAkhir : initialBalance)}
                  </td>
              </tr>
          </tfoot>
        </table>
      </div>

      {/* Signature Section */}
      <div className="flex justify-between items-end mb-16 px-10">
           <div className="text-center min-w-[150px]">
                <p className="text-[9px] text-slate-400 mb-16 font-medium uppercase tracking-widest">Disusun Oleh (Finance),</p>
                <div className="border-b-2 border-slate-200 w-full mb-2"></div>
                <p className="font-black text-slate-800 uppercase text-xs">Staff Admin Cabang</p>
           </div>
           
           <div className="text-center min-w-[150px]">
                <p className="text-[9px] text-slate-400 mb-16 font-medium uppercase tracking-widest">Diverifikasi & Disetujui,</p>
                <div className="border-b-2 border-slate-200 w-full mb-2"></div>
                <p className="font-black text-slate-800 uppercase text-xs">Manager / Finance Pusat</p>
           </div>
      </div>

      {/* Proof Section (Bukti Transaksi) */}
      <div className="page-break-before pt-10 border-t-2 border-dashed border-slate-200">
           <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="h-6 w-1.5 bg-pink-500 rounded-full"></div>
                    <div className="space-y-0.5">
                        <h3 className="font-black text-sm uppercase tracking-tight text-slate-800">Lampiran Bukti Transaksi</h3>
                        <p className="text-[9px] text-slate-400 font-medium">Dokumentasi fisik untuk setiap item pengeluaran dana</p>
                    </div>
                </div>
                <div className="bg-slate-100 px-3 py-1 rounded-full text-[9px] font-bold text-slate-500">
                    Total: {expenses.filter(t => t.buktiUrl).length} Lampiran
                </div>
           </div>
           
           <div className="grid grid-cols-3 gap-6">
               {expenses.filter(t => t.buktiUrl).map((item, idx) => (
                   <div key={idx} className="group border-2 border-slate-100 rounded-xl overflow-hidden bg-white flex flex-col break-inside-avoid shadow-sm">
                        <div className="aspect-[4/3] relative bg-slate-200 flex items-center justify-center overflow-hidden">
                             <img 
                                src={item.buktiUrl} 
                                alt={`Bukti ${idx}`} 
                                className="w-full h-full object-cover"
                                crossOrigin="anonymous"
                             />
                             <div className="absolute top-2 right-2 bg-black/60 text-white text-[8px] font-black px-2 py-0.5 rounded-full backdrop-blur-sm">
                                #{idx + 1}
                             </div>
                        </div>
                        <div className="p-3 bg-white space-y-2 border-t border-slate-100">
                             <div className="flex justify-between items-start gap-2">
                                 <div>
                                    <p className="font-black text-slate-800 text-[9px] uppercase leading-tight line-clamp-1">{item.keterangan}</p>
                                    <span className="text-[7px] text-slate-400 font-bold tracking-wider">{format(new Date(item.tanggal), 'dd MMM yyyy')}</span>
                                 </div>
                                 <p className="font-black text-red-600 text-[10px] whitespace-nowrap">{formatRupiah(item.jumlah)}</p>
                             </div>
                             <div className="flex items-center gap-1">
                                 <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-[4px] text-[7px] font-bold uppercase tracking-tighter">{item.kategori}</span>
                             </div>
                        </div>
                   </div>
               ))}
               {expenses.filter(t => t.buktiUrl).length === 0 && (
                   <div className="col-span-3 py-16 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                       <p className="text-slate-300 italic font-medium">Tidak ada lampiran bukti foto pengeluaran pada periode ini</p>
                   </div>
               )}
           </div>
      </div>

      <style>{`
        @media print {
            .page-break-before {
                page-break-before: always;
            }
        }
      `}</style>
    </div>
  );
}
