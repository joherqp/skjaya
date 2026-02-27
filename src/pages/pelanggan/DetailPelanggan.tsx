import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { formatRupiah, formatCompactRupiah, formatKarton, formatNumber } from '@/lib/utils';
import { ArrowLeft, User, Phone, Mail, MapPin, Store, Calendar, CreditCard, Edit, Power, Trash2, ShoppingCart, TrendingUp, TrendingDown, Minus, BarChart2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useState } from 'react';
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

export default function DetailPelanggan() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth(); // Get user for diagnosis
  const { pelanggan, penjualan, kategoriPelanggan, users, addPersetujuan } = useDatabase(); // Destructure addPersetujuan

  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(10);

  const customer = pelanggan.find(p => p.id === id);
  const salesHistory = penjualan
    .filter(p => p.pelangganId === id)
    .sort((a, b) => {
      // Priority 1: Unpaid (Belum Lunas) Credit Sales first
      const aUnpaid = a.metodePembayaran === 'tempo' && !a.isLunas;
      const bUnpaid = b.metodePembayaran === 'tempo' && !b.isLunas;

      if (aUnpaid && !bUnpaid) return -1;
      if (!aUnpaid && bUnpaid) return 1;

      // Priority 2: Newest Date first
      return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
    });

  if (!customer) {
    return (
      <MainLayout title="Detail Pelanggan">
        <div className="p-4 text-center">
          <p className="text-muted-foreground">Data pelanggan tidak ditemukan</p>
          <Button variant="link" onClick={() => navigate('/pelanggan')}>Kembali</Button>
        </div>
      </MainLayout>
    );
  }

  const kategori = kategoriPelanggan.find(k => k.id === customer.kategoriId);
  const salesPerson = users.find(u => u.id === customer.salesId);
  const creditUsage = ((customer.limitKredit - customer.sisaKredit) / customer.limitKredit) * 100;

  // Calculators for Pencapaian (Sales Info)
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let previousMonth = currentMonth - 1;
  let previousYear = currentYear;
  if (previousMonth < 0) {
    previousMonth = 11;
    previousYear--;
  }

  const isValidSale = (s: any) => s.status !== 'draft' && s.status !== 'batal';

  const [showDetailedFormat, setShowDetailedFormat] = useState(false);

  const thisMonthSales = salesHistory.filter(s => {
    if (!isValidSale(s)) return false;
    const date = new Date(s.tanggal);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const lastMonthSales = salesHistory.filter(s => {
    if (!isValidSale(s)) return false;
    const date = new Date(s.tanggal);
    return date.getMonth() === previousMonth && date.getFullYear() === previousYear;
  });

  const thisMonthTotal = thisMonthSales.reduce((sum, s) => sum + s.total, 0);

  const calculateItemQty = (sales: any[], isPromo: boolean) => {
    return sales.reduce((sum, s) => {
      return sum + s.items.reduce((itemSum: number, item: any) => {
        const itemIsPromo = item.isBonus || item.harga === 0;
        if (isPromo ? itemIsPromo : !itemIsPromo) {
          return itemSum + (item.jumlah * (item.konversi || 1));
        }
        return itemSum;
      }, 0);
    }, 0);
  };

  const thisMonthQty = calculateItemQty(thisMonthSales, false);
  const thisMonthPromoQty = calculateItemQty(thisMonthSales, true);

  const lastMonthTotal = lastMonthSales.reduce((sum, s) => sum + s.total, 0);
  const lastMonthQty = calculateItemQty(lastMonthSales, false);
  const lastMonthPromoQty = calculateItemQty(lastMonthSales, true);

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const totalTrend = calculateTrend(thisMonthTotal, lastMonthTotal);
  const qtyTrend = calculateTrend(thisMonthQty, lastMonthQty);

  const renderTrend = (trend: number) => {
    if (trend === 0) return <span className="text-muted-foreground flex items-center text-xs justify-center"><Minus className="w-3 h-3 mr-1" /> Stabil</span>;
    if (trend > 0) return <span className="text-success flex items-center text-xs font-semibold justify-center"><TrendingUp className="w-3 h-3 mr-1" /> +{trend.toFixed(1)}%</span>;
    return <span className="text-destructive flex items-center text-xs font-semibold justify-center"><TrendingDown className="w-3 h-3 mr-1" /> {trend.toFixed(1)}%</span>;
  };

  const handleRequestStatusChange = async () => {
    if (!customer) return;

    try {
      const newStatus = !customer.isActive;

      await addPersetujuan({
        jenis: 'perubahan_data_pelanggan',
        referensiId: customer.id,
        status: 'pending',
        diajukanOleh: user?.id || 'unknown',
        targetRole: 'admin',
        tanggalPengajuan: new Date(),
        data: {
          isActive: newStatus,
          // Include minimal data for context if needed, but the key is isActive
        }
      });

      toast.success(`Permintaan perubahan status ke ${newStatus ? 'Aktif' : 'Non-Aktif'} berhasil dikirim`);
      setShowStatusConfirm(false);
    } catch (error) {
      console.error('Error requesting status change:', error);
      toast.error('Gagal mengirim permintaan');
    }
  };

  return (
    <MainLayout title="Profil Pelanggan">
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {/* Header Actions */}
        <div className="flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate('/pelanggan')} className="pl-0">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/pelanggan/edit/${id}`)}>
              <Edit className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button
              variant={customer.isActive ? "destructive" : "default"}
              size="sm"
              onClick={() => setShowStatusConfirm(true)}
            >
              <Power className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{customer.isActive ? 'Non-Aktifkan' : 'Aktifkan'}</span>
              <span className="sm:hidden">{customer.isActive ? 'Off' : 'On'}</span>
            </Button>
          </div>
        </div>

        {/* Profile Card */}
        <Card elevated>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-3xl font-bold text-primary mx-auto md:mx-0">
                {customer.nama.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 space-y-4 w-full">
                <div className="text-center md:text-left">
                  <h2 className="text-2xl font-bold">{customer.nama}</h2>
                  {customer.namaPemilik && (
                    <p className="text-lg text-muted-foreground font-medium">{customer.namaPemilik}</p>
                  )}
                  <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground mt-1">
                    <span className="font-mono bg-muted px-2 py-0.5 rounded text-sm">{customer.kode}</span>
                    <Badge variant={customer.isActive ? 'success' : 'destructive'}>
                      {customer.isActive ? 'Aktif' : 'Non-Aktif'}
                    </Badge>
                    {customer.isActive && user?.roles.includes('sales') && (
                      <Button
                        size="sm"
                        className="h-6 text-xs ml-2"
                        onClick={() => navigate(`/penjualan/buat?pelangganId=${id}`)}
                      >
                        <ShoppingCart className="w-3 h-3 mr-1" />
                        Buat Penjualan
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium">Alamat</p>
                        <p className="text-muted-foreground">{customer.alamat}</p>
                        {customer.lokasi && (
                          <a
                            href={`https://www.google.com/maps?q=${customer.lokasi.latitude},${customer.lokasi.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-info mt-1 hover:underline flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3" />
                            {customer.lokasi.alamat || `${customer.lokasi.latitude}, ${customer.lokasi.longitude}`}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Telepon</p>
                        <p className="text-muted-foreground">{customer.telepon}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Store className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Kategori</p>
                        <Badge variant="outline">{kategori?.nama || 'Umum'}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Sales Representative</p>
                        <p className="text-muted-foreground">{salesPerson?.nama || '-'}</p>
                      </div>
                    </div>
                    {(customer.namaBank || customer.noRekening) && (
                      <div className="flex items-start gap-3 pt-2 mt-2 border-t">
                        <CreditCard className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium">Bank Details</p>
                          <p className="text-muted-foreground font-semibold">{customer.namaBank}</p>
                          <p className="text-muted-foreground font-mono">{customer.noRekening}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credit Info */}
        <Card elevated>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Informasi Kredit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Limit Kredit</span>
                <span className="font-bold">{formatRupiah(customer.limitKredit)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Terpakai</span>
                <span className="text-warning font-semibold">{formatRupiah(customer.limitKredit - customer.sisaKredit)}</span>
              </div>
              <Progress value={creditUsage} className="h-2" />
              <p className="text-right text-xs text-muted-foreground">Sisa Plafon: <span className="text-success font-bold">{formatRupiah(customer.sisaKredit)}</span></p>
            </div>
          </CardContent>
        </Card>

        {/* Sales Info */}
        <Card elevated>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary" />
              Pencapaian Penjualan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="this_month" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="this_month">Bulan Ini</TabsTrigger>
                <TabsTrigger value="last_month">Bulan Lalu</TabsTrigger>
              </TabsList>

              <TabsContent value="this_month" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className="bg-muted/50 p-4 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-muted/80"
                    onClick={() => setShowDetailedFormat(!showDetailedFormat)}
                  >
                    <span className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Total Qty</span>
                    <span className="text-2xl font-bold text-primary">
                      {showDetailedFormat ? formatNumber(thisMonthQty) : formatKarton(thisMonthQty).replace('k', ' k')}
                    </span>
                    {showDetailedFormat && <span className="text-sm font-normal text-muted-foreground mt-1">Pcs</span>}
                    {thisMonthPromoQty > 0 && (
                      <span className="text-xs text-muted-foreground mt-1">
                        Promo: {showDetailedFormat ? `${formatNumber(thisMonthPromoQty)} Pcs` : formatKarton(thisMonthPromoQty).replace('k', ' k')}
                      </span>
                    )}
                    <div className="mt-2">{renderTrend(qtyTrend)}</div>
                  </div>
                  <div
                    className="bg-muted/50 p-4 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-muted/80"
                    onClick={() => setShowDetailedFormat(!showDetailedFormat)}
                  >
                    <span className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Total Omset</span>
                    <span className="text-xl sm:text-2xl font-bold text-primary">
                      {showDetailedFormat ? formatRupiah(thisMonthTotal) : formatCompactRupiah(thisMonthTotal)}
                    </span>
                    <div className="mt-2">{renderTrend(totalTrend)}</div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="last_month" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className="bg-muted/50 p-4 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-muted/80"
                    onClick={() => setShowDetailedFormat(!showDetailedFormat)}
                  >
                    <span className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Total Qty</span>
                    <span className="text-2xl font-bold text-primary">
                      {showDetailedFormat ? formatNumber(lastMonthQty) : formatKarton(lastMonthQty).replace('k', ' k')}
                    </span>
                    {showDetailedFormat && <span className="text-sm font-normal text-muted-foreground mt-1">Pcs</span>}
                    {lastMonthPromoQty > 0 && (
                      <span className="text-xs text-muted-foreground mt-1">
                        Promo: {showDetailedFormat ? `${formatNumber(lastMonthPromoQty)} Pcs` : formatKarton(lastMonthPromoQty).replace('k', ' k')}
                      </span>
                    )}
                  </div>
                  <div
                    className="bg-muted/50 p-4 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-muted/80"
                    onClick={() => setShowDetailedFormat(!showDetailedFormat)}
                  >
                    <span className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Total Omset</span>
                    <span className="text-xl sm:text-2xl font-bold text-primary">
                      {showDetailedFormat ? formatRupiah(lastMonthTotal) : formatCompactRupiah(lastMonthTotal)}
                    </span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg px-1">Riwayat Transaksi</h3>
          {salesHistory.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <p>Belum ada riwayat transaksi</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {salesHistory.slice(0, historyLimit).map(sale => (
                <Card
                  key={sale.id}
                  className="cursor-pointer hover:border-primary/50 transition-all"
                  onClick={() => navigate(`/penjualan/${sale.id}`)}
                >
                  <CardContent className="p-4 flex justify-between items-center">
                    <div className="space-y-1">
                      <p className="font-bold">{sale.nomorNota}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {new Date(sale.tanggal).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="font-bold text-primary">{formatRupiah(sale.total)}</p>
                      <div className="flex gap-1 justify-end flex-wrap">
                        <Badge variant={sale.status === 'lunas' ? 'success' : 'secondary'} className="text-xs">
                          {sale.status}
                        </Badge>
                        {sale.metodePembayaran === 'tempo' && (
                          <Badge variant={sale.isLunas ? 'success' : 'destructive'} className="text-[10px] px-1.5">
                            {sale.isLunas ? 'LUNAS' : 'BELUM LUNAS'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {salesHistory.length > historyLimit && (
                <Button
                  variant="ghost"
                  className="w-full mt-4 border-dashed text-muted-foreground"
                  onClick={() => setHistoryLimit(prev => prev + 10)}
                >
                  Lihat Lainnya
                </Button>
              )}
            </>
          )}
        </div>
      </div>


      <AlertDialog open={showStatusConfirm} onOpenChange={setShowStatusConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Perubahan Status</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin mengubah status pelanggan ini menjadi
              <span className="font-bold"> {customer.isActive ? 'Non-Aktif' : 'Aktif'}</span>?
              <br />
              Tindakan ini memerlukan persetujuan Admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleRequestStatusChange}>
              Ya, Ajukan Perubahan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
