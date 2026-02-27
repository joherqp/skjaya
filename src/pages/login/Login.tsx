import { useState, useEffect } from 'react';
import { ArrowLeft, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [showBlank, setShowBlank] = useState(true);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { loginWithGoogle, login } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowBlank(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithGoogle();
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Email dan password harus diisi');
      return;
    }

    setIsLoading(true);
    try {
      const success = await login(email, password);
      if (!success) {
        toast.error('Email atau password salah');
      }
    } catch (error) {
      toast.error('Terjadi kesalahan saat login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white relative overflow-hidden">
      {/* Blank Initial Overlay */}
      <div
        className={`absolute inset-0 z-50 bg-white transition-opacity duration-1000 pointer-events-none ease-in-out ${showBlank ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Premium Ambient Background (Light) */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-[400px] space-y-8 relative z-10">

        {/* Brand Identity */}
        <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 p-0.5 mb-2 shadow-2xl shadow-primary/20">
            <div className="w-full h-full bg-primary rounded-[14px] flex items-center justify-center">
              <span className="text-2xl font-black text-white tracking-tighter">SKJ</span>
            </div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl uppercase">
            SURYA KHARISMA JAYA
          </h1>
          <p className="text-zinc-500 font-medium tracking-wide text-sm">Sistem Manajemen Distribusi</p>
        </div>

        {/* Login Container with Soft Shadow */}
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500 fill-mode-both">
          <Card className="border-zinc-200 bg-white/80 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.08)] overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-30" />

            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl text-zinc-800">Selamat Datang Kembali</CardTitle>
              <CardDescription className="text-zinc-500 italic">
                Cepat. Handal. Terintegrasi.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-4">
              {!showEmailLogin ? (
                <>
                  <Button
                    onClick={handleLogin}
                    className="w-full h-14 bg-zinc-900 hover:bg-zinc-800 text-white border-none shadow-lg transition-all active:scale-95 group font-semibold text-base"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                        <span>Menghubungkan...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center w-full relative">
                        <div className="bg-white p-1 rounded-sm absolute left-2">
                          <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                          </svg>
                        </div>
                        <span>Masuk dengan Google</span>
                      </div>
                    )}
                  </Button>
                  <div className="text-center">
                    <Button
                      variant="link"
                      className="text-zinc-500 hover:text-zinc-800 text-sm"
                      onClick={() => setShowEmailLogin(true)}
                    >
                      Masuk dengan Email / Password
                    </Button>
                  </div>
                </>
              ) : (
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-2 text-left">
                    <Input
                      placeholder="Email atau Username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                    <Input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-zinc-900 hover:bg-zinc-800 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Memproses...' : 'Masuk'}
                  </Button>
                  <div className="text-center">
                    <Button
                      variant="link"
                      className="text-zinc-500 hover:text-zinc-800 text-sm"
                      type="button"
                      onClick={() => setShowEmailLogin(false)}
                      disabled={isLoading}
                    >
                      Batal, kembali ke Google Login
                    </Button>
                  </div>
                </form>
              )}

              <Alert variant="default" className="bg-zinc-50 border-zinc-200 text-zinc-600">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Panduan Akses Baru</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed">
                  Belum punya akun? Silakan masuk dengan Google terlebih dahulu, kemudian segera hubungi <strong className="text-zinc-900">ADMIN</strong> untuk aktivasi akun Anda.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>

        {/* Footer info */}
        <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-700 fill-mode-both">
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-zinc-600 transition-colors"
            onClick={() => window.location.href = 'https://skjaya.my.id'}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Portal Utama
          </Button>
          <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-widest">
            &copy; 2026 Surya Kharisma Jaya
          </p>
        </div>
      </div>
    </div>
  );
}
