'use client';

import { useState, useEffect, useRef } from 'react';
import { Ship, Send, X, Trash2, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useDataStore } from '@/lib/data-store';
import { getBotReply, welcomeMessage, QUICK_REPLIES, ChatMessage, ChatContext } from '@/lib/chatbot-engine';

const STORAGE_KEY = 'export_portal_chat_v1';
const uid = () => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function ShipChatBot() {
  const { user } = useAuth();
  const { companies, exportRecords, complaints, masterItems } = useDataStore();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(false);

  useEffect(() => { openRef.current = open; }, [open]);

  // Hydrate conversation history
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed)) setMessages(parsed.slice(-50));
      }
    } catch { /* ignore malformed */ }
    setLoaded(true);
  }, []);

  // Persist conversation
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
    } catch { /* storage unavailable */ }
  }, [messages, loaded]);

  // Auto-scroll to newest message
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing, open]);

  const buildContext = (): ChatContext => ({
    user,
    companies,
    exportRecords,
    complaints,
    productCount: masterItems.products?.length ?? 0,
    countryCount: masterItems.countries?.length ?? 0,
  });

  const greet = (): ChatMessage => ({
    id: uid(),
    role: 'bot',
    text: welcomeMessage(buildContext()),
    createdAt: new Date().toISOString(),
  });

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    setUnread(0);
    if (next) {
      setMessages(prev => (prev.length > 0 ? prev : [greet()]));
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  };

  const sendMessage = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || typing) return;
    const userMsg: ChatMessage = { id: uid(), role: 'user', text: value, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);
    // Simulated "thinking" delay proportional to message length
    const delay = 450 + Math.min(value.length * 8, 900);
    setTimeout(() => {
      const reply = getBotReply(value, buildContext());
      setMessages(prev => [...prev, { id: uid(), role: 'bot', text: reply, createdAt: new Date().toISOString() }]);
      setTyping(false);
      if (!openRef.current) setUnread(u => u + 1);
    }, delay);
  };

  const clearChat = () => {
    setMessages([greet()]);
    setUnread(0);
  };

  const showChips = messages.filter(m => m.role === 'user').length === 0;

  return (
    <>
      {/* Chat Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Export Assistant chat"
          className="chat-panel-enter fixed bottom-24 right-6 z-50 flex flex-col w-[380px] max-w-[calc(100vw-3rem)] h-[540px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-gov-green-600 to-gov-green-500 text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
              <Ship className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-tight">Export Assistant</p>
              <p className="text-xs text-gov-green-100 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI Help · Demo Mode
              </p>
            </div>
            <button onClick={clearChat} className="p-1.5 rounded-lg hover:bg-white/15 transition-colors" title="Clear conversation" aria-label="Clear conversation">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={handleToggle} className="p-1.5 rounded-lg hover:bg-white/15 transition-colors" title="Close chat" aria-label="Close chat">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
            {messages.map(m => (
              m.role === 'bot' ? (
                <div key={m.id} className="flex items-end gap-2">
                  <div className="w-7 h-7 rounded-full bg-gov-green-500 text-white flex items-center justify-center flex-shrink-0 mb-0.5">
                    <Ship className="w-3.5 h-3.5" />
                  </div>
                  <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-white border border-gray-200 text-gray-800 px-3.5 py-2.5 text-sm whitespace-pre-line leading-relaxed shadow-sm">
                    {m.text}
                    <span className="block text-[10px] text-gray-400 mt-1 text-right">{timeOf(m.createdAt)}</span>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gov-green-500 text-white px-3.5 py-2.5 text-sm whitespace-pre-line leading-relaxed">
                    {m.text}
                    <span className="block text-[10px] text-gov-green-100 mt-1 text-right">{timeOf(m.createdAt)}</span>
                  </div>
                </div>
              )
            ))}

            {typing && (
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-gov-green-500 text-white flex items-center justify-center flex-shrink-0 mb-0.5">
                  <Ship className="w-3.5 h-3.5" />
                </div>
                <div className="rounded-2xl rounded-bl-md bg-white border border-gray-200 px-4 py-3.5 flex gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-gray-400 typing-dot" />
                  <span className="w-2 h-2 rounded-full bg-gray-400 typing-dot" />
                  <span className="w-2 h-2 rounded-full bg-gray-400 typing-dot" />
                </div>
              </div>
            )}
          </div>

          {/* Quick replies */}
          {showChips && (
            <div className="px-3 pt-2 pb-1 flex gap-2 overflow-x-auto no-scrollbar bg-gray-50 flex-shrink-0">
              {QUICK_REPLIES.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="whitespace-nowrap text-xs px-3 py-1.5 rounded-full border border-gov-green-300 text-gov-green-700 hover:bg-gov-green-50 transition-colors flex-shrink-0"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={e => { e.preventDefault(); sendMessage(); }}
            className="p-3 border-t border-gray-200 flex gap-2 flex-shrink-0 bg-white"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about exports, documents, complaints..."
              className="input-field flex-1 text-sm"
              aria-label="Message the Export Assistant"
            />
            <button
              type="submit"
              disabled={!input.trim() || typing}
              className="w-10 flex items-center justify-center rounded-lg bg-gov-green-500 text-white hover:bg-gov-green-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          <p className="px-3 pb-2 text-[10px] text-gray-400 text-center bg-white flex-shrink-0">
            AI assistant · responses are simulated in demo mode
          </p>
        </div>
      )}

      {/* Ship Launcher */}
      <button
        onClick={handleToggle}
        aria-label={open ? 'Close Export Assistant chat' : 'Open Export Assistant chat'}
        className="fixed bottom-6 right-6 z-50 group"
      >
        {/* Waves rippling under the ship */}
        {!open && (
          <>
            <span className="absolute inset-0 rounded-full bg-gov-green-400/30 animate-wave" />
            <span className="absolute inset-0 rounded-full bg-gov-green-400/20 animate-wave" style={{ animationDelay: '1.25s' }} />
          </>
        )}
        <span className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gov-green-500 text-white shadow-lg shadow-gov-green-500/40 animate-ship-bob group-hover:bg-gov-green-600 transition-colors">
          <Ship className="w-7 h-7" />
        </span>
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold shadow">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
        <span className="absolute bottom-full right-0 mb-2 whitespace-nowrap px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {open ? 'Close Export Assistant' : 'Chat with Export Assistant'}
        </span>
      </button>
    </>
  );
}
