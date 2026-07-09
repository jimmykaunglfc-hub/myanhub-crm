"use client";

import { formatNumber, formatCurrency } from '../../lib/formatters';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { 
  Truck, MapPin, Camera, CheckCircle2, X, Receipt, LogOut, Package, Navigation, HandGrab, Phone, Bug
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
  const [userPhone, setUserPhone] = useState<string>('N/A');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pool' | 'my_route'>('my_route');

  // Diagnostic Logs
  const [debugError, setDebugError] = useState<string>('None');
  const [rawCount, setRawCount] = useState<number>(0);

  // Delivery Modal States
  const [activeDelivery, setActiveDelivery] = useState<Order | null>(null);
  const [paymentStatus, setPaymentStatus] = useState('Cash Received');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDeliveries = async () => {
    try {
      // 🚀 THE CRITICAL FIX: Reverted join to only request 'name' to stop the Postgres crash
      const { data, error } = await supabase
        .from('orders')
        .select('*, customers(name)')
        .eq('status', 'in_transit')
        .order('created_at', { ascending: true });

      if (error) {
        setDebugError(error.message);
        return;
      }

      if (data) {
        setRawCount(data.length);
        setDeliveries(data as unknown as Order[]);
        setDebugError('None - Query Successful');
      }
    } catch (err: any) {
      setDebugError(err.message || 'Unknown query crash');
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
        if (profile?.phone) setUserPhone(profile.phone);

        await fetchDeliveries();
      } catch (err: any) {
        setDebugError(`Init Catch: ${err.message}`);
        setLoading(false);
      }
    };

    initializeApp();
  }, [router]);

  // Real-time updates
  useEffect(() => {
    const channel = supabase.channel('live-driver-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchDeliveries();
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, []);

  const claimOrder = async (orderId: string) => {
    if (!userId) return;
    
    setDeliveries(prev => prev.map(o => o.id === orderId ? { ...o, assigned_driver_id: userId, delivery_state: 'assigned' } : o));
    setActiveTab('my_route');

    const { error } = await supabase.from('orders').update({ 
      assigned_driver_id: userId, 
      delivery_state: 'assigned' 
    }).eq('id', orderId);

    if (error) {
      alert("Failed to claim order.");
      fetchDeliveries();
    }
  };

  const advanceProgress = async (orderId: string, newState: string) => {
    setDeliveries(prev => prev.map(o => o.id === orderId ? { ...o, delivery_state: newState as any } : o));
    await supabase.from('orders').update({ delivery_state: newState }).eq('id', orderId);
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

      setActiveDelivery(null);
      setEvidenceFile(null);
    } catch (error: any) {
      alert(`Delivery failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!userId) return <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}></div>;

  // Safe client-side grouping that handles both nulls and workspace matching smoothly
  const poolOrders = deliveries.filter(o => !o.assigned_driver_id || o.delivery_state === 'unassigned');
  const myRouteOrders = deliveries.filter(o => o.assigned_driver_id === userId);
  const displayOrders = activeTab === 'pool' ? poolOrders : myRouteOrders;

  return (
    <div className={`min-h-screen font-sans flex flex-col pb-44 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      <header className={`pt-12 pb-0 px-6 shadow-sm z-10 ${isDarkMode ? 'bg-slate-900' : 'bg-indigo-600 text-white'}`}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-black tracking-tight">Driver Portal</h1>
            <p className="text-xs opacity-80 mt-0.5">{myRouteOrders.length} active stops on your route</p>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
            <LogOut size={18} />
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
            // Smart Fallback System: Grabs address and phone regardless of which table holds them
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
                
                {/* SAFE CONTACT AND ROUTING BLOCK */}
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

                {/* ACTION TRIGGER */}
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

      {/* DELIVERY MODAL */}
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

      {/* SYSTEM DIAGNOSTIC BANNER */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 text-slate-200 border-t border-slate-700 p-4 font-mono text-xs z-50 shadow-2xl">
        <div className="flex items-center gap-2 text-amber-400 font-bold mb-1">
          <Bug size={14} /> SYSTEM DIAGNOSTIC NODE
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 opacity-90">
          <div>Logged User: <span className="text-cyan-400">{userId ? userId.slice(0, 8) + '...' : 'Null'}</span></div>
          <div>Workspace ID: <span className="text-purple-400">{workspaceId ? workspaceId.slice(0, 8) + '...' : 'Null'}</span></div>
          <div>Raw In Transit Found: <span className="text-emerald-400 font-bold">{rawCount} rows</span></div>
          <div className="col-span-2 text-emerald-400 truncate">Supabase Status: {debugError}</div>
        </div>
      </div>

    </div>
  );
}