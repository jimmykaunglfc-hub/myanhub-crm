"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Clock, Package, Truck, CheckCircle2, Trash2, Calendar, 
  Receipt, Image as ImageIcon, UserCircle, Globe, Link as LinkIcon, X
} from 'lucide-react';

interface Order {
  id: string;
  order_id_string: string;
  total_amount: number;
  status: 'pending' | 'processing' | 'in_transit' | 'fulfilled';
  delivery_state: 'unassigned' | 'assigned' | 'picked_up' | 'arrived' | 'delivered';
  assigned_driver_id: string | null;
  payment_status: string | null;
  delivery_evidence_url: string | null;
  is_external_delivery: boolean;
  courier_name: string | null;
  tracking_url: string | null;
  created_at: string;
  customer_id: string;
  customers: { name: string } | null;
}

interface Driver { id: string; full_name: string; }

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
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  // External Courier Active States
  const [activeExternalInput, setActiveExternalInput] = useState<string | null>(null);
  const [courierName, setCourierName] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');

  // NEW: Photo Preview Modal State
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) { router.replace('/login'); return; }
      setUserId(session.user.id);
    };
    checkSession();
  }, [router]);

  const fetchDashboardData = async () => {
    if (!userId) return;
    const { data: orderData } = await supabase.from('orders').select('*, customers(name)').eq('user_id', userId).order('created_at', { ascending: false });
    const { data: driverData } = await supabase.from('profiles').select('id, full_name').eq('workspace_id', userId).eq('role', 'driver');

    if (orderData) setOrders(orderData as Order[]);
    if (driverData) setDrivers(driverData as Driver[]);
    setLoading(false);
  };

  useEffect(() => { if (userId) fetchDashboardData(); }, [userId]);
  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel('live-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchDashboardData).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleDragStart = (e: React.DragEvent, orderId: string) => { e.dataTransfer.setData('orderId', orderId); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData('orderId');
    if (!orderId) return;

    if (newStatus === 'fulfilled') {
      alert("Notice: Orders must be marked as Delivered by the internal Driver app, or manually updated if External.");
      return;
    }

    let updates: any = { status: newStatus };
    if (newStatus === 'in_transit') {
      updates.delivery_state = 'unassigned';
      updates.assigned_driver_id = null;
    }

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
    await supabase.from('orders').update(updates).eq('id', orderId);
  };

  const handleAssignInternalDriver = async (orderId: string, driverId: string) => {
    await supabase.from('orders').update({ 
      assigned_driver_id: driverId,
      delivery_state: 'assigned',
      is_external_delivery: false
    }).eq('id', orderId);
  };

  const handleAssignExternalCourier = async (orderId: string) => {
    if (!courierName) return alert("Please enter a courier name (e.g. DHL).");
    
    await supabase.from('orders').update({ 
      is_external_delivery: true,
      courier_name: courierName,
      tracking_url: trackingUrl,
      delivery_state: 'assigned'
    }).eq('id', orderId);

    setActiveExternalInput(null);
    setCourierName(''); setTrackingUrl('');
  };

  const markExternalDelivered = async (orderId: string) => {
    await supabase.from('orders').update({ status: 'fulfilled', delivery_state: 'delivered', payment_status: 'Already Paid (Online)' }).eq('id', orderId);
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
        <div className="flex-1 overflow-hidden flex flex-col mt-16 p-4 md:p-8">
          <div className="mb-6 flex-shrink-0">
            <h2 className="text-2xl font-bold tracking-tight">Dispatch & Order Pipeline</h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Manage internal fleet routing and external courier tracking.</p>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center font-mono text-sm animate-pulse text-indigo-500">LOADING PIPELINE...</div>
          ) : (
            <div className="flex-1 flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
              {COLUMNS.map(column => {
                const columnOrders = orders.filter(o => o.status === column.id);
                return (
                  <div key={column.id} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, column.id)} className={`flex flex-col w-80 flex-shrink-0 rounded-2xl border transition-colors ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-100/50 border-slate-200'}`}>
                    <div className={`p-4 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                      <div className="flex items-center gap-2">{column.icon}<h3 className="text-xs font-black uppercase tracking-wider">{column.title}</h3></div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>{columnOrders.length}</span>
                    </div>

                    <div className="flex-1 p-3 overflow-y-auto space-y-3">
                      {columnOrders.map(order => (
                        <div key={order.id} draggable={column.id !== 'fulfilled'} onDragStart={(e) => handleDragStart(e, order.id)} className={`p-4 rounded-xl border shadow-sm ${column.id !== 'fulfilled' ? 'cursor-grab active:cursor-grabbing hover:-translate-y-0.5' : ''} transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
                          <div className="flex justify-between items-start mb-3">
                            <div className="text-sm font-bold font-mono">{order.order_id_string}</div>
                            <div className={`text-sm font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>${Number(order.total_amount).toFixed(2)}</div>
                          </div>
                          
                          <div className="space-y-1.5 mb-4">
                            <div className="flex items-center gap-2 text-xs">
                              <span className={`w-5 h-5 rounded flex items-center justify-center font-bold uppercase text-[10px] ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700'}`}>{order.customers?.name?.charAt(0) || '?'}</span>
                              <span className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{order.customers?.name || 'Unknown Buyer'}</span>
                            </div>
                          </div>

                          {/* IN TRANSIT DISPATCH CONTROLS */}
                          {column.id === 'in_transit' && (
                            <div className={`mb-4 p-3 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                              
                              {order.delivery_state === 'unassigned' && activeExternalInput !== order.id && (
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold uppercase text-amber-500 flex items-center gap-1"><UserCircle size={12}/> Internal Fleet</label>
                                  <select onChange={(e) => handleAssignInternalDriver(order.id, e.target.value)} className={`w-full text-xs p-2 rounded border focus:outline-none mb-2 ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-200'}`}>
                                    <option value="">-- Assign Driver --</option>
                                    {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                                  </select>
                                  
                                  <div className="relative flex py-1 items-center"><div className="flex-grow border-t border-slate-300 dark:border-slate-700"></div><span className="flex-shrink-0 mx-2 text-[10px] uppercase text-slate-400 font-bold">OR</span><div className="flex-grow border-t border-slate-300 dark:border-slate-700"></div></div>
                                  
                                  <button onClick={() => setActiveExternalInput(order.id)} className={`w-full text-xs font-bold p-2 rounded border border-dashed transition-colors flex items-center justify-center gap-1.5 ${isDarkMode ? 'border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10' : 'border-indigo-300 text-indigo-600 hover:bg-indigo-50'}`}>
                                    <Globe size={14}/> Use External Courier
                                  </button>
                                </div>
                              )}

                              {activeExternalInput === order.id && (
                                <div className="space-y-2 animate-fade-in">
                                  <input type="text" placeholder="Courier (e.g. FedEx)" value={courierName} onChange={e => setCourierName(e.target.value)} className={`w-full text-xs p-2 rounded border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-200'}`} />
                                  <input type="text" placeholder="Tracking # or URL" value={trackingUrl} onChange={e => setTrackingUrl(e.target.value)} className={`w-full text-xs p-2 rounded border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-200'}`} />
                                  <div className="flex gap-2 pt-1">
                                    <button onClick={() => setActiveExternalInput(null)} className={`flex-1 text-[10px] font-bold p-2 rounded border ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-600'}`}>Cancel</button>
                                    <button onClick={() => handleAssignExternalCourier(order.id)} className="flex-1 text-[10px] font-bold p-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">Save Tracking</button>
                                  </div>
                                </div>
                              )}

                              {order.delivery_state !== 'unassigned' && !order.is_external_delivery && (
                                <div>
                                  <div className="flex justify-between items-center text-[10px] font-bold uppercase mb-1.5"><span className="text-indigo-500 flex items-center gap-1"><UserCircle size={12}/> {drivers.find(d => d.id === order.assigned_driver_id)?.full_name || 'Driver'}</span><span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{order.delivery_state.replace('_', ' ')}</span></div>
                                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"><div className={`h-full bg-indigo-500 transition-all ${order.delivery_state === 'assigned' ? 'w-1/3' : order.delivery_state === 'picked_up' ? 'w-2/3' : 'w-full'}`}></div></div>
                                </div>
                              )}

                              {order.is_external_delivery && (
                                <div>
                                  <div className="flex justify-between items-center text-[10px] font-bold uppercase mb-2"><span className="text-emerald-500 flex items-center gap-1"><Globe size={12}/> {order.courier_name}</span></div>
                                  {order.tracking_url && (
                                    <a href={order.tracking_url.startsWith('http') ? order.tracking_url : `https://google.com/search?q=${order.tracking_url}`} target="_blank" rel="noreferrer" className={`text-xs font-mono font-medium flex items-center gap-1.5 p-2 rounded border transition-colors ${isDarkMode ? 'bg-slate-950 border-slate-700 text-blue-400 hover:border-blue-500/50' : 'bg-white border-slate-200 text-blue-600 hover:border-blue-300'}`}>
                                      <LinkIcon size={12}/> {order.tracking_url}
                                    </a>
                                  )}
                                  <button onClick={() => markExternalDelivered(order.id)} className="w-full mt-3 text-[10px] font-bold uppercase p-2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                                    Mark Delivered
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* DELIVERED PROOF (Now with Popup Modal Button) */}
                          {order.status === 'fulfilled' && (
                            <div className="mb-4 space-y-2">
                              {order.payment_status && (
                                <div className={`flex items-center gap-2 text-[10px] font-bold uppercase px-2 py-1 rounded border ${order.payment_status === 'Pending' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                                  <Receipt size={12} /> Payment: {order.payment_status}
                                </div>
                              )}
                              
                              {/* NEW: Button to trigger the Photo Modal */}
                              {order.delivery_evidence_url && (
                                <button 
                                  onClick={() => setPreviewPhotoUrl(order.delivery_evidence_url)}
                                  className="w-full flex items-center justify-center gap-2 text-[10px] font-bold uppercase px-2 py-2 rounded border bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                                >
                                  <ImageIcon size={12} /> View Delivery Photo
                                </button>
                              )}
                            </div>
                          )}

                          <div className={`pt-3 flex items-center justify-between border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${isDarkMode ? `bg-slate-900 ${column.border} text-slate-300` : `bg-slate-50 ${column.border} text-slate-600`}`}>{column.title}</span>
                            <button onClick={() => handleDeleteOrder(order.id)} className={`p-1 rounded transition-colors ${isDarkMode ? 'text-slate-500 hover:text-rose-400 hover:bg-slate-800' : 'text-slate-400 hover:text-rose-500'}`}><Trash2 size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PHOTO VIEWER OVERLAY MODAL */}
        {previewPhotoUrl && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={() => setPreviewPhotoUrl(null)} // Close when clicking the background
          >
            <div 
              className="relative max-w-3xl w-full flex flex-col items-center" 
              onClick={(e) => e.stopPropagation()} // Prevent clicking the image from closing it
            >
              <button 
                onClick={() => setPreviewPhotoUrl(null)} 
                className="absolute -top-12 right-0 p-2 text-white hover:text-rose-400 transition-colors"
              >
                <X size={28} />
              </button>
              
              <img 
                src={previewPhotoUrl} 
                alt="Proof of Delivery" 
                className="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl" 
              />
            </div>
          </div>
        )}

      </main>
    </div>
  );
}