import React from 'react';
import { formatRupiah } from '@/lib/utils';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ProfilPerusahaan } from '@/lib/types';

interface UangMakanBBMPrintTemplateProps {
  id: string;
  week: number;
  year: number;
  startDate: Date;
  endDate: Date;
  cabangName: string;
  companyProfile: ProfilPerusahaan;
  data: {
    userId: string;
    nama: string;
    posisi: string;
    hariKerja: number;
    nominalUangMakan: number;
    nominalReimburse: number;
    total: number;
  }[];
  rateUangMakan: number;
  attendanceRecap: {
    nama: string;
    statuses: string[];
    total: number;
  }[];
  reimburseLogs: {
    tanggal: Date;
    nama: string;
    kategori: string;
    keterangan: string;
    jumlah: number;
    status: string;
    buktiUrl?: string;
  }[];
  daysOfWeek: Date[];
}

export const UangMakanBBMPrintTemplate: React.FC<UangMakanBBMPrintTemplateProps> = ({
  id,
  week,
  year,
  startDate,
  endDate,
  cabangName,
  companyProfile,
  data,
  rateUangMakan,
  attendanceRecap,
  reimburseLogs,
  daysOfWeek
}) => {
  const grandTotalUangMakan = data.reduce((sum, item) => sum + item.nominalUangMakan, 0);
  const grandTotalReimburse = data.reduce((sum, item) => sum + item.nominalReimburse, 0);
  const grandTotalAll = data.reduce((sum, item) => sum + item.total, 0);

  const getInitials = (name: string = '') => {
    if (!name) return 'CVSKJ';
    // Remove prefixes like PT., CV., PT, CV (case insensitive)
    const cleaned = name.replace(/^(PT\.|CV\.|PT|CV|UD\.|UD)\s+/i, '');
    return cleaned
      .split(/\s+/)
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 3);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700 border-green-200';
      case 'approved': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'pending': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid': return 'DIBAYAR';
      case 'approved': return 'DISETUJUI';
      case 'pending': return 'MENUNGGU';
      default: return status.toUpperCase();
    }
  };

  return (
    <div id={id} className="bg-slate-50 text-slate-900 font-sans text-[10px] leading-tight w-[210mm]">
      {/* PAGE 1: RINGKASAN UTAMA */}
      <div className="p-10 min-h-[297mm] flex flex-col bg-white">
        {/* Header */}
        <div className="flex justify-between items-center mb-10 border-b-4 border-indigo-700 pb-6">
          <div className="flex items-center gap-6">
            {companyProfile?.logoUrl ? (
              <img src={companyProfile.logoUrl} alt="Logo" className="w-20 h-20 object-contain rounded-xl border border-slate-100 p-2" />
            ) : (
                <div className="w-20 h-20 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl font-black">
                    {getInitials(companyProfile?.nama)}
                </div>
            )}
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-indigo-900">{companyProfile?.nama || 'CVSKJ'}</h1>
              <p className="text-[11px] text-slate-500 font-medium max-w-[350px]">{companyProfile?.alamat}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-indigo-700 text-white px-4 py-2 rounded-lg inline-block text-xl font-black tracking-tighter mb-2">
              WEEK {week} | {year}
            </div>
            <h2 className="text-sm font-black text-indigo-400 uppercase tracking-widest leading-none text-[8px]">Pengajuan Uang Makan & Reimburse</h2>
          </div>
        </div>

        {/* Info & Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 italic">
                <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Cabang Operasional</p>
                <p className="text-sm font-black text-indigo-900">{cabangName.toUpperCase()}</p>
            </div>
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Rate Uang Makan</p>
                <p className="text-sm font-black text-indigo-900">{formatRupiah(rateUangMakan)} / Hari</p>
            </div>
            <div className="bg-indigo-800 p-4 rounded-xl border-b-4 border-blue-400 shadow-lg text-white">
                <p className="text-[8px] font-bold text-indigo-200 uppercase tracking-widest mb-1">Total Pengajuan</p>
                <p className="text-lg font-black">{formatRupiah(grandTotalAll)}</p>
            </div>
        </div>

        {/* Main Table */}
        <div className="mb-4 flex items-center gap-2">
            <div className="h-4 w-1 bg-indigo-700 rounded-full"></div>
            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-900">Ringkasan per Karyawan</h3>
        </div>

        <table className="w-full border-collapse rounded-xl overflow-hidden border border-indigo-100 shadow-sm">
          <thead className="bg-indigo-700 text-white uppercase text-[8px] font-bold">
            <tr>
              <th className="p-3 text-center w-10">No</th>
              <th className="p-3 text-left">Nama Karyawan</th>
              <th className="p-3 text-left w-32">Posisi</th>
              <th className="p-3 text-center w-20">Hadir</th>
              <th className="p-3 text-right w-32">Uang Makan</th>
              <th className="p-3 text-right w-32">Reimburse</th>
              <th className="p-3 text-right w-32 bg-indigo-800 font-black">Total</th>
            </tr>
          </thead>
          <tbody className="text-[9px]">
            {data.map((item, idx) => (
              <tr key={item.userId} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-indigo-50/20'} border-b border-indigo-50 last:border-0`}>
                <td className="p-3 text-center text-indigo-200 font-bold">{idx + 1}</td>
                <td className="p-3 font-black text-slate-900">{item.nama}</td>
                <td className="p-3 text-slate-500 font-bold uppercase text-[8px]">{item.posisi}</td>
                <td className="p-3 text-center font-bold text-slate-700">{item.hariKerja} Hari</td>
                <td className="p-3 text-right font-medium text-slate-600">{formatRupiah(item.nominalUangMakan)}</td>
                <td className="p-3 text-right font-medium text-slate-600">{formatRupiah(item.nominalReimburse)}</td>
                <td className="p-3 text-right font-black bg-indigo-50/50 text-indigo-900">{formatRupiah(item.total)}</td>
              </tr>
            ))}
            <tr className="bg-indigo-700 text-white font-black">
                <td colSpan={4} className="p-4 text-right uppercase text-[9px] tracking-widest">Grand Total</td>
                <td className="p-4 text-right">{formatRupiah(grandTotalUangMakan)}</td>
                <td className="p-4 text-right">{formatRupiah(grandTotalReimburse)}</td>
                <td className="p-4 text-right text-base">{formatRupiah(grandTotalAll)}</td>
            </tr>
          </tbody>
        </table>

        {/* Signatures */}
        <div className="mt-auto pt-20 grid grid-cols-3 gap-12 text-center">
          <div>
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-20">Dibuat Oleh</p>
            <div className="border-b-2 border-indigo-700 w-full mb-1"></div>
            <p className="font-black text-indigo-900 uppercase">Finance Cabang</p>
          </div>
          <div>
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-20">Diketahui Oleh</p>
            <div className="border-b-2 border-indigo-700 w-full mb-1"></div>
            <p className="font-black text-indigo-900 uppercase">Branch Manager</p>
          </div>
          <div>
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-20">Disetujui Oleh</p>
            <div className="border-b-2 border-indigo-700 w-full mb-1"></div>
            <p className="font-black text-indigo-900 uppercase">Management / Owner</p>
          </div>
        </div>
      </div>

      {/* PAGE 2: LAMPIRAN ABSENSI */}
      <div className="p-10 min-h-[297mm] bg-white border-t-[12px] border-green-500 mt-6 overflow-hidden">
        <h3 className="text-xl font-black uppercase text-green-900 tracking-tighter mb-1">Lampiran 1: Rekap Absensi</h3>
        <p className="text-[10px] text-green-600 font-bold uppercase mb-6 tracking-widest">Verifikasi Kehadiran Week {week}</p>
        
        <table className="w-full border-collapse text-[9px] border border-green-100 rounded-xl overflow-hidden shadow-sm">
            <thead className="bg-green-500 text-white font-bold uppercase text-[8px]">
                <tr>
                    <th className="p-2 text-left">Nama</th>
                    {daysOfWeek.map(d => (
                        <th key={d.toString()} className="p-2 text-center border-l border-green-400 w-12">{format(d, 'EEE', { locale: localeId })}<br/>{format(d, 'dd/MM')}</th>
                    ))}
                    <th className="p-2 text-center border-l border-green-400 w-12">Hadir</th>
                </tr>
            </thead>
            <tbody>
                {attendanceRecap.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-green-50/30'}>
                        <td className="p-2 font-black border-r border-green-50">{row.nama}</td>
                        {row.statuses.map((s, i) => (
                            <td key={i} className={`p-2 text-center border-r border-green-50 font-black ${s === 'M' ? 'text-green-600' : s === 'I' ? 'text-red-500' : 'text-slate-200'}`}>{s}</td>
                        ))}
                        <td className="p-2 text-center font-black bg-green-50/50 text-green-800">{row.total}</td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* PAGE 3: RINCIAN REIMBURSE */}
      <div className="p-10 min-h-[297mm] bg-white border-t-[12px] border-orange-500 mt-6">
        <h3 className="text-xl font-black uppercase text-orange-900 tracking-tighter mb-1">Lampiran 2: Rincian Reimburse</h3>
        <p className="text-[10px] text-orange-600 font-bold uppercase mb-6 tracking-widest">Detail Pengeluaran Lampau Week {week}</p>

        <table className="w-full border-collapse text-[9px] border border-orange-100 rounded-xl overflow-hidden shadow-sm">
            <thead className="bg-orange-500 text-white font-bold uppercase text-[8px]">
                <tr>
                    <th className="p-3 text-left w-24">Tanggal</th>
                    <th className="p-3 text-left w-32">Nama</th>
                    <th className="p-3 text-left w-24">Kategori</th>
                    <th className="p-3 text-left">Keterangan</th>
                    <th className="p-3 text-center w-24">Status</th>
                    <th className="p-3 text-right w-32 border-l border-orange-400">Nominal</th>
                </tr>
            </thead>
            <tbody>
                {reimburseLogs.map((log, idx) => (
                    <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-orange-50/30'} border-b border-orange-50`}>
                        <td className="p-3 text-slate-500">{format(log.tanggal, 'dd/MM/yyyy')}</td>
                        <td className="p-3 font-black text-slate-900">{log.nama}</td>
                        <td className="p-3 font-bold text-orange-600 uppercase text-[8px]">{log.kategori}</td>
                        <td className="p-3 italic">"{log.keterangan}"</td>
                        <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[7px] font-black border ${getStatusStyle(log.status)}`}>{getStatusLabel(log.status)}</span>
                        </td>
                        <td className="p-3 text-right font-black bg-orange-50/50 text-orange-900">{formatRupiah(log.jumlah)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* PAGE 4: BUKTI TRANSAKSI (RECEIPTS) */}
      <div className="p-10 min-h-[297mm] bg-white border-t-[12px] border-blue-500 mt-6">
        <h3 className="text-xl font-black uppercase text-blue-900 tracking-tighter mb-1">Lampiran 3: Bukti Transaksi</h3>
        <p className="text-[10px] text-blue-600 font-bold uppercase mb-6 tracking-widest">Dokumentasi Fisik Reimbursement Week {week}</p>

        <div className="grid grid-cols-2 gap-6">
            {reimburseLogs.filter(log => log.buktiUrl).map((log, idx) => (
                <div key={idx} className="border-2 border-slate-100 rounded-xl p-4 flex flex-col items-center bg-slate-50/30 shadow-sm transition-transform hover:scale-[1.02]">
                    <img 
                        src={log.buktiUrl} 
                        alt={`Bukti ${log.keterangan}`} 
                        className="w-full h-[180px] object-contain rounded-lg shadow-sm mb-3 bg-white border"
                    />
                    <div className="w-full text-[8px] font-bold uppercase tracking-tight">
                        <div className="flex justify-between border-b border-slate-100 pb-1 mb-1">
                            <span className="text-slate-400">Karyawan</span>
                            <span className="text-slate-900">{log.nama}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1 mb-1">
                            <span className="text-slate-400">Kategori</span>
                            <span className="text-blue-600">{log.kategori}</span>
                        </div>
                        <div className="flex justify-between font-black text-slate-900">
                            <span>TOTAL</span>
                            <span>{formatRupiah(log.jumlah)}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
        {reimburseLogs.filter(log => log.buktiUrl).length === 0 && (
            <div className="text-center py-20 text-slate-300 font-bold uppercase tracking-widest border-2 border-dashed rounded-2xl border-slate-200 bg-slate-50/50">
                Tidak ada bukti fisik yang dilampirkan
            </div>
        )}
      </div>

    </div>
  );
};
