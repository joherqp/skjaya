import { useState, useRef, useEffect } from 'react';
import { askAIChat } from '@/lib/api/chat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatRupiah } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AIChat() {
  const { user } = useAuth();
  const { penjualan, barang, absensi, users, satuan, pelanggan, stokPengguna } = useDatabase();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Halo ${user?.nama?.split(' ')[0] || 'Kak'}! Saya asisten pintar CVSKJ. \nSilakan tanya data toko, cek stok spesifik, atau info pelanggan.`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const quickAsk = (text: string) => {
    setInput(text);
    handleSend(undefined, text);
  };

  /* 
   * NEW: Integrated with Supabase Edge Function 'chat-ai'
   * Falls back to local logic if API is unreachable.
   */
  const processMessage = async (text: string) => {
    // 1. Try API First
    try {
      const responseText = await askAIChat(text);
      return responseText;
    } catch (error) {
      console.warn("API Error, using fallback logic...", error);
      // Fallback to local logic (below)
    }

    // --- FALLBACK LOCAL LOGIC ---
    const lowerText = text.toLowerCase();
    let response = "Maaf, saya belum mengerti (Mode Offline).";

    // Simulate thinking delay only for local
    await new Promise(resolve => setTimeout(resolve, 800));

    // 1. Sales / Omset Logic
    if (lowerText.includes('omset') || lowerText.includes('penjualan') || lowerText.includes('laku')) {
      const today = new Date().toDateString();

      // Filter Sales based on Role
      let filteredSales = penjualan.filter(p => new Date(p.tanggal).toDateString() === today);

      const isGlobalInfo = user?.roles.includes('admin') || user?.roles.includes('owner') || user?.roles.includes('finance');
      const isLeader = user?.roles.includes('leader');
      const isSales = user?.roles.includes('sales');

      if (!isGlobalInfo) {
        if (isLeader) {
          filteredSales = filteredSales.filter(p => p.cabangId === user?.cabangId);
        } else if (isSales) {
          filteredSales = filteredSales.filter(p => p.salesId === user?.id);
        }
      }

      const totalOmset = filteredSales.reduce((sum, p) => sum + p.total, 0);
      const count = filteredSales.length;

      // Breakdown Payment Method
      const tunai = filteredSales.filter(p => p.metodePembayaran === 'tunai').reduce((sum, p) => sum + p.total, 0);
      const transfer = filteredSales.filter(p => p.metodePembayaran === 'transfer').reduce((sum, p) => sum + p.total, 0);
      const tempo = filteredSales.filter(p => p.metodePembayaran === 'tempo').reduce((sum, p) => sum + p.total, 0);

      const scopeText = isGlobalInfo ? 'Global' : isLeader ? 'Cabang' : 'Anda';
      response = `📊 **Laporan Penjualan ${scopeText} (Offline)**\n\n💰 Total Omset: **${formatRupiah(totalOmset)}**\n📝 Transaksi: ${count} nota\n\n📌 *Rincian Pembayaran:*\n- Tunai: ${formatRupiah(tunai)}\n- Transfer: ${formatRupiah(transfer)}\n- Tempo: ${formatRupiah(tempo)}`;

      if (count > 0 && lowerText.includes('laku')) {
        response += "\n\nUntuk detail barang terlaris, silakan cek menu Laporan.";
      }
    }

    // 2. Stock / Barang Logic (Enhanced)
    else if (lowerText.includes('stok') || lowerText.includes('barang') || lowerText.includes('cari')) {
      // Specific Item Search
      // Extract query after 'stok' or 'cari' or 'barang'
      const itemQuery = lowerText.replace(/stok|barang|cari|cek|berapa/g, '').trim();

      if (itemQuery.length > 2 && !lowerText.includes('menipis') && !lowerText.includes('habis')) {
        const foundItems = barang.filter(b => b.nama.toLowerCase().includes(itemQuery));

        if (foundItems.length > 0) {
          const list = foundItems.slice(0, 5).map(b => {
            // Robust Unit Lookup
            const unitObj = satuan.find(s => s.id === b.satuanId);
            const unitName = unitObj ? unitObj.nama : 'Unit'; // Fallback to 'Unit' if not found
            const totalStok = stokPengguna.filter(s => s.barangId === b.id).reduce((sum, s) => sum + s.jumlah, 0);
            return `- **${b.nama}**: ${totalStok} ${unitName}`;
          }).join('\n');
          response = `🔍 Ditemukan ${foundItems.length} barang similar:\n${list}`;
          if (foundItems.length > 5) response += `\n...dan ${foundItems.length - 5} lainnya.`;
        } else {
          response = `❌ Barang dengan nama "${itemQuery}" tidak ditemukan.`;
        }
      }
      else if (lowerText.includes('habis') || lowerText.includes('sedikit') || lowerText.includes('menipis') || lowerText.includes('kritis')) {
        const lowStock = barang.filter(b => {
          const totalStok = stokPengguna.filter(s => s.barangId === b.id).reduce((sum, s) => sum + s.jumlah, 0);
          return totalStok <= (b.minStok || 5);
        });
        if (lowStock.length > 0) {
          const list = lowStock.slice(0, 5).map(b => {
            const unitObj = satuan.find(s => s.id === b.satuanId);
            const unitName = unitObj ? unitObj.nama : 'Unit';
            const totalStok = stokPengguna.filter(s => s.barangId === b.id).reduce((sum, s) => sum + s.jumlah, 0);
            return `- **${b.nama}**: ${totalStok} ${unitName}`;
          }).join('\n');
          response = `⚠️ **Stok Kritis (${lowStock.length} Item)**:\n${list}`;
        } else {
          response = "✅ Stok aman! Belum ada barang yang kritis.";
        }
      } else {
        const totalItems = barang.length;
        response = `📦 **Data Gudang**\nTotal SKU: ${totalItems} item\n\n💡 *Tips: Ketik "stok semen" untuk cari barang spesifik.*`;
      }
    }

    // 3. Customer / Pelanggan Logic (NEW)
    else if (lowerText.includes('pelanggan') || lowerText.includes('customer') || lowerText.includes('utang')) {
      const customerQuery = lowerText.replace(/pelanggan|customer|cek|utang|berapa/g, '').trim();

      if (customerQuery.length > 1) {
        const foundCustomers = pelanggan.filter(p => p.nama.toLowerCase().includes(customerQuery));

        if (foundCustomers.length > 0) {
          const list = foundCustomers.slice(0, 3).map(p => {
            return `- **${p.nama}**\n  Sisa Limit: ${formatRupiah(p.sisaKredit)}\n  Total Utang: ${formatRupiah(p.limitKredit - p.sisaKredit)}`;
          }).join('\n');
          response = `busts_in_silhouette **Data Pelanggan**:\n${list}`;
        } else {
          response = `❌ Pelanggan "${customerQuery}" tidak ditemukan.`;
        }
      } else {
        response = "🔍 Untuk cek info pelanggan, ketik nama pelanggan. Contoh: 'pelanggan Budi'";
      }
    }

    // 4. Attendance / Absensi Logic
    else if (lowerText.includes('absen') || lowerText.includes('hadir') || lowerText.includes('siapa') || lowerText.includes('tim')) {
      const today = new Date().toDateString();
      let activeAbsensi = absensi.filter(a => new Date(a.tanggal).toDateString() === today && a.checkIn && !a.checkOut);

      // Filter Attendance based on Role
      const isGlobalInfo = user?.roles.includes('admin') || user?.roles.includes('owner') || user?.roles.includes('finance');

      if (!isGlobalInfo) {
        activeAbsensi = activeAbsensi.filter(a => {
          const u = users.find(usr => usr.id === a.userId);
          return u?.cabangId === user?.cabangId;
        });
      }

      if (activeAbsensi.length > 0) {
        const names = activeAbsensi.map(a => {
          const u = users.find(usr => usr.id === a.userId);
          return u ? `• ${u.nama}` : 'Unknown';
        }).join('\n');
        response = `👥 **Tim Aktif ${!isGlobalInfo ? 'Cabang Ini' : 'Global'} (${activeAbsensi.length})**:\n${names}`;
      } else {
        response = "Belum ada tim yang aktif check-in saat ini.";
      }
    }

    // 5. Connection / Status Logic
    else if (lowerText.includes('hubung') || lowerText.includes('koneksi') || lowerText.includes('online')) {
      response = "📡 **Status Koneksi:**\nSaat ini saya berjalan di **Mode Offline** (Lokal).\nFungsi AI Server tidak merespon/belum aktif.\n\nData yang saya tampilkan berasal dari penyimpanan lokal browser.";
    }

    // Greetings & Help
    else if (lowerText.includes('bantuan') || lowerText.includes('menu') || lowerText.includes('bisa apa')) {
      response = "🤖 **Saya bisa bantu cek:**\n1. **Penjualan**: 'Omset hari ini', 'Laporan sales'\n2. **Barang**: 'Stok semen', 'Barang habis'\n3. **Pelanggan**: 'Cek pelanggan Budi'\n4. **Tim**: 'Siapa yang hadir'";
    }

    else if (lowerText.includes('halo') || lowerText.includes('hi') || lowerText.includes('pagi')) {
      response = "Halo! Semangat pantau bisnisnya ya bos! 🚀 (Mode Offline)";
    }

    return response;
  };

  const handleSend = async (e?: React.FormEvent, overrideText?: string) => {
    e?.preventDefault();
    const textToSend = overrideText || input;
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const replyText = await processMessage(userMsg.content);

    const botMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: replyText,
      timestamp: new Date()
    };

    setIsTyping(false);
    setMessages(prev => [...prev, botMsg]);
  };

  return (
    <Card className="h-full flex flex-col border-none shadow-none bg-transparent">
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4 pb-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'
                }`}
            >
              <Avatar className="w-8 h-8 cursor-pointer hover:scale-110 transition-transform">
                {msg.role === 'assistant' ? (
                  <>
                    <AvatarImage src="/bot-avatar.png" />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </>
                ) : (
                  <>
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.nama}`} />
                    <AvatarFallback className="bg-muted">
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </>
                )}
              </Avatar>
              <div
                className={`rounded-2xl px-4 py-2 max-w-[85%] text-sm whitespace-pre-wrap shadow-sm ${msg.role === 'assistant'
                    ? 'bg-muted text-foreground rounded-tl-none'
                    : 'bg-primary text-primary-foreground rounded-tr-none'
                  }`}
              >
                {/* Basic markdown-like rendering for bolding */}
                {msg.content.split('\n').map((line, i) => (
                  <div key={i} dangerouslySetInnerHTML={{
                    // Simple bold parser for **text**
                    __html: line.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                  }} />
                ))}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Bot className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted text-foreground rounded-2xl rounded-tl-none px-4 py-2 text-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="pt-2 space-y-3">
        {/* Quick Suggestions Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {['💰 Omset Hari Ini', '📦 Stok Menipis', '👥 Tim Aktif', '❓ Bantuan'].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => quickAsk(suggestion)}
              className="whitespace-nowrap px-3 py-1.5 rounded-full bg-secondary/50 hover:bg-secondary text-xs font-medium transition-colors border border-border/50 text-foreground"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => handleSend(e)} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ketik pertanyaan..."
            className="flex-1 rounded-full px-4 border-muted-foreground/20 focus-visible:ring-offset-0"
          />
          <Button type="submit" size="icon" className="rounded-full w-10 h-10 shrink-0 shadow-sm" disabled={!input.trim() || isTyping}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
