"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Users, UserPlus, Shield, Trash2, KeyRound, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TeamMember {
  id: string;
  email: string;
  role: string;
  full_name: string;
  created_at: string;
}

export default function TeamAccess() {
  const { isDarkMode } = useTheme();
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Provisioning States
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState('driver');
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Assuming the CRM Owner's workspace_id is their own user.id
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('workspace_id', user.id)
      .neq('id', user.id); // Exclude the owner from the list
      
    if (data) setTeamMembers(data as TeamMember[]);
    setLoading(false);
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProvisioning(true);
    setStatusMsg(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // 1. Create the Auth login credentials using the Admin API
      const res = await fetch('/api/team/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          fullName: newFullName,
          role: newRole,
          workspaceId: user.id 
        })
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      setStatusMsg({ type: 'success', text: 'Account provisioned successfully!' });
      
      // Clear form
      setNewEmail('');
      setNewPassword('');
      setNewFullName('');
      
      // Refresh list
      fetchTeamMembers();
      
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setIsProvisioning(false);
    }
  };

  const confirmDeleteTeamMember = async (userIdToDelete: string, name: string) => {
    if (!window.confirm(`CRITICAL: Are you completely sure you want to delete ${name}'s login credentials? This will instantly log them out and destroy their access privileges permanently.`)) {
      return;
    }

    try {
      const response = await fetch('/api/team/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userIdToDelete }),
      });

      const data = await response.json();

      if (data.success) {
        setTeamMembers(prev => prev.filter(member => member.id !== userIdToDelete));
      } else {
        alert(`Failed to delete: ${data.error}`);
      }
    } catch (error) {
      console.error("Deletion failed:", error);
    }
  };

  return (
    <div className={`flex font-sans min-h-screen transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative h-screen overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-y-auto mt-16 p-6 md:p-8 space-y-8 max-w-6xl mx-auto w-full pb-20">
          
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold tracking-tight">Team & Security Access</h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Provision credentials and manage secure access for your workspace staff and drivers.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* PROVISIONING FORM (Left Side) */}
            <div className={`p-6 md:p-8 rounded-2xl border shadow-sm transition-colors lg:col-span-1 h-fit ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="text-sm font-bold mb-6 flex items-center gap-2 uppercase tracking-wider text-indigo-500"><UserPlus size={16} /> Provision Worker</h3>
              
              <form onSubmit={handleCreateMember} className="space-y-4">
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Full Name</label>
                  <div className="relative">
                    <Users size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input type="text" value={newFullName} onChange={e => setNewFullName(e.target.value)} required placeholder="Jane Doe" className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`} />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Login Email</label>
                  <div className="relative">
                    <Mail size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required placeholder="jane@myanhub.com" className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`} />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Temporary Password</label>
                  <div className="relative">
                    <KeyRound size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="Minimum 6 characters" minLength={6} className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`} />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Initial Access Scope</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value)} className={`w-full px-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition border appearance-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>
                    <option value="driver">Logistics Driver (Mobile App)</option>
                    <option value="staff">Backoffice Staff (CRM Access)</option>
                  </select>
                </div>

                <button type="submit" disabled={isProvisioning} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-8 py-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Shield size={16} /> {isProvisioning ? 'Encrypting...' : 'Generate Account'}
                </button>

                {statusMsg && (
                  <div className={`mt-4 text-xs font-bold p-3 rounded-xl border flex items-center gap-2 animate-fade-in ${statusMsg.type === 'error' ? (isDarkMode ? 'bg-rose-950/40 text-rose-400 border-rose-900' : 'bg-rose-50 text-rose-700 border-rose-200') : (isDarkMode ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900' : 'bg-emerald-50 text-emerald-700 border-emerald-200')}`}>
                    {statusMsg.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                    {statusMsg.text}
                  </div>
                )}
              </form>
            </div>

            {/* ROSTER VIEW (Right Side) */}
            <div className={`p-6 md:p-8 rounded-2xl border shadow-sm transition-colors lg:col-span-2 flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="text-sm font-bold mb-6 flex items-center gap-2 uppercase tracking-wider text-slate-500"><Users size={16} /> Workspace Fleet & Roster</h3>
              
              <div className={`flex-1 overflow-y-auto pr-2 space-y-3`}>
                {loading ? (
                   <div className="p-8 text-center text-sm font-bold text-slate-500 animate-pulse">Scanning security nodes...</div>
                ) : teamMembers.length === 0 ? (
                  <div className="p-8 text-center text-sm font-medium text-slate-500 border-2 border-dashed rounded-xl border-slate-200 dark:border-slate-800">No active team members found in this workspace.</div>
                ) : (
                  teamMembers.map(member => (
                    <div key={member.id} className={`p-4 rounded-xl flex items-center justify-between border transition-all ${isDarkMode ? 'bg-slate-950/50 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm uppercase ${member.role === 'driver' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'}`}>
                          {member.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold">{member.full_name || 'Unnamed Worker'}</h4>
                          <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{member.email || 'Email hidden by vault'}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${member.role === 'driver' ? 'border-emerald-200 text-emerald-600 bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:bg-emerald-950/30' : 'border-indigo-200 text-indigo-600 bg-indigo-50 dark:border-indigo-900 dark:text-indigo-400 dark:bg-indigo-950/30'}`}>
                          {member.role === 'driver' ? 'Driver (Mobile App)' : 'Staff (CRM Access)'}
                        </span>
                        
                        <button onClick={() => confirmDeleteTeamMember(member.id, member.full_name || 'this worker')} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400' : 'bg-white border hover:bg-rose-50 text-slate-400 hover:text-rose-500'}`}>
                          <Trash2 size={16} />
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