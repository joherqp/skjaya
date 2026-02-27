import { Hammer, Home, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export default function MaintenancePage() {
    const { profilPerusahaan } = useDatabase();
    const { user } = useAuth();
    const navigate = useNavigate();

    const msg = profilPerusahaan?.config?.maintenanceMessage ||
        'Aplikasi sedang dalam perbaikan rutin untuk meningkatkan kualitas layanan kami.';

    // If maintenance is turned off, redirect to home
    useEffect(() => {
        if (profilPerusahaan?.config && !profilPerusahaan.config.isMaintenance) {
            navigate('/beranda');
        }
    }, [profilPerusahaan?.config?.isMaintenance, navigate]);

    // If user is admin/owner, they shouldn't be here. Let's redirect them back if they happen to land here.
    useEffect(() => {
        if (user?.roles.includes('admin') || user?.roles.includes('owner')) {
            // They can bypass, but we stay here unless they click home.
            // Or we could auto-redirect them too? 
            // For now, let's just let them stay if they want to see the maintenance page,
            // but non-admins are forced here by App.tsx anyway.
        }
    }, [user]);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="relative mx-auto w-24 h-24">
                    <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                    <div className="relative bg-white rounded-full shadow-xl p-6 flex items-center justify-center border-2 border-primary/10">
                        <Hammer className="w-10 h-10 text-primary animate-bounce-slow" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                        Sedang Perbaikan
                    </h1>
                    <p className="text-lg text-slate-600 leading-relaxed">
                        {msg}
                    </p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 text-sm text-slate-500 mb-4">
                        <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                        Estimasi selesai: Segera
                    </div>
                    <p className="text-sm text-slate-500 italic">
                        "Kami sedang melakukan pemeliharaan infrastruktur untuk memastikan performa aplikasi tetap optimal."
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    {(user?.roles.includes('admin') || user?.roles.includes('owner')) ? (
                        <Button
                            onClick={() => navigate('/beranda')}
                            className="w-full sm:w-auto gap-2 shadow-lg shadow-primary/20"
                        >
                            <Home className="w-4 h-4" />
                            Masuk ke Dashboard (Admin)
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            className="w-full sm:w-auto gap-2"
                            onClick={() => window.location.reload()}
                        >
                            <MessageSquare className="w-4 h-4" />
                            Cek Lagi
                        </Button>
                    )}
                </div>

                <div className="text-xs text-slate-400">
                    &copy; {new Date().getFullYear()} {profilPerusahaan?.nama || 'Aplikasi POS'}. All rights reserved.
                </div>
            </div>
        </div>
    );
}
