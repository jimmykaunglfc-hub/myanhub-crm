"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Users, Shield, Truck, Plus, UserPlus, Briefcase, Mail, Lock } from 'lucide-react';

interface StaffProfile {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
}

export default function TeamManagement() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [team, setTeam] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Form States
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('staff');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      
      // Ensure the logged in person is actually an Owner
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      
      if (!profile) {
        // If they don't have a profile yet (because you just added this feature), create them one!
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
      .neq('id', uid) // Don't show the owner in the staff list
      .order('created_at', { ascending: false });
      
    if (data) setTeam(data);
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
          email: formEmail,
          password: formPassword,
          name: formName,
          role: formRole,
          workspaceId: ownerId // This binds them to YOUR data
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: `Account for ${formName} generated successfully.` });
      setFormName(''); setFormEmail(''); setFormPassword('');
      fetchTeam(ownerId); // Refresh list
      
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!ownerId) return <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}></div>;

  return (
    <div className={`flex font-sans min-h-screen transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative h-screen overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-y-auto mt-16 p-6 md:p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Team & Role Management</h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Generate credentials for your processing staff and delivery fleet.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Generate Account Form */}
            <div className={`lg:col-span-1 rounded-2xl border shadow-sm p-6 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="text-sm font-black uppercase tracking-wider mb-6 flex items-center gap-2"><UserPlus size={16} className="text-indigo-500" /> New Account</h3>
              
              <form onSubmit={handleCreateStaff} className="space-y-4">
                <div>
                  <label className={`block text-[10px] font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Full Name</label>
                  <div className="relative">
                    <Briefcase size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input type="text" required value={formName} onChange={e => setFormName(e.target.value)} className={`w-full pl-9 pr-3 py-2.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`} placeholder="Jane Doe" />
                  </div>
                </div>

                <div>
                  <label className={`block text-[10px] font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Login Email</label>
                  <div className="relative">
                    <Mail size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input type="email" required value={formEmail} onChange={e => setFormEmail(e.target.value)} className={`w-full pl-9 pr-3 py-2.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`} placeholder="jane@myanhub.com" />
                  </div>
                </div>

                <div>
                  <label className={`block text-[10px] font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Temporary Password</label>
                  <div className="relative">
                    <Lock size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input type="text" required minLength={6} value={formPassword} onChange={e => setFormPassword(e.target.value)} className={`w-full pl-9 pr-3 py-2.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`} placeholder="password123" />
                  </div>
                </div>

                <div>
                  <label className={`block text-[10px] font-bold uppercase mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Assign Role</label>
                  <select value={formRole} onChange={e => setFormRole(e.target.value)} className={`w-full px-3 py-2.5 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition border appearance-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>
                    <option value="staff">Backoffice Staff (CRM Access)</option>
                    <option value="driver">Delivery Driver (Mobile App)</option>
                  </select>
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3 rounded-lg transition-all shadow-md disabled:opacity-50 mt-4 flex items-center justify-center gap-2">
                  <Plus size={16} /> {isSubmitting ? 'Generating...' : 'Create Account'}
                </button>

                {message && (
                  <div className={`p-3 rounded-lg text-xs font-bold text-center border mt-2 ${message.type === 'error' ? (isDarkMode ? 'bg-rose-950/40 text-rose-400 border-rose-900' : 'bg-rose-50 text-rose-600 border-rose-200') : (isDarkMode ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900' : 'bg-emerald-50 text-emerald-600 border-emerald-200')}`}>
                    {message.text}
                  </div>
                )}
              </form>
            </div>

            {/* Active Staff Roster */}
            <div className={`lg:col-span-2 rounded-2xl border shadow-sm flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`p-6 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2"><Users size={16} className="text-indigo-500" /> Active Roster</h3>
              </div>
              
              <div className={`divide-y flex-1 overflow-y-auto ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                {loading ? (
                  <div className="p-8 text-center text-sm font-mono text-indigo-500 animate-pulse">LOADING ROSTER...</div>
                ) : team.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">No staff accounts have been generated yet.</div>
                ) : (
                  team.map((member) => (
                    <div key={member.id} className={`p-4 flex items-center justify-between transition-colors ${isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black uppercase text-sm border flex-shrink-0 ${member.role === 'staff' ? (isDarkMode ? 'bg-indigo-950/50 text-indigo-400 border-indigo-900' : 'bg-indigo-50 text-indigo-600 border-indigo-200') : (isDarkMode ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900' : 'bg-emerald-50 text-emerald-600 border-emerald-200')}`}>
                          {member.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{member.full_name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {member.role === 'staff' ? <Shield size={10} className="text-indigo-500" /> : <Truck size={10} className="text-emerald-500" />}
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{member.role}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          Joined {new Date(member.created_at).toLocaleDateString()}
                        </span>
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