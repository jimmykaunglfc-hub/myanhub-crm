"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Users, UserPlus, Shield, Trash2, KeyRound, Mail, 
  AlertCircle, CheckCircle2, Phone, Lock, ShieldCheck, 
  Eye, Truck 
} from 'lucide-react';

interface TeamMember {
  id: string;
  email: string;
  role: string;
  full_name: string;
  phone: string | null;
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
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('staff'); // Defaulted to staff
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  // Dynamic Role Update State
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('workspace_id', user.id)
      .neq('id', user.id)
      .order('created_at', { ascending: false });
      
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
      const res = await fetch('/api/team/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          fullName: newFullName,
          phone: newPhone || null,
          role: newRole,
          workspaceId: user.id 
        })
      });

      const result = await res.json();

      if (!result.success) throw new Error(result.error);

      setStatusMsg({ type: 'success', text: 'Account provisioned successfully!' });
      
      setNewEmail('');
      setNewPassword('');
      setNewFullName('');
      setNewPhone('');
      
      fetchTeamMembers();
      
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setIsProvisioning(false);
    }
  };

  // 🚀 NEW: Dynamic Role Mutation Handler
  const handleUpdateRole = async (memberId: string, targetRole: string) => {
    setUpdatingRole(memberId);
    
    const { error } = await supabase
      .from('profiles')
      .update({ role: targetRole })
      .eq('id', memberId);

    if (error) {
      alert(`Access denied: Failed to update role. ${error.message}`);
    } else {
      setTeamMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: targetRole } : m));
    }
    
    setUpdatingRole(null);
  };

  const confirmDeleteTeamMember = async (userIdToDelete: string, name: string) => {
    if (!window.confirm(`CRITICAL: Are you sure you want to delete ${name}'s credentials permanently?`)) return;

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
      console.error(error);
    }
  };

  return (
    <div className={`flex font-sans min-h-screen transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative h-screen overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-y-auto mt-16 p-6 md:p-8 space-y-8 max-w-6xl mx-auto w-full pb-20">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Team & Security Access</h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Provision credentials, delegate roles, and manage secure access handles.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT COLUMN: FORM & MATRIX */}
            <div className="lg:col-span-1 space-y-8">
              
              {/* PROVISIONING FORM */}
              <div className={`p-6 md:p-8 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h3 className="text-sm font-bold mb-6 flex items-center gap-2 uppercase tracking-wider text-indigo-500"><UserPlus size={16} /> Provision Worker</h3>
                
                <form onSubmit={handleCreateMember} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Full Name</label>
                    <div className="relative">
                      <Users size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" />
                      <input type="text" value={newFullName} onChange={e => setNewFullName(e.target.value)} required placeholder="Jane Doe" className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium focus:outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Contact Number <span className="text-[10px] text-slate-400 font-normal">(Optional)</span></label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" />
                      <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="e.g. 091234567" className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium focus:outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Login Email</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" />
                      <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required placeholder="jane@myanhub.com" className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium focus:outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Temporary Password</label>
                    <div className="relative">
                      <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" />
                      <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="Min 6 characters" minLength={6} className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium focus:outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Initial Access Scope</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value)} className={`w-full px-4 py-3 rounded-xl text-sm font-bold focus:outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>
                      <option value="admin">Workspace Admin (Full Control)</option>
                      <option value="staff">Support Agent (CRM Access)</option>
                      <option value="driver">Logistics Driver (App Only)</option>
                    </select>
                  </div>

                  <button type="submit" disabled={isProvisioning} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-8 py-3 rounded-xl shadow-md disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                    <Shield size={16} /> {isProvisioning ? 'Encrypting...' : 'Generate Account'}
                  </button>

                  {statusMsg && (
                    <div className={`mt-4 text-xs font-bold p-3 rounded-xl border flex items-center gap-2 ${statusMsg.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      {statusMsg.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />} 
                      {statusMsg.text}
                    </div>
                  )}
                </form>
              </div>

              {/* PERMISSION MATRIX */}
              <div className={`p-6 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2 uppercase tracking-wider text-slate-500"><Lock size={16} /> Permission Matrix</h3>
                <div className="space-y-3">
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-rose-900/30' : 'bg-rose-50/50 border-rose-100'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck size={14} className="text-rose-500"/>
                      <span className="text-xs font-bold uppercase text-rose-500">Workspace Admin</span>
                    </div>
                    <p className={`text-[10px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Full systems control. Can provision staff, edit API configurations, and delete records.</p>
                  </div>
                  
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-indigo-900/30' : 'bg-indigo-50/50 border-indigo-100'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Eye size={14} className="text-indigo-500"/>
                      <span className="text-xs font-bold uppercase text-indigo-500">Support Agent</span>
                    </div>
                    <p className={`text-[10px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Standard backoffice layer. Can access Inbox, process orders, and view inventory levels.</p>
                  </div>

                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-amber-900/30' : 'bg-amber-50/50 border-amber-100'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Truck size={14} className="text-amber-500"/>
                      <span className="text-xs font-bold uppercase text-amber-500">Logistics Driver</span>
                    </div>
                    <p className={`text-[10px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Field operations. Strictly isolated to the mobile driver portal to update active route statuses.</p>
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: ROSTER */}
            <div className={`p-6 md:p-8 rounded-2xl border shadow-sm lg:col-span-2 flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="text-sm font-bold mb-6 flex items-center gap-2 uppercase tracking-wider text-slate-500"><Users size={16} /> Workspace Fleet & Roster</h3>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {loading ? (
                   <div className="p-8 text-center text-sm font-bold text-slate-500 animate-pulse">Scanning nodes...</div>
                ) : teamMembers.length === 0 ? (
                  <div className={`p-8 text-center text-sm border border-dashed rounded-xl ${isDarkMode ? 'border-slate-800 text-slate-500' : 'border-slate-300 text-slate-500'}`}>No active team members.</div>
                ) : (
                  teamMembers.map(member => (
                    <div key={member.id} className={`p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border transition-colors ${isDarkMode ? 'bg-slate-950/50 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm bg-indigo-100 text-indigo-700 flex-shrink-0">
                          {member.full_name?.charAt(0) || 'U'}
                        </div>
                        <div className="min-w-0">
                          <h4 className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{member.full_name || 'Unnamed Worker'}</h4>
                          <p className={`text-xs mt-0.5 truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {member.email} {member.phone ? `• ${member.phone}` : ''}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
                        {/* 🚀 DYNAMIC ROLE DELEGATION SELECTOR */}
                        <div className="relative">
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                            disabled={updatingRole === member.id}
                            className={`text-[10px] font-bold uppercase tracking-wider pl-3 pr-8 py-1.5 rounded-lg border outline-none cursor-pointer appearance-none transition-colors ${
                              member.role === 'admin' ? (isDarkMode ? 'bg-rose-950/30 text-rose-400 border-rose-900' : 'bg-rose-50 text-rose-700 border-rose-200') :
                              member.role === 'staff' ? (isDarkMode ? 'bg-indigo-950/30 text-indigo-400 border-indigo-900' : 'bg-indigo-50 text-indigo-700 border-indigo-200') :
                              (isDarkMode ? 'bg-amber-950/30 text-amber-400 border-amber-900' : 'bg-amber-50 text-amber-700 border-amber-200')
                            } ${updatingRole === member.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <option value="admin">Admin</option>
                            <option value="staff">Support Agent</option>
                            <option value="driver">Logistics Driver</option>
                          </select>
                          <div className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>▼</div>
                        </div>

                        <button onClick={() => confirmDeleteTeamMember(member.id, member.full_name)} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'text-slate-500 hover:text-rose-400 hover:bg-rose-950/50' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'}`} title="Revoke Access">
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