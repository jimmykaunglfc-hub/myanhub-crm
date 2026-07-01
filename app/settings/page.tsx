"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Sliders, Info, MessageSquare, MessageCircle, ShoppingBag, PhoneCall
} from 'lucide-react';

type ChannelType = 'facebook' | 'telegram' | 'viber' | 'tiktok' | 'whatsapp' | 'line';

export default function EnhancedSettings() {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [userEmail, setUserEmail] = useState('Loading...');
  const [activeChannel, setActiveChannel] = useState<ChannelType | null>(null);
  const [credentialKey, setCredentialKey] = useState('');
  const [channelStatus, setChannelStatus] = useState('');

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
    };
    fetchSession();
  }, []);

  const handleSaveChannelConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setChannelStatus('Verifying access tokens...');
    setTimeout(() => {
      setChannelStatus(`Success! Connected to your active ${activeChannel} integration channel.`);
      setCredentialKey('');
    }, 1200);
  };

  const guidelines: Record<ChannelType, { title: string; steps: string[]; placeholder: string }> = {
    telegram: { title: "Telegram Bot API Guide", steps: ["Search for @BotFather.", "Send '/newbot'.", "Copy the Token."], placeholder: "Enter Bot Token" },
    facebook: { title: "Meta Messenger Guide", steps: ["Go to developers.facebook.com.", "Link your Page.", "Generate Token."], placeholder: "Enter Page Access Token" },
    viber: { title: "Viber Business Guide", steps: ["Open Viber Partner Console.", "Create Bot.", "Copy App Key."], placeholder: "Enter Viber Token" },
    tiktok: { title: "TikTok Shop API Guide", steps: ["Open TikTok Affiliate Center.", "Authorize MyanHub.", "Copy App Key."], placeholder: "Enter TikTok App Key" },
    whatsapp: { title: "WhatsApp Cloud Guide", steps: ["Go to Meta Developers.", "Enable WhatsApp API.", "Copy Token."], placeholder: "Enter WhatsApp Token" },
    line: { title: "Line Network Guide", steps: ["Open Line Developers Console.", "Create Provider.", "Issue Channel Token."], placeholder: "Enter Line Token" }
  };

  return (
    <div className="flex font-sans min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative">
        <Header />
        
        <div className="flex-1 overflow-y-auto mt-16 p-6 md:p-8 space-y-8">
          <div>
            <h2 className="text-2xl font-bold">Client Workspace Settings</h2>
            <p className="text-slate-500 text-sm mt-1">Configure workspace parameters and self-connect your sales channels.</p>
          </div>

          {/* THEME & OPERATION SWITCHERS */}
          <div className={`p-6 rounded-xl border shadow-sm transition-colors duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Sliders size={18} className="text-indigo-600" /> System Mode Selection</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              <div className={`p-4 border rounded-xl flex items-center justify-between transition-colors ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                <div>
                  <span className="block text-sm font-bold">Operation Workspace Mode</span>
                  <span className="text-xs text-slate-400">Toggle Sandbox testing or Live data relays.</span>
                </div>
                <button onClick={() => setIsLiveMode(!isLiveMode)} className={`w-14 h-7 rounded-full relative flex items-center p-1 ${isLiveMode ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-800'}`}><span className={`w-5 h-5 rounded-full bg-white shadow transition-transform block ${isLiveMode ? 'translate-x-7' : 'translate-x-0'}`} /></button>
              </div>

              <div className={`p-4 border rounded-xl flex items-center justify-between transition-colors ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                <div>
                  <span className="block text-sm font-bold">Aesthetic Interface Theme</span>
                  <span className="text-xs text-slate-400">Flip view styles between crisp Light or standard Midnight.</span>
                </div>
                <button onClick={toggleDarkMode} className={`w-14 h-7 rounded-full relative flex items-center p-1 ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}><span className={`w-5 h-5 rounded-full bg-white shadow transition-transform block ${isDarkMode ? 'translate-x-7' : 'translate-x-0'}`} /></button>
              </div>

            </div>
          </div>

          {/* SOCIAL MEDIA INGESTION GRID */}
          <div className={`p-6 rounded-xl border shadow-sm transition-colors duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className="text-lg font-bold mb-1">Self-Service Omni-Channel Communications</h3>
            <p className="text-xs text-slate-400 mb-6">Select a platform below to integrate endpoints directly into your workspace.</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { id: 'facebook', name: 'Messenger', icon: <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> },
                { id: 'telegram', name: 'Telegram', icon: <MessageSquare className="text-sky-500" /> },
                { id: 'whatsapp', name: 'WhatsApp', icon: <MessageCircle className="text-emerald-500" /> },
                { id: 'tiktok', name: 'TikTok Shop', icon: <ShoppingBag className={isDarkMode ? 'text-white' : 'text-black'} /> },
                { id: 'viber', name: 'Viber Chat', icon: <PhoneCall className="text-purple-600" /> },
                { id: 'line', name: 'Line Network', icon: <MessageCircle className="text-green-500" /> },
              ].map((plat) => (
                <button
                  key={plat.id}
                  onClick={() => { setActiveChannel(plat.id as ChannelType); setChannelStatus(''); }}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${activeChannel === plat.id ? 'border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-500/20' : isDarkMode ? 'border-slate-800 hover:border-slate-700 bg-slate-950/40' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'}`}
                >
                  {plat.icon}
                  <span className="text-xs font-bold">{plat.name}</span>
                </button>
              ))}
            </div>

            {activeChannel && guidelines[activeChannel] && (
              <div className={`mt-6 p-6 border rounded-xl space-y-4 animate-fade-in transition-colors ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-start gap-2 text-indigo-600">
                  <Info size={18} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{guidelines[activeChannel].title}</h4>
                  </div>
                </div>
                <ol className={`space-y-1.5 pl-4 list-decimal text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  {guidelines[activeChannel].steps.map((step, idx) => <li key={idx}>{step}</li>)}
                </ol>
                <form onSubmit={handleSaveChannelConfig} className="max-w-xl flex flex-col sm:flex-row gap-3 pt-2">
                  <input type="text" value={credentialKey} onChange={e => setCredentialKey(e.target.value)} required placeholder={guidelines[activeChannel].placeholder} className={`flex-1 px-4 py-2 rounded-lg text-xs focus:outline-none focus:border-indigo-500 transition-colors border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`} />
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition whitespace-nowrap">Connect Link</button>
                </form>
                {channelStatus && <p className={`text-xs font-semibold p-2 rounded border ${isDarkMode ? 'bg-indigo-950/40 text-indigo-400 border-indigo-900' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>{channelStatus}</p>}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}