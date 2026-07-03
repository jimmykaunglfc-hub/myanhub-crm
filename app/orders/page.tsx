"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Clock, Package, Truck, CheckCircle2, MoreVertical, Trash2, Calendar 
} from 'lucide-react';

interface Order {
  id: string;
  order_id_string: string;
  total_amount: number;
  status: 'pending' | 'processing' | 'in_transit' | 'fulfilled';
  created_at: string;
  customer_id: string;
  customers: { name: string } | null;
}

const COLUMNS = [
  { id: 'pending', title: 'PENDING', icon: <Clock size={16} className="text-amber-500" />, bg: 'bg-amber-500', border: 'border-amber-500' },
  { id: 'processing', title: 'PROCESSING', icon: <Package size={16} className="text-indigo-500" />, bg: 'bg-indigo-500', border: 'border-indigo-500' },
  { id: 'in_transit', title: 'IN TRANSIT', icon: <Truck size={16} className="text-blue-500" />, bg: 'bg-blue-500', border: 'border-blue-500' },
  { id: 'fulfilled', title: 'FULFILLED', icon: <CheckCircle2 size={16} className="text-emerald-500" />, bg: 'bg-emerald-500', border: 'border-emerald-500' },
];

export default function OrdersPipeline() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  
  const [userId, setUserId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Auth Guard
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

  // 2. Fetch Live Orders
  const fetchOrders = async () => {
    if (!userId) return;
    
    const { data, error } = await supabase
      .from('orders')
      .select('*, customers(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Order fetch error:", error);
    } else if (data) {
      setOrders(data as Order[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (userId) fetchOrders();
  }, [userId]);

  // 3. Real-Time Sync
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('live-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // 4. Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData('orderId', orderId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Required to allow dropping
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData('orderId');
    if (!orderId) return;

    // Optimistic UI Update: Move it instantly on the screen
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o));

    // Background Database Update
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert(`Status update failed: ${error.message}`);
      fetchOrders(); // Revert if failed
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel and delete this order?")) return;
    
    // Note: In a full ERP, you might want to return stock to inventory here!
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) {
      alert(`Delete error: ${error.message}`);
    } else {
      setOrders(prev => prev.filter(o => o.id !== orderId));
    }
  };

  if (!userId) {
    return <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}></div>;
  }

  return (
    <div className={`flex font-sans min-h-screen transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative h-screen overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-hidden flex flex-col mt-16 p-6 md:p-8">
          
          <div className="mb-6 flex-shrink-0">
            <h2 className="text-2xl font-bold tracking-tight">Order Fulfillment Pipeline</h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Drag and drop incoming deals to advance their fulfillment state.
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
                    {/* Column Header */}
                    <div className={`p-4 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                      <div className="flex items-center gap-2">
                        {column.icon}
                        <h3 className="text-xs font-black uppercase tracking-wider">{column.title}</h3>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
                        {columnOrders.length}
                      </span>
                    </div>

                    {/* Draggable Cards Container */}
                    <div className="flex-1 p-3 overflow-y-auto space-y-3">
                      {columnOrders.map(order => (
                        <div
                          key={order.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, order.id)}
                          className={`p-4 rounded-xl border shadow-sm cursor-grab active:cursor-grabbing transition-all hover:-translate-y-0.5 ${isDarkMode ? 'bg-slate-950 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className={`text-sm font-bold font-mono ${order.status === 'fulfilled' && !isDarkMode ? 'line-through text-slate-400' : ''}`}>
                              {order.order_id_string}
                            </div>
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
                              <Calendar size={12} />
                              {new Date(order.created_at).toLocaleDateString()}
                            </div>
                          </div>

                          <div className={`pt-3 flex items-center justify-between border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${isDarkMode ? `bg-slate-900 ${column.border} text-slate-300` : `bg-slate-50 ${column.border} text-slate-600`}`}>
                              {column.title}
                            </span>
                            
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDeleteOrder(order.id)} className={`p-1 rounded transition-colors ${isDarkMode ? 'text-slate-500 hover:text-rose-400 hover:bg-slate-800' : 'text-slate-400 hover:text-rose-500 hover:bg-slate-100'}`} title="Delete Order">
                                <Trash2 size={14} />
                              </button>
                            </div>
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
      </main>
    </div>
  );
}