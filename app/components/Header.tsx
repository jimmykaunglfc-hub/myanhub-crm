"use client";

import { Search, Bell, Link2 } from 'lucide-react';

export default function Header() {
  const handleConnectShopTrigger = () => {
    alert("MyanHub Integrations Core Engine Notice:\n\nConnecting a new shop node (TikTok Shop API or Meta Graph API) requires OAuth2 platform keys. To configure custom integration developer keys for your tenant workspace account, please visit the API Connections table block located inside the Settings tab module.");
  };

  return (
    <header className="bg-white/80 backdrop-blur-md fixed top-0 right-0 w-full md:w-[calc(100%-16rem)] z-40 border-b border-slate-200 flex justify-between items-center h-16 px-6">
      <div className="flex items-center flex-1">
        <div className="relative w-full max-w-md hidden md:block">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search orders, customers..." 
            className="w-full bg-slate-50 text-slate-900 text-sm py-2 pl-10 pr-4 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>
        <h1 className="md:hidden text-xl font-extrabold text-indigo-600">MyanHub</h1>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-all">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        <button 
          onClick={handleConnectShopTrigger}
          className="hidden md:flex items-center gap-2 bg-white text-slate-700 text-sm font-medium py-2 px-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm active:scale-95 duration-150"
        >
          <Link2 size={16} />
          Connect Shop
        </button>
      </div>
    </header>
  );
}