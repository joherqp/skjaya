import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDatabase } from '@/contexts/DatabaseContext';
import { formatRupiah, formatTanggal, formatWaktu } from '@/lib/utils';
import { ArrowLeft, Calendar, FileText, User as UserIcon, Wallet, CheckCircle, Clock, XCircle, Image as ImageIcon } from 'lucide-react';

export default function DetailSetoran() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setoran, persetujuan, users, karyawan, rekeningBank } = useDatabase();

  let data: any = setoran.find(s => s.id === id);
  let isPusat = false;

  if (!data) {
    const p = persetujuan.find(p => p.id === id && p.jenis === 'rencana_setoran');
    if (p) {
      const pData = p.data as any;
      data = {
        id: p.id,
        nomorSetoran: `SP/${new Date(p.tanggalPengajuan).getFullYear()}/${p.id.substring(0, 4).toUpperCase()}`,
        tanggal: p.tanggalPengajuan,
        jumlah: pData?.amount || 0,
        status: p.status,
        salesId: p.diajukanOleh,
        rekeningId: pData?.rekeningTujuanId,
        createdAt: p.tanggalPengajuan,
        buktiUrl: pData?.generalProofUrl || (pData?.transfers && pData.transfers[0]?.proofUrl),
        catatan: p.catatan,
        disetujuiOleh: p.disetujuiOleh
      };
      isPusat = true;
    }
  }

  if (!data) {
    return (
      <MainLayout title="Detail Setoran">
        <div className="p-4 text-center">
          <p>Data setoran tidak ditemukan.</p>
          <Button variant="outline" onClick={() => navigate('/setoran')} className="mt-4">Kembali</Button>
        </div>
      </MainLayout>
    );
  }

  const rekening = rekeningBank.find(r => r.id === data.rekeningId);
  const recipientUser = rekening?.assignedUserId ? users.find(u => u.id === rekening.assignedUserId) : null;
  const recipientName = isPusat ? 'Pusat / Finance' : (recipientUser?.nama || rekening?.atasNama || '-');

  // Robust Name Lookup
  const salesPerson = users.find(u => u.id === data.salesId);
  const linkedEmployee = karyawan.find(k => k.userAccountId === data.salesId);
  const salesName = linkedEmployee?.nama || salesPerson?.nama || data.salesId;

  const approverPerson = data.disetujuiOleh ? users.find(u => u.id === data.disetujuiOleh) : null;
  const approverEmployee = data.disetujuiOleh ? karyawan.find(k => k.userAccountId === data.disetujuiOleh) : null;
  const approverName = approverEmployee?.nama || approverPerson?.nama || 'System';

  return (
    <MainLayout title={isPusat ? "Detail Setoran Pusat" : "Detail Setoran"}>
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/setoran')}
          className="pl-0"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali
        </Button>

        <Card elevated>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  {data.nomorSetoran}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Dibuat pada {formatTanggal(new Date(data.createdAt))} • {formatWaktu(new Date(data.createdAt))}
                </p>
              </div>
              <Badge variant={
                data.status === 'pending' ? 'warning' :
                  data.status === 'disetujui' ? 'success' : 'destructive'
              }>
                {data.status.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Amount Section */}
            <div className="text-center p-6 bg-muted/20 rounded-xl border border-dashed">
              <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Total Setoran</p>
              <p className="text-3xl font-bold text-primary">{formatRupiah(data.jumlah)}</p>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-xs text-muted-foreground">Tanggal Setor</p>
                    <p className="font-medium">{formatTanggal(new Date(data.tanggal))}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <UserIcon className="w-4 h-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-xs text-muted-foreground">Sales / Penyetor</p>
                    <p className="font-medium">{salesName}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Wallet className="w-4 h-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ke Rekening / Penerima</p>
                    <p className="font-medium">{rekening?.namaBank || '-'}</p>
                    <p className="text-xs text-muted-foreground">
                      {rekening?.nomorRekening} a.n {recipientName}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Evidence Image */}
            <div className="space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Bukti Transfer
              </p>
              {data.buktiUrl ? (
                <div className="rounded-lg overflow-hidden border">
                  <img src={data.buktiUrl} alt="Bukti Transfer" className="w-full h-auto object-cover max-h-[400px]" />
                </div>
              ) : (
                <div className="h-24 bg-muted/30 rounded-lg border  border-dashed flex items-center justify-center text-muted-foreground text-sm">
                  Tidak ada bukti lampiran
                </div>
              )}
            </div>

            {/* Approval Info */}
            {data.status !== 'pending' && (
              <div className={`p-4 rounded-lg flex items-start gap-3 ${data.status === 'disetujui' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                {data.status === 'disetujui' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                <div>
                  <p className="font-semibold">{data.status === 'disetujui' ? 'Disetujui Oleh' : 'Ditolak Oleh'}</p>
                  <p className="text-sm">{approverName}</p>
                  {data.catatan && (
                    <p className="text-xs mt-1 italic">"{data.catatan}"</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
