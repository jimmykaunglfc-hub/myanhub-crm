"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Clock, Package, Truck, CheckCircle2, Trash2, Calendar, 
  Camera, Receipt, X, Image as ImageIcon 
} from 'lucide-react';

interface Order {
  id: string;
  order_id_string: string;
  total_amount: number;
  status: 'pending' | 'processing' | 'in_transit' | 'fulfilled';
  payment_status: string; // NEW
  delivery_evidence_url: string | null; // NEW
  created_at: string;
  customer_id: string;
  customers: { name: string } | null;
}

const COLUMNS = [
  { id: 'pending', title: 'PENDING', icon: <Clock size={16} className="text-amber-500" />, bg: 'bg-amber-500', border: 'border-amber-500' },
  { id: 'processing', title: 'PROCESSING', icon: <Package size={16} className="text-indigo-500" />, bg: 'bg-indigo-500', border: 'border-indigo-500' },
  { id: 'in_transit', title: 'IN TRANSIT', icon: <Truck size={16} className="text-blue-500" />, bg: 'bg-blue-500', border: 'border-blue-500' },
  { id: 'fulfilled', title: 'DELIVERED', icon: <CheckCircle2 size={16} className="text-emerald-500" />, bg: 'bg-emerald-500', border: 'border-emerald-500' },
];

