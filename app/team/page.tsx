"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Users, Shield, Truck, Plus, UserPlus, Briefcase, Mail, Lock, Trash2, UserCheck 
} from 'lucide-react';

interface StaffProfile {
  id: string;
  full_name: string;
  role: 'staff' | 'driver';
  created_at: string;
}

export default function TeamManagement() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [team, setTeam] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Creation Form States
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('staff');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (!profile) {
        await supabase.from('profiles').insert({
          id: session.user.id,
          role: 'owner',
          workspace_id: session.user.id,
          full_name: 'Workspace Owner'
        });
      }

      setOwnerId(session.user.id);
      fetchTeam(session.user.id);
    };
    initialize();
  }, [router]);

  const fetchTeam = async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('workspace_id', uid)
      .neq('id', uid)
      .order('created_at', { ascending: false });
      
    if (data) setTeam(data as StaffProfile[]);
    setLoading(false);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) return;
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/create-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formEmail, password: formPassword, name: formName, role: formRole, workspaceId: ownerId
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: `Account for ${formName} generated successfully.` });
      setFormName(''); setFormEmail(''); setFormPassword('');
      fetchTeam(ownerId);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // NEW: HANDLE DYNAMIC PERMISSION CHANGE
  const handleUpdateRole = async (targetUserId: string, currentName: string, newRole: string) => {
    if (!ownerId) return;
    try {
      const response = await fetch('/api/manage-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_role', targetUserId, newRole, workspaceId: ownerId })
      });
      if (!response.ok) throw new Error("Could not update authorization role.");
      
      setTeam(prev => prev.map(m => m.id === targetUserId ? { ...m, role: newRole as any } : m));
    } catch (err: any) {
      alert(err.message);
      fetchTeam(ownerId);
    }
  };

  // NEW: PERMANENTLY DEACTIVATE AND REMOVE WORKER
  const handleRevokeAccess = async (targetUserId: string, name: string) => {
    if (!ownerId) return;
    if (!confirm(`CRITICAL: Are you completely sure you want to delete ${name}'s login credentials? This will instantly log them out and destroy their access privileges permanentely.`)) return;

    try {
      const response = await fetch('/api/manage-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', targetUserId, workspaceId: ownerId })
      });
      if (!response.ok) throw new Error("Purge request rejected by administrative API.");
      
      setTeam(prev => prev.filter(m => m.id !== targetUserId));
    } catch (err: any) {
      alert(err.message);
      fetchTeam(ownerId);
    }
  };

  if (!ownerId) return <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}></div>;

  return (
    <div className={`flex font-sans min-h-screen transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative h-screen overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-y-auto mt-16 p-4 md:p-8">
          <div className="mb-8 mt-4 md:mt-0">
            <h2 className="text-2xl font-bold tracking-tight">Team & Security Access</h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Provision credentials and manage platform access scopes dynamically.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Provision Account */}
            <div className={`rounded-2xl border shadow-sm p-6 h-fit ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="text-sm font-black uppercase tracking-wider mb-6 flex items-center gap-2"><UserPlus size={16} className="text-indigo-500" /> Provision Worker</h3>
              <form onSubmit={handleCreateStaff} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1 opacity-60">Full Name</label>
                  <div className="relative">
                    <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                    <input type="text" required value={formName} onChange={e => setFormName(e.target.value)} className={`w-full pl-9 pr-3 py-2.5 rounded-lg text-sm focus:outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} placeholder="Jane Doe" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1 opacity-60">Login Email</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                    <input type="email" required value={formEmail} onChange={e => setFormEmail(e.target.value)} className={`w-full pl-9 pr-3 py-2.5 rounded-lg text-sm focus:outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} placeholder="jane@myanhub.com" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1 opacity-60">Temporary Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                    <input type="text" required minLength={6} value={formPassword} onChange={e => setFormPassword(e.target.value)} className={`w-full pl-9 pr-3 py-2.5 rounded-lg text-sm focus:outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} placeholder="password123" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1 opacity-60">Initial Access Scope</label>
                  <select value={formRole} onChange={e => setFormRole(e.target.value)} className={`w-full px-3 py-2.5 rounded-lg text-sm font-bold focus:outline-none border appearance-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`}>
                    <option value="staff">Backoffice Staff (CRM Access)</option>
                    <option value="driver">Delivery Driver (Mobile App)</option>
                  </select>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3 rounded-lg shadow-md disabled:opacity-50 mt-4 flex items-center justify-center gap-2">
                  <Plus size={16} /> {isSubmitting ? 'Provisioning...' : 'Generate Account'}
                </button>
                {message && (
                  <div className={`p-3 rounded-lg text-xs font-bold text-center border mt-2 ${message.type === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                    {message.text}
                  </div>
                )}
              </form>
            </div>

            {/* Active Workspace Roster */}
            <div className={`lg:col-span-2 rounded-2xl border shadow-sm flex flex-col overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`p-6 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2"><Users size={16} className="text-indigo-500" /> Workspace Fleet & Roster</h3>
              </div>
              
              <div className={`divide-y flex-1 overflow-y-auto ${isDarkMode ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
                {loading ? (
                  <div className="p-8 text-center text-sm font-mono text-indigo-500 animate-pulse">LOADING MATRIX ROSTER...</div>
                ) : team.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">No active accounts provisioned to your workspace.</div>
                ) : (
                  team.map((member) => (
                    <div key={member.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-slate-50/40 dark:hover:bg-slate-800/20">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black uppercase text-sm border flex-shrink-0 ${member.role === 'staff' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                          {member.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{member.full_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">Created {new Date(member.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {/* GRANULAR ROLE SELECTOR & REVOKE ACTION */}
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="relative">
                          <select 
                            value={member.role}
                            onChange={(e) => handleUpdateRole(member.id, member.full_name, e.target.value)}
                            className={`text-xs font-bold py-1.5 pl-3 pr-8 rounded-lg border focus:outline-none appearance-none transition-colors ${member.role === 'staff' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}
                          >
                            <option value="staff">Staff (CRM Access)</option>
                            <option value="driver">Driver (Mobile App)</option>
                          </select>
                          <div className="absolute inset-y-0 right-2 flex items-center pr-1 pointer-events-none opacity-50">
                            <UserCheck size={12} />
                          </div>
                        </div>

                        <button 
                          onClick={() => handleRevokeAccess(member.id, member.full_name)}
                          className={`p-2 rounded-lg transition-colors border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-500 hover:text-rose-400 hover:border-rose-500/20' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
                          title="Revoke Credentials permanently"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}