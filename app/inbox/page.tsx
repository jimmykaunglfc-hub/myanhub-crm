"use client";

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Send, Image, Smile, MessageSquare, Check, AlertCircle } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  platform: string;
}

interface Message {
  id: string;
  customer_id: string;
  sender: string;
  content: string;
  created_at: string;
  status: string;
}

export default function UnifiedInbox() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [typedMessage, setTypedMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  
  // Interface Toggles
  const [showEmojis, setShowEmojis] = useState(false);
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const quickEmojis = ["❤️", "👍", "🙏", "😊", "📦", "💵", "✨", "💯"];

  // Core system dynamic synchronization logic hook
  const syncCRMState = async () => {
    const { data: custData } = await supabase.from('customers').select('*');
    const { data: msgData } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    
    if (custData) setCustomers(custData);
    if (msgData) setMessages(msgData);
  };

  useEffect(() => {
    syncCRMState();

    const channel = supabase
      .channel('live-inbox-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        syncCRMState();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    
    // Auto mark active read markers if a new text flows in while viewing thread
    if (selectedCustomerId) {
      supabase.from('messages').update({ status: 'read' }).eq('customer_id', selectedCustomerId).eq('status', 'unread').then();
    }
  }, [messages, selectedCustomerId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || (!typedMessage.trim() && !mediaUrl.trim())) return;

    setSending(true);
    const response = await fetch('/api/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: selectedCustomerId, text: typedMessage, mediaUrl })
    });

    if (response.ok) {
      setTypedMessage('');
      setMediaUrl('');
      setShowMediaInput(false);
      setShowEmojis(false);
    } else {
      alert("Transmission pipeline error. Ensure bot tokens match.");
    }
    setSending(false);
  };

  // Compute conversation thread state calculations
  const activeChatCustomer = customers.find(c => c.id === selectedCustomerId);
  const filteredMessages = messages.filter(m => m.customer_id === selectedCustomerId);

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative h-full">
        <Header />
        
        {/* Workspace Canvas Layer */}
        <div className="flex-1 flex mt-16 overflow-hidden bg-white">
          
          {/* LEFT STRIP: Thread Selection Column */}
          <div className="w-full md:w-80 border-r border-slate-200 flex flex-col bg-slate-50 overflow-y-auto">
            <div className="p-4 border-b border-slate-200 bg-white">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare size={18} className="text-indigo-600" /> Active Connections
              </h2>
            </div>
            
            <div className="divide-y divide-slate-100">
              {customers.map((customer) => {
                const customerMsgs = messages.filter(m => m.customer_id === customer.id);
                const lastMsg = customerMsgs[customerMsgs.length - 1];
                const hasUnread = customerMsgs.some(m => m.status === 'unread');

                return (
                  <button
                    key={customer.id}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    className={`w-full p-4 text-left flex items-start gap-3 transition-colors ${selectedCustomerId === customer.id ? 'bg-white border-l-4 border-indigo-600' : 'hover:bg-slate-100 bg-slate-50'}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 border border-slate-300 uppercase flex-shrink-0">
                      {customer.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className={`text-sm truncate block ${hasUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{customer.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className={`text-xs truncate ${hasUnread ? 'text-indigo-600 font-semibold' : 'text-slate-400'}`}>
                        {lastMsg ? lastMsg.content : 'No transmissions logged.'}
                      </p>
                    </div>
                    {hasUnread && <span className="w-2 h-2 bg-indigo-600 rounded-full self-center flex-shrink-0"></span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT STRIP: Interactive Chat Interface View Engine */}
          <div className="flex-1 flex flex-col bg-slate-50 h-full overflow-hidden">
            {selectedCustomerId && activeChatCustomer ? (
              <>
                {/* Active Receiver Profile Strip Header */}
                <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
                  <div>
                    <h3 className="font-bold text-slate-900">{activeChatCustomer.name}</h3>
                    <p className="text-xs text-slate-400 font-medium">Channel Endpoint: <span className="text-indigo-600 font-semibold uppercase">{activeChatCustomer.platform}</span></p>
                  </div>
                </div>

                {/* Chat History Flow Container */}
                <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/60 pattern-grid">
                  {filteredMessages.map((msg) => {
                    const isManager = msg.sender === 'Workspace Manager';
                    return (
                      <div key={msg.id} className={`flex flex-col ${isManager ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-md p-3.5 rounded-2xl shadow-sm border text-sm leading-relaxed ${isManager ? 'bg-indigo-600 text-white border-indigo-700 rounded-tr-none' : 'bg-white text-slate-800 border-slate-200 rounded-tl-none'}`}>
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 font-mono px-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Message Composition Input Console Panel */}
                <div className="p-4 bg-white border-t border-slate-200 shadow-xl space-y-3 relative z-10">
                  {/* Rich Option Attachment Controls Display Matrix */}
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <button onClick={() => { setShowMediaInput(!showMediaInput); setShowEmojis(false); }} className={`p-2 rounded-lg transition border ${showMediaInput ? 'bg-slate-100 text-indigo-600 border-slate-200' : 'text-slate-400 hover:text-slate-600 border-transparent'}`} title="Attach Image URL"><Image size={18} /></button>
                    <button onClick={() => { setShowEmojis(!showEmojis); setShowMediaInput(false); }} className={`p-2 rounded-lg transition border ${showEmojis ? 'bg-slate-100 text-indigo-600 border-slate-200' : 'text-slate-400 hover:text-slate-600 border-transparent'}`} title="Insert Emoji Expression"><Smile size={18} /></button>
                    
                    {/* Inline quick emoji tray */}
                    <div className="flex gap-1 ml-2">
                      {quickEmojis.map(e => (
                        <button key={e} onClick={() => setTypedMessage(prev => prev + e)} className="p-1 text-sm hover:scale-125 transition-transform">{e}</button>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic media input layout block context expanded drawer */}
                  {showMediaInput && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center gap-2 animate-fade-in">
                      <span className="text-xs font-bold text-slate-400 uppercase whitespace-nowrap pl-1">Image URL:</span>
                      <input type="text" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none text-slate-800" placeholder="https://example.com/item-photo.jpg" />
                    </div>
                  )}

                  {/* Standard Text Dispatch Input Box component console row */}
                  <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
                    <input
                      type="text"
                      value={typedMessage}
                      onChange={e => setTypedMessage(e.target.value)}
                      disabled={sending}
                      placeholder={mediaUrl ? "Add image caption message..." : "Type your message response here..."}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                    />
                    <button type="submit" disabled={sending || (!typedMessage.trim() && !mediaUrl.trim())} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl transition shadow-md shadow-indigo-600/10 flex items-center justify-center disabled:opacity-40 flex-shrink-0">
                      <Send size={18} className={sending ? 'animate-spin' : ''} />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mb-4 text-slate-400 border border-slate-300 shadow-inner">
                  <MessageSquare size={24} />
                </div>
                <h3 className="font-bold text-slate-700 mb-1">No Chat Open</h3>
                <p className="text-sm text-slate-400 text-center max-w-xs">Select a workspace thread item from the active channels roster on the left column block strip to engage with incoming users.</p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}