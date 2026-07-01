"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { 
  ShieldCheck, Users, DollarSign, MessageSquare, 
  Plus, Layers, Activity, Server, TrendingUp, CheckCircle2,
  ShieldAlert, LogOut, Terminal, Radio
} from 'lucide-react';

interface ClientWorkspace {
  id: string;
  created_at: string;
  client_email: string;
  plan_tier: string;
  status: string;
}

interface PlatformOrder {
  id: string;
  order_id_string: string;
  total_amount: number;
  status: string;
  created_at: string;
  customers: { name: string; platform: string } | null;
}

// NEW: Interface for our telemetry logs
interface IntegrationLog {
  id: string;
  created_at: string;
  client_email: string;
  channel: string;
  status: string;
}

export default function SuperAdminDashboard() {
  const router = useRouter();
  
  // Security States
  const [authorized, setAuthorized] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  
  const MASTER_ADMIN_EMAIL = "jimmy@myanhub.com";

  // UI States
  const [activeTab, setActiveTab] = useState<'overview' | 'workspaces' | 'transactions'>('overview');
  const [loading, setLoading] = useState(true);
  
  // Data State Arrays
  const [workspaces, setWorkspaces] = useState<ClientWorkspace[]>([]);
  const [orders, setOrders] = useState<PlatformOrder[]>([]);
  const [integrationLogs, setIntegrationLogs] = useState<IntegrationLog[]>([]); // NEW: State for logs
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const [platformGmv, setPlatformGmv] = useState<number>(0);
  
  // Creation States
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [provisionStatus, setProvisionStatus] = useState('');

  // 1. Verify Master Access on Load
  useEffect(() => {
    const verifyMasterAccess = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session || session.user.email !== MASTER_ADMIN_EMAIL) {
        router.push('/login');
      } else {
        setAdminEmail(session.user.email);
        setAuthorized(true);
        fetchSystemData(); 
      }
    };

    verifyMasterAccess();
  }, [router]);

  // 2. Fetch complete system telemetry
  const fetchSystemData = async () => {
    setLoading(true);
    
    // Fetch Workspaces
    const { data: workspaceData } = await supabase.from('system_client_workspaces').select('*').order('created_at', { ascending: false });
    if (workspaceData) setWorkspaces(workspaceData);

    // NEW: Fetch Integration Logs (Limit to 15 most recent)
    const { data: logsData } = await supabase.from('system_integration_logs').select('*').order('created_at', { ascending: false }).limit(15);
    if (logsData) setIntegrationLogs(logsData);

    // Fetch Orders & GMV
    const { data: orderData } = await supabase.from('orders').select('id, order_id_string, total_amount, status, created_at, customers(name, platform)').order('created_at', { ascending: false });
    if (orderData) {
      setOrders(orderData as unknown as PlatformOrder[]);
      const gmvSum = orderData.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
      setPlatformGmv(gmvSum);
    }

    // Fetch Message Count
    const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true });
    if (count) setTotalMessages(count);

    setLoading(false);
  };

  // 3. NEW: Real-Time Listener for the Log Terminal
  useEffect(() => {
    if (!authorized) return;

    const channel = supabase.channel('live-telemetry-layer')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_integration_logs' }, (payload) => {
        // Drop the new log into the top of our array instantly
        setIntegrationLogs(prev => [payload.new as IntegrationLog, ...prev.slice(0, 14)]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [authorized]);

  const handleProvisionClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvisionStatus('Initializing direct node allocation...');

    const res = await fetch('/api/create-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, password: newPassword })
    });

    const data = await res.json();
    if (data.success) {
      await supabase.from('system_client_workspaces').insert({
        client_email: newEmail,
        plan_tier: 'Premium Business',
        status: 'active'
      });
      
      setProvisionStatus(`Success! Client node activated for ${newEmail}`);
      setNewEmail('');
      setNewPassword('');
      fetchSystemData(); 
    } else {
      setProvisionStatus(`Provisioning Failed: ${data.error}`);
    }
  };

  const handleMasterLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Security Wall Loading State
  if (!authorized && loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-indigo-500 font-mono">
        <ShieldAlert size={48} className="mb-4 animate-pulse opacity-50" />
        <p className="tracking-widest text-sm uppercase">Verifying Master Clearance...</p>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col md:flex-row selection:bg-indigo-500/30">
      
      {/* Super Admin Vertical Control Strip */}
      <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8 px-2 text-indigo-400">
            <ShieldCheck size={28} className="animate-pulse" />
            <span className="text-xl font-black uppercase tracking-wider">MyanHub HQ</span>
          </div>
          
          <nav className="space-y-1">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Activity size={18} /> Global Telemetry
            </button>
            <button 
              onClick={() => setActiveTab('workspaces')}
              className={`w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'workspaces' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Layers size={18} /> Client Workspaces
            </button>
            <button 
              onClick={() => setActiveTab('transactions')}
              className={`w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'transactions' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <DollarSign size={18} /> Live Transactions
            </button>
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col gap-4">
          <button 
            onClick={handleMasterLogout}
            className="flex items-center gap-3 px-4 py-2 text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 rounded-lg text-sm font-semibold transition-all"
          >
            <LogOut size={16} /> Terminate Session
          </button>
          <div className="px-4 flex items-center gap-3 text-slate-500">
            <Server size={16} />
            <span className="text-xs font-mono">v2.1.0 - Production</span>
          </div>
        </div>
      </aside>

      {/* Main Panel Canvas Area */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        
        {/* Header Block */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Super Admin Management Panel</h1>
            <p className="text-slate-400 text-sm mt-1">SaaS infrastructure overview, data metrics routing, and configuration deployment control center.</p>
          </div>
          <button 
            onClick={fetchSystemData} 
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            Force Sync Core Data
          </button>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-indigo-400 font-mono tracking-widest animate-pulse">
            SYNCING PIPELINES...
          </div>
        ) : (
          <>
            {/* Global Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
                <div className="flex justify-between items-center text-slate-500 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider">Hosted Workspaces</span>
                  <Users size={16} className="text-indigo-400" />
                </div>
                <div className="text-3xl font-black text-white">{workspaces.length}</div>
                <div className="text-xs text-emerald-400 font-medium flex items-center gap-1 mt-1">
                  <TrendingUp size={12} /> Live health normal
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
                <div className="flex justify-between items-center text-slate-500 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider">Platform GMV</span>
                  <DollarSign size={16} className="text-emerald-400" />
                </div>
                <div className="text-3xl font-black text-white">${platformGmv.toFixed(2)}</div>
                <div className="text-xs text-slate-400 mt-1">Aggregate client revenue flow</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
                <div className="flex justify-between items-center text-slate-500 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider">Webhook Chat Load</span>
                  <MessageSquare size={16} className="text-indigo-400" />
                </div>
                <div className="text-3xl font-black text-white">{totalMessages}</div>
                <div className="text-xs text-indigo-400 mt-1">Total dynamic network entries</div>
              </div>

              <div className="bg-slate-900 border border-indigo-950 rounded-xl p-5 shadow-xl bg-gradient-to-br from-slate-900 to-indigo-950/20">
                <div className="flex justify-between items-center text-slate-400 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider">Operational Status</span>
                  <CheckCircle2 size={16} className="text-indigo-400" />
                </div>
                <div className="text-xl font-bold text-indigo-300">ONLINE</div>
                <div className="text-xs text-slate-400 mt-1.5 font-mono">All servers responsive</div>
              </div>
            </div>
            
            {/* TAB 1: OVERVIEW & LOGS */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Deployment Provisioner */}
                <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl h-fit">
                  <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <Plus size={18} className="text-indigo-400" /> Provision Node
                  </h3>
                  <p className="text-slate-400 text-xs mb-6">Forge standard login tickets and initialize isolated user database schemas dynamically.</p>
                  
                  <form onSubmit={handleProvisionClient} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">CLIENT ACCESS EMAIL</label>
                      <input 
                        type="email" 
                        value={newEmail} 
                        onChange={e => setNewEmail(e.target.value)} 
                        required 
                        className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition" 
                        placeholder="merchant@store.com" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">SECURE ACCESS KEY</label>
                      <input 
                        type="password" 
                        value={newPassword} 
                        onChange={e => setNewPassword(e.target.value)} 
                        required 
                        className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition" 
                        placeholder="••••••••" 
                      />
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-2.5 rounded-lg transition shadow-lg shadow-indigo-600/10">
                      Deploy Active Workspace
                    </button>
                  </form>
                  {provisionStatus && (
                    <p className="mt-4 text-xs font-medium text-center text-amber-400 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono">
                      {provisionStatus}
                    </p>
                  )}
                </div>

                {/* NEW: Live Webhook & API Channels Logger Terminal */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Terminal size={18} className="text-indigo-400" /> Live Integration API Logs
                    </h3>
                    <span className="text-[10px] bg-slate-950 text-indigo-400 px-2 py-0.5 rounded border border-slate-800 font-mono flex items-center gap-1.5">
                      <Radio size={10} className="text-emerald-500 animate-ping" /> Real-time Streaming
                    </span>
                  </div>
                  
                  <div className="flex-1 space-y-3 overflow-y-auto max-h-[340px] pr-1 font-mono text-xs">
                    {integrationLogs.length === 0 ? (
                      <div className="text-center py-12 text-slate-600 border border-dashed border-slate-800 rounded-xl">
                        No outbound API connections mapped into platform yet.
                      </div>
                    ) : (
                      integrationLogs.map((log) => (
                        <div key={log.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-slate-700 transition-colors">
                          <div className="min-w-0">
                            <span className="text-emerald-500 font-bold">[{log.channel.toUpperCase()}]</span>{' '}
                            <span className="text-slate-300 font-medium truncate inline-block max-w-xs sm:max-w-sm align-bottom">{log.client_email}</span>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                            <span className="text-[10px] bg-indigo-950/50 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-900/60 font-semibold">{log.status}</span>
                            <span className="text-slate-500 text-[10px]">{new Date(log.created_at).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: COMPLETE SYSTEM WORKSPACES REPOSITORY */}
            {activeTab === 'workspaces' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
                <div className="p-6 border-b border-slate-800">
                  <h3 className="text-lg font-bold text-white">Hosted Corporate Tenants Directory</h3>
                  <p className="text-slate-400 text-xs mt-1">Review active subscriber instances, assign package levels, or configure authorization matrices.</p>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-800">
                      <th className="px-6 py-4">Client Tenant Node</th>
                      <th className="px-6 py-4">System Tier</th>
                      <th className="px-6 py-4">Database Health Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {workspaces.map((ws) => (
                      <tr key={ws.id} className="hover:bg-slate-850 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{ws.client_email}</td>
                        <td className="px-6 py-4 text-slate-300 font-mono text-sm">{ws.plan_tier}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-900">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span> Active Syncing
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 3: SYSTEM TRANSACTION LEDGER */}
            {activeTab === 'transactions' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
                <div className="p-6 border-b border-slate-800">
                  <h3 className="text-lg font-bold text-white">Live Platform Transaction Stream</h3>
                  <p className="text-slate-400 text-xs mt-1">Monitor inbound cash generation flows and total sales volume metrics across all integrated systems.</p>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-800">
                      <th className="px-6 py-4">Global Order Key</th>
                      <th className="px-6 py-4">Inbound Customer Entity</th>
                      <th className="px-6 py-4">Gross Revenue Amount</th>
                      <th className="px-6 py-4">Fulfillment State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-850 transition-colors">
                        <td className="px-6 py-4 font-mono text-sm text-indigo-400 font-bold">{order.order_id_string}</td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-white">{order.customers?.name || 'Generic Lead'}</p>
                            <p className="text-xs text-slate-500">{order.customers?.platform || 'Direct API Channel'}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-white">${Number(order.total_amount).toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded text-xs font-bold tracking-wide uppercase ${order.status === 'shipped' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-amber-950 text-amber-400 border border-amber-900'}`}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}