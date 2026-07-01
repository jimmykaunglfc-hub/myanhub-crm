"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { User, ShieldCheck, Key, Settings, Cpu } from 'lucide-react';

export default function SettingsPage() {
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfileMetadata = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || 'Unspecified Email');
        setUserId(user.id);
      }
      setLoading(false);
    };
    fetchProfileMetadata();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage('Syncing data update parameters with central servers...');
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      setStatusMessage(`Update Refused: ${error.message}`);
    } else {
      setStatusMessage('Success! Your credential passkey configuration has been updated.');
      setNewPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative">
        <Header />
        
        <div className="flex-1 overflow-y-auto mt-16 p-6 md:p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
            <p className="text-slate-500 mt-1">Manage your unique client workspace metadata node properties and network credentials.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Primary Configuration Cards Layer */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-1">
                  <User size={18} className="text-indigo-600" /> Account Profile Node
                </h3>
                <p className="text-slate-400 text-xs">Review or update your identity vectors mapped across the MyanHub core engine.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Authenticated Login Handle</span>
                  <span className="text-sm font-semibold text-slate-800">{loading ? 'Resolving data links...' : userEmail}</span>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Isolated Tenant ID</span>
                  <span className="text-xs font-mono text-slate-500 select-all block truncate">{loading ? 'Resolving data links...' : userId}</span>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Form Component: Update Password */}
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Key size={16} className="text-indigo-600" /> Rotate Security Passkey
                  </h4>
                  <p className="text-slate-400 text-xs mt-0.5">Change your password to ensure unauthorized sessions are terminated across active devices.</p>
                </div>
                
                <div className="max-w-md flex flex-col sm:flex-row gap-3">
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required 
                    minLength={6}
                    placeholder="Enter absolute new passkey value" 
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors shadow-sm whitespace-nowrap">
                    Apply New Password
                  </button>
                </div>
                
                {statusMessage && (
                  <p className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 p-2.5 rounded-lg max-w-md leading-relaxed">
                    {statusMessage}
                  </p>
                )}
              </form>
            </div>

            {/* Sidebar Metadata Information Cards Layer */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Telemetry Integrity Status Display Widget */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-md font-bold text-slate-900 flex items-center gap-2 mb-3">
                  <Cpu size={16} className="text-indigo-600" /> Node Telemetry Status
                </h3>
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
                  <ShieldCheck className="text-emerald-600 mt-0.5 flex-shrink-0" size={18} />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-800">Connection Verified</h4>
                    <p className="text-emerald-600 text-xs mt-1 leading-relaxed">Your application link is securely tunnelled directly with active cluster storage relays. Dynamic stream parsing is operating normally.</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}