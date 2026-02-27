
import { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, X } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError('');
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError('Gagal mengakses kamera. Pastikan izin diberikan.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        stopCamera();
        onCapture(dataUrl);
      }
    }
  };

  // Start camera on mount
  useState(() => {
    startCamera();
  });

  // Cleanup on unmount
  useState(() => {
    return () => stopCamera();
  });

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-black rounded-2xl overflow-hidden aspect-[3/4] border border-gray-800">
        {error ? (
           <div className="absolute inset-0 flex items-center justify-center text-white text-center p-4">
             <p>{error}</p>
             <Button onClick={startCamera} variant="outline" className="mt-4">Coba Lagi</Button>
           </div>
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Controls */}
        <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-6">
           <Button 
             variant="destructive" 
             size="icon" 
             className="w-12 h-12 rounded-full"
             onClick={() => { stopCamera(); onCancel(); }}
           >
             <X className="w-6 h-6" />
           </Button>

           <Button 
             variant="default" 
             size="icon" 
             className="w-16 h-16 rounded-full border-4 border-white/30 bg-white hover:bg-white/90 text-black"
             onClick={capturePhoto}
             disabled={!!error}
           >
             <Camera className="w-8 h-8" />
           </Button>
           
           <Button
             variant="secondary"
             size="icon"
             className="w-12 h-12 rounded-full bg-white/20 backdrop-blur text-white hover:bg-white/30"
             onClick={startCamera}
           >
             <RefreshCw className="w-5 h-5" />
           </Button>
        </div>
      </div>
      <p className="text-white mt-4 text-sm">Ambil foto selfie untuk absensi</p>
    </div>
  );
}
