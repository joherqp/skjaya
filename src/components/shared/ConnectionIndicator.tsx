import { Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { useDatabase } from '@/contexts/DatabaseContext';

export function ConnectionIndicator() {
  const isOnline = useOnlineStatus();
  const { pendingSyncCount } = useDatabase();

  if (isOnline && pendingSyncCount === 0) return null;

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-1 px-4 text-xs font-medium transition-all duration-300",
      isOnline 
        ? "bg-yellow-500 text-white" // Syncing / Recovered state (if we had pending items)
        : "bg-destructive text-destructive-foreground animate-pulse" // Offline state
    )}>
      {isOnline ? (
        <>
           {pendingSyncCount > 0 ? (
             <>
                <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                <span>Menyinkronkan {pendingSyncCount} data...</span>
             </>
           ) : null} 
        </>
      ) : (
        <>
          <WifiOff className="w-3 h-3" />
          <span>Mode Offline - Data akan disimpan di perangkat</span>
        </>
      )}
    </div>
  );
}
