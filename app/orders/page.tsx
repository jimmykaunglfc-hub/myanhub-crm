"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Clock, Package, Truck, CheckCircle2, Trash2, Calendar, 
  Receipt, Image as ImageIcon, UserCircle
} from 'lucide-react';

interface Order {
  id: string;
  order_id_string: string;
  total_amount: number;
  status: 'pending' | 'processing' | 'in_transit' | 'fulfilled';
  delivery_state: 'unassigned' | 'assigned' | 'picked_up' | 'arrived' | 'delivered';
  assigned_driver_id: string | null;
  payment_status: string;
  delivery_evidence_url: string | null;
  created_at: string;
  customer_id: string;
  customers: { name: string } | null;
}

interface Driver {
  id: string;
  full_name: string;
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
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

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

  const fetchDashboardData = async () => {
    if (!userId) return;
    
    // 1. Fetch Orders
    const { data: orderData } = await supabase
      .from('orders')
      .select('*, customers(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // 2. Fetch Drivers in this Workspace
    const { data: driverData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('workspace_id', userId)
      .eq('role', 'driver');

    if (orderData) setOrders(orderData as Order[]);
    if (driverData) setDrivers(driverData as Driver[]);
    setLoading(false);
  };

  useEffect(() => { if (userId) fetchDashboardData(); }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel('live-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchDashboardData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleDragStart = (e: React.DragEvent, orderId: string) => { e.dataTransfer.setData('orderId', orderId); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData('orderId');
    if (!orderId) return;

    // Prevent manually dragging to Delivered (must be done by driver app now)
    if (newStatus === 'fulfilled') {
      alert("Notice: Orders must be marked as Delivered by the Driver via the mobile app to ensure evidence capture.");
      return;
    }

    // If dropped into In Transit, ensure it resets to unassigned
    let updates: any = { status: newStatus };
    if (newStatus === 'in_transit') {
      updates.delivery_state = 'unassigned';
      updates.assigned_driver_id = null;
    }

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
    await supabase.from('orders').update(updates).eq('id', orderId);
  };

  const handleAssignDriver = async (orderId: string, driverId: string) => {
    await supabase.from('orders').update({ 
      assigned_driver_id: driverId,
      delivery_state: 'assigned'
    }).eq('id', orderId);
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
              Drag orders to 'In Transit' to open them to your driver pool for fulfillment.
            </p>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center font-mono text-sm animate-pulse text-indigo-500">LOADING PIPELINE DATA...</div>
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
                          draggable={column.id !== 'fulfilled'} // Can't drag out of fulfilled
                          onDragStart={(e) => handleDragStart(e, order.id)}
                          className={`p-4 rounded-xl border shadow-sm ${column.id !== 'fulfilled' ? 'cursor-grab active:cursor-grabbing hover:-translate-y-0.5' : ''} transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}
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

                          {/* IN TRANSIT DISPATCH CONTROLS */}
                          {column.id === 'in_transit' && (
                            <div className={`mb-4 p-2.5 rounded-lg border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                              {order.delivery_state === 'unassigned' ? (
                                <div>
                                  <label className="text-[10px] font-bold uppercase text-amber-500 mb-1 flex items-center gap-1"><UserCircle size={12}/> Needs Assignment</label>
                                  <select 
                                    value={order.assigned_driver_id || ""}
                                    onChange={(e) => handleAssignDriver(order.id, e.target.value)}
                                    className={`w-full text-xs p-1.5 rounded border focus:outline-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                                  >
                                    <option value="" disabled>-- Assign Driver --</option>
                                    {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                                  </select>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex justify-between items-center text-[10px] font-bold uppercase mb-1.5">
                                    <span className="text-indigo-500 flex items-center gap-1"><UserCircle size={12}/> {drivers.find(d => d.id === order.assigned_driver_id)?.full_name || 'Driver'}</span>
                                    <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{order.delivery_state.replace('_', ' ')}</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className={`h-full bg-indigo-500 transition-all duration-500 ${order.delivery_state === 'assigned' ? 'w-1/3' : order.delivery_state === 'picked_up' ? 'w-2/3' : 'w-full'}`}></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* DELIVERED PROOF */}
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}