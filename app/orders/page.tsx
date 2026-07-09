"use client";

import { formatNumber, formatCurrency } from '../../lib/formatters';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { 
  Truck, MapPin, Camera, CheckCircle2, X, Receipt, LogOut, Package, Navigation, HandGrab, Phone, Edit2, Save
} from 'lucide-react';

interface Order {
  id: string;
  order_id_string: string;
  total_amount: number;
  status: string;
  payment_status: string;
  delivery_state: 'unassigned' | 'assigned' | 'picked_up' | 'arrived' | 'delivered';
  assigned_driver_id: string | null;
  created_at: string;
  customer_id: string; 
  delivery_address?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  phone?: string | null;
  customers: { 
    name: string;
    phone?: string | null;
    address?: string | null;
  } | null;
}

export default function DriverApp() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  
  // App States
  const [userId, setUserId] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string>('');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pool' | 'my_route'>('my_route');

  // Phone Editing States
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInputValue, setPhoneInputValue] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  // Delivery Modal States
  const [activeDelivery, setActiveDelivery] = useState<Order | null>(null);
  const [paymentStatus, setPaymentStatus] = useState('Cash Received');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDeliveries = async (targetWorkspaceId: string) => {
    if (!targetWorkspaceId) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, customers(name)')
        .eq('user_id', targetWorkspaceId)
        .eq('status', 'in_transit')
        .order('created_at', { ascending: true });

      if (!error && data) setDeliveries(data as unknown as Order[]);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          router.replace('/login');
          return;
        }
        
        setUserId(session.user.id);
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('workspace_id, phone')
          .eq('id', session.user.id)
          .single();
        
        const activeWorkspaceId = profile?.workspace_id || session.user.id;
        setWorkspaceId(activeWorkspaceId);
        if (profile?.phone) {
          setUserPhone(profile.phone);
          setPhoneInputValue(profile.phone);
        }

        await fetchDeliveries(activeWorkspaceId);
      } catch (err: any) {
        setLoading(false);
      }
    };

    initializeApp();
  }, [router]);

  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase.channel('live-driver-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        if (workspaceId) fetchDeliveries(workspaceId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

  // 🚀 FIXED: Added explicit error catching and browser alerts for gateway visibility
  const sendOrderNotification = async (order: Order, newStatus: string) => {
    if (!workspaceId) return; 

    let notificationText = '';
    const activeDriverPhone = phoneInputValue || userPhone || 'N/A';
    
    if (newStatus === 'assigned') {
      notificationText = `🚚 Order Update: Great news! Your order ${order.order_id_string} has been assigned to our driver. You can contact them at: ${activeDriverPhone}`;
    } else if (newStatus === 'picked_up') {
      notificationText = `🚚 Order Update: Your order ${order.order_id_string} is currently in transit and heading your way! Driver contact number: ${activeDriverPhone}`;
    } else if (newStatus === 'arrived') {
      notificationText = `📍 Driver Arrived: Our driver is at your location with order ${order.order_id_string}. Please be ready to receive it!`;
    } else if (newStatus === 'delivered') {
      notificationText = `✅ Order Delivered: Your order ${order.order_id_string} has been successfully delivered. Thank you!`;
    }

    if (!notificationText) return;

    try {
      const res = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: order.customer_id, text: notificationText, userId: workspaceId })
      });

      // 🚨 EXPOSE THE CULPRIT: If the server returns an error code, display it immediately
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        alert(`Message Route Blocked: ${errorData.error || 'Server rejected request'}`);
      }
    } catch (err: any) {
      alert(`Network connection dropped: ${err.message}`);
    }
  };

  const handleUpdatePhone = async () => {
    if (!userId) return;
    setIsSavingPhone(true);

    const { error } = await supabase
      .from('profiles')
      .update({ phone: phoneInputValue })
      .eq('id', userId);

    setIsSavingPhone(false);
    if (!error) {
      setUserPhone(phoneInputValue);
      setIsEditingPhone(false);
    } else {
      alert("Failed to save telephone settings. Check connectivity.");
    }
  };

  const claimOrder = async (orderId: string) => {
    if (!userId) return;
    
    const targetOrder = deliveries.find(o => o.id === orderId);
    if (!targetOrder) return;

    setDeliveries(prev => prev.map(o => o.id === orderId ? { ...o, assigned_driver_id: userId, delivery_state: 'assigned' } : o));
    setActiveTab('my_route');

    const { error } = await supabase.from('orders').update({ 
      assigned_driver_id: userId, 
      delivery_state: 'assigned' 
    }).eq('id', orderId);

    if (!error) {
      sendOrderNotification(targetOrder, 'assigned');
    } else {
      alert(`Failed to claim route database record: ${error.message}`);
      if (workspaceId) fetchDeliveries(workspaceId);
    }
  };

  const advanceProgress = async (orderId: string, newState: string) => {
    const targetOrder = deliveries.find(o => o.id === orderId);
    if (!targetOrder) return;

    setDeliveries(prev => prev.map(o => o.id === orderId ? { ...o, delivery_state: newState as any } : o));
    
    const { error } = await supabase.from('orders').update({ delivery_state: newState }).eq('id', orderId);
    
    if (!error) {
      sendOrderNotification(targetOrder, newState);
    } else {
      alert(`Database rejected status transition: ${error.message}`);
    }
  };

  const submitDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDelivery) return;
    setIsSubmitting(true);

    try {
      let uploadedUrl = null;
      if (evidenceFile) {
        const fileExt = evidenceFile.name.split('.').pop();
        const fileName = `delivery-${activeDelivery.id}-${Math.random()}.${fileExt}`;
        await supabase.storage.from('delivery_evidence').upload(fileName, evidenceFile);
        const { data: { publicUrl } } = supabase.storage.from('delivery_evidence').getPublicUrl(fileName);
        uploadedUrl = publicUrl;
      }

      setDeliveries(prev => prev.filter(o => o.id !== activeDelivery.id));

      await supabase.from('orders').update({ 
        status: 'fulfilled',
        delivery_state: 'delivered',
        payment_status: paymentStatus,
        delivery_evidence_url: uploadedUrl
      }).eq('id', activeDelivery.id);

      sendOrderNotification(activeDelivery, 'delivered');

      setActiveDelivery(null);
      setEvidenceFile(null);
    } catch (error: any) {
      alert(`Fulfillment Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!userId) return <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}></div>;

  const poolOrders = deliveries.filter(o => !o.assigned_driver_id || o.delivery_state === 'unassigned');
  const myRouteOrders = deliveries.filter(o => o.assigned_driver_id === userId);
  const displayOrders = activeTab === 'pool' ? poolOrders : myRouteOrders;

  return (
    <div className={`min-h-screen font-sans flex flex-col pb-12 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      <header className={`pt-12 pb-0 px-6 shadow-sm z-10 ${isDarkMode ? 'bg-slate-900' : 'bg-indigo-600 text-white'}`}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-black tracking-tight">Driver Portal</h1>
            <p className="text-xs opacity-80 mt-0.5">{myRouteOrders.length} active stops on your route</p>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
            <LogOut size={18} />
          </button>
        </div>

        {/* SELF-SERVICE LIVE PHONE CONFIG PANEL */}
        <div className="mb-4 py-2.5 px-4 rounded-xl bg-white/10 text-white flex items-center justify-between text-xs font-semibold backdrop-blur-sm">
          <div className="flex items-center gap-2 flex-1 mr-4">
            <Phone size={14} className="opacity-70" />
            {isEditingPhone ? (
              <input 
                type="tel" 
                value={phoneInputValue} 
                onChange={(e) => setPhoneInputValue(e.target.value)} 
                className="bg-black/20 text-white px-2 py-1 rounded font-mono border border-white/20 focus:outline-none w-full max-w-[150px]"
                placeholder="Enter phone"
              />
            ) : (
              <span>Active Phone: <span className="font-mono font-bold">{userPhone || 'Not Set'}</span></span>
            )}
          </div>
          <button 
            onClick={() => isEditingPhone ? handleUpdatePhone() : setIsEditingPhone(true)} 
            disabled={isSavingPhone}
            className="p-1.5 rounded bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex-shrink-0"
          >
            {isEditingPhone ? <Save size={14} /> : <Edit2 size={14} />}
          </button>
        </div>

        <div className="flex gap-4 border-b border-white/20">
          <button onClick={() => setActiveTab('my_route')} className={`pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'my_route' ? 'border-white opacity-100' : 'border-transparent opacity-50'}`}>
            My Route ({myRouteOrders.length})
          </button>
          <button onClick={() => setActiveTab('pool')} className={`pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'pool' ? 'border-white opacity-100' : 'border-transparent opacity-50'}`}>
            Available Pool ({poolOrders.length})
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center text-sm font-bold opacity-50 py-10 animate-pulse">SYNCING DISPATCH...</div>
        ) : displayOrders.length === 0 ? (
          <div className="text-center py-20">
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-indigo-100 text-indigo-400'}`}>
              {activeTab === 'pool' ? <Package size={32} /> : <CheckCircle2 size={32} />}
            </div>
            <h3 className="text-lg font-bold">{activeTab === 'pool' ? 'No unassigned orders.' : 'Route cleared!'}</h3>
          </div>
        ) : (
          displayOrders.map(order => {
            const displayAddress = order.delivery_address || order.address || order.customers?.address || 'No address details provided.';
            const displayPhone = order.contact_phone || order.phone || order.customers?.phone || null;

            return (
              <div key={order.id} className={`p-5 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-sm font-bold font-mono">{order.order_id_string}</h3>
                    <p className={`text-lg font-black mt-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatCurrency(order.total_amount, 'USD')}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${!order.assigned_driver_id ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'}`}>
                    {!order.assigned_driver_id ? 'Needs Driver' : (order.delivery_state || 'assigned').replace('_', ' ')}
                  </div>
                </div>
                
                <div className="space-y-3 mb-6 border-t border-b py-4 my-4 dark:border-slate-800 border-slate-100">
                  <div className="flex items-start gap-3 text-sm font-medium">
                    <div className={`p-2 rounded-lg mt-0.5 flex-shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><MapPin size={16} /></div>
                    <div>
                      <span className="font-black block text-base">{order.customers?.name || 'Unknown Recipient'}</span>
                      <span className="text-xs mt-1 block opacity-70 leading-relaxed">{displayAddress}</span>
                    </div>
                  </div>

                  {displayPhone && (
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><Phone size={16} /></div>
                      <a href={`tel:${displayPhone}`} className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline text-sm tracking-wide">
                        {displayPhone}
                      </a>
                    </div>
                  )}
                </div>

                {!order.assigned_driver_id ? (
                  <button onClick={() => claimOrder(order.id)} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl flex justify-center items-center gap-2 active:scale-95 transition-transform text-sm">
                    <HandGrab size={16} /> Claim Route
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="relative w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`absolute top-0 left-0 h-full bg-indigo-500 transition-all duration-500 ${order.delivery_state === 'assigned' || !order.delivery_state ? 'w-1/3' : order.delivery_state === 'picked_up' ? 'w-2/3' : 'w-full'}`}></div>
                    </div>

                    {(order.delivery_state === 'assigned' || !order.delivery_state) && (
                      <button onClick={() => advanceProgress(order.id, 'picked_up')} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl flex justify-center items-center gap-2 text-sm border dark:border-slate-700">
                        <Package size={16} /> Mark as Picked Up
                      </button>
                    )}
                    {order.delivery_state === 'picked_up' && (
                      <button onClick={() => advanceProgress(order.id, 'arrived')} className="w-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-bold py-3 rounded-xl flex justify-center items-center gap-2 text-sm">
                        <Navigation size={16} /> Mark as Arrived
                      </button>
                    )}
                    {order.delivery_state === 'arrived' && (
                      <button onClick={() => setActiveDelivery(order)} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 text-sm shadow-lg shadow-indigo-500/30">
                        <CheckCircle2 size={16} /> Complete Delivery
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>

      {/* CONFIRMATION WIDGET */}
      {activeDelivery && (
        <div className={`fixed inset-0 z-50 flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <div className={`pt-12 pb-4 px-6 flex justify-between items-center border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h2 className="text-lg font-bold flex items-center gap-2"><Truck className="text-indigo-500" /> Complete Order</h2>
            <button onClick={() => setActiveDelivery(null)} className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}><X size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-black font-mono">{activeDelivery.order_id_string}</h3>
              <p className="text-base font-bold mt-1">{activeDelivery.customers?.name}</p>
              <div className={`inline-block mt-4 px-6 py-2 rounded-xl text-xl font-black ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                Collect: {formatCurrency(activeDelivery.total_amount, 'USD')}
              </div>
            </div>
            <form onSubmit={submitDelivery} className="space-y-6">
              <div className="p-5 rounded-2xl border dark:bg-slate-900 dark:border-slate-800 bg-white border-slate-200">
                <label className="flex items-center gap-2 text-sm font-bold mb-3 text-slate-500"><Receipt size={16} /> Payment Status</label>
                <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="w-full px-4 py-4 rounded-xl text-base font-semibold border dark:bg-slate-950 dark:border-slate-700 bg-slate-50 border-slate-200">
                  <option value="Cash Received">Cash Received (COD)</option>
                  <option value="Already Paid (Online)">Already Paid Online</option>
                  <option value="Transferred on Delivery">Bank Transfer</option>
                  <option value="Pending">Payment Failed</option>
                </select>
              </div>
              <div className="p-5 rounded-2xl border dark:bg-slate-900 dark:border-slate-800 bg-white border-slate-200">
                <label className="flex items-center gap-2 text-sm font-bold mb-3 text-slate-500"><Camera size={16} /> Photo Evidence</label>
                <label className={`w-full flex flex-col items-center justify-center py-10 border-2 border-dashed rounded-xl cursor-pointer ${evidenceFile ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'dark:border-slate-700 dark:bg-slate-950 text-slate-400 border-slate-300 bg-slate-50'}`}>
                  <Camera size={36} className="mb-3" />
                  <span className="text-base font-bold">{evidenceFile ? 'Photo Captured!' : 'Tap to Open Camera'}</span>
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files && setEvidenceFile(e.target.files[0])} className="hidden" />
                </label>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white font-black text-lg py-5 rounded-2xl disabled:opacity-50">
                {isSubmitting ? 'Uploading Data...' : 'Confirm Delivery'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}