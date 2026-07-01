"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  ShoppingBag, Play, Clock, Package, Truck, CheckCircle, 
  ArrowRight, UserCheck, TrendingUp, RefreshCw 
} from 'lucide-react';

interface Order {
  id: string;
  order_id_string: string;
  total_amount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  created_at: string;
  customers: { name: string; platform: string } | null;
}

export default function EnhancedOrdersWorkspace() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulationStatus, setSimulationStatus] = useState('');

  const syncOrderMatrixLogs = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_id_string, total_amount, status, created_at, customers(name, platform)')
      .order('created_at', { ascending: false });

    if (!error && data) setOrders(data as unknown as Order[]);
    setLoading(false);
  };

  useEffect(() => {
    syncOrderMatrixLogs();
    
    // Subscribe to database changes to maintain real-time updates across screens
    const channel = supabase
      .channel('orders-realtime-layer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        syncOrderMatrixLogs();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // SIMULATOR: Mimic a customer checking out from Facebook Messenger or Telegram chat triggers
  const triggerInboundCustomerOrderSimulation = async () => {
    setSimulationStatus('Intercepting inbound bot data checkout event...');
    
    // Grab a customer row reference to safely attach relational database properties
    const { data: customer } = await supabase.from('customers').select('id').limit(1).single();
    if (!customer) {
      setSimulationStatus('Error: Populate customer entities inside database first!');
      return;
    }

    const mockIdString = `MH-${Math.floor(1000 + Math.random() * 9000)}`;
    const randomAmount = parseFloat((25 + Math.random() * 150).toFixed(2));

    const { error } = await supabase.from('orders').insert({
      customer_id: customer.id,
      order_id_string: mockIdString,
      total_amount: randomAmount,
      status: 'pending'
    });

    if (error) {
      setSimulationStatus(`Snag encountered: ${error.message}`);
    } else {
      setSimulationStatus(`Success! Customer submitted order ${mockIdString} live via Bot Automation Gateway.`);
      setTimeout(() => setSimulationStatus(''), 4000);
      syncOrderMatrixLogs();
    }
  };

  // ADMIN ACTION: Progress the order lifecycle state through the pipeline
  const advanceOrderStatusState = async (orderId: string, currentStatus: Order['status']) => {
    let nextStatus: Order['status'] = 'pending';
    if (currentStatus === 'pending') nextStatus = 'processing';
    else if (currentStatus === 'processing') nextStatus = 'shipped';
    else if (currentStatus === 'shipped') nextStatus = 'delivered';
    else return; // already finished processing loops

    await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId);
    syncOrderMatrixLogs();
  };

  // Filter definitions grouping analytics structures safely
  const getOrdersByStatus = (status: Order['status']) => orders.filter(o => o.status === status);

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative h-full overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-y-auto mt-16 p-6 md:p-8 space-y-6 h-full">
          
          {/* Main Controls Header Block */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <ShoppingBag className="text-indigo-600" size={24} /> Interactive Order Workspace Flow
              </h2>
              <p className="text-slate-500 text-xs mt-1">Simulate inbound buyer actions and advance order states through your fulfillment pipeline.</p>
            </div>
            
            <div className="flex flex-wrap gap-2 items-center">
              <button 
                onClick={triggerInboundCustomerOrderSimulation}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-transform flex items-center gap-2 active:scale-95 shadow-md shadow-indigo-600/10"
              >
                <Play size={14} fill="currentColor" /> Simulate Inbound Customer Checkout
              </button>
              <button onClick={syncOrderMatrixLogs} className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg transition" title="Force Sync Database Matrix"><RefreshCw size={14} /></button>
            </div>
          </div>

          {/* SIMULATOR NOTIFICATION STATUS TOAST ALERT EXPANSION CONTAINER */}
          {simulationStatus && (
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-xl animate-fade-in flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-600 rounded-full animate-ping flex-shrink-0" />
              {simulationStatus}
            </div>
          )}

          {/* VISUAL KANBAN FLOW BOARD GRID MATRIX PANEL LAYOUT */}
          {loading ? (
            <div className="text-center p-12 font-mono text-slate-400 tracking-widest animate-pulse">COMPILING DATA PIPELINES...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start h-[calc(100vh-14rem)] overflow-hidden pb-4">
              
              {/* STAGE 1: INBOUND PENDING STACK CHANNEL ROW */}
              <div className="bg-slate-100 rounded-xl p-4 flex flex-col max-h-full border border-slate-200/60 overflow-hidden">
                <div className="flex justify-between items-center mb-3 px-1">
                  <span className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5"><Clock size={14} className="text-amber-500" /> Inbound Pending</span>
                  <span className="bg-slate-200 text-slate-700 font-bold text-xs px-2 py-0.5 rounded-full">{getOrdersByStatus('pending').length}</span>
                </div>
                
                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  {getOrdersByStatus('pending').map(order => (
                    <div key={order.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 hover:border-slate-300 transition">
                      <div className="flex justify-between items-baseline">
                        <span className="font-mono text-xs font-bold text-indigo-600">{order.order_id_string}</span>
                        <span className="text-xs font-black text-slate-900">${Number(order.total_amount).toFixed(2)}</span>
                      </div>
                      <div className="text-xs">
                        <p className="font-bold text-slate-800">{order.customers?.name || "Generic Lead"}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-semibold">Source: {order.customers?.platform || "Direct Checkout"}</p>
                      </div>
                      <button 
                        onClick={() => advanceOrderStatusState(order.id, 'pending')}
                        className="w-full bg-slate-900 hover:bg-indigo-600 text-white font-bold text-[10px] py-1.5 uppercase tracking-wider rounded-md flex items-center justify-center gap-1 transition-colors group"
                      >
                        Process Order <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* STAGE 2: PROCESSING / ASSEMBLY STACK CHANNEL ROW */}
              <div className="bg-slate-100 rounded-xl p-4 flex flex-col max-h-full border border-slate-200/60 overflow-hidden">
                <div className="flex justify-between items-center mb-3 px-1">
                  <span className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5"><Package size={14} className="text-indigo-500" /> Processing</span>
                  <span className="bg-slate-200 text-slate-700 font-bold text-xs px-2 py-0.5 rounded-full">{getOrdersByStatus('processing').length}</span>
                </div>
                
                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  {getOrdersByStatus('processing').map(order => (
                    <div key={order.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 hover:border-slate-300 transition">
                      <div className="flex justify-between items-baseline">
                        <span className="font-mono text-xs font-bold text-indigo-600">{order.order_id_string}</span>
                        <span className="text-xs font-black text-slate-900">${Number(order.total_amount).toFixed(2)}</span>
                      </div>
                      <div className="text-xs">
                        <p className="font-bold text-slate-800">{order.customers?.name || "Generic Lead"}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-semibold">Packed & Verified</p>
                      </div>
                      <button 
                        onClick={() => advanceOrderStatusState(order.id, 'processing')}
                        className="w-full bg-slate-900 hover:bg-indigo-600 text-white font-bold text-[10px] py-1.5 uppercase tracking-wider rounded-md flex items-center justify-center gap-1 transition-colors group"
                      >
                        Hand off to Cargo <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* STAGE 3: SHIPPED / IN TRANSIT ROW LINE LOGS ELEMENT */}
              <div className="bg-slate-100 rounded-xl p-4 flex flex-col max-h-full border border-slate-200/60 overflow-hidden">
                <div className="flex justify-between items-center mb-3 px-1">
                  <span className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5"><Truck size={14} className="text-sky-500" /> In Transit</span>
                  <span className="bg-slate-200 text-slate-700 font-bold text-xs px-2 py-0.5 rounded-full">{getOrdersByStatus('shipped').length}</span>
                </div>
                
                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  {getOrdersByStatus('shipped').map(order => (
                    <div key={order.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 hover:border-slate-300 transition">
                      <div className="flex justify-between items-baseline">
                        <span className="font-mono text-xs font-bold text-indigo-600">{order.order_id_string}</span>
                        <span className="text-xs font-black text-slate-900">${Number(order.total_amount).toFixed(2)}</span>
                      </div>
                      <div className="text-xs">
                        <p className="font-bold text-slate-800">{order.customers?.name || "Generic Lead"}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-semibold">Dispatched with Freight</p>
                      </div>
                      <button 
                        onClick={() => advanceOrderStatusState(order.id, 'shipped')}
                        className="w-full bg-slate-900 hover:bg-emerald-600 text-white font-bold text-[10px] py-1.5 uppercase tracking-wider rounded-md flex items-center justify-center gap-1 transition-colors group"
                      >
                        Confirm Delivery Completed <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* STAGE 4: FULFILLED / DELIVERED COMPLETE ARCHIVE CONTAINER */}
              <div className="bg-slate-100 rounded-xl p-4 flex flex-col max-h-full border border-slate-200/60 overflow-hidden">
                <div className="flex justify-between items-center mb-3 px-1">
                  <span className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-500" /> Fulfilled</span>
                  <span className="bg-slate-200 text-slate-700 font-bold text-xs px-2 py-0.5 rounded-full">{getOrdersByStatus('delivered').length}</span>
                </div>
                
                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  {getOrdersByStatus('delivered').map(order => (
                    <div key={order.id} className="bg-white p-4 rounded-xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/10 shadow-sm space-y-2 opacity-85">
                      <div className="flex justify-between items-baseline">
                        <span className="font-mono text-xs font-bold text-slate-400 line-through">{order.order_id_string}</span>
                        <span className="text-xs font-black text-slate-700">${Number(order.total_amount).toFixed(2)}</span>
                      </div>
                      <div className="text-xs flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-600">{order.customers?.name || "Generic Lead"}</p>
                          <p className="text-[9px] text-emerald-600 font-bold uppercase mt-0.5">Payment Captured</p>
                        </div>
                        <UserCheck size={14} className="text-emerald-500" />
                      </div>
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