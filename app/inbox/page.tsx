"use client";

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Send, Image, Smile, MessageSquare, Plus, ShoppingBag, 
  ClipboardList, Package, MapPin, Phone, CheckCircle2, UserCheck, AlertCircle
} from 'lucide-react';

interface Customer { id: string; name: string; platform: string; chat_status: string; }
interface Message { id: string; customer_id: string; sender: string; content: string; created_at: string; status: string; }
interface Product { id: string; name: string; price: number; stock_quantity: number; }

export default function UnifiedInbox() {
  const { isDarkMode } = useTheme();
  const [userId, setUserId] = useState<string | null>(null);
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  
  // Chat States
  const [typedMessage, setTypedMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedFilter, setFeedFilter] = useState<'active' | 'unread' | 'completed'>('active');

  // Order States
  const [selectedProductId, setSelectedProductId] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderIdInput, setOrderIdInput] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderStatusMessage, setOrderStatusMessage] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const quickEmojis = ["👍", "🙏", "😊", "📦", "💵", "✨", "✅"];

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUserId(session.user.id);
    };
    fetchUser();
  }, []);

  const syncCRMState = async () => {
    if (!userId) return;
    
    // Using a broad query to ensure we capture all updates based on RLS
    const { data: custData } = await supabase.from('customers').select('*');
    const { data: msgData } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    const { data: invData } = await supabase.from('inventory').select('id, name, price, stock_quantity').eq('user_id', userId);
    
    if (custData) setCustomers(custData as Customer[]);
    if (msgData) setMessages(msgData as Message[]);
    if (invData) setInventory(invData as Product[]);
  };

  useEffect(() => {
    if (userId) syncCRMState();
    
    const channel = supabase.channel('live-inbox-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, syncCRMState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, syncCRMState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, syncCRMState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, syncCRMState)
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (selectedCustomerId) {
      supabase.from('messages').update({ status: 'read' }).eq('customer_id', selectedCustomerId).eq('status', 'unread').then();
    }
  }, [messages, selectedCustomerId]);

  // -------------------------------------------------------------
  // SEND MESSAGE HANDLER
  // -------------------------------------------------------------
  const handleSendMessage = async (e?: React.FormEvent, forcedContent?: string) => {
    if (e) e.preventDefault();
    if (!selectedCustomerId || !userId) return;
    
    const contentToSend = forcedContent || typedMessage || `[Media Attachment] ${mediaUrl}`;
    if (!contentToSend.trim()) return;

    setSending(true);
    const temporaryId = `temp-${Date.now()}`;
    
    const optimisticMessage: Message = {
      id: temporaryId,
      customer_id: selectedCustomerId,
      sender: 'Workspace Manager',
      content: contentToSend,
      created_at: new Date().toISOString(),
      status: 'sending'
    };

    setMessages(prev => [...prev, optimisticMessage]);
    if (!forcedContent) { setTypedMessage(''); setMediaUrl(''); setShowMediaInput(false); setShowEmojis(false); }
    
    try {
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selectedCustomerId, text: contentToSend, mediaUrl, userId })
      });

      if (!response.ok) { 
        setMessages(prev => prev.filter(m => m.id !== temporaryId));
        alert("Failed to send message to external channel."); 
      } else {
        syncCRMState();
      }
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== temporaryId));
    } finally {
      setSending(false);
    }
  };

  // -------------------------------------------------------------
  // ORDER CREATION & AUTO-RECEIPT LOGIC
  // -------------------------------------------------------------
  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !selectedProductId || !userId) return;
    
    const product = inventory.find(p => p.id === selectedProductId);
    if (!product) return;
    
    if (product.stock_quantity < orderQuantity) {
      setOrderStatusMessage(`Not enough stock! Only ${product.stock_quantity} left.`);
      return;
    }

    setOrderStatusMessage('Processing...');
    const targetIdString = orderIdInput.trim() || `MH-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalAmount = product.price * orderQuantity;

    // 1. Create the Order (Now including address & phone)
    const { error: orderError } = await supabase.from('orders').insert({
      customer_id: selectedCustomerId, 
      order_id_string: targetIdString, 
      total_amount: totalAmount, 
      status: 'pending',
      user_id: userId,
      contact_phone: contactPhone,
      delivery_address: deliveryAddress
    });

    if (orderError) { setOrderStatusMessage("Order Error"); return; }

    // 2. Deduct Stock
    await supabase.from('inventory').update({ stock_quantity: product.stock_quantity - orderQuantity }).eq('id', product.id);

    // 3. System Notification for Admin View
    await supabase.from('messages').insert({
      customer_id: selectedCustomerId, sender: 'Workspace Manager',
      content: `[System Notification] Order ${targetIdString} logged.`,
      status: 'read', user_id: userId
    });

    // 4. THE MAGIC: Send a beautifully formatted auto-receipt to the customer's Telegram/Messenger!
    const receiptText = `🎉 Order Confirmed!\n\nOrder ID: ${targetIdString}\nItem: ${orderQuantity}x ${product.name}\nTotal Due: $${totalAmount.toFixed(2)}\nPhone: ${contactPhone || 'N/A'}\nDeliver to: ${deliveryAddress || 'N/A'}\n\nThank you for shopping with us! We will notify you when it ships.`;
    
    await handleSendMessage(undefined, receiptText);

    // 5. Cleanup
    setOrderStatusMessage('Order Submitted & Receipt Sent!');
    setSelectedProductId(''); setOrderQuantity(1); setOrderIdInput(''); setContactPhone(''); setDeliveryAddress('');
    syncCRMState();
    setTimeout(() => setOrderStatusMessage(''), 4000);
  };

  // -------------------------------------------------------------
  // CHAT STATUS TOGGLE
  // -------------------------------------------------------------
  const toggleChatStatus = async (currentStatus: string) => {
    if (!selectedCustomerId) return;
    const newStatus = currentStatus === 'completed' ? 'active' : 'completed';
    await supabase.from('customers').update({ chat_status: newStatus }).eq('id', selectedCustomerId);
    syncCRMState();
  };

  const activeChatCustomer = customers.find(c => c.id === selectedCustomerId);
  const filteredMessages = messages.filter(m => m.customer_id === selectedCustomerId);
  const availableInventory = inventory.filter(p => p.stock_quantity > 0);

  // Filter the Sidebar feed
  const feedCustomers = customers.filter(c => {
    const custMsgs = messages.filter(m => m.customer_id === c.id);
    const hasUnread = custMsgs.some(m => m.status === 'unread' && m.sender === 'customer');
    
    if (feedFilter === 'unread') return hasUnread;
    if (feedFilter === 'completed') return c.chat_status === 'completed';
    return c.chat_status !== 'completed'; // 'active' default
  });

  return (
    <div className={`min-h-screen flex font-sans h-screen overflow-hidden transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative h-full overflow-hidden">
        <Header />
        
        <div className={`flex-1 flex mt-16 overflow-hidden transition-colors duration-200 ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
          
          {/* COLUMN 1: Feed Filter & Sidebar */}
          <div className={`w-full md:w-80 border-r flex flex-col overflow-hidden flex-shrink-0 transition-colors ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            
            <div className={`p-4 border-b space-y-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2"><MessageSquare size={16} className="text-indigo-600" /> Conversational Feeds</h2>
              
              {/* FEED FILTERS */}
              <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-lg">
                <button onClick={() => setFeedFilter('active')} className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-colors ${feedFilter === 'active' ? (isDarkMode ? 'bg-slate-700 text-white shadow' : 'bg-white text-slate-900 shadow') : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>ACTIVE</button>
                <button onClick={() => setFeedFilter('unread')} className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-colors ${feedFilter === 'unread' ? (isDarkMode ? 'bg-slate-700 text-white shadow' : 'bg-white text-slate-900 shadow') : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>UNREAD</button>
                <button onClick={() => setFeedFilter('completed')} className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-colors ${feedFilter === 'completed' ? (isDarkMode ? 'bg-slate-700 text-white shadow' : 'bg-white text-slate-900 shadow') : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>RESOLVED</button>
              </div>
            </div>
            
            <div className={`divide-y overflow-y-auto flex-1 custom-scrollbar ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {feedCustomers.length === 0 ? (
                <div className="p-8 text-center text-xs font-medium text-slate-500">No {feedFilter} conversations found.</div>
              ) : (
                feedCustomers.map((customer) => {
                  const customerMsgs = messages.filter(m => m.customer_id === customer.id);
                  const lastMsg = customerMsgs[customerMsgs.length - 1];
                  const hasUnread = customerMsgs.some(m => m.status === 'unread' && m.sender === 'customer');

                  return (
                    <button
                      key={customer.id}
                      onClick={() => { setSelectedCustomerId(customer.id); setOrderStatusMessage(''); }}
                      className={`w-full p-4 text-left flex items-start gap-3 transition-colors ${selectedCustomerId === customer.id ? (isDarkMode ? 'bg-slate-900 border-l-4 border-indigo-500' : 'bg-white border-l-4 border-indigo-600 shadow-sm') : (isDarkMode ? 'hover:bg-slate-900 bg-slate-950' : 'hover:bg-slate-100 bg-slate-50')}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black uppercase flex-shrink-0 text-sm border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>{customer.name[0]}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className={`text-sm truncate block ${hasUnread ? (isDarkMode ? 'font-bold text-white' : 'font-bold text-slate-900') : (isDarkMode ? 'font-medium text-slate-300' : 'font-medium text-slate-700')}`}>{customer.name}</span>
                          <span className="text-[9px] text-slate-500 font-mono">{lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                        <p className={`text-xs truncate ${hasUnread ? 'text-indigo-500 font-semibold' : 'text-slate-500'}`}>
                          {lastMsg ? (lastMsg.sender === 'Workspace Manager' ? `You: ${lastMsg.content}` : lastMsg.content) : 'No transmissions.'}
                        </p>
                      </div>
                      {hasUnread && <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full self-center flex-shrink-0 ring-4 ring-indigo-600/20"></span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMN 2: Chat Box */}
          <div className={`flex-1 flex flex-col h-full overflow-hidden border-r transition-colors ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            {selectedCustomerId && activeChatCustomer ? (
              <>
                <div className={`p-4 border-b flex justify-between items-center shadow-sm flex-shrink-0 transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div>
                    <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{activeChatCustomer.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">Channel: <span className="text-indigo-500 font-bold uppercase">{activeChatCustomer.platform}</span></p>
                  </div>
                  
                  {/* TOGGLE RESOLVED BUTTON */}
                  <button 
                    onClick={() => toggleChatStatus(activeChatCustomer.chat_status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${activeChatCustomer.chat_status === 'completed' ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20'}`}
                  >
                    {activeChatCustomer.chat_status === 'completed' ? 'Reopen Chat' : <><CheckCircle2 size={14}/> Resolve Chat</>}
                  </button>
                </div>

                <div className={`flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar ${isDarkMode ? 'bg-slate-950/60' : 'bg-slate-50/60'}`}>
                  {filteredMessages.map((msg) => {
                    const isManager = msg.sender === 'Workspace Manager';
                    const isSystem = msg.content.includes('[System Notification]');
                    
                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center my-2 animate-fade-in">
                          <div className={`text-xs py-2 px-4 rounded-xl font-medium flex items-center gap-2 shadow-sm border ${isDarkMode ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>
                            <ClipboardList size={14} /> {msg.content}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className={`flex flex-col ${isManager ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[75%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm border whitespace-pre-wrap ${isManager ? 'bg-indigo-600 text-white border-indigo-700 rounded-tr-none' : (isDarkMode ? 'bg-slate-800 text-slate-200 border-slate-700 rounded-tl-none' : 'bg-white text-slate-800 border-slate-200 rounded-tl-none')} ${msg.status === 'sending' ? 'opacity-70' : ''}`}>
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 font-mono px-1 flex items-center gap-1">
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
                    <button onClick={() => { setShowMediaInput(!showMediaInput); setShowEmojis(false); }} className={`p-1.5 rounded transition border ${showMediaInput ? 'bg-slate-100 text-indigo-600 border-slate-200 dark:bg-slate-800 dark:text-indigo-400 dark:border-slate-700' : 'text-slate-500 border-transparent'}`}><Image size={16} /></button>
                    <button onClick={() => { setShowEmojis(!showEmojis); setShowMediaInput(false); }} className={`p-1.5 rounded transition border ${showEmojis ? 'bg-slate-100 text-indigo-600 border-slate-200 dark:bg-slate-800 dark:text-indigo-400 dark:border-slate-700' : 'text-slate-500 border-transparent'}`}><Smile size={16} /></button>
                    <div className="flex gap-2 ml-2">
                      {quickEmojis.map(e => <button key={e} onClick={() => setTypedMessage(prev => prev + e)} className="text-sm hover:scale-125 transition-transform">{e}</button>)}
                    </div>
                  </div>

                  {showMediaInput && (
                    <div className={`p-2 rounded-lg border flex items-center gap-2 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Image URL:</span>
                      <input type="text" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} className={`flex-1 rounded p-1 text-xs focus:outline-none border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`} placeholder="https://image-url.com/photo.jpg" />
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                    <input type="text" value={typedMessage} onChange={e => setTypedMessage(e.target.value)} placeholder="Type a reply to send to customer..." className={`flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200'}`} />
                    <button type="submit" disabled={sending || (!typedMessage.trim() && !mediaUrl.trim())} className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl disabled:opacity-45 transition flex items-center justify-center flex-shrink-0"><Send size={16} className={sending ? 'animate-pulse' : ''} /></button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 p-8 text-sm font-semibold">Select an open message room profile node to begin chatting.</div>
            )}
          </div>

          {/* COLUMN 3: ORDER & LOGISTICS PANEL */}
          <div className={`hidden lg:flex w-80 flex-col flex-shrink-0 p-5 overflow-y-auto custom-scrollbar transition-colors ${isDarkMode ? 'bg-slate-900 border-l border-slate-800' : 'bg-white'}`}>
            {selectedCustomerId && activeChatCustomer ? (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-1"><ShoppingBag size={14} className="text-indigo-600" /> Auto-Receipt Ordering</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed">Booking this deal will instantly send an automated receipt directly to the customer's chat.</p>
                </div>
                <hr className={isDarkMode ? 'border-slate-800' : 'border-slate-100'} />
                
                <form onSubmit={handleCreateManualOrder} className="space-y-4">
                  
                  {/* Select Product */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Product *</label>
                    <div className="relative">
                      <Package size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                      <select required value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className={`w-full pl-9 pr-3 py-2.5 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 border appearance-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                        <option value="" disabled>Choose an item...</option>
                        {availableInventory.map(p => <option key={p.id} value={p.id}>{p.name} - ${p.price.toFixed(2)} ({p.stock_quantity} left)</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Quantity *</label>
                    <input type="number" min="1" required value={orderQuantity} onChange={e => setOrderQuantity(parseInt(e.target.value) || 1)} className={`w-full px-3 py-2.5 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} />
                  </div>

                  {/* NEW: Contact Phone */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contact Phone</label>
                    <div className="relative">
                      <Phone size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                      <input type="text" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="09 123 456 789" className={`w-full pl-9 pr-3 py-2.5 rounded-lg text-xs font-medium focus:outline-none focus:border-indigo-500 border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} />
                    </div>
                  </div>

                  {/* NEW: Delivery Address */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery Address</label>
                    <div className="relative">
                      <MapPin size={14} className={`absolute left-3 top-3 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                      <textarea rows={3} value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Full street address..." className={`w-full pl-9 pr-3 py-2.5 rounded-lg text-xs font-medium focus:outline-none focus:border-indigo-500 border resize-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} />
                    </div>
                  </div>

                  <hr className={isDarkMode ? 'border-slate-800' : 'border-slate-100'} />

                  {/* Dynamic Total */}
                  {selectedProductId && (
                    <div className={`p-3 rounded-lg border flex justify-between items-center ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-indigo-50 border-indigo-100'}`}>
                      <span className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Total Due</span>
                      <span className={`text-base font-black ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>${((inventory.find(p => p.id === selectedProductId)?.price || 0) * orderQuantity).toFixed(2)}</span>
                    </div>
                  )}

                  <button type="submit" disabled={!selectedProductId} className={`w-full text-white font-bold text-xs py-3 rounded-lg transition shadow flex items-center justify-center gap-1.5 disabled:opacity-50 ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-900 hover:bg-indigo-600'}`}>
                    <Plus size={14} /> Book Order & Send Receipt
                  </button>
                </form>
                
                {orderStatusMessage && (
                  <div className={`p-3 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-2 border ${orderStatusMessage.includes('Error') || orderStatusMessage.includes('stock') ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900'}`}>
                    {orderStatusMessage}
                  </div>
                )}
              </div>
            ) : (
              <div className={`h-full flex items-center justify-center text-center text-sm font-medium border-2 border-dashed rounded-xl p-6 ${isDarkMode ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'}`}>Open a chat room to access the commerce terminal.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}