export default function OrdersPipeline() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  
  const [userId, setUserId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Delivery Modal States
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [activeDeliveryOrderId, setActiveDeliveryOrderId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState('Pending');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        router.replace('/login');
        return;
      }
      setUserId(session.user.id);
    };
    checkSession();
  }, [router]);

  const fetchOrders = async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('orders')
      .select('*, customers(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) setOrders(data as Order[]);
    setLoading(false);
  };

  useEffect(() => { if (userId) fetchOrders(); }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel('live-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData('orderId', orderId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData('orderId');
    if (!orderId) return;

    // INTERCEPT: If dropping into 'fulfilled/delivered', open the camera modal!
    if (newStatus === 'fulfilled') {
      setActiveDeliveryOrderId(orderId);
      setDeliveryModalOpen(true);
      return; 
    }

    // Otherwise, move normally (Pending -> Processing -> Transit)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o));
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
  };

  // NEW: The Delivery Submission Engine (Handles Photo Uploads)
  const submitDeliveryConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDeliveryOrderId) return;
    setIsSubmittingDelivery(true);

    try {
      let uploadedUrl = null;

      // 1. Upload photo to Supabase Storage if driver attached one
      if (evidenceFile) {
        const fileExt = evidenceFile.name.split('.').pop();
        const fileName = `delivery-${activeDeliveryOrderId}-${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('delivery_evidence')
          .upload(fileName, evidenceFile);
          
        if (uploadError) throw uploadError;

        // Get the public URL of the uploaded image
        const { data: { publicUrl } } = supabase.storage
          .from('delivery_evidence')
          .getPublicUrl(fileName);
          
        uploadedUrl = publicUrl;
      }

      // 2. Update the Order Database Record
      const { error: dbError } = await supabase.from('orders').update({ 
        status: 'fulfilled',
        payment_status: paymentStatus,
        delivery_evidence_url: uploadedUrl
      }).eq('id', activeDeliveryOrderId);

      if (dbError) throw dbError;

      // Close modal and refresh
      setDeliveryModalOpen(false);
      setEvidenceFile(null);
      setPaymentStatus('Pending');
      fetchOrders();

    } catch (error: any) {
      alert(`Delivery confirmation failed: ${error.message}`);
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel and delete this order?")) return;
    await supabase.from('orders').delete().eq('id', orderId);
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  if (!userId) return <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}></div>;

  return (
    <div className={`flex font-sans min-h-screen transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative h-screen overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-hidden flex flex-col mt-16 p-6 md:p-8">
          <div className="mb-6 flex-shrink-0">
            <h2 className="text-2xl font-bold tracking-tight">Dispatch & Order Pipeline</h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Drag orders to 'Delivered' to capture signature, photo evidence, and payment status.
            </p>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center font-mono text-sm animate-pulse text-indigo-500">
              LOADING PIPELINE DATA...
            </div>
          ) : (
            <div className="flex-1 flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
              {COLUMNS.map(column => {
                const columnOrders = orders.filter(o => o.status === column.id);
                return (
                  <div 
                    key={column.id}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, column.id)}
                    className={`flex flex-col w-80 flex-shrink-0 rounded-2xl border transition-colors ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-100/50 border-slate-200'}`}
                  >
                    <div className={`p-4 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                      <div className="flex items-center gap-2">
                        {column.icon}
                        <h3 className="text-xs font-black uppercase tracking-wider">{column.title}</h3>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
                        {columnOrders.length}
                      </span>
                    </div>

                    <div className="flex-1 p-3 overflow-y-auto space-y-3">
                      {columnOrders.map(order => (
                        <div
                          key={order.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, order.id)}
                          className={`p-4 rounded-xl border shadow-sm cursor-grab active:cursor-grabbing transition-all hover:-translate-y-0.5 ${isDarkMode ? 'bg-slate-950 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="text-sm font-bold font-mono">{order.order_id_string}</div>
                            <div className={`text-sm font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                              ${Number(order.total_amount).toFixed(2)}
                            </div>
                          </div>
                          
                          <div className="space-y-1.5 mb-4">
                            <div className="flex items-center gap-2 text-xs">
                              <span className={`w-5 h-5 rounded flex items-center justify-center font-bold uppercase text-[10px] ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700'}`}>
                                {order.customers?.name?.charAt(0) || '?'}
                              </span>
                              <span className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                {order.customers?.name || 'Unknown Buyer'}
                              </span>
                            </div>
                            <div className={`flex items-center gap-1.5 text-[10px] font-mono ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              <Calendar size={12} /> {new Date(order.created_at).toLocaleDateString()}
                            </div>
                          </div>

                          {/* Render Delivery Tags if Delivered */}
                          {order.status === 'fulfilled' && (
                            <div className="mb-4 space-y-2">
                              <div className={`flex items-center gap-2 text-[10px] font-bold uppercase px-2 py-1 rounded border ${order.payment_status === 'Pending' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                                <Receipt size={12} /> Payment: {order.payment_status}
                              </div>
                              {order.delivery_evidence_url && (
                                <a href={order.delivery_evidence_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[10px] font-bold uppercase px-2 py-1 rounded border bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                                  <ImageIcon size={12} /> View Delivery Photo
                                </a>
                              )}
                            </div>
                          )}

                          <div className={`pt-3 flex items-center justify-between border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${isDarkMode ? `bg-slate-900 ${column.border} text-slate-300` : `bg-slate-50 ${column.border} text-slate-600`}`}>
                              {column.title}
                            </span>
                            <button onClick={() => handleDeleteOrder(order.id)} className={`p-1 rounded transition-colors ${isDarkMode ? 'text-slate-500 hover:text-rose-400 hover:bg-slate-800' : 'text-slate-400 hover:text-rose-500 hover:bg-slate-100'}`} title="Delete Order">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {columnOrders.length === 0 && (
                        <div className={`h-24 flex items-center justify-center text-xs border-2 border-dashed rounded-xl ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-200 text-slate-400'}`}>
                          Drop orders here
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DELIVERY CONFIRMATION MODAL */}
        {deliveryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-md p-6 rounded-2xl shadow-xl ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2"><Truck className="text-indigo-500" /> Delivery Confirmation</h3>
                <button onClick={() => setDeliveryModalOpen(false)} className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><X size={20} /></button>
              </div>

              <form onSubmit={submitDeliveryConfirmation} className="space-y-5">
                
                {/* Payment Status Dropdown */}
                <div>
                  <label className={`block text-xs font-bold uppercase mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Payment Status</label>
                  <select 
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className={`w-full px-4 py-3 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition border appearance-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                  >
                    <option value="Already Paid (Online)">Already Paid (Online)</option>
                    <option value="Cash Received">Cash Received (COD)</option>
                    <option value="Transferred on Delivery">Transferred on Delivery</option>
                    <option value="Pending">Payment Pending (Failed)</option>
                  </select>
                </div>

                {/* Mobile-Optimized Camera/File Upload */}
                <div>
                  <label className={`block text-xs font-bold uppercase mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Proof of Delivery (Optional)</label>
                  <label className={`w-full flex flex-col items-center justify-center py-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${evidenceFile ? (isDarkMode ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-emerald-500 bg-emerald-50 text-emerald-600') : (isDarkMode ? 'border-slate-700 hover:border-indigo-500/50 bg-slate-950 hover:bg-slate-900 text-slate-400' : 'border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-slate-100 text-slate-500')}`}>
                    <Camera size={28} className="mb-2" />
                    <span className="text-sm font-bold">{evidenceFile ? 'Photo Attached!' : 'Tap to open Camera / Upload'}</span>
                    {/* The capture="environment" tag tells mobile phones to open the rear camera! */}
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      onChange={(e) => e.target.files && setEvidenceFile(e.target.files[0])} 
                      className="hidden" 
                    />
                  </label>
                </div>

                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setDeliveryModalOpen(false)} className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold border transition ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'}`}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmittingDelivery} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-6 py-3 rounded-lg transition-all shadow-md disabled:opacity-50">
                    {isSubmittingDelivery ? 'Uploading...' : 'Confirm Delivery'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}