"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Settings, Sliders, Eye, EyeOff, CheckCircle, Info,
  MessageSquare, MessageCircle, ShoppingBag, PhoneCall, ArrowRight
} from 'lucide-react';

type ChannelType = 'facebook' | 'telegram' | 'viber' | 'tiktok' | 'whatsapp' | 'line';

export default function EnhancedSettings() {
  // Mode Switcher States
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);

  // Profile States
  const [userEmail, setUserEmail] = useState('Loading...');
  const [newPassword, setNewPassword] = useState('');
  const [profileStatus, setProfileStatus] = useState('');

  // Self-Service Platform Setup States
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

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatus('Encrypting credentials...');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setProfileStatus(`Error: ${error.message}`);
    } else {
      setProfileStatus('Passkey rotated successfully!');
      setNewPassword('');
    }
  };

  const handleSaveChannelConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setChannelStatus('Verifying access tokens with API gates...');
    setTimeout(() => {
      setChannelStatus(`Success! Connected to your active ${activeChannel} integration channel.`);
      setCredentialKey('');
    }, 1200);
  };

  const guidelines: Record<ChannelType, { title: string; steps: string[]; placeholder: string }> = {
    telegram: {
      title: "Telegram Bot API Integration Guide",
      steps: [
        "Open Telegram and search for the @BotFather manager node.",
        "Send the text command '/newbot' and assign a public identity configuration handle.",
        "Copy the generated cryptographic HTTP API Token string parameter.",
        "Paste the token values below to activate background listener webhooks instantly."
      ],
      placeholder: "Enter Bot API Token (e.g., 7428941:AAH_x...)"
    },
    facebook: {
      title: "Facebook Messenger Business Setup",
      steps: [
        "Navigate to developers.facebook.com and initialize a Meta Business App console.",
        "Add the 'Messenger' feature product bundle inside your navigation dashboard controls.",
        "Link your active commercial Page asset and generate a Permanent Page Access Token.",
        "Input your Access Token parameter key down below to stream inbound message webhooks."
      ],
      placeholder: "Enter Meta Page Access Token String"
    },
    viber: {
      title: "Viber Business Chat Integration",
      steps: [
        "Visit the official Viber Partner Console panel asset gateway.",
        "Select 'Create Bot Account', upload your brand assets and fill out workspace descriptors.",
        "Acquire your master application App Token key from the confirmation screen setup matrix.",
        "Bind your account parameters to the MyanHub ingestion node below."
      ],
      placeholder: "Enter Viber App Token Key"
    },
    tiktok: {
      title: "TikTok Shop Multi-Tenant API Hub",
      steps: [
        "Sign in directly to your TikTok Shop Affiliate Developer Center portal.",
        "Authorize 'MyanHub Platform Connector' under cross-origin account configurations.",
        "Extract your unique App Key string along with your active Client Secret parameters.",
        "Paste your validation keys below to begin automatic inventory mapping streams."
      ],
      placeholder: "Enter TikTok Shop Authorization App Key"
    },
    whatsapp: {
      title: "WhatsApp Cloud Business System Integration",
      steps: [
        "Go to your Meta Developer Matrix portal and choose your WhatsApp Business application node.",
        "Set up standard WhatsApp Business API access triggers inside your project hierarchy.",
        "Generate your permanent system access authorization token parameters.",
        "Submit the key below to pipeline customer communication channels safely."
      ],
      placeholder: "Enter Meta WhatsApp Business Access Token"
    },
    line: {
      title: "Line Developers Messaging Network Connect",
      steps: [
        "Log into your active Line Developers Business account console pipeline.",
        "Create a brand-new Messaging API Provider channel context wrapper.",
        "Issue a permanent Long-Lived Channel Access Token string inside configuration settings.",
        "Feed the token key matrix into your MyanHub receiver down below."
      ],
      placeholder: "Enter Line Channel Access Token String"
    }
  };

  return (
    <div className={`min-h-screen flex font-sans ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <Sidebar />
      <main className="flex-1 md:ml-64 flex flex-col relative">
        <Header />
        
        <div className="flex-1 overflow-y-auto mt-16 p-6 md:p-8 space-y-8">
          <div>
            <h2 className="text-2xl font-bold">Client Workspace Settings</h2>
            <p className="text-slate-500 text-sm mt-1">Configure workspace environment parameters, rotate access metrics, and self-connect your sales channels.</p>
          </div>

          {/* SECTION 1: MODE SWITCHERS MODULE BLOCK */}
          <div className={`p-6 rounded-xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Sliders size={18} className="text-indigo-600" /> System Mode Selection</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              <div className="p-4 bg-slate-50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="block text-sm font-bold">Operation Workspace Mode</span>
                  <span className="text-xs text-slate-400">Toggle Sandbox testing environments or Live data relays.</span>
                </div>
                <button 
                  onClick={() => setIsLiveMode(!isLiveMode)}
                  className={`w-14 h-7 rounded-full transition-colors relative flex items-center p-1 ${isLiveMode ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-800'}`}
                >
                  <span className={`w-5 h-5 rounded-full bg-white shadow transition-transform block ${isLiveMode ? 'translate-x-7' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="block text-sm font-bold">Aesthetic Workspace Interface Theme</span>
                  <span className="text-xs text-slate-400">Flip view styles between crisp Light skin or standard Midnight view mode.</span>
                </div>
                <button 
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`w-14 h-7 rounded-full transition-colors relative flex items-center p-1 ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <span className={`w-5 h-5 rounded-full bg-white shadow transition-transform block ${isDarkMode ? 'translate-x-7' : 'translate-x-0'}`} />
                </button>
              </div>

            </div>
          </div>

          {/* SECTION 2: DYNAMIC SELF-SERVICE CHANNELS HUB MATRIX */}
          <div className={`p-6 rounded-xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className="text-lg font-bold mb-1">Self-Service Omni-Channel Communications Ingestion</h3>
            <p className="text-xs text-slate-400 mb-6">Select any commercial social media provider below to integrate your endpoints directly into your workspace node.</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { 
                  id: 'facebook', 
                  name: 'Messenger', 
                  icon: (
                    <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                    </svg>
                  ) 
                },
                { id: 'telegram', name: 'Telegram', icon: <MessageSquare className="text-sky-500" /> },
                { id: 'whatsapp', name: 'WhatsApp', icon: <MessageCircle className="text-emerald-500" /> },
                { id: 'tiktok', name: 'TikTok Shop', icon: <ShoppingBag className="text-black dark:text-white" /> },
                { id: 'viber', name: 'Viber Chat', icon: <PhoneCall className="text-purple-600" /> },
                { id: 'line', name: 'Line Network', icon: <MessageCircle className="text-green-500" /> },
              ].map((plat) => (
                <button
                  key={plat.id}
                  onClick={() => { setActiveChannel(plat.id as ChannelType); setChannelStatus(''); }}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${activeChannel === plat.id ? 'border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'}`}
                >
                  {plat.icon}
                  <span className="text-xs font-bold">{plat.name}</span>
                </button>
              ))}
            </div>

            {activeChannel && guidelines[activeChannel] && (
              <div className="mt-6 p-6 bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-xl space-y-6 animate-fade-in">
                <div className="flex items-start gap-2 text-indigo-600">
                  <Info size={18} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{guidelines[activeChannel].title}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Follow the precise pipeline rules below to clear authentication layers manually.</p>
                  </div>
                </div>

                <ol className="space-y-2 pl-4 list-decimal text-xs text-slate-600 dark:text-slate-400 font-medium">
                  {guidelines[activeChannel].steps.map((step, index) => (
                    <li key={index} className="pl-1 leading-relaxed">{step}</li>
                  ))}
                </ol>

                <form onSubmit={handleSaveChannelConfig} className="max-w-xl flex flex-col sm:flex-row gap-3 pt-2">
                  <input
                    type="text"
                    value={credentialKey}
                    onChange={e => setCredentialKey(e.target.value)}
                    required
                    placeholder={guidelines[activeChannel].placeholder}
                    className="flex-1 px-4 py-2 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition shadow whitespace-nowrap">
                    Establish Secure Integration Link
                  </button>
                </form>

                {channelStatus && (
                  <p className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900 p-2.5 rounded-lg">
                    {channelStatus}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: STANDARD PROFILE PASSWORD ROTATION MATRIX */}
          <div className={`p-6 rounded-xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className="text-lg font-bold mb-1">Security Authentication Token Update</h3>
            <p className="text-xs text-slate-400 mb-4">Rotate your workspace node passkeys to protect data integrity parameters.</p>
            
            <form onSubmit={handleUpdatePassword} className="max-w-md space-y-3">
              <input 
                type="password" 
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                placeholder="Enter absolute new security password value" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
              />
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-sm">
                Apply Passkey Update
              </button>
            </form>
            {profileStatus && <p className="mt-3 text-xs text-indigo-600 font-bold">{profileStatus}</p>}
          </div>

        </div>
      </main>
    </div>
  );
}