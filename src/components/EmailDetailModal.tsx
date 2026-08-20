import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Reply, Loader2 } from 'lucide-react';

interface EmailDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailId: string | null;
  gmailToken: string | null;
  triggerHaptic?: (type: string) => void;
}

export function EmailDetailModal({ isOpen, onClose, emailId, gmailToken, triggerHaptic }: EmailDetailModalProps) {
  const [emailDetails, setEmailDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && emailId && gmailToken) {
      setLoading(true);
      setError(null);
      fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=full`, {
        headers: { Authorization: `Bearer ${gmailToken}` }
      })
        .then(res => res.json())
        .then(data => {
          setEmailDetails(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Error fetching email details:", err);
          setError("E-posta yüklenirken bir hata oluştu.");
          setLoading(false);
        });
    } else {
      setEmailDetails(null);
      setReplyText('');
    }
  }, [isOpen, emailId, gmailToken]);

  const decodeHtmlEntities = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
  };

  const getEmailBody = (payload: any) => {
    if (!payload) return '';
    let body = '';

    const decodeBase64URL = (str: string) => {
      try {
        const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = decodeURIComponent(escape(window.atob(base64)));
        return decoded;
      } catch (e) {
        return '';
      }
    };

    if (payload.body && payload.body.data) {
      body = decodeBase64URL(payload.body.data);
    } else if (payload.parts) {
      // First try to find text/html
      const htmlPart = payload.parts.find((part: any) => part.mimeType === 'text/html');
      if (htmlPart && htmlPart.body && htmlPart.body.data) {
        body = decodeBase64URL(htmlPart.body.data);
      } else {
        // Fallback to text/plain
        const textPart = payload.parts.find((part: any) => part.mimeType === 'text/plain');
        if (textPart && textPart.body && textPart.body.data) {
          body = decodeBase64URL(textPart.body.data);
          // Convert plain text to simple HTML with line breaks
          body = body.replace(/\n/g, '<br/>');
        } else if (payload.parts[0]?.parts) {
           // nested parts
           const nestedHtml = payload.parts[0].parts.find((part: any) => part.mimeType === 'text/html');
           if (nestedHtml && nestedHtml.body && nestedHtml.body.data) {
             body = decodeBase64URL(nestedHtml.body.data);
           }
        }
      }
    }
    return body;
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !gmailToken || !emailDetails) return;
    if (triggerHaptic) triggerHaptic('medium');
    setSending(true);

    try {
      const headers = emailDetails.payload.headers;
      const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
      const toHeader = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
      const messageIdHeader = headers.find((h: any) => h.name.toLowerCase() === 'message-id')?.value || '';
      const referencesHeader = headers.find((h: any) => h.name.toLowerCase() === 'references')?.value || '';

      const replySubject = subjectHeader.toLowerCase().startsWith('re:') ? subjectHeader : `Re: ${subjectHeader}`;
      
      const emailLines = [
        `To: ${toHeader}`,
        `Subject: ${replySubject}`,
        `In-Reply-To: ${messageIdHeader}`,
        `References: ${referencesHeader ? referencesHeader + ' ' + messageIdHeader : messageIdHeader}`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        replyText
      ];

      const rawEmail = btoa(unescape(encodeURIComponent(emailLines.join('\r\n'))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${gmailToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: rawEmail,
          threadId: emailDetails.threadId
        })
      });

      if (!response.ok) {
        throw new Error('Yanıt gönderilemedi.');
      }

      if (triggerHaptic) triggerHaptic('success');
      setReplyText('');
      onClose();
    } catch (err) {
      console.error(err);
      setError("Yanıt gönderilirken hata oluştu.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-sm sm:p-4"
        >
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full sm:w-[600px] h-full bg-white dark:bg-[#1c1c1e] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-black/5 dark:border-white/5">
              <h2 className="text-xl font-bold text-black dark:text-white">E-posta Detayı</h2>
              <button
                onClick={() => { if (triggerHaptic) triggerHaptic('light'); onClose(); }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-black/50 dark:text-white/50">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="font-medium">Yükleniyor...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-red-500">
                  <p className="font-medium">{error}</p>
                </div>
              ) : emailDetails ? (
                <div className="flex flex-col h-full">
                  <div className="mb-6 flex flex-col gap-2">
                    <h3 className="text-2xl font-bold leading-tight text-black dark:text-white">
                      {emailDetails.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(Konu yok)'}
                    </h3>
                    <div className="flex items-center gap-2 text-sm font-medium text-black/60 dark:text-white/60">
                      <span>Kimden:</span>
                      <span className="text-black dark:text-white bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md">
                        {emailDetails.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Bilinmiyor'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-black/60 dark:text-white/60">
                      <span>Tarih:</span>
                      <span>
                        {new Date(emailDetails.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'date')?.value).toLocaleString('tr-TR')}
                      </span>
                    </div>
                  </div>

                  <div 
                    className="flex-1 min-h-[300px] prose dark:prose-invert max-w-none text-[0.9375rem] leading-relaxed break-words bg-black/5 dark:bg-white/5 rounded-2xl p-6 overflow-y-auto custom-scrollbar"
                    dangerouslySetInnerHTML={{ __html: getEmailBody(emailDetails.payload) }}
                  />

                  {/* Reply Box */}
                  <div className="mt-6 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-black/60 dark:text-white/60 mb-1">
                      <Reply className="w-4 h-4" /> Yanıtla
                    </div>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Yanıtınızı buraya yazın..."
                      className="w-full min-h-[120px] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-4 text-[0.9375rem] text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 resize-none transition-all"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={handleSendReply}
                        disabled={sending || !replyText.trim()}
                        className="flex items-center gap-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold text-sm hover:bg-black/80 dark:hover:bg-white/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-95"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {sending ? 'Gönderiliyor...' : 'Gönder'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
