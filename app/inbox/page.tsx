"use client";

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Send, Image, Smile, MessageSquare, Plus, ShoppingBag, DollarSign, ClipboardList, CheckCircle2, Package, AlertTriangle } from 'lucide-react';

interface Customer { id: string; name: string; platform: string; }
interface Message { id: string; customer_id: string; sender: string; content: string; created_at: string; status: string; }
// NEW: Inventory Interface
interface Product { id: string; name: string; price: number; stock_quantity: number; }

export default function UnifiedInbox() {
  const { isDarkMode } = useTheme();
  
  const [userId, setUserId] = useState<string | null>(null);
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inventory, setInventory] = useState<Product[]>([]); // NEW: Store active inventory
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  
  const [typedMessage, setTypedMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [sending, setSending] = useState(false);

  // NEW: Updated Order States for Inventory Linking
  const [selectedProductId, setSelectedProductId] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderIdInput, setOrderIdInput] = useState('');
  const [orderStatusMessage, setOrderStatusMessage] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const quickEmojis = ["❤️", "👍", "🙏", "😊", "📦", "💵", "✨", "💯"];

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    fetchUser();
  }, []);

  const syncCRMState = async () => {
    if (!userId) return;
    
    const { data: custData } = await supabase.from('customers').select('*');
    const { data: msgData } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    // NEW: Fetch available inventory for this tenant
    const { data: invData } = await supabase.from('inventory').select('id, name, price, stock_quantity').eq('user_id', userId);
    
    if (custData) setCustomers(custData);
    if (msgData) setMessages(msgData);
    if (invData) setInventory(invData as Product[]);
  };

  useEffect(() => {
    if (userId) syncCRMState();
    
    const channel = supabase.channel('live-inbox-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: "sender=eq.customer" }, syncCRMState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, syncCRMState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, syncCRMState) // Listen to stock changes
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (selectedCustomerId) {
      supabase.from('messages').update({ status: 'read' }).eq('customer_id', selectedCustomerId).eq('status', 'unread').then();
    }
  }, [messages, selectedCustomerId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || (!typedMessage.trim() && !mediaUrl.trim()) || !userId) return;
    
    setSending(true);

    const messageContent = typedMessage || `[Media Attachment] ${mediaUrl}`;
    const temporaryId = `temp-${Date.now()}`;
    
    const optimisticMessage: Message = {
      id: temporaryId,
      customer_id: selectedCustomerId,
      sender: 'Workspace Manager',
      content: messageContent,
      created_at: new Date().toISOString(),
      status: 'sending'
    };

    setMessages(prev => [...prev, optimisticMessage]);
    
    setTypedMessage(''); 
    setMediaUrl(''); 
    setShowMediaInput(false); 
    setShowEmojis(false); 
    
    try {
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customerId: selectedCustomerId, 
          text: messageContent, 
          mediaUrl,
          userId: userId 
        })
      });

      if (!response.ok) { 
        setMessages(prev => prev.filter(m => m.id !== temporaryId));
        const errorData = await response.json();
        alert(`Backend Error: ${errorData.error}`); 
      } else {
        syncCRMState();
      }
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== temporaryId));
      alert("Network Error: Could not reach the server.");
    } finally {
      setSending(false);
    }
  };

  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !selectedProductId || !userId) return;
    
    // 1. Identify the product and check stock
    const product = inventory.find(p => p.id === selectedProductId);
    if (!product) return;
    
    if (product.stock_quantity < orderQuantity) {
      setOrderStatusMessage(`Error: Not enough stock! Only ${product.stock_quantity} left.`);
      return;
    }

    setOrderStatusMessage('Processing order & deducting stock...');
    const targetIdString = orderIdInput.trim() || `MH-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalAmount = product.price * orderQuantity;

    // 2. Insert the Order
    const { error: orderError } = await supabase.from('orders').insert({
      customer_id: selectedCustomerId, 
      order_id_string: targetIdString, 
      total_amount: totalAmount, 
      status: 'pending',
      user_id: userId 
    });

    if (orderError) { 
      setOrderStatusMessage(`Order Error: ${orderError.message}`); 
      return;
    }

    // 3. Deduct the Stock from Inventory
    const { error: stockError } = await supabase
      .from('inventory')
      .update({ stock_quantity: product.stock_quantity - orderQuantity })
      .eq('id', product.id);

    if (stockError) {
      setOrderStatusMessage(`Stock Deduction Error: ${stockError.message}`);
      return;
    }

    // 4. Log the success and generate the notification message
    setOrderStatusMessage(`Order ${targetIdString} Submitted!`);
    setSelectedProductId(''); 
    setOrderQuantity(1);
    setOrderIdInput('');
    
    await supabase.from('messages').insert({
      customer_id: selectedCustomerId, 
      sender: 'Workspace Manager',
      content: `[System Notification] Order ${targetIdString} created for ${orderQuantity}x ${product.name}. Total: $${totalAmount.toFixed(2)}. Status: Pending.`,
      status: 'read',
      user_id: userId
    });
    
    syncCRMState();
    setTimeout(() => setOrderStatusMessage(''), 4000);
  };

  const activeChatCustomer = customers.find(c => c.id === selectedCustomerId);
  const filteredMessages = messages.filter(m => m.customer_id === selectedCustomerId);

  // Filter out products that have 0 stock so we don't accidentally oversell
  const availableInventory = inventory.filter(p => p.stock_quantity > 0);

  return (
    <div className={`min-h-screen flex font-sans h-screen overflow-hidden transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative h-full overflow-hidden">
        <Header />
        
        <div className={`flex-1 flex mt-16 overflow-hidden transition-colors duration-200 ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
          
          {/* COLUMN 1: Threads */}
          <div className={`w-full md:w-72 border-r flex flex-col overflow-y-auto flex-shrink-0 transition-colors ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className={`p-4 border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2"><MessageSquare size={16} className="text-indigo-600" /> Conversational Feeds</h2>
            </div>
            
            <div className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {customers.map((customer) => {
                const customerMsgs = messages.filter(m => m.customer_id === customer.id);
                const lastMsg = customerMsgs[customerMsgs.length - 1];
                const hasUnread = customerMsgs.some(m => m.status === 'unread' && m.sender === 'customer');

                return (
                  <button
                    key={customer.id}
                    onClick={() => { setSelectedCustomerId(customer.id); setOrderStatusMessage(''); }}
                    className={`w-full p-4 text-left flex items-start gap-3 transition-colors ${selectedCustomerId === customer.id ? (isDarkMode ? 'bg-slate-900 border-l-4 border-indigo-500' : 'bg-white border-l-4 border-indigo-600 shadow-sm') : (isDarkMode ? 'hover:bg-slate-900 bg-slate-950' : 'hover:bg-slate-100 bg-slate-50')}`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black uppercase flex-shrink-0 text-xs border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>{customer.name[0]}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className={`text-xs truncate block ${hasUnread ? (isDarkMode ? 'font-bold text-white' : 'font-bold text-slate-900') : (isDarkMode ? 'font-medium text-slate-300' : 'font-medium text-slate-700')}`}>{customer.name}</span>
                        <span className="text-[9px] text-slate-500 font-mono">{lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                      <p className={`text-xs truncate ${hasUnread ? 'text-indigo-500 font-semibold' : 'text-slate-500'}`}>
                        {lastMsg ? (lastMsg.sender === 'Workspace Manager' ? `You: ${lastMsg.content}` : lastMsg.content) : 'No transmissions logged.'}
                      </p>
                    </div>
                    {hasUnread && <span className="w-2 h-2 bg-indigo-600 rounded-full self-center flex-shrink-0"></span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* COLUMN 2: Chat Box */}
          <div className={`flex-1 flex flex-col h-full overflow-hidden border-r transition-colors ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            {selectedCustomerId && activeChatCustomer ? (
              <>
                <div className={`p-4 border-b flex justify-between items-center shadow-sm flex-shrink-0 transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div>
                    <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{activeChatCustomer.name}</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Channel: <span className="text-indigo-500 font-semibold uppercase">{activeChatCustomer.platform}</span></p>
                  </div>
                </div>

                <div className={`flex-1 p-6 overflow-y-auto space-y-4 ${isDarkMode ? 'bg-slate-950/60' : 'bg-slate-50/60'}`}>
                  {filteredMessages.map((msg) => {
                    const isManager = msg.sender === 'Workspace Manager';
                    const isSystem = msg.content.includes('[System Notification]');
                    
                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center my-2 animate-fade-in">
                          <div className={`text-xs py-2 px-4 rounded-xl font-medium flex items-center gap-2 shadow-sm border ${isDarkMode ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900' : 'bg-emerald-50 text-emerald-800 border-emerald-100'}`}>
                            <ClipboardList size={14} className={isDarkMode ? 'text-emerald-500' : 'text-emerald-600'} /> {msg.content}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className={`flex flex-col ${isManager ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-md p-3 rounded-2xl text-xs leading-relaxed shadow-sm border ${isManager ? 'bg-indigo-600 text-white border-indigo-700 rounded-tr-none' : (isDarkMode ? 'bg-slate-800 text-slate-200 border-slate-700 rounded-tl-none' : 'bg-white text-slate-800 border-slate-200 rounded-tl-none')} ${msg.status === 'sending' ? 'opacity-70' : ''}`}>
                          {msg.content}
                        </div>
                        <span className="text-[9px] text-slate-500 mt-1 font-mono px-1 flex items-center gap-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {msg.status === 'sending' && <span className="italic ml-1">Sending...</span>}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                <div className={`p-4 border-t space-y-3 flex-shrink-0 transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className={`flex items-center gap-2 border-b pb-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <button onClick={() => { setShowMediaInput(!showMediaInput); setShowEmojis(false); }} className={`p-1.5 rounded transition border ${showMediaInput ? (isDarkMode ? 'bg-slate-800 text-indigo-400 border-slate-700' : 'bg-slate-100 text-indigo-600 border-slate-200') : 'text-slate-500 border-transparent'}`}><Image size={16} /></button>
                    <button onClick={() => { setShowEmojis(!showEmojis); setShowMediaInput(false); }} className={`p-1.5 rounded transition border ${showEmojis ? (isDarkMode ? 'bg-slate-800 text-indigo-400 border-slate-700' : 'bg-slate-100 text-indigo-600 border-slate-200') : 'text-slate-500 border-transparent'}`}><Smile size={16} /></button>
                    <div className="flex gap-1 ml-2">
                      {quickEmojis.map(e => <button key={e} onClick={() => setTypedMessage(prev => prev + e)} className="text-xs hover:scale-125 transition-transform">{e}</button>)}
                    </div>
                  </div>

                  {showMediaInput && (
                    <div className={`p-2 rounded-lg border flex items-center gap-2 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">URL:</span>
                      <input type="text" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} className={`flex-1 rounded p-1 text-xs focus:outline-none border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-800'}`} placeholder="https://image-url.com/photo.jpg" />
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                    <input type="text" value={typedMessage} onChange={e => setTypedMessage(e.target.value)} placeholder="Type reply back out to customer channel..." className={`flex-1 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-indigo-500 transition border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200'}`} />
                    <button type="submit" disabled={sending || (!typedMessage.trim() && !mediaUrl.trim())} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl disabled:opacity-45 transition flex items-center justify-center flex-shrink-0"><Send size={14} className={sending ? 'animate-pulse' : ''} /></button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 p-8 text-xs font-semibold">Select an open message room profile node to begin chatting.</div>
            )}
          </div>

          {/* COLUMN 3: Order Panel (UPDATED FOR INVENTORY) */}
          <div className={`hidden lg:flex w-72 flex-col flex-shrink-0 p-5 overflow-y-auto transition-colors ${isDarkMode ? 'bg-slate-900 border-l border-slate-800' : 'bg-white'}`}>
            {selectedCustomerId && activeChatCustomer ? (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-1"><ShoppingBag size={14} className="text-indigo-600" /> Order Submission</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed">Book a deal for <b className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{activeChatCustomer.name}</b> directly into the fulfillment grid.</p>
                </div>
                <hr className={isDarkMode ? 'border-slate-800' : 'border-slate-100'} />
                
                <form onSubmit={handleCreateManualOrder} className="space-y-4">
                  
                  {/* Select Product */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Product</label>
                    <div className="relative">
                      <Package size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                      <select 
                        required 
                        value={selectedProductId} 
                        onChange={e => setSelectedProductId(e.target.value)}
                        className={`w-full pl-9 pr-3 py-2 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 border appearance-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                      >
                        <option value="" disabled>Choose an item...</option>
                        {availableInventory.length === 0 ? (
                          <option value="" disabled>No items in stock.</option>
                        ) : (
                          availableInventory.map(p => (
                            <option key={p.id} value={p.id}>{p.name} - ${p.price.toFixed(2)} ({p.stock_quantity} left)</option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Quantity</label>
                    <input 
                      type="number" 
                      min="1" 
                      required 
                      value={orderQuantity} 
                      onChange={e => setOrderQuantity(parseInt(e.target.value) || 1)} 
                      className={`w-full px-3 py-2 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`} 
                    />
                  </div>

                  {/* Custom Order ID (Optional) */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CUSTOM ORDER NUMBER</label>
                    <input 
                      type="text" 
                      value={orderIdInput} 
                      onChange={e => setOrderIdInput(e.target.value)} 
                      placeholder="Leave blank to auto-generate" 
                      className={`w-full px-3 py-2 rounded-lg text-xs font-medium focus:outline-none focus:border-indigo-500 border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800'}`} 
                    />
                  </div>

                  {/* Dynamic Total Calculation */}
                  {selectedProductId && (
                    <div className={`p-3 rounded-lg border flex justify-between items-center ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-indigo-50 border-indigo-100'}`}>
                      <span className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Total Due</span>
                      <span className={`text-sm font-black ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                        ${((inventory.find(p => p.id === selectedProductId)?.price || 0) * orderQuantity).toFixed(2)}
                      </span>
                    </div>
                  )}

                  <button type="submit" disabled={!selectedProductId} className={`w-full text-white font-bold text-xs py-2.5 rounded-lg transition shadow flex items-center justify-center gap-1.5 disabled:opacity-50 ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-900 hover:bg-indigo-600'}`}>
                    <Plus size={14} /> Create Order
                  </button>
                </form>
                
                {orderStatusMessage && (
                  <div className={`p-3 rounded-lg text-[11px] font-semibold text-center flex items-center justify-center gap-2 border ${orderStatusMessage.includes('Error') ? (isDarkMode ? 'bg-rose-950/40 text-rose-400 border-rose-900' : 'bg-rose-50 text-rose-700 border-rose-200') : (isDarkMode ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900' : 'bg-emerald-50 text-emerald-700 border-emerald-200')}`}>
                    {orderStatusMessage.includes('Error') ? <AlertTriangle size={12} className="flex-shrink-0" /> : <CheckCircle2 size={12} className="flex-shrink-0" />}
                    {orderStatusMessage}
                  </div>
                )}
              </div>
            ) : (
              <div className={`h-full flex items-center justify-center text-center text-xs border-2 border-dashed rounded-xl p-4 ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'}`}>Open a chat room to reveal the commerce panel.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}