"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useTheme } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { 
  TrendingUp, MessageSquare, ShoppingBag, Users, 
  ArrowRight, Clock, CheckCircle2 
} from 'lucide-react';

interface Order {
  id: string;
  order_id_string: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface Message {
  id: string;
  content: string;
  status: string;
  created_at: string;
  sender: string;
  customers: { name: string } | null;
}

export default function Dashboard() {
  const { isDarkMode } = useTheme();
  const router = useRouter(); 
  
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good day');

  // Metrics States
  const [salesToday, setSalesToday] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [newCustomersCount, setNewCustomersCount] = useState(0);

  // Preview Lists
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  // 1. STRICT AUTHENTICATION & ROLE GUARD
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        // CRITICAL FIX: If there is no user, kick them to the login screen!
        router.replace('/login');
        return;
      }
      
      // NEW: Check the user's role!
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      // If they are a driver, kick them to the mobile Driver App immediately
      if (profile?.role === 'driver') {
        router.replace('/driver');
        return;
      }
      
      // If they are Admin/Staff, let them in
      setUserId(session.user.id);
    };
    
    checkSession();
  }, [router]);

  // 2. Fetch Core Data (Isolated to this Tenant via RLS)
  const fetchDashboardData = async () => {
    if (!userId) return; // Prevent fetching if no user
    
    // Fetch Orders for metrics & list
    const { data: rawOrders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (rawOrders) {
      const orders = rawOrders as unknown as Order[];
      setRecentOrders(orders.slice(0, 5));
      
      const active = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
      setActiveOrdersCount(active);

      const todayString = new Date().toISOString().split('T')[0];
      const todaySalesSum = orders
        .filter(o => o.created_at.startsWith(todayString))
        .reduce((sum, current) => sum + Number(current.total_amount), 0);
      setSalesToday(todaySalesSum);
    }

    // Fetch Messages with Customer Names
    const { data: rawMessages } = await supabase
      .from('messages')
      .select('id, content, status, created_at, sender, customers(name)')
      .order('created_at', { ascending: false });

    if (rawMessages) {
      const messages = rawMessages as unknown as Message[];

      const unread = messages.filter(m => m.status === 'unread' && m.sender === 'customer').length;
      setUnreadCount(unread);
      
      const realMessages = messages.filter(m => !m.content.includes('[System Notification]'));
      setRecentMessages(realMessages.slice(0, 5));
    }

    // Fetch Total Customers
    const { count: custCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });
    
    if (custCount !== null) setNewCustomersCount(custCount);
    
    setLoading(false);
  };

  useEffect(() => {
    if (userId) {
      fetchDashboardData();
    }
  }, [userId]);

  // 3. Real-Time Subscription Engine
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('dashboard-metrics-layer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, fetchDashboardData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // If no user ID is set yet, show a blank screen to prevent flashing the dashboard UI before redirecting
  if (!userId) {
    return <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}></div>;
  }

  return (
    <div className={`flex font-sans min-h-screen transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative h-screen overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-y-auto mt-16 p-6 md:p-8 space-y-8">
          
          {/* Header */}
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold tracking-tight">{greeting}, Manager</h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Here is what's happening with your MyanHub workspace today.
            </p>
          </div>

          {/* Metric Cards Grid */}
          {loading ? (
            <div className="h-32 flex items-center justify-center text-indigo-500 animate-pulse text-sm font-mono tracking-widest">
              SYNCING METRICS...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Sales Card */}
              <div className={`p-6 rounded-2xl border shadow-sm transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex justify-between items-center mb-4">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Sales Today</span>
                  <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}><TrendingUp size={16} /></div>
                </div>
                <div className="text-3xl font-black">${salesToday.toFixed(2)}</div>
                <div className="text-xs text-emerald-500 font-medium mt-2 flex items-center gap-1">
                  Live calculation
                </div>
              </div>

              {/* Unread Messages Card */}
              <div className={`p-6 rounded-2xl shadow-md transition-colors ${unreadCount > 0 ? 'bg-indigo-600 text-white border-indigo-500' : (isDarkMode ? 'bg-slate-900 border-slate-800 border shadow-sm' : 'bg-white border-slate-200 border shadow-sm')}`}>
                <div className="flex justify-between items-center mb-4">
                  <span className={`text-xs font-bold uppercase tracking-wider ${unreadCount > 0 ? 'text-indigo-200' : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`}>Unread Messages</span>
                  <div className={`p-2 rounded-lg ${unreadCount > 0 ? 'bg-indigo-500/50 text-white' : (isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600')}`}><MessageSquare size={16} /></div>
                </div>
                <div className="text-3xl font-black">{unreadCount}</div>
                <div className={`text-xs font-medium mt-2 flex items-center gap-1 ${unreadCount > 0 ? 'text-indigo-200' : (isDarkMode ? 'text-slate-500' : 'text-slate-400')}`}>
                  {unreadCount > 0 ? 'Action required' : 'Inbox zero achieved'}
                </div>
              </div>

              {/* Active Orders Card */}
              <div className={`p-6 rounded-2xl border shadow-sm transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex justify-between items-center mb-4">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Active Orders</span>
                  <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}><ShoppingBag size={16} /></div>
                </div>
                <div className="text-3xl font-black">{activeOrdersCount}</div>
                <div className="text-xs text-amber-500 font-medium mt-2 flex items-center gap-1">
                  Pending fulfillment
                </div>
              </div>

              {/* New Customers Card */}
              <div className={`p-6 rounded-2xl border shadow-sm transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex justify-between items-center mb-4">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Customers</span>
                  <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}><Users size={16} /></div>
                </div>
                <div className="text-3xl font-black">{newCustomersCount}</div>
                <div className={`text-xs font-medium mt-2 flex items-center gap-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Saved in CRM directory
                </div>
              </div>
            </div>
          )}

          {/* Data Panels */}
          {!loading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8">
              
              {/* Inbox Preview Panel */}
              <div className={`rounded-2xl border shadow-sm overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className={`p-6 border-b flex justify-between items-center ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <h3 className="text-lg font-bold">Unified Inbox Preview</h3>
                  <Link href="/inbox" className="text-xs font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1 transition-colors">
                    View All <ArrowRight size={14} />
                  </Link>
                </div>
                
                <div className={`divide-y flex-1 overflow-y-auto ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                  {recentMessages.length === 0 ? (
                    <div className="p-8 text-center text-sm font-medium text-slate-500">No recent conversational traffic.</div>
                  ) : (
                    recentMessages.map((msg) => (
                      <div key={msg.id} className={`p-4 flex items-start gap-4 transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black uppercase text-sm border flex-shrink-0 ${isDarkMode ? 'bg-slate-950 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {msg.customers?.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className={`text-sm font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{msg.customers?.name || 'Unknown Lead'}</span>
                            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1"><Clock size={10} /> {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className={`text-xs truncate ${msg.status === 'unread' && msg.sender === 'customer' ? 'text-indigo-500 font-semibold' : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`}>
                            {msg.sender === 'Workspace Manager' ? `You: ${msg.content}` : msg.content}
                          </p>
                        </div>
                        {msg.status === 'unread' && msg.sender === 'customer' && (
                          <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full mt-1.5 shadow-sm ring-2 ring-indigo-500/30 animate-pulse flex-shrink-0" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Orders Preview Panel */}
              <div className={`rounded-2xl border shadow-sm overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className={`p-6 border-b flex justify-between items-center ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <h3 className="text-lg font-bold">Recent Orders</h3>
                  <button className="text-xs font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1 transition-colors">
                    Manage Orders <ArrowRight size={14} />
                  </button>
                </div>
                
                <div className={`divide-y flex-1 overflow-y-auto ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                  {recentOrders.length === 0 ? (
                    <div className="p-8 text-center text-sm font-medium text-slate-500">No orders logged in the fulfillment matrix yet.</div>
                  ) : (
                    recentOrders.map((order) => (
                      <div key={order.id} className={`p-4 flex justify-between items-center transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                            <CheckCircle2 size={20} />
                          </div>
                          <div>
                            <p className={`text-sm font-bold font-mono ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{order.order_id_string}</p>
                            <span className={`inline-block mt-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${order.status === 'pending' ? (isDarkMode ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-200') : (isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200')}`}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-indigo-500">${Number(order.total_amount).toFixed(2)}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-1">{new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}