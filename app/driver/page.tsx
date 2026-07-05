"use client";

import { formatNumber, formatCurrency } from '../../lib/formatters';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { 
  Truck, MapPin, Camera, CheckCircle2, X, Receipt, LogOut, Package, Navigation, HandGrab
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
  customer_id: string; // Added to enable notifications
  customers: { name: string } | null;
}

export default function DriverApp() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  
  const [userId, setUserId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pool' | 'my_route'>('my_route');

  // Delivery Modal States
  const [activeDelivery, setActiveDelivery] = useState<Order | null>(null);
  const [paymentStatus, setPaymentStatus] = useState('Cash Received');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        router.replace('/login');
        return;
      }
      setUserId(session.user.id);
      const { data: profile } = await supabase.from('profiles').select('workspace_id').eq('id', session.user.id).single();
      if (profile) setWorkspaceId(profile.workspace_id);
    };
    checkSession();
  }, [router]);

  const fetchDeliveries = async () => {
    if (!workspaceId) return;
    const { data, error } = await supabase
      .from('orders')
      .select('*, customers(name)')
      .eq('user_id', workspaceId)
      .eq('status', 'in_transit')
      .order('created_at', { ascending: true });

    if (!error && data) setDeliveries(data as Order[]);
    setLoading(false);
  };

  useEffect(() => { if (workspaceId) fetchDeliveries(); }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase.channel('live-driver-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchDeliveries(); // Re-fetch quietly when Admin assigns an order
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

  // -------------------------------------------------------------
  // AUTOMATED TRACKING NOTIFICATION ENGINE (Driver Side)
  // -------------------------------------------------------------
  const sendOrderNotification = async (order: Order, newStatus: string) => {
    if (!workspaceId) return; // Must use workspaceId to authenticate Telegram webhook

    let notificationText = '';
    
    if (newStatus === 'picked_up') {
      notificationText = `🚚 Order Update: Your order ${order.order_id_string} has been picked up by our driver and is on its way!`;
    } else if (newStatus === 'arrived') {
      notificationText = `📍 Driver Arrived: Our driver is at your location with order ${order.order_id_string}. Please be ready to receive it!`;
    } else if (newStatus === 'delivered') {
      notificationText = `✅ Order Delivered: Your order ${order.order_id_string} has been successfully delivered. Thank you!`;
    }

    if (!notificationText) return;

    // Log the automated action inside the CRM Unified Inbox
    await supabase.from('messages').insert({
      customer_id: order.customer_id,
      sender: 'Workspace Manager',
      content: `[System Notification] Auto-Ping (Driver App): ${notificationText}`,
      status: 'read',
      user_id: workspaceId 
    });

    // Push the actual message to Telegram
    fetch('/api/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: order.customer_id, text: notificationText, userId: workspaceId })
    }).catch(err => console.error("Tracking notification failed to send.", err));
  };

  // ACTION: Claim an order from the pool (INSTANT UI UPDATE)
  const claimOrder = async (orderId: string) => {
    if (!userId) return;
    
    // 1. Optimistic UI: Update screen instantly
    setDeliveries(prev => prev.map(o => o.id === orderId ? { ...o, assigned_driver_id: userId, delivery_state: 'assigned' } : o));
    setActiveTab('my_route');

    // 2. Background Sync
    const { error } = await supabase.from('orders').update({ 
      assigned_driver_id: userId, 
      delivery_state: 'assigned' 
    }).eq('id', orderId);

    if (error) {
      alert("Failed to claim order. Check connection.");
      fetchDeliveries(); // Revert screen if failed
    }
  };

  // ACTION: Advance the delivery progress bar (INSTANT UI UPDATE & NOTIFY)
  const advanceProgress = async (orderId: string, newState: string) => {
    // 1. Optimistic UI: Move progress bar instantly
    setDeliveries(prev => prev.map(o => o.id === orderId ? { ...o, delivery_state: newState as any } : o));

    // 2. Background Sync
    const { error } = await supabase.from('orders').update({ delivery_state: newState }).eq('id', orderId);
    
    if (error) {
      alert("Failed to update progress.");
      fetchDeliveries(); // Revert screen if failed
    } else {
      // 3. Trigger Notification based on new state
      const targetOrder = deliveries.find(o => o.id === orderId);
      if (targetOrder) {
        sendOrderNotification(targetOrder, newState);
      }
    }
  };

  // ACTION: Final Delivery Submit (NOTIFY)
  const submitDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDelivery) return;
    setIsSubmitting(true);

    try {
      let uploadedUrl = null;
      if (evidenceFile) {
        const fileExt = evidenceFile.name.split('.').pop();
        const fileName = `delivery-${activeDelivery.id}-${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('delivery_evidence').upload(fileName, evidenceFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('delivery_evidence').getPublicUrl(fileName);
        uploadedUrl = publicUrl;
      }

      // 1. Optimistic UI: Remove from list instantly
      setDeliveries(prev => prev.filter(o => o.id !== activeDelivery.id));

      // 2. Background Sync
      await supabase.from('orders').update({ 
        status: 'fulfilled',
        delivery_state: 'delivered',
        payment_status: paymentStatus,
        delivery_evidence_url: uploadedUrl
      }).eq('id', activeDelivery.id);

      // 3. Trigger Final Notification
      sendOrderNotification(activeDelivery, 'delivered');

      setActiveDelivery(null);
      setEvidenceFile(null);
    } catch (error: any) {
      alert(`Delivery failed: ${error.message}`);
      fetchDeliveries(); // Sync backup
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!userId) return <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}></div>;

  const poolOrders = deliveries.filter(o => o.delivery_state === 'unassigned');
  const myRouteOrders = deliveries.filter(o => o.assigned_driver_id === userId);

  const displayOrders = activeTab === 'pool' ? poolOrders : myRouteOrders;

  return (
    <div className={`min-h-screen font-sans flex flex-col ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      <header className={`pt-12 pb-0 px-6 shadow-sm z-10 ${isDarkMode ? 'bg-slate-900' : 'bg-indigo-600 text-white'}`}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-black tracking-tight">Driver Portal</h1>
            <p className="text-xs opacity-80 mt-0.5">{myRouteOrders.length} active stops on your route</p>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md active:scale-95 transition-transform">
            <LogOut size={18} />
          </button>
        </div>

        {/* Tabs */}
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
          displayOrders.map(order => (
            <div key={order.id} className={`p-5 rounded-2xl shadow-sm border transition-transform ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-sm font-bold font-mono">{order.order_id_string}</h3>
                  <p className={`text-lg font-black mt-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatCurrency(order.total_amount, 'USD')}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${activeTab === 'pool' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'}`}>
                  {activeTab === 'pool' ? 'Needs Driver' : order.delivery_state.replace('_', ' ')}
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-sm font-medium mb-6">
                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><MapPin size={16} /></div>
                {order.customers?.name || 'Unknown Customer'}
              </div>

              {/* ACTION AREA */}
              {activeTab === 'pool' ? (
                <button onClick={() => claimOrder(order.id)} className="w-full bg-slate-900 dark:bg-indigo-600 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 active:scale-95 transition-transform">
                  <HandGrab size={16} /> Claim Route
                </button>
              ) : (
                <div className="space-y-4">
                  {/* PROGRESS BAR */}
                  <div className="relative w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`absolute top-0 left-0 h-full bg-indigo-500 transition-all duration-500 ${order.delivery_state === 'assigned' ? 'w-1/3' : order.delivery_state === 'picked_up' ? 'w-2/3' : 'w-full'}`}></div>
                  </div>

                  {/* DYNAMIC PROGRESS BUTTONS */}
                  {order.delivery_state === 'assigned' && (
                    <button onClick={() => advanceProgress(order.id, 'picked_up')} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl flex justify-center items-center gap-2 active:scale-95 transition-transform border dark:border-slate-700">
                      <Package size={16} /> Mark as Picked Up
                    </button>
                  )}
                  {order.delivery_state === 'picked_up' && (
                    <button onClick={() => advanceProgress(order.id, 'arrived')} className="w-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-bold py-3 rounded-xl flex justify-center items-center gap-2 active:scale-95 transition-transform">
                      <Navigation size={16} /> Mark as Arrived
                    </button>
                  )}
                  {order.delivery_state === 'arrived' && (
                    <button onClick={() => setActiveDelivery(order)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 active:scale-95 transition-transform shadow-lg shadow-indigo-500/30">
                      <CheckCircle2 size={16} /> Complete Delivery
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </main>

      {/* Full Screen Delivery Confirmation Modal */}
      {activeDelivery && (
        <div className={`fixed inset-0 z-50 flex flex-col animate-slide-up ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <div className={`pt-12 pb-4 px-6 flex justify-between items-center border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h2 className="text-lg font-bold flex items-center gap-2"><Truck className="text-indigo-500" /> Complete Order</h2>
            <button onClick={() => setActiveDelivery(null)} className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}><X size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-black font-mono">{activeDelivery.order_id_string}</h3>
              <p className="text-sm font-medium opacity-60 mt-1">{activeDelivery.customers?.name}</p>
              <div className={`inline-block mt-4 px-6 py-2 rounded-xl text-xl font-black ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                Collect: {formatCurrency(activeDelivery.total_amount, 'USD')}
              </div>
            </div>
            <form onSubmit={submitDelivery} className="space-y-6">
              <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <label className="flex items-center gap-2 text-sm font-bold mb-3 uppercase tracking-wider text-slate-500"><Receipt size={16} /> Payment Status</label>
                <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className={`w-full px-4 py-4 rounded-xl text-base font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 border appearance-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>
                  <option value="Cash Received">Cash Received (COD)</option>
                  <option value="Already Paid (Online)">Already Paid Online</option>
                  <option value="Transferred on Delivery">Bank Transfer</option>
                  <option value="Pending">Payment Failed</option>
                </select>
              </div>
              <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <label className="flex items-center gap-2 text-sm font-bold mb-3 uppercase tracking-wider text-slate-500"><Camera size={16} /> Photo Evidence</label>
                <label className={`w-full flex flex-col items-center justify-center py-10 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${evidenceFile ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : (isDarkMode ? 'border-slate-700 bg-slate-950 text-slate-400' : 'border-slate-300 bg-slate-50 text-slate-500')}`}>
                  <Camera size={36} className="mb-3" />
                  <span className="text-base font-bold">{evidenceFile ? 'Photo Captured!' : 'Tap to Open Camera'}</span>
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files && setEvidenceFile(e.target.files[0])} className="hidden" />
                </label>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg py-5 rounded-2xl transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-50 active:scale-95">
                {isSubmitting ? 'Uploading Data...' : 'Confirm Delivery'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}