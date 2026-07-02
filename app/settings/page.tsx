"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Sliders, Info, MessageSquare, MessageCircle, ShoppingBag, 
  PhoneCall, Shield, KeyRound, CheckCircle2, AlertCircle, Trash2
} from 'lucide-react';

type ChannelType = 'facebook' | 'telegram' | 'viber' | 'tiktok' | 'whatsapp' | 'line';

// NEW: Interface to track active client connections
interface Integration {
  id: string;
  channel: ChannelType;
  token: string;
  status: string;
}

export default function EnhancedSettings() {
  const { isDarkMode, toggleDarkMode } = useTheme();
  
  // Workspace States
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [userEmail, setUserEmail] = useState('Loading...');
  const [userId, setUserId] = useState('');
  
  // Integration States
  const [integrations, setIntegrations] = useState<Integration[]>([]); // Tracks saved connections
  const [activeChannel, setActiveChannel] = useState<ChannelType | null>(null);
  const [credentialKey, setCredentialKey] = useState('');
  const [channelStatus, setChannelStatus] = useState('');
  const [isEditing, setIsEditing] = useState(false); // Toggles update mode
  
  // Security States
  const [newPassword, setNewPassword] = useState('');
  const [profileStatus, setProfileStatus] = useState('');

  // 1. Fetch Session & Active Integrations on Load
  useEffect(() => {
    const initializeSettings = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
        setUserId(user.id);
        
        // Fetch current active integrations from the new table
        const { data: activeInts } = await supabase
          .from('workspace_integrations')
          .select('*')
          .eq('user_id', user.id);
          
        if (activeInts) setIntegrations(activeInts as Integration[]);
      }
    };
    initializeSettings();
  }, []);

  const handleSaveChannelConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setChannelStatus('Authenticating API gates with platform...');
    
    try {
      const currentDomain = window.location.host;

      // 1. Register with the backend API
      const res = await fetch('/api/register-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialKey, platform: activeChannel, domain: currentDomain, userId: userId })
      });

      const apiData = await res.json();
      if (!apiData.success) {
        setChannelStatus(`Integration Link Error: ${apiData.error}`);
        return;
      }
      
      // 2. Check if we are updating an existing token or inserting a new one
      const existing = integrations.find(i => i.channel === activeChannel);
      
      if (existing) {
        await supabase.from('workspace_integrations').update({ token: credentialKey }).eq('id', existing.id);
      } else {
        await supabase.from('workspace_integrations').insert({ 
          user_id: userId, 
          channel: activeChannel, 
          token: credentialKey, 
          status: 'active' 
        });
      }

      // 3. Fire the Audit Log for the Super Admin
      await supabase.from('system_integration_logs').insert({ 
        client_email: userEmail, 
        channel: activeChannel, 
        status: 'SUCCESSFUL_OAUTH_LINK' 
      });

      // 4. Refresh local UI state immediately
      const { data: updatedInts } = await supabase.from('workspace_integrations').select('*').eq('user_id', userId);
      if (updatedInts) setIntegrations(updatedInts as Integration[]);

      setChannelStatus(`Success! Secure webhook established for ${activeChannel}.`);
      setCredentialKey('');
      setIsEditing(false);
      
    } catch (err: any) {
      setChannelStatus(`Network Error: Failed to contact integration gateway.`);
    }
  };

  // Sever the connection and delete the record
  const handleDisconnect = async (integrationId: string, channel: string) => {
    setChannelStatus('Severing connection...');
    await supabase.from('workspace_integrations').delete().eq('id', integrationId);
    setIntegrations(prev => prev.filter(i => i.id !== integrationId));
    setChannelStatus(`Successfully disconnected ${channel} channel.`);
    setIsEditing(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatus('Encrypting new credentials...');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setProfileStatus(`Error: ${error.message}`);
    else {
      setProfileStatus('Passkey rotated successfully! Your session remains active.');
      setNewPassword('');
      setTimeout(() => setProfileStatus(''), 5000);
    }
  };

  // Helper to safely mask tokens for UI display (e.g., 1234••••••••ABCD)
  const maskToken = (token: string) => {
    if (token.length < 8) return '••••••••';
    return `${token.slice(0, 4)}••••••••••••${token.slice(-4)}`;
  };

  const guidelines: Record<ChannelType, { title: string; steps: string[]; placeholder: string }> = {
    telegram: { title: "Telegram Bot API Integration Guide", steps: ["Open Telegram and search for the @BotFather manager node.", "Send the text command '/newbot' and assign a public identity configuration handle.", "Copy the generated cryptographic HTTP API Token string parameter.", "Paste the token values below to activate background listener webhooks instantly."], placeholder: "Enter Bot API Token (e.g., 7428941:AAH_x...)" },
    facebook: { title: "Facebook Messenger Business Setup", steps: ["Navigate to developers.facebook.com and initialize a Meta Business App console.", "Add the 'Messenger' feature product bundle inside your navigation dashboard controls.", "Link your active commercial Page asset and generate a Permanent Page Access Token.", "Input your Access Token parameter key down below to stream inbound message webhooks."], placeholder: "Enter Meta Page Access Token String" },
    viber: { title: "Viber Business Chat Integration", steps: ["Visit the official Viber Partner Console panel asset gateway.", "Select 'Create Bot Account', upload your brand assets and fill out workspace descriptors.", "Acquire your master application App Token key from the confirmation screen setup matrix.", "Bind your account parameters to the MyanHub ingestion node below."], placeholder: "Enter Viber App Token Key" },
    tiktok: { title: "TikTok Shop Multi-Tenant API Hub", steps: ["Sign in directly to your TikTok Shop Affiliate Developer Center portal.", "Authorize 'MyanHub Platform Connector' under cross-origin account configurations.", "Extract your unique App Key string along with your active Client Secret parameters.", "Paste your validation keys below to begin automatic inventory mapping streams."], placeholder: "Enter TikTok Shop Authorization App Key" },
    whatsapp: { title: "WhatsApp Cloud Business System Integration", steps: ["Go to your Meta Developer Matrix portal and choose your WhatsApp Business application node.", "Set up standard WhatsApp Business API access triggers inside your project hierarchy.", "Generate your permanent system access authorization token parameters.", "Submit the key below to pipeline customer communication channels safely."], placeholder: "Enter Meta WhatsApp Business Access Token" },
    line: { title: "Line Developers Messaging Network Connect", steps: ["Log into your active Line Developers Business account console pipeline.", "Create a brand-new Messaging API Provider channel context wrapper.", "Issue a permanent Long-Lived Channel Access Token string inside configuration settings.", "Feed the token key matrix into your MyanHub receiver down below."], placeholder: "Enter Line Channel Access Token String" }
  };

  // Check if the currently clicked channel is already saved in the database
  const activeIntegration = activeChannel ? integrations.find(i => i.channel === activeChannel) : null;

  return (
    <div className={`flex font-sans min-h-screen transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative">
        <Header />
        
        <div className="flex-1 overflow-y-auto mt-16 p-6 md:p-8 space-y-8 max-w-6xl mx-auto w-full">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Client Workspace Settings</h2>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Configure workspace parameters, self-connect sales channels, and manage security.</p>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-2 shadow-sm ${isLiveMode ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
              <span className={`w-2 h-2 rounded-full ${isLiveMode ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
              {isLiveMode ? 'PRODUCTION ENVIRONMENT' : 'SANDBOX ENVIRONMENT'}
            </div>
          </div>

          {/* SYSTEM MODE SELECTION */}
          <div className={`p-6 rounded-2xl border shadow-sm transition-colors duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className="text-lg font-bold mb-5 flex items-center gap-2"><Sliders size={18} className="text-indigo-600" /> System Mode Selection</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`p-5 rounded-xl flex items-center justify-between transition-colors border ${isDarkMode ? 'bg-slate-950/50 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}>
                <div className="pr-4">
                  <span className="block text-sm font-bold mb-0.5">Operation Workspace Mode</span>
                  <span className={`text-xs leading-relaxed block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Toggle Sandbox testing environments or switch to Live production data relays.</span>
                </div>
                <button onClick={() => setIsLiveMode(!isLiveMode)} className={`w-14 h-7 flex-shrink-0 rounded-full relative flex items-center p-1 transition-colors ${isLiveMode ? 'bg-emerald-600' : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}><span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 block ${isLiveMode ? 'translate-x-7' : 'translate-x-0'}`} /></button>
              </div>
              <div className={`p-5 rounded-xl flex items-center justify-between transition-colors border ${isDarkMode ? 'bg-slate-950/50 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}>
                <div className="pr-4">
                  <span className="block text-sm font-bold mb-0.5">Aesthetic Interface Theme</span>
                  <span className={`text-xs leading-relaxed block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Flip workspace viewing styles between crisp Light skin or standard Midnight mode.</span>
                </div>
                <button onClick={toggleDarkMode} className={`w-14 h-7 flex-shrink-0 rounded-full relative flex items-center p-1 transition-colors ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}><span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 block ${isDarkMode ? 'translate-x-7' : 'translate-x-0'}`} /></button>
              </div>
            </div>
          </div>

          {/* OMNI-CHANNEL INTEGRATIONS */}
          <div className={`p-6 rounded-2xl border shadow-sm transition-colors duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className="text-lg font-bold mb-1">Self-Service Omni-Channel Integrations</h3>
            <p className={`text-xs mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Select a commercial social media provider below to integrate endpoints directly into your workspace node.</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { id: 'facebook', name: 'Messenger', icon: <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> },
                { id: 'telegram', name: 'Telegram', icon: <MessageSquare size={24} className="text-sky-500" /> },
                { id: 'whatsapp', name: 'WhatsApp', icon: <MessageCircle size={24} className="text-emerald-500" /> },
                { id: 'tiktok', name: 'TikTok Shop', icon: <ShoppingBag size={24} className={isDarkMode ? 'text-white' : 'text-black'} /> },
                { id: 'viber', name: 'Viber Chat', icon: <PhoneCall size={24} className="text-purple-600" /> },
                { id: 'line', name: 'Line Network', icon: <MessageCircle size={24} className="text-green-500" /> },
              ].map((plat) => {
                const isConnected = integrations.some(i => i.channel === plat.id);
                return (
                  <button
                    key={plat.id}
                    onClick={() => { setActiveChannel(plat.id as ChannelType); setChannelStatus(''); setIsEditing(false); setCredentialKey(''); }}
                    className={`relative p-5 rounded-xl border flex flex-col items-center justify-center gap-3 transition-all duration-200 overflow-hidden ${activeChannel === plat.id ? 'border-indigo-500 bg-indigo-500/10 shadow-inner' : isDarkMode ? 'border-slate-800 hover:border-slate-600 bg-slate-950/40' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'}`}
                  >
                    {isConnected && (
                      <div className="absolute top-2 right-2 flex items-center justify-center">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-sm ring-2 ring-emerald-500/30 animate-pulse"></span>
                      </div>
                    )}
                    {plat.icon}
                    <span className="text-xs font-bold">{plat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* CONNECTION MANAGER VIEW */}
            {activeChannel && guidelines[activeChannel] && (
              <div className={`mt-6 p-6 border rounded-xl animate-fade-in transition-colors ${isDarkMode ? 'bg-slate-950/80 border-indigo-500/30' : 'bg-indigo-50/50 border-indigo-100'}`}>
                
                {activeIntegration && !isEditing ? (
                  /* ALREADY CONNECTED STATE */
                  <div className="space-y-5">
                    <div className="flex items-center justify-between border-b pb-4 border-indigo-500/20">
                      <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={24} />
                        <div>
                          <h4 className="text-sm font-bold">{guidelines[activeChannel].title} Active</h4>
                          <p className="text-xs opacity-80 mt-0.5">Webhook is currently routing inbound data streams.</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                      <div className={`flex-1 p-4 rounded-lg font-mono text-sm border flex items-center gap-3 w-full ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
                        <KeyRound size={16} className="text-slate-400 flex-shrink-0" />
                        <span className="truncate">{maskToken(activeIntegration.token)}</span>
                      </div>
                      
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button onClick={() => setIsEditing(true)} className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-xs font-bold transition border ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'}`}>
                          Update Token
                        </button>
                        <button onClick={() => handleDisconnect(activeIntegration.id, activeChannel)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20">
                          <Trash2 size={14} /> Disconnect
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* NEW CONNECTION OR EDITING STATE */
                  <div className="space-y-5">
                    <div className="flex items-start gap-3 text-indigo-600">
                      <Info size={20} className="mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className={`text-sm font-bold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900'}`}>{isEditing ? 'Update Configuration' : guidelines[activeChannel].title}</h4>
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Follow the precise pipeline rules below to clear authentication layers manually.</p>
                      </div>
                    </div>
                    
                    <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <ol className={`space-y-2.5 pl-5 list-decimal text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        {guidelines[activeChannel].steps.map((step, idx) => <li key={idx} className="pl-2 leading-relaxed">{step}</li>)}
                      </ol>
                    </div>

                    <form onSubmit={handleSaveChannelConfig} className="flex flex-col sm:flex-row gap-3 pt-2">
                      <div className="relative flex-1">
                        <KeyRound size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                        <input type="text" value={credentialKey} onChange={e => setCredentialKey(e.target.value)} required placeholder={guidelines[activeChannel].placeholder} className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`} />
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        {isEditing && (
                          <button type="button" onClick={() => setIsEditing(false)} className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-bold border transition ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'}`}>Cancel</button>
                        )}
                        <button type="submit" className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-6 py-2.5 rounded-lg transition-all shadow-md whitespace-nowrap">
                          {isEditing ? 'Save Update' : 'Connect Integration'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* STATUS MESSAGES */}
                {channelStatus && (
                  <div className={`mt-4 text-xs font-bold p-3 rounded-lg border flex items-center gap-2 animate-fade-in ${channelStatus.includes('Error') ? (isDarkMode ? 'bg-rose-950/40 text-rose-400 border-rose-900' : 'bg-rose-50 text-rose-700 border-rose-200') : (isDarkMode ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900' : 'bg-emerald-50 text-emerald-700 border-emerald-200')}`}>
                    {channelStatus.includes('Error') ? <AlertCircle size={16} className="flex-shrink-0" /> : <CheckCircle2 size={16} className="flex-shrink-0" />}
                    {channelStatus}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECURITY MODULE */}
          <div className={`p-6 rounded-2xl border shadow-sm transition-colors duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2"><Shield size={18} className="text-indigo-600" /> Security & Authentication</h3>
            <p className={`text-xs mb-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Rotate your workspace node passkeys regularly to protect data integrity parameters.</p>
            
            <form onSubmit={handleUpdatePassword} className="max-w-md space-y-4">
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>New Workspace Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="Enter minimum 8 character passkey" className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition border ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`} />
              </div>
              <button type="submit" className="bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white text-sm font-bold px-6 py-2.5 rounded-lg transition-all shadow-md active:scale-95">Apply Security Update</button>
            </form>

            {profileStatus && (
              <div className={`mt-4 inline-flex items-center gap-2 text-xs font-bold p-3 rounded-lg border animate-fade-in ${profileStatus.includes('Error') ? (isDarkMode ? 'bg-rose-950/40 text-rose-400 border-rose-900' : 'bg-rose-50 text-rose-700 border-rose-200') : (isDarkMode ? 'bg-indigo-950/40 text-indigo-400 border-indigo-900' : 'bg-indigo-50 text-indigo-700 border-indigo-200')}`}>
                {profileStatus.includes('Error') ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                {profileStatus}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}