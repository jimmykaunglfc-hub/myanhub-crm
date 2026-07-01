"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { ShoppingBag, Play, Clock, Package, Truck, CheckCircle, ArrowRight, UserCheck, RefreshCw } from 'lucide-react';

interface Order { id: string; order_id_string: string; total_amount: number; status: 'pending' | 'processing' | 'shipped' | 'delivered'; created_at: string; customers: { name: string; platform: string } | null; }

export default function EnhancedOrdersWorkspace() {
  const { isDarkMode } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulationStatus, setSimulationStatus] = useState('');

  const syncOrderMatrixLogs = async () => {
    const { data } = await supabase.from('orders').select('id, order_id_string, total_amount, status, created_at, customers(name, platform)').order('created_at', { ascending: false });
    if (data) setOrders(data as unknown as Order[]);
    setLoading(false);
  };

  useEffect(() => {
    syncOrderMatrixLogs();
    const channel = supabase.channel('orders-realtime-layer').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, syncOrderMatrixLogs).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const triggerInboundCustomerOrderSimulation = async () => {
    setSimulationStatus('Intercepting inbound bot data checkout event...');
    const { data: customer } = await supabase.from('customers').select('id').limit(1).single();
    if (!customer) { setSimulationStatus('Error: Populate customer entities inside database first!'); return; }
    const mockIdString = `MH-${Math.floor(1000 + Math.random() * 9000)}`;
    const randomAmount = parseFloat((25 + Math.random() * 150).toFixed(2));
    const { error } = await supabase.from('orders').insert({ customer_id: customer.id, order_id_string: mockIdString, total_amount: randomAmount, status: 'pending' });
    if (error) setSimulationStatus(`Error: ${error.message}`);
    else { setSimulationStatus(`Order ${mockIdString} submitted!`); setTimeout(() => setSimulationStatus(''), 4000); syncOrderMatrixLogs(); }
  };

  const advanceOrderStatusState = async (orderId: string, currentStatus: Order['status']) => {
    let nextStatus: Order['status'] = 'pending';
    if (currentStatus === 'pending') nextStatus = 'processing';
    else if (currentStatus === 'processing') nextStatus = 'shipped';
    else if (currentStatus === 'shipped') nextStatus = 'delivered';
    else return;
    await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId);
    syncOrderMatrixLogs();
  };

  const getOrdersByStatus = (status: Order['status']) => orders.filter(o => o.status === status);

  return (
    <div className={`min-h-screen flex font-sans h-screen overflow-hidden transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative h-full overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-y-auto mt-16 p-6 md:p-8 space-y-6 h-full">
          <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b pb-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <div>
              <h2 className="text-2xl font-black flex items-center gap-2"><ShoppingBag className="text-indigo-600" size={24} /> Interactive Order Flow</h2>
              <p className="text-slate-500 text-xs mt-1">Simulate inbound buyer actions and advance order states.</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <button onClick={triggerInboundCustomerOrderSimulation} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-md"><Play size={14} fill="currentColor" /> Simulate Inbound Checkout</button>
              <button onClick={syncOrderMatrixLogs} className={`p-2.5 border rounded-lg transition ${isDarkMode ? 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-400' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500'}`}><RefreshCw size={14} /></button>
            </div>
          </div>

          {simulationStatus && (
            <div className={`p-3.5 text-xs font-semibold rounded-xl animate-fade-in flex items-center gap-2 border ${isDarkMode ? 'bg-indigo-950/40 text-indigo-400 border-indigo-900' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
              <span className="w-2 h-2 bg-indigo-600 rounded-full animate-ping flex-shrink-0" /> {simulationStatus}
            </div>
          )}

          {loading ? (
            <div className="text-center p-12 font-mono text-slate-500 animate-pulse">COMPILING DATA PIPELINES...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-[calc(100vh-14rem)] overflow-hidden pb-4">
              
              {/* STAGE 1 */}
              <div className={`rounded-xl p-4 flex flex-col h-full border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200/60'}`}>
                <div className="flex justify-between items-center mb-3"><span className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5"><Clock size={14} className="text-amber-500" /> Pending</span><span className={`font-bold text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>{getOrdersByStatus('pending').length}</span></div>
                <div className="space-y-3 overflow-y-auto flex-1">
                  {getOrdersByStatus('pending').map(order => (
                    <div key={order.id} className={`p-4 rounded-xl border shadow-sm space-y-3 transition ${isDarkMode ? 'bg-slate-950 border-slate-800 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex justify-between items-baseline"><span className="font-mono text-xs font-bold text-indigo-500">{order.order_id_string}</span><span className="text-xs font-black">${Number(order.total_amount).toFixed(2)}</span></div>
                      <div className="text-xs"><p className="font-bold">{order.customers?.name || "Generic Lead"}</p><p className="text-[10px] text-slate-500 mt-0.5 uppercase">Source: {order.customers?.platform}</p></div>
                      <button onClick={() => advanceOrderStatusState(order.id, 'pending')} className={`w-full text-white font-bold text-[10px] py-1.5 uppercase rounded flex items-center justify-center gap-1 transition-colors group ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-900 hover:bg-indigo-600'}`}>Process Order <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* STAGE 2 */}
              <div className={`rounded-xl p-4 flex flex-col h-full border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200/60'}`}>
                <div className="flex justify-between items-center mb-3"><span className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5"><Package size={14} className="text-indigo-500" /> Processing</span><span className={`font-bold text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>{getOrdersByStatus('processing').length}</span></div>
                <div className="space-y-3 overflow-y-auto flex-1">
                  {getOrdersByStatus('processing').map(order => (
                    <div key={order.id} className={`p-4 rounded-xl border shadow-sm space-y-3 transition ${isDarkMode ? 'bg-slate-950 border-slate-800 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex justify-between items-baseline"><span className="font-mono text-xs font-bold text-indigo-500">{order.order_id_string}</span><span className="text-xs font-black">${Number(order.total_amount).toFixed(2)}</span></div>
                      <div className="text-xs"><p className="font-bold">{order.customers?.name || "Generic Lead"}</p><p className="text-[10px] text-slate-500 mt-0.5 uppercase">Packed & Verified</p></div>
                      <button onClick={() => advanceOrderStatusState(order.id, 'processing')} className={`w-full text-white font-bold text-[10px] py-1.5 uppercase rounded flex items-center justify-center gap-1 transition-colors group ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-900 hover:bg-indigo-600'}`}>Hand off to Cargo <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* STAGE 3 */}
              <div className={`rounded-xl p-4 flex flex-col h-full border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200/60'}`}>
                <div className="flex justify-between items-center mb-3"><span className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5"><Truck size={14} className="text-sky-500" /> In Transit</span><span className={`font-bold text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>{getOrdersByStatus('shipped').length}</span></div>
                <div className="space-y-3 overflow-y-auto flex-1">
                  {getOrdersByStatus('shipped').map(order => (
                    <div key={order.id} className={`p-4 rounded-xl border shadow-sm space-y-3 transition ${isDarkMode ? 'bg-slate-950 border-slate-800 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex justify-between items-baseline"><span className="font-mono text-xs font-bold text-indigo-500">{order.order_id_string}</span><span className="text-xs font-black">${Number(order.total_amount).toFixed(2)}</span></div>
                      <div className="text-xs"><p className="font-bold">{order.customers?.name || "Generic Lead"}</p><p className="text-[10px] text-slate-500 mt-0.5 uppercase">Dispatched</p></div>
                      <button onClick={() => advanceOrderStatusState(order.id, 'shipped')} className={`w-full text-white font-bold text-[10px] py-1.5 uppercase rounded flex items-center justify-center gap-1 transition-colors group ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-900 hover:bg-emerald-600'}`}>Confirm Delivery <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* STAGE 4 */}
              <div className={`rounded-xl p-4 flex flex-col h-full border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200/60'}`}>
                <div className="flex justify-between items-center mb-3"><span className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-500" /> Fulfilled</span><span className={`font-bold text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>{getOrdersByStatus('delivered').length}</span></div>
                <div className="space-y-3 overflow-y-auto flex-1">
                  {getOrdersByStatus('delivered').map(order => (
                    <div key={order.id} className={`p-4 rounded-xl border shadow-sm space-y-2 opacity-85 ${isDarkMode ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-gradient-to-br from-white to-emerald-50/10 border-emerald-100'}`}>
                      <div className="flex justify-between items-baseline"><span className="font-mono text-xs font-bold text-slate-500 line-through">{order.order_id_string}</span><span className={`text-xs font-black ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>${Number(order.total_amount).toFixed(2)}</span></div>
                      <div className="text-xs flex items-center justify-between"><div><p className={`font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{order.customers?.name}</p><p className="text-[9px] text-emerald-500 font-bold uppercase mt-0.5">Paid</p></div><UserCheck size={14} className="text-emerald-500" /></div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}