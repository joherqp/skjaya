import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { Clock, MapPin, CheckCircle, XCircle, History, Navigation, AlertTriangle } from 'lucide-react';
import { formatTanggal, formatWaktu } from '@/lib/utils';
import { getCurrentLocation } from '@/lib/gps';
import { toast } from 'sonner';
import { Map, Marker } from '@vis.gl/react-google-maps';
import { isWithinGeofence } from '@/lib/mapUtils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Location {
  latitude: number;
  longitude: number;
  alamat?: string;
}

export default function Absensi() {
  const { user } = useAuth();
  const { absensi, addAbsensi, updateAbsensi, refresh, repairUser, cabang } = useDatabase();
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(true);

  // Dialog States
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);
  const [checkInStatus, setCheckInStatus] = useState<'masuk' | 'izin'>('masuk');
  const [checkOutStatus, setCheckOutStatus] = useState<'pulang' | 'istirahat' | 'izin'>('pulang');
  const [reason, setReason] = useState('');
  const [displayLimit, setDisplayLimit] = useState(10);

  const today = new Date();
  const todayStr = today.toDateString();

  // Get all sessions for today
  const todaySessions = absensi.filter(a =>
    a.userId === user?.id &&
    new Date(a.tanggal).toDateString() === todayStr
  ).sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()); // Newest first

  // Check if there is currently an active session (not checked out)
  const activeSession = todaySessions.find(a => !a.checkOut);

  // Latest status (for display)
  // const lastSession = todaySessions[0];

  const recentAbsensi = absensi
    .filter(a => a.userId === user?.id)
    .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
    .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

  // Infinite scroll observer


  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    setIsGettingLocation(true);
    try {
      const location = await getCurrentLocation();
      setCurrentLocation(location);
    } catch (error) {
      console.error('Error getting location:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal mendapatkan lokasi');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const onCheckInClick = () => {
    if (!currentLocation) {
      toast.error('Lokasi belum tersedia. Silakan aktifkan GPS.');
      getLocation();
      return;
    }
    if (activeSession) {
      toast.error('Anda sudah check-in!');
      return;
    }
    setCheckInStatus('masuk');
    setReason('');
    setShowCheckInDialog(true);
  };

  const onCheckOutClick = () => {
    if (!currentLocation) {
      toast.error('Lokasi belum tersedia. Silakan aktifkan GPS.');
      getLocation();
      return;
    }
    if (!activeSession) return;

    const checkInTime = new Date(activeSession.checkIn!);
    const now = new Date();
    const diffHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

    if (diffHours < 8) {
      setCheckOutStatus('istirahat'); // Default suggest break/permit if < 8h
    } else {
      setCheckOutStatus('pulang');
    }
    setReason('');
    setShowCheckOutDialog(true);
  };

  const submitCheckIn = async () => {
    if (!user || !currentLocation) return;

    if (checkInStatus === 'izin' && !reason.trim()) {
      toast.error('Mohon sertakan alasan izin.');
      return;
    }

    setIsLoading(true);
    try {
      // Geofencing Check
      const userCabang = cabang.find(c => c.id === user.cabangId);
      if (userCabang?.koordinat) {
        const [latStr, lngStr] = userCabang.koordinat.split(',').map(s => s.trim());
        const cabangLat = parseFloat(latStr);
        const cabangLng = parseFloat(lngStr);

        if (!isNaN(cabangLat) && !isNaN(cabangLng)) {
          const isInside = isWithinGeofence(
            { lat: currentLocation.latitude, lng: currentLocation.longitude },
            { lat: cabangLat, lng: cabangLng },
            200 // 200m radius for branch office
          );

          if (!isInside && checkInStatus === 'masuk') {
            toast.warning('Anda berada di luar area kantor (radius > 200m). Absensi tetap dicatat namun akan ditandai.', {
              duration: 5000
            });
          }
        }
      }

      await addAbsensi({
        userId: user.id,
        tanggal: new Date(),
        checkIn: new Date(),
        lokasiCheckIn: currentLocation,
        status: checkInStatus === 'masuk' ? 'hadir' : 'izin', // Map to DB enum
        keterangan: reason
      });
      toast.success('Check-in berhasil!');
      setShowCheckInDialog(false);
    } catch (error: unknown) {
      console.error("Checkin failed", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      if (err.status === 409 || err.code === '23505' || err.message?.includes('duplicate')) {
        toast.warning('Anda sudah melakukan check-in sebelumnya.');
        refresh();
      } else if (err.code === '23503') {
        console.warn('User missing in public.users, attempting repair...');
        toast.loading('Memperbaiki data akun...');
        await repairUser();
        toast.dismiss();
        toast.loading('Mencoba check-in ulang...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await submitCheckIn();
      } else {
        toast.error(`Gagal check-in: ${err.message || err.error_description || 'Unknown error'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const submitCheckOut = async () => {
    if (!activeSession || !currentLocation) return;

    if ((checkOutStatus === 'izin' || checkOutStatus === 'istirahat') && !reason.trim() && checkOutStatus !== 'istirahat') {
      // Maybe 'istirahat' doesn't strictly need a reason, but prompt asked: "kalo isttirahat itu berarti bisa lanjut lagi"
      // I'll make reason optional for 'istirahat' unless user wants to enforce it. The prompt says "kalo isttirahat... kalo ijin sertakan alasan". 
      // So for 'izin', reason is mandatory. For 'istirahat', maybe just standard 'Istirahat'?
      // Update: Prompt says "kalo ijin sertakan alasan". It didn't explicitly demand reason for "istirahat", but it's good practice. I'll leave it optional for break.
    }
    if (checkOutStatus === 'izin' && !reason.trim()) {
      toast.error('Mohon sertakan alasan izin.');
      return;
    }

    setIsLoading(true);
    try {
      // If checking out as 'Istirahat' or 'Izin' before 8h?
      // Actually, schema usually has one status per session. 
      // If I change status here, it updates the whole row status? 
      // Existing status is 'hadir' (from checkin). 
      // If checkout is 'izin', should we change status to 'izin'?
      // Or keep 'hadir' and just add note?
      // Prompt says "izin sertakan alasan yang nantinya akan terhubung dengan tabel absensi".
      // It implies status change or at least visible reason.

      let finalStatus = activeSession.status; // Keep existing usually
      const finalReason = activeSession.keterangan ? activeSession.keterangan + ' | ' + reason : reason;

      if (checkOutStatus === 'izin') {
        finalStatus = 'izin'; // Update status if they leave early for permission
        // Note: This might overwrite 'hadir'. 
      }

      // If 'istirahat', we probably just check out? Or do we need a "Pause" feature?
      // "kalo isttirahat itu berarti bisa lanjut lagi" -> implies they might check in again later today.
      // My current system supports multiple sessions per day. So checking out "Istirahat" just ends this session.
      // Next check-in starts new session. This works with "bisa lanjut lagi".

      await updateAbsensi(activeSession.id, {
        checkOut: new Date(),
        lokasiCheckOut: currentLocation,
        status: finalStatus,
        keterangan: finalReason || undefined
      });
      toast.success(checkOutStatus === 'istirahat' ? 'Selamat beristirahat!' : 'Check-out berhasil!');
      setShowCheckOutDialog(false);
    } catch (error: unknown) {
      console.error("Checkout failed", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      toast.error(`Gagal check-out: ${err.message || err.error_description || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout title="Absensi">
      <div className="p-4 space-y-5">
        {/* Current Time Card */}
        <Card className="gradient-hero text-primary-foreground overflow-hidden">
          <CardContent className="p-5 relative">
            <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-primary-foreground/10" />
            <div className="relative text-center">
              <p className="text-primary-foreground/80 text-sm">{formatTanggal(today)}</p>
              <p className="text-4xl font-bold mt-2">
                {today.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Location Status */}
        <Card elevated>
          <CardContent className="p-0 overflow-hidden">
            <div className="h-40 w-full relative">
              {currentLocation ? (
                <Map
                  defaultCenter={{ lat: currentLocation.latitude, lng: currentLocation.longitude }}
                  defaultZoom={15}
                  center={{ lat: currentLocation.latitude, lng: currentLocation.longitude }}
                  gestureHandling={'none'}
                  disableDefaultUI={true}
                >
                  <Marker position={{ lat: currentLocation.latitude, lng: currentLocation.longitude }} />
                </Map>
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <p className="text-xs text-muted-foreground italic">Peta belum tersedia</p>
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-2">
                <Button variant="secondary" size="sm" onClick={getLocation} disabled={isGettingLocation} className="h-7 px-2 text-[10px] shadow-sm">
                  <Navigation className="w-3 h-3 mr-1" />
                  Refresh GPS
                </Button>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${currentLocation ? 'bg-success/10' : 'bg-warning/10'}`}>
                  <MapPin className={`w-5 h-5 ${currentLocation ? 'text-success' : 'text-warning'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Lokasi Saat Ini</p>
                  {isGettingLocation ? (
                    <p className="text-xs text-muted-foreground">Mencari lokasi...</p>
                  ) : currentLocation ? (
                    <p className="text-xs text-muted-foreground truncate">{currentLocation.alamat}</p>
                  ) : (
                    <p className="text-xs text-destructive">Wajib aktifkan GPS</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Check In/Out */}
        <Card elevated>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex justify-between items-center">
              <span>Status Hari Ini</span>
              {todaySessions.length > 0 && <Badge variant="outline">{todaySessions.length} Sesi</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeSession ? (
              // Not actively checked in
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-warning" />
                </div>
                <p className="text-muted-foreground mb-4">
                  {todaySessions.length > 0
                    ? "Anda sedang tidak dalam jam kerja (Sudah Check Out). Klik Check In untuk lanjut."
                    : "Anda belum melakukan absensi hari ini."}
                </p>
                <Button
                  variant="glow"
                  size="lg"
                  className="w-full"
                  onClick={onCheckInClick}
                  disabled={isLoading || isGettingLocation || !currentLocation}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      {todaySessions.length > 0 ? "Check In Lagi" : "Check In"}
                    </>
                  )}
                </Button>
              </div>
            ) : (
              // Active Session
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <div>
                      <p className="text-sm font-medium">Masuk</p>
                      <p className="text-xs text-muted-foreground">
                        {activeSession.checkIn && formatWaktu(new Date(activeSession.checkIn))}
                      </p>
                      {activeSession.keterangan && <p className="text-xs text-muted-foreground italic truncate max-w-[200px]">{activeSession.keterangan}</p>}
                    </div>
                  </div>
                  <Badge variant="success">Sedang Aktif</Badge>
                </div>

                <Button
                  variant="destructive"
                  size="lg"
                  className="w-full"
                  onClick={onCheckOutClick}
                  disabled={isLoading || isGettingLocation || !currentLocation}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  ) : (
                    <>
                      <XCircle className="w-5 h-5" />
                      Check Out
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Check In Dialog */}
        <Dialog open={showCheckInDialog} onOpenChange={setShowCheckInDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Konfirmasi Kehadiran</DialogTitle>
              <DialogDescription>
                Silakan pilih status kehadiran Anda untuk sesi ini.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <RadioGroup
                value={checkInStatus}
                onValueChange={(val: 'masuk' | 'izin') => setCheckInStatus(val)}
                className="grid grid-cols-2 gap-4"
              >
                <div>
                  <RadioGroupItem value="masuk" id="in-masuk" className="peer sr-only" />
                  <Label
                    htmlFor="in-masuk"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <CheckCircle className="mb-2 h-6 w-6" />
                    Masuk Kerja
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="izin" id="in-izin" className="peer sr-only" />
                  <Label
                    htmlFor="in-izin"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <AlertTriangle className="mb-2 h-6 w-6" />
                    Izin / Sakit
                  </Label>
                </div>
              </RadioGroup>

              {checkInStatus === 'izin' && (
                <div className="space-y-2">
                  <Label>Alasan Izin</Label>
                  <Textarea
                    placeholder="Contoh: Sakit demam, Izin urusan keluarga..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCheckInDialog(false)}>Batal</Button>
              <Button onClick={submitCheckIn}>Konfirmasi</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Check Out Dialog */}
        <Dialog open={showCheckOutDialog} onOpenChange={setShowCheckOutDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Konfirmasi Check Out</DialogTitle>
              <DialogDescription>
                {(() => {
                  if (!activeSession) return "";
                  const diff = (new Date().getTime() - new Date(activeSession.checkIn!).getTime()) / (1000 * 60 * 60);
                  if (diff < 8) return `Anda baru bekerja selama ${diff.toFixed(1)} jam (kurang dari 8 jam).`;
                  return "Anda sudah bekerja lebih dari 8 jam.";
                })()}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {(() => {
                if (!activeSession) return null;
                const diff = (new Date().getTime() - new Date(activeSession.checkIn!).getTime()) / (1000 * 60 * 60);
                if (diff < 8) {
                  return (
                    <>
                      <Label>Alasan Check Out Dini</Label>
                      <RadioGroup
                        value={checkOutStatus}
                        onValueChange={(val: string) => setCheckOutStatus(val as 'izin' | 'pulang' | 'istirahat')}
                        className="grid grid-cols-2 gap-4"
                      >
                        <div>
                          <RadioGroupItem value="istirahat" id="out-istirahat" className="peer sr-only" />
                          <Label
                            htmlFor="out-istirahat"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                            <Clock className="mb-2 h-6 w-6" />
                            Istirahat
                          </Label>
                        </div>
                        <div>
                          <RadioGroupItem value="izin" id="out-izin" className="peer sr-only" />
                          <Label
                            htmlFor="out-izin"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                          >
                            <AlertTriangle className="mb-2 h-6 w-6" />
                            Izin Pulang
                          </Label>
                        </div>
                      </RadioGroup>
                    </>
                  );
                } else {
                  // > 8 hours, usually simple checkout, but maybe allow option? 
                  // Default to just confirmation text or optional note?
                  // User requirement implies logic mostly for < 8h or specific Izin/Break scenarios.
                  // I'll leave simple text for normal checkout, but allow 'izin' option if they really want to mark it?
                  // Keep simple for >8h to avoid friction.
                  return <p className="text-sm text-muted-foreground">Apakah Anda yakin ingin mengakhiri sesi kerja ini?</p>;
                }
              })()}

              {(checkOutStatus === 'izin' || checkOutStatus === 'istirahat' || checkOutStatus === 'pulang') && (
                // Show textarea if < 8h OR if user wants to add note? 
                // Prompt: "kalo isttirahat... kalo ijin sertakan alasan". 
                // Logic below ensures textbox appears for Izin/Istirahat options.
                (activeSession && (new Date().getTime() - new Date(activeSession.checkIn!).getTime()) / (1000 * 60 * 60) < 8) && (
                  <div className="space-y-2">
                    <Label>Keterangan / Alasan {checkOutStatus === 'izin' ? '(Wajib)' : '(Opsional)'}</Label>
                    <Textarea
                      placeholder={checkOutStatus === 'izin' ? "Alasan izin pulang..." : "Catatan tambahan..."}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>
                )
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCheckOutDialog(false)}>Batal</Button>
              <Button onClick={submitCheckOut}>{checkOutStatus === 'istirahat' ? 'Istirahat' : 'Check Out'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Recent History */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <History className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground">Riwayat Absensi</h3>
          </div>

          {recentAbsensi.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Clock className="w-10 h-10 mx-auto text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground text-sm">Belum ada riwayat absensi</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentAbsensi.slice(0, displayLimit).map((item, index) => (
                <Card key={item.id} className="animate-slide-up" style={{ animationDelay: `${index * 30}ms` }}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{formatTanggal(new Date(item.tanggal))}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {item.checkIn && (
                          <span className="text-xs text-muted-foreground">
                            In: {formatWaktu(new Date(item.checkIn))}
                          </span>
                        )}
                        {item.checkOut && (
                          <span className="text-xs text-muted-foreground">
                            Out: {formatWaktu(new Date(item.checkOut))}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant={
                      item.status === 'hadir' ? 'success' :
                        item.status === 'izin' ? 'info' :
                          item.status === 'sakit' ? 'warning' : 'destructive'
                    }>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Badge>
                  </CardContent>
                </Card>
              ))}

              {recentAbsensi.length > displayLimit && (
                <Button
                  variant="ghost"
                  className="w-full mt-4 border-dashed text-muted-foreground"
                  onClick={() => setDisplayLimit(prev => prev + 10)}
                >
                  Lihat Lainnya
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
