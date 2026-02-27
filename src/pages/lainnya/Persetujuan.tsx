import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { CheckCircle, XCircle, Clock, FileText, User, Wallet, ArrowLeftRight, History, UserCog, Eye, FileDiff, ArrowRight, Tag, UserCheck, PackagePlus, Building, Users, MessageSquare, Coins, Download, ArrowUpCircle, Calendar, Percent, Inbox } from 'lucide-react';
import { formatTanggal, formatRupiah } from '@/lib/utils';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSearchParams, useNavigate } from 'react-router-dom';
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import { Penjualan, MutasiBarang, Cabang, Pelanggan, Barang, Persetujuan as PersetujuanType, PersetujuanPayload } from '@/lib/types';
import { ApprovalCard } from './components/ApprovalCard';
import { ApprovalConfirmDialog } from './components/ApprovalConfirmDialog';
import { ApprovalDetailDialog } from './components/ApprovalDetailDialog';
import { useApprovalAction } from './hooks/useApprovalAction';
import { useApprovalReport } from './hooks/useApprovalReport';



export default function Persetujuan() {
    const { user } = useAuth();
    const {
        persetujuan,
        barang,
        cabang,
        satuan: satuanList, users, kategoriPelanggan,
        pelanggan,
        penjualan,
        viewMode,
        reimburse,
        mutasiBarang
    } = useDatabase();

    const { executeApprove, executeReject } = useApprovalAction();
    const { handleDownloadReport } = useApprovalReport();
    const navigate = useNavigate();

    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'pending');
    const [historyLimit, setHistoryLimit] = useState(10);
    const [pendingLimit, setPendingLimit] = useState(10);
    const [reimburseMode, setReimburseMode] = useState<'pay_now' | 'pay_later' | 'forward'>('pay_later');
    const [rejectionReason, setRejectionReason] = useState('');
    const formatUserDetail = (id?: string) => users.find(u => u.id === id)?.nama || 'Unknown';
    const pendingLoadMoreRef = useRef<HTMLDivElement>(null);
    const historyLoadMoreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && (tab === 'pending' || tab === 'riwayat')) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    // Deep link support for QR scan
    useEffect(() => {
        const itemId = searchParams.get('id');
        if (itemId && persetujuan.length > 0) {
            const item = persetujuan.find(p => p.id === itemId);
            if (item) {
                const targetTab = item.status === 'pending' ? 'pending' : 'riwayat';
                setActiveTab(targetTab);
                setDetailDialog({ isOpen: true, item: item as PersetujuanType });
            }
        }
    }, [searchParams, persetujuan]);

    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        action: 'approve' | 'reject';
        id: string;
        type: string;
        refId: string;
        data?: Record<string, unknown>;
    }>({ isOpen: false, action: 'approve', id: '', type: '', refId: '' });

    const [detailDialog, setDetailDialog] = useState<{
        isOpen: boolean;
        item: PersetujuanType | null;
    }>({ isOpen: false, item: null });

    const handleViewDetail = (item: PersetujuanType) => {
        setDetailDialog({ isOpen: true, item });
    };

    // Trigger handlers
    const handleApprove = (id: string, type: string, refId: string, data?: PersetujuanPayload) => {
        setConfirmDialog({
            isOpen: true,
            action: 'approve',
            id, type, refId, data: data as Record<string, unknown>
        });
    };

    const handleReject = (id: string, type: string, refId: string, data?: PersetujuanPayload) => {
        setConfirmDialog({
            isOpen: true,
            action: 'reject',
            id, type, refId, data: data as Record<string, unknown>
        });
    };

    const [payNow, setPayNow] = useState(true); // Legacy Switch mode (unused now)

    const handleConfirmAction = async () => {
        if (confirmDialog.action === 'approve') {
            // Derive data based on reimburseMode for reimburse type
            let actionData = confirmDialog.data || {};

            if (confirmDialog.type === 'reimburse') {
                if (reimburseMode === 'forward') {
                    actionData = { ...actionData, forwardToPusat: true };
                } else {
                    actionData = { ...actionData, payNow: reimburseMode === 'pay_now' };
                }
            }

            const result = await executeApprove(confirmDialog.id, confirmDialog.type, confirmDialog.refId, actionData);

            if (result && result.success === false) {
                if (result.reason === 'insufficient_stock') {
                    toast.error("Stok tidak mencukupi. Silakan lakukan Restock (Barang Masuk) terlebih dahulu.");
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                    navigate('/barang/update-stok?tab=restock&returnTo=/persetujuan?tab=pending');
                    return;
                }
            }
        } else {
            executeReject(confirmDialog.id, confirmDialog.type, confirmDialog.refId, rejectionReason);
            setRejectionReason('');
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    };

    const pendingList = persetujuan.filter(p => {
        // Must be pending strictly
        if (p.status !== 'pending') return false;

        // Filter: Am I the Target?
        let isTarget = true;

        // 1. Specific User Target (Highest Priority)
        if (p.targetUserId) {
            if (p.targetUserId !== user?.id) isTarget = false;
        } else {
            // If viewMode is 'self', we only care about SPECIFIC targets (p.targetUserId)
            // So if targetUserId is null, and viewMode is 'self', we skip role/branch targets
            if (viewMode === 'me') {
                isTarget = false;
            } else {
                // 2. Role Target
                const isSuperUser = user?.roles.includes('admin') || user?.roles.includes('owner');
                if (p.targetRole && !user?.roles.includes(p.targetRole) && !isSuperUser) isTarget = false;

                // 3. Branch Target (unless global admin/owner)
                if (p.targetCabangId) {
                    const isGlobalUser = user?.roles.includes('admin') || user?.roles.includes('owner');
                    if (!isGlobalUser && p.targetCabangId !== user?.cabangId) isTarget = false;
                }
            }
        }

        // Hide if I am the Requester (Prevent "Approving own request" in Inbox, user sees it in History/Tracking)
        if (p.diajukanOleh === user?.id) return false;

        return isTarget;
    });

    const historyList = persetujuan.filter(p => {
        // 1. My Requests (All, including Pending - for Tracking)
        if (p.diajukanOleh === user?.id) return true;

        // In 'me' mode, ONLY show my requests
        if (viewMode === 'me') return false;

        // 2. Items I was targeted for AND are processed (Approved/Rejected)
        // (Inbox Items that are finished)
        if (p.status === 'pending') return false; // If pending and not mine, it's in Inbox, not History

        let isTarget = true;
        if (p.targetUserId) {
            if (p.targetUserId !== user?.id) isTarget = false;
        } else {
            const isSuperUser = user?.roles.includes('admin') || user?.roles.includes('owner');
            if (p.targetRole && !user?.roles.includes(p.targetRole) && !isSuperUser) isTarget = false;
            if (p.targetCabangId) {
                const isGlobalUser = user?.roles.includes('admin') || user?.roles.includes('owner');
                if (!isGlobalUser && p.targetCabangId !== user?.cabangId) isTarget = false;
            }
        }
        return isTarget;
    });

    // Infinite Scroll Observers
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && pendingList.length > pendingLimit) {
                    setPendingLimit((prev) => prev + 10);
                }
            },
            { threshold: 1.0 }
        );

        if (pendingLoadMoreRef.current) {
            observer.observe(pendingLoadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [pendingLimit, pendingList.length]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && historyList.length > historyLimit) {
                    setHistoryLimit((prev) => prev + 10);
                }
            },
            { threshold: 1.0 }
        );

        if (historyLoadMoreRef.current) {
            observer.observe(historyLoadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [historyLimit, historyList.length]);

    const getUnitName = (id?: string) => satuanList.find(s => s.id === id)?.nama || 'Unit';




    return (
        <MainLayout title="Kotak Masuk (Persetujuan)">
            <div className="p-4 space-y-4">
                {/* ... (Tabs and Content) ... */}
                <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="pending" className="flex items-center gap-2">
                            <Inbox className="w-4 h-4" /> Kotak Masuk
                            {pendingList.length > 0 && <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">{pendingList.length}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="riwayat" className="flex items-center gap-2">
                            <History className="w-4 h-4" /> Riwayat
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending" className="space-y-4">
                        {pendingList.length === 0 ? (
                            <Card>
                                <CardContent className="p-8 text-center text-muted-foreground">
                                    <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-2" />
                                    Kotak masuk Anda kosong saat ini.
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                {pendingList.slice(0, pendingLimit).map(item => (
                                    <ApprovalCard
                                        key={item.id}
                                        item={item}
                                        isHistory={false}
                                        users={users}
                                        cabang={cabang}
                                        barang={barang}
                                        satuan={satuanList}
                                        pelanggan={pelanggan}
                                        kategoriPelanggan={kategoriPelanggan}
                                        reimburse={reimburse}
                                        mutasiData={item.jenis === 'mutasi' ? mutasiBarang.find(m => m.id === item.referensiId) as unknown as PersetujuanPayload : undefined}
                                        onViewDetail={handleViewDetail}
                                    />
                                ))}
                                {pendingList.length > pendingLimit && (
                                    <div ref={pendingLoadMoreRef} className="h-4 w-full" />
                                )}
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="riwayat" className="space-y-4">
                        {historyList.length === 0 ? (
                            <Card>
                                <CardContent className="p-8 text-center text-muted-foreground">
                                    <History className="w-12 h-12 mx-auto text-muted-foreground/30 mb-2" />
                                    Belum ada riwayat persetujuan.
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                {historyList.slice(0, historyLimit).map(item => (
                                    <ApprovalCard
                                        key={item.id}
                                        item={item}
                                        isHistory={true}
                                        users={users}
                                        cabang={cabang}
                                        barang={barang}
                                        satuan={satuanList}
                                        pelanggan={pelanggan}
                                        kategoriPelanggan={kategoriPelanggan}
                                        reimburse={reimburse}
                                        mutasiData={item.jenis === 'mutasi' ? mutasiBarang.find(m => m.id === item.referensiId) as unknown as PersetujuanPayload : undefined}
                                        onViewDetail={handleViewDetail}
                                    />
                                ))}
                                {historyList.length > historyLimit && (
                                    <div ref={historyLoadMoreRef} className="h-4 w-full" />
                                )}
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            <ApprovalConfirmDialog
                isOpen={confirmDialog.isOpen}
                onOpenChange={(open) => {
                    if (!open) setRejectionReason('');
                    setConfirmDialog(prev => ({ ...prev, isOpen: open }));
                }}
                confirmDialog={confirmDialog}
                onConfirm={handleConfirmAction}

                rejectionReason={rejectionReason}
                setRejectionReason={setRejectionReason}
                reimburseMode={reimburseMode}
                setReimburseMode={setReimburseMode}
                users={users}
                reimburse={reimburse}
            />

            <ApprovalDetailDialog
                isOpen={detailDialog.isOpen}
                onOpenChange={(open) => setDetailDialog(prev => ({ ...prev, isOpen: open }))}
                item={detailDialog.item}
                onApprove={(item) => {
                    const isReimburse = item.jenis === 'reimburse';
                    const rData = isReimburse ? reimburse.find(r => r.id === item.referensiId) : null;
                    const isWaitingPayment = isReimburse && item.status === 'disetujui' && rData?.status === 'disetujui';

                    if (isReimburse) {
                        setReimburseMode(isWaitingPayment ? 'pay_now' : 'pay_later');
                    }
                    setDetailDialog(prev => ({ ...prev, isOpen: false }));
                    handleApprove(item.id, item.jenis, item.referensiId as string, item.data as PersetujuanPayload);
                }}
                onReject={(item) => {
                    setDetailDialog(prev => ({ ...prev, isOpen: false }));
                    handleReject(item.id, item.jenis, item.referensiId as string, item.data as PersetujuanPayload);
                }}
                onPrintReport={handleDownloadReport}
                user={user}
                users={users}
                cabang={cabang}
                barang={barang}
                satuan={satuanList}
                pelanggan={pelanggan}
                reimburse={reimburse}
                penjualan={penjualan}
                mutasiData={detailDialog.item?.jenis === 'mutasi' ? mutasiBarang.find(m => m.id === detailDialog.item.referensiId) as unknown as PersetujuanPayload : undefined}
            />
        </MainLayout>
    );
}
