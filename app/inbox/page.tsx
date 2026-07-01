"use client";

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Send, Image, Smile, MessageSquare, Plus, 
  ShoppingBag, DollarSign, ClipboardList, CheckCircle2 
} from 'lucide-react';

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
  
  // Chat Input States
  const [typedMessage, setTypedMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [sending, setSending] = useState(false);

  // Manual Conversational Order Creation States
  const [orderAmount, setOrderAmount] = useState('');
  const [orderIdInput, setOrderIdInput] = useState('');
  const [orderStatusMessage, setOrderStatusMessage] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const quickEmojis = ["❤️", "👍", "🙏", "😊", "📦", "💵", "✨", "💯"];

  // Fetch completely unified CRM real-time state logs
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        syncCRMState();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (selectedCustomerId) {
      supabase.from('messages').update({ status: 'read' }).eq('customer_id', selectedCustomerId).eq('status', 'unread').then();
    }
  }, [messages, selectedCustomerId]);

  // ACTION 1: Send a text reply message back out to Telegram
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
      alert("Outbound gateway issue. Ensure Vercel environment keys are redeployed.");
    }
    setSending(false);
  };

  // ACTION 2: Direct Conversational Commerce - Admin Submits Order for Customer right from chat
  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !orderAmount) return;

    setOrderStatusMessage('Injecting transaction parameters...');
    const targetIdString = orderIdInput.trim() || `MH-${Math.floor(1000 + Math.random() * 9000)}`;

    const { error } = await supabase.from('orders').insert({
      customer_id: selectedCustomerId,
      order_id_string: targetIdString,
      total_amount: parseFloat(orderAmount),
      status: 'pending'
    });

    if (error) {
      setOrderStatusMessage(`Error: ${error.message}`);
    } else {
      setOrderStatusMessage(`Order ${targetIdString} Submitted!`);
      setOrderAmount('');
      setOrderIdInput('');
      
      // Silently insert a system record log into the chat so the admin sees it in the timeline!
      await supabase.from('messages').insert({
        customer_id: selectedCustomerId,
        sender: 'Workspace Manager',
        content: `[System Notification] Generated order invoice ${targetIdString} for $${parseFloat(orderAmount).toFixed(2)}. Status initialized to Pending Fulfillment.`,
        status: 'read'
      });

      setTimeout(() => setOrderStatusMessage(''), 4000);
    }
  };

  const activeChatCustomer = customers.find(c => c.id === selectedCustomerId);
  const filteredMessages = messages.filter(m => m.customer_id === selectedCustomerId);

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative h-full overflow-hidden">
        <Header />
        
        {/* 3-COLUMN CONTROL CANVAS */}
        <div className="flex-1 flex mt-16 overflow-hidden bg-white">
          
          {/* COLUMN 1: Active Threads Column list */}
          <div className="w-full md:w-72 border-r border-slate-200 flex flex-col bg-slate-50 overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b border-slate-200 bg-white">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <MessageSquare size={16} className="text-indigo-600" /> Conversational Feeds
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
                    onClick={() => { setSelectedCustomerId(customer.id); setOrderStatusMessage(''); }}
                    className={`w-full p-4 text-left flex items-start gap-3 transition-colors ${selectedCustomerId === customer.id ? 'bg-white border-l-4 border-indigo-600 shadow-sm' : 'hover:bg-slate-100 bg-slate-50'}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-black text-slate-600 border border-slate-300 uppercase flex-shrink-0 text-xs">
                      {customer.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className={`text-xs truncate block ${hasUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{customer.name}</span>
                        <span className="text-[9px] text-slate-400 font-mono">
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

          {/* COLUMN 2: Chat Box History Timeline Stream */}
          <div className="flex-1 flex flex-col bg-slate-50 h-full overflow-hidden border-r border-slate-200">
            {selectedCustomerId && activeChatCustomer ? (
              <>
                <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm flex-shrink-0">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{activeChatCustomer.name}</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Channel Network Link: <span className="text-indigo-600 font-semibold uppercase">{activeChatCustomer.platform}</span></p>
                  </div>
                </div>

                <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/60">
                  {filteredMessages.map((msg) => {
                    const isManager = msg.sender === 'Workspace Manager';
                    const isSystem = msg.content.includes('[System Notification]');
                    
                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center my-2 animate-fade-in">
                          <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 text-xs py-2 px-4 rounded-xl font-medium flex items-center gap-2 shadow-sm">
                            <ClipboardList size={14} className="text-emerald-600" />
                            {msg.content}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className={`flex flex-col ${isManager ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-md p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${isManager ? 'bg-indigo-600 text-white border border-indigo-700 rounded-tr-none' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'}`}>
                          {msg.content}
                        </div>
                        <span className="text-[9px] text-slate-400 mt-1 font-mono px-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Action Input Box Component */}
                <div className="p-4 bg-white border-t border-slate-200 space-y-3 flex-shrink-0">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <button onClick={() => { setShowMediaInput(!showMediaInput); setShowEmojis(false); }} className={`p-1.5 rounded transition border ${showMediaInput ? 'bg-slate-100 text-indigo-600 border-slate-200' : 'text-slate-400 border-transparent'}`} title="Attach Image"><Image size={16} /></button>
                    <button onClick={() => { setShowEmojis(!showEmojis); setShowMediaInput(false); }} className={`p-1.5 rounded transition border ${showEmojis ? 'bg-slate-100 text-indigo-600 border-slate-200' : 'text-slate-400 border-transparent'}`} title="Add Emoji"><Smile size={16} /></button>
                    <div className="flex gap-1 ml-2">
                      {quickEmojis.map(e => (
                        <button key={e} onClick={() => setTypedMessage(prev => prev + e)} className="text-xs hover:scale-125 transition-transform">{e}</button>
                      ))}
                    </div>
                  </div>

                  {showMediaInput && (
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">URL:</span>
                      <input type="text" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded p-1 text-xs text-slate-800 focus:outline-none" placeholder="https://image-url.com/photo.jpg" />
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={typedMessage}
                      onChange={e => setTypedMessage(e.target.value)}
                      disabled={sending}
                      placeholder="Type reply back out to customer channel..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-indigo-500 transition"
                    />
                    <button type="submit" disabled={sending || (!typedMessage.trim() && !mediaUrl.trim())} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl disabled:opacity-45 transition flex items-center justify-center flex-shrink-0">
                      <Send size={14} className={sending ? 'animate-spin' : ''} />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                <p className="text-xs font-semibold text-slate-400 text-center">Select an open message room profile node to begin chatting.</p>
              </div>
            )}
          </div>

          {/* COLUMN 3: Conversational Order Submission Form Panel Panel */}
          <div className="hidden lg:flex w-64 bg-white flex-col flex-shrink-0 p-5 overflow-y-auto">
            {selectedCustomerId && activeChatCustomer ? (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-1">
                    <ShoppingBag size={14} className="text-indigo-600" /> Order Submission
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Instantly book a deal and dispatch an order link for <b>{activeChatCustomer.name}</b> directly into the fulfillment grid database logs.</p>
                </div>

                <hr className="border-slate-100" />

                <form onSubmit={handleCreateManualOrder} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">GROSS DEAL VALUE ($ USD)</label>
                    <div className="relative rounded-lg shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign size={12} className="text-slate-400" />
                      </div>
                      <input 
                        type="number" 
                        step="0.01" 
                        required
                        value={orderAmount}
                        onChange={e => setOrderAmount(e.target.value)}
                        placeholder="0.00" 
                        className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CUSTOM ORDER NUMBER (OPTIONAL)</label>
                    <input 
                      type="text" 
                      value={orderIdInput}
                      onChange={e => setOrderIdInput(e.target.value)}
                      placeholder="Leave blank to auto-generate" 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs py-2.5 rounded-lg transition shadow flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} /> Log and Create Order
                  </button>
                </form>

                {orderStatusMessage && (
                  <div className="p-3 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[11px] font-semibold text-center flex items-center justify-center gap-2 animate-fade-in">
                    <CheckCircle2 size={12} className="text-indigo-600 flex-shrink-0" />
                    {orderStatusMessage}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-slate-300 text-xs border-2 border-dashed border-slate-100 rounded-xl p-4">
                Open a chat room to reveal the commerce tool panel.
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}