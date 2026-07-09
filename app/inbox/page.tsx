"use client";

import { formatNumber, formatCurrency } from '../../lib/formatters';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Send, Image as ImageIcon, Smile, MessageSquare, Plus, ShoppingBag, 
  ClipboardList, Package, MapPin, Phone, CheckCircle2, Trash2, History, ShoppingCart, Filter, MessageCircle
} from 'lucide-react';

interface Customer { id: string; name: string; platform: string; chat_status: string; }
interface Message { id: string; customer_id: string; sender: string; content: string; created_at: string; status: string; }
interface Product { id: string; name: string; price: number; stock_quantity: number; }
interface Order { id: string; order_id_string: string; total_amount: number; status: string; created_at: string; customer_id: string; }
interface CartItem { product: Product; quantity: number; }

export default function UnifiedInbox() {
  const { isDarkMode } = useTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [workspaceCurrency, setWorkspaceCurrency] = useState('USD');
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  
  const [typedMessage, setTypedMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Filtering States
  const [feedFilter, setFeedFilter] = useState<'active' | 'unread' | 'completed'>('active');
  const [platformFilter, setPlatformFilter] = useState<string>('all'); // NEW: Channel Filter

  const [rightPanelTab, setRightPanelTab] = useState<'order' | 'history'>('order');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [orderQuantityInput, setOrderQuantityInput] = useState('1'); 
  
  const [contactPhone, setContactPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderStatusMessage, setOrderStatusMessage] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const quickEmojis = ["👍", "🙏", "😊", "📦", "💵", "✨", "✅"];

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        const { data: profile } = await supabase.from('profiles').select('currency_code').eq('id', session.user.id).single();
        if (profile?.currency_code) setWorkspaceCurrency(profile.currency_code);
      }
    };
    fetchUser();
  }, []);

  const syncCRMState = useCallback(async () => {
    if (!userId) return;
    const { data: custData } = await supabase.from('customers').select('*');
    const { data: msgData } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    const { data: invData } = await supabase.from('inventory').select('id, name, price, stock_quantity').eq('user_id', userId);
    const { data: ordData } = await supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    
    if (custData) setCustomers(custData as Customer[]);
    if (msgData) setMessages(msgData as Message[]);
    if (invData) setInventory(invData as Product[]);
    if (ordData) setOrders(ordData as Order[]);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    syncCRMState();
    
    const channel = supabase.channel('inbox-realtime-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => { syncCRMState(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { syncCRMState(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => { syncCRMState(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => { syncCRMState(); })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [userId, syncCRMState]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (selectedCustomerId) {
      supabase.from('messages').update({ status: 'read' }).eq('customer_id', selectedCustomerId).eq('status', 'unread').then();
      setCart([]); setContactPhone(''); setDeliveryAddress(''); setOrderStatusMessage(''); setRightPanelTab('order');
    }
  }, [messages, selectedCustomerId]);

  const handleSendMessage = async (e?: React.FormEvent, forcedContent?: string) => {
    if (e) e.preventDefault();
    if (!selectedCustomerId || !userId) return;
    
    const contentToSend = forcedContent || typedMessage || `[Media Attachment] ${mediaUrl}`;
    if (!contentToSend.trim()) return;

    setSending(true);
    const temporaryId = `temp-${Date.now()}`;
    
    const optimisticMessage: Message = {
      id: temporaryId, customer_id: selectedCustomerId, sender: 'Workspace Manager', content: contentToSend, created_at: new Date().toISOString(), status: 'sending'
    };

    setMessages(prev => [...prev, optimisticMessage]);
    if (!forcedContent) { setTypedMessage(''); setMediaUrl(''); setShowMediaInput(false); setShowEmojis(false); }
    
    try {
      const response = await fetch('/api/send-message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selectedCustomerId, text: contentToSend, mediaUrl, userId })
      });
      if (!response.ok) { setMessages(prev => prev.filter(m => m.id !== temporaryId)); alert("Failed to send message."); }
      else { syncCRMState(); }
    } catch (err) { setMessages(prev => prev.filter(m => m.id !== temporaryId)); } 
    finally { setSending(false); }
  };

  const handleAddToCart = () => {
    if (!selectedProductId) return;
    const product = inventory.find(p => p.id === selectedProductId);
    if (!product) return;

    const qty = parseInt(orderQuantityInput);
    if (isNaN(qty) || qty <= 0) { setOrderStatusMessage("Please enter a valid quantity."); return; }

    const existingCartItem = cart.find(item => item.product.id === selectedProductId);
    const totalRequestedQty = (existingCartItem?.quantity || 0) + qty;

    if (totalRequestedQty > product.stock_quantity) {
      setOrderStatusMessage(`Not enough stock! Only ${formatNumber(product.stock_quantity)} available total.`);
      return;
    }

    if (existingCartItem) {
      setCart(cart.map(item => item.product.id === selectedProductId ? { ...item, quantity: totalRequestedQty } : item));
    } else {
      setCart([...cart, { product, quantity: qty }]);
    }

    setOrderStatusMessage('');
    setSelectedProductId('');
    setOrderQuantityInput('1');
  };

  const removeFromCart = (productId: string) => { setCart(cart.filter(item => item.product.id !== productId)); };

  const handleCheckoutOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || cart.length === 0 || !userId) return;

    setOrderStatusMessage('Processing Order...');
    const targetIdString = `MH-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalAmount = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    const { error: orderError } = await supabase.from('orders').insert({
      customer_id: selectedCustomerId, order_id_string: targetIdString, total_amount: totalAmount, 
      status: 'pending', user_id: userId, contact_phone: contactPhone, delivery_address: deliveryAddress, cart_items: cart
    });

    if (orderError) { setOrderStatusMessage("Order Error"); return; }

    for (const item of cart) {
      await supabase.from('inventory').update({ stock_quantity: item.product.stock_quantity - item.quantity }).eq('id', item.product.id);
    }

    await supabase.from('messages').insert({
      customer_id: selectedCustomerId, sender: 'Workspace Manager',
      content: `[System Notification] Order ${targetIdString} logged for ${cart.length} item(s).`,
      status: 'read', user_id: userId
    });

    let receiptItems = cart.map(item => `▪ ${formatNumber(item.quantity)}x ${item.product.name}`).join('\n');
    const receiptText = `🎉 Order Confirmed!\n\nOrder ID: ${targetIdString}\n\nItems Ordered:\n${receiptItems}\n\nTotal Due: ${formatCurrency(totalAmount, workspaceCurrency)}\nPhone: ${contactPhone || 'N/A'}\nDeliver to: ${deliveryAddress || 'N/A'}\n\nThank you for shopping with us! We will notify you when it ships.`;
    
    await handleSendMessage(undefined, receiptText);

    setOrderStatusMessage('Order Submitted & Receipt Sent!');
    setCart([]); setContactPhone(''); setDeliveryAddress('');
    syncCRMState();
    setTimeout(() => setOrderStatusMessage(''), 4000);
  };

  const toggleChatStatus = async (currentStatus: string) => {
    if (!selectedCustomerId) return;
    const newStatus = currentStatus === 'completed' ? 'active' : 'completed';
    await supabase.from('customers').update({ chat_status: newStatus }).eq('id', selectedCustomerId);
    syncCRMState();
  };

  // --- OMNI-CHANNEL HELPER FUNCTIONS ---
  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'facebook': return <div className="bg-[#1877F2] p-1 rounded-full"><svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.898 1.488 5.485 3.824 7.185v3.42l3.493-1.921c.854.237 1.754.364 2.683.364 5.523 0 10-4.145 10-9.258S17.523 2 12 2zm1.094 12.383-2.91-3.116-5.691 3.116 6.257-6.643 2.99 3.116 5.61-3.116-6.256 6.643z"/></svg></div>;
      case 'telegram': return <div className="bg-[#0088cc] p-1 rounded-full"><svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></div>;
      case 'whatsapp': return <div className="bg-[#25D366] p-1 rounded-full"><svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg></div>;
      case 'viber': return <div className="bg-[#7360f2] p-1 rounded-full"><svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M19.167 4.09A11.134 11.134 0 0 0 12 .5a11.13 11.13 0 0 0-7.167 3.59A11.11 11.11 0 0 0 1.5 11.5c0 2.217.65 4.3 1.833 6.083L1 23l5.417-2.333a11.137 11.137 0 0 0 5.583 1.333h.001A11.127 11.127 0 0 0 19.167 18.91 11.114 11.114 0 0 0 22.5 11.5a11.124 11.124 0 0 0-3.333-7.41zM16.94 15.65c-.218.423-.847.886-1.393 1.002-.387.082-.888.163-2.61-.555-2.074-.863-3.411-2.97-3.51-3.105-.1-.136-.843-1.126-.843-2.146 0-1.02.527-1.52.715-1.716.188-.196.406-.245.545-.245.139 0 .278.002.397.007.129.006.302-.05.461.332.169.408.575 1.4.625 1.5.05.101.08.218.01.408-.07.19-.11.312-.218.441-.11.129-.23.272-.327.368-.11.109-.228.232-.109.436.12.204.53 .872 1.135 1.417.781.704 1.442.923 1.64 1.023.2.1.318.083.436-.054.12-.136.516-.602.655-.807.14-.204.278-.17.457-.102.179.068 1.131.534 1.325.632.193.098.322.147.367.23.045.083.045.485-.173.908z"/></svg></div>;
      default: return <MessageCircle size={10} className="text-white bg-slate-500 rounded-full p-0.5" />;
    }
  };

  const activeChatCustomer = customers.find(c => c.id === selectedCustomerId);
  const filteredMessages = messages.filter(m => m.customer_id === selectedCustomerId);
  const availableInventory = inventory.filter(p => p.stock_quantity > 0);
  const customerOrderHistory = orders.filter(o => o.customer_id === selectedCustomerId);

  // 🚀 OMNI-CHANNEL FILTERING LOGIC
  const platforms = ['all', ...Array.from(new Set(customers.map(c => c.platform)))];

  const feedCustomers = customers.filter(c => {
    // 1. Channel Filter Match
    if (platformFilter !== 'all' && c.platform !== platformFilter) return false;

    // 2. Status Filter Match
    const custMsgs = messages.filter(m => m.customer_id === c.id);
    const hasUnread = custMsgs.some(m => m.status === 'unread' && m.sender === 'customer');
    if (feedFilter === 'unread') return hasUnread;
    if (feedFilter === 'completed') return c.chat_status === 'completed';
    return c.chat_status !== 'completed';
  });

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  return (
    <div className={`min-h-screen flex font-sans h-screen overflow-hidden transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative h-full overflow-hidden">
        <Header />
        
        <div className={`flex-1 flex mt-16 overflow-hidden transition-colors duration-200 ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
          
          <div className={`w-full md:w-80 border-r flex flex-col overflow-hidden flex-shrink-0 transition-colors ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className={`p-4 border-b space-y-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <MessageSquare size={16} className="text-indigo-600" /> Inbox
                </h2>
                {/* 🚀 NEW: Channel Filter Dropdown */}
                <select 
                  value={platformFilter} 
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  className={`text-[10px] font-bold uppercase rounded p-1 border outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'}`}
                >
                  {platforms.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 w-full bg-slate-200/70 dark:bg-slate-800/70 p-1 rounded-lg gap-1">
                <button onClick={() => setFeedFilter('active')} className={`w-full text-[10px] font-bold py-1.5 rounded-md transition-all text-center flex items-center justify-center ${feedFilter === 'active' ? (isDarkMode ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm') : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>ACTIVE</button>
                <button onClick={() => setFeedFilter('unread')} className={`w-full text-[10px] font-bold py-1.5 rounded-md transition-all text-center flex items-center justify-center ${feedFilter === 'unread' ? (isDarkMode ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm') : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>UNREAD</button>
                <button onClick={() => setFeedFilter('completed')} className={`w-full text-[10px] font-bold py-1.5 rounded-md transition-all text-center flex items-center justify-center ${feedFilter === 'completed' ? (isDarkMode ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm') : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>RESOLVED</button>
              </div>
            </div>
            
            <div className={`divide-y overflow-y-auto flex-1 custom-scrollbar ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {feedCustomers.length === 0 ? (
                <div className="p-8 text-center text-xs font-medium text-slate-500">No {feedFilter} conversations found {platformFilter !== 'all' ? `on ${platformFilter}` : ''}.</div>
              ) : (
                feedCustomers.map((customer) => {
                  const customerMsgs = messages.filter(m => m.customer_id === customer.id);
                  const lastMsg = customerMsgs[customerMsgs.length - 1];
                  const hasUnread = customerMsgs.some(m => m.status === 'unread' && m.sender === 'customer');

                  return (
                    <button key={customer.id} onClick={() => setSelectedCustomerId(customer.id)} className={`w-full p-4 text-left flex items-start gap-3 transition-colors ${selectedCustomerId === customer.id ? (isDarkMode ? 'bg-slate-900 border-l-4 border-indigo-500' : 'bg-white border-l-4 border-indigo-600 shadow-sm') : (isDarkMode ? 'hover:bg-slate-900 bg-slate-950' : 'hover:bg-slate-100 bg-slate-50')}`}>
                      
                      <div className="relative flex-shrink-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black uppercase text-sm border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>
                          {customer.name[0]}
                        </div>
                        {/* 🚀 OMNI-CHANNEL PLATFORM BADGE OVERLAY */}
                        <div className="absolute -bottom-1 -right-1 shadow-sm rounded-full border-2 border-white dark:border-slate-950">
                          {getPlatformIcon(customer.platform)}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 ml-1">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className={`text-sm truncate block ${hasUnread ? (isDarkMode ? 'font-bold text-white' : 'font-bold text-slate-900') : (isDarkMode ? 'font-medium text-slate-300' : 'font-medium text-slate-700')}`}>{customer.name}</span>
                          <span className="text-[9px] text-slate-500 font-mono">{lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                        <p className={`text-xs truncate pr-1 ${hasUnread ? 'text-indigo-500 font-semibold' : 'text-slate-500'}`}>{lastMsg ? (lastMsg.sender === 'Workspace Manager' ? `You: ${lastMsg.content}` : lastMsg.content) : 'No transmissions.'}</p>
                      </div>
                      {hasUnread && <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full self-center flex-shrink-0 ring-4 ring-indigo-600/20"></span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className={`flex-1 flex flex-col h-full overflow-hidden border-r transition-colors ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            {selectedCustomerId && activeChatCustomer ? (
              <>
                <div className={`p-4 border-b flex justify-between items-center shadow-sm flex-shrink-0 transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <h3 className={`text-base font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {activeChatCustomer.name}
                      </h3>
                      {/* 🚀 CONTEXTUAL CHANNEL TAG */}
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                        {getPlatformIcon(activeChatCustomer.platform)} 
                        via <span className="uppercase tracking-wider font-bold opacity-80">{activeChatCustomer.platform}</span>
                      </p>
                    </div>
                  </div>
                  <button onClick={() => toggleChatStatus(activeChatCustomer.chat_status)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${activeChatCustomer.chat_status === 'completed' ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20'}`}>
                    {activeChatCustomer.chat_status === 'completed' ? 'Reopen Chat' : <><CheckCircle2 size={14}/> Resolve Chat</>}
                  </button>
                </div>

                <div className={`flex-1 p-6 overflow-y-auto space-y-5 custom-scrollbar ${isDarkMode ? 'bg-slate-950/60' : 'bg-slate-50/60'}`}>
                  {filteredMessages.map((msg) => {
                    const isManager = msg.sender === 'Workspace Manager';
                    const isSystem = msg.content.includes('[System Notification]');
                    if (isSystem) return (
                      <div key={msg.id} className="flex justify-center my-3 animate-fade-in">
                        <div className={`text-xs py-2 px-4 rounded-xl font-medium flex items-center gap-2 shadow-sm border ${isDarkMode ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}><ClipboardList size={14} /> {msg.content}</div>
                      </div>
                    );
                    return (
                      <div key={msg.id} className={`flex flex-col ${isManager ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm border whitespace-pre-wrap ${isManager ? 'bg-indigo-600 text-white border-indigo-700 rounded-tr-none' : (isDarkMode ? 'bg-slate-800 text-slate-200 border-slate-700 rounded-tl-none' : 'bg-white text-slate-800 border-slate-200 rounded-tl-none')} ${msg.status === 'sending' ? 'opacity-70' : ''}`}>{msg.content}</div>
                        <span className="text-[10px] text-slate-500 mt-1.5 font-mono px-1 flex items-center gap-1">
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
                    <button onClick={() => { setShowMediaInput(!showMediaInput); setShowEmojis(false); }} className={`p-1.5 rounded transition border ${showMediaInput ? 'bg-slate-100 text-indigo-600 border-slate-200 dark:bg-slate-800 dark:text-indigo-400 dark:border-slate-700' : 'text-slate-500 border-transparent'}`}><ImageIcon size={16} /></button>
                    <button onClick={() => { setShowEmojis(!showEmojis); setShowMediaInput(false); }} className={`p-1.5 rounded transition border ${showEmojis ? 'bg-slate-100 text-indigo-600 border-slate-200 dark:bg-slate-800 dark:text-indigo-400 dark:border-slate-700' : 'text-slate-500 border-transparent'}`}><Smile size={16} /></button>
                    <div className="flex gap-2 ml-2">{quickEmojis.map(e => <button key={e} onClick={() => setTypedMessage(prev => prev + e)} className="text-sm hover:scale-125 transition-transform">{e}</button>)}</div>
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

          <div className={`hidden lg:flex w-[340px] flex-col flex-shrink-0 p-5 overflow-y-auto custom-scrollbar transition-colors ${isDarkMode ? 'bg-slate-900 border-l border-slate-800' : 'bg-white'}`}>
            {selectedCustomerId && activeChatCustomer ? (
              <div className="space-y-6 animate-fade-in">
                
                <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg">
                  <button onClick={() => setRightPanelTab('order')} className={`flex-1 text-[10px] font-bold py-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${rightPanelTab === 'order' ? (isDarkMode ? 'bg-slate-700 text-white shadow' : 'bg-white text-slate-900 shadow') : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    <ShoppingCart size={14} /> NEW ORDER
                  </button>
                  <button onClick={() => setRightPanelTab('history')} className={`flex-1 text-[10px] font-bold py-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${rightPanelTab === 'history' ? (isDarkMode ? 'bg-slate-700 text-white shadow' : 'bg-white text-slate-900 shadow') : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    <History size={14} /> HISTORY
                  </button>
                </div>

                {rightPanelTab === 'order' ? (
                  <div className="space-y-4 animate-fade-in">
                    <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <label className="block text-[10px] font-bold text-indigo-500 uppercase mb-3">1. Add Items to Order</label>
                      <div className="space-y-3">
                        <select 
                          value={selectedProductId} 
                          onChange={e => setSelectedProductId(e.target.value)} 
                          className={`w-full px-3 py-2.5 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 border appearance-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                        >
                          <option value="" disabled>Choose a product...</option>
                          {availableInventory.map(p => <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price, workspaceCurrency)}</option>)}
                        </select>
                        
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            min="1"
                            value={orderQuantityInput} 
                            onChange={e => setOrderQuantityInput(e.target.value)} 
                            placeholder="Qty" 
                            className={`w-20 px-3 py-2.5 rounded-lg text-xs font-semibold text-center focus:outline-none focus:border-indigo-500 border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-200'}`} 
                          />
                          <button 
                            type="button"
                            onClick={handleAddToCart} 
                            disabled={!selectedProductId} 
                            className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-xs py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                          >
                            <Plus size={14}/> Add to Cart
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border space-y-3 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <h4 className="text-[10px] font-bold text-indigo-500 uppercase border-b pb-2 dark:border-slate-800">2. Shopping Cart ({cart.length})</h4>
                      
                      {cart.length === 0 ? (
                        <div className="text-xs text-slate-400 text-center py-3 font-medium">
                          Cart is empty. Add a product above.
                        </div>
                      ) : (
                        cart.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="font-semibold truncate pr-2">{formatNumber(item.quantity)}x {item.product.name}</span>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="font-mono text-slate-500">{formatCurrency(item.quantity * item.product.price, workspaceCurrency)}</span>
                              <button type="button" onClick={() => removeFromCart(item.product.id)} className="text-rose-400 hover:text-rose-600 transition-colors"><Trash2 size={14}/></button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleCheckoutOrder} className="space-y-4 pt-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contact Phone</label>
                        <div className="relative">
                          <Phone size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                          <input type="text" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="09 123 456 789" className={`w-full pl-9 pr-3 py-2.5 rounded-lg text-xs font-medium focus:outline-none focus:border-indigo-500 border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery Address</label>
                        <div className="relative">
                          <MapPin size={14} className={`absolute left-3 top-3 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                          <textarea rows={2} value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Full street address..." className={`w-full pl-9 pr-3 py-2.5 rounded-lg text-xs font-medium focus:outline-none focus:border-indigo-500 border resize-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} />
                        </div>
                      </div>

                      <hr className={isDarkMode ? 'border-slate-800' : 'border-slate-100'} />

                      <div className={`p-3 rounded-lg border flex justify-between items-center ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-indigo-50 border-indigo-100'}`}>
                        <span className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Total Due</span>
                        <span className={`text-base font-black ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>{formatCurrency(cartTotal, workspaceCurrency)}</span>
                      </div>

                      <button type="submit" disabled={cart.length === 0} className={`w-full text-white font-bold text-xs py-3 rounded-lg transition shadow flex items-center justify-center gap-1.5 disabled:opacity-50 ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-900 hover:bg-indigo-600'}`}>
                        <CheckCircle2 size={14} /> Checkout & Send Receipt
                      </button>
                    </form>
                    
                    {orderStatusMessage && (
                      <div className={`p-3 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-2 border ${orderStatusMessage.includes('Error') || orderStatusMessage.includes('stock') || orderStatusMessage.includes('valid') ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900'}`}>
                        {orderStatusMessage}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in pt-2">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase border-b pb-2 dark:border-slate-800">Past Orders ({customerOrderHistory.length})</h3>
                    {customerOrderHistory.length === 0 ? (
                      <div className="text-center text-xs text-slate-500 py-4">No previous orders found for this user.</div>
                    ) : (
                      customerOrderHistory.map(order => (
                        <div key={order.id} className={`p-3 rounded-xl border flex flex-col gap-2 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold font-mono text-indigo-500">{order.order_id_string}</span>
                            <span className="text-[9px] font-mono text-slate-400">{new Date(order.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${order.status === 'fulfilled' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>{order.status}</span>
                            <span className="text-sm font-black">{formatCurrency(order.total_amount, workspaceCurrency)}</span>
                          </div>
                        </div>
                      ))
                    )}
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