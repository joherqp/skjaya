import { supabase } from "@/lib/supabase";

export async function askAIChat(query: string): Promise<string> {
    console.log("Ask AI (Edge Function):", query);
    const { data, error } = await supabase.functions.invoke('chat-ai', {
        body: { query }
    });

    if (error) {
        console.warn("Edge Function Error (Falling back to local):", error);
        throw error; // Throw to trigger fallback
    }

    return data?.text || "Maaf, tidak ada respon dari server.";
}
