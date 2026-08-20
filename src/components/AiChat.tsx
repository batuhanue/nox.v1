import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Bot, User } from 'lucide-react';
import Markdown from 'react-markdown';

export default function AiChat({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  const sendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    const message = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: message }]);
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: chatHistory })
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      setChatHistory(prev => [...prev, { role: 'model', text: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') break;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.error) throw new Error(data.error);
              if (data.text) {
                setChatHistory(prev => {
                  const newHistory = [...prev];
                  const lastMsg = newHistory[newHistory.length - 1];
                  if (lastMsg.role === 'model') {
                    lastMsg.text += data.text;
                  }
                  return newHistory;
                });
              }
            } catch (e) {
              console.error("Error parsing stream data", e);
            }
          }
        }
      }
    } catch (e: any) {
      console.error("Chat error:", e);
      let errMsg = 'Üzgünüm, bir hata oluştu. Lütfen AI Studio **Settings (Ayarlar)** sekmesinden geçerli bir API Anahtarı girdiğinize emin olun.';
      try {
        const parsed = JSON.parse(e.message);
        if (parsed.error && parsed.error.message) errMsg = `Hata: ${parsed.error.message}`;
      } catch(parseErr) {}
      setChatHistory(prev => [...prev, { role: 'model', text: errMsg }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-6 right-6 w-[350px] max-w-[calc(100vw-48px)] h-[500px] max-h-[80vh] bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col z-[100] overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-black dark:text-white">NOX Asistan</h3>
                <p className="text-[10px] text-black/50 dark:text-white/50">Gemini AI tarafından desteklenmektedir</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors text-black/50 dark:text-white/50">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {chatHistory.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 opacity-50">
                <Bot className="w-12 h-12 mb-3 text-black dark:text-white" />
                <p className="text-sm font-medium text-black dark:text-white">Merhaba! Görevlerinizi planlamak veya yönetmek için bana danışabilirsiniz.</p>
              </div>
            )}
            
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex shrink-0 items-center justify-center mt-1 ${msg.role === 'user' ? 'bg-black dark:bg-white text-white dark:text-black' : 'bg-blue-500/10 text-blue-500'}`}>
                  {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                </div>
                <div className={`px-4 py-2 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-black text-white dark:bg-white dark:text-black rounded-tr-sm' : 'bg-black/5 dark:bg-white/5 text-black dark:text-white rounded-tl-sm'}`}>
                  {msg.role === 'user' ? (
                    msg.text
                  ) : (
                    <div className="markdown-body prose-sm dark:prose-invert">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isChatLoading && (
              <div className="flex gap-3 max-w-[85%]">
                <div className="w-6 h-6 rounded-full flex shrink-0 items-center justify-center mt-1 bg-blue-500/10 text-blue-500">
                  <Bot className="w-3 h-3" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-black/5 dark:bg-white/5 flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-black/40 dark:bg-white/40 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-black/40 dark:bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-1.5 h-1.5 bg-black/40 dark:bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          
          <div className="p-3 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
            <form 
              onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
              className="flex items-center gap-2 bg-white dark:bg-[#1a1a1a] rounded-full px-4 py-2 border border-black/10 dark:border-white/10"
            >
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Bana bir şey sorun..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30"
              />
              <button 
                type="submit"
                disabled={!chatInput.trim() || isChatLoading}
                className="w-8 h-8 flex items-center justify-center shrink-0 rounded-full bg-black text-white dark:bg-white dark:text-black disabled:opacity-50 transition-opacity"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
