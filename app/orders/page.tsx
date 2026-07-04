"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Clock, Package, Truck, CheckCircle2, Trash2, Calendar, 
  Receipt, Image as ImageIcon, UserCircle, Globe, Link as LinkIcon, X,
  Edit, Printer, FileText, MapPin, Phone
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
  contact_phone: string | null;
  delivery_address: string | null;
  internal_notes: string | null;
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

  // Photo Preview State
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // ORDER MANAGEMENT MODAL STATES
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);

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


  // -------------------------------------------------------------
  // NEW: AUTOMATED TRACKING NOTIFICATION ENGINE
  // -------------------------------------------------------------
  const sendOrderNotification = async (order: Order, newStatus: string) => {
    let notificationText = '';
    
    // Generate intelligent messages based on the stage
    if (newStatus === 'processing') {
      notificationText = `📦 Order Update: Great news! Your order ${order.order_id_string} is now being processed and packed by our team.`;
    } else if (newStatus === 'in_transit') {
      notificationText = `🚚 Order Update: Your order ${order.order_id_string} is currently in transit and heading your way!`;
    } else if (newStatus === 'fulfilled') {
      notificationText = `✅ Order Delivered: Your order ${order.order_id_string} has been successfully delivered. Thank you for shopping with us!`;
    }

    if (!notificationText || !userId) return;

    // 1. Log the automated action inside the CRM Unified Inbox
    await supabase.from('messages').insert({
      customer_id: order.customer_id,
      sender: 'Workspace Manager',
      content: `[System Notification] Auto-Ping: ${notificationText}`,
      status: 'read',
      user_id: userId
    });

    // 2. Push the actual message to the external social platform
    fetch('/api/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: order.customer_id, text: notificationText, userId })
    }).catch(err => console.error("Tracking notification failed to send.", err));
  };


  // -------------------------------------------------------------
  // DRAG & DROP LOGIC
  // -------------------------------------------------------------
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

    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    let updates: any = { status: newStatus };
    if (newStatus === 'in_transit') {
      updates.delivery_state = 'unassigned';
      updates.assigned_driver_id = null;
    }

    // Optimistic Update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
    await supabase.from('orders').update(updates).eq('id', orderId);

    // FIRE NOTIFICATION IF STAGE MOVED FORWARD
    if (targetOrder.status !== newStatus) {
      sendOrderNotification(targetOrder, newStatus);
    }
  };

  // DISPATCH CONTROLS
  const handleAssignInternalDriver = async (orderId: string, driverId: string) => {
    await supabase.from('orders').update({ assigned_driver_id: driverId, delivery_state: 'assigned', is_external_delivery: false }).eq('id', orderId);
  };

  const handleAssignExternalCourier = async (orderId: string) => {
    if (!courierName) return alert("Please enter a courier name (e.g. DHL).");
    await supabase.from('orders').update({ is_external_delivery: true, courier_name: courierName, tracking_url: trackingUrl, delivery_state: 'assigned' }).eq('id', orderId);
    setActiveExternalInput(null); setCourierName(''); setTrackingUrl('');
  };

  const markExternalDelivered = async (orderId: string) => {
    await supabase.from('orders').update({ status: 'fulfilled', delivery_state: 'delivered', payment_status: 'Already Paid (Online)' }).eq('id', orderId);
    
    // FIRE DELIVERY NOTIFICATION FOR EXTERNAL COURIERS
    const targetOrder = orders.find(o => o.id === orderId);
    if (targetOrder) {
      sendOrderNotification(targetOrder, 'fulfilled');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("CRITICAL: Are you sure you want to permanently delete this order?")) return;
    await supabase.from('orders').delete().eq('id', orderId);
    setOrders(prev => prev.filter(o => o.id !== orderId));
    setManageModalOpen(false); 
  };

  // OPEN MANAGE MODAL
  const openManageModal = (order: Order) => {
    setEditingOrder(order);
    setEditPhone(order.contact_phone || '');
    setEditAddress(order.delivery_address || '');
    setEditNotes(order.internal_notes || '');
    setManageModalOpen(true);
  };

  // SAVE ORDER DETAILS
  const handleSaveOrderDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    setEditSaving(true);

    const updates = { contact_phone: editPhone, delivery_address: editAddress, internal_notes: editNotes };
    setOrders(prev => prev.map(o => o.id === editingOrder.id ? { ...o, ...updates } : o));
    const { error } = await supabase.from('orders').update(updates).eq('id', editingOrder.id);
    
    setEditSaving(false);
    if (error) { alert(`Save failed: ${error.message}`); fetchDashboardData(); } 
    else { setManageModalOpen(false); }
  };

  // PRINT PACKING SLIP
  const handlePrintSlip = (order: Order) => {
    const printContent = `
      <html>
        <head>
          <title>Packing Slip - ${order.order_id_string}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #111; line-height: 1.6; }
            .header { border-bottom: 3px solid #000; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
            .header h1 { margin: 0; font-size: 32px; letter-spacing: -1px; }
            .header h2 { margin: 0; color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .box { border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
            .box h3 { margin-top: 0; font-size: 12px; color: #888; text-transform: uppercase; margin-bottom: 10px; }
            .data { font-size: 16px; font-weight: bold; margin: 0; }
            .notes-box { background: #f9f9f9; padding: 20px; border-left: 4px solid #000; margin-top: 30px; }
            .footer { margin-top: 60px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div><h2>Official Packing Slip</h2><h1>${order.order_id_string}</h1></div>
            <div style="text-align: right;"><h2>Date Generated</h2><p style="margin:0; font-weight:bold;">${new Date().toLocaleDateString()}</p></div>
          </div>
          <div class="grid">
            <div class="box">
              <h3>Deliver To</h3>
              <p class="data">${order.customers?.name || 'Customer'}</p>
              <p style="margin: 5px 0;">${order.delivery_address || 'No Address Provided'}</p>
              <p style="margin: 5px 0;">📞 ${order.contact_phone || 'No Phone Provided'}</p>
            </div>
            <div class="box">
              <h3>Order Details</h3>
              <p style="margin: 5px 0;"><strong>Status:</strong> <span style="text-transform: uppercase;">${order.status}</span></p>
              <p style="margin: 5px 0;"><strong>Payment Status:</strong> ${order.payment_status || 'Pending'}</p>
              <p style="margin: 5px 0;"><strong>Total Value:</strong> $${order.total_amount.toFixed(2)}</p>
            </div>
          </div>
          ${order.internal_notes ? `<div class="notes-box"><h3 style="margin-top:0; font-size: 12px; color: #888; text-transform: uppercase;">Internal Fulfillment Remarks</h3><p style="margin:0; font-weight:bold; white-space: pre-wrap;">${order.internal_notes}</p></div>` : ''}
          <div class="footer">Generated securely by MyanHub Logistics System.</div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=800,height=800');
    if (printWindow) {
      printWindow.document.write(printContent); printWindow.document.close(); printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
    }
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
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Manage internal fleet routing, external courier tracking, and waybill printing.</p>
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
                        <div key={order.id} draggable={column.id !== 'fulfilled'} onDragStart={(e) => handleDragStart(e, order.id)} className={`relative p-4 rounded-xl border shadow-sm ${column.id !== 'fulfilled' ? 'cursor-grab active:cursor-grabbing hover:-translate-y-0.5' : ''} transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
                          
                          <button 
                            onClick={() => openManageModal(order)}
                            className={`absolute top-3 right-3 p-1.5 rounded-lg transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-indigo-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:text-indigo-600 hover:bg-slate-200'}`}
                            title="Manage Order Details"
                          >
                            <Edit size={14} />
                          </button>

                          <div className="flex justify-between items-start mb-3 pr-8">
                            <div className="text-sm font-bold font-mono">{order.order_id_string}</div>
                          </div>
                          
                          <div className="space-y-1.5 mb-4">
                            <div className={`text-lg font-black ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>${Number(order.total_amount).toFixed(2)}</div>
                            <div className="flex items-center gap-2 text-xs mt-2">
                              <span className={`w-5 h-5 rounded flex items-center justify-center font-bold uppercase text-[10px] ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700'}`}>{order.customers?.name?.charAt(0) || '?'}</span>
                              <span className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{order.customers?.name || 'Unknown Buyer'}</span>
                            </div>
                            
                            {order.internal_notes && (
                              <div className={`mt-2 text-[10px] font-bold px-2 py-1 rounded flex items-start gap-1.5 ${isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                                <FileText size={12} className="flex-shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{order.internal_notes}</span>
                              </div>
                            )}
                          </div>

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

                          {order.status === 'fulfilled' && (
                            <div className="mb-4 space-y-2">
                              {order.payment_status && (
                                <div className={`flex items-center gap-2 text-[10px] font-bold uppercase px-2 py-1 rounded border ${order.payment_status === 'Pending' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                                  <Receipt size={12} /> Payment: {order.payment_status}
                                </div>
                              )}
                              {order.delivery_evidence_url && (
                                <button onClick={() => setPreviewPhotoUrl(order.delivery_evidence_url!)} className="w-full flex items-center justify-center gap-2 text-[10px] font-bold uppercase px-2 py-2 rounded border bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                                  <ImageIcon size={12} /> View Delivery Photo
                                </button>
                              )}
                            </div>
                          )}

                          <div className={`pt-3 flex items-center justify-between border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${isDarkMode ? `bg-slate-900 ${column.border} text-slate-300` : `bg-slate-50 ${column.border} text-slate-600`}`}>{column.title}</span>
                            <span className={`text-[9px] font-mono ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(order.created_at).toLocaleDateString()}</span>
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

        {/* MODAL: MANAGE & EDIT ORDER */}
        {manageModalOpen && editingOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setManageModalOpen(false)}>
            <div className={`w-full max-w-lg p-6 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2"><Edit size={20} className="text-indigo-500"/> Manage Order</h3>
                  <p className="text-sm font-mono mt-1 opacity-60">{editingOrder.order_id_string} • {editingOrder.customers?.name}</p>
                </div>
                <button onClick={() => setManageModalOpen(false)} className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar">
                <div className={`p-4 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-indigo-50 border-indigo-100'}`}>
                  <div>
                    <h4 className={`text-sm font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>Print Waybill</h4>
                    <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-indigo-300/70' : 'text-indigo-600/70'}`}>Generate a printable packing slip for the warehouse.</p>
                  </div>
                  <button onClick={() => handlePrintSlip(editingOrder)} className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                    <Printer size={14} /> Print Slip
                  </button>
                </div>

                <form id="editOrderForm" onSubmit={handleSaveOrderDetails} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase mb-1 opacity-60">Customer Phone</label>
                      <div className="relative">
                        <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                        <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} className={`w-full pl-9 pr-3 py-2.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} placeholder="09..." />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-1 opacity-60">Delivery Address</label>
                    <div className="relative">
                      <MapPin size={14} className="absolute left-3 top-3 opacity-40" />
                      <textarea rows={2} value={editAddress} onChange={e => setEditAddress(e.target.value)} className={`w-full pl-9 pr-3 py-2.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border resize-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} placeholder="Full street address..." />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-1 opacity-60 text-amber-500">Internal Remarks / Notes</label>
                    <textarea rows={3} value={editNotes} onChange={e => setEditNotes(e.target.value)} className={`w-full p-3 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/50 border resize-none ${isDarkMode ? 'bg-amber-950/10 border-amber-900/50 text-white' : 'bg-amber-50/50 border-amber-200 text-slate-900'}`} placeholder="e.g. Fragile, deliver after 5pm, missing payment..." />
                  </div>
                </form>
              </div>

              <div className="pt-6 mt-2 border-t flex justify-between items-center border-slate-200 dark:border-slate-800">
                <button onClick={() => handleDeleteOrder(editingOrder.id)} className="text-xs font-bold flex items-center gap-1.5 px-3 py-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors">
                  <Trash2 size={14} /> Cancel & Delete Order
                </button>
                <div className="flex gap-2">
                  <button onClick={() => setManageModalOpen(false)} className={`px-4 py-2.5 rounded-lg text-sm font-bold border transition ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'}`}>Close</button>
                  <button type="submit" form="editOrderForm" disabled={editSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-6 py-2.5 rounded-lg transition-all shadow-md disabled:opacity-50">
                    {editSaving ? 'Saving...' : 'Save Updates'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PHOTO VIEWER OVERLAY MODAL */}
        {previewPhotoUrl && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setPreviewPhotoUrl(null)}>
            <div className="relative max-w-3xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setPreviewPhotoUrl(null)} className="absolute -top-12 right-0 p-2 text-white hover:text-rose-400 transition-colors"><X size={28} /></button>
              <img src={previewPhotoUrl} alt="Proof of Delivery" className="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl" />
            </div>
          </div>
        )}

      </main>
    </div>
  );
}