import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCurrency, formatTanggal } from '@/lib/utils';
import { Plus, FileText, Clock, CheckCircle, XCircle, AlertCircle, History, User, Calendar, Info, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Reimburse as ReimburseType } from '@/lib/types';

export default function Reimburse() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { reimburse, users } = useDatabase();
    const [activeTab, setActiveTab] = useState('pending');
    const [visibleCount, setVisibleCount] = useState(10);
    const [selectedReimburse, setSelectedReimburse] = useState<ReimburseType | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    useEffect(() => {
        setVisibleCount(10);
    }, [activeTab]);

    // Filter reimbursements for current user
    const myReimbursements = useMemo(() => {
        if (!user) return [];
        return reimburse.filter(r => r.userId === user.id).sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
    }, [reimburse, user]);

    const pendingReimbursements = myReimbursements.filter(r => r.status === 'pending');
    const unpaidReimbursements = myReimbursements.filter(r => ['approved', 'disetujui'].includes(r.status));
    const historyReimbursements = myReimbursements.filter(r => ['dibayar', 'ditolak'].includes(r.status));

    const displayedPending = pendingReimbursements.slice(0, visibleCount);
    const displayedUnpaid = unpaidReimbursements.slice(0, visibleCount);
    const displayedHistory = historyReimbursements.slice(0, visibleCount);

    const hasMore = activeTab === 'pending'
        ? visibleCount < pendingReimbursements.length
        : activeTab === 'unpaid'
            ? visibleCount < unpaidReimbursements.length
            : visibleCount < historyReimbursements.length;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> Menunggu</Badge>;
            case 'approved': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200"><CheckCircle className="w-3 h-3 mr-1" /> Disetujui</Badge>;
            case 'dibayar': return <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200"><CheckCircle className="w-3 h-3 mr-1" /> Dibayar</Badge>;
            case 'ditolak': return <Badge variant="secondary" className="bg-red-100 text-red-800 hover:bg-red-200 border-red-200"><XCircle className="w-3 h-3 mr-1" /> Ditolak</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <MainLayout title="Reimbursement">
            <div className="p-4 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-xl text-white shadow-lg">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Pengajuan Reimburse</h2>
                        <p className="text-blue-100 mt-1">Kelola dan ajukan klaim operasional dengan mudah.</p>
                    </div>
                    <Button onClick={() => navigate('/reimburse/ajukan')} className="bg-white text-blue-600 hover:bg-blue-50 border-none shadow-md font-semibold">
                        <Plus className="w-4 h-4 mr-2" />
                        Ajukan Baru
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="col-span-1 border-l-4 border-l-yellow-400 shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2 p-4">
                            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Clock className="w-4 h-4 text-yellow-500" /> Pending
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl sm:text-3xl font-bold truncate text-yellow-600">
                                {formatCurrency(pendingReimbursements.reduce((acc, curr) => acc + curr.jumlah, 0))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{pendingReimbursements.length} pengajuan menunggu</p>
                        </CardContent>
                    </Card>
                    <Card className="col-span-1 border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2 p-4">
                            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-blue-500" /> Belum Bayar
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl sm:text-3xl font-bold truncate text-blue-600">
                                {formatCurrency(unpaidReimbursements.reduce((acc, curr) => acc + curr.jumlah, 0))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{unpaidReimbursements.length} disetujui, belum cair</p>
                        </CardContent>
                    </Card>
                    <Card className="col-span-1 border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2 p-4">
                            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500" /> Cair (Bulan Ini)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl sm:text-3xl font-bold truncate text-green-600">
                                {formatCurrency(
                                    myReimbursements
                                        .filter(r => r.status === 'dibayar' && new Date(r.tanggal).getMonth() === new Date().getMonth())
                                        .reduce((acc, curr) => acc + curr.jumlah, 0)
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Total dicairkan bulan ini</p>
                        </CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="pending" className="w-full" onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3 p-1 bg-slate-100 rounded-lg">
                        <TabsTrigger value="pending" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">
                            Menunggu ({pendingReimbursements.length})
                        </TabsTrigger>
                        <TabsTrigger value="unpaid" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">
                            Belum Bayar ({unpaidReimbursements.length})
                        </TabsTrigger>
                        <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all">
                            Riwayat ({historyReimbursements.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending" className="mt-6 space-y-4">
                        {pendingReimbursements.length === 0 ? (
                            <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                                <h3 className="text-lg font-semibold text-slate-900">Tidak ada pengajuan pending</h3>
                                <p className="text-slate-500 max-w-sm mx-auto mt-1">Semua pengajuan reimbursement Anda telah diproses.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {displayedPending.map(item => (
                                    <Card
                                        key={item.id}
                                        className="border-l-4 border-l-yellow-400 shadow-sm hover:shadow-md transition-all group overflow-hidden cursor-pointer"
                                        onClick={() => {
                                            setSelectedReimburse(item);
                                            setIsDetailOpen(true);
                                        }}
                                    >
                                        <CardContent className="p-5 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
                                            <div className="space-y-1.5 flex-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">{item.keterangan}</span>
                                                    {getStatusBadge(item.status)}
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded text-slate-600">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {formatTanggal(item.tanggal)}
                                                    </span>
                                                    {item.buktiUrl && (
                                                        <a href={item.buktiUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline">
                                                            <FileText className="w-3.5 h-3.5" /> Bukti
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="font-bold text-xl sm:text-2xl text-slate-700 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                                                {formatCurrency(item.jumlah)}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {hasMore && activeTab === 'pending' && (
                                    <Button
                                        variant="ghost"
                                        className="w-full mt-4 border-dashed text-muted-foreground"
                                        onClick={() => setVisibleCount(prev => prev + 10)}
                                    >
                                        Lihat Lainnya
                                    </Button>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="unpaid" className="mt-6 space-y-4">
                        {unpaidReimbursements.length === 0 ? (
                            <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                <CheckCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                                <h3 className="text-lg font-semibold text-slate-900">Tidak ada tagihan belum bayar</h3>
                                <p className="text-slate-500 max-w-sm mx-auto mt-1">Semua reimbursement yang disetujui sudah dibayarkan.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {displayedUnpaid.map(item => (
                                    <Card
                                        key={item.id}
                                        className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all group overflow-hidden cursor-pointer"
                                        onClick={() => {
                                            setSelectedReimburse(item);
                                            setIsDetailOpen(true);
                                        }}
                                    >
                                        <CardContent className="p-5 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
                                            <div className="space-y-1.5 flex-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">{item.keterangan}</span>
                                                    {getStatusBadge(item.status)}
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded text-slate-600">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {formatTanggal(item.tanggal)}
                                                    </span>
                                                    {item.disetujuiPada && (
                                                        <span className="flex items-center gap-1.5 text-blue-600">
                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                            Disetujui: {formatTanggal(item.disetujuiPada)}
                                                        </span>
                                                    )}
                                                    {item.buktiUrl && (
                                                        <a href={item.buktiUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline">
                                                            <FileText className="w-3.5 h-3.5" /> Bukti
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="font-bold text-xl sm:text-2xl text-slate-700 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                                                {formatCurrency(item.jumlah)}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {hasMore && activeTab === 'unpaid' && (
                                    <Button
                                        variant="ghost"
                                        className="w-full mt-4 border-dashed text-muted-foreground"
                                        onClick={() => setVisibleCount(prev => prev + 10)}
                                    >
                                        Lihat Lainnya
                                    </Button>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="history" className="mt-6 space-y-4">
                        {historyReimbursements.length === 0 ? (
                            <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                <History className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                                <h3 className="text-lg font-semibold text-slate-900">Belum ada riwayat</h3>
                                <p className="text-slate-500 max-w-sm mx-auto mt-1">Riwayat pengajuan reimbursement Anda akan muncul di sini.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {displayedHistory.map(item => (
                                    <Card
                                        key={item.id}
                                        className={`shadow-sm hover:shadow-md transition-all border-l-4 cursor-pointer ${item.status === 'dibayar' ? 'border-l-green-500 bg-green-50/10' :
                                                item.status === 'ditolak' ? 'border-l-red-500 bg-red-50/10' :
                                                    'border-l-blue-500 bg-blue-50/10'
                                            }`}
                                        onClick={() => {
                                            setSelectedReimburse(item);
                                            setIsDetailOpen(true);
                                        }}
                                    >
                                        <CardContent className="p-5 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
                                            <div className="space-y-2 flex-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold text-lg text-slate-800">{item.keterangan}</span>
                                                    {getStatusBadge(item.status)}
                                                </div>

                                                <div className="flex flex-wrap gap-y-2 gap-x-4 text-sm text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5" /> Diajukan: {formatTanggal(item.tanggal)}
                                                    </span>

                                                    {item.disetujuiPada && (
                                                        <span className="flex items-center gap-1 text-blue-600">
                                                            <CheckCircle className="w-3.5 h-3.5" /> Disetujui: {formatTanggal(item.disetujuiPada)}
                                                        </span>
                                                    )}

                                                    {item.dibayarPada && (
                                                        <span className="flex items-center gap-1 text-green-600 font-medium">
                                                            <CheckCircle className="w-3.5 h-3.5" /> Dibayar: {formatTanggal(item.dibayarPada)}
                                                        </span>
                                                    )}

                                                    {item.buktiUrl && (
                                                        <a href={item.buktiUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-500 hover:text-blue-700 hover:underline">
                                                            <FileText className="w-3.5 h-3.5" /> Lihat Bukti
                                                        </a>
                                                    )}
                                                </div>

                                                {item.catatanPenolakan && (
                                                    <div className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm flex items-start gap-2 border border-red-100 mt-2">
                                                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                        <span className="font-medium">Alasan Penolakan: {item.catatanPenolakan}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className={`font-bold text-xl sm:text-2xl px-4 py-2 rounded-lg border ${item.status === 'dibayar' ? 'text-green-700 bg-green-50 border-green-100' :
                                                    item.status === 'ditolak' ? 'text-red-700 bg-red-50 border-red-100' :
                                                        'text-blue-700 bg-blue-50 border-blue-100'
                                                }`}>
                                                {formatCurrency(item.jumlah)}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {hasMore && activeTab === 'history' && (
                                    <Button
                                        variant="ghost"
                                        className="w-full mt-4 border-dashed text-muted-foreground"
                                        onClick={() => setVisibleCount(prev => prev + 10)}
                                    >
                                        Lihat Lainnya
                                    </Button>
                                )}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Info className="w-5 h-5 text-primary" /> Detail Reimbursement
                        </DialogTitle>
                        <DialogDescription>
                            Detail lengkap pengajuan reimbursement Anda.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedReimburse && (
                        <div className="space-y-6 py-2">
                            <div className="p-4 rounded-xl flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-100">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Total Klaim</span>
                                <span className="text-3xl font-bold text-slate-800">{formatCurrency(selectedReimburse.jumlah)}</span>
                                <div className="mt-2">{getStatusBadge(selectedReimburse.status)}</div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                        <FileText className="w-4 h-4 text-slate-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-muted-foreground">Keterangan</p>
                                        <p className="font-medium break-words">{selectedReimburse.keterangan}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                            <Calendar className="w-4 h-4 text-slate-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Tanggal Nota</p>
                                            <p className="font-medium">{formatTanggal(selectedReimburse.tanggal)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                            <User className="w-4 h-4 text-slate-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Oleh</p>
                                            <p className="font-medium">{users.find(u => u.id === selectedReimburse.userId)?.nama || 'User'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 border-t pt-4">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <History className="w-3.5 h-3.5" /> Log Status
                                    </p>
                                    <div className="space-y-3 border-l-2 border-slate-100 ml-4 pl-4">
                                        <div className="relative">
                                            <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-slate-300" />
                                            <p className="text-xs text-slate-500">Diajukan pada</p>
                                            <p className="text-sm font-medium">{formatTanggal(selectedReimburse.tanggal)}</p>
                                        </div>
                                        {selectedReimburse.disetujuiPada && (
                                            <div className="relative">
                                                <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-blue-400" />
                                                <p className="text-xs text-blue-500">Disetujui pada</p>
                                                <p className="text-sm font-medium">{formatTanggal(selectedReimburse.disetujuiPada)}</p>
                                            </div>
                                        )}
                                        {selectedReimburse.dibayarPada && (
                                            <div className="relative">
                                                <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-green-500" />
                                                <p className="text-xs text-green-500">Dibayar pada</p>
                                                <p className="text-sm font-medium">{formatTanggal(selectedReimburse.dibayarPada)}</p>
                                            </div>
                                        )}
                                        {selectedReimburse.status === 'ditolak' && (
                                            <div className="relative">
                                                <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-red-500" />
                                                <p className="text-xs text-red-500">Ditolak</p>
                                                {selectedReimburse.catatanPenolakan && (
                                                    <p className="text-sm font-medium text-red-700 bg-red-50 p-2 rounded mt-1 border border-red-100">
                                                        Alasan: {selectedReimburse.catatanPenolakan}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {selectedReimburse.buktiUrl && (
                                    <div className="pt-2">
                                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                            <FileText className="w-3 h-3" /> Bukti Transaksi
                                        </p>
                                        <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-video bg-slate-50 flex items-center justify-center">
                                            <img
                                                src={selectedReimburse.buktiUrl}
                                                alt="Bukti"
                                                className="w-full h-full object-cover"
                                            />
                                            <a
                                                href={selectedReimburse.buktiUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white gap-2 font-medium"
                                            >
                                                <ExternalLink className="w-5 h-5" /> Lihat Ukuran Penuh
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
}
