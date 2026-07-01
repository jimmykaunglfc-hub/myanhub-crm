"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

interface Message {
  id: string;
  sender: string;
  content: string;
  created_at: string;
  status: string;
  customers: {
    platform: string;
  } | null;
}

export default function InboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      // Pull latest messages and grab the sender's platform type
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender, content, created_at, status, customers(platform)')
        .order('created_at', { ascending: false });

      if (!error && data) setMessages(data as unknown as Message[]);
      setLoading(false);
    };

    fetchMessages();

    // Listen for new incoming messages live!
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative">
        <Header />
        <div className="flex-1 overflow-y-auto mt-16 p-6 md:p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Unified Inbox</h2>
            <p className="text-slate-500 mt-1">Real-time incoming customer streams.</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {loading ? (
              <div className="p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">Connection initializing...</div>
            ) : messages.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">
                No active conversations yet. Send a message to your Telegram Bot to test!
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{msg.sender}</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {msg.customers?.platform || 'Telegram Feed'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">{msg.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}